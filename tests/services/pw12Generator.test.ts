import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { fillPw12 } from '../../src/server/services/pw12Generator.js';

// ── Fixture ────────────────────────────────────────────────────────────────

const sampleInput = {
  contractor: {
    name: 'Test Contractor LLC',
    fein: '12-3456789',
    address: 'Albany, NY',
  },
  week: {
    weekEndingDate: '2026-04-05',
    payrollNumber: 'W-001',
  },
  project: {
    name: 'Test Project',
    nyprcNumber: 'PRC-12345',
    county: 'Albany',
  },
  entries: [
    {
      workerName: 'John Smith',
      workerSsnLast4: '1234',
      tradeDescription: 'Carpenter',
      laborType: 'journeyworker',
      monSt: 8, monOt: 0,
      tueSt: 8, tueOt: 0,
      wedSt: 8, wedOt: 2,
      thuSt: 8, thuOt: 0,
      friSt: 8, friOt: 0,
      satSt: 0, satOt: 0,
      sunSt: 0, sunOt: 0,
      totalStHours: 40,
      totalOtHours: 2,
      baseRateSnapshot: 45.50,
      grossWages: 1956.50,
      deductions: 200.00,
      netPay: 1756.50,
      fringeHealthWelfare: 80,
      fringePension: 60,
      fringeVacation: 40,
      fringeTraining: 20,
    },
  ],
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('pw12Generator', () => {
  it('fillPw12 returns a non-empty Uint8Array', async () => {
    const result = await fillPw12(sampleInput);
    expect(result.length).toBeGreaterThan(0);
  });

  it('PDFDocument.load(result) succeeds — round-trip validation', async () => {
    const result = await fillPw12(sampleInput);
    const loaded = await PDFDocument.load(result);
    expect(loaded).toBeDefined();
  });

  it('Generated PDF has at least 1 page', async () => {
    const result = await fillPw12(sampleInput);
    const loaded = await PDFDocument.load(result);
    expect(loaded.getPageCount()).toBeGreaterThanOrEqual(1);
  });
});
