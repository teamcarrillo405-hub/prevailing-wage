import type { payrollEntries, payrollImports } from '../db/schema.js';
import type { PayrollSourceReconciliation } from './payrollSourceReconciliation.js';

type PayrollEntry = typeof payrollEntries.$inferSelect;
type PayrollImport = typeof payrollImports.$inferSelect;

export type PayrollAutomationTaskStatus = 'complete' | 'warning' | 'blocked' | 'ready';
export type PayrollAutomationMode = 'manual' | 'provider_import' | 'mapped_provider_import';
export type PayrollAutomationConfidenceLabel = 'needs_setup' | 'needs_review' | 'strong' | 'ready';

export interface PayrollAutomationTask {
  id: string;
  label: string;
  status: PayrollAutomationTaskStatus;
  detail: string;
  target: 'import' | 'entries' | 'mapping' | 'deductions' | 'fringes' | 'exceptions' | 'signature' | 'submission';
}

export interface PayrollAutomationSummary {
  confidenceScore: number;
  confidenceLabel: PayrollAutomationConfidenceLabel;
  automationMode: PayrollAutomationMode;
  importedRows: number;
  mappedWorkers: number;
  exceptionCount: number;
  reviewOnlyChangedRowsReady: boolean;
  priorWeekDeltaModeReady: boolean;
  deductionAutomation: {
    status: 'missing' | 'partial' | 'complete';
    totalRows: number;
    itemizedRows: number;
    taxRows: number;
    mismatchCount: number;
  };
  fringeAutomation: {
    status: 'missing' | 'partial' | 'complete';
    totalRows: number;
    itemizedRows: number;
    mismatchCount: number;
  };
  nextBestAction: PayrollAutomationTask;
  tasks: PayrollAutomationTask[];
}

function pctToCount(percent: number, total: number) {
  return total === 0 ? 0 : Math.round((percent / 100) * total);
}

function coverageStatus(percent: number): 'missing' | 'partial' | 'complete' {
  if (percent >= 95) return 'complete';
  if (percent > 0) return 'partial';
  return 'missing';
}

function labelForScore(score: number, hasEntries: boolean): PayrollAutomationConfidenceLabel {
  if (!hasEntries) return 'needs_setup';
  if (score >= 92) return 'ready';
  if (score >= 78) return 'strong';
  return 'needs_review';
}

function taskPriority(status: PayrollAutomationTaskStatus) {
  if (status === 'blocked') return 0;
  if (status === 'warning') return 1;
  if (status === 'ready') return 2;
  return 3;
}

