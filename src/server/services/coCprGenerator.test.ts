import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { fillCoCpr, CO_CPR_FORM_VERSION } from './coCprGenerator.js';
import type { CoCprInput } from './coCprGenerator.js';

const minimal: CoCprInput = {
  contractor: { name: 'Test Contractor', fein: '123456789', address: '1 Main St, Denver, CO 80202' },
  project: { name: 'Highway Improvement', coContractId: 'CO-2025-001', coAwardingAgency: 'CDOT', projectCounty: 'Denver' },
  week: { weekEndingDate: '2025-06-27', payrollNumber: '1' },
  entries: [],
  compliance: { certifierName: 'Jane Smith', certifierTitle: 'Controller', signatureDate: '2025-06-27' },
};

describe('coCprGenerator', () => {
  it('CO_CPR_FORM_VERSION is defined', () => {
    expect(CO_CPR_FORM_VERSION).toBe('CO COWC CPR Rev. 2024');
  });
  it('generates valid PDF with correct title', async () => {
    const bytes = await fillCoCpr(minimal);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toBe('CO Certified Payroll \u2014 CO COWC CPR Rev. 2024');
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });
  it('does not throw with workers', async () => {
    const data: CoCprInput = {
      ...minimal,
      entries: [{
        workerName: 'Bob Jones', workerSsnLast4: '1234', workerAddress: '5 Oak Ave',
        classification: 'Carpenter', isApprentice: false,
        monSt: 8, monOt: 0, tueSt: 8, tueOt: 0, wedSt: 8, wedOt: 0,
        thuSt: 8, thuOt: 0, friSt: 8, friOt: 0, satSt: 0, satOt: 0, sunSt: 0, sunOt: 0,
        baseRate: 40.00, fringeRate: 15.00, grossWages: 1600.00,
        ficaTax: 122.40, fitWithheld: 240.00, stateWithheld: 48.00, otherDeductions: 0, netPay: 1189.60,
      }],
    };
    await expect(fillCoCpr(data)).resolves.toBeTruthy();
  });
});
