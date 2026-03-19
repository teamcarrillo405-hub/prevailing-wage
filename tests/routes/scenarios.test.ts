import { describe, it, expect } from 'vitest';
import { compareScenarios } from '../../src/server/services/otCalculator.js';
import type { OtScenario } from '../../src/server/services/otCalculator.js';

describe('OT scenario comparison', () => {
  it('compareScenarios with two schedules returns cost for each', () => {
    const scenarios: OtScenario[] = [
      { label: '5x8h', dailyHours: [8, 8, 8, 8, 8], baseRate: 30, fringeRate: 10, overtimeThreshold: 40 },
      { label: '4x10h', dailyHours: [10, 10, 10, 10], baseRate: 30, fringeRate: 10, overtimeThreshold: 40 },
    ];
    const results = compareScenarios(scenarios);
    expect(results.length).toBe(2);
    expect(results[0].label).toBe('5x8h');
    expect(results[1].label).toBe('4x10h');
    // Both reach exactly 40h — CwhssaOtResult shape must be present
    expect(results[0].result).toHaveProperty('straightTimeBasePay');
    expect(results[0].result).toHaveProperty('overtimePremium');
    expect(results[0].result).toHaveProperty('totalFringePay');
    expect(results[0].result).toHaveProperty('totalWeeklyCost');
  });

  it('5x8h schedule total cost equals calculateCwhssaOt with 40h and 0 OT hours', () => {
    const results = compareScenarios([
      { label: '5x8h', dailyHours: [8, 8, 8, 8, 8], baseRate: 30, fringeRate: 10, overtimeThreshold: 40 },
    ]);
    const r = results[0];
    expect(r.totalHours).toBe(40);
    expect(r.overtimeHours).toBe(0);
    expect(r.result.overtimePremium).toBe(0);
    expect(r.result.straightTimeBasePay).toBeCloseTo(40 * 30);  // 1200
    expect(r.result.totalFringePay).toBeCloseTo(40 * 10);       // 400
    expect(r.result.totalWeeklyCost).toBeCloseTo(40 * 30 + 40 * 10); // 1600
  });

  it('4x10h schedule total cost equals calculateCwhssaOt with 40h and 0 OT hours', () => {
    const results = compareScenarios([
      { label: '4x10h', dailyHours: [10, 10, 10, 10], baseRate: 30, fringeRate: 10, overtimeThreshold: 40 },
    ]);
    const r = results[0];
    expect(r.totalHours).toBe(40);
    expect(r.overtimeHours).toBe(0);
    expect(r.result.overtimePremium).toBe(0);
    expect(r.result.straightTimeBasePay).toBeCloseTo(40 * 30);  // 1200
    expect(r.result.totalFringePay).toBeCloseTo(40 * 10);       // 400
    expect(r.result.totalWeeklyCost).toBeCloseTo(1600);
  });

  it('5x8h+4h schedule applies OT premium to 4 hours only — fringe stays 1.0x for ALL hours', () => {
    // [8,8,8,8,8,4] = 44h total; 4h OT; CWHSSA fringe at 1.0x all 44h
    const results = compareScenarios([
      {
        label: '5x8h+Sat4h',
        dailyHours: [8, 8, 8, 8, 8, 4],
        baseRate: 30,
        fringeRate: 10,
        overtimeThreshold: 40,
      },
    ]);
    const r = results[0];
    expect(r.totalHours).toBe(44);
    expect(r.overtimeHours).toBe(4);
    // OT premium: 4 * 0.5 * 30 = 60 (base only, NOT fringe * 1.5)
    expect(r.result.overtimePremium).toBeCloseTo(4 * 0.5 * 30); // 60
    // Fringe: 44 * 10 = 440 (1.0x for ALL hours — CWHSSA compliance)
    expect(r.result.totalFringePay).toBeCloseTo(44 * 10); // 440 — NOT 40*10 + 4*15
    // Straight time: 44 * 30 = 1320
    expect(r.result.straightTimeBasePay).toBeCloseTo(44 * 30); // 1320
    // Total: 1320 + 60 + 440 = 1820
    expect(r.result.totalWeeklyCost).toBeCloseTo(1820);
  });
});
