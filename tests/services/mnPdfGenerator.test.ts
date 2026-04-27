import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { fillMnCertifiedPayroll } from '../../src/server/services/mnPdfGenerator.js';

// ── Fixture ────────────────────────────────────────────────────────────────

const sampleInput = {
  contractor: { name: 'Test Contractor LLC', fein: '12-3456789', address: 'Minneapolis, MN' },
  project: {
    name: 'Test Highway Project',
    mnContractId: 'MN-DLI-2026-001',
    location: 'Minneapolis, MN',
    awardingAuthority: 'MnDOT',
  },
  week: { weekEndingDate: '2026-04-05', payrollNumber: '1' },
  entries: [
    {
      workerName: 'Jane Doe',
      workerSsnLast4: '5678',
      workerAddress: '123 Main St, Minneapolis, MN 55401',
      classification: 'Carpenter',
      monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8, satSt: 0, sunSt: 0,
      baseRate: 45.50,
      fringeHealthWelfare: 8.00,
      fringePension: 5.00,
      fringeVacation: 3.00,
      fringeTraining: 0.50,
      grossWages: 1820.00,
      checkNumber: '10234',
    },
  ],
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('mnPdfGenerator', () => {
  it('fillMnCertifiedPayroll returns a non-empty Uint8Array', async () => {
    const result = await fillMnCertifiedPayroll(sampleInput);
    expect(result.length).toBeGreaterThan(0);
  });

  it('PDFDocument.load(result) succeeds — round-trip validation', async () => {
    const result = await fillMnCertifiedPayroll(sampleInput);
    const loaded = await PDFDocument.load(result);
    expect(loaded).toBeDefined();
  });

  it('Generated PDF has at least 2 pages (worker table + compliance)', async () => {
    const result = await fillMnCertifiedPayroll(sampleInput);
    const loaded = await PDFDocument.load(result);
    expect(loaded.getPageCount()).toBeGreaterThanOrEqual(2);
  });

  it('handles empty entries array without crashing', async () => {
    const result = await fillMnCertifiedPayroll({ ...sampleInput, entries: [] });
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles null optional fields without crashing', async () => {
    const result = await fillMnCertifiedPayroll({
      ...sampleInput,
      entries: [
        {
          ...sampleInput.entries[0],
          workerSsnLast4: null,
          fringeHealthWelfare: null,
          fringePension: null,
          fringeVacation: null,
          fringeTraining: null,
          grossWages: null,
          checkNumber: null,
        },
      ],
    });
    expect(result.length).toBeGreaterThan(0);
  });
});
