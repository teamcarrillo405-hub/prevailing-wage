import { describe, it } from 'vitest';

describe('calculateGsaRate', () => {
  it.todo('GSA-01: applies formula (base+fringe) × (1+OH/100) × (1+GA/100) × (1+P/100)');
  it.todo('GSA-01: returns directLaborCost = base + fringe');
  it.todo('GSA-01: returns afterOverhead = directLaborCost × (1 + overheadPct/100)');
  it.todo('GSA-01: returns afterGa = afterOverhead × (1 + gaPct/100)');
  it.todo('GSA-01: returns billableRate = afterGa × (1 + profitPct/100)');
  it.todo('GSA-01: handles zero overhead, GA, and profit (billableRate = base + fringe)');
  it.todo('GSA-02: pure function — no imports from db or http modules');
  it.todo('GSA-01: returns billableRate >= 0 when all inputs are zero');
});
