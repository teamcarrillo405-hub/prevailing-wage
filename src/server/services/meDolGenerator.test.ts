import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { fillMeDol, ME_DOL_FORM_VERSION } from './meDolGenerator.js';

const minimal = {
  contractor: { name: 'Test Co', fein: '123456789', address: '1 Main St, Augusta, ME 04330' },
  project: { name: 'Bridge Work', meContractId: 'ME-2025-001', awardingAgency: 'MaineDOT' },
  week: { weekEndingDate: '2025-06-27', payrollNumber: '1' },
  entries: [],
  compliance: { certifierName: 'Jane Smith', certifierTitle: 'CFO', signatureDate: '2025-06-27', statuteCitation: '26 MRS § 1311' },
};

describe('meDolGenerator', () => {
  it('ME_DOL_FORM_VERSION is defined', () => { expect(ME_DOL_FORM_VERSION).toBe('ME DOL CPR Rev. 2023'); });
  it('generates valid PDF', async () => {
    const bytes = await fillMeDol(minimal);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toContain('ME Certified Payroll');
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});
