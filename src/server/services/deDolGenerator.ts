// src/server/services/deDolGenerator.ts
// Delaware DOL Certified Payroll PDF generator.
// Authority: 29 Del. C. § 6960 et seq.
// Form: DE DOL CPR Rev. 2023

import { generateGenericCpr, type GenericCprEntry, type GenericCprCompliance } from './genericCprGenerator.js';

export const DE_DOL_FORM_VERSION = 'DE DOL CPR Rev. 2023';

export interface DeDolInput {
  contractor: { name: string; fein: string; address: string };
  project: { name: string; deContractId: string | null; awardingAgency?: string };
  week: { weekEndingDate: string; payrollNumber: string };
  entries: GenericCprEntry[];
  compliance: GenericCprCompliance;
}

export async function fillDeDol(data: DeDolInput): Promise<Uint8Array> {
  return generateGenericCpr(
    `DE Certified Payroll \u2014 ${DE_DOL_FORM_VERSION}`,
    {
      titleText: 'DELAWARE DOL CERTIFIED PAYROLL RECORD',
      formVersion: DE_DOL_FORM_VERSION,
      contractorName: data.contractor.name,
      contractorFein: data.contractor.fein,
      contractorAddress: data.contractor.address,
      projectName: data.project.name,
      contractId: data.project.deContractId,
      projectLocation: data.project.awardingAgency ? `Agency: ${data.project.awardingAgency}` : '',
      payrollNumber: data.week.payrollNumber,
      weekEndingDate: data.week.weekEndingDate,
    },
    data.entries,
    { ...data.compliance, statuteCitation: '29 Del. C. \u00a7 6960 et seq.' },
  );
}
