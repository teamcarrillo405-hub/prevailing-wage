import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { fillCookCpr, COOK_CPR_FORM_VERSION } from './cookCprGenerator.js';
import type { CookCprInput } from './cookCprGenerator.js';

const minimal: CookCprInput = {
  contractor: { name: 'Test Co', fein: '111223333', address: '100 N LaSalle' },
  project: { name: 'Bridge Work', cookContractId: 'CC-2025-001', location: 'Cook County, IL',
    contractingAgency: 'Cook County DOT', cookLivingWageApplies: false, ccllwoContractYear: null },
  week: { weekEndingDate: '2025-06-27', payrollNumber: '1' },
  entries: [],
  compliance: { certifierName: 'Joe Smith', certifierTitle: 'CFO', signatureDate: '2025-06-27', statuteCitation: '820 ILCS 130/5' },
};

describe('cookCprGenerator', () => {
  it('COOK_CPR_FORM_VERSION is defined', () => {
    expect(COOK_CPR_FORM_VERSION).toBe('Cook County CPR Rev. 2024');
  });
  it('generates 2-page PDF without LWO', async () => {
    const bytes = await fillCookCpr(minimal);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });
  it('generates 3-page PDF with LWO affidavit', async () => {
    const bytes = await fillCookCpr({ ...minimal, project: { ...minimal.project, cookLivingWageApplies: true, ccllwoContractYear: '2025' } });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(3);
  });
});
