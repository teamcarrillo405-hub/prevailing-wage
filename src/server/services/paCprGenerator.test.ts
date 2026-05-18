import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { fillPaCpr, PA_CPR_FORM_VERSION } from './paCprGenerator.js';
import type { PaCprInput } from './paCprGenerator.js';

const minimal: PaCprInput = {
  contractor: { name: 'Test Contractor', fein: '123456789', address: '1 Main St, Pittsburgh, PA 15201', paContractorLicense: null },
  project: { name: 'Bridge Repair', paContractId: 'PA-2025-001', county: 'Allegheny', awardingAuthority: 'PennDOT' },
  week: { weekEndingDate: '2025-06-27', payrollNumber: '1' },
  entries: [],
  compliance: { certifierName: 'Jane Smith', certifierTitle: 'Controller', signatureDate: '2025-06-27' },
};

describe('paCprGenerator', () => {
  it('PA_CPR_FORM_VERSION is defined', () => {
    expect(PA_CPR_FORM_VERSION).toBe('PA-CPR Rev. 2024');
  });

  it('generates a valid PDF with correct title', async () => {
    const bytes = await fillPaCpr(minimal);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toBe('PA Certified Payroll \u2014 PA-CPR Rev. 2024');
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2); // page 1 + compliance page
  });

  it('does not throw with multiple workers', async () => {
    const data: PaCprInput = {
      ...minimal,
      entries: [{
        workerName: 'Bob Jones', workerSsnLast4: '1234', workerAddress: '5 Oak Ave',
        classification: 'Carpenter', isApprentice: false,
        monSt: 8, monOt: 0, tueSt: 8, tueOt: 0, wedSt: 8, wedOt: 0,
        thuSt: 8, thuOt: 0, friSt: 8, friOt: 0, satSt: 0, satOt: 0, sunSt: 0, sunOt: 0,
        baseRate: 45.00, fringeRate: 18.50, grossWages: 1875.00,
        ficaTax: 143.44, fitWithheld: 312.50, stateWithheld: 57.56, otherDeductions: 0,
        netPay: 1361.50,
      }],
    };
    await expect(fillPaCpr(data)).resolves.toBeTruthy();
  });
});
