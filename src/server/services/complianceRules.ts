import type { ComplianceViolation, DeductionViolation, WeekViolation } from './complianceService.js';
import { calculateCertifiedPayrollPay } from './calculations.js';

export const COMPLIANCE_METHODOLOGY_VERSION = '2026.05-prevailing-wage-v1';

export type ComplianceProfileId =
  | 'federal-dbra-cwhssa'
  | 'california-public-works'
  | 'mixed-federal-state'
  | 'state-prevailing'
  | 'private-advisory';

export interface ComplianceRuleProfile {
  id: ComplianceProfileId;
  label: string;
  appliesWhen: string;
  checks: string[];
  humanReviewRequired: string[];
  primarySources: Array<{ label: string; url: string }>;
}

export const COMPLIANCE_RULE_PROFILES: Record<ComplianceProfileId, ComplianceRuleProfile> = {
  'federal-dbra-cwhssa': {
    id: 'federal-dbra-cwhssa',
    label: 'Federal DBRA / CWHSSA',
    appliesWhen: 'Federal Davis-Bacon or federally assisted construction payroll.',
    checks: [
      'Worker gross wages are tested against the base plus fringe rate snapshot for the classification actually paid.',
      'Fringe benefit credit is applied to all hours at straight-time value and is not multiplied for overtime.',
      'CWHSSA weekly overtime is checked for hours over 40, including import errors where overtime hours were left in straight-time buckets.',
      'Multi-classification workweeks over 40 hours are flagged for documented rate-in-effect or weighted-average overtime review.',
      'Apprentice payroll rows require a registered apprenticeship program name.',
      'Non-tax deductions above the review threshold are flagged for supporting records.',
    ],
    humanReviewRequired: [
      'Confirm the selected labor classification matches the work actually performed.',
      'Confirm any fringe credit claimed is bona fide and supported by plan records.',
      'Confirm apprentice registration, progression level, and program-specific fringe rules.',
      'Confirm deduction authorization and jurisdiction-specific deduction limits.',
      'Sign the Statement of Compliance only after reviewing payroll records.',
    ],
    primarySources: [
      { label: 'DOL WH-347 Instructions', url: 'https://www.dol.gov/agencies/whd/forms/wh347' },
      { label: 'DOL DBRA Compliance Principles', url: 'https://www.dol.gov/agencies/whd/government-contracts/prevailing-wage-resource-book/db-compliance-principles' },
    ],
  },
  'california-public-works': {
    id: 'california-public-works',
    label: 'California Public Works',
    appliesWhen: 'California public works prevailing wage payroll.',
    checks: [
      'California daily overtime and double-time buckets are checked against daily hour totals.',
      'California export fields and fringe disaggregation are prepared where available.',
      'Apprentice and journeyworker hours can be reviewed by configured trade ratio.',
      'Federal checks also apply when the project is federally funded or contract type is federal Davis-Bacon.',
    ],
    humanReviewRequired: [
      'Confirm DIR project, contractor registration, and awarding-body filing requirements.',
      'Confirm applicable California wage determination, predetermined increases, holidays, and scope notes.',
      'Confirm apprentice dispatch/program requirements and ratio source.',
    ],
    primarySources: [
      { label: 'California DIR Prevailing Wage', url: 'https://www.dir.ca.gov/public-works/prevailing-wage.html' },
      { label: 'California Prevailing Wage FAQ', url: 'https://www.dir.ca.gov/dlse/FAQ_PrevailingWage.html' },
    ],
  },
  'mixed-federal-state': {
    id: 'mixed-federal-state',
    label: 'Mixed Federal + State Prevailing Wage',
    appliesWhen: 'Projects with federal funding and state prevailing wage obligations.',
    checks: [
      'Federal DBRA/CWHSSA checks run first.',
      'State-specific overtime, export, and apprenticeship checks run where implemented.',
      'Submit-ready status blocks filing when either automated layer has blocking issues.',
    ],
    humanReviewRequired: [
      'Confirm which standard is more protective for each classification and hour type.',
      'Confirm agency-specific submission package requirements.',
      'Confirm state-specific certified payroll fields not captured by WH-347.',
    ],
    primarySources: [
      { label: 'DOL WH-347 Instructions', url: 'https://www.dol.gov/agencies/whd/forms/wh347' },
      { label: 'State labor agency guidance', url: 'https://www.dol.gov/agencies/whd/state/contacts' },
    ],
  },
  'state-prevailing': {
    id: 'state-prevailing',
    label: 'State Prevailing Wage',
    appliesWhen: 'State prevailing wage projects without federal Davis-Bacon coverage.',
    checks: [
      'State export format and state-specific project fields are used when implemented.',
      'Base/fringe rate snapshots are preserved on payroll entries for auditability.',
      'Configured apprenticeship ratio checks run when project requirements are provided.',
    ],
    humanReviewRequired: [
      'Confirm state wage determination, scope notes, and reporting format.',
      'Confirm local overtime, holiday, and deduction rules not yet automated for the state.',
    ],
    primarySources: [
      { label: 'State labor agency contacts', url: 'https://www.dol.gov/agencies/whd/state/contacts' },
    ],
  },
  'private-advisory': {
    id: 'private-advisory',
    label: 'Private / Advisory',
    appliesWhen: 'Private projects or internal wage review where prevailing wage rules may not apply.',
    checks: [
      'Payroll math and rate snapshots remain available for internal review.',
      'Certified payroll submission readiness is advisory only.',
    ],
    humanReviewRequired: [
      'Confirm whether any public funding, tax credit, PLA, or local ordinance triggers prevailing wage obligations.',
    ],
    primarySources: [],
  },
};

