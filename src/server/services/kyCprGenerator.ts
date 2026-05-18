// src/server/services/kyCprGenerator.ts
// Kentucky Certified Payroll PDF generator.
// Authority: KRS 337.505–337.550 (Kentucky Prevailing Wage Act)
// Form: KY Labor Cabinet CPR Rev. 2023

import { generateGenericCpr, type GenericCprEntry, type GenericCprCompliance } from './genericCprGenerator.js';

export const KY_CPR_FORM_VERSION = 'KY Labor Cabinet CPR Rev. 2023';

export interface KyCprInput {
  contractor: { name: string; fein: string; address: string };
  project: { name: string; kyContractId: string | null; kyAwardingAgency: string };
  week: { weekEndingDate: string; payrollNumber: string };
  entries: GenericCprEntry[];
  compliance: GenericCprCompliance;
}

export async function fillKyCpr(data: KyCprInput): Promise<Uint8Array> {
  return generateGenericCpr(
    `KY Certified Payroll \u2014 ${KY_CPR_FORM_VERSION}`,
    {
      titleText: 'KENTUCKY CERTIFIED PAYROLL RECORD',
      formVersion: KY_CPR_FORM_VERSION,
      contractorName: data.contractor.name,
      contractorFein: data.contractor.fein,
      contractorAddress: data.contractor.address,
      projectName: data.project.name,
      contractId: data.project.kyContractId,
      projectLocation: `Agency: ${data.project.kyAwardingAgency}`,
      payrollNumber: data.week.payrollNumber,
      weekEndingDate: data.week.weekEndingDate,
    },
    data.entries,
    { ...data.compliance, statuteCitation: 'KRS 337.505\u2013337.550 (Kentucky Prevailing Wage Act)' },
  );
}
