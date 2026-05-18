import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { fillRiDol, RI_DOL_FORM_VERSION } from './riDolGenerator.js';

const minimal = {
  contractor: { name: 'Test Co', fein: '123456789', address: '1 Main St, Providence, RI 02903' },
  project: { name: 'Bridge Work', riContractId: 'RI-2025-001', awardingAgency: 'RIDOT' },
  week: { weekEndingDate: '2025-06-27', payrollNumber: '1' },
  entries: [],
  compliance: { certifierName: 'Jane Smith', certifierTitle: 'CFO', signatureDate: '2025-06-27', statuteCitation: 'RIGL § 37-13-1' },
};

describe('riDolGenerator', () => {
  it('RI_DOL_FORM_VERSION is defined', () => { expect(RI_DOL_FORM_VERSION).toBe('RI DOL CPR Rev. 2023'); });
  it('generates valid PDF', async () => {
    const bytes = await fillRiDol(minimal);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toContain('RI Certified Payroll');
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});
