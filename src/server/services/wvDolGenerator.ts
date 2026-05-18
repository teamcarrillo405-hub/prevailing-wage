// src/server/services/wvDolGenerator.ts
// West Virginia DOL Certified Payroll PDF generator.
// Authority: WV Code § 21-5A-1 et seq.
// Form: WV DOL CPR Rev. 2023

import { generateGenericCpr, type GenericCprEntry, type GenericCprCompliance } from './genericCprGenerator.js';

export const WV_DOL_FORM_VERSION = 'WV DOL CPR Rev. 2023';

export interface WvDolInput {
  contractor: { name: string; fein: string; address: string };
  project: { name: string; wvContractId: string | null; awardingAgency?: string };
  week: { weekEndingDate: string; payrollNumber: string };
  entries: GenericCprEntry[];
  compliance: GenericCprCompliance;
}

export async function fillWvDol(data: WvDolInput): Promise<Uint8Array> {
  return generateGenericCpr(
    `WV Certified Payroll \u2014 ${WV_DOL_FORM_VERSION}`,
    {
      titleText: 'WEST VIRGINIA DOL CERTIFIED PAYROLL RECORD',
      formVersion: WV_DOL_FORM_VERSION,
      contractorName: data.contractor.name,
      contractorFein: data.contractor.fein,
      contractorAddress: data.contractor.address,
      projectName: data.project.name,
      contractId: data.project.wvContractId,
      projectLocation: data.project.awardingAgency ? `Agency: ${data.project.awardingAgency}` : '',
      payrollNumber: data.week.payrollNumber,
      weekEndingDate: data.week.weekEndingDate,
    },
    data.entries,
    { ...data.compliance, statuteCitation: 'WV Code \u00a7 21-5A-1 et seq.' },
  );
}
