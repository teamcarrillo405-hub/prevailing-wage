// src/server/services/nhDotGenerator.ts
// New Hampshire DOT Certified Payroll PDF generator.
// Authority: RSA 228:22 (NH applies prevailing wages to state highway projects only)
// Form: NH DOT CPR Rev. 2023
// Note: NH scope is narrower than most — applies to DOT highway contracts only, not all public works.

import { generateGenericCpr, type GenericCprEntry, type GenericCprCompliance } from './genericCprGenerator.js';

export const NH_DOT_FORM_VERSION = 'NH DOT CPR Rev. 2023';

export interface NhDotInput {
  contractor: { name: string; fein: string; address: string };
  project: { name: string; nhContractId: string | null; nhDotProjectNumber?: string | null };
  week: { weekEndingDate: string; payrollNumber: string };
  entries: GenericCprEntry[];
  compliance: GenericCprCompliance;
}

export async function fillNhDot(data: NhDotInput): Promise<Uint8Array> {
  return generateGenericCpr(
    `NH Certified Payroll \u2014 ${NH_DOT_FORM_VERSION}`,
    {
      titleText: 'NEW HAMPSHIRE DOT CERTIFIED PAYROLL RECORD',
      formVersion: NH_DOT_FORM_VERSION,
      contractorName: data.contractor.name,
      contractorFein: data.contractor.fein,
      contractorAddress: data.contractor.address,
      projectName: data.project.name,
      contractId: data.project.nhContractId,
      projectLocation: data.project.nhDotProjectNumber ? `DOT Project: ${data.project.nhDotProjectNumber}` : '',
      payrollNumber: data.week.payrollNumber,
      weekEndingDate: data.week.weekEndingDate,
    },
    data.entries,
    { ...data.compliance, statuteCitation: 'RSA 228:22 (NH Highway Projects Only)' },
  );
}
