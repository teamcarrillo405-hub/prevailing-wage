import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { fillVtDfr, VT_DFR_FORM_VERSION } from './vtDfrGenerator.js';

const minimal = {
  contractor: { name: 'Test Co', fein: '123456789', address: '1 Main St, Montpelier, VT 05602' },
  project: { name: 'Road Work', vtContractId: 'VT-2025-001', awardingAgency: 'VTrans' },
  week: { weekEndingDate: '2025-06-27', payrollNumber: '1' },
  entries: [],
  compliance: { certifierName: 'Jane Smith', certifierTitle: 'CFO', signatureDate: '2025-06-27', statuteCitation: '21 VSA § 391' },
};

describe('vtDfrGenerator', () => {
  it('VT_DFR_FORM_VERSION is defined', () => { expect(VT_DFR_FORM_VERSION).toBe('VT DFR CPR Rev. 2023'); });
  it('generates valid PDF', async () => {
    const bytes = await fillVtDfr(minimal);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toContain('VT Certified Payroll');
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});
