// src/server/services/payrollService.ts
import { randomUUID } from 'crypto';
import { eq, desc, max, and, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { getDb } from '../db/index.js';
import {
  payrollWeeks,
  payrollEntries,
  workers,
  workerClassifications,
  payrollWeekClassifications,
  projects,
} from '../db/schema.js';
import { getCachedWd, getCachedClassifications } from './wageCache.js';
import { lookupWageDetermination } from './wageLookup.js';
import { insertAuditLog, diffObjects } from './auditService.js';

// ── Types ─────────────────────────────────────────────────────────────────

export interface CopyWeekInput {
  projectId: string;
  sourceWeekId: string;
  weekEndingDate: string;
  payrollNumber: number;
  preview: boolean;
}

export interface CopiedEntry {
  workerId: string;
  workerName: string;
  classificationId: string;
  tradeDescription: string;
  baseRate: number;
  fringeRate: number;
}

export interface SkippedEntry {
  workerId: string;
  workerName: string;
  classificationId: string;
  tradeDescription: string;
  reason: 'worker-inactive' | 'rate-lookup-failed' | 'no-wd-found';
}

export interface CopyWeekResult {
  weekId: string | null;
  copied: CopiedEntry[];
  skipped: SkippedEntry[];
}

export interface CreatePayrollWeekInput {
  projectId: string;
  weekEndingDate: string; // ISO 8601 date string e.g. "2025-01-05"
  payrollNumber: number;
}

export interface UpsertPayrollEntryInput {
  payrollWeekId: string;
  workerId: string;
  classificationId: string;
  monSt?: number;
  tueSt?: number;
  wedSt?: number;
  thuSt?: number;
  friSt?: number;
  satSt?: number;
  sunSt?: number;
  monOt?: number;
  tueOt?: number;
  wedOt?: number;
  thuOt?: number;
  friOt?: number;
  satOt?: number;
  sunOt?: number;
  monDt?: number;
  tueDt?: number;
  wedDt?: number;
  thuDt?: number;
  friDt?: number;
  satDt?: number;
  sunDt?: number;
  baseRateSnapshot: number;
  fringeRateSnapshot: number;
  grossWages?: number | null;
  deductions?: number;
  netPay?: number | null;
  fringeHealthWelfare?: number | null;
  fringePension?: number | null;
  fringeVacation?: number | null;
  fringeTraining?: number | null;
  userId?: string; // populated from req.user.id on POST/PUT; undefined for amendment copies
  // Audit-only fields — threaded from route handler (AUDIT-03)
  userEmail?: string;
  ipAddress?: string | null;
  workerName?: string;
  payrollNumber?: number;
}

// ── Service Functions ─────────────────────────────────────────────────────

export async function createPayrollWeek(
  input: CreatePayrollWeekInput,
): Promise<{ id: string; payrollNumber: number }> {
  const db = getDb();
  const now = new Date().toISOString();
  const id = randomUUID();

  await db.insert(payrollWeeks).values({
    id,
    projectId: input.projectId,
    weekEndingDate: input.weekEndingDate,
    payrollNumber: input.payrollNumber,
    isFinal: false,
    createdAt: now,
    updatedAt: now,
  });

  return { id, payrollNumber: input.payrollNumber };
}

export async function getPayrollWeek(weekId: string) {
  const db = getDb();
  const [week] = await db
    .select()
    .from(payrollWeeks)
    .where(eq(payrollWeeks.id, weekId))
    .limit(1);
  return week ?? null;
}

export async function listPayrollWeeks(projectId: string) {
  const db = getDb();
  return db
    .select()
    .from(payrollWeeks)
    .where(eq(payrollWeeks.projectId, projectId))
    .orderBy(desc(payrollWeeks.weekEndingDate));
}

export async function upsertPayrollEntry(input: UpsertPayrollEntryInput) {
  const db = getDb();
  const now = new Date().toISOString();
  const id = randomUUID();

  // Detect create vs update for audit logging (AUDIT-03)
  const [existingEntry] = await db
    .select()
    .from(payrollEntries)
    .where(and(
      eq(payrollEntries.payrollWeekId, input.payrollWeekId),
      eq(payrollEntries.workerId, input.workerId),
      eq(payrollEntries.classificationId, input.classificationId),
    ))
    .limit(1);
  const isCreate = !existingEntry;

  const values = {
    id,
    payrollWeekId: input.payrollWeekId,
    workerId: input.workerId,
    classificationId: input.classificationId,
    monSt: input.monSt ?? 0,
    tueSt: input.tueSt ?? 0,
    wedSt: input.wedSt ?? 0,
    thuSt: input.thuSt ?? 0,
    friSt: input.friSt ?? 0,
    satSt: input.satSt ?? 0,
    sunSt: input.sunSt ?? 0,
    monOt: input.monOt ?? 0,
    tueOt: input.tueOt ?? 0,
    wedOt: input.wedOt ?? 0,
    thuOt: input.thuOt ?? 0,
    friOt: input.friOt ?? 0,
    satOt: input.satOt ?? 0,
    sunOt: input.sunOt ?? 0,
    monDt: input.monDt ?? 0,
    tueDt: input.tueDt ?? 0,
    wedDt: input.wedDt ?? 0,
    thuDt: input.thuDt ?? 0,
    friDt: input.friDt ?? 0,
    satDt: input.satDt ?? 0,
    sunDt: input.sunDt ?? 0,
    baseRateSnapshot: input.baseRateSnapshot,
    fringeRateSnapshot: input.fringeRateSnapshot,
    grossWages: input.grossWages ?? null,
    deductions: input.deductions ?? 0,
    netPay: input.netPay ?? null,
    fringeHealthWelfare: input.fringeHealthWelfare ?? null,
    fringePension: input.fringePension ?? null,
    fringeVacation: input.fringeVacation ?? null,
    fringeTraining: input.fringeTraining ?? null,
    createdByUserId: input.userId ?? null,
    updatedByUserId: input.userId ?? null,
    createdAt: now,
    updatedAt: now,
  };

  await db
    .insert(payrollEntries)
    .values(values)
    .onConflictDoUpdate({
      target: [
        payrollEntries.payrollWeekId,
        payrollEntries.workerId,
        payrollEntries.classificationId,
      ],
      set: {
        monSt: values.monSt,
        tueSt: values.tueSt,
        wedSt: values.wedSt,
        thuSt: values.thuSt,
        friSt: values.friSt,
        satSt: values.satSt,
        sunSt: values.sunSt,
        monOt: values.monOt,
        tueOt: values.tueOt,
        wedOt: values.wedOt,
        thuOt: values.thuOt,
        friOt: values.friOt,
        satOt: values.satOt,
        sunOt: values.sunOt,
        monDt: values.monDt,
        tueDt: values.tueDt,
        wedDt: values.wedDt,
        thuDt: values.thuDt,
        friDt: values.friDt,
        satDt: values.satDt,
        sunDt: values.sunDt,
        baseRateSnapshot: values.baseRateSnapshot,
        fringeRateSnapshot: values.fringeRateSnapshot,
        grossWages: values.grossWages,
        deductions: values.deductions,
        netPay: values.netPay,
        fringeHealthWelfare: values.fringeHealthWelfare,
        fringePension: values.fringePension,
        fringeVacation: values.fringeVacation,
        fringeTraining: values.fringeTraining,
        updatedByUserId: values.updatedByUserId,
        updatedAt: now,
      },
    });

  // Return the entry by the unique constraint fields (id may differ from inserted)
  const [entry] = await db
    .select()
    .from(payrollEntries)
    .where(eq(payrollEntries.payrollWeekId, input.payrollWeekId))
    // We filter to the specific worker+classification for the return value
    .limit(100);

  const match = entry
    ? [entry].find(
        (e) =>
          e.workerId === input.workerId &&
          e.classificationId === input.classificationId,
      )
    : null;

  // Best-effort audit log (AUDIT-03) — never throws
  if (match) {
    try {
      // Get projectId from payroll week for audit row
      const [week] = await db
        .select()
        .from(payrollWeeks)
        .where(eq(payrollWeeks.id, input.payrollWeekId))
        .limit(1);
      const projectId = week?.projectId ?? null;

      if (isCreate) {
        await insertAuditLog({
          userId: input.userId ?? null,
          userEmail: input.userEmail ?? null,
          ipAddress: input.ipAddress ?? null,
          projectId,
          entityType: 'payroll_entry',
          entityId: match.id,
          action: 'payroll_entry.created',
          snapshot: match as unknown as Record<string, unknown>,
          meta: {
            workerName: input.workerName ?? null,
            payrollNumber: input.payrollNumber ?? week?.payrollNumber ?? null,
          },
        });
      } else {
        const diff = diffObjects(
          existingEntry as unknown as Record<string, unknown>,
          match as unknown as Record<string, unknown>,
        );
        if (diff) {
          await insertAuditLog({
            userId: input.userId ?? null,
            userEmail: input.userEmail ?? null,
            ipAddress: input.ipAddress ?? null,
            projectId,
            entityType: 'payroll_entry',
            entityId: match.id,
            action: 'payroll_entry.updated',
            diff,
            meta: {
              workerName: input.workerName ?? null,
              payrollNumber: input.payrollNumber ?? week?.payrollNumber ?? null,
            },
          });
        }
      }
    } catch (auditErr) {
      console.error('[audit] payroll entry audit failed:', auditErr);
    }
  }

  return match ?? null;
}

export async function deletePayrollEntry(input: {
  entryId: string;
  userId: string;
  userEmail: string;
  ipAddress: string | null;
}) {
  const db = getDb();
  const [entry] = await db
    .select()
    .from(payrollEntries)
    .where(eq(payrollEntries.id, input.entryId))
    .limit(1);
  if (!entry) throw { status: 404, message: 'Payroll entry not found' };

  // Get projectId from week for audit + access check
  const [week] = await db
    .select()
    .from(payrollWeeks)
    .where(eq(payrollWeeks.id, entry.payrollWeekId))
    .limit(1);
  if (!week) throw { status: 404, message: 'Payroll week not found' };
  if (week.submittedAt) throw { status: 409, message: 'Cannot delete entries from a submitted week' };

  await db.delete(payrollEntries).where(eq(payrollEntries.id, input.entryId));

  // Best-effort audit log
  try {
    await insertAuditLog({
      userId: input.userId,
      userEmail: input.userEmail,
      ipAddress: input.ipAddress,
      projectId: week.projectId,
      entityType: 'payroll_entry',
      entityId: input.entryId,
      action: 'payroll_entry.deleted',
      snapshot: entry as unknown as Record<string, unknown>,
      meta: { payrollNumber: week.payrollNumber },
    });
  } catch (auditErr) {
    console.error('[audit] payroll entry delete audit failed:', auditErr);
  }

  return { deleted: true, projectId: week.projectId };
}

export async function getPayrollEntries(weekId: string) {
  const db = getDb();
  const rows = await db
    .select({
      entry: payrollEntries,
      workerName: workers.name,
      tradeDescription: workerClassifications.tradeDescription,
      laborType: workerClassifications.laborType,
      programName: workerClassifications.programName,
    })
    .from(payrollEntries)
    .innerJoin(workers, eq(payrollEntries.workerId, workers.id))
    .innerJoin(
      workerClassifications,
      eq(payrollEntries.classificationId, workerClassifications.id),
    )
    .where(eq(payrollEntries.payrollWeekId, weekId));

  return rows;
}

export async function getPayrollEntriesWithWorkerDetails(weekId: string) {
  const db = getDb();
  const overrideClassifications = alias(workerClassifications, 'override_classifications');
  const rows = await db
    .select({
      entry: payrollEntries,
      workerName: workers.name,
      workerSsnLast4: workers.ssnLast4,
      workerSsnEncrypted: workers.ssnEncrypted,
      // Phase 39: concatenate structured address fields (WORKER-01)
      workerAddress: sql<string>`COALESCE(${workers.addressStreet}, '') || CASE WHEN ${workers.addressCity} IS NOT NULL THEN ', ' || ${workers.addressCity} ELSE '' END || CASE WHEN ${workers.addressState} IS NOT NULL THEN ', ' || ${workers.addressState} ELSE '' END || CASE WHEN ${workers.addressZip} IS NOT NULL THEN ' ' || ${workers.addressZip} ELSE '' END`.as('worker_address'),
      // Phase 39: COALESCE with override classification (WORKER-04)
      tradeDescription: sql<string>`COALESCE(${overrideClassifications.tradeDescription}, ${workerClassifications.tradeDescription})`.as('trade_description'),
      tradeCode: sql<string>`COALESCE(${overrideClassifications.tradeCode}, ${workerClassifications.tradeCode})`.as('trade_code'),
      waTradeCode: sql<string | null>`COALESCE(${overrideClassifications.waTradeCode}, ${workerClassifications.waTradeCode})`.as('wa_trade_code'),
      laborType: sql<string>`COALESCE(${overrideClassifications.laborType}, ${workerClassifications.laborType})`.as('labor_type'),
      programName: sql<string | null>`COALESCE(${overrideClassifications.programName}, ${workerClassifications.programName})`.as('program_name'),
      // Override classification ID — useful for Plan 02 UI to know which override is active
      overrideClassificationId: payrollWeekClassifications.classificationId,
      // Override row ID — needed for DELETE /payroll-week-classifications/:id in Plan 02 UI
      overrideId: payrollWeekClassifications.id,
      // Phase 41 — NYS registered apprentice flag (needed for MPWR XML generator)
      nysRegisteredApprentice: workers.nysRegisteredApprentice,
    })
    .from(payrollEntries)
    .innerJoin(workers, eq(payrollEntries.workerId, workers.id))
    .innerJoin(
      workerClassifications,
      eq(payrollEntries.classificationId, workerClassifications.id),
    )
    // LEFT JOIN: most entries will NOT have an override — INNER JOIN would exclude them
    .leftJoin(
      payrollWeekClassifications,
      and(
        eq(payrollWeekClassifications.payrollWeekId, payrollEntries.payrollWeekId),
        eq(payrollWeekClassifications.workerId, payrollEntries.workerId),
      ),
    )
    .leftJoin(
      overrideClassifications,
      eq(payrollWeekClassifications.classificationId, overrideClassifications.id),
    )
    .where(eq(payrollEntries.payrollWeekId, weekId));
  return rows;
}

// ── Submission Lifecycle ───────────────────────────────────────────────────

/**
 * Checks whether a payroll week is submitted.
 * Returns { locked: true } if submitted_at is non-null.
 * Exported for testability without route mocking.
 */
export async function assertWeekNotSubmitted(
  weekId: string,
): Promise<{ locked: boolean; submittedAt: string | null }> {
  const db = getDb();
  const [week] = await db
    .select({ submittedAt: payrollWeeks.submittedAt })
    .from(payrollWeeks)
    .where(eq(payrollWeeks.id, weekId))
    .limit(1);
  return { locked: !!week?.submittedAt, submittedAt: week?.submittedAt ?? null };
}

/**
 * Records submission date and agency on a payroll week.
 * submittedAt must be YYYY-MM-DD (validated by route schema).
 */
export async function updateWeekSubmission(
  weekId: string,
  submittedAt: string,
  submittedTo: string,
): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await db
    .update(payrollWeeks)
    .set({ submittedAt, submittedTo, updatedAt: now })
    .where(eq(payrollWeeks.id, weekId));
}