export function resolveComplianceProfile(project: {
  state?: string | null;
  contractType?: string | null;
  fundingType?: string | null;
}): ComplianceRuleProfile {
  const state = (project.state ?? '').toUpperCase();
  const isFederal = project.contractType === 'federal-davis-bacon' || project.fundingType === 'federal';
  const isMixed = project.fundingType === 'mixed';

  if ((isFederal || isMixed) && state === 'CA') return COMPLIANCE_RULE_PROFILES['mixed-federal-state'];
  if (isFederal) return COMPLIANCE_RULE_PROFILES['federal-dbra-cwhssa'];
  if (state === 'CA') return COMPLIANCE_RULE_PROFILES['california-public-works'];
  if (project.contractType === 'state-prevailing') return COMPLIANCE_RULE_PROFILES['state-prevailing'];
  return COMPLIANCE_RULE_PROFILES['private-advisory'];
}

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type DayKey = typeof DAYS[number];

export interface PayrollEntryLike {
  id: string;
  workerId: string;
  monSt?: number | null;
  tueSt?: number | null;
  wedSt?: number | null;
  thuSt?: number | null;
  friSt?: number | null;
  satSt?: number | null;
  sunSt?: number | null;
  monOt?: number | null;
  tueOt?: number | null;
  wedOt?: number | null;
  thuOt?: number | null;
  friOt?: number | null;
  satOt?: number | null;
  sunOt?: number | null;
  monDt?: number | null;
  tueDt?: number | null;
  wedDt?: number | null;
  thuDt?: number | null;
  friDt?: number | null;
  satDt?: number | null;
  sunDt?: number | null;
  baseRateSnapshot: number;
  fringeRateSnapshot: number;
  grossWages?: number | null;
  deductions?: number | null;
}

export interface ComplianceRowLike {
  entry: PayrollEntryLike;
  workerName: string;
  tradeDescription: string;
  laborType: string;
  programName?: string | null;
}

export function getEntryHourTotals(e: PayrollEntryLike) {
  let straightTime = 0;
  let overtime = 0;
  let doubleTime = 0;

  for (const day of DAYS) {
    straightTime += Number(e[`${day}St` as keyof PayrollEntryLike] ?? 0);
    overtime += Number(e[`${day}Ot` as keyof PayrollEntryLike] ?? 0);
    doubleTime += Number(e[`${day}Dt` as keyof PayrollEntryLike] ?? 0);
  }

  return {
    straightTime,
    overtime,
    doubleTime,
    total: straightTime + overtime + doubleTime,
  };
}

export function getDayHours(e: PayrollEntryLike, day: DayKey) {
  const straightTime = Number(e[`${day}St` as keyof PayrollEntryLike] ?? 0);
  const overtime = Number(e[`${day}Ot` as keyof PayrollEntryLike] ?? 0);
  const doubleTime = Number(e[`${day}Dt` as keyof PayrollEntryLike] ?? 0);
  return {
    straightTime,
    overtime,
    doubleTime,
    total: straightTime + overtime + doubleTime,
  };
}

export function expectedGrossForEntry(e: PayrollEntryLike): number {
  const totals = getEntryHourTotals(e);
  return calculateCertifiedPayrollPay({
    baseRate: e.baseRateSnapshot,
    fringeRate: e.fringeRateSnapshot,
    straightTimeHours: totals.straightTime,
    overtimeHours: totals.overtime,
    doubleTimeHours: totals.doubleTime,
  }).totalWeeklyCost;
}

