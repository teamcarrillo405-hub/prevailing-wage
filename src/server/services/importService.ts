// src/server/services/importService.ts
// Import orchestrator: detect provider -> parse CSV -> map rows -> match workers
// -> detect conflicts -> return ImportPreviewResult.
// Phase 35 — Payroll Import Server Pipeline.

import Papa from 'papaparse';
import { eq, and, inArray } from 'drizzle-orm';
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
  payrollProviderMappings,
} from '../db/schema.js';
import { mapQbRows } from './qbMapper.js';
import { mapAdpRows } from './adpMapper.js';
import { mapGustoRows } from './gustoMapper.js';
import { mapPaychexRows } from './paychexMapper.js';
import { isSage300CRE, mapSage300Rows, mapSage100Rows } from './sage300Mapper.js';
import { hasImportPayDetails } from './importPayDetails.js';
import type { ImportProvider, ImportPreviewResult, ImportedRow, UnmatchedRow, ConflictRow } from './importTypes.js';
import type { ImportPayDetails } from './importTypes.js';
import { resolveEffectiveClassificationRates } from './classificationRates.js';

type DrizzleDb = BetterSQLite3Database<typeof schema>;

// ── Column signatures for provider detection ──────────────────────────────
// QB Desktop: has "Employee" + "Duration"
// QB Online:  has "Employee Name" + "Hours"
// ADP Run:    has "Co Code" + "File #"
// Gusto:      has all 4 Payroll Journal columns
// Sage 300:   first 9 columns positional (via isSage300CRE)
// Paychex:    has "Pay Component" + "Worker ID"
// Sage 100:   has "Employee Name" + "Pay Type" (but NOT matching Sage 300 positional)

const QB_SIGNATURES = [
  ['Employee', 'Duration'],       // QB Desktop Time by Employee Detail
  ['Employee Name', 'Hours'],     // QB Online variant
];

const ADP_SIGNATURE = ['Co Code', 'File #'];

// Gusto Payroll Journal Report — 4-column signature (most specific, check before ADP)
const GUSTO_SIGNATURE = ['Employee first name', 'Employee last name', 'Regular hours', 'Payroll end date'];

// Paychex Flex — 2-column presence check
const PAYCHEX_SIGNATURE = ['Pay Component', 'Worker ID'];

// Sage 100 Contractor — name-based path (Employee Name + Pay Type distinguishes from QB Online)
const SAGE_100_SIGNATURE = ['Employee Name', 'Pay Type'];

