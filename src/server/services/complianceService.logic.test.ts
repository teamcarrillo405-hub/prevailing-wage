// src/server/services/complianceService.logic.test.ts
// Tests for the inline compliance algorithms inside computeCompliance().
// Since computeCompliance() requires DB, the logic is mirrored here as
// pure helpers that exactly replicate the algorithm — same pattern as
// complianceApprenticeRatio.test.ts.

import { describe, it, expect } from 'vitest';

// ── Minimal types ─────────────────────────────────────────────────────────

interface EntryLike {
  id: string;
  workerId: string;
  baseRateSnapshot: number;
  fringeRateSnapshot: number;
  monSt: number; tueSt: number; wedSt: number; thuSt: number;
  friSt: number; satSt: number; sunSt: number;
  monOt: number; tueOt: number; wedOt: number; thuOt: number;
  friOt: number; satOt: number; sunOt: number;
  monDt: number; tueDt: number; wedDt: number; thuDt: number;
  friDt: number; satDt: number; sunDt: number;
  grossWages?: number | null;
  deductions?: number | null;
}

interface RowLike {
  entry: EntryLike;
  workerName: string;
  laborType: 'journeyworker' | 'foreman' | 'apprentice';
  tradeDescription: string;
  programName?: string | null;
  classificationId?: string;
}

type ViolationType =
  | 'under-wage'
  | 'cwhssa-ot'
  | 'weekly-ot'
  | 'multi-classification-ot'
  | 'ca-daily-ot'
  | 'ca-daily-dt'
  | 'apprentice-ratio-daily'
  | 'apprentice-registration';

interface Violation {
  entryId: string;
  workerId: string;
  workerName: string;
  violationType: ViolationType;
  expected: number;
  actual: number;
  delta: number;
}

interface WeekViolation {
  violationType: string;
  detail: string;
  apprenticeHours: number;
  journeyworkerHours: number;
  maxAllowedApprenticeHours: number;
}

// ── Helpers mirroring complianceService.ts exactly ────────────────────────

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type DayKey = typeof DAYS[number];

function hourTotals(e: EntryLike) {
  let st = 0, ot = 0, dt = 0;
  for (const d of DAYS) {
    st += (e[`${d}St` as keyof EntryLike] as number) ?? 0;
    ot += (e[`${d}Ot` as keyof EntryLike] as number) ?? 0;
    dt += (e[`${d}Dt` as keyof EntryLike] as number) ?? 0;
  }
  return { straightTime: st, overtime: ot, doubleTime: dt, total: st + ot + dt };
}

function expectedGross(e: EntryLike): number {
  const { straightTime, overtime, doubleTime } = hourTotals(e);
  const total = straightTime + overtime + doubleTime;
  const stBase = total * e.baseRateSnapshot;
  const otPremium = overtime * 0.5 * e.baseRateSnapshot;
  const dtPremium = doubleTime * e.baseRateSnapshot;
  const fringe = total * e.fringeRateSnapshot;
  return stBase + otPremium + dtPremium + fringe;
}

// Mirrors the NY daily OT block in computeCompliance()
function detectNyOt(rows: RowLike[]): Violation[] {
  const violations: Violation[] = [];
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  for (const row of rows) {
    const e = row.entry;
    const days = [
      { st: e.monSt, ot: e.monOt }, { st: e.tueSt, ot: e.tueOt },
      { st: e.wedSt, ot: e.wedOt }, { st: e.thuSt, ot: e.thuOt },
      { st: e.friSt, ot: e.friOt }, { st: e.satSt, ot: e.satOt },
      { st: e.sunSt, ot: e.sunOt },
    ];
    for (let i = 0; i < days.length; i++) {
      const dayTotal = (days[i].st ?? 0) + (days[i].ot ?? 0);
      if (dayTotal > 8) {
        violations.push({
          entryId: e.id, workerId: e.workerId, workerName: row.workerName,
          violationType: 'cwhssa-ot',
          expected: 8, actual: dayTotal, delta: dayTotal - 8,
        });
      }
    }
  }
  return violations;
}

