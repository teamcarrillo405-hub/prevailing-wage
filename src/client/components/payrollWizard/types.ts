// src/client/components/payrollWizard/types.ts
// Shared types for the payroll wizard. Keep narrow — domain types (PayrollEntry, Worker)
// live in src/shared. These are wizard-internal shapes only.

export type WizardStep = 'roster' | 'hours' | 'review';

export interface RosterEntry {
  workerId: string;
  classificationId: string;
  workerName: string;
  tradeDescription: string;
  baseRate: number;
  fringeRate: number;
  included: boolean; // checkbox state
}

export interface GridCellKey {
  workerId: string;
  classificationId: string;
  day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  kind: 'st' | 'ot' | 'dt';
}

export interface GridRow {
  workerId: string;
  classificationId: string;
  workerName: string;
  tradeDescription: string;
  baseRateSnapshot: number;
  fringeRateSnapshot: number;
  hours: Record<`${GridCellKey['day']}${Capitalize<GridCellKey['kind']>}`, number>;
  deductions: number;
  // State-specific optional fields
  nonPwHours: number | null;
  checkNumber: string | null;
  allOtherHours: number | null;
  totalWeekGrossWages: number | null;
  ficaTax: number | null;
  federalIncomeTax: number | null;
  stateIncomeTax: number | null;
  sdiTax: number | null;
  deductionVacationHoliday: number | null;
  deductionHealthWelfare: number | null;
  deductionPension: number | null;
  deductionTraining: number | null;
  deductionFundAdmin: number | null;
  deductionDues: number | null;
  deductionTravelSubsistence: number | null;
  deductionSavings: number | null;
  deductionOther: number | null;
  deductionOtherDescription: string | null;
  fringeHealthWelfare: number | null;
  fringePension: number | null;
  fringeVacation: number | null;
  fringeTraining: number | null;
}

export interface PersistedEntry {
  id: string;
  payrollWeekId: string;
  workerId: string;
  classificationId: string;
}

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export const KINDS = ['st', 'ot', 'dt'] as const;