// ── detectProvider ─────────────────────────────────────────────────────────
// Detects payroll provider from CSV header row.
// Case-insensitive match with trim.
//
// Detection priority order (most specific first to avoid misfire):
//   1. Gusto (4-column signature — most specific)
//   2. Sage 300 CRE (positional 9-col via isSage300CRE — checked before Paychex)
//   3. Sage 100 (Employee Name + Pay Type — checked before QB Online to avoid QB misfires)
//   4. QB Desktop / QB Online signatures
//   5. Paychex (2-col presence: Pay Component + Worker ID)
//   6. ADP
//   7. unknown
export function detectProvider(headers: string[]): ImportProvider | 'unknown' {
  const normalised = headers.map((h) => h.trim().toLowerCase());

  // 1. Check Gusto signature (most specific — 4 columns)
  if (GUSTO_SIGNATURE.every((col) => normalised.includes(col.toLowerCase()))) {
    return 'gusto';
  }

  // 2. Check Sage 300 CRE (positional 9-column check — more specific than presence checks)
  if (isSage300CRE(headers)) {
    return 'sage_300';
  }

  // 3. Check Sage 100 (Employee Name + Pay Type — checked before QB Online)
  //    Sage 100 has 'Pay Type' which QB does not — this distinguishes the two.
  if (SAGE_100_SIGNATURE.every((col) => normalised.includes(col.toLowerCase()))) {
    return 'sage_100';
  }

  // 4. Check QB signatures (Desktop and Online)
  for (const sig of QB_SIGNATURES) {
    if (sig.every((col) => normalised.includes(col.toLowerCase()))) {
      return 'quickbooks';
    }
  }

  // 5. Check Paychex signature (2-col presence)
  if (PAYCHEX_SIGNATURE.every((col) => normalised.includes(col.toLowerCase()))) {
    return 'paychex';
  }

  // 6. Check ADP signature
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
      'Could not detect payroll provider. Upload a QuickBooks, ADP, Gusto, Paychex, Sage 300, or Sage 100 payroll export.',
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
  // Name-match providers (QB, ADP, Gusto, Sage 100): csvName field, resolved by name
  // ID-match providers (Paychex, Sage 300): providerWorkerId field, resolved by payroll_provider_mappings

  type NameEntry = ImportPayDetails & { csvName: string; monSt: number; tueSt: number; wedSt: number; thuSt: number; friSt: number; satSt: number; sunSt: number; monOt: number; tueOt: number; wedOt: number; thuOt: number; friOt: number; satOt: number; sunOt: number };
  type IdEntry = ImportPayDetails & { providerWorkerId: string; monSt: number; tueSt: number; wedSt: number; thuSt: number; friSt: number; satSt: number; sunSt: number; monOt: number; tueOt: number; wedOt: number; thuOt: number; friOt: number; satOt: number; sunOt: number };

  let nameEntriesMap: Map<string, NameEntry> | undefined;
  let idEntriesMap: Map<string, IdEntry> | undefined;
  let adpWeeklyTotalsOnly: boolean | undefined;
  let gustoWeeklyTotalsOnly: boolean | undefined;

  if (provider === 'quickbooks') {
    const mapped = mapQbRows(result.data, weekRow.weekEndingDate);
    nameEntriesMap = mapped.entries;
  } else if (provider === 'gusto') {
    const mapped = mapGustoRows(result.data);
    nameEntriesMap = mapped.entries;
    gustoWeeklyTotalsOnly = mapped.gustoWeeklyTotalsOnly;
  } else if (provider === 'adp') {
    const mapped = mapAdpRows(result.data);
    nameEntriesMap = mapped.entries;
    adpWeeklyTotalsOnly = mapped.adpWeeklyTotalsOnly;
  } else if (provider === 'paychex') {
    const mapped = mapPaychexRows(result.data);
    idEntriesMap = mapped.entries;
  } else if (provider === 'sage_300') {
    const mapped = mapSage300Rows(result.data);
    idEntriesMap = mapped.entries;
  } else {
    // sage_100 — name-based path
    const mapped = mapSage100Rows(result.data);
    nameEntriesMap = mapped.entries;
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
    laborType: string;
    apprenticePercent: number | null;
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
      laborType: workerClassifications.laborType,
      apprenticePercent: workerClassifications.apprenticePercent,
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
      laborType: string;
      apprenticePercent: number | null;
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

  // Helper: push an entry's hours into an UnmatchedRow
  function payDetailPayload(entry: ImportPayDetails) {
    return {
      payDetailsImported: hasImportPayDetails(entry),
      grossWages: entry.grossWages ?? null,
      deductions: entry.deductions ?? null,
      netPay: entry.netPay ?? null,
      checkNumber: entry.checkNumber ?? null,
      fringeHealthWelfare: entry.fringeHealthWelfare ?? null,
      fringePension: entry.fringePension ?? null,
      fringeVacation: entry.fringeVacation ?? null,
      fringeTraining: entry.fringeTraining ?? null,
      ficaTax: entry.ficaTax ?? null,
      federalIncomeTax: entry.federalIncomeTax ?? null,
      stateIncomeTax: entry.stateIncomeTax ?? null,
      sdiTax: entry.sdiTax ?? null,
      deductionVacationHoliday: entry.deductionVacationHoliday ?? null,
      deductionHealthWelfare: entry.deductionHealthWelfare ?? null,
      deductionPension: entry.deductionPension ?? null,
      deductionTraining: entry.deductionTraining ?? null,
      deductionFundAdmin: entry.deductionFundAdmin ?? null,
      deductionDues: entry.deductionDues ?? null,
      deductionTravelSubsistence: entry.deductionTravelSubsistence ?? null,
      deductionSavings: entry.deductionSavings ?? null,
      deductionOther: entry.deductionOther ?? null,
      deductionOtherDescription: entry.deductionOtherDescription ?? null,
    };
  }

  function pushUnmatched(displayName: string, entry: ImportPayDetails & { monSt: number; tueSt: number; wedSt: number; thuSt: number; friSt: number; satSt: number; sunSt: number; monOt: number; tueOt: number; wedOt: number; thuOt: number; friOt: number; satOt: number; sunOt: number }) {
    unmatched.push({
      csvName: displayName,
      hours: {
        monSt: entry.monSt, tueSt: entry.tueSt, wedSt: entry.wedSt, thuSt: entry.thuSt,
        friSt: entry.friSt, satSt: entry.satSt, sunSt: entry.sunSt,
        monOt: entry.monOt, tueOt: entry.tueOt, wedOt: entry.wedOt, thuOt: entry.thuOt,
        friOt: entry.friOt, satOt: entry.satOt, sunOt: entry.sunOt,
      },
      ...payDetailPayload(entry),
    });
  }

  // Helper: push a matched entry
  function pushMatched(csvName: string, workerMatch: WorkerRow, entry: ImportPayDetails & { monSt: number; tueSt: number; wedSt: number; thuSt: number; friSt: number; satSt: number; sunSt: number; monOt: number; tueOt: number; wedOt: number; thuOt: number; friOt: number; satOt: number; sunOt: number }) {
    matched.push({
      csvName,
      workerId: workerMatch.workerId,
      workerName: workerMatch.workerName,
      classificationId: workerMatch.classificationId,
      classificationName: workerMatch.classificationName,
      baseRateSnapshot: workerMatch.baseRateSnapshot,
      fringeRateSnapshot: workerMatch.fringeRateSnapshot,
      monSt: entry.monSt, tueSt: entry.tueSt, wedSt: entry.wedSt, thuSt: entry.thuSt,
      friSt: entry.friSt, satSt: entry.satSt, sunSt: entry.sunSt,
      monOt: entry.monOt, tueOt: entry.tueOt, wedOt: entry.wedOt, thuOt: entry.thuOt,
      friOt: entry.friOt, satOt: entry.satOt, sunOt: entry.sunOt,
      ...payDetailPayload(entry),
    });
  }

  // ── ID-match path (Paychex, Sage 300) ─────────────────────────────────────
  // Resolve workers via payroll_provider_mappings table.
  let idMappingRequired: boolean | undefined;
  let unmappedIds: string[] | undefined;

  if (idEntriesMap !== undefined) {
    const providerWorkerIds = [...idEntriesMap.keys()];

    // Build workerIdLookup: workerId -> WorkerRow (for ID-mapped providers)
    const workerIdLookup = new Map<string, WorkerRow>();
    for (const row of workerRows) {
      if (!workerIdLookup.has(row.workerId)) {
        const journeyRates = rateMap.get(row.tradeCode) ?? { baseRate: 0, fringeRate: 0 };
        const rates = resolveEffectiveClassificationRates(journeyRates, row);
        workerIdLookup.set(row.workerId, {
          ...row,
          baseRateSnapshot: rates.baseRate,
          fringeRateSnapshot: rates.fringeRate,
        });
      }
    }

    // Query existing mappings for this project + provider + providerWorkerIds
    const existingMappings = providerWorkerIds.length > 0
      ? db
          .select({
            providerWorkerId: payrollProviderMappings.providerWorkerId,
            workerId: payrollProviderMappings.workerId,
          })
          .from(payrollProviderMappings)
          .where(and(
            eq(payrollProviderMappings.projectId, projectId),
            eq(payrollProviderMappings.provider, provider),
            inArray(payrollProviderMappings.providerWorkerId, providerWorkerIds),
          ))
          .all() as Array<{ providerWorkerId: string; workerId: string }>
      : [];

    // Build mapping lookup: providerWorkerId -> workerId
    const mappingLookup = new Map<string, string>();
    for (const m of existingMappings) {
      mappingLookup.set(m.providerWorkerId, m.workerId);
    }

    // Resolve entries
    const unmappedIdsList: string[] = [];

    for (const [providerWorkerId, entry] of idEntriesMap) {
      const mappedWorkerId = mappingLookup.get(providerWorkerId);

      if (!mappedWorkerId) {
        // No mapping found — add to unmatched and collect in unmappedIds
        unmappedIdsList.push(providerWorkerId);
        pushUnmatched(providerWorkerId, entry);
        continue;
      }

      const workerMatch = workerIdLookup.get(mappedWorkerId);

      if (!workerMatch) {
        // Mapping exists but worker not found in project — treat as unmatched
        unmappedIdsList.push(providerWorkerId);
        pushUnmatched(providerWorkerId, entry);
        continue;
      }

      const conflictKey = `${workerMatch.workerId}::${workerMatch.classificationId}`;
      if (conflictSet.has(conflictKey)) {
        conflicts.push({
          csvName: providerWorkerId,
          workerId: workerMatch.workerId,
          workerName: workerMatch.workerName,
          reason: 'Worker already has a manual entry for this week. Delete it before importing.',
        });
        continue;
      }

      // Use worker name as csvName for clarity (not the numeric ID)
      pushMatched(workerMatch.workerName, workerMatch, entry);
    }

    idMappingRequired = unmappedIdsList.length > 0;
    unmappedIds = unmappedIdsList;
  }

  // ── Name-match path (QB, ADP, Gusto, Sage 100) ───────────────────────────
  // Resolve workers by name lookup — existing behavior.
  if (nameEntriesMap !== undefined) {
    // Build name lookup: lowercase name -> first active classification for that worker
    const nameLookup = new Map<string, WorkerRow>();
    for (const row of workerRows) {
      const key = row.workerName.toLowerCase().trim();
      if (!nameLookup.has(key)) {
        const journeyRates = rateMap.get(row.tradeCode) ?? { baseRate: 0, fringeRate: 0 };
        const rates = resolveEffectiveClassificationRates(journeyRates, row);
        nameLookup.set(key, {
          ...row,
          baseRateSnapshot: rates.baseRate,
          fringeRateSnapshot: rates.fringeRate,
        });
      }
    }

    for (const [_key, csvEntry] of nameEntriesMap) {
      const lookupKey = csvEntry.csvName.toLowerCase().trim();
      const workerMatch = nameLookup.get(lookupKey);

      if (!workerMatch) {
        pushUnmatched(csvEntry.csvName, csvEntry);
        continue;
      }

      const conflictKey = `${workerMatch.workerId}::${workerMatch.classificationId}`;
      if (conflictSet.has(conflictKey)) {
        conflicts.push({
          csvName: csvEntry.csvName,
          workerId: workerMatch.workerId,
          workerName: workerMatch.workerName,
          reason: 'Worker already has a manual entry for this week. Delete it before importing.',
        });
        continue;
      }

      pushMatched(csvEntry.csvName, workerMatch, csvEntry);
    }
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

  if (gustoWeeklyTotalsOnly) {
    previewResult.gustoWeeklyTotalsOnly = true;
  }

  if (idMappingRequired !== undefined) {
    previewResult.idMappingRequired = idMappingRequired;
    previewResult.unmappedIds = unmappedIds ?? [];
  }

  return previewResult;
}