// Mirrors the CA daily OT/DT block in computeCompliance()
function detectCaDailyViolations(rows: RowLike[]): Violation[] {
  const violations: Violation[] = [];
  for (const row of rows) {
    const e = row.entry;
    const caDays = [
      { st: e.monSt, ot: e.monOt, dt: e.monDt },
      { st: e.tueSt, ot: e.tueOt, dt: e.tueDt },
      { st: e.wedSt, ot: e.wedOt, dt: e.wedDt },
      { st: e.thuSt, ot: e.thuOt, dt: e.thuDt },
      { st: e.friSt, ot: e.friOt, dt: e.friDt },
      { st: e.satSt, ot: e.satOt, dt: e.satDt },
      { st: e.sunSt, ot: e.sunOt, dt: e.sunDt },
    ];
    for (const d of caDays) {
      const st = d.st ?? 0; const ot = d.ot ?? 0; const dt = d.dt ?? 0;
      if (st > 8) {
        violations.push({
          entryId: e.id, workerId: e.workerId, workerName: row.workerName,
          violationType: 'ca-daily-ot',
          expected: 8, actual: st, delta: st - 8,
        });
      }
      if (st + ot > 12 && dt === 0) {
        violations.push({
          entryId: e.id, workerId: e.workerId, workerName: row.workerName,
          violationType: 'ca-daily-dt',
          expected: 12, actual: st + ot, delta: (st + ot) - 12,
        });
      }
    }
  }
  return violations;
}

// Mirrors the federal weekly OT floor block in computeCompliance()
function detectWeeklyOtFloor(rows: RowLike[]): Violation[] {
  const violations: Violation[] = [];
  const workerMap = new Map<string, RowLike[]>();
  for (const row of rows) {
    const grp = workerMap.get(row.entry.workerId) ?? [];
    grp.push(row);
    workerMap.set(row.entry.workerId, grp);
  }

  for (const workerRows of workerMap.values()) {
    const totals = workerRows.map(r => hourTotals(r.entry));
    const totalHours = totals.reduce((s, t) => s + t.total, 0);
    const premiumHours = totals.reduce((s, t) => s + t.overtime + t.doubleTime, 0);
    const requiredOt = Math.max(0, totalHours - 40);
    if (requiredOt <= premiumHours + 0.001) continue;

    const firstRow = workerRows[0];
    const distinctClassifications = new Set(workerRows.map(r => r.classificationId ?? 'default'));
    const weightedNumerator = workerRows.reduce((s, r, i) => s + totals[i].total * r.entry.baseRateSnapshot, 0);
    const weightedBase = totalHours > 0 ? weightedNumerator / totalHours : firstRow.entry.baseRateSnapshot;
    const missingPremium = requiredOt - premiumHours;
    const missingValue = Math.round(missingPremium * 0.5 * weightedBase * 100) / 100;
    const actualGross = workerRows.reduce((s, r) => s + (r.entry.grossWages ?? 0), 0);

    violations.push({
      entryId: firstRow.entry.id,
      workerId: firstRow.entry.workerId,
      workerName: firstRow.workerName,
      violationType: distinctClassifications.size > 1 ? 'multi-classification-ot' : 'weekly-ot',
      expected: Math.round((actualGross + missingValue) * 100) / 100,
      actual: Math.round(actualGross * 100) / 100,
      delta: -missingValue,
    });
  }
  return violations;
}

