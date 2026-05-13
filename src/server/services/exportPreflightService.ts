import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema.js';
import { getDb } from '../db/index.js';
import { getPayrollEntriesWithWorkerDetails, getPayrollWeek } from './payrollService.js';
import { computeCompliance } from './complianceService.js';
import { countComplianceViolations, getEntryHourTotals } from './complianceRules.js';

export type ExportPreflightFormat = 'wh347' | 'a1131' | 'ecpr-xml';
export type ExportPreflightSeverity = 'blocker' | 'warning' | 'pass';
export type ExportPreflightCategory = 'project' | 'worker' | 'payroll' | 'compliance' | 'fringe' | 'review';

export interface ExportPreflightIssue {
  id: string;
  category: ExportPreflightCategory;
  severity: ExportPreflightSeverity;
  title: string;
  detail: string;
  workerId?: string;
  entryId?: string;
  fix?: {
    label: string;
    href: string;
  };
}

export interface ExportPreflightResult {
  weekId: string;
  projectId: string;
  format: ExportPreflightFormat;
  status: 'blocked' | 'needs_review' | 'ready';
  blockers: number;
  warnings: number;
  passes: number;
  generatedAt: string;
  issues: ExportPreflightIssue[];
  summary: {
    entryCount: number;
    totalHours: number;
    exportLabel: string;
  };
}

export interface ExportPreflightOverrides {
  contractorFein?: string;
  dirProjectId?: string;
  awardingAgency?: string;
  contractNumber?: string;
}

const EXPORT_LABELS: Record<ExportPreflightFormat, string> = {
  wh347: 'WH-347',
  a1131: 'California A-1-131',
  'ecpr-xml': 'California eCPR XML',
};

function addIssue(issues: ExportPreflightIssue[], issue: ExportPreflightIssue) {
  issues.push(issue);
}

function projectSettingsFix(projectId: string, field: string, label = 'Complete project field') {
  return { label, href: `/projects/${projectId}/settings?field=${encodeURIComponent(field)}` };
}

function workerFix(projectId: string, workerId: string, label = 'Open worker') {
  return { label, href: `/projects/${projectId}/workers?workerId=${encodeURIComponent(workerId)}` };
}

function payrollEntryFix(projectId: string, weekId: string, entryId: string, label = 'Open payroll row') {
  return { label, href: `/projects/${projectId}/payroll/${weekId}/edit?entryId=${encodeURIComponent(entryId)}` };
}

function addPass(issues: ExportPreflightIssue[], id: string, title: string, detail: string) {
  addIssue(issues, { id, category: 'review', severity: 'pass', title, detail });
}

function present(value: unknown): boolean {
  return typeof value === 'string' ? value.trim().length > 0 : value !== null && value !== undefined;
}

