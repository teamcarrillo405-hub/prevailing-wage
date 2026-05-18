import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { fillOrBoli, OR_BOLI_FORM_VERSION } from './orBoliGenerator.js';

const minimal = {
  contractor: { name: 'Test Co', fein: '123456789', address: '1 Main St, Portland, OR 97201', orCcbLicense: 'CCB-12345' },
  project: { name: 'Road Work', orBoliProjectId: 'OR-2025-001', county: 'Multnomah' },
  week: { weekEndingDate: '2025-06-27', payrollNumber: '1' },
  entries: [],
  compliance: { certifierName: 'Jane Smith', certifierTitle: 'CFO', signatureDate: '2025-06-27', statuteCitation: 'ORS 279C.800 et seq.' },
};

describe('orBoliGenerator', () => {
  it('OR_BOLI_FORM_VERSION is defined', () => { expect(OR_BOLI_FORM_VERSION).toBe('OR BOLI CPR Rev. 2024'); });
  it('generates valid PDF', async () => {
    const bytes = await fillOrBoli(minimal);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toContain('OR Certified Payroll');
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});