// Mirrors the COMP-03 daily apprentice ratio block in computeCompliance()
function detectDailyApprenticeRatio(rows: RowLike[]): WeekViolation[] {
  const dayGroups = new Map<DayKey, { journeyworker: number; apprentice: number }>();
  for (const row of rows) {
    const e = row.entry;
    for (const day of DAYS) {
      const dayHours =
        ((e[`${day}St` as keyof EntryLike] as number) ?? 0) +
        ((e[`${day}Ot` as keyof EntryLike] as number) ?? 0) +
        ((e[`${day}Dt` as keyof EntryLike] as number) ?? 0);
      if (dayHours === 0) continue;
      const grp = dayGroups.get(day) ?? { journeyworker: 0, apprentice: 0 };
      if (row.laborType === 'journeyworker' || row.laborType === 'foreman') grp.journeyworker++;
      else if (row.laborType === 'apprentice') grp.apprentice++;
      dayGroups.set(day, grp);
    }
  }

  const violations: WeekViolation[] = [];
  const allowedRatio = 1 / 3;
  for (const [day, grp] of dayGroups) {
    if (grp.journeyworker === 0) continue;
    const ratio = grp.apprentice / grp.journeyworker;
    if (ratio > allowedRatio) {
      violations.push({
        violationType: 'apprentice-ratio-daily',
        detail: `Apprentice ratio exceeded on ${day}: ${grp.apprentice} apprentice(s) to ${grp.journeyworker} journeyworker(s)`,
        apprenticeHours: grp.apprentice,
        journeyworkerHours: grp.journeyworker,
        maxAllowedApprenticeHours: grp.journeyworker * allowedRatio,
      });
    }
  }
  return violations;
}

// Mirrors apprentice-registration check in computeCompliance()
function detectMissingRegistration(rows: RowLike[]): WeekViolation[] {
  const violations: WeekViolation[] = [];
  for (const row of rows) {
    if (row.laborType === 'apprentice' && !row.programName?.trim()) {
      const { total } = hourTotals(row.entry);
      violations.push({
        violationType: 'apprentice-registration',
        detail: `${row.workerName} is entered as an apprentice without a registered apprenticeship program name on the payroll classification.`,
        apprenticeHours: total,
        journeyworkerHours: 0,
        maxAllowedApprenticeHours: 0,
      });
    }
  }
  return violations;
}

// Mirrors the per-entry wage/OT detection block in computeCompliance()
function detectEntryViolations(rows: RowLike[]): Violation[] {
  const violations: Violation[] = [];
  for (const row of rows) {
    const e = row.entry;
    if (e.grossWages == null) continue;
    const { overtime, doubleTime } = hourTotals(e);
    const premiumHours = overtime + doubleTime;
    const expected = expectedGross(e);
    const actual = e.grossWages;
    const delta = actual - expected;

    let type: 'under-wage' | 'cwhssa-ot' | null = null;
    if (Math.abs(delta) > 0.01 && premiumHours > 0) {
      type = 'cwhssa-ot';
    } else if (delta < -0.01) {
      type = 'under-wage';
    }
    if (type) {
      violations.push({
        entryId: e.id, workerId: e.workerId, workerName: row.workerName,
        violationType: type, expected, actual, delta,
      });
    }
  }
  return violations;
}

// ── Factory ───────────────────────────────────────────────────────────────

function makeEntry(id: string, overrides: Partial<EntryLike> = {}): EntryLike {
  return {
    id, workerId: 'w1',
    baseRateSnapshot: 40, fringeRateSnapshot: 8,
    monSt: 0, tueSt: 0, wedSt: 0, thuSt: 0, friSt: 0, satSt: 0, sunSt: 0,
    monOt: 0, tueOt: 0, wedOt: 0, thuOt: 0, friOt: 0, satOt: 0, sunOt: 0,
    monDt: 0, tueDt: 0, wedDt: 0, thuDt: 0, friDt: 0, satDt: 0, sunDt: 0,
    ...overrides,
  };
}

function makeRow(entry: EntryLike, overrides: Partial<Omit<RowLike, 'entry'>> = {}): RowLike {
  return {
    entry,
    workerName: 'John Smith',
    laborType: 'journeyworker',
    tradeDescription: 'Carpenter',
    programName: null,
    ...overrides,
  };
}

// ── NY daily OT (cwhssa-ot) ───────────────────────────────────────────────

