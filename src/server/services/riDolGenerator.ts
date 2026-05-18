// src/server/services/riDolGenerator.ts
// Rhode Island DOL Certified Payroll PDF generator.
// Authority: RIGL § 37-13-1 et seq.
// Form: RI DOL CPR Rev. 2023

import { generateGenericCpr, type GenericCprEntry, type GenericCprCompliance } from './genericCprGenerator.js';

export const RI_DOL_FORM_VERSION = 'RI DOL CPR Rev. 2023';

export interface RiDolInput {
  contractor: { name: string; fein: string; address: string };
  project: { name: string; riContractId: string | null; awardingAgency?: string };
  week: { weekEndingDate: string; payrollNumber: string };
  entries: GenericCprEntry[];
  compliance: GenericCprCompliance;
}

export async function fillRiDol(data: RiDolInput): Promise<Uint8Array> {
  return generateGenericCpr(
    `RI Certified Payroll \u2014 ${RI_DOL_FORM_VERSION}`,
    {
      titleText: 'RHODE ISLAND DOL CERTIFIED PAYROLL RECORD',
      formVersion: RI_DOL_FORM_VERSION,
      contractorName: data.contractor.name,
      contractorFein: data.contractor.fein,
      contractorAddress: data.contractor.address,
      projectName: data.project.name,
      contractId: data.project.riContractId,
      projectLocation: data.project.awardingAgency ? `Agency: ${data.project.awardingAgency}` : '',
      payrollNumber: data.week.payrollNumber,
      weekEndingDate: data.week.weekEndingDate,
    },
    data.entries,
    { ...data.compliance, statuteCitation: 'RIGL \u00a7 37-13-1 et seq.' },
  );
}
