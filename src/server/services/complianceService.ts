// src/server/services/complianceService.ts
// Detects under-wage (COMP-01) and CWHSSA OT mismatches (COMP-02) by comparing
// stored grossWages against the value produced by calculateCwhssaOt() using
// frozen snapshots. No live WD lookups — only snapshot columns.

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import { getDb } from '../db/index.js';
import { calculateCwhssaOt } from './calculations.js';
import { getPayrollWeek, getPayrollEntries, listPayrollWeeks } from './payrollService.js';

// ── Types ─────────────────────────────────────────────────────────────────

export interface ComplianceViolation {
  entryId: string;
  workerId: string;
  workerName: string;
  violationType:
    | 'under-wage'
    | 'cwhssa-ot'
    | 'ca-daily-ot'    // CA: hours 8-12 per day must be at OT rate (Labor Code §510)
    | 'ca-daily-dt';   // CA: hours >12 per day must be at DT rate
  expected: number;
  actual: number;
  delta: number;
}

export interface WeekViolation {
  violationType: 'apprentice-ratio' | 'apprentice-trade-ratio' | 'ira-iija-apprentice-pct';
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

    // Sum straight-time and OT hours from stored daily columns
    const totalSt =
      (e.monSt ?? 0) + (e.tueSt ?? 0) + (e.wedSt ?? 0) +
      (e.thuSt ?? 0) + (e.friSt ?? 0) + (e.satSt ?? 0) + (e.sunSt ?? 0);
    const totalOt =
      (e.monOt ?? 0) + (e.tueOt ?? 0) + (e.wedOt ?? 0) +
      (e.thuOt ?? 0) + (e.friOt ?? 0) + (e.satOt ?? 0) + (e.sunOt ?? 0);

    const totalHours = totalSt + totalOt;

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

