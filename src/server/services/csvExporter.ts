// src/server/services/csvExporter.ts
//
// Canonical CSV export service for certified payroll data.
// Supports LCPtracker and eMars platform formats.
//
// Both mappers transform FROM the PayrollExportRow canonical type — no
// platform-specific row logic or duplicated field calculations.
//
// WH-347 source: https://www.dol.gov/sites/dolgov/files/WHD/legacy/files/wh347.pdf
// (Jan 2025 revision — flat PDF used as column reference)

import Papa from 'papaparse';

// ── Canonical Internal Row Type ────────────────────────────────────────────
//
// Mirrors WH-347 payroll grid columns exactly.
// Both LCPtracker and eMars mappers transform FROM this type.
// WH-347 box numbers cited in comments are the source of truth.

export interface PayrollExportRow {
  contractorName: string;        // WH-347 header — contractor name block
  projectName: string;           // WH-347 header — project/contract name
  weekEnding: string;            // WH-347 header "For Week Ending"
  payrollNo: string;             // WH-347 header "Payroll No."
  workerName: string;            // WH-347 Col 1B — employee name
  identifyingNo: string;         // WH-347 Col 1D — last 4 SSN or system ID
  classification: string;        // WH-347 Col 2 — trade/classification
  laborType: 'J' | 'RA';        // WH-347 Col 1C — J=Journeyworker, RA=Registered Apprentice
  monSt: number;                 // WH-347 Col 3A Monday straight-time hours
  monOt: number;                 // WH-347 Col 3B Monday overtime hours
  tueSt: number;                 // WH-347 Col 3A Tuesday ST
  tueOt: number;                 // WH-347 Col 3B Tuesday OT
  wedSt: number;                 // WH-347 Col 3A Wednesday ST
  wedOt: number;                 // WH-347 Col 3B Wednesday OT
  thuSt: number;                 // WH-347 Col 3A Thursday ST
  thuOt: number;                 // WH-347 Col 3B Thursday OT
  friSt: number;                 // WH-347 Col 3A Friday ST
  friOt: number;                 // WH-347 Col 3B Friday OT
  satSt: number;                 // WH-347 Col 3A Saturday ST
  satOt: number;                 // WH-347 Col 3B Saturday OT
  sunSt: number;                 // WH-347 Col 3A Sunday ST
  sunOt: number;                 // WH-347 Col 3B Sunday OT
  totalSt: number;               // WH-347 Col 4 — total ST hours for week
  totalOt: number;               // WH-347 Col 5 — total OT hours for week
  baseRate: number;              // WH-347 Col 6A — base hourly rate
  fringeRate: number;            // WH-347 Col 6B — fringe benefit credit per hour
  grossWages: number;            // WH-347 Col 7A — gross wages earned on this project
  deductions: number;            // WH-347 Col 8 — total deductions
  netPay: number;                // WH-347 Col 9 — net wages paid
}

// ── LCPtracker Column Header Map ───────────────────────────────────────────
//
// CONFIDENCE: LOW — column names are best-guess from WH-347 semantics.
// LCPtracker's CSV import template is proprietary and not publicly documented.
// Source reference: Trimble Vista LCPtracker FAQ on WH-347 payroll grid.
//
// Every column is marked LIVE-TEST for validation against LCPtracker staging
// before production use.

