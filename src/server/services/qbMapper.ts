// src/server/services/qbMapper.ts
// Maps QuickBooks "Time by Employee Detail" CSV rows to per-employee day buckets.
// Each input row is one time activity (employee + date + duration).
// This mapper aggregates rows by employee, distributing hours into the correct
// day-of-week and ST/OT bucket.

// ── QB Column Constants ────────────────────────────────────────────────────
// QB Desktop: "Employee", "Date", "Duration", "Payroll Item"
// QB Online:  "Employee Name", "Date", "Hours", "Service Item"

const COL_EMPLOYEE = 'Employee';
const COL_EMPLOYEE_ALT = 'Employee Name';
const COL_DATE = 'Date';
const COL_DURATION = 'Duration';
const COL_DURATION_ALT = 'Hours';
const COL_PAYROLL_ITEM = 'Payroll Item';
const COL_PAYROLL_ITEM_ALT = 'Service Item';

// ── Day-of-week mapping ────────────────────────────────────────────────────
// Date.getDay() returns: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
const DAY_PREFIX: Record<number, string> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
};

// ── Types ──────────────────────────────────────────────────────────────────

export interface QbAggregated {
  csvName: string; // original case from first occurrence
  monSt: number;
  tueSt: number;
  wedSt: number;
  thuSt: number;
  friSt: number;
  satSt: number;
  sunSt: number;
  monOt: number;
  tueOt: number;
  wedOt: number;
  thuOt: number;
  friOt: number;
  satOt: number;
  sunOt: number;
}

function emptyBuckets(): Omit<QbAggregated, 'csvName'> {
  return {
    monSt: 0, tueSt: 0, wedSt: 0, thuSt: 0, friSt: 0, satSt: 0, sunSt: 0,
    monOt: 0, tueOt: 0, wedOt: 0, thuOt: 0, friOt: 0, satOt: 0, sunOt: 0,
  };
}

// ── isOvertimeItem ─────────────────────────────────────────────────────────
// Returns true if the Payroll Item string indicates overtime or double-time.
// We lump "Double Time" into OT because payrollEntries has no DT field on import.
function isOvertimeItem(payrollItem: string): boolean {
  const lower = payrollItem.toLowerCase().trim();
  return lower.includes('overtime') || lower.includes(' ot') || lower === 'ot' || lower.includes('double time') || lower.includes('double-time');
}

// ── parseQbDate ────────────────────────────────────────────────────────────
// Parses QB date strings in MM/DD/YYYY format MANUALLY.
// NEVER pass raw date strings to new Date(string) — timezone parsing is unreliable.
function parseQbDate(dateStr: string): Date {
  const parts = dateStr.trim().split('/');
  const month = parseInt(parts[0], 10); // 1-based
  const day = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  return new Date(year, month - 1, day); // local time, midnight
}

// ── mapQbRows ──────────────────────────────────────────────────────────────
// Aggregates QB time-entry rows into per-employee day-bucket maps.
// @param rows - parsed CSV rows from papaparse (header: true)
// @param weekEndingDate - ISO date string (unused in bucketing but kept for future use)
// @returns Map keyed by lowercase employee name, value is QbAggregated
export function mapQbRows(
  rows: Record<string, string>[],
  _weekEndingDate: string,
): { entries: Map<string, QbAggregated> } {
  const entries = new Map<string, QbAggregated>();

  for (const row of rows) {
    // Resolve column names — QB Desktop vs QB Online
    const employeeRaw =
      (row[COL_EMPLOYEE] ?? row[COL_EMPLOYEE_ALT] ?? '').trim();
    const dateRaw = (row[COL_DATE] ?? '').trim();
    const durationRaw =
      (row[COL_DURATION] ?? row[COL_DURATION_ALT] ?? '0').trim();
    const payrollItemRaw =
      (row[COL_PAYROLL_ITEM] ?? row[COL_PAYROLL_ITEM_ALT] ?? '').trim();

    if (!employeeRaw || !dateRaw) continue;

    const key = employeeRaw.toLowerCase();
    if (!entries.has(key)) {
      entries.set(key, { csvName: employeeRaw, ...emptyBuckets() });
    }
    const entry = entries.get(key)!;

    // Parse date to determine day-of-week
    const date = parseQbDate(dateRaw);
    const dow = date.getDay(); // 0=Sun..6=Sat
    const dayPrefix = DAY_PREFIX[dow];
    if (!dayPrefix) continue; // malformed date

    const hours = parseFloat(durationRaw) || 0;
    const isOt = isOvertimeItem(payrollItemRaw);
    const suffix = isOt ? 'Ot' : 'St';
    const field = `${dayPrefix}${suffix}` as keyof QbAggregated;

    (entry[field] as number) += hours;
  }

  return { entries };
}
