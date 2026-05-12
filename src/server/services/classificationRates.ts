import { calculateApprenticeRate } from './calculations.js';

export interface JourneyRates {
  baseRate: number;
  fringeRate: number;
}

export interface RateClassificationContext {
  laborType?: string | null;
  apprenticePercent?: number | null;
}

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

export function resolveEffectiveClassificationRates(
  rates: JourneyRates,
  classification: RateClassificationContext,
): JourneyRates {
  if (classification.laborType === 'apprentice' && classification.apprenticePercent != null) {
    return {
      baseRate: money(calculateApprenticeRate(rates.baseRate, classification.apprenticePercent)),
      fringeRate: money(rates.fringeRate),
    };
  }

  return {
    baseRate: money(rates.baseRate),
    fringeRate: money(rates.fringeRate),
  };
}
