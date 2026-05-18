// src/server/services/vtDfrGenerator.ts
// Vermont DFR Certified Payroll PDF generator.
// Authority: 21 VSA § 391 et seq. (Vermont Prevailing Wage Act)
// Form: VT DFR CPR Rev. 2023

import { generateGenericCpr, type GenericCprEntry, type GenericCprCompliance } from './genericCprGenerator.js';

export const VT_DFR_FORM_VERSION = 'VT DFR CPR Rev. 2023';

export interface VtDfrInput {
  contractor: { name: string; fein: string; address: string };
  project: { name: string; vtContractId: string | null; awardingAgency?: string };
  week: { weekEndingDate: string; payrollNumber: string };
  entries: GenericCprEntry[];
  compliance: GenericCprCompliance;
}

export async function fillVtDfr(data: VtDfrInput): Promise<Uint8Array> {
  return generateGenericCpr(
    `VT Certified Payroll \u2014 ${VT_DFR_FORM_VERSION}`,
    {
      titleText: 'VERMONT DFR CERTIFIED PAYROLL RECORD',
      formVersion: VT_DFR_FORM_VERSION,
      contractorName: data.contractor.name,
      contractorFein: data.contractor.fein,
      contractorAddress: data.contractor.address,
      projectName: data.project.name,
      contractId: data.project.vtContractId,
      projectLocation: data.project.awardingAgency ? `Agency: ${data.project.awardingAgency}` : '',
      payrollNumber: data.week.payrollNumber,
      weekEndingDate: data.week.weekEndingDate,
    },
    data.entries,
    { ...data.compliance, statuteCitation: '21 VSA \u00a7 391 et seq. (Vermont Prevailing Wage Act)' },
  );
}
