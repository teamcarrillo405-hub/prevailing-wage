import type { payrollEntries } from '../db/schema.js';

type PayrollEntry = typeof payrollEntries.$inferSelect;

export interface PayrollSourceCoverage {
  grossPay: number;
  netPay: number;
  totalDeductions: number;
  taxBreakdown: number;
  deductionBreakdown: number;
  fringeBreakdown: number;
  checkNumber: number;
}

export interface PayrollSourceReconciliation {
  entryCount: number;
  completeSourceRows: number;
  coverage: PayrollSourceCoverage;
  fieldGaps: Array<{
    field: keyof PayrollSourceCoverage;
    label: string;
    missingCount: number;
    reason: string;
    nextAction: string;
  }>;
  itemizedDeductionMismatchCount: number;
  netPayMismatchCount: number;
  fringeMismatchCount: number;
  missingSourceDetailCount: number;
}

const moneyFields = [
  'deductionVacationHoliday',
  'deductionHealthWelfare',
  'deductionPension',
  'deductionTraining',
  'deductionFundAdmin',
  'deductionDues',
  'deductionTravelSubsistence',
  'deductionSavings',
  'deductionOther',
] as const;

const taxFields = ['ficaTax', 'federalIncomeTax', 'stateIncomeTax', 'sdiTax'] as const;
const fringeFields = ['fringeHealthWelfare', 'fringePension', 'fringeVacation', 'fringeTraining'] as const;

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function sumFields(entry: PayrollEntry, fields: readonly (keyof PayrollEntry)[]) {
  return roundMoney(fields.reduce((sum, field) => {
    const value = entry[field];
    return sum + (typeof value === 'number' ? value : 0);
  }, 0));
}

function hasAny(entry: PayrollEntry, fields: readonly (keyof PayrollEntry)[]) {
  return fields.some((field) => typeof entry[field] === 'number');
}

function pct(count: number, total: number) {
  return total === 0 ? 0 : Math.round((count / total) * 100);
}

const FIELD_GAP_COPY: Record<keyof PayrollSourceCoverage, { label: string; reason: string; nextAction: string }> = {
  grossPay: {
    label: 'Gross pay',
    reason: 'Gross pay should come from the payroll register so certified payroll totals reconcile to the payroll system of record.',
    nextAction: 'Import or enter gross wages from the provider payroll register for each payroll row.',
  },
  netPay: {
    label: 'Net pay',
    reason: 'Net pay is required to prove the worker paycheck amount after deductions.',
    nextAction: 'Import or enter net pay from the payroll register, not an estimated certified payroll calculation.',
  },
  totalDeductions: {
    label: 'Total deductions',
    reason: 'Total deductions connect gross pay to net pay and should be traceable to payroll source data.',
    nextAction: 'Map total deductions from the provider export or enter the payroll-register total before export.',
  },
  taxBreakdown: {
    label: 'Tax breakdown',
    reason: 'Tax fields help separate employee deductions from taxes and prevent opaque deduction totals.',
    nextAction: 'Include FICA, federal income tax, state income tax, and SDI columns when the payroll provider export supports them.',
  },
  deductionBreakdown: {
    label: 'Deduction breakdown',
    reason: 'Itemized deductions distinguish union dues, benefit deductions, savings, travel, and other worker deductions.',
    nextAction: 'Map itemized deduction columns or enter the breakdown from the payroll register before signing.',
  },
  fringeBreakdown: {
    label: 'Fringe/contribution breakdown',
    reason: 'Fringe and employer contribution detail supports cash-fringe and benefit-credit review.',
    nextAction: 'Import or enter health/welfare, pension, vacation, and training fringe or contribution fields.',
  },
  checkNumber: {
    label: 'Check number',
    reason: 'Check numbers tie certified payroll rows back to payroll-source payment evidence.',
    nextAction: 'Import or enter check number or payment reference from the payroll register.',
  },
};

export function reconcilePayrollSourceDetails(entries: PayrollEntry[]): PayrollSourceReconciliation {
  const entryCount = entries.length;
  let itemizedDeductionMismatchCount = 0;
  let netPayMismatchCount = 0;
  let fringeMismatchCount = 0;
  let missingSourceDetailCount = 0;
  let completeSourceRows = 0;

  const counts = {
    grossPay: 0,
    netPay: 0,
    totalDeductions: 0,
    taxBreakdown: 0,
    deductionBreakdown: 0,
    fringeBreakdown: 0,
    checkNumber: 0,
  };

  for (const entry of entries) {
    const hasGross = entry.grossWages != null;
    const hasNet = entry.netPay != null;
    const hasTotalDeductions = entry.deductions != null;
    const hasTaxBreakdown = hasAny(entry, taxFields);
    const hasDeductionBreakdown = hasAny(entry, moneyFields);
    const hasFringeBreakdown = hasAny(entry, fringeFields);
    const hasCheckNumber = Boolean(entry.checkNumber);

    if (hasGross) counts.grossPay += 1;
    if (hasNet) counts.netPay += 1;
    if (hasTotalDeductions) counts.totalDeductions += 1;
    if (hasTaxBreakdown) counts.taxBreakdown += 1;
    if (hasDeductionBreakdown) counts.deductionBreakdown += 1;
    if (hasFringeBreakdown) counts.fringeBreakdown += 1;
    if (hasCheckNumber) counts.checkNumber += 1;

    const itemizedDeductions = sumFields(entry, [...taxFields, ...moneyFields]);
    const totalDeductions = roundMoney(entry.deductions ?? 0);
    if (hasDeductionBreakdown && Math.abs(itemizedDeductions - totalDeductions) > 0.01) {
      itemizedDeductionMismatchCount += 1;
    }

    if (hasGross && hasNet && Math.abs(roundMoney((entry.grossWages ?? 0) - totalDeductions) - roundMoney(entry.netPay ?? 0)) > 0.01) {
      netPayMismatchCount += 1;
    }

    const fringeBreakdown = sumFields(entry, fringeFields);
    if (hasFringeBreakdown && entry.fringeRateSnapshot > 0 && fringeBreakdown <= 0) {
      fringeMismatchCount += 1;
    }

    const sourceComplete = hasGross && hasNet && hasTotalDeductions && hasTaxBreakdown && hasDeductionBreakdown && hasCheckNumber;
    if (sourceComplete) completeSourceRows += 1;
    if (!sourceComplete) missingSourceDetailCount += 1;
  }

  const coverage: PayrollSourceCoverage = {
    grossPay: pct(counts.grossPay, entryCount),
    netPay: pct(counts.netPay, entryCount),
    totalDeductions: pct(counts.totalDeductions, entryCount),
    taxBreakdown: pct(counts.taxBreakdown, entryCount),
    deductionBreakdown: pct(counts.deductionBreakdown, entryCount),
    fringeBreakdown: pct(counts.fringeBreakdown, entryCount),
    checkNumber: pct(counts.checkNumber, entryCount),
  };

  const fieldGaps = (Object.keys(coverage) as Array<keyof PayrollSourceCoverage>)
    .map((field) => {
      const presentCount = counts[field];
      const missingCount = entryCount - presentCount;
      return {
        field,
        ...FIELD_GAP_COPY[field],
        missingCount,
      };
    })
    .filter((gap) => gap.missingCount > 0);

  return {
    entryCount,
    completeSourceRows,
    coverage,
    fieldGaps,
    itemizedDeductionMismatchCount,
    netPayMismatchCount,
    fringeMismatchCount,
    missingSourceDetailCount,
  };
}
