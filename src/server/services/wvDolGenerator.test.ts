import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { fillWvDol, WV_DOL_FORM_VERSION } from './wvDolGenerator.js';

const minimal = {
  contractor: { name: 'Test Co', fein: '123456789', address: '1 Main St, Charleston, WV 25301' },
  project: { name: 'Road Work', wvContractId: 'WV-2025-001', awardingAgency: 'WVDOH' },
  week: { weekEndingDate: '2025-06-27', payrollNumber: '1' },
  entries: [],
  compliance: { certifierName: 'Jane Smith', certifierTitle: 'CFO', signatureDate: '2025-06-27', statuteCitation: 'WV Code § 21-5A-1' },
};

describe('wvDolGenerator', () => {
  it('WV_DOL_FORM_VERSION is defined', () => { expect(WV_DOL_FORM_VERSION).toBe('WV DOL CPR Rev. 2023'); });
  it('generates valid PDF', async () => {
    const bytes = await fillWvDol(minimal);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toContain('WV Certified Payroll');
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});