export function buildPayrollAutomationSummary(input: {
  entries: PayrollEntry[];
  latestImport?: PayrollImport | null;
  providerMappingCount: number;
  sourceReconciliation: PayrollSourceReconciliation;
  payDeltaReviewCount?: number;
  zeroRateCount?: number;
  missingPayCount?: number;
  unmatchedCount?: number;
}): PayrollAutomationSummary {
  const {
    entries,
    latestImport,
    providerMappingCount,
    sourceReconciliation,
    payDeltaReviewCount = 0,
    zeroRateCount = 0,
    missingPayCount = 0,
    unmatchedCount = latestImport?.unmatchedCount ?? 0,
  } = input;
  const entryCount = entries.length;
  const hasEntries = entryCount > 0;
  const importedRows = latestImport?.committedCount ?? 0;
  const mappedWorkers = Math.min(providerMappingCount, entryCount);
  const mappingCoverage = entryCount === 0 ? 0 : Math.min(providerMappingCount / entryCount, 1);
  const payTotalsCoverage = hasEntries
    ? entries.filter((entry) => entry.grossWages != null && entry.netPay != null).length / entryCount
    : 0;
  const sourceCoverageAverage = hasEntries
    ? (
      sourceReconciliation.coverage.grossPay
      + sourceReconciliation.coverage.netPay
      + sourceReconciliation.coverage.totalDeductions
      + sourceReconciliation.coverage.taxBreakdown
      + sourceReconciliation.coverage.deductionBreakdown
      + sourceReconciliation.coverage.checkNumber
    ) / 600
    : 0;
  const mismatchCount =
    sourceReconciliation.itemizedDeductionMismatchCount
    + sourceReconciliation.netPayMismatchCount
    + sourceReconciliation.fringeMismatchCount
    + payDeltaReviewCount
    + zeroRateCount
    + missingPayCount
    + unmatchedCount;

  const exceptionPenalty = hasEntries ? Math.min(mismatchCount / entryCount, 1) : 1;
  const score = Math.round(
    (hasEntries ? 10 : 0)
    + (latestImport ? 15 : 0)
    + (mappingCoverage * 15)
    + (payTotalsCoverage * 20)
    + (sourceCoverageAverage * 20)
    + ((1 - exceptionPenalty) * 20),
  );

  const deductionCoverage = Math.min(
    sourceReconciliation.coverage.totalDeductions,
    Math.max(sourceReconciliation.coverage.taxBreakdown, sourceReconciliation.coverage.deductionBreakdown),
  );
  const fringeCoverage = sourceReconciliation.coverage.fringeBreakdown;
  const deductionAutomation = {
    status: sourceReconciliation.itemizedDeductionMismatchCount > 0 ? 'partial' as const : coverageStatus(deductionCoverage),
    totalRows: pctToCount(sourceReconciliation.coverage.totalDeductions, entryCount),
    itemizedRows: pctToCount(sourceReconciliation.coverage.deductionBreakdown, entryCount),
    taxRows: pctToCount(sourceReconciliation.coverage.taxBreakdown, entryCount),
    mismatchCount: sourceReconciliation.itemizedDeductionMismatchCount + sourceReconciliation.netPayMismatchCount,
  };
  const fringeAutomation = {
    status: sourceReconciliation.fringeMismatchCount > 0 ? 'partial' as const : coverageStatus(fringeCoverage),
    totalRows: entryCount,
    itemizedRows: pctToCount(fringeCoverage, entryCount),
    mismatchCount: sourceReconciliation.fringeMismatchCount,
  };

  const tasks: PayrollAutomationTask[] = [
    {
      id: 'payroll-source',
      label: latestImport ? 'Provider source connected' : 'Connect payroll source',
      status: latestImport ? 'complete' : hasEntries ? 'warning' : 'ready',
      detail: latestImport
        ? `${latestImport.provider.replaceAll('_', ' ')} import committed ${importedRows} row${importedRows === 1 ? '' : 's'}.`
        : 'Import a payroll register or enter payroll manually before certification.',
      target: 'import',
    },
    {
      id: 'mapping-memory',
      label: 'Worker mapping memory',
      status: !latestImport ? 'ready' : mappingCoverage >= 1 ? 'complete' : mappingCoverage > 0 ? 'warning' : 'warning',
      detail: `${mappedWorkers} of ${entryCount} current worker${entryCount === 1 ? '' : 's'} have saved provider mapping memory.`,
      target: 'mapping',
    },
    {
      id: 'pay-totals',
      label: 'Gross, deductions, and net pay',
      status: missingPayCount > 0 ? 'blocked' : hasEntries ? 'complete' : 'ready',
      detail: missingPayCount > 0
        ? `${missingPayCount} payroll entr${missingPayCount === 1 ? 'y is' : 'ies are'} missing gross or net pay.`
        : hasEntries ? 'Pay totals are present for current rows.' : 'Add payroll rows to validate pay totals.',
      target: 'entries',
    },
    {
      id: 'deduction-detail',
      label: 'Itemized deductions and taxes',
      status: deductionAutomation.mismatchCount > 0 ? 'blocked' : deductionAutomation.status === 'complete' ? 'complete' : hasEntries ? 'warning' : 'ready',
      detail: deductionAutomation.mismatchCount > 0
        ? `${deductionAutomation.mismatchCount} row${deductionAutomation.mismatchCount === 1 ? '' : 's'} need deduction or net-pay reconciliation.`
        : `${deductionAutomation.itemizedRows} itemized deduction row${deductionAutomation.itemizedRows === 1 ? '' : 's'} and ${deductionAutomation.taxRows} tax row${deductionAutomation.taxRows === 1 ? '' : 's'} detected.`,
      target: 'deductions',
    },
    {
      id: 'fringe-detail',
      label: 'Fringe and contribution detail',
      status: fringeAutomation.mismatchCount > 0 ? 'blocked' : fringeAutomation.status === 'complete' ? 'complete' : hasEntries ? 'warning' : 'ready',
      detail: fringeAutomation.mismatchCount > 0
        ? `${fringeAutomation.mismatchCount} row${fringeAutomation.mismatchCount === 1 ? '' : 's'} need fringe reconciliation.`
        : `${fringeAutomation.itemizedRows} of ${entryCount} row${entryCount === 1 ? '' : 's'} include fringe detail.`,
      target: 'fringes',
    },
    {
      id: 'exceptions',
      label: 'Exceptions review',
      status: mismatchCount > 0 ? (zeroRateCount > 0 || missingPayCount > 0 || sourceReconciliation.netPayMismatchCount > 0 ? 'blocked' : 'warning') : hasEntries ? 'complete' : 'ready',
      detail: mismatchCount > 0
        ? `${mismatchCount} automation exception${mismatchCount === 1 ? '' : 's'} need review before export.`
        : 'No payroll automation exceptions detected.',
      target: 'exceptions',
    },
    {
      id: 'certification-export',
      label: 'Certification and export',
      status: mismatchCount === 0 && hasEntries ? 'ready' : 'warning',
      detail: mismatchCount === 0 && hasEntries
        ? 'Payroll is ready for human certification and CPR export checks.'
        : 'Resolve source, mapping, pay, and detail warnings before signing.',
      target: 'signature',
    },
  ];

  const automationMode: PayrollAutomationMode = latestImport
    ? providerMappingCount > 0 ? 'mapped_provider_import' : 'provider_import'
    : 'manual';
  const nextBestAction = hasEntries
    ? [...tasks].sort((a, b) => taskPriority(a.status) - taskPriority(b.status))[0]
    : tasks[0];

  return {
    confidenceScore: Math.max(0, Math.min(100, score)),
    confidenceLabel: labelForScore(score, hasEntries),
    automationMode,
    importedRows,
    mappedWorkers,
    exceptionCount: mismatchCount,
    reviewOnlyChangedRowsReady: Boolean(latestImport && providerMappingCount > 0 && sourceReconciliation.completeSourceRows > 0),
    priorWeekDeltaModeReady: hasEntries && sourceReconciliation.completeSourceRows === entryCount && mismatchCount === 0,
    deductionAutomation,
    fringeAutomation,
    nextBestAction,
    tasks,
  };
}
