// src/server/services/nmCprGenerator.ts
// New Mexico DOL Certified Payroll PDF generator.
// Authority: NMSA § 13-4-11 et seq. (New Mexico Prevailing Wage Act)
// Form: NM DOL CPR Rev. 2023

import { generateGenericCpr, type GenericCprEntry, type GenericCprCompliance } from './genericCprGenerator.js';

export const NM_CPR_FORM_VERSION = 'NM DOL CPR Rev. 2023';

export interface NmCprInput {
  contractor: { name: string; fein: string; address: string };
  project: { name: string; nmContractId: string | null; nmAwardingAgency: string };
  week: { weekEndingDate: string; payrollNumber: string };
  entries: GenericCprEntry[];
  compliance: GenericCprCompliance;
}

export async function fillNmCpr(data: NmCprInput): Promise<Uint8Array> {
  return generateGenericCpr(
    `NM Certified Payroll \u2014 ${NM_CPR_FORM_VERSION}`,
    {
      titleText: 'NEW MEXICO DOL CERTIFIED PAYROLL RECORD',
      formVersion: NM_CPR_FORM_VERSION,
      contractorName: data.contractor.name,
      contractorFein: data.contractor.fein,
      contractorAddress: data.contractor.address,
      projectName: data.project.name,
      contractId: data.project.nmContractId,
      projectLocation: `Agency: ${data.project.nmAwardingAgency}`,
      payrollNumber: data.week.payrollNumber,
      weekEndingDate: data.week.weekEndingDate,
    },
    data.entries,
    { ...data.compliance, statuteCitation: 'NMSA \u00a7 13-4-11 et seq. (New Mexico Prevailing Wage Act)' },
  );
}
