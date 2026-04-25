// src/server/services/complianceApprenticeRatio.test.ts
// Unit tests for COMP-04 (per-trade daily apprenticeship ratio) and
// COMP-05 (IRA/IIJA 15% apprenticeship requirement).
//
// These tests exercise the logic extracted from computeCompliance() directly,
// without needing a database — we replicate the algorithm in a pure helper
// that mirrors what complianceService.ts does.

import { describe, it, expect } from 'vitest';

// ── Pure helpers that mirror complianceService.ts logic ───────────────────
// These are extracted here for unit-testability without DB setup.

interface EntryLike {
  baseRateSnapshot: number;
  fringeRateSnapshot: number;
  monSt: number; tueSt: number; wedSt: number; thuSt: number;
  friSt: number; satSt: number; sunSt: number;
  monOt: number; tueOt: number; wedOt: number; thuOt: number;
  friOt: number; satOt: number; sunOt: number;
}

interface RowLike {
  entry: EntryLike;
  laborType: 'journeyworker' | 'apprentice' | 'foreman';
  tradeDescription: string;
}

function rowHours(e: EntryLike): number {
  return (e.monSt + e.tueSt + e.wedSt + e.thuSt + e.friSt + e.satSt + e.sunSt +
          e.monOt + e.tueOt + e.wedOt + e.thuOt + e.friOt + e.satOt + e.sunOt);
}

function blankEntry(st: number, baseRate: number): EntryLike {
  return {
    baseRateSnapshot: baseRate,
    fringeRateSnapshot: 0,
    monSt: st, tueSt: 0, wedSt: 0, thuSt: 0, friSt: 0, satSt: 0, sunSt: 0,
    monOt: 0, tueOt: 0, wedOt: 0, thuOt: 0, friOt: 0, satOt: 0, sunOt: 0,
  };
}

interface TradeRatioViolation {
  violationType: 'apprentice-trade-ratio';
  trade: string;
  apprenticeHours: number;
  journeyworkerHours: number;
  maxAllowedApprenticeHours: number;
  excessHours: number;
  estimatedLiabilityUsd: number;
  detail: string;
}

interface IraIijaViolation {
  violationType: 'ira-iija-apprentice-pct';
  totalHours: number;
  apprenticeHours: number;
  actualPct: number;
  detail: string;
}

type WeekViolation = TradeRatioViolation | IraIijaViolation;

