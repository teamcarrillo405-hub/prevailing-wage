import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { fillMtDli, MT_DLI_FORM_VERSION } from './mtDliGenerator.js';

const minimal = {
  contractor: { name: 'Test Co', fein: '123456789', address: '1 Main St, Helena, MT 59601' },
  project: { name: 'Bridge Work', mtContractId: 'MT-2025-001', awardingAgency: 'MDT' },
  week: { weekEndingDate: '2025-06-27', payrollNumber: '1' },
  entries: [],
  compliance: { certifierName: 'Jane Smith', certifierTitle: 'CFO', signatureDate: '2025-06-27', statuteCitation: 'MCA § 18-2-401' },
};

describe('mtDliGenerator', () => {
  it('MT_DLI_FORM_VERSION is defined', () => { expect(MT_DLI_FORM_VERSION).toBe('MT DLI CPR Rev. 2023'); });
  it('generates valid PDF', async () => {
    const bytes = await fillMtDli(minimal);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toContain('MT Certified Payroll');
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});
