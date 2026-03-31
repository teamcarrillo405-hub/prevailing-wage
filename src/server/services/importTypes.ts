// src/server/services/importTypes.ts
// Shared types for the payroll import pipeline (Phase 35).

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
  provider: 'quickbooks' | 'adp';
  weekId: string;
  matched: ImportedRow[];
  unmatched: UnmatchedRow[];
  conflicts: ConflictRow[];
  adpWeeklyTotalsOnly?: boolean;
}
