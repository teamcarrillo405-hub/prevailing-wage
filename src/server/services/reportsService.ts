// src/server/services/reportsService.ts
// Pure data functions for the two report endpoints (Phase 9 — Reports).
// getFringeSummary: aggregates fringe credits per worker across all weeks in a project.
// getWorkerPayHistory: returns one row per payroll week for a given worker, DESC order.
//
// IMPORTANT: fringe credits use fringeRateSnapshot from payrollEntries — NEVER live wageClassifications.

import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { payrollEntries, payrollWeeks, workers, workerClassifications } from '../db/schema.js';

// ── Exported interfaces ────────────────────────────────────────────────────

export interface FringeSummaryRow {
  workerId: string;
  workerName: string;
  totalSt: number;
  totalOt: number;
  totalHours: number;
  totalFringeCredits: number;  // sum of (totalSt+totalOt)*fringeRateSnapshot per entry
  weekCount: number;           // distinct payroll weeks this worker appeared in
}

export interface WorkerPayHistoryRow {
  payrollWeekId: string;
  weekNumber: number;
  weekEndingDate: string;
  totalSt: number;
  totalOt: number;
  grossWages: number | null;
  deductions: number;
  netPay: number | null;
  baseRateSnapshot: number;
  fringeRateSnapshot: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function sumSt(e: {
  monSt: number; tueSt: number; wedSt: number; thuSt: number;
  friSt: number; satSt: number; sunSt: number;
}): number {
  return (e.monSt ?? 0) + (e.tueSt ?? 0) + (e.wedSt ?? 0) +
    (e.thuSt ?? 0) + (e.friSt ?? 0) + (e.satSt ?? 0) + (e.sunSt ?? 0);
}

function sumOt(e: {
  monOt: number; tueOt: number; wedOt: number; thuOt: number;
  friOt: number; satOt: number; sunOt: number;
}): number {
  return (e.monOt ?? 0) + (e.tueOt ?? 0) + (e.wedOt ?? 0) +
    (e.thuOt ?? 0) + (e.friOt ?? 0) + (e.satOt ?? 0) + (e.sunOt ?? 0);
}

// ── getFringeSummary ──────────────────────────────────────────────────────

/**
 * Aggregates all payrollEntries for a project, grouped by workerId.
 * Returns one FringeSummaryRow per worker with fringe credits summed across
 * all weeks and all classifications. Workers with multiple classifications
 * in the same week are collapsed into a single row.
 */
export async function getFringeSummary(projectId: string): Promise<FringeSummaryRow[]> {
  const db = getDb();

  // Join payrollEntries -> payrollWeeks (filtered by projectId) -> workers
  const rows = await db
    .select({
      workerId: payrollEntries.workerId,
      workerName: workers.name,
      payrollWeekId: payrollEntries.payrollWeekId,
      monSt: payrollEntries.monSt,
      tueSt: payrollEntries.tueSt,
      wedSt: payrollEntries.wedSt,
      thuSt: payrollEntries.thuSt,
      friSt: payrollEntries.friSt,
      satSt: payrollEntries.satSt,
      sunSt: payrollEntries.sunSt,
      monOt: payrollEntries.monOt,
      tueOt: payrollEntries.tueOt,
      wedOt: payrollEntries.wedOt,
      thuOt: payrollEntries.thuOt,
      friOt: payrollEntries.friOt,
      satOt: payrollEntries.satOt,
      sunOt: payrollEntries.sunOt,
      fringeRateSnapshot: payrollEntries.fringeRateSnapshot,
    })
    .from(payrollEntries)
    .innerJoin(payrollWeeks, eq(payrollEntries.payrollWeekId, payrollWeeks.id))
    .innerJoin(workers, eq(payrollEntries.workerId, workers.id))
    .where(eq(payrollWeeks.projectId, projectId))
    .orderBy(workers.name);

  // Reduce into a Map keyed by workerId
  const map = new Map<string, FringeSummaryRow & { weekIds: Set<string> }>();

  for (const row of rows) {
    const totalSt = sumSt(row);
    const totalOt = sumOt(row);
    const fringeCredits = (totalSt + totalOt) * row.fringeRateSnapshot;

    const existing = map.get(row.workerId);
    if (existing) {
      existing.totalSt += totalSt;
      existing.totalOt += totalOt;
      existing.totalHours += totalSt + totalOt;
      existing.totalFringeCredits += fringeCredits;
      existing.weekIds.add(row.payrollWeekId);
      existing.weekCount = existing.weekIds.size;
    } else {
      map.set(row.workerId, {
        workerId: row.workerId,
        workerName: row.workerName,
        totalSt,
        totalOt,
        totalHours: totalSt + totalOt,
        totalFringeCredits: fringeCredits,
        weekCount: 1,
        weekIds: new Set([row.payrollWeekId]),
      });
    }
  }

  // Convert to array, strip internal weekIds set, sort by workerName
  return Array.from(map.values())
    .map(({ weekIds: _weekIds, ...rest }) => rest)
    .sort((a, b) => a.workerName.localeCompare(b.workerName));
}

// ── getWorkerPayHistory ───────────────────────────────────────────────────

/**
 * Returns one WorkerPayHistoryRow per payroll week for the given worker in the project.
 * Aggregates across all classifications (multiple entries in the same week are summed).
 * Ordered weekEndingDate DESC.
 */
export async function getWorkerPayHistory(
  projectId: string,
  workerId: string,
): Promise<WorkerPayHistoryRow[]> {
  const db = getDb();

  const rows = await db
    .select({
      payrollWeekId: payrollEntries.payrollWeekId,
      weekNumber: payrollWeeks.payrollNumber,
      weekEndingDate: payrollWeeks.weekEndingDate,
      monSt: payrollEntries.monSt,
      tueSt: payrollEntries.tueSt,
      wedSt: payrollEntries.wedSt,
      thuSt: payrollEntries.thuSt,
      friSt: payrollEntries.friSt,
      satSt: payrollEntries.satSt,
      sunSt: payrollEntries.sunSt,
      monOt: payrollEntries.monOt,
      tueOt: payrollEntries.tueOt,
      wedOt: payrollEntries.wedOt,
      thuOt: payrollEntries.thuOt,
      friOt: payrollEntries.friOt,
      satOt: payrollEntries.satOt,
      sunOt: payrollEntries.sunOt,
      grossWages: payrollEntries.grossWages,
      deductions: payrollEntries.deductions,
      netPay: payrollEntries.netPay,
      baseRateSnapshot: payrollEntries.baseRateSnapshot,
      fringeRateSnapshot: payrollEntries.fringeRateSnapshot,
    })
    .from(payrollEntries)
    .innerJoin(payrollWeeks, eq(payrollEntries.payrollWeekId, payrollWeeks.id))
    .where(
      and(
        eq(payrollWeeks.projectId, projectId),
        eq(payrollEntries.workerId, workerId),
      ),
    )
    .orderBy(payrollWeeks.weekEndingDate);

  // Reduce into Map keyed by payrollWeekId (aggregate multi-classification entries)
  const map = new Map<string, {
    row: WorkerPayHistoryRow;
    hasGrossWages: boolean;
    hasNetPay: boolean;
  }>();

  for (const r of rows) {
    const totalSt = sumSt(r);
    const totalOt = sumOt(r);
    const existing = map.get(r.payrollWeekId);

    if (existing) {
      existing.row.totalSt += totalSt;
      existing.row.totalOt += totalOt;
      // Sum grossWages — treat null as 0 but track whether any entry had a value
      if (r.grossWages != null) {
        existing.row.grossWages = (existing.row.grossWages ?? 0) + r.grossWages;
        existing.hasGrossWages = true;
      }
      existing.row.deductions += r.deductions;
      // Sum netPay — same null-tracking logic
      if (r.netPay != null) {
        existing.row.netPay = (existing.row.netPay ?? 0) + r.netPay;
        existing.hasNetPay = true;
      }
    } else {
      map.set(r.payrollWeekId, {
        row: {
          payrollWeekId: r.payrollWeekId,
          weekNumber: r.weekNumber,
          weekEndingDate: r.weekEndingDate,
          totalSt,
          totalOt,
          grossWages: r.grossWages,
          deductions: r.deductions,
          netPay: r.netPay,
          baseRateSnapshot: r.baseRateSnapshot,
          fringeRateSnapshot: r.fringeRateSnapshot,
        },
        hasGrossWages: r.grossWages != null,
        hasNetPay: r.netPay != null,
      });
    }
  }

  // Return in DESC weekEndingDate order (reverse insertion order from ASC SQL query)
  return Array.from(map.values())
    .reverse()
    .map(({ row }) => row);
}

// ── getFringeBreakdown ────────────────────────────────────────────────────

export interface FringeBreakdownRow {
  fundType: 'healthWelfare' | 'pension' | 'vacation' | 'training';
  unionLocal: string;
  classificationLevel: 'journeyworker' | 'apprentice' | 'foreman';
  totalAmount: number;
  workerCount: number;
}

/**
 * Aggregates fringe benefit totals by fund type, union local, and classification level.
 * Uses in-memory Map aggregation (not Drizzle groupBy).
 * Null unionLocal is mapped to 'Unaffiliated'.
 * Rows where a fringe column is null or 0 are excluded.
 * Sorted by unionLocal ASC, classificationLevel ASC, fundType ASC.
 */
export async function getFringeBreakdown(
  projectId: string,
  weekId?: string,
): Promise<FringeBreakdownRow[]> {
  const db = getDb();

  const whereClause = weekId
    ? and(eq(payrollWeeks.projectId, projectId), eq(payrollEntries.payrollWeekId, weekId))
    : eq(payrollWeeks.projectId, projectId);

  const rows = await db
    .select({
      workerId: payrollEntries.workerId,
      unionLocal: workers.unionLocal,
      classificationLevel: workerClassifications.laborType,
      fringeHealthWelfare: payrollEntries.fringeHealthWelfare,
      fringePension: payrollEntries.fringePension,
      fringeVacation: payrollEntries.fringeVacation,
      fringeTraining: payrollEntries.fringeTraining,
    })
    .from(payrollEntries)
    .innerJoin(payrollWeeks, eq(payrollEntries.payrollWeekId, payrollWeeks.id))
    .innerJoin(workers, eq(payrollEntries.workerId, workers.id))
    .innerJoin(workerClassifications, eq(payrollEntries.classificationId, workerClassifications.id))
    .where(whereClause);

  // Aggregate in-memory: key = `${fundType}|${unionLocal}|${classificationLevel}`
  type Key = string;
  const map = new Map<Key, { totalAmount: number; workerIds: Set<string> }>();

  const FUND_TYPES: Array<{
    key: FringeBreakdownRow['fundType'];
    col: 'fringeHealthWelfare' | 'fringePension' | 'fringeVacation' | 'fringeTraining';
  }> = [
    { key: 'healthWelfare', col: 'fringeHealthWelfare' },
    { key: 'pension',       col: 'fringePension' },
    { key: 'vacation',      col: 'fringeVacation' },
    { key: 'training',      col: 'fringeTraining' },
  ];

  for (const row of rows) {
    const unionLocal = row.unionLocal ?? 'Unaffiliated';
    const classificationLevel = row.classificationLevel;

    for (const { key: fundType, col } of FUND_TYPES) {
      const amount = row[col] ?? 0;
      if (amount === 0) continue;

      const mapKey = `${fundType}|${unionLocal}|${classificationLevel}`;
      const existing = map.get(mapKey);
      if (existing) {
        existing.totalAmount += amount;
        existing.workerIds.add(row.workerId);
      } else {
        map.set(mapKey, {
          totalAmount: amount,
          workerIds: new Set([row.workerId]),
        });
      }
    }
  }

  const result: FringeBreakdownRow[] = [];
  for (const [mapKey, { totalAmount, workerIds }] of map.entries()) {
    const [fundType, unionLocal, classificationLevel] = mapKey.split('|') as [
      FringeBreakdownRow['fundType'],
      string,
      FringeBreakdownRow['classificationLevel'],
    ];
    result.push({ fundType, unionLocal, classificationLevel, totalAmount, workerCount: workerIds.size });
  }

  return result.sort((a, b) => {
    if (a.unionLocal !== b.unionLocal) return a.unionLocal.localeCompare(b.unionLocal);
    if (a.classificationLevel !== b.classificationLevel) return a.classificationLevel.localeCompare(b.classificationLevel);
    return a.fundType.localeCompare(b.fundType);
  });
}
