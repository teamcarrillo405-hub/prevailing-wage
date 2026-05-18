// src/server/services/complianceService.ts
// Detects under-wage (COMP-01) and CWHSSA OT mismatches (COMP-02) by comparing
// stored grossWages against certified payroll pay math using
// frozen snapshots. No live WD lookups — only snapshot columns.

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import { getDb } from '../db/index.js';
import { getPayrollWeek, getPayrollEntries, listPayrollWeeks } from './payrollService.js';
import {
  countComplianceViolations,
  detectDailyTradeApprenticeRatioViolations,
  detectDeductionViolations,
  expectedGrossForEntry,
  getComplianceViolationBreakdown,
  getEntryHourTotals,
  type ComplianceViolationBreakdown,
} from './complianceRules.js';

// ── Types ─────────────────────────────────────────────────────────────────

export interface ComplianceViolation {
  entryId: string;
  workerId: string;
  workerName: string;
  violationType:
    | 'under-wage'
    | 'cwhssa-ot'
    | 'weekly-ot'
    | 'multi-classification-ot'
    | 'ca-daily-ot'    // CA: hours 8-12 per day must be at OT rate (Labor Code §510)
     | 'ca-daily-dt';   // CA: hours >12 per day must be at DT rate
  expected: number;
  actual: number;
  delta: number;
}

export interface WeekViolation {
  violationType:
    | 'apprentice-ratio'
    | 'apprentice-ratio-daily'
    | 'apprentice-trade-ratio'
    | 'apprentice-registration'
    | 'ira-iija-apprentice-pct';
  detail: string;
  apprenticeHours: number;
  journeyworkerHours: number;
  maxAllowedApprenticeHours: number;
  // COMP-04 extra fields (per-trade ratio)
  trade?: string;
  excessHours?: number;
  estimatedLiabilityUsd?: number;
  // COMP-05 extra fields (IRA/IIJA 15% requirement)
  totalHours?: number;
  actualPct?: number;
}

export interface DeductionViolation {
  violationType: 'deduction-ratio';
  entryId: string;
  workerId: string;
  workerName: string;
  deductions: number;
  grossWages: number;
  deductionPct: number;   // actual non-tax deduction percentage (e.g. 35.2)
}

export interface ComplianceResult {
  weekId: string;
  projectId: string;
  violations: ComplianceViolation[];
  weekViolations: WeekViolation[];
  deductionViolations: DeductionViolation[];  // 29 CFR Part 3 §3.5 — 30% cap
  violationBreakdown: ComplianceViolationBreakdown;
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

  // 2. Fetch project to determine state (needed for per-state OT rules)
  const db = getDb();
  const [project] = await db.select().from(schema.projects)
    .where(eq(schema.projects.id, week.projectId)).limit(1);
  const stateCode = project?.state?.toUpperCase();
  const isNY = stateCode === 'NY';
  const isCA = stateCode === 'CA';

  // 3. Load entries (with worker names and classification info)
  const rows = await getPayrollEntries(weekId);

  // 4. Process each entry
  const violations: ComplianceViolation[] = [];

