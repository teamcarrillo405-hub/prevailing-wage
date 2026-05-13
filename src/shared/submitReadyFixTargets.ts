export type SubmitReadyRouteScope = 'payroll-week' | 'project' | 'settings';

export interface SubmitReadyFixTarget {
  label: string;
  instruction: string;
  routeScope: SubmitReadyRouteScope;
  hash?: string;
  fieldHint?: string;
}

const FIX_TARGETS: Record<string, SubmitReadyFixTarget> = {
  'wd-lock': {
    label: 'Open wage determination section',
    instruction: 'Lock the applicable wage determination or confirm the project wage source before payroll export.',
    routeScope: 'project',
    hash: 'wage-determinations',
  },
  'payroll-entries': {
    label: 'Open payroll entries',
    instruction: 'Import payroll or add worker payroll entries for this week.',
    routeScope: 'payroll-week',
    hash: 'payroll-entries',
  },
  'pay-calculation': {
    label: 'Open incomplete pay row',
    instruction: 'Complete gross pay, net pay, deductions, and fringe values on the affected payroll row.',
    routeScope: 'payroll-week',
    hash: 'payroll-entries',
    fieldHint: 'deductions',
  },
  'rate-snapshots': {
    label: 'Open rate fields',
    instruction: 'Confirm base rate and fringe rate from the locked wage determination or payroll source record.',
    routeScope: 'payroll-week',
    hash: 'payroll-entries',
    fieldHint: 'baseRate',
  },
  'compliance-review': {
    label: 'Open exact payroll field',
    instruction: 'Review the first blocking wage, overtime, deduction, or apprentice finding and correct the source field.',
    routeScope: 'payroll-week',
    hash: 'compliance-check',
  },
  'human-certification-review': {
    label: 'Acknowledge human review',
    instruction: 'Review the payroll source records, compliance checks, and certification statements, then acknowledge the review.',
    routeScope: 'payroll-week',
    hash: 'compliance-check',
  },
  signature: {
    label: 'Open signature section',
    instruction: 'Add the contractor signature required for signed certified payroll packages.',
    routeScope: 'project',
    hash: 'contractor-signature',
  },
  'subcontractor-cpr': {
    label: 'Open subcontractor CPR queue',
    instruction: 'Request missing CPRs, review uploaded files, or mark non-compliant records corrected.',
    routeScope: 'project',
    hash: 'subcontractor-cpr',
  },
  'import-review': {
    label: 'Open import reconciliation',
    instruction: 'Resolve unmatched workers, confirm provider mapping evidence, and reconcile imported totals to payroll.',
    routeScope: 'payroll-week',
    hash: 'import-reconciliation',
  },
  'export-readiness': {
    label: 'Review export blockers',
    instruction: 'Clear remaining submit-ready blockers before generating WH-347, state CPR, or eCPR files.',
    routeScope: 'payroll-week',
    hash: 'submit-ready',
  },
};

const ACTION_TARGETS: Record<string, SubmitReadyFixTarget> = {
  'prepare-missing-wd': FIX_TARGETS['wd-lock'],
  'prepare-import-review': FIX_TARGETS['import-review'],
  'review-week-violations': FIX_TARGETS['compliance-review'],
  'acknowledge-human-certification-review': FIX_TARGETS['human-certification-review'],
};

export function getSubmitReadyFixTarget(issueId: string, actionId?: string | null): SubmitReadyFixTarget {
  if (actionId && ACTION_TARGETS[actionId]) return ACTION_TARGETS[actionId];
  return FIX_TARGETS[issueId] ?? {
    label: 'Go to fix',
    instruction: 'Review this issue and update the related payroll or project field.',
    routeScope: 'payroll-week',
    hash: 'submit-ready',
  };
}

export function buildSubmitReadyFixHref(
  issueId: string,
  params: { projectId: string; weekId: string; actionId?: string | null },
): string {
  const target = getSubmitReadyFixTarget(issueId, params.actionId);
  const base =
    target.routeScope === 'project'
      ? `/projects/${params.projectId}`
      : target.routeScope === 'settings'
        ? '/settings'
        : `/projects/${params.projectId}/payroll/${params.weekId}`;
  return target.hash ? `${base}#${target.hash}` : base;
}
