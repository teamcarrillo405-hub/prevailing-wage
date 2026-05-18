// src/server/services/meDolGenerator.ts
// Maine DOL Certified Payroll PDF generator.
// Authority: 26 MRS § 1311 et seq. (Maine Prevailing Wage Law)
// Form: ME DOL CPR Rev. 2023

import { generateGenericCpr, type GenericCprEntry, type GenericCprCompliance } from './genericCprGenerator.js';

export const ME_DOL_FORM_VERSION = 'ME DOL CPR Rev. 2023';

export interface MeDolInput {
  contractor: { name: string; fein: string; address: string };
  project: { name: string; meContractId: string | null; awardingAgency?: string };
  week: { weekEndingDate: string; payrollNumber: string };
  entries: GenericCprEntry[];
  compliance: GenericCprCompliance;
}

export async function fillMeDol(data: MeDolInput): Promise<Uint8Array> {
  return generateGenericCpr(
    `ME Certified Payroll \u2014 ${ME_DOL_FORM_VERSION}`,
    {
      titleText: 'MAINE DOL CERTIFIED PAYROLL RECORD',
      formVersion: ME_DOL_FORM_VERSION,
      contractorName: data.contractor.name,
      contractorFein: data.contractor.fein,
      contractorAddress: data.contractor.address,
      projectName: data.project.name,
      contractId: data.project.meContractId,
      projectLocation: data.project.awardingAgency ? `Agency: ${data.project.awardingAgency}` : '',
      payrollNumber: data.week.payrollNumber,
      weekEndingDate: data.week.weekEndingDate,
    },
    data.entries,
    { ...data.compliance, statuteCitation: '26 MRS \u00a7 1311 et seq. (Maine Prevailing Wage Law)' },
  );
}
