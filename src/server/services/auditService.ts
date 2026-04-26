import { randomUUID, createHash } from 'crypto';
import { desc, eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { auditLogs } from '../db/schema.js';

/**
 * Phase 79 — Hash-chain entry hash (SOC 2 SEC-04).
 * SHA-256 of the canonical join id|action|previousHash|createdAt.
 * Exported for the integrity-check endpoint to recompute and compare.
 */
export function computeAuditEntryHash(
  id: string,
  action: string,
  previousHash: string | null,
  createdAt: string,
): string {
  return createHash('sha256')
    .update(`${id}|${action}|${previousHash ?? ''}|${createdAt}`, 'utf8')
    .digest('hex');
}

// ── Types ───────────────────────────────────────────────────────────────

export interface InsertAuditLogInput {
  userId:     string | null;
  userEmail:  string | null;
  ipAddress:  string | null;
  projectId:  string | null;
  entityType: string;
  entityId:   string;
  action:     string;
  diff?:      Record<string, unknown> | null;
  snapshot?:  Record<string, unknown> | null;
  meta?:      Record<string, unknown> | null;
}

// ── SSN Redaction ───────────────────────────────────────────────────────

const REDACTED_FIELDS = ['ssnEncrypted', 'passwordHash'] as const;

function redactSensitiveFields(obj: Record<string, unknown>): Record<string, unknown> {
  const result = { ...obj };
  for (const field of REDACTED_FIELDS) {
    if (field in result) {
      result[field] = result[field] !== null ? '[REDACTED]' : null;
    }
  }
  return result;
}

function hasSensitiveNonNull(obj: Record<string, unknown>): boolean {
  return 'ssnEncrypted' in obj && obj.ssnEncrypted !== null;
}

// ── Diff Helper ─────────────────────────────────────────────────────────

export function diffObjects(
  before: Record<string, unknown>,
  after:  Record<string, unknown>,
  omitFields: string[] = ['updatedAt', 'createdAt', 'updated_at', 'created_at'],
): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  const changedBefore: Record<string, unknown> = {};
  const changedAfter:  Record<string, unknown> = {};
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of allKeys) {
    if (omitFields.includes(key)) continue;
    if (before[key] !== after[key]) {
      changedBefore[key] = before[key];
      changedAfter[key]  = after[key];
    }
  }
  if (Object.keys(changedBefore).length === 0) return null;
  return { before: changedBefore, after: changedAfter };
}

// ── Insert (append-only — no update or delete exported) ─────────────────

export async function insertAuditLog(input: InsertAuditLogInput): Promise<void> {
  const db = getDb();
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  // Phase 79: Pull the most recent entry's hash for chaining. NULL means
  // genesis (or all prior rows are pre-Phase-79 backfill — also OK).
  const [prev] = await db
    .select({ entryHash: auditLogs.entryHash })
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(1);
  const previousHash: string | null = prev?.entryHash ?? null;
  const entryHash = computeAuditEntryHash(id, input.action, previousHash, createdAt);

  // Detect SSN presence for meta enrichment (NFR-04)
  let ssnDetected = false;

  // Redact diff payload
  let diffPayload: string | null = null;
  if (input.diff) {
    const before = input.diff.before as Record<string, unknown>;
    const after  = input.diff.after  as Record<string, unknown>;
    if (before && hasSensitiveNonNull(before)) ssnDetected = true;
    if (after && hasSensitiveNonNull(after)) ssnDetected = true;
    diffPayload = JSON.stringify({
      before: before ? redactSensitiveFields(before) : null,
      after:  after  ? redactSensitiveFields(after)  : null,
    });
  }

  // Redact snapshot payload
  let snapshotPayload: string | null = null;
  if (input.snapshot) {
    if (hasSensitiveNonNull(input.snapshot)) ssnDetected = true;
    snapshotPayload = JSON.stringify(redactSensitiveFields(input.snapshot));
  }

  // Enrich meta with hasFullSsn if SSN was present (NFR-04)
  const metaObj: Record<string, unknown> = input.meta ? { ...input.meta } : {};
  if (ssnDetected) {
    metaObj.hasFullSsn = true;
  }
  const metaPayload = Object.keys(metaObj).length > 0 ? JSON.stringify(metaObj) : null;

  await db.insert(auditLogs).values({
    id,
    createdAt,
    userId:     input.userId,
    userEmail:  input.userEmail,
    ipAddress:  input.ipAddress,
    projectId:  input.projectId,
    entityType: input.entityType,
    entityId:   input.entityId,
    action:     input.action,
    diff:       diffPayload,
    snapshot:   snapshotPayload,
    meta:       metaPayload,
    previousHash,
    entryHash,
  });
}

// ── Phase 79: Hash-chain integrity walk ─────────────────────────────────

export interface IntegrityCheckResult {
  valid: boolean;
  scanned: number;
  brokenAt?: { id: string; createdAt: string; reason: string };
}

/**
 * Walk the audit_logs chain (optionally scoped to a project) in chronological
 * order, recomputing each entryHash and verifying it matches what was stored
 * AND that previousHash references the prior row's entryHash.
 *
 * Pre-Phase-79 rows (entryHash IS NULL) are skipped — the chain starts at the
 * first row that carries an entryHash.
 */
export async function verifyAuditChain(
  projectId?: string | null,
  limit = 1000,
): Promise<IntegrityCheckResult> {
  const db = getDb();
  const baseQuery = db.select().from(auditLogs);
  const rows = projectId
    ? await baseQuery
        .where(eq(auditLogs.projectId, projectId))
        // Use ascending createdAt so the chain replays in insertion order.
        .orderBy(auditLogs.createdAt)
        .limit(limit)
    : await baseQuery.orderBy(auditLogs.createdAt).limit(limit);

  let lastHash: string | null = null;
  let scanned = 0;
  let chainStarted = false;

  for (const row of rows as Array<typeof auditLogs.$inferSelect>) {
    if (!row.entryHash) {
      // Pre-Phase-79 backfill row — skip, but DO NOT advance lastHash.
      continue;
    }
    scanned++;

    if (!chainStarted) {
      // First chained row — its previousHash should be null OR match the
      // entryHash of the most recent pre-chain row (which we did not track
      // here). We only enforce internal consistency from this point onward.
      chainStarted = true;
    } else if (row.previousHash !== lastHash) {
      return {
        valid: false,
        scanned,
        brokenAt: {
          id: row.id,
          createdAt: row.createdAt,
          reason: 'previous_hash_mismatch',
        },
      };
    }

    const recomputed = computeAuditEntryHash(
      row.id,
      row.action,
      row.previousHash,
      row.createdAt,
    );
    if (recomputed !== row.entryHash) {
      return {
        valid: false,
        scanned,
        brokenAt: {
          id: row.id,
          createdAt: row.createdAt,
          reason: 'entry_hash_mismatch',
        },
      };
    }
    lastHash = row.entryHash;
  }

  return { valid: true, scanned };
}
