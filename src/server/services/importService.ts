// src/server/services/importService.ts
// Import orchestrator: detect provider -> parse CSV -> map rows -> match workers
// -> detect conflicts -> return ImportPreviewResult.
// Phase 35 — Payroll Import Server Pipeline.

import Papa from 'papaparse';
import { eq, and } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../db/schema.js';
import {
  payrollWeeks,
  payrollEntries,
  workers,
  workerClassifications,
  projects,
  wageDeterminations,
  wageClassifications,
} from '../db/schema.js';
import { mapQbRows } from './qbMapper.js';
import { mapAdpRows } from './adpMapper.js';
import type { ImportPreviewResult, ImportedRow, UnmatchedRow, ConflictRow } from './importTypes.js';

type DrizzleDb = BetterSQLite3Database<typeof schema>;

// ── QB / ADP column signatures for provider detection ─────────────────────
// QB Desktop: has "Employee" + "Duration"
// QB Online:  has "Employee Name" + "Hours"
// ADP Run:    has "Co Code" + "File #"

const QB_SIGNATURES = [
  ['Employee', 'Duration'],       // QB Desktop Time by Employee Detail
  ['Employee Name', 'Hours'],     // QB Online variant
];

const ADP_SIGNATURE = ['Co Code', 'File #'];

// ── detectProvider ─────────────────────────────────────────────────────────
// Detects payroll provider from CSV header row.
// Case-insensitive match with trim.
export function detectProvider(headers: string[]): 'quickbooks' | 'adp' | 'unknown' {
  const normalised = headers.map((h) => h.trim().toLowerCase());

  // Check QB signatures
  for (const sig of QB_SIGNATURES) {
    if (sig.every((col) => normalised.includes(col.toLowerCase()))) {
      return 'quickbooks';
    }
  }

  // Check ADP signature
  if (ADP_SIGNATURE.every((col) => normalised.includes(col.toLowerCase()))) {
    return 'adp';
  }

  return 'unknown';
}

