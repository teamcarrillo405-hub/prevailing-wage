// src/server/services/complianceRules.test.ts
// Unit tests for all pure functions in complianceRules.ts.
// No DB, no mocks — all functions take plain objects.

import { describe, it, expect } from 'vitest';
import {
  getEntryHourTotals,
  getDayHours,
  expectedGrossForEntry,
  detectDeductionViolations,
  detectDailyTradeApprenticeRatioViolations,
  countComplianceViolations,
  getComplianceViolationBreakdown,
  resolveComplianceProfile,
  type PayrollEntryLike,
  type ComplianceRowLike,
} from './complianceRules.js';

// ── Factories ─────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<PayrollEntryLike> = {}): PayrollEntryLike {
  return {
    id: 'e1',
    workerId: 'w1',
    baseRateSnapshot: 40,
    fringeRateSnapshot: 8,
    monSt: 0, tueSt: 0, wedSt: 0, thuSt: 0, friSt: 0, satSt: 0, sunSt: 0,
    monOt: 0, tueOt: 0, wedOt: 0, thuOt: 0, friOt: 0, satOt: 0, sunOt: 0,
    monDt: 0, tueDt: 0, wedDt: 0, thuDt: 0, friDt: 0, satDt: 0, sunDt: 0,
    grossWages: null,
    deductions: null,
    ...overrides,
  };
}

function makeRow(
  entry: PayrollEntryLike,
  overrides: Partial<Omit<ComplianceRowLike, 'entry'>> = {},
): ComplianceRowLike {
  return {
    entry,
    workerName: 'John Smith',
    tradeDescription: 'Carpenter',
    laborType: 'journeyworker',
    programName: null,
    ...overrides,
  };
}

// ── getEntryHourTotals ────────────────────────────────────────────────────

describe('getEntryHourTotals', () => {
  it('returns all zeros for blank entry', () => {
    const totals = getEntryHourTotals(makeEntry());
    expect(totals.straightTime).toBe(0);
    expect(totals.overtime).toBe(0);
    expect(totals.doubleTime).toBe(0);
    expect(totals.total).toBe(0);
  });

  it('sums straight-time hours across all 7 days', () => {
    const entry = makeEntry({ monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8 });
    const totals = getEntryHourTotals(entry);
    expect(totals.straightTime).toBe(40);
    expect(totals.total).toBe(40);
  });

  it('sums overtime hours across all 7 days', () => {
    const entry = makeEntry({ monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8, satOt: 4 });
    const totals = getEntryHourTotals(entry);
    expect(totals.straightTime).toBe(40);
    expect(totals.overtime).toBe(4);
    expect(totals.total).toBe(44);
  });

  it('sums double-time hours across all 7 days', () => {
    const entry = makeEntry({ monSt: 8, monOt: 4, monDt: 2 });
    const totals = getEntryHourTotals(entry);
    expect(totals.straightTime).toBe(8);
    expect(totals.overtime).toBe(4);
    expect(totals.doubleTime).toBe(2);
    expect(totals.total).toBe(14);
  });

  it('treats null day values as 0', () => {
    const entry = makeEntry({ monSt: null as unknown as number, tueSt: 8 });
    const totals = getEntryHourTotals(entry);
    expect(totals.straightTime).toBe(8);
    expect(totals.total).toBe(8);
  });

  it('includes weekend hours (sat/sun)', () => {
    const entry = makeEntry({ satSt: 6, sunSt: 4 });
    const totals = getEntryHourTotals(entry);
    expect(totals.straightTime).toBe(10);
  });
});

// ── getDayHours ───────────────────────────────────────────────────────────

describe('getDayHours', () => {
  it('returns correct hours for a specific day', () => {
    const entry = makeEntry({ wedSt: 8, wedOt: 2, wedDt: 0, monSt: 4 });
    const day = getDayHours(entry, 'wed');
    expect(day.straightTime).toBe(8);
    expect(day.overtime).toBe(2);
    expect(day.doubleTime).toBe(0);
    expect(day.total).toBe(10);
  });

  it('returns 0 for a day with no hours', () => {
    const entry = makeEntry({ monSt: 8 });
    const day = getDayHours(entry, 'tue');
    expect(day.total).toBe(0);
  });

  it('treats null values as 0', () => {
    const entry = makeEntry({ friSt: null as unknown as number });
    const day = getDayHours(entry, 'fri');
    expect(day.total).toBe(0);
  });
});

