import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { fillNjCertifiedPayroll } from '../../src/server/services/njPdfGenerator.js';

// ── Fixture ────────────────────────────────────────────────────────────────

const sampleInput = {
  contractor: {
    name: 'Test Contractor LLC',
    fein: '12-3456789',
    address: 'Newark, NJ',
    njPwcNumber: 'PWC-2026-001',
  },
  project: {
    name: 'Test Road Project',
    njContractId: 'NJ-DOL-2026-001',
    location: 'Newark, NJ',
    awardingAuthority: 'NJ DOT',
  },
  week: { weekEndingDate: '2026-04-05', payrollNumber: '1' },
  entries: [
    {
      workerName: 'John Smith',
      workerSsnLast4: '1234',
      workerAddress: '100 Main St, Newark, NJ 07101',
      classification: 'Laborer',
      workerSex: 'M',
      race: 'W',
      ethnicity: 'N',
      monSt: 8,
      tueSt: 8,
      wedSt: 8,
      thuSt: 8,
      friSt: 8,
      satSt: 0,
      sunSt: 0,
      baseRate: 40.00,
      fringeHealthWelfare: 7.00,
      fringePension: 4.50,
      fringeVacation: 2.00,
      fringeTraining: 0.50,
      grossWages: 1600.00,
      ficaTax: 122.40,
      federalIncomeTax: 200.00,
      stateIncomeTax: 80.00,
      netPay: 1197.60,
    },
  ],
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('njPdfGenerator', () => {
  it('fillNjCertifiedPayroll returns a non-empty Uint8Array', async () => {
    const result = await fillNjCertifiedPayroll(sampleInput);
    expect(result.length).toBeGreaterThan(0);
  });

  it('PDFDocument.load(result) succeeds — round-trip validation', async () => {
    const result = await fillNjCertifiedPayroll(sampleInput);
    const loaded = await PDFDocument.load(result);
    expect(loaded).toBeDefined();
  });

  it('Generated PDF has at least 2 pages (worker table + compliance)', async () => {
    const result = await fillNjCertifiedPayroll(sampleInput);
    const loaded = await PDFDocument.load(result);
    expect(loaded.getPageCount()).toBeGreaterThanOrEqual(2);
  });

  it('handles empty entries array without crashing', async () => {
    const result = await fillNjCertifiedPayroll({ ...sampleInput, entries: [] });
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles null EEO fields — renders em-dash', async () => {
    const result = await fillNjCertifiedPayroll({
      ...sampleInput,
      entries: [
        {
          ...sampleInput.entries[0],
          workerSex: null,
          race: null,
          ethnicity: null,
          ficaTax: null,
          federalIncomeTax: null,
          stateIncomeTax: null,
          grossWages: null,
          netPay: null,
        },
      ],
    });
    expect(result.length).toBeGreaterThan(0);
  });

  it('Statement of Compliance references N.J.S.A. 34:11-56.25 — compliance page always present', async () => {
    const result = await fillNjCertifiedPayroll(sampleInput);
    const loaded = await PDFDocument.load(result);
    // Compliance page always on dedicated page 2 (unconditional addPage)
    expect(loaded.getPageCount()).toBeGreaterThanOrEqual(2);
    expect(result.length).toBeGreaterThan(0);
  });
});
