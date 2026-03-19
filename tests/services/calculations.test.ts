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

  it('DOL Fact Sheet 66E: $2,000 annual cost / 2,000 total hours = $1.00/hr (source cited)', () => {
    // Source: DOL Fact Sheet 66E — https://www.dol.gov/agencies/whd/fact-sheets/66E-DBRA-compliance-fringe-benefit-requirements
    const result = calculateFringeCredit({ annualContributionDollars: 2000, totalAnnualHoursWorked: 2000 });
    expect(result.hourlyFringeCredit).toBe(1.00);
  });

  it('anti-pattern: $2,000 / 1,500 DBA-only hrs would give $1.33 — total hours gives lower correct value', () => {
    // Source: DOL Fact Sheet 66E — dividing by DBA-only hours overstates the credit; ALL hours is required
    const correctResult = calculateFringeCredit({ annualContributionDollars: 2000, totalAnnualHoursWorked: 2000 });
    // anti-pattern: using DBA-only 1,500 hrs gives $1.33 — WRONG
    const wrongResult = calculateFringeCredit({ annualContributionDollars: 2000, totalAnnualHoursWorked: 1500 });
    expect(wrongResult.hourlyFringeCredit).toBeCloseTo(1.3333, 4); // this is the wrong (inflated) value
    expect(correctResult.hourlyFringeCredit).toBe(1.00);           // total hours gives the correct value
    expect(correctResult.hourlyFringeCredit).not.toBe(1.3333);     // regression guard: correct answer is NOT $1.33
  });

  it('$10,000 contribution / 500 total hrs = $20.00/hr', () => {
    const result = calculateFringeCredit({ annualContributionDollars: 10000, totalAnnualHoursWorked: 500 });
    expect(result.hourlyFringeCredit).toBe(20.00);
  });

  it('non-integer result: $1,500 / 2,080 hrs ≈ 0.7212 (toBeCloseTo precision)', () => {
    const result = calculateFringeCredit({ annualContributionDollars: 1500, totalAnnualHoursWorked: 2080 });
    expect(result.hourlyFringeCredit).toBeCloseTo(0.7212, 4);
  });

  it('zero hours guard: returns hourlyFringeCredit: 0', () => {
    const result = calculateFringeCredit({ annualContributionDollars: 5000, totalAnnualHoursWorked: 0 });
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

  it('DOL CWHSSA example: 44 hrs, $22 base, $5 fringe — totalWeeklyCost = $1,232 (source cited)', () => {
    // Source: DOL CWHSSA/FLSA guidance — fringe benefit credit is 1.0x for all hours (straight-time and OT)
    // https://www.dol.gov/agencies/whd/fact-sheets/66D-DBRA-compliance-overtime
    const result = calculateCwhssaOt({ baseRate: 22, fringeRate: 5, totalHoursWorked: 44, overtimeHours: 4 });
    expect(result.totalWeeklyCost).toBe(1232);
  });

  it('DOL CWHSSA component check: straightTimeBasePay=968, overtimePremium=44, totalFringePay=220', () => {
    // Source: DOL CWHSSA/FLSA guidance — 44hrs * $22 = $968; 4hrs * 0.5 * $22 = $44; 44hrs * $5 = $220
    const result = calculateCwhssaOt({ baseRate: 22, fringeRate: 5, totalHoursWorked: 44, overtimeHours: 4 });
    expect(result.straightTimeBasePay).toBe(968);
    expect(result.overtimePremium).toBe(44);
    expect(result.totalFringePay).toBe(220);
  });

  it('anti-pattern: fringe at 1.5x OT would give $1,262 — correct answer is $1,232', () => {
    // Source: DOL CWHSSA/FLSA guidance — fringe is ALWAYS 1.0x, only base gets the 0.5x premium
    // Wrong calculation: (40*22) + (4*22*1.5) + (44*5*1.5 for OT portion) = wrong
    // Another wrong: (40*22) + (4*22*1.5) + (40*5) + (4*5*1.5) = 880 + 132 + 200 + 30 = 1,242 — also wrong
    // Most common anti-pattern: apply 1.5x to fringe for OT hours → (968+44) + (40*5) + (4*5*1.5) = 1012 + 200 + 30 = 1,242
    // The $1,262 anti-pattern: treat fringe as 1.5x for all OT hours → 968 + 44 + (44*5*1.5) = 1012 + 330 = 1342 — another variant
    // Documented anti-pattern: total = (44*22) + (4*22*0.5) + (44*5*1.5) = 968 + 44 + 330 = 1,262 (WRONG — multiplying all fringe by 1.5)
    const result = calculateCwhssaOt({ baseRate: 22, fringeRate: 5, totalHoursWorked: 44, overtimeHours: 4 });
    expect(result.totalWeeklyCost).toBe(1232);
    expect(result.totalWeeklyCost).not.toBe(1262);  // regression guard
  });

  it('exactly 40 hours: overtimePremium === 0, no OT penalty', () => {
    const result = calculateCwhssaOt({ baseRate: 25, fringeRate: 8, totalHoursWorked: 40, overtimeHours: 0 });
    expect(result.overtimePremium).toBe(0);
    expect(result.straightTimeBasePay).toBe(1000);
    expect(result.totalFringePay).toBe(320);
    expect(result.totalWeeklyCost).toBe(1320);
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

  it('SS cap: ytdWages=0 → ficaSS > 0', () => {
    const result = calculateLoadedRate({ ...baseInput, ytdWages: 0 });
    expect(result.ficaSS).toBeGreaterThan(0);
  });

  it('SS cap: ytdWages=176099 → ficaSS > 0', () => {
    const result = calculateLoadedRate({ ...baseInput, ytdWages: 176099 });
    expect(result.ficaSS).toBeGreaterThan(0);
  });

  it('SS cap: ytdWages=176100 → ficaSS === 0 (at cap, SS exhausted)', () => {
    const result = calculateLoadedRate({ ...baseInput, ytdWages: 176100 });
    expect(result.ficaSS).toBe(0);
  });

  it('FUTA cap: annualWages=6999 → futaPerHour > 0', () => {
    const result = calculateLoadedRate({ ...baseInput, annualWages: 6999 });
    expect(result.futaPerHour).toBeGreaterThan(0);
  });

  it('FUTA cap: annualWages=7000 → futaPerHour === 0 (FUTA wage base exhausted)', () => {
    const result = calculateLoadedRate({ ...baseInput, annualWages: 7000 });
    expect(result.futaPerHour).toBe(0);
  });

  it('FUTA cap: annualWages=8000 → futaPerHour === 0 (over cap)', () => {
    const result = calculateLoadedRate({ ...baseInput, annualWages: 8000 });
    expect(result.futaPerHour).toBe(0);
  });

  it('SUTA below wage base → sutaPerHour > 0', () => {
    const result = calculateLoadedRate({ ...baseInput, annualWages: 5000, sutaWageBase: 7000 });
    expect(result.sutaPerHour).toBeGreaterThan(0);
  });

  it('SUTA at/above wage base → sutaPerHour === 0', () => {
    const result = calculateLoadedRate({ ...baseInput, annualWages: 7000, sutaWageBase: 7000 });
    expect(result.sutaPerHour).toBe(0);
  });

  it('totalLoadedRate integrity: equals baseRate + ficaSS + ficaMedicare + futaPerHour + sutaPerHour + fringeCredit', () => {
    const r = calculateLoadedRate({ ...baseInput, ytdWages: 50000, annualWages: 4000 });
    const expected = r.baseRate + r.ficaSS + r.ficaMedicare + r.futaPerHour + r.sutaPerHour + r.fringeCredit;
    expect(r.totalLoadedRate).toBeCloseTo(expected, 10);
  });
});

describe('calculateApprenticeRate', () => {
  it('CALC-03: calculateApprenticeRate — 60% of $22.00 JW rate = $13.20', () => {
    const result = calculateApprenticeRate(22.00, 60);
    expect(result).toBeCloseTo(13.20, 5);
  });

  it('60% of $22.00 = $13.20', () => {
    expect(calculateApprenticeRate(22.00, 60)).toBeCloseTo(13.20, 5);
  });

  it('0% → $0.00 rate', () => {
    expect(calculateApprenticeRate(22.00, 0)).toBe(0);
  });

  it('100% → full journeyworker rate', () => {
    expect(calculateApprenticeRate(22.00, 100)).toBe(22.00);
  });

  it('75% of $20.00 = $15.00', () => {
    expect(calculateApprenticeRate(20.00, 75)).toBe(15.00);
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

  it('5 JWs, ratio 1:3, 2 apprentices → isViolation=true, maxAllowed=1, excess=1 (DOL illustration)', () => {
    // Source: DOL DBA apprentice ratio enforcement — floor(5/3) = 1 max, 2 apprentices = 1 excess
    const result = checkApprenticeRatio({ tradeCode: 'ELEC', journeyworkerCount: 5, apprenticeCount: 2, programRatio: 3 });
    expect(result.isViolation).toBe(true);
    expect(result.maxAllowed).toBe(1);
    expect(result.excess).toBe(1);
  });

  it('3 JWs, ratio 1:3, 1 apprentice → isViolation=false, maxAllowed=1, excess=0 (at limit)', () => {
    const result = checkApprenticeRatio({ tradeCode: 'ELEC', journeyworkerCount: 3, apprenticeCount: 1, programRatio: 3 });
    expect(result.isViolation).toBe(false);
    expect(result.maxAllowed).toBe(1);
    expect(result.excess).toBe(0);
  });

  it('0 JWs, 1 apprentice → isViolation=true, maxAllowed=0, excess=1 (no JWs = no apprentices)', () => {
    const result = checkApprenticeRatio({ tradeCode: 'CARP', journeyworkerCount: 0, apprenticeCount: 1, programRatio: 3 });
    expect(result.isViolation).toBe(true);
    expect(result.maxAllowed).toBe(0);
    expect(result.excess).toBe(1);
  });

  it('0 JWs, 0 apprentices → isViolation=false, maxAllowed=0, excess=0', () => {
    const result = checkApprenticeRatio({ tradeCode: 'CARP', journeyworkerCount: 0, apprenticeCount: 0, programRatio: 3 });
    expect(result.isViolation).toBe(false);
    expect(result.maxAllowed).toBe(0);
    expect(result.excess).toBe(0);
  });

  it('10 JWs, ratio 5, 2 apprentices → isViolation=false, maxAllowed=2, excess=0', () => {
    // floor(10/5) = 2 max allowed; 2 apprentices = exactly at limit, no violation
    const result = checkApprenticeRatio({ tradeCode: 'IRON', journeyworkerCount: 10, apprenticeCount: 2, programRatio: 5 });
    expect(result.isViolation).toBe(false);
    expect(result.maxAllowed).toBe(2);
    expect(result.excess).toBe(0);
  });

  it('excess is never negative: journeyworkerCount=10, apprenticeCount=1, programRatio=3 → excess=0', () => {
    // floor(10/3) = 3 max allowed; 1 apprentice is under limit — excess must be 0, not negative
    const result = checkApprenticeRatio({ tradeCode: 'CARP', journeyworkerCount: 10, apprenticeCount: 1, programRatio: 3 });
    expect(result.excess).toBe(0);
    expect(result.isViolation).toBe(false);
    expect(result.excess).toBeGreaterThanOrEqual(0);
  });
});