// ── expectedGrossForEntry ─────────────────────────────────────────────────

describe('expectedGrossForEntry', () => {
  it('standard 40h week: base × 40 + fringe × 40', () => {
    // base=40, fringe=8, 5×8h ST days
    const entry = makeEntry({
      monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8,
      baseRateSnapshot: 40,
      fringeRateSnapshot: 8,
    });
    // expected = (40×40) + 0 + (8×40) = 1600 + 320 = 1920
    expect(expectedGrossForEntry(entry)).toBeCloseTo(1920);
  });

  it('44h week with 4h OT: CWHSSA fringe flat, OT premium = 0.5×base×OT hours', () => {
    // 40 ST + 4 OT; base=60, fringe=10
    const entry = makeEntry({
      monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8, satOt: 4,
      baseRateSnapshot: 60,
      fringeRateSnapshot: 10,
    });
    // straightTime base = 44×60 = 2640
    // OT premium = 4×0.5×60 = 120
    // fringe = 44×10 = 440 (flat, NOT doubled for OT)
    expect(expectedGrossForEntry(entry)).toBeCloseTo(2640 + 120 + 440);
  });

  it('double-time week: DT premium = base × DT hours', () => {
    const entry = makeEntry({
      monSt: 8, monOt: 4, monDt: 2,
      baseRateSnapshot: 50,
      fringeRateSnapshot: 5,
    });
    // total=14h, ST base = 14×50=700, OT premium=4×0.5×50=100, DT premium=2×50=100, fringe=14×5=70
    expect(expectedGrossForEntry(entry)).toBeCloseTo(700 + 100 + 100 + 70);
  });

  it('zero hours entry returns 0', () => {
    const entry = makeEntry({ baseRateSnapshot: 50, fringeRateSnapshot: 10 });
    expect(expectedGrossForEntry(entry)).toBe(0);
  });
});

// ── detectDeductionViolations ─────────────────────────────────────────────

describe('detectDeductionViolations — 29 CFR §3.5 30% cap', () => {
  it('no deductions → no violation', () => {
    const row = makeRow(makeEntry({ grossWages: 1000, deductions: 0 }));
    expect(detectDeductionViolations([row])).toHaveLength(0);
  });

  it('null deductions → no violation', () => {
    const row = makeRow(makeEntry({ grossWages: 1000, deductions: null }));
    expect(detectDeductionViolations([row])).toHaveLength(0);
  });

  it('non-tax deductions at 30% exact → no violation (cap is exclusive)', () => {
    // 300 non-tax / 1000 gross = 30% exactly → no violation
    const row = makeRow(makeEntry({ grossWages: 1000, deductions: 300 }));
    expect(detectDeductionViolations([row])).toHaveLength(0);
  });

  it('non-tax deductions above 30% → violation fires', () => {
    // 350 / 1000 = 35% → violation
    const row = makeRow(makeEntry({ grossWages: 1000, deductions: 350 }));
    const violations = detectDeductionViolations([row]);
    expect(violations).toHaveLength(1);
    expect(violations[0].violationType).toBe('deduction-ratio');
    expect(violations[0].deductionPct).toBeCloseTo(35);
  });

  it('statutory taxes excluded from cap — FICA + income tax reduces non-tax amount', () => {
    // gross=1000, total deductions=400 but 200 is FICA+taxes → non-tax = 200 = 20% → no violation
    const entry = makeEntry({
      grossWages: 1000,
      deductions: 400,
    });
    // Simulate statutory tax fields on the entry
    (entry as Record<string, unknown>)['ficaTax'] = 100;
    (entry as Record<string, unknown>)['federalIncomeTax'] = 60;
    (entry as Record<string, unknown>)['stateIncomeTax'] = 40;
    const row = makeRow(entry);
    expect(detectDeductionViolations([row])).toHaveLength(0);
  });

  it('statutory taxes excluded — remaining non-tax still exceeds 30%', () => {
    // gross=1000, total=600, taxes=100 → non-tax=500 = 50% → violation
    const entry = makeEntry({ grossWages: 1000, deductions: 600 });
    (entry as Record<string, unknown>)['ficaTax'] = 100;
    const row = makeRow(entry);
    const violations = detectDeductionViolations([row]);
    expect(violations).toHaveLength(1);
    expect(violations[0].deductionPct).toBeCloseTo(50);
  });

  it('grossWages is null → no violation (guard against division)', () => {
    const row = makeRow(makeEntry({ grossWages: null, deductions: 500 }));
    expect(detectDeductionViolations([row])).toHaveLength(0);
  });

  it('grossWages is 0 → no violation (division guard)', () => {
    const row = makeRow(makeEntry({ grossWages: 0, deductions: 100 }));
    expect(detectDeductionViolations([row])).toHaveLength(0);
  });

  it('violation contains correct worker info', () => {
    const entry = makeEntry({ grossWages: 1000, deductions: 400, workerId: 'w99' });
    const row = makeRow(entry, { workerName: 'Jane Doe' });
    const violations = detectDeductionViolations([row]);
    expect(violations[0].workerId).toBe('w99');
    expect(violations[0].workerName).toBe('Jane Doe');
    expect(violations[0].grossWages).toBe(1000);
    expect(violations[0].deductions).toBe(400);
  });

  it('multiple workers — only violating ones returned', () => {
    const ok = makeRow(makeEntry({ grossWages: 1000, deductions: 200 }), { workerName: 'OK Worker' });
    const bad = makeRow(makeEntry({ grossWages: 1000, deductions: 400 }), { workerName: 'Bad Worker' });
    const violations = detectDeductionViolations([ok, bad]);
    expect(violations).toHaveLength(1);
    expect(violations[0].workerName).toBe('Bad Worker');
  });
});