function normalizedFein(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

function hasStructuredAddress(address: string | null | undefined): boolean {
  const raw = (address ?? '').trim();
  if (!raw) return false;
  const parts = raw.split(',').map((part) => part.trim()).filter(Boolean);
  return parts.length >= 3 && /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/i.test(raw);
}

export function isExportPreflightFormat(value: string): value is ExportPreflightFormat {
  return value === 'wh347' || value === 'a1131' || value === 'ecpr-xml';
}

export async function computeExportPreflight(
  _db: BetterSQLite3Database<typeof schema>,
  weekId: string,
  format: ExportPreflightFormat,
  overrides: ExportPreflightOverrides = {},
): Promise<ExportPreflightResult | null> {
  const db = getDb();
  const week = await getPayrollWeek(weekId);
  if (!week) return null;

  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, week.projectId)).limit(1);
  if (!project) return null;

  const rows = await getPayrollEntriesWithWorkerDetails(weekId);
  const compliance = await computeCompliance(db, weekId);
  const issues: ExportPreflightIssue[] = [];
  const totalHours = rows.reduce(
    (sum: number, row: Awaited<ReturnType<typeof getPayrollEntriesWithWorkerDetails>>[number]) =>
      sum + getEntryHourTotals(row.entry).total,
    0,
  );
  const state = project.state.toUpperCase();

  if (rows.length === 0) {
      addIssue(issues, {
        id: 'payroll-no-entries',
        category: 'payroll',
        severity: 'blocker',
        title: 'No payroll entries',
        detail: 'Add payroll entries before generating a certified payroll export.',
        fix: { label: 'Add payroll entries', href: `/projects/${week.projectId}/payroll/${weekId}/edit` },
      });
  } else {
    addPass(issues, 'payroll-entries-present', 'Payroll entries present', `${rows.length} payroll row(s) will be reviewed.`);
  }

  for (const row of rows) {
    const e = row.entry;
    if (e.grossWages === null || e.grossWages === undefined || e.netPay === null || e.netPay === undefined) {
      addIssue(issues, {
        id: `payroll-pay-fields-${e.id}`,
        category: 'payroll',
        severity: 'blocker',
        title: 'Missing gross or net pay',
        detail: `${row.workerName} is missing gross wages or net pay required by the export.`,
        workerId: e.workerId,
        entryId: e.id,
        fix: payrollEntryFix(week.projectId, weekId, e.id, 'Enter gross/net pay'),
      });
    }

    if (!row.tradeDescription || !row.tradeCode || !row.laborType) {
      addIssue(issues, {
        id: `worker-classification-${e.id}`,
        category: 'worker',
        severity: 'blocker',
        title: 'Missing classification',
        detail: `${row.workerName} needs a trade, classification code, and labor type before export.`,
        workerId: e.workerId,
        entryId: e.id,
        fix: workerFix(week.projectId, e.workerId, 'Fix classification'),
      });
    }

    if ((format === 'a1131' || format === 'ecpr-xml') && !hasStructuredAddress(row.workerAddress)) {
      addIssue(issues, {
        id: `worker-address-${e.workerId}`,
        category: 'worker',
        severity: 'blocker',
        title: 'Worker address incomplete',
        detail: `${row.workerName} needs street, city, state, and ZIP before California export.`,
        workerId: e.workerId,
        entryId: e.id,
        fix: workerFix(week.projectId, e.workerId, 'Complete worker address'),
      });
    }

    if (format === 'wh347' && !present(row.workerSsnLast4)) {
      addIssue(issues, {
        id: `worker-identifier-${e.workerId}`,
        category: 'worker',
        severity: 'warning',
        title: 'Worker identifier missing',
        detail: `${row.workerName} does not have SSN last-four on file; confirm the WH-347 identifying number before submission.`,
        workerId: e.workerId,
        entryId: e.id,
        fix: workerFix(week.projectId, e.workerId, 'Add worker identifier'),
      });
    }

    if ((format === 'a1131' || format === 'ecpr-xml') && row.laborType === 'apprentice' && !present(row.programName)) {
      addIssue(issues, {
        id: `apprentice-program-${e.id}`,
        category: 'worker',
        severity: 'blocker',
        title: 'Apprentice program missing',
        detail: `${row.workerName} is marked apprentice but has no registered program name.`,
        workerId: e.workerId,
        entryId: e.id,
        fix: workerFix(week.projectId, e.workerId, 'Add apprentice program'),
      });
    }

    if (format === 'ecpr-xml') {
      const fringeParts = [
        e.fringeHealthWelfare,
        e.fringePension,
        e.fringeVacation,
        e.fringeTraining,
      ];
      const hasBreakdown = fringeParts.some((part) => part !== null && part !== undefined);
      const breakdownTotal = fringeParts.reduce((sum, part) => sum + Number(part ?? 0), 0);
      const snapshot = Number(e.fringeRateSnapshot ?? 0);
      if (snapshot > 0 && !hasBreakdown) {
        addIssue(issues, {
          id: `ecpr-fringe-breakdown-${e.id}`,
          category: 'fringe',
          severity: 'blocker',
          title: 'Fringe breakdown missing',
          detail: `${row.workerName} has a fringe rate but no health, pension, vacation, or training split for eCPR.`,
          workerId: e.workerId,
          entryId: e.id,
          fix: payrollEntryFix(week.projectId, weekId, e.id, 'Add fringe split'),
        });
      } else if (hasBreakdown && Math.abs(breakdownTotal - snapshot) > 0.01) {
        addIssue(issues, {
          id: `ecpr-fringe-breakdown-${e.id}`,
          category: 'fringe',
          severity: 'blocker',
          title: 'Fringe breakdown mismatch',
          detail: `${row.workerName} has fringe subfields totaling $${breakdownTotal.toFixed(2)}, but the frozen fringe snapshot is $${snapshot.toFixed(2)}.`,
          workerId: e.workerId,
          entryId: e.id,
          fix: payrollEntryFix(week.projectId, weekId, e.id, 'Fix fringe split'),
        });
      }
    }
  }

  if (format === 'wh347') {
    const needsWd = project.contractType === 'federal-davis-bacon' || project.fundingType === 'federal' || project.fundingType === 'mixed';
    if (needsWd && !present(project.wdIdentifier)) {
      addIssue(issues, {
        id: 'project-wage-determination',
        category: 'project',
        severity: 'blocker',
        title: 'Wage determination missing',
        detail: 'Federal WH-347 exports should be tied to the locked wage determination used for the payroll calculation.',
        fix: { label: 'Pin wage determination', href: `/projects/${week.projectId}#wage-determinations` },
      });
    }
  }

  if (format === 'a1131' || format === 'ecpr-xml') {
    if (state !== 'CA') {
      addIssue(issues, {
        id: 'project-state-ca',
        category: 'project',
        severity: 'blocker',
        title: 'California project required',
        detail: `${EXPORT_LABELS[format]} is only available for California projects.`,
        fix: projectSettingsFix(week.projectId, 'state', 'Review project state'),
      });
    }
    if (!present(project.cslbLicense)) {
      addIssue(issues, {
        id: 'ca-cslb-license',
        category: 'project',
        severity: 'blocker',
        title: 'CSLB license missing',
        detail: 'Add the contractor CSLB license number to the project before California export.',
        fix: projectSettingsFix(week.projectId, 'cslbLicense', 'Add CSLB license'),
      });
    }
    if (!present(project.wcPolicyNumber)) {
      addIssue(issues, {
        id: 'ca-wc-policy',
        category: 'project',
        severity: 'blocker',
        title: 'Workers compensation policy missing',
        detail: 'Add the workers compensation policy number before California export.',
        fix: projectSettingsFix(week.projectId, 'wcPolicyNumber', 'Add WC policy'),
      });
    }
  }

  if (format === 'ecpr-xml') {
    const fein = normalizedFein(overrides.contractorFein ?? project.contractorFein);
    const dirProjectId = overrides.dirProjectId ?? project.dirProjectId;
    const awardingAgency = overrides.awardingAgency ?? project.awardingAgency;
    const contractNumber = overrides.contractNumber ?? project.contractNumber;

    if (!/^\d{9}$/.test(fein)) {
      addIssue(issues, {
        id: 'ecpr-contractor-fein',
        category: 'project',
        severity: 'blocker',
        title: fein ? 'Contractor FEIN invalid' : 'Contractor FEIN required',
        detail: fein
          ? `Contractor FEIN must be exactly 9 digits. Current value has ${fein.length} digit(s).`
          : 'Enter a 9-digit contractor FEIN before generating California eCPR XML.',
        fix: projectSettingsFix(week.projectId, 'contractorFein', 'Add FEIN'),
      });
    }
    if (!present(dirProjectId)) {
      addIssue(issues, {
        id: 'ecpr-dir-project-id',
        category: 'project',
        severity: 'blocker',
        title: 'DIR project ID missing',
        detail: 'Enter the California DIR project ID before generating eCPR XML.',
        fix: projectSettingsFix(week.projectId, 'dirProjectId', 'Add DIR ID'),
      });
    }
    if (!present(awardingAgency)) {
      addIssue(issues, {
        id: 'ecpr-awarding-agency',
        category: 'project',
        severity: 'blocker',
        title: 'Awarding agency missing',
        detail: 'Enter the awarding agency name before generating eCPR XML.',
        fix: projectSettingsFix(week.projectId, 'awardingAgency', 'Add agency'),
      });
    }
    if (!present(contractNumber)) {
      addIssue(issues, {
        id: 'ecpr-contract-number',
        category: 'project',
        severity: 'blocker',
        title: 'Contract number missing',
        detail: 'Enter the contract number before generating eCPR XML.',
        fix: projectSettingsFix(week.projectId, 'contractNumber', 'Add contract number'),
      });
    }
  }

  if (compliance && countComplianceViolations(compliance) > 0) {
    addIssue(issues, {
      id: 'compliance-violations',
      category: 'compliance',
      severity: 'blocker',
      title: 'Compliance violations detected',
      detail: `${countComplianceViolations(compliance)} wage, overtime, apprentice, or deduction issue(s) must be resolved before export.`,
      fix: { label: 'Review compliance issues', href: `/projects/${week.projectId}/payroll/${weekId}#compliance` },
    });
  } else {
    addPass(issues, 'compliance-clear', 'Compliance checks clear', 'No wage, overtime, apprentice, or deduction violations were found for this week.');
  }

  addIssue(issues, {
    id: 'human-review',
    category: 'review',
    severity: 'warning',
    title: 'Human certification required',
    detail: 'Review the generated file against source payroll records before certifying or submitting it.',
  });

  const blockers = issues.filter((issue) => issue.severity === 'blocker').length;
  const warnings = issues.filter((issue) => issue.severity === 'warning').length;
  const passes = issues.filter((issue) => issue.severity === 'pass').length;

  return {
    weekId,
    projectId: week.projectId,
    format,
    status: blockers > 0 ? 'blocked' : warnings > 0 ? 'needs_review' : 'ready',
    blockers,
    warnings,
    passes,
    generatedAt: new Date().toISOString(),
    issues,
    summary: {
      entryCount: rows.length,
      totalHours,
      exportLabel: EXPORT_LABELS[format],
    },
  };
}
