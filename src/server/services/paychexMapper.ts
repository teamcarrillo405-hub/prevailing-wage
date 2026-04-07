// src/server/services/paychexMapper.ts
// Maps Paychex Flex payroll export CSV rows to per-employee day buckets.
// Each row is one time entry: Worker ID + Pay Component + Hours + Line Date.
// Paychex has daily data (unlike ADP/Gusto weekly totals).
// Phase 45 — IMPORT-02.

// ── Paychex Column Constants ────────────────────────────────────────────────
// Paychex Flex format: "Worker ID", "Pay Component", "Hours", "Line Date"

const COL_WORKER_ID = 'Worker ID';
const COL_PAY_COMPONENT = 'Pay Component';
const COL_HOURS = 'Hours';
const COL_LINE_DATE = 'Line Date';

// ── Day-of-week mappings ────────────────────────────────────────────────────
// Date.getDay() returns: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
const DAY_ST_KEYS = ['sunSt', 'monSt', 'tueSt', 'wedSt', 'thuSt', 'friSt', 'satSt'] as const;
const DAY_OT_KEYS = ['sunOt', 'monOt', 'tueOt', 'wedOt', 'thuOt', 'friOt', 'satOt'] as const;

// ── Types ──────────────────────────────────────────────────────────────────

export interface PaychexAggregated {
  providerWorkerId: string; // from "Worker ID" column — NOT csvName
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

function emptyBuckets(): Omit<PaychexAggregated, 'providerWorkerId'> {
  return {
    monSt: 0, tueSt: 0, wedSt: 0, thuSt: 0, friSt: 0, satSt: 0, sunSt: 0,
    monOt: 0, tueOt: 0, wedOt: 0, thuOt: 0, friOt: 0, satOt: 0, sunOt: 0,
  };
}

// ── parseLineDate ───────────────────────────────────────────────────────────
// Parses Paychex date strings in MM/DD/YYYY format MANUALLY.
// NEVER pass raw date strings to new Date(string) — timezone parsing is unreliable.
// Follows parseQbDate() pattern from qbMapper.ts.
function parseLineDate(dateStr: string): Date {
  const parts = dateStr.trim().split('/');
  const month = parseInt(parts[0], 10); // 1-based
  const day = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  return new Date(year, month - 1, day); // local time, midnight
}

// ── mapPaychexRows ──────────────────────────────────────────────────────────
// Aggregates Paychex Flex payroll rows into per-employee day-bucket maps.
// Map is keyed by raw Worker ID string (not lowercased — IDs are opaque).
//
// Pay Component routing (case-insensitive trim):
//   'regular'  → ST bucket for the date's day-of-week
//   'overtime' → OT bucket for the date's day-of-week
//   anything else → silently skip (do not throw)
//
// @param rows - parsed CSV rows from papaparse (header: true)
// @returns Map keyed by Worker ID string + paychexWeeklyTotalsOnly: false
export function mapPaychexRows(
  rows: Record<string, string>[],
): { entries: Map<string, PaychexAggregated>; paychexWeeklyTotalsOnly: false } {
  const entries = new Map<string, PaychexAggregated>();

  for (const row of rows) {
    const workerId = (row[COL_WORKER_ID] ?? '').trim();

    // Skip rows with no Worker ID
    if (!workerId) continue;

    const payComponent = (row[COL_PAY_COMPONENT] ?? '').trim().toLowerCase();
    const hoursRaw = (row[COL_HOURS] ?? '0').trim();
    const lineDateRaw = (row[COL_LINE_DATE] ?? '').trim();

    // Determine ST vs OT; skip if neither
    const isSt = payComponent === 'regular';
    const isOt = payComponent === 'overtime';
    if (!isSt && !isOt) continue;

    // Get or create entry for this Worker ID
    if (!entries.has(workerId)) {
      entries.set(workerId, { providerWorkerId: workerId, ...emptyBuckets() });
    }
    const entry = entries.get(workerId)!;

    // Parse date to determine day-of-week bucket
    const date = parseLineDate(lineDateRaw);
    const dow = date.getDay(); // 0=Sun..6=Sat
    const hours = parseFloat(hoursRaw) || 0;

    if (isSt) {
      const field = DAY_ST_KEYS[dow] as keyof PaychexAggregated;
      (entry[field] as number) += hours;
    } else {
      // isOt
      const field = DAY_OT_KEYS[dow] as keyof PaychexAggregated;
      (entry[field] as number) += hours;
    }
  }

  return { entries, paychexWeeklyTotalsOnly: false };
}
