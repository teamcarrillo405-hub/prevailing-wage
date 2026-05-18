import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { fillOhPwc28, OH_PWC28_FORM_VERSION } from './ohPwc28Generator.js';
import type { OhPwc28Input } from './ohPwc28Generator.js';

const minimal: OhPwc28Input = {
  contractor: { name: 'Test Contractor', fein: '123456789', address: '1 Main St, Columbus, OH 43215' },
  project: { name: 'Road Resurfacing', ohContractId: 'OH-2025-001', ohAwardingAuthority: 'ODOT', county: 'Franklin' },
  week: { weekEndingDate: '2025-06-27', payrollNumber: '1' },
  entries: [],
  compliance: { certifierName: 'Jane Smith', certifierTitle: 'Controller', signatureDate: '2025-06-27' },
};

describe('ohPwc28Generator', () => {
  it('OH_PWC28_FORM_VERSION is defined', () => {
    expect(OH_PWC28_FORM_VERSION).toBe('OH PWC-28 Rev. 2023');
  });

  it('generates a valid PDF with correct title', async () => {
    const bytes = await fillOhPwc28(minimal);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toBe('OH Certified Payroll \u2014 OH PWC-28 Rev. 2023');
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });

  it('does not throw with workers', async () => {
    const data: OhPwc28Input = {
      ...minimal,
      entries: [{
        workerName: 'Bob Jones', workerSsnLast4: '1234', workerAddress: '5 Oak Ave',
        classification: 'Laborer', isApprentice: false,
        monSt: 8, monOt: 0, tueSt: 8, tueOt: 0, wedSt: 8, wedOt: 0,
        thuSt: 8, thuOt: 0, friSt: 8, friOt: 0, satSt: 0, satOt: 0, sunSt: 0, sunOt: 0,
        baseRate: 32.00, fringeRate: 14.50, grossWages: 1280.00,
        ficaTax: 97.92, fitWithheld: 192.00, stateWithheld: 38.40, otherDeductions: 0,
        netPay: 951.68,
      }],
    };
    await expect(fillOhPwc28(data)).resolves.toBeTruthy();
  });
});
