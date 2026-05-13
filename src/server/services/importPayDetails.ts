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

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
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
