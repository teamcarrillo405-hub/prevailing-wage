// src/server/services/gustoMapper.ts
// Maps Gusto Payroll Journal Report CSV rows to per-employee day buckets.
// Gusto exports weekly totals only — no daily breakdown.
// All hours placed on Monday (same pattern as adpMapper.ts).

// ── Gusto Column Constants ─────────────────────────────────────────────────
// Gusto Payroll Journal Report format: "Employee first name", "Employee last name",
// "Regular hours", "Overtime hours" (optional), "Double overtime hours" (optional),
// "Payroll end date"

const COL_FIRST_NAME = 'Employee first name';
const COL_LAST_NAME = 'Employee last name';
const COL_REG_HOURS = 'Regular hours';
const COL_OT_HOURS = 'Overtime hours';       // optional column — not in zero-OT exports
const COL_DOT_HOURS = 'Double overtime hours'; // optional column

// ── Required columns for validation ───────────────────────────────────────
const REQUIRED_COLS = [
  'Employee first name',
  'Employee last name',
  'Regular hours',
  'Payroll end date',
] as const;

// ── Types ──────────────────────────────────────────────────────────────────

export interface GustoAggregated {
  csvName: string; // "First Last" original case from first occurrence
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

function emptyBuckets(): Omit<GustoAggregated, 'csvName'> {
  return {
    monSt: 0, tueSt: 0, wedSt: 0, thuSt: 0, friSt: 0, satSt: 0, sunSt: 0,
    monOt: 0, tueOt: 0, wedOt: 0, thuOt: 0, friOt: 0, satOt: 0, sunOt: 0,
  };
}

// ── mapGustoRows ────────────────────────────────────────────────────────────
// Aggregates Gusto payroll rows into per-employee day-bucket maps.
// Because Gusto provides weekly totals only, all hours are placed on Monday.
//
// Optional columns:
//   "Overtime hours"        — absent in zero-OT payrolls; defaults to 0
//   "Double overtime hours" — absent in standard payrolls; defaults to 0; added to monOt
//
// CRITICAL: Do NOT use new Date(string) for Payroll end date — timezone parsing
// is unreliable. The date is not needed for bucketing (weekly totals go on Monday).
// If future use requires it, follow the parseQbDate() manual split pattern.
//
// @param rows - parsed CSV rows from papaparse (header: true)
// @returns Map keyed by lowercase full name + gustoWeeklyTotalsOnly flag
export function mapGustoRows(
  rows: Record<string, string>[],
): { entries: Map<string, GustoAggregated>; gustoWeeklyTotalsOnly: true } {
  // 1. Validate required columns exist in the CSV
  //    Use keys from first row (or empty object if no rows) for the check.
  const presentKeys = rows.length > 0
    ? Object.keys(rows[0]).map((k) => k.toLowerCase())
    : [];

  const missing = REQUIRED_COLS.filter(
    (col) => !presentKeys.includes(col.toLowerCase()),
  );

  if (missing.length > 0) {
    throw new Error(
      `Gusto CSV is missing required columns: ${missing.join(', ')}. ` +
      'Please upload a Gusto Payroll Journal Report that includes all required columns.',
    );
  }

  // 2. Aggregate rows by employee
  const entries = new Map<string, GustoAggregated>();

  for (const row of rows) {
    const firstName = (row[COL_FIRST_NAME] ?? '').trim();
    const lastName = (row[COL_LAST_NAME] ?? '').trim();

    // Skip rows with no name
    if (!firstName && !lastName) continue;

    const csvName = `${firstName} ${lastName}`.trim();
    const key = csvName.toLowerCase();

    if (!entries.has(key)) {
      entries.set(key, { csvName, ...emptyBuckets() });
    }
    const entry = entries.get(key)!;

    // All hours go on Monday (weekly totals only — no daily breakdown in Gusto)
    const regHours = parseFloat(row[COL_REG_HOURS] ?? '0') || 0;
    // Overtime hours column is optional (zero-OT Gusto exports omit it entirely)
    const otHours = parseFloat(row[COL_OT_HOURS] ?? '0') || 0;
    // Double overtime hours column is optional — lumped into OT bucket per IMPORT-01
    const dotHours = parseFloat(row[COL_DOT_HOURS] ?? '0') || 0;

    entry.monSt += regHours;
    entry.monOt += otHours + dotHours;
  }

  return { entries, gustoWeeklyTotalsOnly: true };
}
