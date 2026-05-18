export interface WorkflowWeek {
  id: string;
  submittedAt: string | null;
  weekEndingDate?: string;
  payrollNumber?: number;
}

export interface ProjectWorkflowInput {
  projectId: string;
  hasProject: boolean;
  hasPrimaryWageDetermination: boolean;
  workerCount: number;
  weeks: WorkflowWeek[];
  violationCount: number;
  openCprItems: number;
}

export interface ProjectWorkflowAction {
  key: string;
  label: string;
  detail: string;
  to: string;
  priority: 'Required' | 'Critical' | 'Next' | 'Audit' | 'Done';
}

export interface ProjectWorkflowStep {
  key: string;
  step: number;
  label: string;
  helper: string;
  to: string;
  status: 'blocked' | 'warning' | 'complete' | 'ready' | 'clean' | 'in_progress';
}

export function buildProjectWorkflowState(input: ProjectWorkflowInput) {
  const base = `/projects/${input.projectId}`;
  const submittedWeeks = input.weeks.filter((week) => week.submittedAt).length;
  const openPayrollWeeks = input.weeks.length - submittedWeeks;
  const payrollStarted = input.weeks.length > 0;
  const setupComplete = input.hasPrimaryWageDetermination && input.workerCount > 0;
  const nextUnsubmitted = input.weeks
    .filter((week) => !week.submittedAt)
    .slice()
    .sort((a, b) => String(a.weekEndingDate ?? '').localeCompare(String(b.weekEndingDate ?? '')))[0];

  const steps: ProjectWorkflowStep[] = [
    {
      key: 'setup',
      step: 1,
      label: 'Setup',
      helper: 'Agency, jobsite, required fields',
      to: `${base}/settings`,
      status: input.hasProject ? 'complete' : 'warning',
    },
    {
      key: 'wage-rates',
      step: 2,
      label: 'Wage Rates',
      helper: 'Determinations and classifications',
      to: `${base}#wage-determinations`,
      status: input.hasPrimaryWageDetermination ? 'complete' : 'blocked',
    },
    {
      key: 'workers',
      step: 3,
      label: 'Workers',
      helper: 'Roster and classifications',
      to: `${base}/workers`,
      status: input.workerCount > 0 ? 'complete' : 'warning',
    },
    {
      key: 'payroll',
      step: 4,
      label: 'Payroll',
      helper: 'Hours, deductions, first review',
      to: nextUnsubmitted ? `${base}/payroll/${nextUnsubmitted.id}#payroll` : `${base}/payroll`,
      status: input.violationCount > 0 ? 'blocked' : openPayrollWeeks > 0 ? 'warning' : payrollStarted ? 'complete' : 'warning',
    },
    {
      key: 'review',
      step: 5,
      label: 'Review & Forms',
      helper: 'Clear blockers and export forms',
      to: nextUnsubmitted ? `${base}/payroll/${nextUnsubmitted.id}#forms` : `${base}/reports`,
      status: input.violationCount > 0 || input.openCprItems > 0 ? 'warning' : submittedWeeks > 0 ? 'complete' : 'warning',
    },
    {
      key: 'audit-packet',
      step: 6,
      label: 'Audit Packet',
      helper: 'Evidence and submission proof',
      to: `${base}/activity`,
      status: input.violationCount > 0 || input.openCprItems > 0 ? 'warning' : 'clean',
    },
  ];

  const actions: ProjectWorkflowAction[] = [
    !input.hasPrimaryWageDetermination
      ? {
          key: 'wage-rates',
          label: 'Lock wage determination',
          detail: 'Confirm the WD or state wage source before workers and payroll are certified.',
          to: `${base}#wage-determinations`,
          priority: 'Required',
        }
      : null,
    input.workerCount === 0
      ? {
          key: 'workers',
          label: 'Add workers and classifications',
          detail: 'Create the worker roster and attach each worker to a trade/classification.',
          to: `${base}/workers`,
          priority: 'Required',
        }
      : null,
    input.weeks.length === 0
      ? {
          key: 'payroll',
          label: 'Create payroll week',
          detail: 'Start Week 1 and import payroll register data before entering manual values.',
          to: `${base}/payroll`,
          priority: 'Required',
        }
      : null,
    input.violationCount > 0
      ? {
          key: 'compliance',
          label: `Resolve ${input.violationCount} compliance issue${input.violationCount === 1 ? '' : 's'}`,
          detail: 'Fix wage, overtime, deduction, or apprenticeship issues before certification.',
          to: nextUnsubmitted ? `${base}/payroll/${nextUnsubmitted.id}` : `${base}/payroll`,
          priority: 'Critical',
        }
      : null,
    input.openCprItems > 0
      ? {
          key: 'subcontractors',
          label: `Clear ${input.openCprItems} subcontractor CPR item${input.openCprItems === 1 ? '' : 's'}`,
          detail: 'Request missing CPRs or correct non-compliant subcontractor files.',
          to: `${base}#subcontractors`,
          priority: 'Next',
        }
      : null,
    nextUnsubmitted
      ? {
          key: 'payroll-week',
          label: `Finish Payroll Week ${nextUnsubmitted.payrollNumber ?? ''}`.trim(),
          detail: nextUnsubmitted.weekEndingDate
            ? `Week ending ${nextUnsubmitted.weekEndingDate} still needs review, export, or submission.`
            : 'An open payroll week still needs review, export, or submission.',
          to: `${base}/payroll/${nextUnsubmitted.id}`,
          priority: 'Next',
        }
      : null,
    {
      key: 'audit-packet',
      label: setupComplete && payrollStarted ? 'Review evidence packet' : 'Review project setup evidence',
      detail: 'Confirm audit trail, field evidence, payroll submissions, and export proof are ready.',
      to: `${base}/activity`,
      priority: 'Audit',
    },
  ].filter(Boolean) as ProjectWorkflowAction[];

  const readyScore = [
    input.hasProject,
    input.hasPrimaryWageDetermination,
    input.workerCount > 0,
    payrollStarted,
    openPayrollWeeks === 0 && payrollStarted,
    input.violationCount === 0,
    input.openCprItems === 0,
  ].filter(Boolean).length;

  return {
    steps,
    actions,
    primaryAction: actions[0],
    readinessPct: Math.round((readyScore / 7) * 100),
    readinessStatus: input.violationCount > 0 || !input.hasPrimaryWageDetermination
      ? 'blocked'
      : openPayrollWeeks > 0 || input.openCprItems > 0
        ? 'warning'
        : setupComplete && payrollStarted
          ? 'ready'
          : 'in_progress',
    submittedWeeks,
    openPayrollWeeks,
  };
}
