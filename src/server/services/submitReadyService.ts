import { desc, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema.js';
import { computeCompliance } from './complianceService.js';
import { getPayrollEntries, getPayrollWeek } from './payrollService.js';
import { countComplianceViolations, resolveComplianceProfile } from './complianceRules.js';

export type SubmitReadySeverity = 'blocker' | 'warning' | 'pass';
export type SubmitReadyCategory =
  | 'project'
  | 'wage_determination'
  | 'payroll'
  | 'compliance'
  | 'signature'
  | 'subcontractor'
  | 'import'
  | 'export';

export interface SubmitReadyIssue {
  id: string;
  category: SubmitReadyCategory;
  severity: SubmitReadySeverity;
  title: string;
  detail: string;
  actionId?: string;
}

export interface SubmitReadyResult {
  weekId: string;
  projectId: string;
  score: number;
  status: 'not_ready' | 'needs_review' | 'ready' | 'submitted';
  headline: string;
  blockers: number;
  warnings: number;
  passes: number;
  issues: SubmitReadyIssue[];
  summary: {
    entryCount: number;
    totalHours: number;
    grossWages: number;
    complianceIssueCount: number;
    exportFormat: string;
  };
}

type PayrollEntrySelect = typeof schema.payrollEntries.$inferSelect;

function totalHours(entry: PayrollEntrySelect) {
  return [
    entry.monSt, entry.tueSt, entry.wedSt, entry.thuSt, entry.friSt, entry.satSt, entry.sunSt,
    entry.monOt, entry.tueOt, entry.wedOt, entry.thuOt, entry.friOt, entry.satOt, entry.sunOt,
    entry.monDt, entry.tueDt, entry.wedDt, entry.thuDt, entry.friDt, entry.satDt, entry.sunDt,
  ].reduce((sum, value) => sum + (value ?? 0), 0);
}

function exportLabelForState(state: string | null | undefined) {
  switch ((state ?? '').toUpperCase()) {
    case 'CA': return 'CA A-1-131 / eCPR XML';
    case 'WA': return 'WA F700-065 / L&I XML';
    case 'NY': return 'NY PW-12 / MPWR XML';
    case 'IL': return 'IL certified transcript';
    case 'MA': return 'MA DLS certified payroll';
    case 'NJ': return 'NJ MW-562';
    case 'TX': return 'TX CPR / WH-347';
    default: return 'Federal WH-347';
  }
}

function scoreIssues(issues: SubmitReadyIssue[]) {
  if (issues.length === 0) return 0;
  const points = issues.reduce((sum, issue) => {
    if (issue.severity === 'pass') return sum + 1;
    if (issue.severity === 'warning') return sum + 0.55;
    return sum;
  }, 0);
  return Math.round((points / issues.length) * 100);
}

function statusFromCounts(blockers: number, warnings: number, submitted: boolean): SubmitReadyResult['status'] {
  if (submitted) return 'submitted';
  if (blockers > 0) return 'not_ready';
  if (warnings > 0) return 'needs_review';
  return 'ready';
}

export async function computeSubmitReady(
  db: BetterSQLite3Database<typeof schema>,
  weekId: string,
): Promise<SubmitReadyResult | null> {
  const week = await getPayrollWeek(weekId);
  if (!week) return null;

  const [project] = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, week.projectId))
    .limit(1);
  if (!project) return null;

  const entries = await getPayrollEntries(weekId);
  const rawEntries: PayrollEntrySelect[] = entries.map((row: Awaited<ReturnType<typeof getPayrollEntries>>[number]) => row.entry);
  const compliance = await computeCompliance(db, weekId);
  const profile = resolveComplianceProfile(project);
  const issues: SubmitReadyIssue[] = [];

  issues.push({
    id: 'project-selected',
    category: 'project',
    severity: 'pass',
    title: 'Project selected',
    detail: `${project.name} in ${project.county}, ${project.state}. Rule profile: ${profile.label}.`,
  });

  const pinnedWds = await db
    .select({
      wdNumber: schema.wageDeterminations.wdNumber,
      revisionNumber: schema.wageDeterminations.revisionNumber,
      isPrimary: schema.projectWageDeterminations.isPrimary,
      pinnedAt: schema.projectWageDeterminations.pinnedAt,
    })
    .from(schema.projectWageDeterminations)
    .innerJoin(
      schema.wageDeterminations,
      eq(schema.projectWageDeterminations.wageDeterminationId, schema.wageDeterminations.id),
    )
    .where(eq(schema.projectWageDeterminations.projectId, project.id));

  const primaryPinnedWd = pinnedWds.find((wd) => wd.isPrimary) ?? pinnedWds[0];
  if (project.contractType === 'federal-davis-bacon' && !project.wdIdentifier && pinnedWds.length === 0) {
    issues.push({
      id: 'wd-lock',
      category: 'wage_determination',
      severity: 'blocker',
      title: 'Wage determination not locked',
      detail: 'Federal Davis-Bacon projects need a confirmed WD number/modification before clean filing.',
      actionId: 'prepare-missing-wd',
    });
  } else {
    issues.push({
      id: 'wd-lock',
      category: 'wage_determination',
      severity: project.wdIdentifier || pinnedWds.length > 0 ? 'pass' : 'warning',
      title: project.wdIdentifier || primaryPinnedWd ? 'Wage determination confirmed' : 'Wage determination source',
      detail: project.wdIdentifier
        ? `${project.wdIdentifier}${project.wdModNumber != null ? ` revision ${project.wdModNumber}` : ''}`
        : primaryPinnedWd
          ? `${primaryPinnedWd.wdNumber} revision ${primaryPinnedWd.revisionNumber} is pinned as the project wage source.`
          : 'No WD lock is required by this project type, but confirm the source before export.',
    });
  }

  if (entries.length === 0) {
    issues.push({
      id: 'payroll-entries',
      category: 'payroll',
      severity: 'blocker',
      title: 'No payroll entries',
      detail: 'Import payroll or enter worker hours before generating certified payroll.',
      actionId: 'prepare-import-review',
    });
  } else {
    issues.push({
      id: 'payroll-entries',
      category: 'payroll',
      severity: 'pass',
      title: 'Payroll entries recorded',
      detail: `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} with ${rawEntries.reduce((sum: number, entry: PayrollEntrySelect) => sum + totalHours(entry), 0).toFixed(1)} total hours.`,
    });
  }

  const incompletePayRows = rawEntries.filter((entry: PayrollEntrySelect) => entry.grossWages == null || entry.netPay == null);
  const zeroRateRows = rawEntries.filter((entry: PayrollEntrySelect) => entry.baseRateSnapshot === 0 && entry.fringeRateSnapshot === 0);
  if (incompletePayRows.length > 0) {
    issues.push({
      id: 'pay-calculation',
      category: 'payroll',
      severity: 'blocker',
      title: 'Gross/net pay incomplete',
      detail: `${incompletePayRows.length} payroll entr${incompletePayRows.length === 1 ? 'y is' : 'ies are'} missing gross or net pay.`,
      actionId: 'review-week-violations',
    });
  } else if (zeroRateRows.length > 0) {
    issues.push({
      id: 'rate-snapshots',
      category: 'payroll',
      severity: 'warning',
      title: 'Zero rate snapshots',
      detail: `${zeroRateRows.length} entr${zeroRateRows.length === 1 ? 'y has' : 'ies have'} zero base/fringe snapshots. Confirm the import or fill from the pinned WD.`,
      actionId: 'prepare-import-review',
    });
  } else if (entries.length > 0) {
    issues.push({
      id: 'pay-calculation',
      category: 'payroll',
      severity: 'pass',
      title: 'Pay math present',
      detail: 'All payroll entries include gross and net pay.',
    });
  }

  const complianceIssueCount = compliance ? countComplianceViolations(compliance) : 0;
  if (complianceIssueCount > 0) {
    issues.push({
      id: 'compliance-review',
      category: 'compliance',
      severity: 'blocker',
      title: 'Compliance review issues block filing',
      detail: `${complianceIssueCount} wage, overtime, non-tax deduction, apprentice, or week-level issue(s) need review.`,
      actionId: 'review-week-violations',
    });
  } else if (entries.length > 0) {
    issues.push({
      id: 'compliance-review',
      category: 'compliance',
      severity: 'pass',
      title: 'Automated checks clear',
      detail: 'No blocking wage, overtime, non-tax deduction, or apprentice issue was detected. Final certification still requires human review.',
    });
  }

  issues.push({
    id: 'human-certification-review',
    category: 'compliance',
    severity: 'warning',
    title: 'Human certification review required',
    detail: `Before signing, confirm: ${profile.humanReviewRequired.slice(0, 3).join('; ')}.`,
    actionId: 'review-week-violations',
  });

  const [signature] = await db
    .select({ id: schema.contractorSignatures.id })
    .from(schema.contractorSignatures)
    .where(eq(schema.contractorSignatures.projectId, project.id))
    .limit(1);
  issues.push({
    id: 'signature',
    category: 'signature',
    severity: signature ? 'pass' : 'warning',
    title: signature ? 'Signature on file' : 'Signature missing',
    detail: signature
      ? 'A contractor signature is saved for this project.'
      : 'Add a contractor signature before final package generation when a signed statement is required.',
  });

  const subs = await db
    .select()
    .from(schema.subcontractors)
    .where(eq(schema.subcontractors.projectId, project.id));
  if (subs.length > 0) {
    const cprRows = await db
      .select({
        subId: schema.subcontractorCprWeeks.subcontractorId,
        receivedDate: schema.subcontractorCprWeeks.receivedDate,
        isCompliant: schema.subcontractorCprWeeks.isCompliant,
      })
      .from(schema.subcontractorCprWeeks)
      .where(eq(schema.subcontractorCprWeeks.weekEndingDate, week.weekEndingDate));
    const cprBySub = new Map(cprRows.map((row) => [row.subId, row]));
    const missing = subs.filter((sub) => !cprBySub.has(sub.id));
    const nonCompliant = subs.filter((sub) => cprBySub.get(sub.id)?.isCompliant === 0);
    const pending = subs.filter((sub) => {
      const row = cprBySub.get(sub.id);
      return row && row.isCompliant !== 1;
    });

    if (nonCompliant.length > 0) {
      issues.push({
        id: 'subcontractor-cpr',
        category: 'subcontractor',
        severity: 'blocker',
        title: 'Subcontractor CPR non-compliant',
        detail: `${nonCompliant.length} subcontractor CPR record(s) are marked non-compliant for this week.`,
      });
    } else if (missing.length > 0 || pending.length > 0) {
      issues.push({
        id: 'subcontractor-cpr',
        category: 'subcontractor',
        severity: 'warning',
        title: 'Subcontractor CPR follow-up',
        detail: `${missing.length} missing and ${pending.length} pending subcontractor CPR record(s) for this week.`,
      });
    } else {
      issues.push({
        id: 'subcontractor-cpr',
        category: 'subcontractor',
        severity: 'pass',
        title: 'Subcontractor CPRs tracked',
        detail: 'All subcontractor CPR records for this week are marked compliant.',
      });
    }
  }

  const [latestImport] = await db
    .select()
    .from(schema.payrollImports)
    .where(eq(schema.payrollImports.payrollWeekId, weekId))
    .orderBy(desc(schema.payrollImports.createdAt))
    .limit(1);
  if (latestImport) {
    issues.push({
      id: 'import-review',
      category: 'import',
      severity: latestImport.unmatchedCount > 0 ? 'warning' : 'pass',
      title: 'Import review',
      detail: `${latestImport.provider} import committed ${latestImport.committedCount}; unmatched ${latestImport.unmatchedCount}.`,
      actionId: latestImport.unmatchedCount > 0 ? 'prepare-import-review' : undefined,
    });
  } else if (entries.length > 0) {
    issues.push({
      id: 'import-review',
      category: 'import',
      severity: 'warning',
      title: 'No import audit',
      detail: 'Payroll may have been entered manually. Confirm worker/classification/rate mappings before export.',
      actionId: 'prepare-import-review',
    });
  }

  const exportReady = entries.length > 0 && incompletePayRows.length === 0 && complianceIssueCount === 0;
  issues.push({
    id: 'export-readiness',
    category: 'export',
    severity: exportReady ? 'pass' : 'blocker',
    title: exportReady ? 'Export can be prepared' : 'Export not ready',
    detail: `${exportLabelForState(project.state)} should be generated only after blockers are cleared.`,
  });

  const blockers = issues.filter((issue) => issue.severity === 'blocker').length;
  const warnings = issues.filter((issue) => issue.severity === 'warning').length;
  const passes = issues.filter((issue) => issue.severity === 'pass').length;
  const status = statusFromCounts(blockers, warnings, Boolean(week.submittedAt));
  const score = status === 'submitted' ? 100 : scoreIssues(issues);
  const headline =
    status === 'ready'
      ? 'This payroll week is ready for final human review and export.'
      : status === 'needs_review'
        ? 'This payroll week can move forward after reviewer warnings are confirmed.'
        : status === 'submitted'
          ? 'This payroll week has been marked submitted.'
          : 'This payroll week is not ready to submit.';

  return {
    weekId,
    projectId: project.id,
    score,
    status,
    headline,
    blockers,
    warnings,
    passes,
    issues,
    summary: {
      entryCount: entries.length,
      totalHours: rawEntries.reduce((sum: number, entry: PayrollEntrySelect) => sum + totalHours(entry), 0),
      grossWages: rawEntries.reduce((sum: number, entry: PayrollEntrySelect) => sum + (entry.grossWages ?? 0), 0),
      complianceIssueCount,
      exportFormat: exportLabelForState(project.state),
    },
  };
}
