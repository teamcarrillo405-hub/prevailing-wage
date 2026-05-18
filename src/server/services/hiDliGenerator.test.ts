import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { fillHiDli, HI_DLI_FORM_VERSION } from './hiDliGenerator.js';

const minimal = {
  contractor: { name: 'Test Co', fein: '123456789', address: '1 Main St, Honolulu, HI 96813' },
  project: { name: 'Harbor Repair', hiContractId: 'HI-2025-001', hiAwardingAgency: 'Hawaii DOT' },
  week: { weekEndingDate: '2025-06-27', payrollNumber: '1' },
  entries: [],
  compliance: { certifierName: 'Jane Smith', certifierTitle: 'CFO', signatureDate: '2025-06-27', statuteCitation: 'HRS Chapter 104' },
};

describe('hiDliGenerator', () => {
  it('HI_DLI_FORM_VERSION is defined', () => { expect(HI_DLI_FORM_VERSION).toBe('HI DLI CPR Rev. 2024'); });
  it('generates valid PDF with DT columns', async () => {
    const bytes = await fillHiDli(minimal);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toContain('HI Certified Payroll');
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });
  it('handles workers with DT hours', async () => {
    const data = {
      ...minimal,
      entries: [{
        workerName: 'Bob Jones', workerSsnLast4: '1234', classification: 'Carpenter', isApprentice: false,
        monSt: 8, monOt: 2, monDt: 1, tueSt: 8, tueOt: 0, tueDt: 0,
        wedSt: 8, wedOt: 0, wedDt: 0, thuSt: 8, thuOt: 0, thuDt: 0,
        friSt: 8, friOt: 0, friDt: 0, satSt: 0, satOt: 0, satDt: 0,
        sunSt: 0, sunOt: 0, sunDt: 0,
        baseRate: 55.00, dtRate: 110.00, grossWages: 2365.00,
        ficaTax: 180.92, fitWithheld: 354.75, stateWithheld: 70.95, otherDeductions: 0, netPay: 1758.38,
      }],
    };
    await expect(fillHiDli(data)).resolves.toBeTruthy();
  });
});
