import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { fillMaCertifiedPayroll } from '../../src/server/services/maPdfGenerator.js';

// ── Fixture ────────────────────────────────────────────────────────────────

const sampleInput = {
  contractor: { name: 'Test Contractor LLC', fein: '12-3456789', address: 'Boston, MA' },
  project: {
    name: 'Test Highway Project',
    dlsProjectId: 'MA-DLS-2026-001',
    location: 'Boston, MA',
    awardingAuthority: 'MassDOT',
  },
  week: { weekEndingDate: '2026-04-05', payrollNumber: '1' },
  entries: [
    {
      workerName: 'Jane Doe',
      workerSsnLast4: '5678',
      workerAddress: '123 Main St, Boston, MA 02101',
      classification: 'Carpenter',
      oshaTraining: true,
      isWoman: true,
      isMinority: false,
      sunSt: 0, monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8, satSt: 0,
      baseRate: 45.50,
      fringeHealthWelfare: 8.00,
      fringePension: 5.00,
      fringeVacation: 3.00,
      fringeTraining: 0.50,
      projectGross: 1956.50,
      totalWeekGross: 2100.00,
      allOtherHours: 4.0,
      checkNumber: '10234',
    },
  ],
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('maPdfGenerator', () => {
  it('fillMaCertifiedPayroll returns a non-empty Uint8Array', async () => {
    const result = await fillMaCertifiedPayroll(sampleInput);
    expect(result.length).toBeGreaterThan(0);
  });

  it('PDFDocument.load(result) succeeds — round-trip validation', async () => {
    const result = await fillMaCertifiedPayroll(sampleInput);
    const loaded = await PDFDocument.load(result);
    expect(loaded).toBeDefined();
  });

  it('Generated PDF has at least 2 pages (worker table + compliance)', async () => {
    const result = await fillMaCertifiedPayroll(sampleInput);
    const loaded = await PDFDocument.load(result);
    expect(loaded.getPageCount()).toBeGreaterThanOrEqual(2);
  });

  it('handles empty entries array without crashing', async () => {
    const result = await fillMaCertifiedPayroll({ ...sampleInput, entries: [] });
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles null optional fields without crashing', async () => {
    const result = await fillMaCertifiedPayroll({
      ...sampleInput,
      entries: [
        {
          ...sampleInput.entries[0],
          oshaTraining: null,
          isWoman: null,
          isMinority: null,
          projectGross: null,
          totalWeekGross: null,
          allOtherHours: null,
          checkNumber: null,
        },
      ],
    });
    expect(result.length).toBeGreaterThan(0);
  });
});
