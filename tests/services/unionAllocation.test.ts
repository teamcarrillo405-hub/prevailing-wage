import { describe, it } from 'vitest';

describe('calculateUnionAllocation', () => {
  it.todo('UNION-02: returns TradeSummary[] with headcount, totalHours, totalCost per tradeCode');
  it.todo('UNION-02: cost uses grossWages when non-null, else (totalHours * baseRateSnapshot + totalHours * fringeRateSnapshot)');
  it.todo('UNION-03: blendedHourlyRate = grandTotalCost / grandTotalHours when grandTotalHours > 0');
  it.todo('UNION-03: blendedHourlyRate = 0 when grandTotalHours = 0 (guard against divide-by-zero)');
  it.todo('UNION-01: returns empty trades array when project has no payroll entries');
});