/**
 * Clears submission status. Idempotent — safe to call even if week was never submitted.
 */
export async function clearWeekSubmission(weekId: string): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await db
    .update(payrollWeeks)
    .set({ submittedAt: null, submittedTo: null, updatedAt: now })
    .where(eq(payrollWeeks.id, weekId));
}

// ── Agency Submission Tracking (Phase 34 — AS-01, AS-02) ──────────────────

/**
 * Records the current ISO timestamp as the CA eCPR submission time.
 * Independent of WH-347 edit lock (per D-05).
 */
export async function setCaEcprSubmitted(weekId: string): Promise<{ caEcprSubmittedAt: string }> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.update(payrollWeeks)
    .set({ caEcprSubmittedAt: now, updatedAt: now })
    .where(eq(payrollWeeks.id, weekId));
  return { caEcprSubmittedAt: now };
}

/**
 * Clears the CA eCPR submission timestamp. Idempotent.
 */
export async function clearCaEcprSubmitted(weekId: string): Promise<{ caEcprSubmittedAt: null }> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.update(payrollWeeks)
    .set({ caEcprSubmittedAt: null, updatedAt: now })
    .where(eq(payrollWeeks.id, weekId));
  return { caEcprSubmittedAt: null };
}

/**
 * Records the current ISO timestamp as the WA L&I submission time.
 * Independent of WH-347 edit lock (per D-05).
 */
