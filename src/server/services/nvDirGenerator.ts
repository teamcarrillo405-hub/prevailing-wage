// src/server/services/nvDirGenerator.ts
// Nevada DIR Certified Payroll PDF generator.
// Authority: NRS 338.010 et seq.
// Form: NV DIR CPR Rev. 2024

import { generateGenericCpr, type GenericCprEntry, type GenericCprCompliance } from './genericCprGenerator.js';

export const NV_DIR_FORM_VERSION = 'NV DIR CPR Rev. 2024';

export interface NvDirInput {
  contractor: { name: string; fein: string; address: string; nvContractorLicense: string | null };
  project: { name: string; nvContractId: string | null; county?: string };
  week: { weekEndingDate: string; payrollNumber: string };
  entries: GenericCprEntry[];
  compliance: GenericCprCompliance;
}

export async function fillNvDir(data: NvDirInput): Promise<Uint8Array> {
  return generateGenericCpr(
    `NV Certified Payroll \u2014 ${NV_DIR_FORM_VERSION}`,
    {
      titleText: 'NEVADA DIR CERTIFIED PAYROLL RECORD',
      formVersion: NV_DIR_FORM_VERSION,
      contractorName: data.contractor.name,
      contractorFein: `${data.contractor.fein}  License: ${data.contractor.nvContractorLicense ?? '\u2014'}`,
      contractorAddress: data.contractor.address,
      projectName: data.project.name,
      contractId: data.project.nvContractId,
      projectLocation: data.project.county ? `County: ${data.project.county}` : '',
      payrollNumber: data.week.payrollNumber,
      weekEndingDate: data.week.weekEndingDate,
    },
    data.entries,
    { ...data.compliance, statuteCitation: 'NRS 338.010 et seq.' },
  );
}
