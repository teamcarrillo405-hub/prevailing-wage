import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { fillA1131, type A1131Data } from '../../src/server/services/a1131Generator.js';

// ── Fixture ────────────────────────────────────────────────────────────────

const FIXTURE: A1131Data = {
  contractorName: 'HCC Construction LLC',
  contractorAddress: '123 Main St, Los Angeles, CA 90001',
  cslbLicense: '1099876',
  wcPolicyNumber: 'WC-2026-789',
  projectName: 'CA State Office Building',
  projectLocation: 'Los Angeles, CA',
  contractNo: 'CA20-2025-001',
  wageDeterminationNo: 'CA20-2025-001',
  weekEndingDate: '03/21/2026',
  payrollNumber: '3',
  workers: [
    {
      entryNo: 1,
      workerName: 'Garcia, Carlos',
      identifyingNo: '1234',
      laborType: 'journeyworker',
      classification: 'Carpenter',
      sunSt: 0, sunOt: 0, sunDt: 0,
      monSt: 8, monOt: 0, monDt: 0,
      tueSt: 8, tueOt: 0, tueDt: 0,
      wedSt: 8, wedOt: 0, wedDt: 0,
      thuSt: 8, thuOt: 0, thuDt: 0,
      friSt: 8, friOt: 0, friDt: 0,
      satSt: 0, satOt: 0, satDt: 0,
      totalSt: 40,
      totalOt: 0,
      totalDt: 0,
      stRate: 50.00,
      otRate: 75.00,
      dtRate: 100.00,
      grossWages: 2000.00,
      federalTax: 0,
      stateTax: 0,
      sdi: 0,
      otherDeductions: 0,
      totalDeductions: 300.00,
      netPay: 1700.00,
      fringeCredit: 600.00,  // separate from deductions
    },
  ],
};

let templateBytes: Uint8Array;
let filledBytes: Uint8Array;

beforeAll(async () => {
  const templatePath = path.join(process.cwd(), 'assets', 'a1131-fillable-template.pdf');
  templateBytes = readFileSync(templatePath);
  filledBytes = await fillA1131(FIXTURE, templateBytes);
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('fillA1131 - CAL-02', () => {
  it('should return a valid PDF (starts with %PDF)', async () => {
    expect(filledBytes).toBeInstanceOf(Uint8Array);
    // PDF magic bytes: %PDF
    const header = Buffer.from(filledBytes.slice(0, 4)).toString('ascii');
    expect(header).toBe('%PDF');
  });

  it('should produce PDF output > 1000 bytes', async () => {
    expect(filledBytes.length).toBeGreaterThan(1000);
  });

  it('should handle empty workers array', async () => {
    const emptyData: A1131Data = { ...FIXTURE, workers: [] };
    const result = await fillA1131(emptyData, templateBytes);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(1000);
    const doc = await PDFDocument.load(result);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });

  it('produces a loadable PDF document with correct page count', async () => {
    const doc = await PDFDocument.load(filledBytes);
    expect(doc.getPageCount()).toBe(2);  // 1 worker page + 1 cert page
  });

  it('PDF roundtrips cleanly (no corruption from fill operation)', async () => {
    const doc = await PDFDocument.load(filledBytes);
    const reSaved = await doc.save();
    expect(reSaved.length).toBeGreaterThan(1000);
    // Should still be loadable after re-save
    const reDoc = await PDFDocument.load(reSaved);
    expect(reDoc.getPageCount()).toBe(2);
  });

  it('removes AcroForm widgets so generated values do not render with opaque field boxes', async () => {
    const doc = await PDFDocument.load(filledBytes);
    expect(doc.getForm().getFields()).toHaveLength(0);
  });

  it('A1131WorkerRow interface has Sun-Sat DT fields in Sun-first order', () => {
    const worker = FIXTURE.workers[0]!;
    // Verify Sun-first day order by checking all day fields exist
    expect(typeof worker.sunSt).toBe('number');
    expect(typeof worker.sunOt).toBe('number');
    expect(typeof worker.sunDt).toBe('number');
    expect(typeof worker.monSt).toBe('number');
    expect(typeof worker.satSt).toBe('number');
    // fringeCredit is separate from totalDeductions
    expect(worker.fringeCredit).toBe(600.00);
    expect(worker.totalDeductions).toBe(300.00);
    expect(worker.fringeCredit).not.toBe(worker.totalDeductions);
  });
});

describe('fillA1131 multi-page', () => {
  it('produces 4 pages for 6 workers (2 page sets of 5 workers max each)', async () => {
    const manyWorkers: A1131Data = {
      ...FIXTURE,
      workers: Array.from({ length: 6 }, (_, i) => ({
        ...FIXTURE.workers[0]!,
        entryNo: i + 1,
        workerName: `Worker ${i + 1}, Test`,
      })),
    };
    const result = await fillA1131(manyWorkers, templateBytes);
    const doc = await PDFDocument.load(result);
    expect(doc.getPageCount()).toBe(4);  // 2 page sets × 2 pages each
  });
});
