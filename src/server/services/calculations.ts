// src/server/services/calculations.ts
// ALL functions are pure — no imports from db, no getDb(), no HTTP

// ---- CALC-01: Fringe benefit annualization ----

export interface FringeCreditInput {
  annualContributionDollars: number; // total dollars paid into benefit plans per year
  totalAnnualHoursWorked: number;    // ALL hours: Davis-Bacon + non-DB combined
}

export interface FringeCreditResult {
  hourlyFringeCredit: number; // full-precision; round only at display layer
}

export function calculateFringeCredit(input: FringeCreditInput): FringeCreditResult {
  const { annualContributionDollars, totalAnnualHoursWorked } = input;
  if (totalAnnualHoursWorked <= 0) {
    return { hourlyFringeCredit: 0 };
  }
  return {
    hourlyFringeCredit: annualContributionDollars / totalAnnualHoursWorked,
  };
}

// ---- CWHSSA OT (consumed by Phase 4; validated in Phase 3) ----

export interface CwhssaOtInput {
  baseRate: number;         // prevailing wage base ($/hr)
  fringeRate: number;       // hourly fringe credit ($/hr)
  totalHoursWorked: number; // all hours in the week (e.g. 44)
  overtimeHours: number;    // hours over 40 (e.g. 4)
}

export interface CwhssaOtResult {
  straightTimeBasePay: number; // totalHours * baseRate
  overtimePremium: number;     // overtimeHours * 0.5 * baseRate
  totalFringePay: number;      // totalHours * fringeRate (NO OT premium)
  totalWeeklyCost: number;     // sum of the three above
}

export function calculateCwhssaOt(input: CwhssaOtInput): CwhssaOtResult {
  const { baseRate, fringeRate, totalHoursWorked, overtimeHours } = input;
  const straightTimeBasePay = totalHoursWorked * baseRate;
  const overtimePremium = overtimeHours * 0.5 * baseRate; // fringe is NOT multiplied — CWHSSA rule
  const totalFringePay = totalHoursWorked * fringeRate;   // 1.0x for ALL hours, no OT premium
  const totalWeeklyCost = straightTimeBasePay + overtimePremium + totalFringePay;
  return { straightTimeBasePay, overtimePremium, totalFringePay, totalWeeklyCost };
}

export interface CertifiedPayrollPayInput {
  baseRate: number;
  fringeRate: number;
  straightTimeHours: number;
  overtimeHours: number;
  doubleTimeHours: number;
}

export interface CertifiedPayrollPayResult {
  straightTimeBasePay: number;
  overtimePremium: number;
  doubleTimePremium: number;
  totalFringePay: number;
  totalWeeklyCost: number;
}

export function calculateCertifiedPayrollPay(input: CertifiedPayrollPayInput): CertifiedPayrollPayResult {
  const totalHours = input.straightTimeHours + input.overtimeHours + input.doubleTimeHours;
  const straightTimeBasePay = totalHours * input.baseRate;
  const overtimePremium = input.overtimeHours * 0.5 * input.baseRate;
  const doubleTimePremium = input.doubleTimeHours * input.baseRate;
  const totalFringePay = totalHours * input.fringeRate;
  const totalWeeklyCost = straightTimeBasePay + overtimePremium + doubleTimePremium + totalFringePay;

  return {
    straightTimeBasePay,
    overtimePremium,
    doubleTimePremium,
    totalFringePay,
    totalWeeklyCost,
  };
}

// ---- CALC-02: Fully-loaded hourly cost ----

export interface LoadedRateInput {
  baseRate: number;           // prevailing wage base ($/hr)
  hourlyFringeCredit: number; // from calculateFringeCredit()
  ytdWages: number;           // year-to-date wages for SS wage-base cap
  annualWages: number;        // projected annual wages for FUTA wage-base cap
  annualHours: number;        // projected annual hours (for FUTA/SUTA per-hour allocation)
  futaEffectiveRate: number;  // 0.006 default; 0.009-0.015 for FUTA credit-reduction states (e.g. CA)
  sutaRate: number;           // state-specific rate; passed in from project config
  sutaWageBase: number;       // state-specific wage base cap
}

export interface LoadedRateResult {
  baseRate: number;
  ficaSS: number;        // 0 when ytdWages >= 176100
  ficaMedicare: number;  // 1.45%, no cap
  futaPerHour: number;   // min(annualWages, 7000) * futaEffectiveRate / annualHours; 0 when annualWages >= 7000
  sutaPerHour: number;   // min(annualWages, sutaWageBase) * sutaRate / annualHours; 0 when annualWages >= sutaWageBase
  fringeCredit: number;  // passed through from input
  totalLoadedRate: number; // sum of all above
}

export function calculateLoadedRate(input: LoadedRateInput): LoadedRateResult {
  const {
    baseRate,
    hourlyFringeCredit,
    ytdWages,
    annualWages,
    annualHours,
    futaEffectiveRate,
    sutaRate,
    sutaWageBase,
  } = input;

  const ficaSS = ytdWages >= 176100 ? 0 : baseRate * 0.062;
  const ficaMedicare = baseRate * 0.0145; // no cap
  const futaPerHour = annualWages >= 7000
    ? 0
    : (Math.min(annualWages, 7000) * futaEffectiveRate) / annualHours;
  const sutaPerHour = annualWages >= sutaWageBase
    ? 0
    : (Math.min(annualWages, sutaWageBase) * sutaRate) / annualHours;
  const fringeCredit = hourlyFringeCredit;
  const totalLoadedRate = baseRate + ficaSS + ficaMedicare + futaPerHour + sutaPerHour + fringeCredit;

  return { baseRate, ficaSS, ficaMedicare, futaPerHour, sutaPerHour, fringeCredit, totalLoadedRate };
}

// ---- CALC-04: Apprentice ratio check ----

export interface ApprenticeRatioInput {
  tradeCode: string;
  journeyworkerCount: number; // on site THIS day (daily compliance, not weekly)
  apprenticeCount: number;    // on site THIS day
  programRatio: number;       // from registered apprenticeship program (e.g. 3 = "1 per 3 JWs")
}

export interface ApprenticeRatioResult {
  isViolation: boolean;
  maxAllowed: number; // Math.floor(journeyworkerCount / programRatio)
  excess: number;     // max(0, apprenticeCount - maxAllowed)
}

export function checkApprenticeRatio(input: ApprenticeRatioInput): ApprenticeRatioResult {
  const { journeyworkerCount, apprenticeCount, programRatio } = input;
  const maxAllowed = Math.floor(journeyworkerCount / programRatio);
  const excess = Math.max(0, apprenticeCount - maxAllowed);
  const isViolation = excess > 0;
  return { isViolation, maxAllowed, excess };
}

// ---- CALC-03: Apprentice rate derivation ----

export function calculateApprenticeRate(
  journeyworkerRate: number,
  apprenticePercent: number, // e.g. 60 for "60% of JW rate"
): number {
  return journeyworkerRate * (apprenticePercent / 100);
}