describe('NY daily OT — COMP-02 via daily check', () => {
  it('all days ≤ 8h → no violation', () => {
    const row = makeRow(makeEntry('e1', { monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8 }));
    expect(detectNyOt([row])).toHaveLength(0);
  });

  it('exactly 8h on one day → no violation (threshold is exclusive)', () => {
    const row = makeRow(makeEntry('e1', { monSt: 8, monOt: 0 }));
    expect(detectNyOt([row])).toHaveLength(0);
  });

  it('9h on Monday → one cwhssa-ot violation', () => {
    const row = makeRow(makeEntry('e1', { monSt: 8, monOt: 1 }));
    const violations = detectNyOt([row]);
    expect(violations).toHaveLength(1);
    expect(violations[0].violationType).toBe('cwhssa-ot');
    expect(violations[0].actual).toBe(9);
    expect(violations[0].delta).toBe(1);
  });

  it('two days exceed 8h → two violations', () => {
    const row = makeRow(makeEntry('e1', { monSt: 9, tueSt: 10 }));
    expect(detectNyOt([row])).toHaveLength(2);
  });

  it('two workers, one violating → only violating worker fires', () => {
    const ok = makeRow(makeEntry('e1', { monSt: 8 }), { workerName: 'OK' });
    const bad = makeRow(makeEntry('e2', { monSt: 9 }), { workerName: 'Bad' });
    const violations = detectNyOt([ok, bad]);
    expect(violations).toHaveLength(1);
    expect(violations[0].workerName).toBe('Bad');
  });

  it('weekend day >8h → violation (all 7 days checked)', () => {
    const row = makeRow(makeEntry('e1', { sunSt: 10 }));
    expect(detectNyOt([row])).toHaveLength(1);
  });
});

// ── CA daily OT/DT ────────────────────────────────────────────────────────

describe('CA daily OT (ca-daily-ot) — Labor Code §510', () => {
  it('ST ≤ 8 every day → no ca-daily-ot violation', () => {
    const row = makeRow(makeEntry('e1', { monSt: 8, tueSt: 6, wedSt: 4 }));
    const violations = detectCaDailyViolations([row]);
    expect(violations.filter(v => v.violationType === 'ca-daily-ot')).toHaveLength(0);
  });

  it('ST = 9 on one day → ca-daily-ot, delta = 1', () => {
    const row = makeRow(makeEntry('e1', { monSt: 9 }));
    const violations = detectCaDailyViolations([row]);
    const ot = violations.filter(v => v.violationType === 'ca-daily-ot');
    expect(ot).toHaveLength(1);
    expect(ot[0].actual).toBe(9);
    expect(ot[0].delta).toBe(1);
  });

  it('ST = 8 (boundary) → no ca-daily-ot', () => {
    const row = makeRow(makeEntry('e1', { monSt: 8 }));
    const violations = detectCaDailyViolations([row]);
    expect(violations.filter(v => v.violationType === 'ca-daily-ot')).toHaveLength(0);
  });

  it('multiple days with ST > 8 → multiple ca-daily-ot violations', () => {
    const row = makeRow(makeEntry('e1', { monSt: 9, tueSt: 10 }));
    const violations = detectCaDailyViolations([row]);
    expect(violations.filter(v => v.violationType === 'ca-daily-ot')).toHaveLength(2);
  });
});

describe('CA daily DT (ca-daily-dt) — Labor Code §510', () => {
  it('ST + OT ≤ 12 → no ca-daily-dt', () => {
    const row = makeRow(makeEntry('e1', { monSt: 8, monOt: 4 })); // 12 total
    const violations = detectCaDailyViolations([row]);
    expect(violations.filter(v => v.violationType === 'ca-daily-dt')).toHaveLength(0);
  });

  it('ST + OT = 13, DT = 0 → ca-daily-dt fires, delta = 1', () => {
    const row = makeRow(makeEntry('e1', { monSt: 8, monOt: 5, monDt: 0 }));
    const violations = detectCaDailyViolations([row]);
    const dt = violations.filter(v => v.violationType === 'ca-daily-dt');
    expect(dt).toHaveLength(1);
    expect(dt[0].actual).toBe(13);
    expect(dt[0].delta).toBe(1);
  });

  it('ST + OT = 14, DT = 2 → no ca-daily-dt (hours correctly assigned)', () => {
    // Worker already has DT hours filled in — no violation
    const row = makeRow(makeEntry('e1', { monSt: 8, monOt: 4, monDt: 2 }));
    const violations = detectCaDailyViolations([row]);
    expect(violations.filter(v => v.violationType === 'ca-daily-dt')).toHaveLength(0);
  });

  it('ST = 9 on same day → both ca-daily-ot AND ca-daily-dt fire independently', () => {
    // 9 ST + 6 OT → ST violation (9>8) AND total 15 > 12 with DT=0 → DT violation
    const row = makeRow(makeEntry('e1', { monSt: 9, monOt: 6, monDt: 0 }));
    const violations = detectCaDailyViolations([row]);
    expect(violations.some(v => v.violationType === 'ca-daily-ot')).toBe(true);
    expect(violations.some(v => v.violationType === 'ca-daily-dt')).toBe(true);
  });
});

