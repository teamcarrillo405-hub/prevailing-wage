// src/server/services/unionAllocation.ts
// Aggregates payroll_entries by tradeCode to produce per-trade cost breakdown.
// Cost source: payrollEntries.grossWages when non-null,
//              else (totalHours * baseRateSnapshot + totalHours * fringeRateSnapshot).
// NEVER reads from wageClassifications — snapshots only.

import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema.js';

export interface TradeSummary {
  tradeCode: string;
  tradeName: string;          // from union_trade_configs.tradeName, or tradeCode if no config found
  headcount: number;          // distinct worker_id count
  totalHours: number;
  totalCost: number;
}

export interface UnionAllocationResult {
  projectId: string;
  trades: TradeSummary[];
  grandTotalHours: number;
  grandTotalCost: number;
  blendedHourlyRate: number;  // grandTotalCost / grandTotalHours; 0 when grandTotalHours = 0
}

export async function calculateUnionAllocation(
  db: BetterSQLite3Database<typeof schema>,
  projectId: string,
): Promise<UnionAllocationResult> {
  // 1. Fetch all payroll entries for this project via payrollWeeks join
  const entries = await db
    .select({
      workerId: schema.payrollEntries.workerId,
      classificationId: schema.payrollEntries.classificationId,
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
      tradeCode: schema.workerClassifications.tradeCode,
      tradeDescription: schema.workerClassifications.tradeDescription,
    })
    .from(schema.payrollEntries)
    .innerJoin(
      schema.payrollWeeks,
      eq(schema.payrollEntries.payrollWeekId, schema.payrollWeeks.id),
    )
    .innerJoin(
      schema.workerClassifications,
      eq(schema.payrollEntries.classificationId, schema.workerClassifications.id),
    )
    .where(eq(schema.payrollWeeks.projectId, projectId));

  // 2. Fetch union trade configs for display names
  const configs = await db
    .select()
    .from(schema.unionTradeConfigs)
    .where(eq(schema.unionTradeConfigs.projectId, projectId));

  const configByTradeCode = new Map(configs.map(c => [c.tradeCode, c]));

  // 3. Aggregate by tradeCode
  const tradeMap = new Map<string, {
    tradeDescription: string;
    workerIds: Set<string>;
    totalHours: number;
    totalCost: number;
  }>();

  for (const entry of entries) {
    const totalHours =
      (entry.monSt + entry.tueSt + entry.wedSt + entry.thuSt + entry.friSt + entry.satSt + entry.sunSt) +
      (entry.monOt + entry.tueOt + entry.wedOt + entry.thuOt + entry.friOt + entry.satOt + entry.sunOt);

    const cost = entry.grossWages != null
      ? entry.grossWages
      : totalHours * (entry.baseRateSnapshot + entry.fringeRateSnapshot);

    if (!tradeMap.has(entry.tradeCode)) {
      tradeMap.set(entry.tradeCode, {
        tradeDescription: entry.tradeDescription,
        workerIds: new Set(),
        totalHours: 0,
        totalCost: 0,
      });
    }

    const agg = tradeMap.get(entry.tradeCode)!;
    agg.workerIds.add(entry.workerId);
    agg.totalHours += totalHours;
    agg.totalCost += cost;
  }

  // 4. Build TradeSummary[]
  const trades: TradeSummary[] = [];
  for (const [tradeCode, agg] of tradeMap.entries()) {
    const config = configByTradeCode.get(tradeCode);
    trades.push({
      tradeCode,
      tradeName: config?.tradeName ?? agg.tradeDescription,
      headcount: agg.workerIds.size,
      totalHours: agg.totalHours,
      totalCost: agg.totalCost,
    });
  }

  // Sort trades by tradeCode for consistent ordering
  trades.sort((a, b) => a.tradeCode.localeCompare(b.tradeCode));

  const grandTotalHours = trades.reduce((s, t) => s + t.totalHours, 0);
  const grandTotalCost = trades.reduce((s, t) => s + t.totalCost, 0);
  const blendedHourlyRate = grandTotalHours > 0 ? grandTotalCost / grandTotalHours : 0;

  return { projectId, trades, grandTotalHours, grandTotalCost, blendedHourlyRate };
}
