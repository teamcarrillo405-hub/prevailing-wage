// src/server/services/mdDllrGenerator.ts
// Maryland DLLR Certified Payroll PDF generator.
// Authority: MD Code, Lab. & Emp. § 17-201 et seq.
// Form: MD DLLR CPR Rev. 2023

import { generateGenericCpr, type GenericCprEntry, type GenericCprCompliance } from './genericCprGenerator.js';

export const MD_DLLR_FORM_VERSION = 'MD DLLR CPR Rev. 2023';

export interface MdDllrInput {
  contractor: { name: string; fein: string; address: string; mdContractorLicense?: string | null };
  project: { name: string; mdContractId: string | null; mdAwardingAgency: string; county?: string };
  week: { weekEndingDate: string; payrollNumber: string };
  entries: GenericCprEntry[];
  compliance: GenericCprCompliance;
}

export async function fillMdDllr(data: MdDllrInput): Promise<Uint8Array> {
  return generateGenericCpr(
    `MD Certified Payroll \u2014 ${MD_DLLR_FORM_VERSION}`,
    {
      titleText: 'MARYLAND DLLR CERTIFIED PAYROLL RECORD',
      formVersion: MD_DLLR_FORM_VERSION,
      contractorName: data.contractor.name,
      contractorFein: data.contractor.fein,
      contractorAddress: data.contractor.address,
      projectName: data.project.name,
      contractId: data.project.mdContractId,
      projectLocation: `Agency: ${data.project.mdAwardingAgency}${data.project.county ? `  County: ${data.project.county}` : ''}`,
      payrollNumber: data.week.payrollNumber,
      weekEndingDate: data.week.weekEndingDate,
    },
    data.entries,
    { ...data.compliance, statuteCitation: 'MD Code, Lab. & Emp. \u00a7 17-201 et seq.' },
  );
}