// ── detectDailyTradeApprenticeRatioViolations ─────────────────────────────

describe('detectDailyTradeApprenticeRatioViolations (COMP-04)', () => {
  function jwRow(monSt: number, rate: number, trade = 'Electrician'): ComplianceRowLike {
    return makeRow(makeEntry({ monSt, baseRateSnapshot: rate }), {
      laborType: 'journeyworker',
      tradeDescription: trade,
    });
  }

  function appRow(monSt: number, rate: number, trade = 'Electrician'): ComplianceRowLike {
    return makeRow(makeEntry({ monSt, baseRateSnapshot: rate }), {
      laborType: 'apprentice',
      tradeDescription: trade,
    });
  }

  it('no rows → no violations', () => {
    expect(detectDailyTradeApprenticeRatioViolations([], { Electrician: { maxRatio: '1:3' } })).toHaveLength(0);
  });

  it('only JW hours, no apprentice → no violation', () => {
    const rows = [jwRow(8, 60)];
    expect(detectDailyTradeApprenticeRatioViolations(rows, { Electrician: { maxRatio: '1:3' } })).toHaveLength(0);
  });

  it('only apprentice hours, no JW → no violation (pure-apprentice crew valid)', () => {
    const rows = [appRow(8, 30)];
    expect(detectDailyTradeApprenticeRatioViolations(rows, { Electrician: { maxRatio: '1:3' } })).toHaveLength(0);
  });

  it('1:3 ratio satisfied: 1 app hour vs 3 JW hours → no violation', () => {
    // JW: 3h, App: 1h → 1/3 ≤ 1/3
    const rows = [jwRow(3, 60), appRow(1, 30)];
    expect(detectDailyTradeApprenticeRatioViolations(rows, { Electrician: { maxRatio: '1:3' } })).toHaveLength(0);
  });

  it('1:3 ratio exceeded: 2 app hours vs 3 JW hours → violation', () => {
    // JW: 3h, App: 2h → 2 > 3*(1/3)=1 → excess 1h
    const rows = [jwRow(3, 60), appRow(2, 30)];
    const violations = detectDailyTradeApprenticeRatioViolations(rows, { Electrician: { maxRatio: '1:3' } });
    expect(violations).toHaveLength(1);
    expect(violations[0].violationType).toBe('apprentice-trade-ratio');
    expect(violations[0].trade).toBe('Electrician');
    expect(violations[0].excessHours).toBeCloseTo(1);
    // liability = 1 excess hour × (60 - 30) = $30
    expect(violations[0].estimatedLiabilityUsd).toBeCloseTo(30);
  });

  it('1:2 ratio boundary: 4 app hours vs 8 JW hours → no violation (at limit)', () => {
    const rows = [jwRow(8, 60), appRow(4, 30)];
    expect(detectDailyTradeApprenticeRatioViolations(rows, { Electrician: { maxRatio: '1:2' } })).toHaveLength(0);
  });

  it('trade name matching is case-insensitive and partial', () => {
    // Config key is 'electrician' (lowercase), row has 'Electrician' (title case)
    const rows = [jwRow(8, 60, 'Electrician'), appRow(6, 30, 'Electrician')];
    const violations = detectDailyTradeApprenticeRatioViolations(rows, { electrician: { maxRatio: '1:2' } });
    expect(violations).toHaveLength(1);
  });

  it('unconfigured trade — no violation fired', () => {
    const rows = [jwRow(8, 60, 'Plumber'), appRow(8, 30, 'Plumber')];
    const violations = detectDailyTradeApprenticeRatioViolations(rows, { Electrician: { maxRatio: '1:2' } });
    expect(violations).toHaveLength(0);
  });

  it('violation detail string includes trade, hours, ratio, and dollar amount', () => {
    const rows = [jwRow(8, 60), appRow(6, 30)];
    const violations = detectDailyTradeApprenticeRatioViolations(rows, { Electrician: { maxRatio: '1:2' } });
    expect(violations[0].detail).toContain('Electrician');
    expect(violations[0].detail).toContain('6.0 apprentice hrs');
    expect(violations[0].detail).toContain('8.0 JW hrs');
  });

  it('multiple days — violation per day when ratio exceeded on each', () => {
    // Monday: JW 4h, App 6h → violation; Tuesday: JW 8h, App 2h → ok (2 ≤ 8*(1/2)=4)
    const jwEntry = makeEntry({ monSt: 4, tueSt: 8, baseRateSnapshot: 60 });
    const appEntry = makeEntry({ monSt: 6, tueSt: 2, baseRateSnapshot: 30 });
    const rows = [
      makeRow(jwEntry, { laborType: 'journeyworker', tradeDescription: 'Plumber' }),
      makeRow(appEntry, { laborType: 'apprentice', tradeDescription: 'Plumber' }),
    ];
    const violations = detectDailyTradeApprenticeRatioViolations(rows, { Plumber: { maxRatio: '1:2' } });
    expect(violations).toHaveLength(1); // Only Monday fires
  });
});

