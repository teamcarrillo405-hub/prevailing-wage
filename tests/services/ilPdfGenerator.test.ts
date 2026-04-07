import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { fillIlCertifiedTranscript } from '../../src/server/services/ilPdfGenerator.js';

// ── Fixture ────────────────────────────────────────────────────────────────

const sampleInput = {
  contractor: { name: 'Test Contractor LLC', address: 'Cook County, IL', fein: '12-3456789' },
  project: {
    name: 'Test Project',
    number: 'IL-2026-001',
    location: 'Chicago, IL',
    contractingAgency: 'City of Chicago',
  },
  week: { weekEndingDate: '2026-04-05', payrollNumber: '1' },
  entries: [
    {
      workerName: 'Jane Doe',
      workerSsnLast4: '5678',
      workerAddress: '123 Main St, Chicago, IL 60601',
      classification: 'Carpenter',
      monPw: 8, tuePw: 8, wedPw: 8, thuPw: 8, friPw: 8, satPw: 0, sunPw: 0,
      monNonPw: 0, tueNonPw: 0, wedNonPw: 0, thuNonPw: 0, friNonPw: 0, satNonPw: 0, sunNonPw: 0,
      totalPwHours: 40,
      totalNonPwHours: 0,
      baseRate: 45.50,
      fringePension: 5.00, fringePensionIsF: false,
      fringeHealthWelfare: 8.00, fringeHealthWelfareIsF: false,
      fringeVacation: 3.00, fringeVacationIsF: false,
      fringeTraining: 0.50, fringeTrainingIsF: false,
      grossPay: 1956.50,
      deductions: 200.00,
      netPay: 1756.50,
    },
  ],
  affidavit: { subcontractors: [], fundDetails: [] },
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ilPdfGenerator', () => {
  it('fillIlCertifiedTranscript returns a non-empty Uint8Array', async () => {
    const result = await fillIlCertifiedTranscript(sampleInput);
    expect(result.length).toBeGreaterThan(0);
  });

  it('PDFDocument.load(result) succeeds — round-trip validation', async () => {
    const result = await fillIlCertifiedTranscript(sampleInput);
    const loaded = await PDFDocument.load(result);
    expect(loaded).toBeDefined();
  });

  it('Generated PDF has exactly 2 pages', async () => {
    const result = await fillIlCertifiedTranscript(sampleInput);
    const loaded = await PDFDocument.load(result);
    expect(loaded.getPageCount()).toBe(2);
  });
});