// ── Federal weekly OT floor ───────────────────────────────────────────────

describe('Federal weekly OT floor (CWHSSA §7)', () => {
  it('40h all straight-time → no weekly-ot violation', () => {
    const row = makeRow(makeEntry('e1', {
      monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8,
      baseRateSnapshot: 50, grossWages: 2000,
    }));
    expect(detectWeeklyOtFloor([row])).toHaveLength(0);
  });

  it('44h all ST, no OT buckets → weekly-ot violation for 4 unclaimed OT hours', () => {
    // 40 ST × 5 days + 4 more hours left in ST → should have had 4 OT hours
    const row = makeRow(makeEntry('e1', {
      monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8, satSt: 4,
      baseRateSnapshot: 50, grossWages: 2000,
    }));
    const violations = detectWeeklyOtFloor([row]);
    expect(violations).toHaveLength(1);
    expect(violations[0].violationType).toBe('weekly-ot');
    // missing OT premium = 4 × 0.5 × 50 = 100
    expect(violations[0].delta).toBeCloseTo(-100);
  });

  it('44h with 4h in OT bucket → no weekly-ot (OT already accounted for)', () => {
    const row = makeRow(makeEntry('e1', {
      monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8, satOt: 4,
      baseRateSnapshot: 50, grossWages: 2100,
    }));
    expect(detectWeeklyOtFloor([row])).toHaveLength(0);
  });

  it('two workers both over 40h but OT correctly split → no violation', () => {
    const w1 = makeRow(makeEntry('e1', { monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8, satOt: 4, baseRateSnapshot: 40, grossWages: 1720 }), { entry: makeEntry('e1', { monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8, satOt: 4, baseRateSnapshot: 40, grossWages: 1720, workerId: 'w1' }) });
    const w2 = makeRow(makeEntry('e2', { monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8, satOt: 4, baseRateSnapshot: 40, grossWages: 1720, workerId: 'w2' }), { entry: makeEntry('e2', { monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8, satOt: 4, baseRateSnapshot: 40, grossWages: 1720, workerId: 'w2' }) });
    expect(detectWeeklyOtFloor([w1, w2])).toHaveLength(0);
  });

  it('worker with two classification entries totaling >40h → multi-classification-ot', () => {
    // Two entries for same worker, different classifications, total = 44h all ST
    const e1 = makeEntry('e1', { monSt: 8, tueSt: 8, wedSt: 8, baseRateSnapshot: 50, workerId: 'wA', grossWages: 1200 });
    const e2 = makeEntry('e2', { thuSt: 8, friSt: 8, satSt: 4, baseRateSnapshot: 60, workerId: 'wA', grossWages: 1200 });
    const rows = [
      makeRow(e1, { entry: e1, classificationId: 'cls-A' }),
      makeRow(e2, { entry: e2, classificationId: 'cls-B' }),
    ];
    const violations = detectWeeklyOtFloor(rows);
    expect(violations).toHaveLength(1);
    expect(violations[0].violationType).toBe('multi-classification-ot');
  });
});

// ── COMP-01 and COMP-02 per-entry detection ───────────────────────────────

