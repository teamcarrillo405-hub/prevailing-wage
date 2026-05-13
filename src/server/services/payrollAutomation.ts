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
  providerAutomation: {
    provider: string | null;
    status: 'manual' | 'csv_ready' | 'mapping_ready' | 'sync_ready';
    liveSyncAvailable: boolean;
    setupSteps: Array<{ id: string; label: string; status: PayrollAutomationTaskStatus; detail: string }>;
    missingCapabilities: string[];
  };
  changedRowReview: {
    mode: 'all_rows' | 'changed_rows' | 'exceptions_only';
    status: 'not_required' | 'pending' | 'reviewed';
    acknowledgementIssueId: 'payroll-changed-row-review' | 'payroll-automation-exceptions';
    currentRows: number;
    priorWeekRows: number;
    changedRows: number;
    unchangedRows: number;
    newRows: number;
    removedRows: number;
    exceptionRows: number;
    reviewRows: Array<{
      entryId: string;
      workerId: string;
      reason: 'new' | 'changed' | 'exception';
      detail: string;
    }>;
  };
  reviewAcknowledgement: {
    automationExceptionsReviewed: boolean;
    changedRowsReviewed: boolean;
    blockingExceptionCount: number;
    reviewableExceptionCount: number;
    unreviewedExceptionCount: number;
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

const PROVIDER_SYNC_STATUS: Record<string, { liveSyncAvailable: boolean; missingCapabilities: string[] }> = {
  quickbooks: {
    liveSyncAvailable: false,
    missingCapabilities: ['OAuth employee sync', 'scheduled payroll register pull', 'webhook-based changed-row review'],
  },
  adp: {
    liveSyncAvailable: false,
    missingCapabilities: ['marketplace app connection', 'employee ID sync', 'pay statement detail pull'],
  },
  gusto: {
    liveSyncAvailable: false,
    missingCapabilities: ['payroll API connection', 'benefit deduction mapping', 'scheduled import'],
  },
  paychex: {
    liveSyncAvailable: false,
    missingCapabilities: ['provider API connection', 'worker ID sync', 'pay component mapping'],
  },
  sage_300: {
    liveSyncAvailable: false,
    missingCapabilities: ['job-cost payroll connector', 'cost code classification mapping', 'nightly sync'],
  },
  sage_100: {
    liveSyncAvailable: false,
    missingCapabilities: ['check register connector', 'job/cost-code mapping', 'nightly sync'],
  },
};

const comparisonFields = [
  'monSt', 'tueSt', 'wedSt', 'thuSt', 'friSt', 'satSt', 'sunSt',
  'monOt', 'tueOt', 'wedOt', 'thuOt', 'friOt', 'satOt', 'sunOt',
  'monDt', 'tueDt', 'wedDt', 'thuDt', 'friDt', 'satDt', 'sunDt',
  'baseRateSnapshot', 'fringeRateSnapshot', 'grossWages', 'deductions', 'netPay',
] as const;

function changedFields(current: PayrollEntry, prior: PayrollEntry) {
  return comparisonFields.filter((field) => current[field] !== prior[field]);
}

function buildChangedRowReview(input: {
  entries: PayrollEntry[];
  previousEntries?: PayrollEntry[];
  exceptionEntryIds: Set<string>;
  automationExceptionsReviewed: boolean;
  changedRowsReviewed: boolean;
}): PayrollAutomationSummary['changedRowReview'] {
  const previousEntries = input.previousEntries ?? [];
  const previousByWorkerClass = new Map(previousEntries.map((entry) => [`${entry.workerId}::${entry.classificationId}`, entry]));
  const currentKeys = new Set(input.entries.map((entry) => `${entry.workerId}::${entry.classificationId}`));
  const reviewRows: PayrollAutomationSummary['changedRowReview']['reviewRows'] = [];
  let changedRows = 0;
  let unchangedRows = 0;
  let newRows = 0;

  for (const entry of input.entries) {
    const key = `${entry.workerId}::${entry.classificationId}`;
    const prior = previousByWorkerClass.get(key);
    const hasException = input.exceptionEntryIds.has(entry.id);
    if (!prior) {
      newRows += 1;
      reviewRows.push({ entryId: entry.id, workerId: entry.workerId, reason: hasException ? 'exception' : 'new', detail: hasException ? 'New row with payroll exception.' : 'New worker/classification row this week.' });
      continue;
    }
    const fields = changedFields(entry, prior);
    if (fields.length > 0 || hasException) {
      changedRows += fields.length > 0 ? 1 : 0;
      reviewRows.push({
        entryId: entry.id,
        workerId: entry.workerId,
        reason: hasException ? 'exception' : 'changed',
        detail: hasException ? 'Payroll exception requires review.' : `${fields.length} payroll field${fields.length === 1 ? '' : 's'} changed from prior week.`,
      });
    } else {
      unchangedRows += 1;
    }
  }

  const removedRows = previousEntries.filter((entry) => !currentKeys.has(`${entry.workerId}::${entry.classificationId}`)).length;
  const exceptionRows = reviewRows.filter((row) => row.reason === 'exception').length;
  const mode = exceptionRows > 0
    ? 'exceptions_only'
    : previousEntries.length > 0 && reviewRows.length < input.entries.length
    ? 'changed_rows'
    : 'all_rows';
  const acknowledgementIssueId = mode === 'exceptions_only'
    ? 'payroll-automation-exceptions'
    : 'payroll-changed-row-review';
  const reviewed = mode === 'exceptions_only' ? input.automationExceptionsReviewed : input.changedRowsReviewed;
  const status = reviewRows.length === 0 ? 'not_required' : reviewed ? 'reviewed' : 'pending';

  return {
    mode,
    status,
    acknowledgementIssueId,
    currentRows: input.entries.length,
    priorWeekRows: previousEntries.length,
    changedRows,
    unchangedRows,
    newRows,
    removedRows,
    exceptionRows,
    reviewRows,
  };
}

function buildProviderAutomation(input: {
  latestImport?: PayrollImport | null;
  entryCount: number;
  providerMappingCount: number;
  deductionAutomation: PayrollAutomationSummary['deductionAutomation'];
  fringeAutomation: PayrollAutomationSummary['fringeAutomation'];
}): PayrollAutomationSummary['providerAutomation'] {
  const provider = input.latestImport?.provider ?? null;
  const providerProfile = provider ? PROVIDER_SYNC_STATUS[provider] : null;
  const mappingComplete = input.entryCount > 0 && input.providerMappingCount >= input.entryCount;
  const sourceDetailComplete = input.deductionAutomation.status === 'complete' && input.fringeAutomation.status === 'complete';
  const status = !provider
    ? 'manual'
    : providerProfile?.liveSyncAvailable
    ? 'sync_ready'
    : mappingComplete && sourceDetailComplete
    ? 'mapping_ready'
    : 'csv_ready';

  return {
    provider,
    status,
    liveSyncAvailable: Boolean(providerProfile?.liveSyncAvailable),
    setupSteps: [
      {
        id: 'provider-import',
        label: 'Provider import',
        status: provider ? 'complete' : 'ready',
        detail: provider ? `${provider.replaceAll('_', ' ')} source is attached to this week.` : 'Import a provider payroll register for this week.',
      },
      {
        id: 'mapping-memory',
        label: 'Mapping memory',
        status: mappingComplete ? 'complete' : provider ? 'warning' : 'ready',
        detail: `${Math.min(input.providerMappingCount, input.entryCount)} of ${input.entryCount} rows have saved worker mapping memory.`,
      },
      {
        id: 'deduction-fringe-map',
        label: 'Deduction and fringe map',
        status: sourceDetailComplete ? 'complete' : input.entryCount > 0 ? 'warning' : 'ready',
        detail: sourceDetailComplete ? 'Taxes, deductions, and fringe details are imported.' : 'Map tax, deduction, check number, and fringe columns in the provider export.',
      },
      {
        id: 'live-sync',
        label: 'Live provider sync',
        status: providerProfile?.liveSyncAvailable ? 'complete' : 'warning',
        detail: providerProfile?.liveSyncAvailable ? 'Live sync is available for this provider.' : 'CSV import is production-ready; live API sync still needs connector credentials and provider approval.',
      },
    ],
    missingCapabilities: providerProfile?.missingCapabilities ?? ['select payroll provider', 'import payroll register', 'save worker mappings'],
  };
}

export function buildPayrollAutomationSummary(input: {
  entries: PayrollEntry[];
  previousEntries?: PayrollEntry[];
  latestImport?: PayrollImport | null;
  providerMappingCount: number;
  sourceReconciliation: PayrollSourceReconciliation;
  payDeltaReviewCount?: number;
  payDeltaEntryIds?: string[];
  acknowledgedIssueIds?: string[];
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
    payDeltaEntryIds = [],
    acknowledgedIssueIds = [],
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
  const blockingExceptionCount =
    sourceReconciliation.itemizedDeductionMismatchCount
    + sourceReconciliation.netPayMismatchCount
    + sourceReconciliation.fringeMismatchCount
    + zeroRateCount
    + missingPayCount
    + unmatchedCount;
  const automationExceptionsReviewed = acknowledgedIssueIds.includes('payroll-automation-exceptions');
  const changedRowsReviewed = acknowledgedIssueIds.includes('payroll-changed-row-review');
  const reviewableExceptionCount = payDeltaReviewCount;
  const unreviewedExceptionCount = automationExceptionsReviewed ? 0 : reviewableExceptionCount;
  const effectiveExceptionCount = blockingExceptionCount + unreviewedExceptionCount;

  const exceptionPenalty = hasEntries ? Math.min(effectiveExceptionCount / entryCount, 1) : 1;
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
  const exceptionEntryIds = new Set<string>(payDeltaEntryIds);
  for (const entry of entries) {
    if ((entryHoursLike(entry) > 0 && entry.baseRateSnapshot <= 0) || entry.grossWages == null || entry.netPay == null) {
      exceptionEntryIds.add(entry.id);
    }
  }
  const changedRowReview = buildChangedRowReview({
    entries,
    previousEntries: input.previousEntries,
    exceptionEntryIds,
    automationExceptionsReviewed,
    changedRowsReviewed,
  });
  const providerAutomation = buildProviderAutomation({
    latestImport,
    entryCount,
    providerMappingCount,
    deductionAutomation,
    fringeAutomation,
  });

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
      status: mismatchCount > 0
        ? blockingExceptionCount > 0
          ? 'blocked'
          : automationExceptionsReviewed
          ? 'complete'
          : 'warning'
        : hasEntries ? 'complete' : 'ready',
      detail: mismatchCount > 0 && blockingExceptionCount > 0
        ? `${mismatchCount} automation exception${mismatchCount === 1 ? '' : 's'} need review before export.`
        : mismatchCount > 0 && automationExceptionsReviewed
        ? `${reviewableExceptionCount} payroll source exception${reviewableExceptionCount === 1 ? '' : 's'} reviewed and documented.`
        : mismatchCount > 0
        ? `${reviewableExceptionCount} payroll source exception${reviewableExceptionCount === 1 ? '' : 's'} need reviewer acknowledgement.`
        : 'No payroll automation exceptions detected.',
      target: 'exceptions',
    },
    {
      id: 'changed-row-review',
      label: 'Changed-row review',
      status: changedRowReview.status === 'reviewed' || changedRowReview.status === 'not_required'
        ? 'complete'
        : changedRowReview.mode === 'all_rows'
        ? 'warning'
        : 'warning',
      detail: changedRowReview.status === 'reviewed'
        ? `${changedRowReview.reviewRows.length} review row${changedRowReview.reviewRows.length === 1 ? '' : 's'} acknowledged for this week.`
        : changedRowReview.mode === 'exceptions_only'
        ? `${changedRowReview.exceptionRows} exception row${changedRowReview.exceptionRows === 1 ? '' : 's'} require review; unchanged rows can stay out of the way.`
        : changedRowReview.mode === 'changed_rows'
        ? `${changedRowReview.reviewRows.length} changed or new row${changedRowReview.reviewRows.length === 1 ? '' : 's'} need review.`
        : 'No prior week baseline yet, so review every current payroll row.',
      target: 'entries',
    },
    {
      id: 'certification-export',
      label: 'Certification and export',
      status: effectiveExceptionCount === 0 && changedRowReview.status !== 'pending' && hasEntries ? 'ready' : 'warning',
      detail: effectiveExceptionCount === 0 && changedRowReview.status !== 'pending' && hasEntries
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
    exceptionCount: effectiveExceptionCount,
    reviewOnlyChangedRowsReady: Boolean(latestImport && providerMappingCount > 0 && sourceReconciliation.completeSourceRows > 0),
    priorWeekDeltaModeReady: hasEntries && changedRowReview.priorWeekRows > 0 && sourceReconciliation.completeSourceRows === entryCount && mismatchCount === 0,
    deductionAutomation,
    fringeAutomation,
    providerAutomation,
    changedRowReview,
    reviewAcknowledgement: {
      automationExceptionsReviewed,
      changedRowsReviewed,
      blockingExceptionCount,
      reviewableExceptionCount,
      unreviewedExceptionCount,
    },
    nextBestAction,
    tasks,
  };
}

function entryHoursLike(entry: PayrollEntry): number {
  return (
    entry.monSt + entry.tueSt + entry.wedSt + entry.thuSt + entry.friSt + entry.satSt + entry.sunSt
    + entry.monOt + entry.tueOt + entry.wedOt + entry.thuOt + entry.friOt + entry.satOt + entry.sunOt
    + entry.monDt + entry.tueDt + entry.wedDt + entry.thuDt + entry.friDt + entry.satDt + entry.sunDt
  );
}
