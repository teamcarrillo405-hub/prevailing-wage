import {
  calculateFringeCredit,
  calculateCwhssaOt,
  calculateLoadedRate,
  checkApprenticeRatio,
  calculateApprenticeRate,
} from '../../src/server/services/calculations.js';

describe('calculateFringeCredit', () => {
  it('CALC-01: DOL Fact Sheet 66E — $2,000 / 2,000 hrs = $1.00/hr fringe credit', () => {
    const result = calculateFringeCredit({ annualContributionDollars: 2000, totalAnnualHoursWorked: 2000 });
    expect(result.hourlyFringeCredit).toBe(1.00);
  });

  it('CALC-01: total hours denominator — using DBA-only 1,500 hrs would give $1.33 (wrong)', () => {
    // Verify the correct answer uses ALL hours (2000), not DBA-only hours (1500)
    const correct = calculateFringeCredit({ annualContributionDollars: 2000, totalAnnualHoursWorked: 2000 });
    const wrong = calculateFringeCredit({ annualContributionDollars: 2000, totalAnnualHoursWorked: 1500 });
    expect(correct.hourlyFringeCredit).toBe(1.00);
    expect(wrong.hourlyFringeCredit).toBeCloseTo(1.3333, 4);
    expect(correct.hourlyFringeCredit).not.toBe(wrong.hourlyFringeCredit);
  });

  it('CALC-01: zero hours input returns 0 credit (guard clause)', () => {
    const result = calculateFringeCredit({ annualContributionDollars: 2000, totalAnnualHoursWorked: 0 });
    expect(result.hourlyFringeCredit).toBe(0);
  });
});

describe('calculateCwhssaOt', () => {
  it('CWHSSA: DOL worked example — 44 hrs, $22 base, $5 fringe = $1,232 total', () => {
    const result = calculateCwhssaOt({ baseRate: 22, fringeRate: 5, totalHoursWorked: 44, overtimeHours: 4 });
    expect(result.straightTimeBasePay).toBe(968.00);
    expect(result.overtimePremium).toBe(44.00);
    expect(result.totalFringePay).toBe(220.00);
    expect(result.totalWeeklyCost).toBe(1232.00);
  });

  it('CWHSSA: fringe at 1.0x for all hours — NOT 1.5x for OT hours', () => {
    const result = calculateCwhssaOt({ baseRate: 22, fringeRate: 5, totalHoursWorked: 44, overtimeHours: 4 });
    // If fringe were at 1.5x for OT hours: (40 * 5) + (4 * 5 * 1.5) = 200 + 30 = 230 (WRONG)
    // Correct: 44 * 5 = 220
    expect(result.totalFringePay).toBe(220.00);
    expect(result.totalFringePay).not.toBe(230.00);
  });

  it('CWHSSA: zero OT hours (40hr week) produces no overtime premium', () => {
    const result = calculateCwhssaOt({ baseRate: 22, fringeRate: 5, totalHoursWorked: 40, overtimeHours: 0 });
    expect(result.overtimePremium).toBe(0);
    expect(result.straightTimeBasePay).toBe(880.00);
    expect(result.totalFringePay).toBe(200.00);
    expect(result.totalWeeklyCost).toBe(1080.00);
  });
});

describe('calculateLoadedRate', () => {
  const baseInput = {
    baseRate: 22.00,
    hourlyFringeCredit: 5.00,
    ytdWages: 0,
    annualWages: 5000,
    annualHours: 2000,
    futaEffectiveRate: 0.006,
    sutaRate: 0.034,
    sutaWageBase: 7000,
  };

  it('CALC-02: loaded rate sums base + ficaSS + ficaMedicare + futaPerHour + sutaPerHour + fringe', () => {
    const result = calculateLoadedRate(baseInput);
    const expected = result.baseRate + result.ficaSS + result.ficaMedicare +
      result.futaPerHour + result.sutaPerHour + result.fringeCredit;
    expect(result.totalLoadedRate).toBeCloseTo(expected, 5);
  });

  it('CALC-02: ficaSS = 0 when ytdWages >= $176,100 (SS wage base cap)', () => {
    const result = calculateLoadedRate({ ...baseInput, ytdWages: 176100 });
    expect(result.ficaSS).toBe(0);
  });

  it('CALC-02: futaPerHour = 0 when annualWages >= $7,000 (FUTA wage base cap)', () => {
    const result = calculateLoadedRate({ ...baseInput, annualWages: 7000 });
    expect(result.futaPerHour).toBe(0);
  });

  it('CALC-02: FUTA uses min(annualWages, 7000) not flat percentage of all wages', () => {
    // annualWages=5000 is below 7000 cap — FUTA applies only to 5000
    const result = calculateLoadedRate({ ...baseInput, annualWages: 5000 });
    const expectedFuta = (Math.min(5000, 7000) * 0.006) / 2000;
    expect(result.futaPerHour).toBeCloseTo(expectedFuta, 5);
    // annualWages=8000 is over 7000 cap — FUTA exhausted, 0
    const result2 = calculateLoadedRate({ ...baseInput, annualWages: 8000 });
    expect(result2.futaPerHour).toBe(0);
  });
});

describe('calculateApprenticeRate', () => {
  it('CALC-03: calculateApprenticeRate — 60% of $22.00 JW rate = $13.20', () => {
    const result = calculateApprenticeRate(22.00, 60);
    expect(result).toBeCloseTo(13.20, 5);
  });
});

describe('checkApprenticeRatio', () => {
  it('CALC-04: 5 JWs, ratio 1:3, 2 apprentices → violation (maxAllowed=1, excess=1)', () => {
    const result = checkApprenticeRatio({ journeyworkerCount: 5, apprenticeCount: 2, programRatio: 3, tradeCode: 'CARP' });
    expect(result.isViolation).toBe(true);
    expect(result.maxAllowed).toBe(1);
    expect(result.excess).toBe(1);
  });

  it('CALC-04: 3 JWs, ratio 1:3, 1 apprentice → no violation (exactly at limit)', () => {
    const result = checkApprenticeRatio({ journeyworkerCount: 3, apprenticeCount: 1, programRatio: 3, tradeCode: 'CARP' });
    expect(result.isViolation).toBe(false);
    expect(result.maxAllowed).toBe(1);
    expect(result.excess).toBe(0);
  });

  it('CALC-04: 0 JWs, any apprentices → violation (no JWs means no apprentices allowed)', () => {
    const result = checkApprenticeRatio({ journeyworkerCount: 0, apprenticeCount: 1, programRatio: 3, tradeCode: 'CARP' });
    expect(result.isViolation).toBe(true);
    expect(result.maxAllowed).toBe(0);
    expect(result.excess).toBe(1);
  });
});