describe('Per-entry wage and OT violation detection', () => {
  it('gross matches expected → no violation', () => {
    // 40h ST, base=40, fringe=8 → expected = 40*40 + 40*8 = 1920
    const entry = makeEntry('e1', { monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8, baseRateSnapshot: 40, fringeRateSnapshot: 8, grossWages: 1920 });
    expect(detectEntryViolations([makeRow(entry)])).toHaveLength(0);
  });

  it('underpaid by $1 (no OT) → under-wage violation', () => {
    const entry = makeEntry('e1', { monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8, baseRateSnapshot: 40, fringeRateSnapshot: 8, grossWages: 1919 });
    const violations = detectEntryViolations([makeRow(entry)]);
    expect(violations).toHaveLength(1);
    expect(violations[0].violationType).toBe('under-wage');
    expect(violations[0].delta).toBeCloseTo(-1);
  });

  it('underpaid with OT hours present → cwhssa-ot (not under-wage)', () => {
    // 44h (40 ST + 4 OT), wrong gross → OT formula error takes priority
    const entry = makeEntry('e1', {
      monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8, satOt: 4,
      baseRateSnapshot: 40, fringeRateSnapshot: 8,
      grossWages: 1800, // incorrect (correct = 44*40 + 4*0.5*40 + 44*8 = 1760+80+352 = 2192)
    });
    const violations = detectEntryViolations([makeRow(entry)]);
    expect(violations).toHaveLength(1);
    expect(violations[0].violationType).toBe('cwhssa-ot');
  });

  it('overpaid with OT → cwhssa-ot (any delta > 0.01 with OT fires)', () => {
    // More than expected with OT → still flags as formula mismatch
    const entry = makeEntry('e1', {
      monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8, satOt: 4,
      baseRateSnapshot: 40, fringeRateSnapshot: 8,
      grossWages: 3000, // way over expected
    });
    const violations = detectEntryViolations([makeRow(entry)]);
    expect(violations).toHaveLength(1);
    expect(violations[0].violationType).toBe('cwhssa-ot');
  });

  it('grossWages is null → entry skipped, no violation', () => {
    const entry = makeEntry('e1', { monSt: 8, grossWages: null });
    expect(detectEntryViolations([makeRow(entry)])).toHaveLength(0);
  });

  it('within $0.01 rounding tolerance → no violation', () => {
    // expected = 1920.00, actual = 1919.995 → delta = -0.005 → within tolerance
    const entry = makeEntry('e1', { monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8, baseRateSnapshot: 40, fringeRateSnapshot: 8, grossWages: 1919.995 });
    expect(detectEntryViolations([makeRow(entry)])).toHaveLength(0);
  });
});

// ── COMP-03: Daily apprentice ratio (1 per 3 JW) ─────────────────────────