// ── countComplianceViolations ─────────────────────────────────────────────

describe('countComplianceViolations', () => {
  it('empty result → 0', () => {
    expect(countComplianceViolations({ violations: [], weekViolations: [], deductionViolations: [] })).toBe(0);
  });

  it('counts wage violations only', () => {
    expect(countComplianceViolations({
      violations: [{ violationType: 'under-wage' }, { violationType: 'cwhssa-ot' }],
      weekViolations: [],
    })).toBe(2);
  });

  it('counts week violations only', () => {
    expect(countComplianceViolations({
      violations: [],
      weekViolations: [{ violationType: 'apprentice-ratio' }],
    })).toBe(1);
  });

  it('counts deduction violations when provided', () => {
    expect(countComplianceViolations({
      violations: [],
      weekViolations: [],
      deductionViolations: [{ violationType: 'deduction-ratio' }, { violationType: 'deduction-ratio' }],
    })).toBe(2);
  });

  it('deductionViolations undefined → treated as 0', () => {
    expect(countComplianceViolations({
      violations: [{ violationType: 'under-wage' }],
      weekViolations: [],
    })).toBe(1);
  });

  it('sums all three categories', () => {
    expect(countComplianceViolations({
      violations: [{ violationType: 'under-wage' }, { violationType: 'cwhssa-ot' }],
      weekViolations: [{ violationType: 'apprentice-ratio' }],
      deductionViolations: [{ violationType: 'deduction-ratio' }],
    })).toBe(4);
  });
});

// ── getComplianceViolationBreakdown ───────────────────────────────────────