export function detectDeductionViolations(rows: ComplianceRowLike[]): DeductionViolation[] {
  const cap = 0.30;
  const violations: DeductionViolation[] = [];

  for (const row of rows) {
    const gross = row.entry.grossWages;
    const deductions = row.entry.deductions ?? 0;
    if (!gross || gross <= 0 || deductions <= 0) continue;

    // BUG-09: 29 CFR §3.5 deduction cap applies only to non-tax deductions.
    // FICA, federal income tax, and state income tax are statutory and excluded from the cap.
    // Accessing these fields via type assertion since PayrollEntryLike may not declare them.
    const entryAny = row.entry as Record<string, unknown>;
    const ficaTax = Number(entryAny['ficaTax'] ?? 0);
    const federalIncomeTax = Number(entryAny['federalIncomeTax'] ?? 0);
    const stateIncomeTax = Number(entryAny['stateIncomeTax'] ?? 0);
    const nonTaxDeductions = Math.max(0, deductions - ficaTax - federalIncomeTax - stateIncomeTax);

    const ratio = nonTaxDeductions / gross;
    if (ratio > cap) {
      violations.push({
        violationType: 'deduction-ratio',
        entryId: row.entry.id,
        workerId: row.entry.workerId,
        workerName: row.workerName,
        deductions,
        grossWages: gross,
        deductionPct: Math.round(ratio * 1000) / 10,
      });
    }
  }

  return violations;
}

function parseRatio(maxRatio: string): number {
  const [numeratorRaw, denominatorRaw] = maxRatio.split(':').map(Number);
  const numerator = Number.isFinite(numeratorRaw) && numeratorRaw > 0 ? numeratorRaw : 1;
  const denominator = Number.isFinite(denominatorRaw) && denominatorRaw > 0 ? denominatorRaw : 1;
  return numerator / denominator;
}

function tradeMatches(actualTrade: string, configuredTrade: string): boolean {
  const actual = actualTrade.toLowerCase();
  const configured = configuredTrade.toLowerCase();
  return actual.includes(configured) || configured.includes(actual);
}

export function detectDailyTradeApprenticeRatioViolations(
  rows: ComplianceRowLike[],
  ratioConfig: Record<string, { maxRatio: string }>,
): WeekViolation[] {
  const violations: WeekViolation[] = [];

  for (const [configTrade, { maxRatio }] of Object.entries(ratioConfig)) {
    const ratio = parseRatio(maxRatio);

    for (const day of DAYS) {
      let jwHours = 0;
      let appHours = 0;
      let appRateWeighted = 0;
      let jwRateWeighted = 0;

      for (const row of rows) {
        if (!tradeMatches(row.tradeDescription, configTrade)) continue;

        const dayHours = getDayHours(row.entry, day).total;
        if (dayHours <= 0) continue;

        if (row.laborType === 'apprentice') {
          appHours += dayHours;
          appRateWeighted += row.entry.baseRateSnapshot * dayHours;
        } else if (row.laborType === 'journeyworker' || row.laborType === 'foreman') {
          jwHours += dayHours;
          jwRateWeighted += row.entry.baseRateSnapshot * dayHours;
        }
      }

      if (jwHours === 0 || appHours === 0) continue;

      const maxAllowedApp = jwHours * ratio;
      if (appHours <= maxAllowedApp + 0.001) continue;

      const excessHours = appHours - maxAllowedApp;
      const avgJwRate = jwRateWeighted / jwHours;
      const avgAppRate = appRateWeighted / appHours;
      const estimatedLiabilityUsd = Math.round(excessHours * Math.max(0, avgJwRate - avgAppRate) * 100) / 100;
      const dayLabel = day[0].toUpperCase() + day.slice(1);

      violations.push({
        violationType: 'apprentice-trade-ratio',
        detail: `Trade: ${configTrade} (${dayLabel}) - ${appHours.toFixed(1)} apprentice hrs vs ${jwHours.toFixed(1)} JW hrs (max ratio ${maxRatio}). Excess: ${excessHours.toFixed(1)} hrs. Est. wage adjustment: $${estimatedLiabilityUsd.toFixed(2)}`,
        apprenticeHours: appHours,
        journeyworkerHours: jwHours,
        maxAllowedApprenticeHours: maxAllowedApp,
        trade: configTrade,
        excessHours,
        estimatedLiabilityUsd,
      });
    }
  }

  return violations;
}

export function countComplianceViolations(result: {
  violations: unknown[];
  weekViolations: unknown[];
  deductionViolations?: unknown[];
}): number {
  return result.violations.length + result.weekViolations.length + (result.deductionViolations?.length ?? 0);
}

export interface ComplianceViolationBreakdown {
  wage: number;
  week: number;
  deduction: number;
  total: number;
  byType: Record<string, number>;
}

export function getComplianceViolationBreakdown(result: {
  violations: Array<{ violationType: string }>;
  weekViolations: Array<{ violationType: string }>;
  deductionViolations?: Array<{ violationType: string }>;
}): ComplianceViolationBreakdown {
  const byType: Record<string, number> = {};
  const addType = (type: string) => {
    byType[type] = (byType[type] ?? 0) + 1;
  };

  for (const violation of result.violations) addType(violation.violationType);
  for (const violation of result.weekViolations) addType(violation.violationType);
  for (const violation of result.deductionViolations ?? []) addType(violation.violationType);

  const wage = result.violations.length;
  const week = result.weekViolations.length;
  const deduction = result.deductionViolations?.length ?? 0;

  return {
    wage,
    week,
    deduction,
    total: wage + week + deduction,
    byType,
  };
}
