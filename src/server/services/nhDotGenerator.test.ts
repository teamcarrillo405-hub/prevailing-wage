import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { fillNhDot, NH_DOT_FORM_VERSION } from './nhDotGenerator.js';

const minimal = {
  contractor: { name: 'Test Co', fein: '123456789', address: '1 Main St, Concord, NH 03301' },
  project: { name: 'Highway Work', nhContractId: 'NH-2025-001', nhDotProjectNumber: 'NH-13892-A' },
  week: { weekEndingDate: '2025-06-27', payrollNumber: '1' },
  entries: [],
  compliance: { certifierName: 'Jane Smith', certifierTitle: 'CFO', signatureDate: '2025-06-27', statuteCitation: 'RSA 228:22' },
};

describe('nhDotGenerator', () => {
  it('NH_DOT_FORM_VERSION is defined', () => { expect(NH_DOT_FORM_VERSION).toBe('NH DOT CPR Rev. 2023'); });
  it('generates valid PDF', async () => {
    const bytes = await fillNhDot(minimal);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toContain('NH Certified Payroll');
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});
