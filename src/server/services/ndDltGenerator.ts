// src/server/services/ndDltGenerator.ts
// North Dakota DLT Certified Payroll PDF generator.
// Authority: NDCC 34-14-01 et seq.
// Form: ND DLT CPR Rev. 2023

import { generateGenericCpr, type GenericCprEntry, type GenericCprCompliance } from './genericCprGenerator.js';

export const ND_DLT_FORM_VERSION = 'ND DLT CPR Rev. 2023';

export interface NdDltInput {
  contractor: { name: string; fein: string; address: string };
  project: { name: string; ndContractId: string | null; awardingAgency?: string };
  week: { weekEndingDate: string; payrollNumber: string };
  entries: GenericCprEntry[];
  compliance: GenericCprCompliance;
}

export async function fillNdDlt(data: NdDltInput): Promise<Uint8Array> {
  return generateGenericCpr(
    `ND Certified Payroll \u2014 ${ND_DLT_FORM_VERSION}`,
    {
      titleText: 'NORTH DAKOTA DLT CERTIFIED PAYROLL RECORD',
      formVersion: ND_DLT_FORM_VERSION,
      contractorName: data.contractor.name,
      contractorFein: data.contractor.fein,
      contractorAddress: data.contractor.address,
      projectName: data.project.name,
      contractId: data.project.ndContractId,
      projectLocation: data.project.awardingAgency ? `Agency: ${data.project.awardingAgency}` : '',
      payrollNumber: data.week.payrollNumber,
      weekEndingDate: data.week.weekEndingDate,
    },
    data.entries,
    { ...data.compliance, statuteCitation: 'NDCC 34-14-01 et seq.' },
  );
}