export async function setWaLniSubmitted(weekId: string): Promise<{ waLniSubmittedAt: string }> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.update(payrollWeeks)
    .set({ waLniSubmittedAt: now, updatedAt: now })
    .where(eq(payrollWeeks.id, weekId));
  return { waLniSubmittedAt: now };
}

/**
 * Clears the WA L&I submission timestamp. Idempotent.
 */
export async function clearWaLniSubmitted(weekId: string): Promise<{ waLniSubmittedAt: null }> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.update(payrollWeeks)
    .set({ waLniSubmittedAt: null, updatedAt: now })
    .where(eq(payrollWeeks.id, weekId));
  return { waLniSubmittedAt: null };
}

// ── Copy Payroll Week ──────────────────────────────────────────────────────

/**
 * Copies a payroll week with fresh live rate re-fetch.
 * In preview mode (preview=true): returns copied/skipped arrays without DB writes.
 * In commit mode (preview=false): creates a new payroll week and inserts entries.
 *
 * COMPLIANCE: Never clones baseRateSnapshot/fringeRateSnapshot from source entries.
 *             Always uses fresh rates from WD cache.
 *             New week has null submittedAt/submittedTo/amendmentNumber/originalWeekId.
 */
export async function copyPayrollWeek(input: CopyWeekInput): Promise<CopyWeekResult> {
  const db = getDb();

  // 1. Fetch project to get state + county for WD lookup
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, input.projectId))
    .limit(1);

  if (!project) {
    throw new Error(`Project not found: ${input.projectId}`);
  }

  // 2. Build rate map using cache-first lookup (matching workers.ts pattern)
  const wd =
    getCachedWd(project.state, project.county) ??
    (await lookupWageDetermination(project.state, project.county));

  const rateMap = new Map<string, { baseRate: number; fringeRate: number }>();
  if (wd) {
    for (const wc of getCachedClassifications(wd.id)) {
      rateMap.set(wc.tradeCode, { baseRate: wc.baseRate, fringeRate: wc.fringeRate });
    }
  }

  // 3. Fetch source entries joined with workers + workerClassifications
  const sourceRows = await db
    .select({
      entry: payrollEntries,
      workerName: workers.name,
      workerIsActive: workers.isActive,
      tradeCode: workerClassifications.tradeCode,
      tradeDescription: workerClassifications.tradeDescription,
    })
    .from(payrollEntries)
    .innerJoin(workers, eq(payrollEntries.workerId, workers.id))
    .innerJoin(workerClassifications, eq(payrollEntries.classificationId, workerClassifications.id))
    .where(eq(payrollEntries.payrollWeekId, input.sourceWeekId));

  // 4. Classify each source entry into copied or skipped
  const copied: CopiedEntry[] = [];
  const skipped: SkippedEntry[] = [];

  for (const row of sourceRows) {
    const baseSkipped = {
      workerId: row.entry.workerId,
      workerName: row.workerName,
      classificationId: row.entry.classificationId,
      tradeDescription: row.tradeDescription,
    };

    if (!wd) {
      skipped.push({ ...baseSkipped, reason: 'no-wd-found' });
      continue;
    }

    if (!row.workerIsActive) {
      skipped.push({ ...baseSkipped, reason: 'worker-inactive' });
      continue;
    }

    const rates = rateMap.get(row.tradeCode);
    if (!rates) {
      skipped.push({ ...baseSkipped, reason: 'rate-lookup-failed' });
      continue;
    }

    copied.push({
      workerId: row.entry.workerId,
      workerName: row.workerName,
      classificationId: row.entry.classificationId,
      tradeDescription: row.tradeDescription,
      baseRate: rates.baseRate,
      fringeRate: rates.fringeRate,
    });
  }

  // 5. Preview mode — return without DB writes
  if (input.preview) {
    return { weekId: null, copied, skipped };
  }

  // 6. Commit mode — create new week and insert entries with fresh rates
  const newWeek = await createPayrollWeek({
    projectId: input.projectId,
    weekEndingDate: input.weekEndingDate,
    payrollNumber: input.payrollNumber,
  });

  for (const row of sourceRows) {
    // Only insert entries for workers that were successfully copied
    const isCopied = copied.some(
      (c) => c.workerId === row.entry.workerId && c.classificationId === row.entry.classificationId,
    );
    if (!isCopied) continue;

    const rates = rateMap.get(row.tradeCode)!;

    await upsertPayrollEntry({
      payrollWeekId: newWeek.id,
      workerId: row.entry.workerId,
      classificationId: row.entry.classificationId,
      monSt: row.entry.monSt ?? 0,
      tueSt: row.entry.tueSt ?? 0,
      wedSt: row.entry.wedSt ?? 0,
      thuSt: row.entry.thuSt ?? 0,
      friSt: row.entry.friSt ?? 0,
      satSt: row.entry.satSt ?? 0,
      sunSt: row.entry.sunSt ?? 0,
      monOt: row.entry.monOt ?? 0,
      tueOt: row.entry.tueOt ?? 0,
      wedOt: row.entry.wedOt ?? 0,
      thuOt: row.entry.thuOt ?? 0,
      friOt: row.entry.friOt ?? 0,
      satOt: row.entry.satOt ?? 0,
      sunOt: row.entry.sunOt ?? 0,
      baseRateSnapshot: rates.baseRate,
      fringeRateSnapshot: rates.fringeRate,
      grossWages: null,
      deductions: 0,
      netPay: null,
    });
  }

  return { weekId: newWeek.id, copied, skipped };
}

