// src/server/services/gsaRateBuilder.ts
// Pure function — NO imports from db, drizzle, or HTTP.
// Can be imported by both server routes and client components.
//
// GSA Schedule fully-loaded rate formula:
//   directLaborCost = base + fringe
//   afterOverhead   = directLaborCost × (1 + overheadPct / 100)
//   afterGa         = afterOverhead   × (1 + gaPct / 100)
//   billableRate    = afterGa         × (1 + profitPct / 100)

export interface GsaRateInput {
  baseRate: number;        // $/hr — prevailing wage base
  fringeRate: number;      // $/hr — fringe benefit credit
  overheadPct: number;     // 0–200 — company overhead %
  gaPct: number;           // 0–200 — general & administrative %
  profitPct: number;       // 0–100 — profit/fee %
}

export interface GsaRateResult {
  directLaborCost: number;  // base + fringe
  afterOverhead: number;    // directLaborCost × (1 + overheadPct/100)
  afterGa: number;          // afterOverhead × (1 + gaPct/100)
  billableRate: number;     // afterGa × (1 + profitPct/100)
}

export function calculateGsaRate(input: GsaRateInput): GsaRateResult {
  const { baseRate, fringeRate, overheadPct, gaPct, profitPct } = input;

  const directLaborCost = baseRate + fringeRate;
  const afterOverhead = directLaborCost * (1 + overheadPct / 100);
  const afterGa = afterOverhead * (1 + gaPct / 100);
  const billableRate = afterGa * (1 + profitPct / 100);

  return { directLaborCost, afterOverhead, afterGa, billableRate };
}
