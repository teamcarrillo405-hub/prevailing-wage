import { describe, it, expect } from 'vitest';
import type { ComplianceSummaryInput } from '../../src/server/services/complianceSummaryPdfGenerator.js';

const fixture: ComplianceSummaryInput = {
  generatedAt: new Date('2026-04-14'),
  contractorEmail: 'test@example.com',
  projects: [
    {
      name: 'Test Project Alpha',
      state: 'CA',
      awardDate: '2025-01-01',
      workerCount: 5,
      weeksTotal: 10,
      weeksSubmitted: 8,
      weeksPending: 2,
      cprOverdueCount: 1,
      subCprTotal: 4,
      subCprCompliant: 3,
      subCprViolation: 0,
      subCprPending: 1,
    },
  ],
};

describe('generateComplianceSummaryPdf', () => {
  it('generates a non-empty Buffer', async () => {
    const { generateComplianceSummaryPdf } = await import('../../src/server/services/complianceSummaryPdfGenerator.js');
    const result = await generateComplianceSummaryPdf(fixture);
    expect(result.length).toBeGreaterThan(0);
  });

  it('PDF starts with %PDF- magic bytes', async () => {
    const { generateComplianceSummaryPdf } = await import('../../src/server/services/complianceSummaryPdfGenerator.js');
    const result = await generateComplianceSummaryPdf(fixture);
    const magic = Buffer.from(result).subarray(0, 5);
    expect(magic).toEqual(Buffer.from('%PDF-', 'ascii'));
  });
});
