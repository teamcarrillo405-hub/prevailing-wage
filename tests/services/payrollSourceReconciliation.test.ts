import { describe, expect, it } from 'vitest';
import { reconcilePayrollSourceDetails } from '../../src/server/services/payrollSourceReconciliation';
import type { payrollEntries } from '../../src/server/db/schema';

type PayrollEntry = typeof payrollEntries.$inferSelect;

function entry(overrides: Partial<PayrollEntry> = {}): PayrollEntry {
  return {
    id: 'entry-1',
    payrollWeekId: 'week-1',
    workerId: 'worker-1',
    classificationId: 'classification-1',
    monSt: 8,
    tueSt: 8,
    wedSt: 8,
    thuSt: 8,
    friSt: 8,
    satSt: 0,
    sunSt: 0,
    monOt: 0,
    tueOt: 0,
    wedOt: 0,
    thuOt: 0,
    friOt: 0,
    satOt: 0,
    sunOt: 0,
    monDt: 0,
    tueDt: 0,
    wedDt: 0,
    thuDt: 0,
    friDt: 0,
    satDt: 0,
    sunDt: 0,
    baseRateSnapshot: 45,
    fringeRateSnapshot: 20,
    grossWages: 2600,
    deductions: 300,
    netPay: 2300,
    fringeHealthWelfare: 4,
    fringePension: 6,
    fringeVacation: 5,
    fringeTraining: 5,
    nonPwHours: null,
    checkNumber: '1001',
    allOtherHours: null,
    totalWeekGrossWages: null,
    ficaTax: 100,
    federalIncomeTax: 120,
    stateIncomeTax: 50,
    sdiTax: 10,
    deductionVacationHoliday: 5,
    deductionHealthWelfare: 5,
    deductionPension: 5,
    deductionTraining: 2,
    deductionFundAdmin: 1,
    deductionDues: 2,
    deductionTravelSubsistence: 0,
    deductionSavings: 0,
    deductionOther: 0,
    deductionOtherDescription: null,
    createdByUserId: null,
    updatedByUserId: null,
    subcontractorId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('payroll source reconciliation', () => {
  it('scores complete payroll register detail and catches mismatches', () => {
    const result = reconcilePayrollSourceDetails([
      entry(),
      entry({
        id: 'entry-2',
        grossWages: 1000,
        deductions: 200,
        netPay: 900,
        ficaTax: null,
        federalIncomeTax: null,
        stateIncomeTax: null,
        sdiTax: null,
        deductionDues: null,
        checkNumber: null,
      }),
    ]);

    expect(result.entryCount).toBe(2);
    expect(result.completeSourceRows).toBe(1);
    expect(result.coverage.grossPay).toBe(100);
    expect(result.coverage.taxBreakdown).toBe(50);
    expect(result.coverage.checkNumber).toBe(50);
    expect(result.netPayMismatchCount).toBe(1);
    expect(result.missingSourceDetailCount).toBe(1);
  });
});
