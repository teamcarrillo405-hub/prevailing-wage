// src/server/services/importTypes.ts
// Shared types for the payroll import pipeline (Phase 35).
// Phase 44: Added ImportProvider union type (IMPORT-06).
// Phase 45: Added sage_100 to ImportProvider; added idMappingRequired/unmappedIds (IMPORT-02, IMPORT-03).

export type ImportProvider = 'quickbooks' | 'adp' | 'gusto' | 'paychex' | 'sage_300' | 'sage_100';

export interface ImportedRow {
  csvName: string;
  workerId: string;
  workerName: string;
  classificationId: string;
  classificationName: string;
  baseRateSnapshot: number;
  fringeRateSnapshot: number;
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

export interface UnmatchedRow {
  csvName: string;
  hours: {
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
  };
}

export interface ConflictRow {
  csvName: string;
  workerId: string;
  workerName: string;
  reason: string;
}

export interface ImportPreviewResult {
  provider: ImportProvider;
  weekId: string;
  matched: ImportedRow[];
  unmatched: UnmatchedRow[];
  conflicts: ConflictRow[];
  adpWeeklyTotalsOnly?: boolean;
  gustoWeeklyTotalsOnly?: boolean;
  idMappingRequired?: boolean;
  unmappedIds?: string[];
}
