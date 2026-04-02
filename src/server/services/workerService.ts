import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { workers } from '../db/schema.js';
import { insertAuditLog, diffObjects } from './auditService.js';
import { encryptSsn } from './cryptoService.js';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

// ── Types ─────────────────────────────────────────────────────────────────

interface AuditContext {
  userId: string;
  userEmail: string;
  ipAddress: string | null;
  projectId: string;
}

export interface CreateWorkerInput extends AuditContext {
  name: string;
  ssn?: string;
  tradeUnion?: string | null;
  address?: string | null;
}

export interface UpdateWorkerInput extends AuditContext {
  workerId: string;
  name?: string;
  ssn?: string | null;
  tradeUnion?: string | null;
  address?: string | null;
}

export interface DeleteWorkerInput extends AuditContext {
  workerId: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function deriveHasFullSsn(ssnEncrypted: string | null): boolean {
  if (!ssnEncrypted) return false;
  try {
    return (JSON.parse(ssnEncrypted) as { len?: number }).len === 9;
  } catch {
    return false;
  }
}

function safeWorker(worker: { ssnEncrypted: string | null; [key: string]: unknown }) {
  const { ssnEncrypted, ...rest } = worker;
  return { ...rest, hasFullSsn: deriveHasFullSsn(ssnEncrypted) };
}

// ── Service Functions ──────────────────────────────────────────────────────

export async function createWorker(
  db: BetterSQLite3Database<Record<string, never>>,
  input: CreateWorkerInput,
) {
  const id = randomUUID();
  const now = new Date().toISOString();

  await db.insert(workers).values({
    id,
    projectId: input.projectId,
    name: input.name,
    ssnLast4: input.ssn ? input.ssn.slice(-4) : null,
    ssnEncrypted: input.ssn ? encryptSsn(input.ssn) : null,
    tradeUnion: input.tradeUnion ?? null,
    address: input.address ?? null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  const [worker] = await db.select().from(workers).where(eq(workers.id, id)).limit(1);

  // Best-effort audit log — never throws
  try {
    await insertAuditLog({
      userId: input.userId,
      userEmail: input.userEmail,
      ipAddress: input.ipAddress,
      projectId: input.projectId,
      entityType: 'worker',
      entityId: id,
      action: 'worker.created',
      snapshot: worker as unknown as Record<string, unknown>,
      meta: { workerName: input.name },
    });
  } catch (auditErr) {
    console.error('[audit] worker.created audit failed:', auditErr);
  }

  return safeWorker(worker!);
}

export async function updateWorker(
  db: BetterSQLite3Database<Record<string, never>>,
  input: UpdateWorkerInput,
) {
  const [existing] = await db.select().from(workers).where(eq(workers.id, input.workerId)).limit(1);
  if (!existing || existing.projectId !== input.projectId) {
    throw { status: 404, message: 'Worker not found' };
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updatedAt: now };
  if (input.name !== undefined) updates.name = input.name;
  if ('ssn' in input) {
    if (input.ssn) {
      updates.ssnEncrypted = encryptSsn(input.ssn);
      updates.ssnLast4 = input.ssn.slice(-4);
    } else {
      updates.ssnEncrypted = null;
      updates.ssnLast4 = null;
    }
  }
  if ('tradeUnion' in input) updates.tradeUnion = input.tradeUnion ?? null;
  if ('address' in input) updates.address = input.address ?? null;

  await db.update(workers).set(updates).where(eq(workers.id, input.workerId));
  const [updated] = await db.select().from(workers).where(eq(workers.id, input.workerId)).limit(1);

  // Best-effort audit log
  try {
    const diff = diffObjects(
      existing as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>,
    );
    if (diff) {
      await insertAuditLog({
        userId: input.userId,
        userEmail: input.userEmail,
        ipAddress: input.ipAddress,
        projectId: input.projectId,
        entityType: 'worker',
        entityId: input.workerId,
        action: 'worker.updated',
        diff,
        meta: { workerName: updated!.name },
      });
    }
  } catch (auditErr) {
    console.error('[audit] worker.updated audit failed:', auditErr);
  }

  return safeWorker(updated!);
}

export async function deleteWorker(
  db: BetterSQLite3Database<Record<string, never>>,
  input: DeleteWorkerInput,
) {
  const [worker] = await db.select().from(workers).where(eq(workers.id, input.workerId)).limit(1);
  if (!worker || worker.projectId !== input.projectId) {
    throw { status: 404, message: 'Worker not found' };
  }

  await db.delete(workers).where(eq(workers.id, input.workerId));

  // Best-effort audit log
  try {
    await insertAuditLog({
      userId: input.userId,
      userEmail: input.userEmail,
      ipAddress: input.ipAddress,
      projectId: input.projectId,
      entityType: 'worker',
      entityId: input.workerId,
      action: 'worker.deleted',
      snapshot: worker as unknown as Record<string, unknown>,
      meta: { workerName: worker.name },
    });
  } catch (auditErr) {
    console.error('[audit] worker.deleted audit failed:', auditErr);
  }

  return { deleted: true };
}
