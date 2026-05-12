import { describe, it, expect } from 'vitest';
import { calculateCertifiedPayrollPay, calculateCwhssaOt } from './calculations.js';

describe('calculateCwhssaOt', () => {
  // ── Standard 40h week (no OT) ───────────────────────────────────────────

  it('standard 40h week: all hours are straight time, no OT premium', () => {
    const result = calculateCwhssaOt({
      baseRate: 50,
      fringeRate: 10,
      totalHoursWorked: 40,
      overtimeHours: 0,
    });

    expect(result.straightTimeBasePay).toBeCloseTo(2000);   // 40 * 50
    expect(result.overtimePremium).toBeCloseTo(0);          // 0 OT hours
    expect(result.totalFringePay).toBeCloseTo(400);         // 40 * 10
    expect(result.totalWeeklyCost).toBeCloseTo(2400);       // 2000 + 0 + 400
  });

  // ── Week with OT hours ──────────────────────────────────────────────────

  it('45h week (5h OT): premium = 5 × 0.5 × baseRate', () => {
    const baseRate = 60;
    const fringeRate = 12;
    const result = calculateCwhssaOt({
      baseRate,
      fringeRate,
      totalHoursWorked: 45,
      overtimeHours: 5,
    });

    // straightTimeBasePay = totalHours × baseRate (not just 40h)
    expect(result.straightTimeBasePay).toBeCloseTo(45 * baseRate);      // 2700
    // OT premium = 5 × 0.5 × 60 = 150
    expect(result.overtimePremium).toBeCloseTo(5 * 0.5 * baseRate);    // 150
    // Fringe applies to ALL hours at 1.0x — CWHSSA rule
    expect(result.totalFringePay).toBeCloseTo(45 * fringeRate);        // 540
    // Total = 2700 + 150 + 540 = 3390
    expect(result.totalWeeklyCost).toBeCloseTo(2700 + 150 + 540);
  });

  it('totalWeeklyCost equals sum of the three components', () => {
    const result = calculateCwhssaOt({
      baseRate: 45,
      fringeRate: 8,
      totalHoursWorked: 43,
      overtimeHours: 3,
    });

    expect(result.totalWeeklyCost).toBeCloseTo(
      result.straightTimeBasePay + result.overtimePremium + result.totalFringePay,
    );
  });

  // ── Zero hours edge case ────────────────────────────────────────────────

  it('zero hours: all outputs are 0', () => {
    const result = calculateCwhssaOt({
      baseRate: 55,
      fringeRate: 15,
      totalHoursWorked: 0,
      overtimeHours: 0,
    });

    expect(result.straightTimeBasePay).toBe(0);
    expect(result.overtimePremium).toBe(0);
    expect(result.totalFringePay).toBe(0);
    expect(result.totalWeeklyCost).toBe(0);
  });

  // ── High fringe rate: fringe applies to ALL hours at 1.0x ──────────────

  it('high fringe rate: fringe covers ALL hours including OT hours (CWHSSA rule)', () => {
    const fringeRate = 25;
    const totalHoursWorked = 48;
    const overtimeHours = 8;
    const result = calculateCwhssaOt({
      baseRate: 40,
      fringeRate,
      totalHoursWorked,
      overtimeHours,
    });

    // Fringe must equal totalHours × fringeRate, NOT (40 × fringeRate)
    expect(result.totalFringePay).toBeCloseTo(totalHoursWorked * fringeRate); // 1200
    expect(result.totalFringePay).not.toBeCloseTo(40 * fringeRate);           // NOT 1000
  });

  it('high fringe rate: fringe is NOT multiplied for OT hours (stays 1.0x)', () => {
    const result = calculateCwhssaOt({
      baseRate: 30,
      fringeRate: 20,
      totalHoursWorked: 44,
      overtimeHours: 4,
    });

    // fringe = 44 * 20 = 880; OT premium = 4 * 0.5 * 30 = 60; ST = 44 * 30 = 1320
    expect(result.totalFringePay).toBeCloseTo(880);
    expect(result.overtimePremium).toBeCloseTo(60);
  });

  // ── Decimal hours ───────────────────────────────────────────────────────

  it('decimal hours (40.25h, no OT): computes correct straight-time values', () => {
    const baseRate = 52;
    const fringeRate = 11;
    const totalHoursWorked = 40.25;
    const result = calculateCwhssaOt({
      baseRate,
      fringeRate,
      totalHoursWorked,
      overtimeHours: 0,
    });

    expect(result.straightTimeBasePay).toBeCloseTo(40.25 * 52);  // 2093
    expect(result.overtimePremium).toBeCloseTo(0);
    expect(result.totalFringePay).toBeCloseTo(40.25 * 11);        // 442.75
    expect(result.totalWeeklyCost).toBeCloseTo(40.25 * 52 + 0 + 40.25 * 11);
  });

  it('decimal OT hours (41.5h total, 1.5h OT): OT premium uses fractional hours', () => {
    const baseRate = 48;
    const result = calculateCwhssaOt({
      baseRate,
      fringeRate: 9,
      totalHoursWorked: 41.5,
      overtimeHours: 1.5,
    });

    expect(result.overtimePremium).toBeCloseTo(1.5 * 0.5 * baseRate); // 36
  });

  // ── High base rate ──────────────────────────────────────────────────────

  it('high base rate ($150/hr, 42h week, 2h OT): scales correctly', () => {
    const result = calculateCwhssaOt({
      baseRate: 150,
      fringeRate: 30,
      totalHoursWorked: 42,
      overtimeHours: 2,
    });

    expect(result.straightTimeBasePay).toBeCloseTo(42 * 150);    // 6300
    expect(result.overtimePremium).toBeCloseTo(2 * 0.5 * 150);  // 150
    expect(result.totalFringePay).toBeCloseTo(42 * 30);          // 1260
    expect(result.totalWeeklyCost).toBeCloseTo(6300 + 150 + 1260); // 7710
  });

  // ── Low base rate ───────────────────────────────────────────────────────

  it('low base rate ($15/hr, 40h week no OT): minimum wage scenario', () => {
    const result = calculateCwhssaOt({
      baseRate: 15,
      fringeRate: 0,
      totalHoursWorked: 40,
      overtimeHours: 0,
    });

    expect(result.straightTimeBasePay).toBeCloseTo(600);
    expect(result.overtimePremium).toBeCloseTo(0);
    expect(result.totalFringePay).toBeCloseTo(0);
    expect(result.totalWeeklyCost).toBeCloseTo(600);
  });

  // ── Zero fringe rate ───────────────────────────────────────────────────

  it('zero fringe rate: totalFringePay is 0 regardless of hours', () => {
    const result = calculateCwhssaOt({
      baseRate: 55,
      fringeRate: 0,
      totalHoursWorked: 50,
      overtimeHours: 10,
    });

    expect(result.totalFringePay).toBeCloseTo(0);
    expect(result.totalWeeklyCost).toBeCloseTo(
      result.straightTimeBasePay + result.overtimePremium,
    );
  });

  // ── OT premium formula verification ────────────────────────────────────

  it('OT premium uses 0.5× multiplier (half-time supplement, not 1.5×)', () => {
    const baseRate = 80;
    const overtimeHours = 10;
    const result = calculateCwhssaOt({
      baseRate,
      fringeRate: 0,
      totalHoursWorked: 50,
      overtimeHours,
    });

    // The OT premium is the HALF-TIME supplement on top of straight-time base pay
    // (i.e., straight-time base already covers all 50h; premium is 0.5× for OT portion)
    expect(result.overtimePremium).toBeCloseTo(overtimeHours * 0.5 * baseRate); // 400
    // NOT overtimeHours * 1.5 * baseRate
    expect(result.overtimePremium).not.toBeCloseTo(overtimeHours * 1.5 * baseRate);
  });
});

describe('calculateCertifiedPayrollPay', () => {
  it('pays double-time hours with a full extra base-rate premium and fringe at 1x', () => {
    const result = calculateCertifiedPayrollPay({
      baseRate: 40,
      fringeRate: 10,
      straightTimeHours: 8,
      overtimeHours: 4,
      doubleTimeHours: 2,
    });

    expect(result.straightTimeBasePay).toBeCloseTo(14 * 40);
    expect(result.overtimePremium).toBeCloseTo(4 * 0.5 * 40);
    expect(result.doubleTimePremium).toBeCloseTo(2 * 40);
    expect(result.totalFringePay).toBeCloseTo(14 * 10);
    expect(result.totalWeeklyCost).toBeCloseTo(860);
  });
});
