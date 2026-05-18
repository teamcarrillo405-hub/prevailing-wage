// src/server/services/laCountyCprGenerator.ts
// LA County DPW Supplemental Certified Payroll PDF generator.
// Uses CA DIR prevailing wage rates with LA County DPW-specific header.
// Authority: CA Labor Code § 1720 et seq. (CA DIR rates govern)
// Form: LA County DPW CPR Rev. 2024

import { generateGenericCpr, type GenericCprEntry, type GenericCprCompliance } from './genericCprGenerator.js';

export const LA_COUNTY_CPR_FORM_VERSION = 'LA County DPW CPR Rev. 2024';

export interface LaCountyCprInput {
  contractor: { name: string; fein: string; address: string; cslbLicense?: string | null };
  project: {
    name: string;
    laCountyProjectId: string | null;    // DPW project number
    laDpwDistrict: string | null;        // Supervisorial district 1–5
    dirProjectId: string;                // CA DIR project ID (still required)
  };
  week: { weekEndingDate: string; payrollNumber: string };
  entries: GenericCprEntry[];
  compliance: GenericCprCompliance;
}

export async function fillLaCountyCpr(data: LaCountyCprInput): Promise<Uint8Array> {
  return generateGenericCpr(
    `LA County Certified Payroll \u2014 ${LA_COUNTY_CPR_FORM_VERSION}`,
    {
      titleText: 'LOS ANGELES COUNTY DPW CERTIFIED PAYROLL RECORD',
      formVersion: LA_COUNTY_CPR_FORM_VERSION,
      contractorName: data.contractor.name,
      contractorFein: `${data.contractor.fein}${data.contractor.cslbLicense ? `  CSLB: ${data.contractor.cslbLicense}` : ''}`,
      contractorAddress: data.contractor.address,
      projectName: data.project.name,
      contractId: data.project.laCountyProjectId,
      projectLocation: `DIR Project: ${data.project.dirProjectId}  District: ${data.project.laDpwDistrict ?? '\u2014'}`,
      payrollNumber: data.week.payrollNumber,
      weekEndingDate: data.week.weekEndingDate,
    },
    data.entries,
    { ...data.compliance, statuteCitation: 'CA Labor Code \u00a7 1720 et seq. (CA DIR Prevailing Wage)' },
  );
}