  for (const row of rows) {
    const e = row.entry;

    const totals = getEntryHourTotals(e);
    const premiumHours = totals.overtime + totals.doubleTime;

    // NY daily OT check (COMP-04): NY projects flag cwhssa-ot for any day exceeding 8h
    // Each day is checked independently: (daySt + dayOt) > 8
    if (isNY) {
      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const days = [
        { st: e.monSt, ot: e.monOt },
        { st: e.tueSt, ot: e.tueOt },
        { st: e.wedSt, ot: e.wedOt },
        { st: e.thuSt, ot: e.thuOt },
        { st: e.friSt, ot: e.friOt },
        { st: e.satSt, ot: e.satOt },
        { st: e.sunSt, ot: e.sunOt },
      ];
      for (let i = 0; i < days.length; i++) {
        const dayTotal = (days[i].st ?? 0) + (days[i].ot ?? 0);
        if (dayTotal > 8) {
          violations.push({
            entryId: e.id,
            workerId: e.workerId,
            workerName: row.workerName,
            violationType: 'cwhssa-ot',
            expected: 8,
            actual: dayTotal,
            delta: dayTotal - 8,
          });
        }
      }
    }

    // CA state rules (Labor Code §510): daily OT + DT thresholds
    //   ST limit:  first 8 hrs/day
    //   OT window: hours 8-12/day (at 1.5×)
    //   DT window: hours >12/day (at 2×)
    // Flag a violation if ST hours exceed 8 per day (should have moved excess
    // to OT bucket) or if OT hours extend past 12 total (should have moved
    // excess >12 to DT bucket).
    if (isCA) {
      const caDays = [
        { name: 'Mon', st: e.monSt, ot: e.monOt, dt: e.monDt },
        { name: 'Tue', st: e.tueSt, ot: e.tueOt, dt: e.tueDt },
        { name: 'Wed', st: e.wedSt, ot: e.wedOt, dt: e.wedDt },
        { name: 'Thu', st: e.thuSt, ot: e.thuOt, dt: e.thuDt },
        { name: 'Fri', st: e.friSt, ot: e.friOt, dt: e.friDt },
        { name: 'Sat', st: e.satSt, ot: e.satOt, dt: e.satDt },
        { name: 'Sun', st: e.sunSt, ot: e.sunOt, dt: e.sunDt },
      ];
      for (const d of caDays) {
        const st = d.st ?? 0;
        const ot = d.ot ?? 0;
        const dt = d.dt ?? 0;
        if (st > 8) {
          violations.push({
            entryId: e.id,
            workerId: e.workerId,
            workerName: row.workerName,
            violationType: 'ca-daily-ot',
            expected: 8,
            actual: st,
            delta: st - 8,
          });
        }
        // OT+ST total > 12 means DT should have been used for excess hours
        if (st + ot > 12 && dt === 0) {
          violations.push({
            entryId: e.id,
            workerId: e.workerId,
            workerName: row.workerName,
            violationType: 'ca-daily-dt',
            expected: 12,
            actual: st + ot,
            delta: (st + ot) - 12,
          });
        }
      }
    }

    // Skip entries where gross wages are not yet recorded
    if (e.grossWages == null) continue;

    const expectedGross = expectedGrossForEntry(e);
    const actualGross = e.grossWages;
    const delta = actualGross - expectedGross;

    // Violation logic: emit AT MOST one violation per entry
    // When OT hours are present, any wage discrepancy is a CWHSSA OT violation (COMP-02).
    // Without OT, underpayment is flagged as under-wage (COMP-01).
    let violationType: 'under-wage' | 'cwhssa-ot' | null = null;

    if (Math.abs(delta) > 0.01 && premiumHours > 0) {
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

  // Federal CWHSSA weekly OT floor. Per-entry math is correct when hours are
  // already split into ST/OT/DT buckets; this catches the common import/manual
  // error where >40 weekly hours are left in straight-time buckets.
  type PayrollComplianceRow = (typeof rows)[number];
  const rowsByWorker = new Map<string, PayrollComplianceRow[]>();
  for (const row of rows) {
    const group: PayrollComplianceRow[] = rowsByWorker.get(row.entry.workerId) ?? [];
    group.push(row);
    rowsByWorker.set(row.entry.workerId, group);
  }

  for (const workerRows of rowsByWorker.values()) {
    const totalHours = workerRows.reduce((sum: number, row: PayrollComplianceRow) => sum + getEntryHourTotals(row.entry).total, 0);
    const premiumHours = workerRows.reduce((sum: number, row: PayrollComplianceRow) => {
      const totals = getEntryHourTotals(row.entry);
      return sum + totals.overtime + totals.doubleTime;
    }, 0);
    const requiredOtHours = Math.max(0, totalHours - 40);
    if (requiredOtHours <= premiumHours + 0.001) continue;

    const firstRow = workerRows[0];
    const distinctClassifications = new Set(workerRows.map((row: PayrollComplianceRow) => row.entry.classificationId));
    const weightedBaseNumerator = workerRows.reduce((sum: number, row: PayrollComplianceRow) => {
      const totals = getEntryHourTotals(row.entry);
      return sum + totals.total * row.entry.baseRateSnapshot;
    }, 0);
    const weightedBase = totalHours > 0 ? weightedBaseNumerator / totalHours : firstRow.entry.baseRateSnapshot;
    const missingPremiumHours = requiredOtHours - premiumHours;
    const missingPremiumValue = Math.round(missingPremiumHours * 0.5 * weightedBase * 100) / 100;
    const actualGross = workerRows.reduce((sum: number, row: PayrollComplianceRow) => sum + (row.entry.grossWages ?? 0), 0);

    violations.push({
      entryId: firstRow.entry.id,
      workerId: firstRow.entry.workerId,
      workerName: firstRow.workerName,
      violationType: distinctClassifications.size > 1 ? 'multi-classification-ot' : 'weekly-ot',
      expected: Math.round((actualGross + missingPremiumValue) * 100) / 100,
      actual: Math.round(actualGross * 100) / 100,
      delta: -missingPremiumValue,
    });
  }

  // Non-tax deduction risk check. This is a pre-submission warning, not a
  // blanket legal rule; deduction legality depends on type, authorization, and
  // project/jurisdiction records.
  const deductionViolations = detectDeductionViolations(rows);

  // 4. Apprentice ratio check (COMP-03) — per (trade, date) daily check
  const weekViolations: WeekViolation[] = [];

  // Registration check and daily group accumulation
  // Group entries by (trade, workDate) to check ratio per day per trade.
  // workDate is derived from the entry's week: Mon=weekEndingDate-6, Tue=weekEndingDate-5, etc.
  // For simplicity, we use a synthetic key that captures per-day presence.
  // Since entries don't store workDate directly, we iterate per day-of-week column.
  const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

  // Map key: `${trade}::${dayKey}` → { journeyworker: count, apprentice: count }
  const dayTradeGroups = new Map<string, { journeyworker: number; apprentice: number; apprenticeRate: number }>();

  for (const row of rows) {
    const e = row.entry;
    const trade = row.tradeDescription ?? 'unknown';

    for (const day of DAY_KEYS) {
      const stField = `${day}St` as keyof typeof e;
      const otField = `${day}Ot` as keyof typeof e;
      const dtField = `${day}Dt` as keyof typeof e;
      const dayHours = ((e[stField] as number) ?? 0) + ((e[otField] as number) ?? 0) + ((e[dtField] as number) ?? 0);
      if (dayHours === 0) continue;

      const key = `${trade}::${day}`;
      const grp = dayTradeGroups.get(key) ?? { journeyworker: 0, apprentice: 0, apprenticeRate: e.baseRateSnapshot };
      if (row.laborType === 'journeyworker' || row.laborType === 'foreman') {
        grp.journeyworker++;
      } else if (row.laborType === 'apprentice') {
        grp.apprentice++;
        grp.apprenticeRate = e.baseRateSnapshot;
      }
      dayTradeGroups.set(key, grp);
    }

    // Apprentice registration check
    if (row.laborType === 'apprentice') {
      if (!row.programName?.trim()) {
        const totalHours = getEntryHourTotals(e).total;
        weekViolations.push({
          violationType: 'apprentice-registration',
          detail: `${row.workerName} is entered as an apprentice without a registered apprenticeship program name on the payroll classification.`,
          apprenticeHours: totalHours,
          journeyworkerHours: 0,
          maxAllowedApprenticeHours: 0,
        });
      }
    }
  }

  // COMP-03: daily per-(trade, day) apprentice ratio — 1:3 allowed
  const allowedRatio = 1 / 3; // 1 apprentice per 3 journeyworkers
  for (const [key, grp] of dayTradeGroups) {
    if (grp.journeyworker === 0) continue;
    const ratio = grp.apprentice / grp.journeyworker;
    if (ratio > allowedRatio) {
      const [trade, day] = key.split('::');
      weekViolations.push({
        violationType: 'apprentice-ratio-daily',
        detail: `Apprentice ratio exceeded on ${day} for ${trade}: ${grp.apprentice} apprentice(s) to ${grp.journeyworker} journeyworker(s)`,
        apprenticeHours: grp.apprentice,
        journeyworkerHours: grp.journeyworker,
        maxAllowedApprenticeHours: grp.journeyworker * allowedRatio,
        trade,
      } as WeekViolation);
    }
  }

  // COMP-04: Per-trade daily apprenticeship ratio violation
  // Runs when project.apprenticeshipRequirements is configured (JSON map of trade → maxRatio).
  // Checks each configured trade against its configured ratio for each day.
  if (project?.apprenticeshipRequirements) {
    let ratioConfig: Record<string, { maxRatio: string }> = {};
    try {
      ratioConfig = JSON.parse(project.apprenticeshipRequirements);
    } catch {
      ratioConfig = {};
    }

    if (Object.keys(ratioConfig).length > 0) {
      weekViolations.push(...detectDailyTradeApprenticeRatioViolations(rows, ratioConfig));
    }

  }

  // COMP-05: IRA/IIJA 15% apprenticeship requirement
  // If project is an IRA/IIJA clean energy project, total apprentice hours must be
  // at least 15% of all hours to qualify for enhanced tax credits.
  if (project?.isIraIijaProject) {
    let totalAllHours = 0;
    let totalAppHours = 0;

    for (const row of rows) {
      const e = row.entry;
      const totalHoursRow = getEntryHourTotals(e).total;

      totalAllHours += totalHoursRow;
      if (row.laborType === 'apprentice') {
        totalAppHours += totalHoursRow;
      }
    }

    if (totalAllHours > 0) {
      const actualPct = totalAppHours / totalAllHours;
      if (actualPct < 0.15) {
        weekViolations.push({
          violationType: 'ira-iija-apprentice-pct',
          detail: `IRA/IIJA: Apprentice hours are ${(actualPct * 100).toFixed(1)}% of total — below 15% requirement for tax credit eligibility.`,
          apprenticeHours: totalAppHours,
          journeyworkerHours: totalAllHours - totalAppHours,
          maxAllowedApprenticeHours: 0,
          totalHours: totalAllHours,
          actualPct,
        });
      }
    }
  }

  const violationBreakdown = getComplianceViolationBreakdown({
    violations,
    weekViolations,
    deductionViolations,
  });

  return {
    weekId,
    projectId: week.projectId,
    violations,
    weekViolations,
    deductionViolations,   // 29 CFR Part 3 §3.5 — 30% cap warnings
    violationBreakdown,
    hasViolations: violationBreakdown.total > 0,
    certProperPayment: !violations.some(v => v.violationType === 'under-wage'),
    certAccuratePayroll: !violations.some(v =>
      ['cwhssa-ot', 'weekly-ot', 'multi-classification-ot', 'ca-daily-ot', 'ca-daily-dt'].includes(v.violationType),
    ),
  };
}

// ── Batch Project Compliance (DASH-05) ───────────────────────────────────

export interface BatchProjectSummary {
  status: 'archived' | 'violations' | 'compliant' | 'no-payroll';
  /** Total violation count across all weeks (worker + week-level violations) */
  violationCount: number;
  /** ISO 8601 week ending dates for unsubmitted weeks (for due-this-week calc) */
  unsubmittedWeekEndingDates: string[];
}

export async function getBatchProjectCompliance(
  db: BetterSQLite3Database<typeof schema>,
  userId: string,
): Promise<Map<string, BatchProjectSummary>> {
  const membershipRows = await db
    .select({ project: schema.projects })
    .from(schema.projectMembers)
    .innerJoin(schema.projects, eq(schema.projectMembers.projectId, schema.projects.id))
    .where(eq(schema.projectMembers.userId, userId));

  const allProjects = membershipRows.map(r => r.project);

  const result = new Map<string, BatchProjectSummary>();

  for (const project of allProjects) {
    if (project.status === 'closed') {
      result.set(project.id, { status: 'archived', violationCount: 0, unsubmittedWeekEndingDates: [] });
      continue;
    }

    const weeks = await listPayrollWeeks(project.id);

    if (weeks.length === 0) {
      result.set(project.id, { status: 'no-payroll', violationCount: 0, unsubmittedWeekEndingDates: [] });
      continue;
    }

    let hasViolations = false;
    let violationCount = 0;
    const unsubmittedWeekEndingDates: string[] = [];

    for (const week of weeks) {
      // Track unsubmitted week ending dates for due-this-week computation
      if (!week.submittedAt) {
        unsubmittedWeekEndingDates.push(week.weekEndingDate);
      }

      const compliance = await computeCompliance(db, week.id);
      if (compliance?.hasViolations === true) {
        hasViolations = true;
        violationCount += countComplianceViolations(compliance);
      }
    }

    result.set(project.id, {
      status: hasViolations ? 'violations' : 'compliant',
      violationCount,
      unsubmittedWeekEndingDates,
    });
  }

  return result;
}

// ── Per-Worker Compliance History (AUD-01) ────────────────────────────────

export interface WorkerViolationHistoryEntry {
  projectId: string;
  projectName: string;
  weekId: string;
  weekEndingDate: string;
  payrollNumber: number;
  violationType:
    | 'under-wage'
    | 'cwhssa-ot'
    | 'weekly-ot'
    | 'multi-classification-ot'
    | 'ca-daily-ot'
    | 'ca-daily-dt'
    | 'apprentice-ratio'
    | 'apprentice-ratio-daily'
    | 'apprentice-trade-ratio'
    | 'apprentice-registration'
    | 'ira-iija-apprentice-pct';
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

  // 2. Load source worker's project via membership check
  const [membershipRow] = await db
    .select({ project: schema.projects })
    .from(schema.projectMembers)
    .innerJoin(schema.projects, eq(schema.projectMembers.projectId, schema.projects.id))
    .where(
      and(
        eq(schema.projectMembers.projectId, sourceWorker.projectId),
        eq(schema.projectMembers.userId, userId),
      ),
    )
    .limit(1);

  if (!membershipRow) {
    // Distinguish 404 from 403: check if project exists at all
    const [projectExists] = await db
      .select({ id: schema.projects.id })
      .from(schema.projects)
      .where(eq(schema.projects.id, sourceWorker.projectId))
      .limit(1);
    return projectExists ? { error: 'forbidden' } : { error: 'not_found' };
  }
  const sourceProject = membershipRow.project;

  // 3. ssnLast4 safety: if null, only search within the source project
  let projectsInScope: typeof sourceProject[];
  if (sourceWorker.ssnLast4 === null) {
    // No cross-project merge for workers without SSN — too risky of false matches
    projectsInScope = [sourceProject];
  } else {
    // Search across all projects the user is a member of
    const scopeRows = await db
      .select({ project: schema.projects })
      .from(schema.projectMembers)
      .innerJoin(schema.projects, eq(schema.projectMembers.projectId, schema.projects.id))
      .where(eq(schema.projectMembers.userId, userId));
    projectsInScope = scopeRows.map(r => r.project);
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
