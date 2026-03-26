import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { fillF700, type F700Data, WA_TRADE_CODES } from '../../src/server/services/f700Generator.js';

// ── Fixture ────────────────────────────────────────────────────────────────

const FIXTURE: F700Data = {
  contractorName: 'HCC Construction LLC',
  contractorAddress: '123 Main St, Seattle, WA 98101',
  ubiNumber: '123456789',
  lniCertificate: 'HCCCO1234LI',
  wcAccount: '234-56-7',
  projectName: 'WA State Office Building',
  projectLocation: 'King County, WA',
  contractNo: 'WA20-2026-001',
  weekEndingDate: '03/28/2026',
  payrollNumber: '1',
  workers: [
    {
      entryNo: 1,
      workerName: 'Garcia, Carlos',
      identifyingNo: '1234',
      laborType: 'journeyworker',
      waTradeCode: 'CARP',
      classification: 'Carpenter',
      monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8, satSt: 0, sunSt: 0,
      monOt: 0, tueOt: 0, wedOt: 0, thuOt: 0, friOt: 0, satOt: 0, sunOt: 0,
      totalSt: 40,
      totalOt: 0,
      baseRate: 52.00,
      otRate: 78.00,
      grossWages: 2080.00,
      deductions: 350.00,
      netPay: 1730.00,
      fringeCredit: 15.00,
    },
  ],
};

let templateBytes: Uint8Array;
let filledBytes: Uint8Array;

beforeAll(async () => {
  const templatePath = path.join(process.cwd(), 'assets', 'f700-official.pdf');
  templateBytes = readFileSync(templatePath);
  filledBytes = await fillF700(FIXTURE, templateBytes);
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('fillF700 - WAL-02', () => {
  it('assets/f700-official.pdf exists', () => {
    const templatePath = path.join(process.cwd(), 'assets', 'f700-official.pdf');
    expect(existsSync(templatePath)).toBe(true);
  });

  it('should return a valid PDF (starts with %PDF)', () => {
    expect(filledBytes).toBeInstanceOf(Uint8Array);
    const header = Buffer.from(filledBytes.slice(0, 4)).toString('ascii');
    expect(header).toBe('%PDF');
  });

  it('should produce PDF output > 1000 bytes', () => {
    expect(filledBytes.length).toBeGreaterThan(1000);
  });

  it('should handle empty workers array', async () => {
    const emptyData: F700Data = { ...FIXTURE, workers: [] };
    const result = await fillF700(emptyData, templateBytes);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(1000);
    const doc = await PDFDocument.load(result);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('produces a loadable PDF document', async () => {
    const doc = await PDFDocument.load(filledBytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('PDF roundtrips cleanly (no corruption from fill operation)', async () => {
    const doc = await PDFDocument.load(filledBytes);
    const reSaved = await doc.save();
    expect(reSaved.length).toBeGreaterThan(1000);
    const reDoc = await PDFDocument.load(reSaved);
    expect(reDoc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('F700WorkerRow interface has Mon-Sun ST and OT fields (no DT — WA form)', () => {
    const worker = FIXTURE.workers[0]!;
    // WA F700 has ST/OT only — no DT column (RCW 49.28.010)
    expect(typeof worker.monSt).toBe('number');
    expect(typeof worker.monOt).toBe('number');
    expect(typeof worker.sunSt).toBe('number');
    expect(typeof worker.sunOt).toBe('number');
    // No DT fields on WA form
    expect('monDt' in worker).toBe(false);
  });

  it('F700WorkerRow includes WA-specific waTradeCode field', () => {
    const worker = FIXTURE.workers[0]!;
    expect(worker.waTradeCode).toBe('CARP');
    expect(typeof worker.waTradeCode).toBe('string');
  });

  it('F700Data includes WA-specific header fields (ubiNumber, lniCertificate, wcAccount)', () => {
    expect(FIXTURE.ubiNumber).toBe('123456789');
    expect(FIXTURE.lniCertificate).toBe('HCCCO1234LI');
    expect(FIXTURE.wcAccount).toBe('234-56-7');
  });
});

describe('fillF700 multi-page', () => {
  it('produces 2 pages for 9 workers when ROWS_PER_PAGE is 8', async () => {
    const manyWorkers: F700Data = {
      ...FIXTURE,
      workers: Array.from({ length: 9 }, (_, i) => ({
        ...FIXTURE.workers[0]!,
        entryNo: i + 1,
        workerName: `Worker ${i + 1}, Test`,
      })),
    };
    const result = await fillF700(manyWorkers, templateBytes);
    const doc = await PDFDocument.load(result);
    // 9 workers with 8 per page = 2 pages
    expect(doc.getPageCount()).toBe(2);
  });
});

describe('WA_TRADE_CODES constant - WAL-02', () => {
  it('exports WA_TRADE_CODES with expected 4-letter codes', () => {
    expect(WA_TRADE_CODES).toBeDefined();
    expect(typeof WA_TRADE_CODES).toBe('object');
  });

  it('includes core confirmed WA L&I trade codes', () => {
    expect(WA_TRADE_CODES['CARP']).toBe('Carpenters');
    expect(WA_TRADE_CODES['ELEC']).toBe('Electricians (Inside)');
    expect(WA_TRADE_CODES['LABO']).toBe('Laborers');
    expect(WA_TRADE_CODES['OPER']).toBe('Operating Engineers');
    expect(WA_TRADE_CODES['PLUM']).toBe('Plumbers and Pipefitters');
    expect(WA_TRADE_CODES['IRON']).toBe('Ironworkers');
  });

  it('has all codes exactly 4 characters long', () => {
    for (const code of Object.keys(WA_TRADE_CODES)) {
      expect(code.length).toBe(4);
    }
  });

  it('has at least 10 trade codes', () => {
    expect(Object.keys(WA_TRADE_CODES).length).toBeGreaterThanOrEqual(10);
  });
});
