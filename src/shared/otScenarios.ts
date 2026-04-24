// Pure OT scenario types and compareScenarios function.
// No DB imports — safe to use in both server and client (browser).
import { calculateCwhssaOt, CwhssaOtResult } from '../server/services/calculations.js';

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

export function compareScenarios(scenarios: OtScenario[]): OtScenarioResult[] {
  return scenarios.map((s) => {
    const totalHours = s.dailyHours.reduce((sum, h) => sum + h, 0);
    const overtimeHours = Math.max(0, totalHours - s.overtimeThreshold);
    const doubletimeHours = s.doubletimeThreshold
      ? Math.max(0, totalHours - s.doubletimeThreshold)
      : 0;
    const result = calculateCwhssaOt({
      baseRate: s.baseRate,
      fringeRate: s.fringeRate,
      totalHoursWorked: totalHours,
      overtimeHours,
    });
    return { label: s.label, totalHours, overtimeHours, doubletimeHours, result };
  });
}