// ── Amendment Workflow ─────────────────────────────────────────────────────

export interface AmendWeekInput {
  originalWeekId: string;
  projectId: string;
}

export interface AmendWeekResult {
  weekId: string;
  amendmentNumber: number;
  copiedCount: number;
}

/**
 * Creates an amendment of a submitted payroll week.
 *
 * COMPLIANCE: Clones baseRateSnapshot/fringeRateSnapshot from source entries.
 *             Never re-fetches live rates — snapshots must reflect the rate
 *             in force at the time of original submission (29 CFR Part 3).
 *             Creates a new payrollWeeks row; never updates in place.
 */
export async function amendPayrollWeek(input: AmendWeekInput): Promise<AmendWeekResult> {
  const db = getDb();

  // 1. Fetch and verify original week exists and is submitted
  const originalWeek = await getPayrollWeek(input.originalWeekId);
  if (!originalWeek) {
    throw new Error(`Payroll week not found: ${input.originalWeekId}`);
  }
  if (!originalWeek.submittedAt) {
    throw new Error('Only submitted weeks can be amended');
  }

  // 2. Resolve root week: if the original is itself an amendment, use its root
  const rootWeekId = originalWeek.originalWeekId ?? originalWeek.id;

  // 3. Determine next amendment number: MAX(amendmentNumber) across all amendments of this root
  const [maxResult] = await db
    .select({ maxAmendment: max(payrollWeeks.amendmentNumber) })
    .from(payrollWeeks)
    .where(eq(payrollWeeks.originalWeekId, rootWeekId));

  const currentMax = maxResult?.maxAmendment ?? 0;
  const amendmentNumber = (currentMax ?? 0) + 1;

  // 4. Insert new amendment week row
  const now = new Date().toISOString();
  const newWeekId = randomUUID();

  await db.insert(payrollWeeks).values({
    id: newWeekId,
    projectId: input.projectId,
    weekEndingDate: originalWeek.weekEndingDate,
    payrollNumber: originalWeek.payrollNumber,
    isFinal: originalWeek.isFinal,
    originalWeekId: rootWeekId,
    amendmentNumber,
    submittedAt: null,
    submittedTo: null,
    createdAt: now,
    updatedAt: now,
  });

  // 5. Copy entries from the original week — clone ALL fields including snapshots
  //    Do NOT call getCachedWd or lookupWageDetermination (federal compliance requirement)
  const sourceEntries = await db
    .select()
    .from(payrollEntries)
    .where(eq(payrollEntries.payrollWeekId, input.originalWeekId));

  for (const entry of sourceEntries) {
    const entryId = randomUUID();
    await db.insert(payrollEntries).values({
      id: entryId,
      payrollWeekId: newWeekId,
      workerId: entry.workerId,
      classificationId: entry.classificationId,
      monSt: entry.monSt ?? 0,
      tueSt: entry.tueSt ?? 0,
      wedSt: entry.wedSt ?? 0,
      thuSt: entry.thuSt ?? 0,
      friSt: entry.friSt ?? 0,
      satSt: entry.satSt ?? 0,
      sunSt: entry.sunSt ?? 0,
      monOt: entry.monOt ?? 0,
      tueOt: entry.tueOt ?? 0,
      wedOt: entry.wedOt ?? 0,
      thuOt: entry.thuOt ?? 0,
      friOt: entry.friOt ?? 0,
      satOt: entry.satOt ?? 0,
      sunOt: entry.sunOt ?? 0,
      baseRateSnapshot: entry.baseRateSnapshot,
      fringeRateSnapshot: entry.fringeRateSnapshot,
      grossWages: null,
      deductions: 0,
      netPay: null,
      createdByUserId: null, // amendment copies are system-generated clones, not direct user edits
      updatedByUserId: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  return { weekId: newWeekId, amendmentNumber, copiedCount: sourceEntries.length };
}