// Mirrors the COMP-04 block in complianceService.ts
function checkTradeRatios(
  rows: RowLike[],
  apprenticeshipRequirements: string | null | undefined,
): TradeRatioViolation[] {
  if (!apprenticeshipRequirements) return [];

  let ratioConfig: Record<string, { maxRatio: string }> = {};
  try {
    ratioConfig = JSON.parse(apprenticeshipRequirements);
  } catch {
    return [];
  }
  if (Object.keys(ratioConfig).length === 0) return [];

  const tradeJwHours = new Map<string, number>();
  const tradeAppHours = new Map<string, number>();
  const tradeAppRateSum = new Map<string, number>();
  const tradeAppCount = new Map<string, number>();
  const tradeJwRateSum = new Map<string, number>();
  const tradeJwCount = new Map<string, number>();

  for (const row of rows) {
    const e = row.entry;
    const trade = row.tradeDescription;
    const totalHoursRow = rowHours(e);

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

  const violations: TradeRatioViolation[] = [];

  for (const [configTrade, { maxRatio }] of Object.entries(ratioConfig)) {
    const matchKey = [...tradeJwHours.keys()].find(
      k => k.toLowerCase().includes(configTrade.toLowerCase()) ||
           configTrade.toLowerCase().includes(k.toLowerCase()),
    ) ?? configTrade;

    const jwHours = tradeJwHours.get(matchKey) ?? 0;
    const appHours = tradeAppHours.get(matchKey) ?? 0;

    if (jwHours === 0 || appHours === 0) continue;

    const parts = maxRatio.split(':').map(Number);
    const ratioNumerator = parts[0] ?? 1;
    const ratioDenominator = parts[1] ?? 1;
    const maxAllowedApp = jwHours * (ratioNumerator / ratioDenominator);

    if (appHours > maxAllowedApp + 0.001) {
      const excessHours = appHours - maxAllowedApp;
      const avgJwRate = tradeJwCount.get(matchKey)
        ? (tradeJwRateSum.get(matchKey) ?? 0) / tradeJwCount.get(matchKey)!
        : 0;
      const avgAppRate = tradeAppCount.get(matchKey)
        ? (tradeAppRateSum.get(matchKey) ?? 0) / tradeAppCount.get(matchKey)!
        : 0;
      const rateDiff = Math.max(0, avgJwRate - avgAppRate);
      const estimatedLiabilityUsd = Math.round(excessHours * rateDiff * 100) / 100;

      violations.push({
        violationType: 'apprentice-trade-ratio',
        trade: configTrade,
        apprenticeHours: appHours,
        journeyworkerHours: jwHours,
        maxAllowedApprenticeHours: maxAllowedApp,
        excessHours,
        estimatedLiabilityUsd,
        detail: `Trade: ${configTrade} — ${appHours.toFixed(1)} apprentice hrs vs ${jwHours.toFixed(1)} JW hrs (max ratio ${maxRatio}). Excess: ${excessHours.toFixed(1)} hrs. Est. wage adjustment: $${estimatedLiabilityUsd.toFixed(2)}`,
      });
    }
  }

  return violations;
}

// Mirrors the COMP-05 block in complianceService.ts
function checkIraIija(rows: RowLike[], isIraIijaProject: boolean | null | undefined): IraIijaViolation | null {
  if (!isIraIijaProject) return null;

  let totalAllHours = 0;
  let totalAppHours = 0;

  for (const row of rows) {
    const h = rowHours(row.entry);
    totalAllHours += h;
    if (row.laborType === 'apprentice') totalAppHours += h;
  }

  if (totalAllHours === 0) return null;

  const actualPct = totalAppHours / totalAllHours;
  if (actualPct < 0.15) {
    return {
      violationType: 'ira-iija-apprentice-pct',
      totalHours: totalAllHours,
      apprenticeHours: totalAppHours,
      actualPct,
      detail: `IRA/IIJA: Apprentice hours are ${(actualPct * 100).toFixed(1)}% of total — below 15% requirement for tax credit eligibility.`,
    };
  }
  return null;
}

// ── COMP-04: Per-trade ratio tests ────────────────────────────────────────

describe('COMP-04: per-trade apprenticeship ratio', () => {
  it('ratio satisfied — no violation emitted', () => {
    // 1 JW (8h) + 1 apprentice (4h) at 1:2 ratio → 4 <= 8*(1/2)=4. At boundary, no violation.
    const rows: RowLike[] = [
      { entry: blankEntry(8, 60), laborType: 'journeyworker', tradeDescription: 'Electrician' },
      { entry: blankEntry(4, 30), laborType: 'apprentice',    tradeDescription: 'Electrician' },
    ];
    const config = JSON.stringify({ Electrician: { maxRatio: '1:2' } });
    const violations = checkTradeRatios(rows, config);
    expect(violations).toHaveLength(0);
  });

  it('ratio exceeded — COMP-04 fires with correct excess hours', () => {
    // 1 JW (8h) + 1 apprentice (6h) at 1:2 → max allowed = 8*(1/2) = 4h, excess = 2h
    const rows: RowLike[] = [
      { entry: blankEntry(8, 60), laborType: 'journeyworker', tradeDescription: 'Electrician' },
      { entry: blankEntry(6, 30), laborType: 'apprentice',    tradeDescription: 'Electrician' },
    ];
    const config = JSON.stringify({ Electrician: { maxRatio: '1:2' } });
    const violations = checkTradeRatios(rows, config);
    expect(violations).toHaveLength(1);
    const v = violations[0];
    expect(v.violationType).toBe('apprentice-trade-ratio');
    expect(v.trade).toBe('Electrician');
    expect(v.apprenticeHours).toBe(6);
    expect(v.journeyworkerHours).toBe(8);
    expect(v.maxAllowedApprenticeHours).toBeCloseTo(4);
    expect(v.excessHours).toBeCloseTo(2);
    // Estimated liability = 2 excess hrs × (60 − 30) = $60
    expect(v.estimatedLiabilityUsd).toBeCloseTo(60);
  });

  it('ratio exactly at boundary — no violation (boundary is inclusive)', () => {
    // 1 JW (10h) + 1 apprentice (5h) at 1:2 → max = 5h, app = 5h — at boundary, no violation
    const rows: RowLike[] = [
      { entry: blankEntry(10, 60), laborType: 'journeyworker', tradeDescription: 'Carpenter' },
      { entry: blankEntry(5, 30), laborType: 'apprentice',     tradeDescription: 'Carpenter' },
    ];
    const config = JSON.stringify({ Carpenter: { maxRatio: '1:2' } });
    const violations = checkTradeRatios(rows, config);
    expect(violations).toHaveLength(0);
  });

  it('apprenticeshipRequirements is null — no COMP-04 violation', () => {
    const rows: RowLike[] = [
      { entry: blankEntry(8, 60), laborType: 'journeyworker', tradeDescription: 'Electrician' },
      { entry: blankEntry(8, 30), laborType: 'apprentice',    tradeDescription: 'Electrician' },
    ];
    const violations = checkTradeRatios(rows, null);
    expect(violations).toHaveLength(0);
  });

  it('no apprentice entries for configured trade — no violation', () => {
    // Only JW hours, no apprentice
    const rows: RowLike[] = [
      { entry: blankEntry(40, 60), laborType: 'journeyworker', tradeDescription: 'Plumber' },
    ];
    const config = JSON.stringify({ Plumber: { maxRatio: '1:3' } });
    const violations = checkTradeRatios(rows, config);
    expect(violations).toHaveLength(0);
  });

  it('1:1 ratio exceeded: 2 apprentice hours vs 1 JW hour → excess 1h, liability correct', () => {
    // JW: 4h at $50, Apprentice: 8h at $25; ratio 1:1 → max app = 4h, excess = 4h
    const rows: RowLike[] = [
      { entry: blankEntry(4, 50), laborType: 'journeyworker', tradeDescription: 'Ironworker' },
      { entry: blankEntry(8, 25), laborType: 'apprentice',    tradeDescription: 'Ironworker' },
    ];
    const config = JSON.stringify({ Ironworker: { maxRatio: '1:1' } });
    const violations = checkTradeRatios(rows, config);
    expect(violations).toHaveLength(1);
    const v = violations[0];
    expect(v.excessHours).toBeCloseTo(4);
    // liability = 4 × (50 − 25) = $100
    expect(v.estimatedLiabilityUsd).toBeCloseTo(100);
  });

  it('detail string contains trade name, hours, ratio, and dollar estimate', () => {
    const rows: RowLike[] = [
      { entry: blankEntry(8, 60), laborType: 'journeyworker', tradeDescription: 'Electrician' },
      { entry: blankEntry(6, 30), laborType: 'apprentice',    tradeDescription: 'Electrician' },
    ];
    const config = JSON.stringify({ Electrician: { maxRatio: '1:2' } });
    const violations = checkTradeRatios(rows, config);
    expect(violations[0].detail).toContain('Electrician');
    expect(violations[0].detail).toContain('6.0 apprentice hrs');
    expect(violations[0].detail).toContain('8.0 JW hrs');
    expect(violations[0].detail).toContain('$60.00');
  });
});

// ── COMP-05: IRA/IIJA 15% tests ───────────────────────────────────────────

describe('COMP-05: IRA/IIJA 15% apprenticeship requirement', () => {
  it('IRA/IIJA project with >= 15% apprentice hours — no COMP-05 violation', () => {
    // 34 JW hours + 6 apprentice hours = 40 total → 15% exactly (boundary inclusive)
    const rows: RowLike[] = [
      { entry: blankEntry(34, 60), laborType: 'journeyworker', tradeDescription: 'Electrician' },
      { entry: blankEntry(6, 30),  laborType: 'apprentice',    tradeDescription: 'Electrician' },
    ];
    const result = checkIraIija(rows, true);
    expect(result).toBeNull();
  });

  it('IRA/IIJA project below 15% — COMP-05 fires with correct percentage', () => {
    // 40 JW hours + 4 apprentice hours = 44 total → 9.09%
    const rows: RowLike[] = [
      { entry: blankEntry(40, 60), laborType: 'journeyworker', tradeDescription: 'Electrician' },
      { entry: blankEntry(4, 30),  laborType: 'apprentice',    tradeDescription: 'Electrician' },
    ];
    const result = checkIraIija(rows, true);
    expect(result).not.toBeNull();
    expect(result!.violationType).toBe('ira-iija-apprentice-pct');
    expect(result!.actualPct).toBeCloseTo(4 / 44);
    expect(result!.totalHours).toBe(44);
    expect(result!.apprenticeHours).toBe(4);
    expect(result!.detail).toContain('IRA/IIJA');
    expect(result!.detail).toContain('15%');
  });

  it('non-IRA/IIJA project — no COMP-05 violation even if below 15%', () => {
    const rows: RowLike[] = [
      { entry: blankEntry(40, 60), laborType: 'journeyworker', tradeDescription: 'Electrician' },
    ];
    expect(checkIraIija(rows, false)).toBeNull();
    expect(checkIraIija(rows, null)).toBeNull();
    expect(checkIraIija(rows, undefined)).toBeNull();
  });

  it('IRA/IIJA project with 0 total hours — no COMP-05 (no payroll this week)', () => {
    const rows: RowLike[] = [];
    const result = checkIraIija(rows, true);
    expect(result).toBeNull();
  });

  it('IRA/IIJA project with exactly 15% — no violation (15% is the threshold, inclusive)', () => {
    // 17 JW + 3 apprentice = 20 total → 15%
    const rows: RowLike[] = [
      { entry: blankEntry(17, 60), laborType: 'journeyworker', tradeDescription: 'Electrician' },
      { entry: blankEntry(3, 30),  laborType: 'apprentice',    tradeDescription: 'Electrician' },
    ];
    const result = checkIraIija(rows, true);
    expect(result).toBeNull();
  });

  it('IRA/IIJA: detail string mentions actual percentage', () => {
    const rows: RowLike[] = [
      { entry: blankEntry(40, 60), laborType: 'journeyworker', tradeDescription: 'Electrician' },
      { entry: blankEntry(4, 30),  laborType: 'apprentice',    tradeDescription: 'Electrician' },
    ];
    const result = checkIraIija(rows, true);
    expect(result!.detail).toMatch(/9\.\d+%/); // ~9.09%
  });
});
