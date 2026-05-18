import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { fillNmCpr, NM_CPR_FORM_VERSION } from './nmCprGenerator.js';

const minimal = {
  contractor: { name: 'Test Co', fein: '123456789', address: '1 Main St, Santa Fe, NM 87501' },
  project: { name: 'Facility Repair', nmContractId: 'NM-2025-001', nmAwardingAgency: 'NMDOT' },
  week: { weekEndingDate: '2025-06-27', payrollNumber: '1' },
  entries: [],
  compliance: { certifierName: 'Jane Smith', certifierTitle: 'CFO', signatureDate: '2025-06-27', statuteCitation: 'NMSA § 13-4-11' },
};

describe('nmCprGenerator', () => {
  it('NM_CPR_FORM_VERSION is defined', () => { expect(NM_CPR_FORM_VERSION).toBe('NM DOL CPR Rev. 2023'); });
  it('generates valid PDF', async () => {
    const bytes = await fillNmCpr(minimal);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toContain('NM Certified Payroll');
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});
