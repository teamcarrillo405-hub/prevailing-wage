// src/server/services/sage300Mapper.ts
// Maps Sage 300 CRE and Sage 100 Contractor payroll CSV rows to per-employee day buckets.
//
// Sage 300 CRE: detected by positional 9-column order; Employee field is numeric ID
//   (requires ID mapping via payroll_provider_mappings).
// Sage 100 Contractor: detected by presence of "Employee Name" column (name-based path,
//   no ID mapping required — same as QB/ADP/Gusto).
// Phase 45 — IMPORT-03.

// ── Sage 300 CRE Column Constants ──────────────────────────────────────────
// The first 9 columns of a Sage 300 CRE Payroll Register export are positional.
// Detection checks these in order (case-insensitive).

export const SAGE_300_POSITIONAL_COLS = [
  'employee',
  'date',
  'job',
  'extra',
  'cost code',
  'category',
  'certified',
  'payid',
  'units',
] as const;

// ── Day-of-week mappings ────────────────────────────────────────────────────
// Date.getDay() returns: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
const DAY_ST_KEYS = ['sunSt', 'monSt', 'tueSt', 'wedSt', 'thuSt', 'friSt', 'satSt'] as const;
const DAY_OT_KEYS = ['sunOt', 'monOt', 'tueOt', 'wedOt', 'thuOt', 'friOt', 'satOt'] as const;

// ── Types ──────────────────────────────────────────────────────────────────

