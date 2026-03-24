// src/server/services/complianceService.ts
// Detects under-wage (COMP-01) and CWHSSA OT mismatches (COMP-02) by comparing
// stored grossWages against the value produced by calculateCwhssaOt() using
// frozen snapshots. No live WD lookups — only snapshot columns.

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import { calculateCwhssaOt } from './calculations.js';
import { getPayrollWeek, getPayrollEntries, listPayrollWeeks } from './payrollService.js';

// ── Types ─────────────────────────────────────────────────────────────────

export interface ComplianceViolation {
  entryId: string;
  workerId: string;
  workerName: string;
  violationType: 'under-wage' | 'cwhssa-ot';
  expected: number;   // totalWeeklyCost from calculateCwhssaOt
  actual: number;     // grossWages from entry
  delta: number;      // actual - expected (negative = underpayment)
}

export interface WeekViolation {
  violationType: 'apprentice-ratio';
  detail: string;
  apprenticeHours: number;
  journeyworkerHours: number;
  maxAllowedApprenticeHours: number;
}

export interface ComplianceResult {
  weekId: string;
  projectId: string;
  violations: ComplianceViolation[];
  weekViolations: WeekViolation[];
  hasViolations: boolean;
  certProperPayment: boolean;    // false when any 'under-wage' violation exists
  certAccuratePayroll: boolean;  // false when any 'cwhssa-ot' violation exists
}

// ── Service ───────────────────────────────────────────────────────────────

export async function computeCompliance(
  _db: BetterSQLite3Database<typeof schema>,
  weekId: string,
): Promise<ComplianceResult | null> {
  // 1. Load week
  const week = await getPayrollWeek(weekId);
  if (!week) return null;

  // 2. Load entries (with worker names and classification info)
  const rows = await getPayrollEntries(weekId);

  // 3. Process each entry
  const violations: ComplianceViolation[] = [];

  for (const row of rows) {
    const e = row.entry;

    // Sum straight-time and OT hours from stored daily columns
    const totalSt =
      (e.monSt ?? 0) + (e.tueSt ?? 0) + (e.wedSt ?? 0) +
      (e.thuSt ?? 0) + (e.friSt ?? 0) + (e.satSt ?? 0) + (e.sunSt ?? 0);
    const totalOt =
      (e.monOt ?? 0) + (e.tueOt ?? 0) + (e.wedOt ?? 0) +
      (e.thuOt ?? 0) + (e.friOt ?? 0) + (e.satOt ?? 0) + (e.sunOt ?? 0);

    const totalHours = totalSt + totalOt;

    // Skip entries where gross wages are not yet recorded
    if (e.grossWages == null) continue;

    // Delegate all OT math to calculateCwhssaOt — do NOT reimplement
    const calcResult = calculateCwhssaOt({
      baseRate: e.baseRateSnapshot,
      fringeRate: e.fringeRateSnapshot,
      totalHoursWorked: totalHours,
      overtimeHours: totalOt,
    });

    const expectedGross = calcResult.totalWeeklyCost;
    const actualGross = e.grossWages;
    const delta = actualGross - expectedGross;

    // Violation logic: emit AT MOST one violation per entry
    // When OT hours are present, any wage discrepancy is a CWHSSA OT violation (COMP-02).
    // Without OT, underpayment is flagged as under-wage (COMP-01).
    let violationType: 'under-wage' | 'cwhssa-ot' | null = null;

    if (Math.abs(delta) > 0.01 && totalOt > 0) {
      // OT formula mismatch — COMP-02 (checked first when OT is present)
      violationType = 'cwhssa-ot';
    } else if (delta < -0.01) {
      // Underpayment, no OT — COMP-01
      violationType = 'under-wage';
    }

    if (violationType !== null) {
      violations.push({
        entryId: e.id,
        workerId: e.workerId,
        workerName: row.workerName,
        violationType,
        expected: expectedGross,
        actual: actualGross,
        delta,
      });
    }
  }

  // 4. Apprentice ratio check (COMP-03) — aggregate over the full week
  const weekViolations: WeekViolation[] = [];

  let apprenticeHours = 0;
  let journeyworkerHours = 0;

  for (const row of rows) {
    const e = row.entry;
    const totalHours =
      (e.monSt ?? 0) + (e.tueSt ?? 0) + (e.wedSt ?? 0) +
      (e.thuSt ?? 0) + (e.friSt ?? 0) + (e.satSt ?? 0) + (e.sunSt ?? 0) +
      (e.monOt ?? 0) + (e.tueOt ?? 0) + (e.wedOt ?? 0) +
      (e.thuOt ?? 0) + (e.friOt ?? 0) + (e.satOt ?? 0) + (e.sunOt ?? 0);

    if (row.laborType === 'apprentice') {
      apprenticeHours += totalHours;
    } else if (row.laborType === 'journeyworker' || row.laborType === 'foreman') {
      journeyworkerHours += totalHours;
    }
  }

  if (journeyworkerHours > 0 && apprenticeHours > 0) {
    const maxAllowedApprenticeHours = journeyworkerHours / 3;
    if (apprenticeHours > maxAllowedApprenticeHours) {
      weekViolations.push({
        violationType: 'apprentice-ratio',
        detail: `Apprentice hours (${apprenticeHours}) exceed 1:3 ratio — max allowed ${maxAllowedApprenticeHours.toFixed(1)} for ${journeyworkerHours} journeyworker hours`,
        apprenticeHours,
        journeyworkerHours,
        maxAllowedApprenticeHours,
      });
    }
  }

  return {
    weekId,
    projectId: week.projectId,
    violations,
    weekViolations,
    hasViolations: violations.length > 0 || weekViolations.length > 0,
    certProperPayment: !violations.some(v => v.violationType === 'under-wage'),
    certAccuratePayroll: !violations.some(v => v.violationType === 'cwhssa-ot'),
  };
}

