import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { fillDcOcp, DC_OCP_FORM_VERSION } from './dcOcpGenerator.js';

const minimal = {
  contractor: { name: 'Test Co', fein: '123456789', address: '1 K St NW, Washington, DC 20001', dcBusinessLicense: 'BBL-001' },
  project: { name: 'Metro Work', dcContractNumber: 'DC-2025-001', dcAgency: 'OCTO', dcProjectManager: null },
  week: { weekEndingDate: '2025-06-27', payrollNumber: '1' },
  entries: [],
  compliance: { certifierName: 'Jane Smith', certifierTitle: 'CFO', signatureDate: '2025-06-27', statuteCitation: 'DC Code § 32-1002' },
};

describe('dcOcpGenerator', () => {
  it('DC_OCP_FORM_VERSION is defined', () => { expect(DC_OCP_FORM_VERSION).toBe('DC DOES CPR Rev. 2024'); });
  it('generates valid PDF', async () => {
    const bytes = await fillDcOcp(minimal);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toBe('DC DOES Certified Payroll \u2014 DC DOES CPR Rev. 2024');
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});
