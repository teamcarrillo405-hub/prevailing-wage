import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { fillMdDllr, MD_DLLR_FORM_VERSION } from './mdDllrGenerator.js';

const minimal = {
  contractor: { name: 'Test Co', fein: '123456789', address: '1 Main St, Baltimore, MD 21201' },
  project: { name: 'Bridge Work', mdContractId: 'MD-2025-001', mdAwardingAgency: 'SHA', county: 'Baltimore' },
  week: { weekEndingDate: '2025-06-27', payrollNumber: '1' },
  entries: [],
  compliance: { certifierName: 'Jane Smith', certifierTitle: 'CFO', signatureDate: '2025-06-27', statuteCitation: 'MD Code, Lab. & Emp. § 17-201 et seq.' },
};

describe('mdDllrGenerator', () => {
  it('MD_DLLR_FORM_VERSION is defined', () => { expect(MD_DLLR_FORM_VERSION).toBe('MD DLLR CPR Rev. 2023'); });
  it('generates valid PDF', async () => {
    const bytes = await fillMdDllr(minimal);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toContain('MD Certified Payroll');
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});