describe('getComplianceViolationBreakdown', () => {
  it('empty result → all zeros', () => {
    const breakdown = getComplianceViolationBreakdown({
      violations: [],
      weekViolations: [],
      deductionViolations: [],
    });
    expect(breakdown.wage).toBe(0);
    expect(breakdown.week).toBe(0);
    expect(breakdown.deduction).toBe(0);
    expect(breakdown.total).toBe(0);
    expect(breakdown.byType).toEqual({});
  });

  it('byType counts each violation type correctly', () => {
    const breakdown = getComplianceViolationBreakdown({
      violations: [
        { violationType: 'under-wage' },
        { violationType: 'under-wage' },
        { violationType: 'cwhssa-ot' },
      ],
      weekViolations: [{ violationType: 'apprentice-ratio' }],
      deductionViolations: [{ violationType: 'deduction-ratio' }],
    });
    expect(breakdown.byType['under-wage']).toBe(2);
    expect(breakdown.byType['cwhssa-ot']).toBe(1);
    expect(breakdown.byType['apprentice-ratio']).toBe(1);
    expect(breakdown.byType['deduction-ratio']).toBe(1);
  });

  it('wage count = violations.length', () => {
    const breakdown = getComplianceViolationBreakdown({
      violations: [{ violationType: 'under-wage' }, { violationType: 'weekly-ot' }],
      weekViolations: [],
    });
    expect(breakdown.wage).toBe(2);
  });

  it('week count = weekViolations.length', () => {
    const breakdown = getComplianceViolationBreakdown({
      violations: [],
      weekViolations: [
        { violationType: 'apprentice-ratio' },
        { violationType: 'ira-iija-apprentice-pct' },
      ],
    });
    expect(breakdown.week).toBe(2);
  });

  it('total equals wage + week + deduction', () => {
    const breakdown = getComplianceViolationBreakdown({
      violations: [{ violationType: 'under-wage' }],
      weekViolations: [{ violationType: 'apprentice-ratio' }],
      deductionViolations: [{ violationType: 'deduction-ratio' }],
    });
    expect(breakdown.total).toBe(breakdown.wage + breakdown.week + breakdown.deduction);
    expect(breakdown.total).toBe(3);
  });
});

// ── resolveComplianceProfile ──────────────────────────────────────────────

describe('resolveComplianceProfile', () => {
  it('federal Davis-Bacon contract → federal-dbra-cwhssa', () => {
    const profile = resolveComplianceProfile({ contractType: 'federal-davis-bacon', state: 'TX' });
    expect(profile.id).toBe('federal-dbra-cwhssa');
  });

  it('federal funding type → federal-dbra-cwhssa', () => {
    const profile = resolveComplianceProfile({ fundingType: 'federal', state: 'NY' });
    expect(profile.id).toBe('federal-dbra-cwhssa');
  });

  it('CA + federal Davis-Bacon → mixed-federal-state', () => {
    const profile = resolveComplianceProfile({ contractType: 'federal-davis-bacon', state: 'CA' });
    expect(profile.id).toBe('mixed-federal-state');
  });

  it('CA + mixed funding → mixed-federal-state', () => {
    const profile = resolveComplianceProfile({ fundingType: 'mixed', state: 'CA' });
    expect(profile.id).toBe('mixed-federal-state');
  });

  it('CA state-only (no federal) → california-public-works', () => {
    const profile = resolveComplianceProfile({ state: 'CA', contractType: 'state-prevailing' });
    expect(profile.id).toBe('california-public-works');
  });

  it('state-prevailing contract type → state-prevailing', () => {
    const profile = resolveComplianceProfile({ contractType: 'state-prevailing', state: 'WA' });
    expect(profile.id).toBe('state-prevailing');
  });

  it('no contract type, no state → private-advisory (default)', () => {
    const profile = resolveComplianceProfile({});
    expect(profile.id).toBe('private-advisory');
  });

  it('profile has label, checks, and primarySources', () => {
    const profile = resolveComplianceProfile({ contractType: 'federal-davis-bacon' });
    expect(profile.label).toBeTruthy();
    expect(profile.checks.length).toBeGreaterThan(0);
    expect(Array.isArray(profile.primarySources)).toBe(true);
  });
});
