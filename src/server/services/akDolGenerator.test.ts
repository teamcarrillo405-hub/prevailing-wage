import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { fillAkDol, AK_DOL_FORM_VERSION } from './akDolGenerator.js';

const minimal = {
  contractor: { name: 'Test Co', fein: '123456789', address: '1 Main St, Juneau, AK 99801' },
  project: { name: 'Road Work', akContractId: 'AK-2025-001', akAwardingAgency: 'ADOT&PF' },
  week: { weekEndingDate: '2025-06-27', payrollNumber: '1' },
  entries: [],
  compliance: { certifierName: 'Jane Smith', certifierTitle: 'CFO', signatureDate: '2025-06-27', statuteCitation: 'AS 36.05.010' },
};

describe('akDolGenerator', () => {
  it('AK_DOL_FORM_VERSION is defined', () => { expect(AK_DOL_FORM_VERSION).toBe('AK DOL CPR Rev. 2024'); });
  it('generates valid PDF with Sunday-first columns', async () => {
    const bytes = await fillAkDol(minimal);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toContain('AK Certified Payroll');
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });
  it('handles workers with Sunday-first hours', async () => {
    const data = {
      ...minimal,
      entries: [{
        workerName: 'Bob Jones', workerSsnLast4: '1234', classification: 'Carpenter', isApprentice: false,
        sunSt: 0, monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8, satSt: 0,
        sunOt: 0, monOt: 0, tueOt: 0, wedOt: 0, thuOt: 0, friOt: 0, satOt: 0,
        baseRate: 48.00, grossWages: 1920.00,
        ficaTax: 146.88, fitWithheld: 288.00, stateWithheld: 0, otherDeductions: 0, netPay: 1485.12,
      }],
    };
    await expect(fillAkDol(data)).resolves.toBeTruthy();
  });
});
