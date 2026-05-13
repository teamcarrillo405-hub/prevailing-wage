import { describe, expect, it } from 'vitest';
import { buildPayrollAutomationSummary } from '../../src/server/services/payrollAutomation.js';
import type { PayrollSourceReconciliation } from '../../src/server/services/payrollSourceReconciliation.js';

function reconciliation(overrides: Partial<PayrollSourceReconciliation> = {}): PayrollSourceReconciliation {
  return {
    entryCount: 1,
    completeSourceRows: 1,
    coverage: {
      grossPay: 100,
      netPay: 100,
      totalDeductions: 100,
      taxBreakdown: 100,
      deductionBreakdown: 100,
      fringeBreakdown: 100,
      checkNumber: 100,
    },
    itemizedDeductionMismatchCount: 0,
    netPayMismatchCount: 0,
    fringeMismatchCount: 0,
    missingSourceDetailCount: 0,
    ...overrides,
  };
}

function entry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'entry-1',
    payrollWeekId: 'week-1',
    workerId: 'worker-1',
    classificationId: 'class-1',
    grossWages: 2600,
    deductions: 300,
    netPay: 2300,
    fringeRateSnapshot: 20,
    ...overrides,
  } as any;
}

describe('buildPayrollAutomationSummary', () => {
  it('starts in setup mode when the week has no payroll rows', () => {
    const summary = buildPayrollAutomationSummary({
      entries: [],
      latestImport: null,
      providerMappingCount: 0,
      sourceReconciliation: reconciliation({
        entryCount: 0,
        completeSourceRows: 0,
        coverage: {
          grossPay: 0,
          netPay: 0,
          totalDeductions: 0,
          taxBreakdown: 0,
          deductionBreakdown: 0,
          fringeBreakdown: 0,
          checkNumber: 0,
        },
        missingSourceDetailCount: 0,
      }),
    });

    expect(summary.confidenceLabel).toBe('needs_setup');
    expect(summary.confidenceScore).toBe(0);
    expect(summary.nextBestAction.id).toBe('payroll-source');
  });

  it('scores a mapped provider import as ready when source detail is complete', () => {
    const summary = buildPayrollAutomationSummary({
      entries: [entry()],
      latestImport: {
        id: 'import-1',
        payrollWeekId: 'week-1',
        importedByUserId: 'user-1',
        provider: 'quickbooks',
        sourceFilename: 'qb.csv',
        committedCount: 1,
        unmatchedCount: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
      } as any,
      providerMappingCount: 1,
      sourceReconciliation: reconciliation(),
    });

    expect(summary.confidenceScore).toBe(100);
    expect(summary.confidenceLabel).toBe('ready');
    expect(summary.automationMode).toBe('mapped_provider_import');
    expect(summary.deductionAutomation.status).toBe('complete');
    expect(summary.fringeAutomation.status).toBe('complete');
  });

  it('blocks certification when deductions or net pay do not reconcile', () => {
    const summary = buildPayrollAutomationSummary({
      entries: [entry({ netPay: 2200 })],
      latestImport: null,
      providerMappingCount: 0,
      sourceReconciliation: reconciliation({
        itemizedDeductionMismatchCount: 1,
        netPayMismatchCount: 1,
      }),
      missingPayCount: 0,
    });

    expect(summary.exceptionCount).toBe(2);
    expect(summary.confidenceLabel).toBe('needs_review');
    expect(summary.tasks.find((task) => task.id === 'deduction-detail')?.status).toBe('blocked');
    expect(summary.nextBestAction.id).toBe('deduction-detail');
  });
});