describe('COMP-03: daily apprentice ratio (1:3)', () => {
  function jwRow(day: DayKey, hours: number, id = 'e1', workerId = 'w1'): RowLike {
    const e = makeEntry(id, { [`${day}St`]: hours, workerId });
    return makeRow(e, { laborType: 'journeyworker' });
  }

  function appRow(day: DayKey, hours: number, id = 'e2', workerId = 'w2'): RowLike {
    const e = makeEntry(id, { [`${day}St`]: hours, workerId });
    return makeRow(e, { laborType: 'apprentice' });
  }

  it('no workers → no violation', () => {
    expect(detectDailyApprenticeRatio([])).toHaveLength(0);
  });

  it('only JW workers → no violation', () => {
    const rows = [jwRow('mon', 8), jwRow('mon', 8, 'e3', 'w3')];
    expect(detectDailyApprenticeRatio(rows)).toHaveLength(0);
  });

  it('3 JW + 1 apprentice on same day → no violation (1:3 exactly at limit)', () => {
    const rows = [
      jwRow('mon', 8, 'e1', 'w1'),
      jwRow('mon', 8, 'e2', 'w2'),
      jwRow('mon', 8, 'e3', 'w3'),
      appRow('mon', 8, 'e4', 'w4'),
    ];
    expect(detectDailyApprenticeRatio(rows)).toHaveLength(0);
  });

  it('2 JW + 1 apprentice on same day → violation (1/2 > 1/3)', () => {
    const rows = [
      jwRow('mon', 8, 'e1', 'w1'),
      jwRow('mon', 8, 'e2', 'w2'),
      appRow('mon', 8, 'e3', 'w3'),
    ];
    const violations = detectDailyApprenticeRatio(rows);
    expect(violations).toHaveLength(1);
    expect(violations[0].violationType).toBe('apprentice-ratio-daily');
    expect(violations[0].apprenticeHours).toBe(1); // count of apprentices
    expect(violations[0].journeyworkerHours).toBe(2); // count of JWs
  });

  it('pure-apprentice crew (no JW) → no violation', () => {
    // Only apprentices, no JW → ratio check skips (journeyworker === 0)
    const rows = [appRow('mon', 8, 'e1', 'w1'), appRow('mon', 8, 'e2', 'w2')];
    expect(detectDailyApprenticeRatio(rows)).toHaveLength(0);
  });

  it('workers on different days → each day checked independently', () => {
    // Monday: 1 JW + 1 app → violation; Tuesday: 3 JW + 1 app → ok
    const rows = [
      jwRow('mon', 8, 'e1', 'w1'),
      appRow('mon', 8, 'e2', 'w2'),
      jwRow('tue', 8, 'e3', 'w3'),
      jwRow('tue', 8, 'e4', 'w4'),
      jwRow('tue', 8, 'e5', 'w5'),
      appRow('tue', 8, 'e6', 'w6'),
    ];
    const violations = detectDailyApprenticeRatio(rows);
    expect(violations).toHaveLength(1); // Only Monday fires
    expect(violations[0].detail).toContain('mon');
  });

  it('foreman counted as journeyworker for ratio purposes', () => {
    // 1 foreman + 1 apprentice on Monday: foreman counts as JW → 1/1 > 1/3 → violation
    const foremanEntry = makeEntry('e1', { monSt: 8, workerId: 'w1' });
    const appEntry = makeEntry('e2', { monSt: 8, workerId: 'w2' });
    const rows = [
      makeRow(foremanEntry, { laborType: 'foreman' }),
      makeRow(appEntry, { laborType: 'apprentice' }),
    ];
    const violations = detectDailyApprenticeRatio(rows);
    expect(violations).toHaveLength(1);
  });
});

// ── Apprentice registration check ─────────────────────────────────────────

describe('Apprentice registration check', () => {
  it('apprentice with programName → no violation', () => {
    const entry = makeEntry('e1', { monSt: 8, workerId: 'w1' });
    const row = makeRow(entry, { laborType: 'apprentice', programName: 'ABC Apprenticeship Program' });
    expect(detectMissingRegistration([row])).toHaveLength(0);
  });

  it('apprentice with null programName → apprentice-registration violation', () => {
    const entry = makeEntry('e1', { monSt: 8, workerId: 'w1' });
    const row = makeRow(entry, { laborType: 'apprentice', programName: null, workerName: 'Jane Doe' });
    const violations = detectMissingRegistration([row]);
    expect(violations).toHaveLength(1);
    expect(violations[0].violationType).toBe('apprentice-registration');
    expect(violations[0].detail).toContain('Jane Doe');
    expect(violations[0].apprenticeHours).toBe(8);
  });

  it('apprentice with empty string programName → violation', () => {
    const entry = makeEntry('e1', { monSt: 8 });
    const row = makeRow(entry, { laborType: 'apprentice', programName: '   ' });
    expect(detectMissingRegistration([row])).toHaveLength(1);
  });

  it('journeyworker without programName → no violation (only applies to apprentices)', () => {
    const entry = makeEntry('e1', { monSt: 8 });
    const row = makeRow(entry, { laborType: 'journeyworker', programName: null });
    expect(detectMissingRegistration([row])).toHaveLength(0);
  });

  it('mixed crew: one apprentice missing program, one with program → one violation', () => {
    const e1 = makeEntry('e1', { monSt: 8, workerId: 'w1' });
    const e2 = makeEntry('e2', { monSt: 8, workerId: 'w2' });
    const rows = [
      makeRow(e1, { laborType: 'apprentice', programName: null, workerName: 'No Program' }),
      makeRow(e2, { laborType: 'apprentice', programName: 'JATC Program', workerName: 'Has Program' }),
    ];
    const violations = detectMissingRegistration(rows);
    expect(violations).toHaveLength(1);
    expect(violations[0].detail).toContain('No Program');
  });
});