export const LCPTRACKER_COLUMNS: Record<keyof PayrollExportRow, string> = {
  contractorName: 'Contractor Name',            // WH-347 header — LIVE-TEST: verify column name against LCPtracker staging upload
  projectName: 'Project Name',                  // WH-347 header — LIVE-TEST: verify column name against LCPtracker staging upload
  weekEnding: 'Week Ending Date',               // WH-347 header — LIVE-TEST: verify column name against LCPtracker staging upload
  payrollNo: 'Payroll Number',                  // WH-347 header — LIVE-TEST: verify column name against LCPtracker staging upload
  workerName: 'Employee Name',                  // WH-347 Col 1B — LIVE-TEST: verify column name against LCPtracker staging upload
  identifyingNo: 'Employee ID',                 // WH-347 Col 1D — LIVE-TEST: verify; may be "SSN Last 4"
  classification: 'Classification',             // WH-347 Col 2 — LIVE-TEST: verify column name against LCPtracker staging upload
  laborType: 'Labor Type',                      // WH-347 Col 1C — LIVE-TEST: verify; may be "Worker Type"
  monSt: 'Mon ST',                             // WH-347 Col 3A — LIVE-TEST: verify column name against LCPtracker staging upload
  monOt: 'Mon OT',                             // WH-347 Col 3B — LIVE-TEST: verify column name against LCPtracker staging upload
  tueSt: 'Tue ST',                             // WH-347 Col 3A — LIVE-TEST: verify column name against LCPtracker staging upload
  tueOt: 'Tue OT',                             // WH-347 Col 3B — LIVE-TEST: verify column name against LCPtracker staging upload
  wedSt: 'Wed ST',                             // WH-347 Col 3A — LIVE-TEST: verify column name against LCPtracker staging upload
  wedOt: 'Wed OT',                             // WH-347 Col 3B — LIVE-TEST: verify column name against LCPtracker staging upload
  thuSt: 'Thu ST',                             // WH-347 Col 3A — LIVE-TEST: verify column name against LCPtracker staging upload
  thuOt: 'Thu OT',                             // WH-347 Col 3B — LIVE-TEST: verify column name against LCPtracker staging upload
  friSt: 'Fri ST',                             // WH-347 Col 3A — LIVE-TEST: verify column name against LCPtracker staging upload
  friOt: 'Fri OT',                             // WH-347 Col 3B — LIVE-TEST: verify column name against LCPtracker staging upload
  satSt: 'Sat ST',                             // WH-347 Col 3A — LIVE-TEST: verify column name against LCPtracker staging upload
  satOt: 'Sat OT',                             // WH-347 Col 3B — LIVE-TEST: verify column name against LCPtracker staging upload
  sunSt: 'Sun ST',                             // WH-347 Col 3A — LIVE-TEST: verify column name against LCPtracker staging upload
  sunOt: 'Sun OT',                             // WH-347 Col 3B — LIVE-TEST: verify column name against LCPtracker staging upload
  totalSt: 'Total ST Hours',                   // WH-347 Col 4 — LIVE-TEST: verify column name against LCPtracker staging upload
  totalOt: 'Total OT Hours',                   // WH-347 Col 5 — LIVE-TEST: verify column name against LCPtracker staging upload
  baseRate: 'Base Hourly Rate',                // WH-347 Col 6A — LIVE-TEST: verify column name against LCPtracker staging upload
  fringeRate: 'Fringe Benefit Credit',         // WH-347 Col 6B — LIVE-TEST: verify; Trimble fringe type H/V/T codes may be needed
  grossWages: 'Gross Wages',                   // WH-347 Col 7A — LIVE-TEST: verify column name against LCPtracker staging upload
  deductions: 'Total Deductions',              // WH-347 Col 8 — LIVE-TEST: verify column name against LCPtracker staging upload
  netPay: 'Net Pay',                           // WH-347 Col 9 — LIVE-TEST: verify column name against LCPtracker staging upload
};

// ── eMars Column Header Map ────────────────────────────────────────────────
//
// CONFIDENCE: LOW — eMars is used for CA DIR public works payroll.
// The eMars CSV upload format is not publicly documented.
// Assumed to follow WH-347 semantics similar to LCPtracker.
//
// LIVE-TEST: validate all columns against eMars upload template before
// production use.

export const EMARS_COLUMNS: Record<keyof PayrollExportRow, string> = {
  contractorName: 'CONTRACTOR_NAME',   // WH-347 header — LIVE-TEST: verify against eMars upload template
  projectName: 'PROJECT_NAME',         // WH-347 header — LIVE-TEST: verify against eMars upload template
  weekEnding: 'WEEK_ENDING',           // WH-347 header — LIVE-TEST: verify against eMars upload template
  payrollNo: 'PAYROLL_NO',             // WH-347 header — LIVE-TEST: verify against eMars upload template
  workerName: 'WORKER_NAME',           // WH-347 Col 1B — LIVE-TEST: verify against eMars upload template
  identifyingNo: 'WORKER_ID',          // WH-347 Col 1D — LIVE-TEST: verify against eMars upload template
  classification: 'CLASSIFICATION',    // WH-347 Col 2 — LIVE-TEST: verify against eMars upload template
  laborType: 'WORKER_TYPE',            // WH-347 Col 1C — LIVE-TEST: verify against eMars upload template
  monSt: 'MON_ST',                    // WH-347 Col 3A — LIVE-TEST: verify against eMars upload template
  monOt: 'MON_OT',                    // WH-347 Col 3B — LIVE-TEST: verify against eMars upload template
  tueSt: 'TUE_ST',                    // WH-347 Col 3A — LIVE-TEST: verify against eMars upload template
  tueOt: 'TUE_OT',                    // WH-347 Col 3B — LIVE-TEST: verify against eMars upload template
  wedSt: 'WED_ST',                    // WH-347 Col 3A — LIVE-TEST: verify against eMars upload template
  wedOt: 'WED_OT',                    // WH-347 Col 3B — LIVE-TEST: verify against eMars upload template
  thuSt: 'THU_ST',                    // WH-347 Col 3A — LIVE-TEST: verify against eMars upload template
  thuOt: 'THU_OT',                    // WH-347 Col 3B — LIVE-TEST: verify against eMars upload template
  friSt: 'FRI_ST',                    // WH-347 Col 3A — LIVE-TEST: verify against eMars upload template
  friOt: 'FRI_OT',                    // WH-347 Col 3B — LIVE-TEST: verify against eMars upload template
  satSt: 'SAT_ST',                    // WH-347 Col 3A — LIVE-TEST: verify against eMars upload template
  satOt: 'SAT_OT',                    // WH-347 Col 3B — LIVE-TEST: verify against eMars upload template
  sunSt: 'SUN_ST',                    // WH-347 Col 3A — LIVE-TEST: verify against eMars upload template
  sunOt: 'SUN_OT',                    // WH-347 Col 3B — LIVE-TEST: verify against eMars upload template
  totalSt: 'TOTAL_ST',                // WH-347 Col 4 — LIVE-TEST: verify against eMars upload template
  totalOt: 'TOTAL_OT',                // WH-347 Col 5 — LIVE-TEST: verify against eMars upload template
  baseRate: 'BASE_RATE',              // WH-347 Col 6A — LIVE-TEST: verify against eMars upload template
  fringeRate: 'FRINGE_RATE',          // WH-347 Col 6B — LIVE-TEST: verify against eMars upload template
  grossWages: 'GROSS_WAGES',          // WH-347 Col 7A — LIVE-TEST: verify against eMars upload template
  deductions: 'DEDUCTIONS',           // WH-347 Col 8 — LIVE-TEST: verify against eMars upload template
  netPay: 'NET_PAY',                  // WH-347 Col 9 — LIVE-TEST: verify against eMars upload template
};

