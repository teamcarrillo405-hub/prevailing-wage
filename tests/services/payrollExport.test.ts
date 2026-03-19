import { describe, it, expect } from 'vitest';
import {
  generateLcpTrackerCsv,
  generateEmarsCsv,
  LCPTRACKER_COLUMNS,
  EMARS_COLUMNS,
  type PayrollExportRow,
} from '../../src/server/services/csvExporter.js';

// ── Fixture ────────────────────────────────────────────────────────────────

const row1: PayrollExportRow = {
  contractorName: 'HCC General Contractors',
  projectName: 'Metro Rail Extension',
  weekEnding: '2025-01-05',
  payrollNo: '3',
  workerName: 'Jane Doe',
  identifyingNo: '1234',
  classification: 'Carpenter',
  laborType: 'J',
  monSt: 8, monOt: 0,
  tueSt: 8, tueOt: 0,
  wedSt: 8, wedOt: 0,
  thuSt: 8, thuOt: 0,
  friSt: 8, friOt: 0,
  satSt: 0, satOt: 0,
  sunSt: 0, sunOt: 0,
  totalSt: 40,
  totalOt: 0,
  baseRate: 52.50,
  fringeRate: 18.00,
  grossWages: 2100.00,
  deductions: 300.00,
  netPay: 1800.00,
};

const row2: PayrollExportRow = {
  contractorName: 'HCC General Contractors',
  projectName: 'Metro Rail Extension',
  weekEnding: '2025-01-05',
  payrollNo: '3',
  workerName: 'John Smith',
  identifyingNo: 'N/A',
  classification: 'Laborer',
  laborType: 'RA',
  monSt: 8, monOt: 2,
  tueSt: 8, tueOt: 2,
  wedSt: 8, wedOt: 0,
  thuSt: 8, thuOt: 0,
  friSt: 8, friOt: 0,
  satSt: 0, satOt: 0,
  sunSt: 0, sunOt: 0,
  totalSt: 40,
  totalOt: 4,
  baseRate: 38.75,
  fringeRate: 12.50,
  grossWages: 1700.00,
  deductions: 220.00,
  netPay: 1480.00,
};

const rows = [row1, row2];

// ── Tests ──────────────────────────────────────────────────────────────────

describe('csvExporter', () => {
  it('generateLcpTrackerCsv returns string with correct header row', () => {
    const csv = generateLcpTrackerCsv(rows);
    expect(typeof csv).toBe('string');

    const headerLine = csv.split('\n')[0];
    // Every value in LCPTRACKER_COLUMNS should appear in the header
    for (const colHeader of Object.values(LCPTRACKER_COLUMNS)) {
      expect(headerLine).toContain(colHeader);
    }
  });

  it('generateLcpTrackerCsv row has correct worker name and daily hours', () => {
    const csv = generateLcpTrackerCsv(rows);
    // Worker name should appear verbatim (no corruption)
    expect(csv).toContain('Jane Doe');
    // Daily hours 8.0 should not be corrupted to float artifacts
    const lines = csv.split('\n');
    // row1 has monSt=8, this should appear as "8" not "8.000000001"
    const dataLine = lines.find(l => l.includes('Jane Doe'));
    expect(dataLine).toBeDefined();
    // The value 8 should be present without floating-point garbage
    expect(dataLine).toMatch(/"8"/);
  });

  it('generateEmarsCsv returns string with eMars column headers', () => {
    const csv = generateEmarsCsv(rows);
    expect(typeof csv).toBe('string');

    const headerLine = csv.split('\n')[0];
    // Every value in EMARS_COLUMNS should appear in the header
    for (const colHeader of Object.values(EMARS_COLUMNS)) {
      expect(headerLine).toContain(colHeader);
    }
    // eMars uses ALLCAPS underscore format
    expect(headerLine).toContain('WORKER_NAME');
    expect(csv).toContain('Jane Doe');
  });

  it('PayrollExportRow maps to LCPtracker column names via LCPTRACKER_COLUMNS', () => {
    // Every key in PayrollExportRow must have a mapping in LCPTRACKER_COLUMNS
    const exportRowKeys: (keyof PayrollExportRow)[] = [
      'contractorName', 'projectName', 'weekEnding', 'payrollNo',
      'workerName', 'identifyingNo', 'classification', 'laborType',
      'monSt', 'monOt', 'tueSt', 'tueOt', 'wedSt', 'wedOt',
      'thuSt', 'thuOt', 'friSt', 'friOt', 'satSt', 'satOt',
      'sunSt', 'sunOt', 'totalSt', 'totalOt',
      'baseRate', 'fringeRate', 'grossWages', 'deductions', 'netPay',
    ];

    for (const key of exportRowKeys) {
      expect(LCPTRACKER_COLUMNS).toHaveProperty(key);
      expect(EMARS_COLUMNS).toHaveProperty(key);
    }

    // Column count must match — no orphaned mappings
    expect(Object.keys(LCPTRACKER_COLUMNS).length).toBe(exportRowKeys.length);
    expect(Object.keys(EMARS_COLUMNS).length).toBe(exportRowKeys.length);
  });
});
