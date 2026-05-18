// src/server/services/ctDolGenerator.ts
// Connecticut DOL Certified Payroll PDF generator.
// Authority: CGS § 31-53 (Connecticut Prevailing Wage Law)
// Form: CT DOL CPR Rev. 2023

import { generateGenericCpr, type GenericCprEntry, type GenericCprCompliance } from './genericCprGenerator.js';

export const CT_DOL_FORM_VERSION = 'CT DOL CPR Rev. 2023';

export interface CtDolInput {
  contractor: { name: string; fein: string; address: string };
  project: { name: string; ctContractId: string | null; ctAwardingMunicipality: string };
  week: { weekEndingDate: string; payrollNumber: string };
  entries: GenericCprEntry[];
  compliance: GenericCprCompliance;
}

export async function fillCtDol(data: CtDolInput): Promise<Uint8Array> {
  return generateGenericCpr(
    `CT Certified Payroll \u2014 ${CT_DOL_FORM_VERSION}`,
    {
      titleText: 'CONNECTICUT DOL CERTIFIED PAYROLL RECORD',
      formVersion: CT_DOL_FORM_VERSION,
      contractorName: data.contractor.name,
      contractorFein: data.contractor.fein,
      contractorAddress: data.contractor.address,
      projectName: data.project.name,
      contractId: data.project.ctContractId,
      projectLocation: `Municipality: ${data.project.ctAwardingMunicipality}`,
      payrollNumber: data.week.payrollNumber,
      weekEndingDate: data.week.weekEndingDate,
    },
    data.entries,
    { ...data.compliance, statuteCitation: 'CGS \u00a7 31-53 (Connecticut Prevailing Wage Law)' },
  );
}
