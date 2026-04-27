// src/server/services/wh347Generator.test.ts
// Verifies WH347_FORM_REVISION constant and PDF metadata title (Plan 89-01).

import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { fillWh347, getWh347TemplateBytes, WH347_FORM_REVISION } from './wh347Generator.js';
import type { Wh347Data } from './wh347Generator.js';

const minimalData: Wh347Data = {
  contractorName: 'Test Contractor',
  contractorAddress: '123 Main St',
  payrollNumber: '1',
  weekEndingDate: '2025-01-31',
  projectName: 'Test Project',
  projectContractNo: 'TPC-001',
  wageDeterminationNo: 'WD-2025-001',
  workers: [],
  compliance: {
    certProperPayment: true,
    certAccuratePayroll: true,
    certWorkPerformed: true,
    certApprentices: false,
    certFringeBenefits: true,
    certDeductions: true,
    officialName: 'Jane Smith',
    officialTitle: 'Controller',
    signatureDate: '2025-01-31',
    phoneNumber: '555-000-0000',
  },
};

describe('wh347Generator — Rev. Jan. 2025 metadata (COMP-08)', () => {
  it('WH347_FORM_REVISION equals "Rev. Jan. 2025"', () => {
    expect(WH347_FORM_REVISION).toBe('Rev. Jan. 2025');
  });

  it('generated PDF title contains the revision string', async () => {
    const templateBytes = getWh347TemplateBytes();
    const outputBytes = await fillWh347(minimalData, templateBytes);
    const pdfDoc = await PDFDocument.load(outputBytes);
    expect(pdfDoc.getTitle()).toBe('WH-347 Certified Payroll — Rev. Jan. 2025');
  });
});
