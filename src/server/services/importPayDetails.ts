import type { ImportPayDetails } from './importTypes.js';

const MONEY_FIELDS: Array<[keyof ImportPayDetails, string[]]> = [
  ['grossWages', ['gross wages', 'gross wage', 'gross pay', 'gross earnings', 'total gross', 'gross']],
  ['deductions', ['total deductions', 'deductions', 'deduction total']],
  ['netPay', ['net pay', 'net wages', 'net amount', 'net check', 'net']],
  ['fringeHealthWelfare', ['health welfare fringe', 'health and welfare fringe', 'health welfare', 'h&w fringe']],
  ['fringePension', ['pension fringe', 'pension']],
  ['fringeVacation', ['vacation fringe', 'vacation holiday fringe', 'vacation']],
  ['fringeTraining', ['training fringe', 'training']],
  ['ficaTax', ['fica', 'fica tax', 'social security medicare', 'soc sec med']],
  ['federalIncomeTax', ['federal income tax', 'federal tax', 'fit', 'fed tax']],
  ['stateIncomeTax', ['state income tax', 'state tax', 'sit']],
  ['sdiTax', ['sdi', 'sdi tax', 'ca sdi']],
  ['deductionVacationHoliday', ['vacation holiday deduction', 'vac hol deduction', 'vacation holiday']],
  ['deductionHealthWelfare', ['health welfare deduction', 'health and welfare deduction', 'h&w deduction']],
  ['deductionPension', ['pension deduction']],
  ['deductionTraining', ['training deduction']],
  ['deductionFundAdmin', ['fund admin deduction', 'fund administration deduction']],
  ['deductionDues', ['dues', 'union dues', 'dues deduction']],
  ['deductionTravelSubsistence', ['travel subsistence deduction', 'travel deduction', 'subsistence deduction']],
  ['deductionSavings', ['savings deduction', 'savings']],
  ['deductionOther', ['other deduction', 'other deductions']],
];

const TEXT_FIELDS: Array<[keyof ImportPayDetails, string[]]> = [
  ['checkNumber', ['check number', 'check #', 'check no', 'check num']],
  ['deductionOtherDescription', ['other deduction description', 'other deduction note', 'deduction note']],
];

export const IMPORT_PAY_DETAIL_GROUPS = [
  { key: 'grossWages', label: 'Gross wages', aliases: ['Gross Wages', 'Gross Pay', 'Gross Earnings', 'Total Gross'] },
  { key: 'deductions', label: 'Total deductions', aliases: ['Total Deductions', 'Deductions', 'Deduction Total'] },
  { key: 'netPay', label: 'Net pay', aliases: ['Net Pay', 'Net Wages', 'Net Amount', 'Net Check'] },
  { key: 'checkNumber', label: 'Check number', aliases: ['Check Number', 'Check #', 'Check No'] },
  { key: 'fringeHealthWelfare', label: 'Health/welfare fringe', aliases: ['Health Welfare Fringe', 'Health and Welfare Fringe', 'H&W Fringe'] },
  { key: 'fringePension', label: 'Pension fringe', aliases: ['Pension Fringe'] },
  { key: 'fringeVacation', label: 'Vacation fringe', aliases: ['Vacation Fringe', 'Vacation Holiday Fringe'] },
  { key: 'fringeTraining', label: 'Training fringe', aliases: ['Training Fringe'] },
  { key: 'ficaTax', label: 'FICA tax', aliases: ['FICA', 'FICA Tax', 'Social Security Medicare'] },
  { key: 'federalIncomeTax', label: 'Federal income tax', aliases: ['Federal Income Tax', 'Federal Tax', 'FIT'] },
  { key: 'stateIncomeTax', label: 'State income tax', aliases: ['State Income Tax', 'State Tax', 'SIT'] },
  { key: 'sdiTax', label: 'SDI tax', aliases: ['SDI', 'SDI Tax', 'CA SDI'] },
  { key: 'deductionVacationHoliday', label: 'Vacation/holiday deduction', aliases: ['Vacation Holiday Deduction', 'Vac Hol Deduction'] },
  { key: 'deductionHealthWelfare', label: 'Health/welfare deduction', aliases: ['Health Welfare Deduction', 'Health and Welfare Deduction', 'H&W Deduction'] },
  { key: 'deductionPension', label: 'Pension deduction', aliases: ['Pension Deduction'] },
  { key: 'deductionTraining', label: 'Training deduction', aliases: ['Training Deduction'] },
  { key: 'deductionFundAdmin', label: 'Fund admin deduction', aliases: ['Fund Admin Deduction', 'Fund Administration Deduction'] },
  { key: 'deductionDues', label: 'Union dues', aliases: ['Dues', 'Union Dues', 'Dues Deduction'] },
  { key: 'deductionTravelSubsistence', label: 'Travel/subsistence deduction', aliases: ['Travel Subsistence Deduction', 'Travel Deduction', 'Subsistence Deduction'] },
  { key: 'deductionSavings', label: 'Savings deduction', aliases: ['Savings Deduction', 'Savings'] },
  { key: 'deductionOther', label: 'Other deduction', aliases: ['Other Deduction', 'Other Deductions'] },
  { key: 'deductionOtherDescription', label: 'Other deduction note', aliases: ['Other Deduction Description', 'Other Deduction Note', 'Deduction Note'] },
] as const;

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function analyzeImportPayDetailColumns(headers: string[]) {
  const normalizedHeaders = new Set(headers.map(normalizeKey));
  return IMPORT_PAY_DETAIL_GROUPS.map((group) => {
    const matchedAlias = group.aliases.find((alias) => normalizedHeaders.has(normalizeKey(alias)));
    return {
      key: group.key,
      label: group.label,
      found: Boolean(matchedAlias),
      matchedColumn: matchedAlias ?? null,
      acceptedColumns: group.aliases,
    };
  });
}

function findValue(row: Record<string, string>, aliases: string[]) {
  const normalized = new Map(Object.keys(row).map((key) => [normalizeKey(key), row[key]]));
  for (const alias of aliases) {
    const direct = normalized.get(normalizeKey(alias));
    if (direct !== undefined) return direct;
  }
  return undefined;
}

function parseMoney(value: string | undefined) {
  if (value == null) return null;
  const raw = value.trim();
  if (!raw) return null;
  const negative = raw.startsWith('(') && raw.endsWith(')');
  const cleaned = raw.replace(/[,$()\s]/g, '');
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
}

export function extractImportPayDetails(row: Record<string, string>): ImportPayDetails {
  const details: ImportPayDetails = {};

  for (const [field, aliases] of MONEY_FIELDS) {
    const parsed = parseMoney(findValue(row, aliases));
    if (parsed != null) (details as Record<string, unknown>)[field] = parsed;
  }

  for (const [field, aliases] of TEXT_FIELDS) {
    const value = findValue(row, aliases)?.trim();
    if (value) (details as Record<string, unknown>)[field] = value;
  }

  return details;
}

export function mergeImportPayDetails(target: ImportPayDetails, next: ImportPayDetails) {
  for (const [field] of MONEY_FIELDS) {
    const value = next[field];
    if (typeof value === 'number') {
      const current = target[field];
      (target as Record<string, unknown>)[field] = (typeof current === 'number' ? current : 0) + value;
    }
  }
  for (const [field] of TEXT_FIELDS) {
    const value = next[field];
    if (typeof value === 'string' && value && !target[field]) (target as Record<string, unknown>)[field] = value;
  }
}

export function hasImportPayDetails(details: ImportPayDetails) {
  return Object.values(details).some((value) => value !== undefined && value !== null && value !== '');
}
