// src/server/services/dcOcpGenerator.ts
// Washington DC DOES Certified Payroll PDF generator.
// Authority: DC Code § 32-1002 et seq. (DC Minimum Wage Act Revision Act of 1992)
// Form: DC DOES CPR Rev. 2024
// Note: DC uses DOES rates, NOT federal Davis-Bacon.

import { generateGenericCpr, type GenericCprEntry, type GenericCprCompliance } from './genericCprGenerator.js';

export const DC_OCP_FORM_VERSION = 'DC DOES CPR Rev. 2024';

export interface DcOcpInput {
  contractor: {
    name: string;
    fein: string;
    address: string;
    dcBusinessLicense: string | null;  // DC business license (BBL number)
  };
  project: {
    name: string;
    dcContractNumber: string | null;   // DC OCP contract number
    dcAgency: string;                  // e.g. "DC Office of Contracting and Procurement"
    dcProjectManager: string | null;
  };
  week: { weekEndingDate: string; payrollNumber: string };
  entries: GenericCprEntry[];
  compliance: GenericCprCompliance;
}

export async function fillDcOcp(data: DcOcpInput): Promise<Uint8Array> {
  return generateGenericCpr(
    `DC DOES Certified Payroll \u2014 ${DC_OCP_FORM_VERSION}`,
    {
      titleText: 'WASHINGTON DC DOES CERTIFIED PAYROLL RECORD',
      formVersion: DC_OCP_FORM_VERSION,
      contractorName: data.contractor.name,
      contractorFein: `${data.contractor.fein}  BBL: ${data.contractor.dcBusinessLicense ?? '\u2014'}`,
      contractorAddress: data.contractor.address,
      projectName: data.project.name,
      contractId: data.project.dcContractNumber,
      projectLocation: `Agency: ${data.project.dcAgency}${data.project.dcProjectManager ? `  PM: ${data.project.dcProjectManager}` : ''}`,
      payrollNumber: data.week.payrollNumber,
      weekEndingDate: data.week.weekEndingDate,
    },
    data.entries,
    { ...data.compliance, statuteCitation: 'DC Code \u00a7 32-1002 et seq. (DC Minimum Wage Act)' },
  );
}