// ── Internal Helpers ───────────────────────────────────────────────────────

/**
 * Remap a PayrollExportRow to a plain object keyed by platform column headers.
 * This is what papaparse receives — field order follows insertion order of
 * the columns map, which matches WH-347 column order.
 */
function remapRow(
  row: PayrollExportRow,
  columns: Record<keyof PayrollExportRow, string>,
): Record<string, unknown> {
  return Object.fromEntries(
    (Object.keys(columns) as (keyof PayrollExportRow)[]).map(k => [columns[k], row[k]]),
  );
}

// ── Public Generator Functions ─────────────────────────────────────────────

/**
 * Generate a CSV string in LCPtracker upload format.
 * All values are quoted. Header row uses LCPTRACKER_COLUMNS values.
 */
export function generateLcpTrackerCsv(rows: PayrollExportRow[]): string {
  return Papa.unparse(rows.map(r => remapRow(r, LCPTRACKER_COLUMNS)), {
    header: true,
    quotes: true,
  });
}

/**
 * Generate a CSV string in eMars upload format.
 * All values are quoted. Header row uses EMARS_COLUMNS values.
 */
export function generateEmarsCsv(rows: PayrollExportRow[]): string {
  return Papa.unparse(rows.map(r => remapRow(r, EMARS_COLUMNS)), {
    header: true,
    quotes: true,
  });
}

// ── Entry Mapper ───────────────────────────────────────────────────────────

/**
 * Payroll entry shape returned by getPayrollEntries().
 * The DB query returns a nested shape: { entry, workerName, tradeDescription, laborType }.
 */
export interface PayrollEntryRow {
  entry: {
    monSt: number; monOt: number;
    tueSt: number; tueOt: number;
    wedSt: number; wedOt: number;
    thuSt: number; thuOt: number;
    friSt: number; friOt: number;
    satSt: number; satOt: number;
    sunSt: number; sunOt: number;
    baseRateSnapshot: number;
    fringeRateSnapshot: number;
    grossWages: number | null;
    deductions: number;
    netPay: number | null;
    workerId: string;
    payrollWeekId: string;
    classificationId: string;
  };
  workerName: string;
  tradeDescription: string;
  laborType: 'journeyworker' | 'apprentice' | 'foreman';
}

/**
 * Pure mapper — no DB calls.
 * Transforms getPayrollEntries() rows into the canonical PayrollExportRow[].
 * Both LCPtracker and eMars generators consume this output.
 */
export function mapEntriesToExportRows(
  entries: PayrollEntryRow[],
  week: { weekEndingDate: string; payrollNumber: number },
  projectName: string,
  contractorName: string,
): PayrollExportRow[] {
  return entries.map(({ entry: e, workerName, tradeDescription, laborType }) => ({
    contractorName,
    projectName,
    weekEnding: week.weekEndingDate,
    payrollNo: String(week.payrollNumber),
    workerName,
    identifyingNo: 'N/A', // ssnLast4 not available in joined query — privacy-safe default
    classification: tradeDescription,
    // foreman is treated as journeyworker on WH-347 (no separate WH-347 category)
    laborType: laborType === 'apprentice' ? 'RA' : 'J',
    monSt: e.monSt, monOt: e.monOt,
    tueSt: e.tueSt, tueOt: e.tueOt,
    wedSt: e.wedSt, wedOt: e.wedOt,
    thuSt: e.thuSt, thuOt: e.thuOt,
    friSt: e.friSt, friOt: e.friOt,
    satSt: e.satSt, satOt: e.satOt,
    sunSt: e.sunSt, sunOt: e.sunOt,
    totalSt: e.monSt + e.tueSt + e.wedSt + e.thuSt + e.friSt + e.satSt + e.sunSt,
    totalOt: e.monOt + e.tueOt + e.wedOt + e.thuOt + e.friOt + e.satOt + e.sunOt,
    baseRate: e.baseRateSnapshot,
    fringeRate: e.fringeRateSnapshot,
    grossWages: e.grossWages ?? 0,
    deductions: e.deductions,
    netPay: e.netPay ?? 0,
  }));
}
