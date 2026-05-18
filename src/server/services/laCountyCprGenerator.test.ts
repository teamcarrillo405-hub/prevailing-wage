import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { fillLaCountyCpr, LA_COUNTY_CPR_FORM_VERSION } from './laCountyCprGenerator.js';

const minimal = {
  contractor: { name: 'Test Co', fein: '123456789', address: '1 Main St, Los Angeles, CA 90001', cslbLicense: 'CA-CSLB-001' },
  project: { name: 'Flood Control', laCountyProjectId: 'LAC-2025-001', laDpwDistrict: '3', dirProjectId: 'DIR-2025-123' },
  week: { weekEndingDate: '2025-06-27', payrollNumber: '1' },
  entries: [],
  compliance: { certifierName: 'Jane Smith', certifierTitle: 'CFO', signatureDate: '2025-06-27', statuteCitation: 'CA Labor Code § 1720' },
};

describe('laCountyCprGenerator', () => {
  it('LA_COUNTY_CPR_FORM_VERSION is defined', () => { expect(LA_COUNTY_CPR_FORM_VERSION).toBe('LA County DPW CPR Rev. 2024'); });
  it('generates valid PDF', async () => {
    const bytes = await fillLaCountyCpr(minimal);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toContain('LA County Certified Payroll');
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});
