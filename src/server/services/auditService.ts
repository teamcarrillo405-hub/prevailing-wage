import { randomUUID } from 'crypto';
import { getDb } from '../db/index.js';
import { auditLogs } from '../db/schema.js';

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
  });
}
