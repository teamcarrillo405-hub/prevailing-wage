import { describe, it } from 'vitest';

describe('calculateVarianceReport', () => {
  it.todo('VAR-01: returns WeeklyVarianceRow[] sorted by weekEndingDate ascending');
  it.todo('VAR-01: actual cost uses grossWages when non-null, else (totalHours * baseRateSnapshot + totalHours * fringeRateSnapshot)');
  it.todo('VAR-01: burnRate per week = workingBudget / totalWeeks * payrollNumber (linear)');
  it.todo('VAR-02: isOverThreshold = Math.abs(variancePct) > varianceThresholdPct');
  it.todo('VAR-02: variancePct = (actual - burnRate) / burnRate * 100 when burnRate > 0');
  it.todo('VAR-03: cumulativeActual accumulates across weeks in ascending date order');
  it.todo('VAR-03: cumulativeBurnRate accumulates burn rate across weeks');
  it.todo('VAR-01: report includes bidAmount, workingBudget, actual, and three-way variance display');
  it.todo('returns null when no project_budgets row exists for projectId');
});