// ── parseImportFile ────────────────────────────────────────────────────────
// Main entry point: parses the uploaded CSV buffer, detects provider, maps rows,
// matches workers, detects conflicts, and returns a structured ImportPreviewResult.
export async function parseImportFile(
  buffer: Buffer,
  weekId: string,
  projectId: string,
  db: DrizzleDb,
): Promise<ImportPreviewResult> {
  // 1. Parse CSV — MUST call buffer.toString('utf-8') before Papa.parse
  const result = Papa.parse<Record<string, string>>(buffer.toString('utf-8'), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });

  const fields = result.meta.fields ?? [];

  // 2. Detect provider
  const provider = detectProvider(fields);
  if (provider === 'unknown') {
    throw new Error(
      'Could not detect payroll provider. Upload a QuickBooks Time by Employee Detail or ADP payroll export.',
    );
  }

  // 3. Get week's weekEndingDate from DB
  const weekRow = db
    .select({ weekEndingDate: payrollWeeks.weekEndingDate })
    .from(payrollWeeks)
    .where(eq(payrollWeeks.id, weekId))
    .get() as { weekEndingDate: string } | undefined;

  if (!weekRow) {
    throw new Error(`Payroll week not found: ${weekId}`);
  }

  // 4. Map rows using appropriate mapper
  let entriesMap: Map<string, { csvName: string; monSt: number; tueSt: number; wedSt: number; thuSt: number; friSt: number; satSt: number; sunSt: number; monOt: number; tueOt: number; wedOt: number; thuOt: number; friOt: number; satOt: number; sunOt: number }>;
  let adpWeeklyTotalsOnly: boolean | undefined;

  if (provider === 'quickbooks') {
    const mapped = mapQbRows(result.data, weekRow.weekEndingDate);
    entriesMap = mapped.entries;
  } else {
    const mapped = mapAdpRows(result.data);
    entriesMap = mapped.entries;
    adpWeeklyTotalsOnly = mapped.adpWeeklyTotalsOnly;
  }

  // 5. Fetch project with wageDeterminationId
  const projectRow = db
    .select({ wageDeterminationId: wageDeterminations.id, wdNumber: wageDeterminations.wdNumber })
    .from(projects)
    .leftJoin(wageDeterminations, and(
      eq(wageDeterminations.wdNumber, projects.wdIdentifier!),
    ))
    .where(eq(projects.id, projectId))
    .get() as { wageDeterminationId: string | null; wdNumber: string | null } | undefined;

  const wageDeterminationId = projectRow?.wageDeterminationId ?? null;

  // 6. Fetch all active workers + their active classifications + rate snapshots for the project
  // Join: workers -> workerClassifications -> (optional) wageClassifications for rates
  type WorkerRow = {
    workerId: string;
    workerName: string;
    classificationId: string;
    classificationName: string;
    tradeCode: string;
    baseRateSnapshot: number;
    fringeRateSnapshot: number;
  };

  // Query worker classifications for this project
  const workerRows = db
    .select({
      workerId: workers.id,
      workerName: workers.name,
      classificationId: workerClassifications.id,
      classificationName: workerClassifications.tradeDescription,
      tradeCode: workerClassifications.tradeCode,
    })
    .from(workers)
    .innerJoin(workerClassifications, eq(workerClassifications.workerId, workers.id))
    .where(
      and(
        eq(workers.projectId, projectId),
        eq(workers.isActive, true),
        eq(workerClassifications.isActive, true),
        eq(workerClassifications.projectId, projectId),
      ),
    )
    .all() as Array<{
      workerId: string;
      workerName: string;
      classificationId: string;
      classificationName: string;
      tradeCode: string;
    }>;

  // Fetch wage classifications for rate lookup (if project has a WD)
  let rateMap = new Map<string, { baseRate: number; fringeRate: number }>();
  if (wageDeterminationId) {
    const wageRows = db
      .select({
        tradeCode: wageClassifications.tradeCode,
        baseRate: wageClassifications.baseRate,
        fringeRate: wageClassifications.fringeRate,
      })
      .from(wageClassifications)
      .where(eq(wageClassifications.wageDeterminationId, wageDeterminationId))
      .all() as Array<{ tradeCode: string; baseRate: number; fringeRate: number }>;

    for (const wr of wageRows) {
      rateMap.set(wr.tradeCode, { baseRate: wr.baseRate, fringeRate: wr.fringeRate });
    }
  }

  // Build name lookup: lowercase name -> first active classification for that worker
  // (per D-05: use first active classification — contractor can adjust in Phase 36)
  const nameLookup = new Map<string, WorkerRow>();
  for (const row of workerRows) {
    const key = row.workerName.toLowerCase().trim();
    if (!nameLookup.has(key)) {
      const rates = rateMap.get(row.tradeCode) ?? { baseRate: 0, fringeRate: 0 };
      nameLookup.set(key, {
        ...row,
        baseRateSnapshot: rates.baseRate,
        fringeRateSnapshot: rates.fringeRate,
      });
    }
  }

  // 7. Fetch existing payrollEntries for conflict detection (per D-06)
  const existingEntries = db
    .select({
      workerId: payrollEntries.workerId,
      classificationId: payrollEntries.classificationId,
    })
    .from(payrollEntries)
    .where(eq(payrollEntries.payrollWeekId, weekId))
    .all() as Array<{ workerId: string; classificationId: string }>;

  const conflictSet = new Set(
    existingEntries.map((e) => `${e.workerId}::${e.classificationId}`),
  );

  // 8. Bucket each CSV employee into matched / unmatched / conflict
  const matched: ImportedRow[] = [];
  const unmatched: UnmatchedRow[] = [];
  const conflicts: ConflictRow[] = [];

  for (const [_key, csvEntry] of entriesMap) {
    const lookupKey = csvEntry.csvName.toLowerCase().trim();
    const workerMatch = nameLookup.get(lookupKey);

    if (!workerMatch) {
      // No matching project worker
      unmatched.push({
        csvName: csvEntry.csvName,
        hours: {
          monSt: csvEntry.monSt,
          tueSt: csvEntry.tueSt,
          wedSt: csvEntry.wedSt,
          thuSt: csvEntry.thuSt,
          friSt: csvEntry.friSt,
          satSt: csvEntry.satSt,
          sunSt: csvEntry.sunSt,
          monOt: csvEntry.monOt,
          tueOt: csvEntry.tueOt,
          wedOt: csvEntry.wedOt,
          thuOt: csvEntry.thuOt,
          friOt: csvEntry.friOt,
          satOt: csvEntry.satOt,
          sunOt: csvEntry.sunOt,
        },
      });
      continue;
    }

    const conflictKey = `${workerMatch.workerId}::${workerMatch.classificationId}`;
    if (conflictSet.has(conflictKey)) {
      // Worker already has a payroll entry for this week
      conflicts.push({
        csvName: csvEntry.csvName,
        workerId: workerMatch.workerId,
        workerName: workerMatch.workerName,
        reason: 'Worker already has a manual entry for this week. Delete it before importing.',
      });
      continue;
    }

    // Matched with no conflict
    matched.push({
      csvName: csvEntry.csvName,
      workerId: workerMatch.workerId,
      workerName: workerMatch.workerName,
      classificationId: workerMatch.classificationId,
      classificationName: workerMatch.classificationName,
      baseRateSnapshot: workerMatch.baseRateSnapshot,
      fringeRateSnapshot: workerMatch.fringeRateSnapshot,
      monSt: csvEntry.monSt,
      tueSt: csvEntry.tueSt,
      wedSt: csvEntry.wedSt,
      thuSt: csvEntry.thuSt,
      friSt: csvEntry.friSt,
      satSt: csvEntry.satSt,
      sunSt: csvEntry.sunSt,
      monOt: csvEntry.monOt,
      tueOt: csvEntry.tueOt,
      wedOt: csvEntry.wedOt,
      thuOt: csvEntry.thuOt,
      friOt: csvEntry.friOt,
      satOt: csvEntry.satOt,
      sunOt: csvEntry.sunOt,
    });
  }

  const previewResult: ImportPreviewResult = {
    provider,
    weekId,
    matched,
    unmatched,
    conflicts,
  };

  if (adpWeeklyTotalsOnly) {
    previewResult.adpWeeklyTotalsOnly = true;
  }

  return previewResult;
}
