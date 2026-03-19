// src/server/services/varianceService.ts
// Aggregates payroll_weeks + payroll_entries by weekEndingDate to produce
// a week-by-week variance report against the project's working budget.
//
// Burn rate model: LINEAR — workingBudget / totalWeeks * payrollNumber
// This means payroll #1 should have burned budget/totalWeeks, payroll #2
// should have burned 2*budget/totalWeeks, etc. Document this in the UI.
//
// Cost source: payrollEntries.grossWages when non-null,
//              else (totalHours * baseRateSnapshot + totalHours * fringeRateSnapshot)
// NEVER reads from wageClassifications.

import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema.js';

export interface WeeklyVarianceRow {
  weekEndingDate: string;
  payrollNumber: number;
  actualCost: number;
  burnRate: number;           // workingBudget / totalWeeks * payrollNumber (cumulative budget through this week)
  variancePct: number;        // (cumulativeActual - cumulativeBurnRate) / cumulativeBurnRate * 100; 0 when burnRate = 0
  isOverThreshold: boolean;   // Math.abs(variancePct) > varianceThresholdPct
  cumulativeActual: number;   // running sum of actualCost up to and including this week
  cumulativeBurnRate: number; // running sum of burnRate up to and including this week
}

export interface VarianceReport {
  projectId: string;
  workingBudget: number;
  bidAmount: number | null;
  totalWeeks: number;
  varianceThresholdPct: number;
  weeks: WeeklyVarianceRow[];
  totalActual: number;
  totalBudgetBurned: number;  // cumulative burn rate through last payroll week
  overallVariancePct: number; // (totalActual - totalBudgetBurned) / totalBudgetBurned * 100
}

export async function calculateVarianceReport(
  db: BetterSQLite3Database<typeof schema>,
  projectId: string,
): Promise<VarianceReport | null> {
  // 1. Fetch budget config — return null if not configured
  const [budget] = await db
    .select()
    .from(schema.projectBudgets)
    .where(eq(schema.projectBudgets.projectId, projectId));

  if (!budget) return null;

  const { workingBudget, totalWeeks, varianceThresholdPct, bidAmount } = budget;
  const weeklyBudgetAmount = workingBudget / totalWeeks;

  // 2. Fetch all payroll weeks for the project, ordered by date ascending
  const weeks = await db
    .select()
    .from(schema.payrollWeeks)
    .where(eq(schema.payrollWeeks.projectId, projectId))
    .orderBy(schema.payrollWeeks.weekEndingDate);

  if (weeks.length === 0) {
    return {
      projectId,
      workingBudget,
      bidAmount: bidAmount ?? null,
      totalWeeks,
      varianceThresholdPct,
      weeks: [],
      totalActual: 0,
      totalBudgetBurned: 0,
      overallVariancePct: 0,
    };
  }

  // 3. Fetch all entries for all weeks in one query
  const allEntries = await db
    .select({
      payrollWeekId: schema.payrollEntries.payrollWeekId,
      monSt: schema.payrollEntries.monSt,
      tueSt: schema.payrollEntries.tueSt,
      wedSt: schema.payrollEntries.wedSt,
      thuSt: schema.payrollEntries.thuSt,
      friSt: schema.payrollEntries.friSt,
      satSt: schema.payrollEntries.satSt,
      sunSt: schema.payrollEntries.sunSt,
      monOt: schema.payrollEntries.monOt,
      tueOt: schema.payrollEntries.tueOt,
      wedOt: schema.payrollEntries.wedOt,
      thuOt: schema.payrollEntries.thuOt,
      friOt: schema.payrollEntries.friOt,
      satOt: schema.payrollEntries.satOt,
      sunOt: schema.payrollEntries.sunOt,
      baseRateSnapshot: schema.payrollEntries.baseRateSnapshot,
      fringeRateSnapshot: schema.payrollEntries.fringeRateSnapshot,
      grossWages: schema.payrollEntries.grossWages,
    })
    .from(schema.payrollEntries)
    .innerJoin(
      schema.payrollWeeks,
      eq(schema.payrollEntries.payrollWeekId, schema.payrollWeeks.id),
    )
    // CORRECT order: .where() must come AFTER .innerJoin() for Drizzle to generate valid SQL
    .where(eq(schema.payrollWeeks.projectId, projectId));

  // Index entries by weekId
  const entriesByWeek = new Map<string, typeof allEntries>();
  for (const entry of allEntries) {
    const list = entriesByWeek.get(entry.payrollWeekId) ?? [];
    list.push(entry);
    entriesByWeek.set(entry.payrollWeekId, list);
  }

  // 4. Build weekly rows
  let cumulativeActual = 0;
  const weekRows: WeeklyVarianceRow[] = [];

  for (const week of weeks) {
    const entries = entriesByWeek.get(week.id) ?? [];

    let weekActual = 0;
    for (const entry of entries) {
      const totalHours =
        (entry.monSt + entry.tueSt + entry.wedSt + entry.thuSt + entry.friSt + entry.satSt + entry.sunSt) +
        (entry.monOt + entry.tueOt + entry.wedOt + entry.thuOt + entry.friOt + entry.satOt + entry.sunOt);

      const cost = entry.grossWages != null
        ? entry.grossWages
        : totalHours * (entry.baseRateSnapshot + entry.fringeRateSnapshot);

      weekActual += cost;
    }

    cumulativeActual += weekActual;

    // Burn rate: cumulative budget through payroll #N = weeklyBudgetAmount * payrollNumber
    const cumulativeBurnRate = weeklyBudgetAmount * week.payrollNumber;

    const variancePct = cumulativeBurnRate > 0
      ? (cumulativeActual - cumulativeBurnRate) / cumulativeBurnRate * 100
      : 0;

    const isOverThreshold = Math.abs(variancePct) > varianceThresholdPct;

    weekRows.push({
      weekEndingDate: week.weekEndingDate,
      payrollNumber: week.payrollNumber,
      actualCost: weekActual,
      burnRate: weeklyBudgetAmount,      // this week's budget slice
      variancePct,
      isOverThreshold,
      cumulativeActual,
      cumulativeBurnRate,
    });
  }

  const lastRow = weekRows[weekRows.length - 1];
  const totalActual = lastRow?.cumulativeActual ?? 0;
  const totalBudgetBurned = lastRow?.cumulativeBurnRate ?? 0;
  const overallVariancePct = totalBudgetBurned > 0
    ? (totalActual - totalBudgetBurned) / totalBudgetBurned * 100
    : 0;

  return {
    projectId,
    workingBudget,
    bidAmount: bidAmount ?? null,
    totalWeeks,
    varianceThresholdPct,
    weeks: weekRows,
    totalActual,
    totalBudgetBurned,
    overallVariancePct,
  };
}
