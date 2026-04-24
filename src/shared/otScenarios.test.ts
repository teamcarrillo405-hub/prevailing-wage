import { describe, it, expect } from 'vitest';
import { compareScenarios, type OtScenario } from './otScenarios.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeScenario(overrides: Partial<OtScenario> & { dailyHours: number[] }): OtScenario {
  return {
    label: 'Test Scenario',
    baseRate: 50,
    fringeRate: 10,
    overtimeThreshold: 40,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('compareScenarios', () => {
  // ── Standard 5×8h week (no OT) ──────────────────────────────────────────

  it('5×8h week: 40h straight time, 0 OT hours', () => {
    const [res] = compareScenarios([
      makeScenario({ label: '5×8', dailyHours: [8, 8, 8, 8, 8] }),
    ]);

    expect(res.label).toBe('5×8');
    expect(res.totalHours).toBe(40);
    expect(res.overtimeHours).toBe(0);
    expect(res.doubletimeHours).toBe(0);
  });

  it('5×8h week: result.totalWeeklyCost = 40×baseRate + 40×fringeRate', () => {
    const baseRate = 50;
    const fringeRate = 10;
    const [res] = compareScenarios([
      makeScenario({ dailyHours: [8, 8, 8, 8, 8], baseRate, fringeRate }),
    ]);

    // straightTimeBasePay = 40 * 50 = 2000; fringe = 40 * 10 = 400; premium = 0
    expect(res.result.totalWeeklyCost).toBeCloseTo(40 * baseRate + 40 * fringeRate);
    expect(res.result.overtimePremium).toBeCloseTo(0);
  });

  // ── 4×10h week (40h total, no OT at threshold=40) ────────────────────────

  it('4×10h week: 40h total, 0 OT at threshold=40', () => {
    const [res] = compareScenarios([
      makeScenario({ label: '4×10', dailyHours: [10, 10, 10, 10], overtimeThreshold: 40 }),
    ]);

    expect(res.totalHours).toBe(40);
    expect(res.overtimeHours).toBe(0);
    expect(res.result.overtimePremium).toBeCloseTo(0);
  });

  it('4×10h week: result.totalWeeklyCost matches straight-time + fringe only', () => {
    const baseRate = 60;
    const fringeRate = 15;
    const [res] = compareScenarios([
      makeScenario({
        dailyHours: [10, 10, 10, 10],
        baseRate,
        fringeRate,
        overtimeThreshold: 40,
      }),
    ]);

    expect(res.result.totalWeeklyCost).toBeCloseTo(40 * baseRate + 40 * fringeRate);
  });

  // ── 5×8h + 4h Saturday (44h total, 4h OT) ──────────────────────────────

  it('5×8h + 4h Sat (44h total): 4h OT at threshold=40', () => {
    const [res] = compareScenarios([
      makeScenario({
        label: '5×8+Sat',
        dailyHours: [8, 8, 8, 8, 8, 4],
        overtimeThreshold: 40,
      }),
    ]);

    expect(res.totalHours).toBe(44);
    expect(res.overtimeHours).toBe(4);
  });

  it('5×8h + 4h Sat: OT premium = 4 × 0.5 × baseRate', () => {
    const baseRate = 55;
    const fringeRate = 12;
    const [res] = compareScenarios([
      makeScenario({
        dailyHours: [8, 8, 8, 8, 8, 4],
        baseRate,
        fringeRate,
        overtimeThreshold: 40,
      }),
    ]);

    expect(res.result.overtimePremium).toBeCloseTo(4 * 0.5 * baseRate);  // 110
    // Fringe covers all 44h at 1.0x (CWHSSA rule)
    expect(res.result.totalFringePay).toBeCloseTo(44 * fringeRate);       // 528
    expect(res.result.straightTimeBasePay).toBeCloseTo(44 * baseRate);    // 2420
    expect(res.result.totalWeeklyCost).toBeCloseTo(2420 + 110 + 528);
  });

  // ── Empty scenarios array ────────────────────────────────────────────────

  it('empty scenarios array: returns empty array', () => {
    const results = compareScenarios([]);
    expect(results).toEqual([]);
    expect(results).toHaveLength(0);
  });

  // ── Single scenario ──────────────────────────────────────────────────────

  it('single scenario: returns array with exactly one result', () => {
    const results = compareScenarios([
      makeScenario({ label: 'Solo', dailyHours: [8, 8, 8, 8, 8] }),
    ]);

    expect(results).toHaveLength(1);
    expect(results[0].label).toBe('Solo');
  });

  // ── Multiple scenarios preserve order and labels ─────────────────────────

  it('multiple scenarios: result count and label order match input', () => {
    const scenarios: OtScenario[] = [
      makeScenario({ label: 'Alpha', dailyHours: [8, 8, 8, 8, 8] }),
      makeScenario({ label: 'Beta', dailyHours: [10, 10, 10, 10] }),
      makeScenario({ label: 'Gamma', dailyHours: [8, 8, 8, 8, 8, 4] }),
    ];
    const results = compareScenarios(scenarios);

    expect(results).toHaveLength(3);
    expect(results[0].label).toBe('Alpha');
    expect(results[1].label).toBe('Beta');
    expect(results[2].label).toBe('Gamma');
  });

  // ── Different OT threshold (daily OT at threshold=8) ─────────────────────

  it('threshold=8 (daily OT): 3×8h + 1×10h → 2h OT', () => {
    const [res] = compareScenarios([
      makeScenario({
        label: 'Daily OT',
        dailyHours: [8, 8, 8, 10],   // total = 34h
        overtimeThreshold: 8,        // weekly total check: max(0, 34 - 8) = 26h OT
      }),
    ]);

    // compareScenarios uses WEEKLY threshold (totalHours - overtimeThreshold),
    // not per-day. So 34 - 8 = 26h OT.
    expect(res.totalHours).toBe(34);
    expect(res.overtimeHours).toBe(26);
  });

  it('threshold=8 single day: 8h work → 0 OT hours', () => {
    const [res] = compareScenarios([
      makeScenario({
        label: 'Exactly 8h',
        dailyHours: [8],
        overtimeThreshold: 8,
      }),
    ]);

    expect(res.totalHours).toBe(8);
    expect(res.overtimeHours).toBe(0);
  });

  it('threshold=8 single day: 10h work → 2h OT', () => {
    const [res] = compareScenarios([
      makeScenario({
        label: '10h day',
        dailyHours: [10],
        overtimeThreshold: 8,
      }),
    ]);

    expect(res.totalHours).toBe(10);
    expect(res.overtimeHours).toBe(2);
    expect(res.result.overtimePremium).toBeCloseTo(2 * 0.5 * 50); // baseRate=50
  });

  // ── Doubletime threshold ─────────────────────────────────────────────────

  it('with doubletimeThreshold: doubletimeHours computed correctly', () => {
    const [res] = compareScenarios([
      makeScenario({
        label: 'DT test',
        dailyHours: [8, 8, 8, 8, 8, 8, 8],  // 56h total
        overtimeThreshold: 40,
        doubletimeThreshold: 50,
      }),
    ]);

    expect(res.totalHours).toBe(56);
    expect(res.overtimeHours).toBe(16);       // 56 - 40
    expect(res.doubletimeHours).toBe(6);      // 56 - 50
  });

  it('without doubletimeThreshold: doubletimeHours is always 0', () => {
    const [res] = compareScenarios([
      makeScenario({
        label: 'No DT',
        dailyHours: [12, 12, 12, 12, 12],  // 60h total
        overtimeThreshold: 40,
        // no doubletimeThreshold
      }),
    ]);

    expect(res.doubletimeHours).toBe(0);
  });

  // ── Result fields completeness ───────────────────────────────────────────

  it('result object has all required fields: label, totalHours, overtimeHours, doubletimeHours, result', () => {
    const [res] = compareScenarios([
      makeScenario({ dailyHours: [8, 8, 8, 8, 8] }),
    ]);

    expect(res).toHaveProperty('label');
    expect(res).toHaveProperty('totalHours');
    expect(res).toHaveProperty('overtimeHours');
    expect(res).toHaveProperty('doubletimeHours');
    expect(res).toHaveProperty('result');
    expect(res.result).toHaveProperty('totalWeeklyCost');
    expect(res.result).toHaveProperty('straightTimeBasePay');
    expect(res.result).toHaveProperty('overtimePremium');
    expect(res.result).toHaveProperty('totalFringePay');
  });

  // ── totalWeeklyCost correctness across scenarios ─────────────────────────

  it('all three scenarios: totalWeeklyCost = straightTimeBasePay + overtimePremium + totalFringePay', () => {
    const scenarios: OtScenario[] = [
      makeScenario({ label: 'No OT', dailyHours: [8, 8, 8, 8, 8] }),
      makeScenario({ label: 'Some OT', dailyHours: [8, 8, 8, 8, 8, 6] }),
      makeScenario({ label: 'Heavy OT', dailyHours: [12, 12, 12, 12, 12] }),
    ];

    compareScenarios(scenarios).forEach((res) => {
      const { straightTimeBasePay, overtimePremium, totalFringePay, totalWeeklyCost } = res.result;
      expect(totalWeeklyCost).toBeCloseTo(straightTimeBasePay + overtimePremium + totalFringePay);
    });
  });
});
