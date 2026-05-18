import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { fillNdDlt, ND_DLT_FORM_VERSION } from './ndDltGenerator.js';

const minimal = {
  contractor: { name: 'Test Co', fein: '123456789', address: '1 Main St, Bismarck, ND 58501' },
  project: { name: 'Road Work', ndContractId: 'ND-2025-001', awardingAgency: 'NDDOT' },
  week: { weekEndingDate: '2025-06-27', payrollNumber: '1' },
  entries: [],
  compliance: { certifierName: 'Jane Smith', certifierTitle: 'CFO', signatureDate: '2025-06-27', statuteCitation: 'NDCC 34-14-01' },
};

describe('ndDltGenerator', () => {
  it('ND_DLT_FORM_VERSION is defined', () => { expect(ND_DLT_FORM_VERSION).toBe('ND DLT CPR Rev. 2023'); });
  it('generates valid PDF', async () => {
    const bytes = await fillNdDlt(minimal);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toContain('ND Certified Payroll');
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});
