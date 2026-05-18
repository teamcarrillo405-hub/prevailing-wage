import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { fillDeDol, DE_DOL_FORM_VERSION } from './deDolGenerator.js';

const minimal = {
  contractor: { name: 'Test Co', fein: '123456789', address: '1 Main St, Dover, DE 19901' },
  project: { name: 'Building Work', deContractId: 'DE-2025-001', awardingAgency: 'DelDOT' },
  week: { weekEndingDate: '2025-06-27', payrollNumber: '1' },
  entries: [],
  compliance: { certifierName: 'Jane Smith', certifierTitle: 'CFO', signatureDate: '2025-06-27', statuteCitation: '29 Del. C. § 6960' },
};

describe('deDolGenerator', () => {
  it('DE_DOL_FORM_VERSION is defined', () => { expect(DE_DOL_FORM_VERSION).toBe('DE DOL CPR Rev. 2023'); });
  it('generates valid PDF', async () => {
    const bytes = await fillDeDol(minimal);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toContain('DE Certified Payroll');
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});