  // COMP-04: Per-trade daily apprenticeship ratio violation
  // Runs when project.apprenticeshipRequirements is configured (JSON map of trade → maxRatio).
  // Aggregates JW and apprentice hours by trade description for the week, then checks
  // each configured trade against its configured ratio.
  if (project?.apprenticeshipRequirements) {
    let ratioConfig: Record<string, { maxRatio: string }> = {};
    try {
      ratioConfig = JSON.parse(project.apprenticeshipRequirements);
    } catch {
      ratioConfig = {};
    }

    if (Object.keys(ratioConfig).length > 0) {
      // Aggregate hours per trade and labor type
      const tradeJwHours = new Map<string, number>();
      const tradeAppHours = new Map<string, number>();
      // Also track average apprentice and JW rates per trade for liability estimate
      const tradeAppRateSum = new Map<string, number>();
      const tradeAppCount = new Map<string, number>();
      const tradeJwRateSum = new Map<string, number>();
      const tradeJwCount = new Map<string, number>();

      for (const row of rows) {
        const e = row.entry;
        const trade = row.tradeDescription;
        const totalHoursRow =
          (e.monSt ?? 0) + (e.tueSt ?? 0) + (e.wedSt ?? 0) +
          (e.thuSt ?? 0) + (e.friSt ?? 0) + (e.satSt ?? 0) + (e.sunSt ?? 0) +
          (e.monOt ?? 0) + (e.tueOt ?? 0) + (e.wedOt ?? 0) +
          (e.thuOt ?? 0) + (e.friOt ?? 0) + (e.satOt ?? 0) + (e.sunOt ?? 0);

        if (row.laborType === 'apprentice') {
          tradeAppHours.set(trade, (tradeAppHours.get(trade) ?? 0) + totalHoursRow);
          tradeAppRateSum.set(trade, (tradeAppRateSum.get(trade) ?? 0) + e.baseRateSnapshot);
          tradeAppCount.set(trade, (tradeAppCount.get(trade) ?? 0) + 1);
        } else if (row.laborType === 'journeyworker' || row.laborType === 'foreman') {
          tradeJwHours.set(trade, (tradeJwHours.get(trade) ?? 0) + totalHoursRow);
          tradeJwRateSum.set(trade, (tradeJwRateSum.get(trade) ?? 0) + e.baseRateSnapshot);
          tradeJwCount.set(trade, (tradeJwCount.get(trade) ?? 0) + 1);
        }
      }

      for (const [configTrade, { maxRatio }] of Object.entries(ratioConfig)) {
        // Match configured trade against trade descriptions (case-insensitive partial match)
        const matchKey = [...tradeJwHours.keys()].find(
          k => k.toLowerCase().includes(configTrade.toLowerCase()) ||
               configTrade.toLowerCase().includes(k.toLowerCase()),
        ) ?? configTrade;

        const jwHours = tradeJwHours.get(matchKey) ?? 0;
        const appHours = tradeAppHours.get(matchKey) ?? 0;

        if (jwHours === 0 || appHours === 0) continue;

        // Parse ratio string e.g. "1:2" → numerator=1, denominator=2
        const parts = maxRatio.split(':').map(Number);
        const ratioNumerator = parts[0] ?? 1;
        const ratioDenominator = parts[1] ?? 1;
        const maxAllowedApp = jwHours * (ratioNumerator / ratioDenominator);

        if (appHours > maxAllowedApp + 0.001) {
          const excessHours = appHours - maxAllowedApp;

          // Estimated liability = excess apprentice hours × (JW rate − apprentice rate)
          const avgJwRate = tradeJwCount.get(matchKey)
            ? (tradeJwRateSum.get(matchKey) ?? 0) / tradeJwCount.get(matchKey)!
            : 0;
          const avgAppRate = tradeAppCount.get(matchKey)
            ? (tradeAppRateSum.get(matchKey) ?? 0) / tradeAppCount.get(matchKey)!
            : 0;
          const rateDiff = Math.max(0, avgJwRate - avgAppRate);
          const estimatedLiabilityUsd = Math.round(excessHours * rateDiff * 100) / 100;

          weekViolations.push({
            violationType: 'apprentice-trade-ratio',
            detail: `Trade: ${configTrade} — ${appHours.toFixed(1)} apprentice hrs vs ${jwHours.toFixed(1)} JW hrs (max ratio ${maxRatio}). Excess: ${excessHours.toFixed(1)} hrs. Est. wage adjustment: $${estimatedLiabilityUsd.toFixed(2)}`,
            apprenticeHours: appHours,
            journeyworkerHours: jwHours,
            maxAllowedApprenticeHours: maxAllowedApp,
            trade: configTrade,
            excessHours,
            estimatedLiabilityUsd,
          });
        }
      }
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
      const totalHoursRow =
        (e.monSt ?? 0) + (e.tueSt ?? 0) + (e.wedSt ?? 0) +
        (e.thuSt ?? 0) + (e.friSt ?? 0) + (e.satSt ?? 0) + (e.sunSt ?? 0) +
        (e.monOt ?? 0) + (e.tueOt ?? 0) + (e.wedOt ?? 0) +
        (e.thuOt ?? 0) + (e.friOt ?? 0) + (e.satOt ?? 0) + (e.sunOt ?? 0);

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

// ── Batch Project Compliance (DASH-05) ───────────────────────────────────

export async function getBatchProjectCompliance(
  db: BetterSQLite3Database<typeof schema>,
  userId: string,
): Promise<Map<string, 'archived' | 'violations' | 'compliant' | 'no-payroll'>> {
  const membershipRows = await db
    .select({ project: schema.projects })
    .from(schema.projectMembers)
    .innerJoin(schema.projects, eq(schema.projectMembers.projectId, schema.projects.id))
    .where(eq(schema.projectMembers.userId, userId));

  const allProjects = membershipRows.map(r => r.project);

  const result = new Map<string, 'archived' | 'violations' | 'compliant' | 'no-payroll'>();

  for (const project of allProjects) {
    if (project.status === 'closed') {
      result.set(project.id, 'archived');
      continue;
    }

    const weeks = await listPayrollWeeks(project.id);

    if (weeks.length === 0) {
      result.set(project.id, 'no-payroll');
      continue;
    }

    let hasViolations = false;
    for (const week of weeks) {
      const compliance = await computeCompliance(db, week.id);
      if (compliance?.hasViolations === true) {
        hasViolations = true;
        break;
      }
    }

    result.set(project.id, hasViolations ? 'violations' : 'compliant');
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
  violationType: 'under-wage' | 'cwhssa-ot' | 'ca-daily-ot' | 'ca-daily-dt' | 'apprentice-ratio' | 'apprentice-trade-ratio' | 'ira-iija-apprentice-pct';
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
