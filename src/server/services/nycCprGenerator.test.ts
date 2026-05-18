import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { fillNycCpr, NYC_CPR_FORM_VERSION } from './nycCprGenerator.js';
import type { NycCprInput } from './nycCprGenerator.js';

const minimal: NycCprInput = {
  contractor: { name: 'Test GC', fein: '987654321', address: '1 Centre St, New York, NY 10007', nycVendorId: 'VND-001' },
  project: { name: 'Sidewalk Repair', nycContractNumber: 'PIN8502024CP001', borough: 'Brooklyn', dcasProjectManager: null },
  week: { weekEndingDate: '2025-07-04', payrollNumber: '1' },
  entries: [],
  compliance: { certifierName: 'Alice Brown', certifierTitle: 'PM', signatureDate: '2025-07-04' },
};

describe('nycCprGenerator', () => {
  it('NYC_CPR_FORM_VERSION is defined', () => {
    expect(NYC_CPR_FORM_VERSION).toBe('NYC DCAS CPR Rev. 2024');
  });
  it('generates PDF with correct title and >= 2 pages', async () => {
    const bytes = await fillNycCpr(minimal);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toBe('NYC DCAS Certified Payroll \u2014 NYC DCAS CPR Rev. 2024');
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});
