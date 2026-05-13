// src/server/services/adpMapper.ts
// Maps ADP Run payroll export CSV rows to per-employee day buckets.
// ADP Run exports weekly totals only (Reg Hours + O/T Hours) — no daily breakdown.
// All hours are placed on Monday per the research decision (D-02 / plan critical notes).

import { extractImportPayDetails, mergeImportPayDetails } from './importPayDetails.js';
import type { ImportPayDetails } from './importTypes.js';

// ── ADP Column Constants ───────────────────────────────────────────────────
// ADP Run format: "Co Code", "File #", "First Name", "Last Name", "Reg Hours", "O/T Hours"

const COL_FIRST_NAME = 'First Name';
const COL_LAST_NAME = 'Last Name';
const COL_REG_HOURS = 'Reg Hours';
const COL_OT_HOURS = 'O/T Hours';

// ── Types ──────────────────────────────────────────────────────────────────

export interface AdpAggregated extends ImportPayDetails {
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

function emptyBuckets(): Omit<AdpAggregated, 'csvName'> {
  return {
    monSt: 0, tueSt: 0, wedSt: 0, thuSt: 0, friSt: 0, satSt: 0, sunSt: 0,
    monOt: 0, tueOt: 0, wedOt: 0, thuOt: 0, friOt: 0, satOt: 0, sunOt: 0,
  };
}

// ── mapAdpRows ─────────────────────────────────────────────────────────────
// Aggregates ADP time rows into per-employee day-bucket maps.
// Because ADP Run provides weekly totals only, all hours are placed on Monday.
// @param rows - parsed CSV rows from papaparse (header: true)
// @returns Map keyed by lowercase full name + adpWeeklyTotalsOnly flag
export function mapAdpRows(
  rows: Record<string, string>[],
): { entries: Map<string, AdpAggregated>; adpWeeklyTotalsOnly: true } {
  const entries = new Map<string, AdpAggregated>();

  for (const row of rows) {
    const firstName = (row[COL_FIRST_NAME] ?? '').trim();
    const lastName = (row[COL_LAST_NAME] ?? '').trim();

    if (!firstName && !lastName) continue;

    const csvName = `${firstName} ${lastName}`.trim();
    const key = csvName.toLowerCase();

    if (!entries.has(key)) {
      entries.set(key, { csvName, ...emptyBuckets() });
    }
    const entry = entries.get(key)!;
    mergeImportPayDetails(entry, extractImportPayDetails(row));

    // All hours go on Monday (weekly totals only — no daily breakdown in ADP Run)
    const regHours = parseFloat(row[COL_REG_HOURS] ?? '0') || 0;
    const otHours = parseFloat(row[COL_OT_HOURS] ?? '0') || 0;

    entry.monSt += regHours;
    entry.monOt += otHours;
  }

  return { entries, adpWeeklyTotalsOnly: true };
}
