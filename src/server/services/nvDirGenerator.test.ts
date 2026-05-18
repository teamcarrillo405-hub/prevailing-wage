import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { fillNvDir, NV_DIR_FORM_VERSION } from './nvDirGenerator.js';

const minimal = {
  contractor: { name: 'Test Co', fein: '123456789', address: '1 Main St, Carson City, NV 89701', nvContractorLicense: 'NV-LIC-001' },
  project: { name: 'Road Work', nvContractId: 'NV-2025-001', county: 'Clark' },
  week: { weekEndingDate: '2025-06-27', payrollNumber: '1' },
  entries: [],
  compliance: { certifierName: 'Jane Smith', certifierTitle: 'CFO', signatureDate: '2025-06-27', statuteCitation: 'NRS 338.010' },
};

describe('nvDirGenerator', () => {
  it('NV_DIR_FORM_VERSION is defined', () => { expect(NV_DIR_FORM_VERSION).toBe('NV DIR CPR Rev. 2024'); });
  it('generates valid PDF', async () => {
    const bytes = await fillNvDir(minimal);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toContain('NV Certified Payroll');
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});
