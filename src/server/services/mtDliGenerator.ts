// src/server/services/mtDliGenerator.ts
// Montana DLI Certified Payroll PDF generator.
// Authority: MCA § 18-2-401 et seq.
// Form: MT DLI CPR Rev. 2023

import { generateGenericCpr, type GenericCprEntry, type GenericCprCompliance } from './genericCprGenerator.js';

export const MT_DLI_FORM_VERSION = 'MT DLI CPR Rev. 2023';

export interface MtDliInput {
  contractor: { name: string; fein: string; address: string };
  project: { name: string; mtContractId: string | null; awardingAgency?: string };
  week: { weekEndingDate: string; payrollNumber: string };
  entries: GenericCprEntry[];
  compliance: GenericCprCompliance;
}

export async function fillMtDli(data: MtDliInput): Promise<Uint8Array> {
  return generateGenericCpr(
    `MT Certified Payroll \u2014 ${MT_DLI_FORM_VERSION}`,
    {
      titleText: 'MONTANA DLI CERTIFIED PAYROLL RECORD',
      formVersion: MT_DLI_FORM_VERSION,
      contractorName: data.contractor.name,
      contractorFein: data.contractor.fein,
      contractorAddress: data.contractor.address,
      projectName: data.project.name,
      contractId: data.project.mtContractId,
      projectLocation: data.project.awardingAgency ? `Agency: ${data.project.awardingAgency}` : '',
      payrollNumber: data.week.payrollNumber,
      weekEndingDate: data.week.weekEndingDate,
    },
    data.entries,
    { ...data.compliance, statuteCitation: 'MCA \u00a7 18-2-401 et seq.' },
  );
}