export interface Sage300Aggregated {
  providerWorkerId: string; // numeric code from "Employee" column — NOT csvName
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

export interface Sage100Aggregated {
  csvName: string; // original case from first occurrence (name-based path)
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

function emptyBucketsId(): Omit<Sage300Aggregated, 'providerWorkerId'> {
  return {
    monSt: 0, tueSt: 0, wedSt: 0, thuSt: 0, friSt: 0, satSt: 0, sunSt: 0,
    monOt: 0, tueOt: 0, wedOt: 0, thuOt: 0, friOt: 0, satOt: 0, sunOt: 0,
  };
}

function emptyBucketsName(): Omit<Sage100Aggregated, 'csvName'> {
  return {
    monSt: 0, tueSt: 0, wedSt: 0, thuSt: 0, friSt: 0, satSt: 0, sunSt: 0,
    monOt: 0, tueOt: 0, wedOt: 0, thuOt: 0, friOt: 0, satOt: 0, sunOt: 0,
  };
}

// ── parseSageDate ──────────────────────────────────────────────────────────
// Parses Sage date strings in MM/DD/YYYY format MANUALLY.
// NEVER pass raw date strings to new Date(string) — timezone parsing is unreliable.
// Follows parseQbDate() pattern from qbMapper.ts.
function parseSageDate(dateStr: string): Date {
  const parts = dateStr.trim().split('/');
  const month = parseInt(parts[0], 10); // 1-based
  const day = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  return new Date(year, month - 1, day); // local time, midnight
}

// ── isSage300CRE ───────────────────────────────────────────────────────────
// Returns true if the first 9 column headers match the Sage 300 CRE positional
// signature (case-insensitive, trimmed).
// This positional check is authoritative — Sage 300 CRE export column order is fixed.
export function isSage300CRE(fields: string[]): boolean {
  if (fields.length < SAGE_300_POSITIONAL_COLS.length) return false;

  for (let i = 0; i < SAGE_300_POSITIONAL_COLS.length; i++) {
    if (fields[i].trim().toLowerCase() !== SAGE_300_POSITIONAL_COLS[i]) {
      return false;
    }
  }

  return true;
}

// ── mapSage300Rows ─────────────────────────────────────────────────────────
// Aggregates Sage 300 CRE payroll rows into per-employee day-bucket maps.
// Map is keyed by raw Employee ID string (numeric, opaque — not lowercased).
//
// PayID routing (case-insensitive trim):
//   'reg' → ST bucket for the date's day-of-week
//   'ot'  → OT bucket for the date's day-of-week
//   'dt'  → OT bucket (double-time lumped into OT per established pattern)
//   anything else → silently skip (do not throw)
//
// @param rows - parsed CSV rows from papaparse (header: true)
// @returns Map keyed by Employee ID + sage300WeeklyTotalsOnly: false
export function mapSage300Rows(
  rows: Record<string, string>[],
): { entries: Map<string, Sage300Aggregated>; sage300WeeklyTotalsOnly: false } {
  const entries = new Map<string, Sage300Aggregated>();

  for (const row of rows) {
    const employeeId = (row['Employee'] ?? '').trim();

    // Skip rows with no Employee ID
    if (!employeeId) continue;

    const payId = (row['PayID'] ?? '').trim().toLowerCase();
    const unitsRaw = (row['Units'] ?? '0').trim();
    const dateRaw = (row['Date'] ?? '').trim();

    // Determine ST vs OT; skip if neither
    const isSt = payId === 'reg';
    const isOt = payId === 'ot' || payId === 'dt'; // DT lumped into OT
    if (!isSt && !isOt) continue;

    // Get or create entry for this Employee ID
    if (!entries.has(employeeId)) {
      entries.set(employeeId, { providerWorkerId: employeeId, ...emptyBucketsId() });
    }
    const entry = entries.get(employeeId)!;

    // Parse date to determine day-of-week bucket
    const date = parseSageDate(dateRaw);
    const dow = date.getDay(); // 0=Sun..6=Sat
    const units = parseFloat(unitsRaw) || 0;

    if (isSt) {
      const field = DAY_ST_KEYS[dow] as keyof Sage300Aggregated;
      (entry[field] as number) += units;
    } else {
      // isOt (OT or DT)
      const field = DAY_OT_KEYS[dow] as keyof Sage300Aggregated;
      (entry[field] as number) += units;
    }
  }

  return { entries, sage300WeeklyTotalsOnly: false };
}

// ── mapSage100Rows ─────────────────────────────────────────────────────────
// Aggregates Sage 100 Contractor payroll rows into per-employee day-bucket maps.
// Follows name-based path (same as QB/ADP/Gusto) — no ID mapping required.
// Employee name comes from "Employee Name" column.
//
// @param rows - parsed CSV rows from papaparse (header: true)
// @returns Map keyed by lowercase employee name + sage100WeeklyTotalsOnly: false
export function mapSage100Rows(
  rows: Record<string, string>[],
): { entries: Map<string, Sage100Aggregated>; sage100WeeklyTotalsOnly: false } {
  const entries = new Map<string, Sage100Aggregated>();

  for (const row of rows) {
    const employeeName = (row['Employee Name'] ?? '').trim();

    // Skip rows with no employee name
    if (!employeeName) continue;

    const key = employeeName.toLowerCase();

    if (!entries.has(key)) {
      entries.set(key, { csvName: employeeName, ...emptyBucketsName() });
    }
    const entry = entries.get(key)!;

    const hoursRaw = (row['Hours'] ?? '0').trim();
    const dateRaw = (row['Date'] ?? '').trim();

    if (!dateRaw) continue;

    // Parse date to determine day-of-week bucket
    const date = parseSageDate(dateRaw);
    const dow = date.getDay(); // 0=Sun..6=Sat
    const hours = parseFloat(hoursRaw) || 0;

    // For Sage 100, use Pay Type column if present for OT detection; default to ST
    const payType = (row['Pay Type'] ?? '').trim().toLowerCase();
    const isOt = payType === 'overtime' || payType === 'ot';

    if (isOt) {
      const field = DAY_OT_KEYS[dow] as keyof Sage100Aggregated;
      (entry[field] as number) += hours;
    } else {
      const field = DAY_ST_KEYS[dow] as keyof Sage100Aggregated;
      (entry[field] as number) += hours;
    }
  }

  return { entries, sage100WeeklyTotalsOnly: false };
}
