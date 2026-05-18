import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { fillKyCpr, KY_CPR_FORM_VERSION } from './kyCprGenerator.js';

const minimal = {
  contractor: { name: 'Test Co', fein: '123456789', address: '1 Main St, Frankfort, KY 40601' },
  project: { name: 'Road Work', kyContractId: 'KY-2025-001', kyAwardingAgency: 'KYTC' },
  week: { weekEndingDate: '2025-06-27', payrollNumber: '1' },
  entries: [],
  compliance: { certifierName: 'Jane Smith', certifierTitle: 'CFO', signatureDate: '2025-06-27', statuteCitation: 'KRS 337.505' },
};

describe('kyCprGenerator', () => {
  it('KY_CPR_FORM_VERSION is defined', () => { expect(KY_CPR_FORM_VERSION).toBe('KY Labor Cabinet CPR Rev. 2023'); });
  it('generates valid PDF', async () => {
    const bytes = await fillKyCpr(minimal);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toContain('KY Certified Payroll');
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});
