import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { workers, projects } from '../db/schema.js';
import { insertAuditLog, diffObjects } from './auditService.js';
import { sendActivityEmail } from './emailService.js';
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
  address?: string | null; // keep for type compat but stop writing
  addressStreet?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressZip?: string | null;
  unionLocal?: string | null;
  unionBookNumber?: string | null;
  apprenticeshipCommittee?: string | null;
  apprenticeshipRegNumber?: string | null;
  nysRegisteredApprentice?: boolean;
  race?: string | null;
  ethnicity?: string | null;
  gender?: string | null;
  veteranStatus?: string | null;
  skillLevel?: string | null;
  // Phase 49 — MA nullable boolean columns
  isWoman?: boolean | null;
  isMinority?: boolean | null;
  oshaTraining?: boolean | null;
}

export interface UpdateWorkerInput extends AuditContext {
  workerId: string;
  name?: string;
  ssn?: string | null;
  tradeUnion?: string | null;
  address?: string | null; // keep for type compat but stop writing
  addressStreet?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressZip?: string | null;
  unionLocal?: string | null;
  unionBookNumber?: string | null;
  apprenticeshipCommittee?: string | null;
  apprenticeshipRegNumber?: string | null;
  nysRegisteredApprentice?: boolean;
  race?: string | null;
  ethnicity?: string | null;
  gender?: string | null;
  veteranStatus?: string | null;
  skillLevel?: string | null;
  // Phase 49 — MA nullable boolean columns
  isWoman?: boolean | null;
  isMinority?: boolean | null;
  oshaTraining?: boolean | null;
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
    // address column not written for new records (add-only policy) — use structured fields
    addressStreet: input.addressStreet ?? null,
    addressCity: input.addressCity ?? null,
    addressState: input.addressState ?? null,
    addressZip: input.addressZip ?? null,
    unionLocal: input.unionLocal ?? null,
    unionBookNumber: input.unionBookNumber ?? null,
    apprenticeshipCommittee: input.apprenticeshipCommittee ?? null,
    apprenticeshipRegNumber: input.apprenticeshipRegNumber ?? null,
    nysRegisteredApprentice: input.nysRegisteredApprentice ?? false,
    race: input.race ?? null,
    ethnicity: input.ethnicity ?? null,
    gender: input.gender ?? null,
    veteranStatus: input.veteranStatus ?? null,
    skillLevel: input.skillLevel ?? null,
    isWoman: input.isWoman ?? null,
    isMinority: input.isMinority ?? null,
    oshaTraining: input.oshaTraining ?? null,
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

  // NOTIF-03: team activity notification — best-effort, non-fatal (NFR-02)
  // sendActivityEmail internally skips if actingUserId === ownerUserId
  try {
    const [proj] = await db.select({ name: projects.name })
      .from(projects).where(eq(projects.id, input.projectId)).limit(1);
    await sendActivityEmail(
      input.projectId,
      proj?.name ?? input.projectId,
      input.userId,
      input.userEmail,
      `Worker created: ${input.name}`,
    );
  } catch (err) {
    console.error('[email] NOTIF-03 worker.created activity notification failed:', err);
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
  // address column not updated for existing records (add-only policy) — use structured fields
  if ('addressStreet' in input) updates.addressStreet = input.addressStreet ?? null;
  if ('addressCity' in input) updates.addressCity = input.addressCity ?? null;
  if ('addressState' in input) updates.addressState = input.addressState ?? null;
  if ('addressZip' in input) updates.addressZip = input.addressZip ?? null;
  if ('unionLocal' in input) updates.unionLocal = input.unionLocal ?? null;
  if ('unionBookNumber' in input) updates.unionBookNumber = input.unionBookNumber ?? null;
  if ('apprenticeshipCommittee' in input) updates.apprenticeshipCommittee = input.apprenticeshipCommittee ?? null;
  if ('apprenticeshipRegNumber' in input) updates.apprenticeshipRegNumber = input.apprenticeshipRegNumber ?? null;
  if (input.nysRegisteredApprentice !== undefined) updates.nysRegisteredApprentice = input.nysRegisteredApprentice;
  if ('race' in input) updates.race = input.race ?? null;
  if ('ethnicity' in input) updates.ethnicity = input.ethnicity ?? null;
  if ('gender' in input) updates.gender = input.gender ?? null;
  if ('veteranStatus' in input) updates.veteranStatus = input.veteranStatus ?? null;
  if ('skillLevel' in input) updates.skillLevel = input.skillLevel ?? null;
  if ('isWoman' in input) updates.isWoman = input.isWoman ?? null;
  if ('isMinority' in input) updates.isMinority = input.isMinority ?? null;
  if ('oshaTraining' in input) updates.oshaTraining = input.oshaTraining ?? null;

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

  // NOTIF-03: team activity notification — best-effort, non-fatal (NFR-02)
  // sendActivityEmail internally skips if actingUserId === ownerUserId
  try {
    const [proj] = await db.select({ name: projects.name })
      .from(projects).where(eq(projects.id, input.projectId)).limit(1);
    await sendActivityEmail(
      input.projectId,
      proj?.name ?? input.projectId,
      input.userId,
      input.userEmail,
      `Worker updated: ${updated?.name ?? input.name ?? ''}`,
    );
  } catch (err) {
    console.error('[email] NOTIF-03 worker.updated activity notification failed:', err);
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
