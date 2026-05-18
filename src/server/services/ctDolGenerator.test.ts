import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { fillCtDol, CT_DOL_FORM_VERSION } from './ctDolGenerator.js';

const minimal = {
  contractor: { name: 'Test Co', fein: '123456789', address: '1 Main St, Hartford, CT 06103' },
  project: { name: 'School Renovation', ctContractId: 'CT-2025-001', ctAwardingMunicipality: 'Hartford' },
  week: { weekEndingDate: '2025-06-27', payrollNumber: '1' },
  entries: [],
  compliance: { certifierName: 'Jane Smith', certifierTitle: 'CFO', signatureDate: '2025-06-27', statuteCitation: 'CGS § 31-53' },
};

describe('ctDolGenerator', () => {
  it('CT_DOL_FORM_VERSION is defined', () => { expect(CT_DOL_FORM_VERSION).toBe('CT DOL CPR Rev. 2023'); });
  it('generates valid PDF', async () => {
    const bytes = await fillCtDol(minimal);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toContain('CT Certified Payroll');
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});
