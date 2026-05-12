import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema.js';
import { computeCompliance } from './complianceService.js';
import { getEntryHourTotals, expectedGrossForEntry, COMPLIANCE_METHODOLOGY_VERSION, COMPLIANCE_RULE_PROFILES, resolveComplianceProfile } from './complianceRules.js';
import { getPayrollEntries, getPayrollWeek } from './payrollService.js';

export function getComplianceMethodology() {
  return {
    version: COMPLIANCE_METHODOLOGY_VERSION,
    generatedAt: new Date().toISOString(),
    positioning: 'Automated compliance review and certified payroll preparation. Final certification requires human review and signature.',
    profiles: Object.values(COMPLIANCE_RULE_PROFILES),
    notAutomated: [
      'Legal determination that the selected wage classification matches the work actually performed.',
      'Bona fide fringe plan validation and unfunded fringe approval.',
      'Independent verification of apprentice registration, level, and dispatch requirements.',
      'Jurisdiction-specific deduction legality beyond automated risk flags.',
      'Agency portal acceptance, final submission, and signer authority.',
    ],
  };
}

export async function buildWeekComplianceEvidence(
  db: BetterSQLite3Database<typeof schema>,
  weekId: string,
) {
  const week = await getPayrollWeek(weekId);
  if (!week) return null;

  const [project] = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, week.projectId))
    .limit(1);
  if (!project) return null;

  const entries = await getPayrollEntries(weekId);
  const compliance = await computeCompliance(db, weekId);
  const profile = resolveComplianceProfile(project);

  const pinnedWds = await db
    .select({
      wdNumber: schema.wageDeterminations.wdNumber,
      revisionNumber: schema.wageDeterminations.revisionNumber,
      source: schema.wageDeterminations.source,
      constructionType: schema.projectWageDeterminations.constructionType,
      isPrimary: schema.projectWageDeterminations.isPrimary,
      pinnedAt: schema.projectWageDeterminations.pinnedAt,
    })
    .from(schema.projectWageDeterminations)
    .innerJoin(
      schema.wageDeterminations,
      eq(schema.projectWageDeterminations.wageDeterminationId, schema.wageDeterminations.id),
    )
    .where(eq(schema.projectWageDeterminations.projectId, project.id));

  type PayrollEntryRow = Awaited<ReturnType<typeof getPayrollEntries>>[number];
  const payrollRows = entries.map((row: PayrollEntryRow) => {
    const totals = getEntryHourTotals(row.entry);
    const expectedGross = expectedGrossForEntry(row.entry);
    const actualGross = row.entry.grossWages ?? null;
    return {
      entryId: row.entry.id,
      workerId: row.entry.workerId,
      workerName: row.workerName,
      classificationId: row.entry.classificationId,
      tradeCode: row.tradeCode,
      tradeDescription: row.tradeDescription,
      laborType: row.laborType,
      programName: row.programName ?? null,
      hours: totals,
      rateSnapshot: {
        baseRate: row.entry.baseRateSnapshot,
        fringeRate: row.entry.fringeRateSnapshot,
      },
      expectedGross,
      actualGross,
      grossDelta: actualGross == null ? null : Math.round((actualGross - expectedGross) * 100) / 100,
      deductions: row.entry.deductions ?? 0,
      netPay: row.entry.netPay ?? null,
    };
  });

  return {
    methodologyVersion: COMPLIANCE_METHODOLOGY_VERSION,
    generatedAt: new Date().toISOString(),
    week: {
      id: week.id,
      payrollNumber: week.payrollNumber,
      weekEndingDate: week.weekEndingDate,
      submittedAt: week.submittedAt,
      submittedTo: week.submittedTo,
    },
    project: {
      id: project.id,
      name: project.name,
      state: project.state,
      county: project.county,
      contractType: project.contractType,
      fundingType: project.fundingType,
      wdIdentifier: project.wdIdentifier,
      wdModNumber: project.wdModNumber,
    },
    profile,
    wageDeterminations: pinnedWds,
    payrollRows,
    compliance,
    humanReviewChecklist: profile.humanReviewRequired,
  };
}
