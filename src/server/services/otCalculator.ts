// src/server/services/otCalculator.ts
// Wires calculateCwhssaOt() to DB threshold data.
// DOES NOT reimplement OT math — calculateCwhssaOt from Phase 3 is the engine.

import { calculateCwhssaOt, CwhssaOtResult } from './calculations.js';
import { getDb } from '../db/index.js';
import { otThresholds } from '../db/schema.js';
import { eq } from 'drizzle-orm';

// ── Exported Types ─────────────────────────────────────────────────────────

export interface OtScenario {
  label: string;
  dailyHours: number[];
  baseRate: number;
  fringeRate: number;
  overtimeThreshold: number;
  doubletimeThreshold?: number;
}

export interface OtScenarioResult {
  label: string;
  totalHours: number;
  overtimeHours: number;
  doubletimeHours: number;
  result: CwhssaOtResult;
}

export interface OtThreshold {
  weeklyOtThreshold: number;
  dailyOtThreshold: number | null;
  dailyDtThreshold: number | null;
  otMultiplier: number;
  dtMultiplier: number;
  source: 'cwhssa' | 'cba' | 'state';
}

export interface PayrollEntryWithWorker {
  workerId: string;
  workerName: string;
  dailyHours: number[];  // [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
  baseRate: number;
  fringeRate: number;
}

export interface WorkerOtCost {
  workerId: string;
  workerName: string;
  totalHours: number;
  overtimeHours: number;
  result: CwhssaOtResult;
}

// ── Default CWHSSA Threshold ───────────────────────────────────────────────

const DEFAULT_THRESHOLD: OtThreshold = {
  weeklyOtThreshold: 40,
  dailyOtThreshold: null,
  dailyDtThreshold: null,
  otMultiplier: 1.5,
  dtMultiplier: 2.0,
  source: 'cwhssa',
};

// ── DB Functions ───────────────────────────────────────────────────────────

export async function getOtThreshold(projectId: string): Promise<typeof otThresholds.$inferSelect | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(otThresholds)
    .where(eq(otThresholds.projectId, projectId));
  return rows[0] ?? null;
}

export async function getOrDefaultThreshold(projectId: string): Promise<OtThreshold> {
  const row = await getOtThreshold(projectId);
  if (!row) return DEFAULT_THRESHOLD;
  return {
    weeklyOtThreshold: row.weeklyOtThreshold,
    dailyOtThreshold: row.dailyOtThreshold ?? null,
    dailyDtThreshold: row.dailyDtThreshold ?? null,
    otMultiplier: row.otMultiplier,
    dtMultiplier: row.dtMultiplier,
    source: row.source as 'cwhssa' | 'cba' | 'state',
  };
}

// ── applyOtThreshold ───────────────────────────────────────────────────────
// For each entry, computes total hours, determines OT hours, then delegates
// all cost math to calculateCwhssaOt (the Phase 3 engine).
// CWHSSA rule: weekly-only OT by default; daily threshold applied only when NOT null.

export function applyOtThreshold(
  entries: PayrollEntryWithWorker[],
  threshold: OtThreshold,
): WorkerOtCost[] {
  return entries.map((entry) => {
    const totalHours = entry.dailyHours.reduce((sum, h) => sum + h, 0);

    // Weekly OT: hours beyond weekly threshold
    const weeklyOtHours = Math.max(0, totalHours - threshold.weeklyOtThreshold);

    // Daily OT: only applied when dailyOtThreshold is explicitly set (CBA/state plans)
    let overtimeHours = weeklyOtHours;
    if (threshold.dailyOtThreshold !== null) {
      // Sum daily OT across all days
      const dailyOtTotal = entry.dailyHours.reduce((sum, dayHours) => {
        return sum + Math.max(0, dayHours - threshold.dailyOtThreshold!);
      }, 0);
      // Use the higher of weekly or daily OT — no double-count
      overtimeHours = Math.max(weeklyOtHours, dailyOtTotal);
    }

    // Delegate ALL cost math to calculateCwhssaOt — never reimplement here
    const result = calculateCwhssaOt({
      baseRate: entry.baseRate,
      fringeRate: entry.fringeRate,
      totalHoursWorked: totalHours,
      overtimeHours,
    });

    return {
      workerId: entry.workerId,
      workerName: entry.workerName,
      totalHours,
      overtimeHours,
      result,
    };
  });
}

// ── compareScenarios ───────────────────────────────────────────────────────
// Pure function — no DB access. For each scenario, sums daily hours,
// determines OT, and calls calculateCwhssaOt().
// CRITICAL: fringe is NOT multiplied — calculateCwhssaOt applies it at 1.0x for all hours.

export function compareScenarios(scenarios: OtScenario[]): OtScenarioResult[] {
  return scenarios.map((s) => {
    const totalHours = s.dailyHours.reduce((sum, h) => sum + h, 0);
    const overtimeHours = Math.max(0, totalHours - s.overtimeThreshold);
    const doubletimeHours = s.doubletimeThreshold
      ? Math.max(0, totalHours - s.doubletimeThreshold)
      : 0;

    // calculateCwhssaOt handles: fringe at 1.0x ALL hours, OT premium on base only
    // DO NOT pass fringeRate * 1.5 — that would violate CWHSSA
    const result = calculateCwhssaOt({
      baseRate: s.baseRate,
      fringeRate: s.fringeRate,
      totalHoursWorked: totalHours,
      overtimeHours,
    });

    return { label: s.label, totalHours, overtimeHours, doubletimeHours, result };
  });
}