// ── Per-Worker Compliance History (AUD-01) ────────────────────────────────

export interface WorkerViolationHistoryEntry {
  projectId: string;
  projectName: string;
  weekId: string;
  weekEndingDate: string;
  payrollNumber: number;
  violationType: 'under-wage' | 'cwhssa-ot' | 'apprentice-ratio';
  detail?: string;
  expected?: number;
  actual?: number;
  delta?: number;
  apprenticeHours?: number;
  journeyworkerHours?: number;
  maxAllowedApprenticeHours?: number;
}

export interface WorkerComplianceHistory {
  workerId: string;
  workerName: string;
  ssnLast4: string | null;
  totalViolations: number;
  entries: WorkerViolationHistoryEntry[];
}

type WorkerHistoryResult =
  | WorkerComplianceHistory
  | { error: 'not_found' }
  | { error: 'forbidden' };

export async function getWorkerComplianceHistory(
  db: BetterSQLite3Database<typeof schema>,
  userId: string,
  workerId: string,
): Promise<WorkerHistoryResult> {
  // 1. Load source worker
  const [sourceWorker] = await db
    .select()
    .from(schema.workers)
    .where(eq(schema.workers.id, workerId))
    .limit(1);

  if (!sourceWorker) {
    return { error: 'not_found' };
  }

  // 2. Load source worker's project and verify ownership
  const [sourceProject] = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, sourceWorker.projectId))
    .limit(1);

  if (!sourceProject) {
    return { error: 'not_found' };
  }

  if (sourceProject.userId !== userId) {
    return { error: 'forbidden' };
  }

  // 3. ssnLast4 safety: if null, only search within the source project
  let projectsInScope: typeof sourceProject[];
  if (sourceWorker.ssnLast4 === null) {
    // No cross-project merge for workers without SSN — too risky of false matches
    projectsInScope = [sourceProject];
  } else {
    // Search across all user's projects
    projectsInScope = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.userId, userId));
  }

  // 4. For each project, find workers matching (name, ssnLast4) exactly
  const allEntries: WorkerViolationHistoryEntry[] = [];

  for (const project of projectsInScope) {
    // Find matching worker in this project
    let matchingWorker: typeof sourceWorker | null = null;

    if (project.id === sourceProject.id) {
      // Always use the source worker for the source project
      matchingWorker = sourceWorker;
    } else {
      // ssnLast4 is non-null here (guaranteed by scope guard above)
      const [found] = await db
        .select()
        .from(schema.workers)
        .where(
          and(
            eq(schema.workers.projectId, project.id),
            eq(schema.workers.name, sourceWorker.name),
            eq(schema.workers.ssnLast4, sourceWorker.ssnLast4!),
          ),
        )
        .limit(1);

      matchingWorker = found ?? null;
    }

    if (!matchingWorker) continue;

    // 5. Load all payroll weeks for this project
    const weeks = await listPayrollWeeks(project.id);

    for (const week of weeks) {
      // 6. Run compliance for this week
      const result = await computeCompliance(db, week.id);
      if (!result) continue;

      // 7. Per-worker violations (under-wage, cwhssa-ot)
      for (const v of result.violations) {
        if (v.workerId !== matchingWorker.id) continue;

        allEntries.push({
          projectId: project.id,
          projectName: project.name,
          weekId: week.id,
          weekEndingDate: week.weekEndingDate,
          payrollNumber: week.payrollNumber,
          violationType: v.violationType,
          expected: v.expected,
          actual: v.actual,
          delta: v.delta,
        });
      }

      // 8. Week-level violations (apprentice-ratio) — include if worker had any entry in this week
      if (result.weekViolations.length > 0) {
        const [workerEntry] = await db
          .select()
          .from(schema.payrollEntries)
          .where(
            and(
              eq(schema.payrollEntries.payrollWeekId, week.id),
              eq(schema.payrollEntries.workerId, matchingWorker.id),
            ),
          )
          .limit(1);

        if (workerEntry) {
          for (const wv of result.weekViolations) {
            allEntries.push({
              projectId: project.id,
              projectName: project.name,
              weekId: week.id,
              weekEndingDate: week.weekEndingDate,
              payrollNumber: week.payrollNumber,
              violationType: wv.violationType,
              detail: wv.detail,
              apprenticeHours: wv.apprenticeHours,
              journeyworkerHours: wv.journeyworkerHours,
              maxAllowedApprenticeHours: wv.maxAllowedApprenticeHours,
            });
          }
        }
      }
    }
  }

  // 9. Sort by weekEndingDate DESC
  allEntries.sort((a, b) => b.weekEndingDate.localeCompare(a.weekEndingDate));

  return {
    workerId: sourceWorker.id,
    workerName: sourceWorker.name,
    ssnLast4: sourceWorker.ssnLast4,
    totalViolations: allEntries.length,
    entries: allEntries,
  };
}
