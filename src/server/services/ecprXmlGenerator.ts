// src/server/services/ecprXmlGenerator.ts
//
// CA DIR eCPR XML generator — CPR.xsd v1.3 compliant
//
// Generates namespace-prefixed CPR: XML for upload to the CA DIR eCPR portal at
// https://efiling.dir.ca.gov/eCPR/
//
// Schema reference: https://www.dir.ca.gov/Public-Works/CPR/CPR.xsd (v1.3)
// File naming convention (from DIR): [last4FEIN]_[projectID]_[weekEndingDate].xml
//
// SSN handling: Full 9-digit SSN is required by the schema. Per project decision
// (D-Research), only ssnLast4 is stored. The generated XML uses a 000000XXXX
// placeholder where XXXX = ssnLast4. Contractors enter the full SSN directly in
// the portal. The pre-generation modal discloses this limitation.
//
// Amendment marker (D-13): <CPR:amendmentNum> is ALWAYS emitted.
//   - Non-amendment weeks: empty element <CPR:amendmentNum/>
//   - Amendment weeks: <CPR:amendmentNum>N</CPR:amendmentNum>
// DIR auto-increments payrollNum; submit empty string.

import { create } from 'xmlbuilder2';

// ── Types ──────────────────────────────────────────────────────────────────

export interface EcprEmployeeDay {
  date: string;        // yyyy-mm-dd
  straightTime: number;
  overtime: number;
  doubletime: number;
}

export interface EcprEmployee {
  name: string;
  ssn: string;          // 10-char: 000000 + ssnLast4
  address: { street: string; city: string; state: string; zip: string };
  numWithholdingExemp: string;  // default "0"
  workClass: string;
  days: EcprEmployeeDay[];  // exactly 7, Sun(id=1) through Sat(id=7)
  totHrsStraightTime: number;
  totHrsOvertime: number;
  totHrsDoubletime: number;
  hrlyPayRateStraightTime: number;
  hrlyPayRateOvertime: number;
  hrlyPayRateDoubletime: number;
  grossThisProject: number;
  grossAllWork: number;   // same as thisProject (single-project limitation, disclosed in modal)
  deductions: {
    fedTax: number;
    FICA: number;
    stateTax: number;
    SDI: number;
    vacationHoliday: number;
    healthWelfare: number;
    pension: number;
    training: number;
    fundAdmin: number;
    dues: number;
    travelSubs: number;
    savings: number;
    other: number;
  };
  netWagePaidWeek: number;
  checkNum: string;
}

export interface EcprData {
  contractor: {
    name: string;
    licenseType: string;  // "CSLB" | "PL" | "OTHER"
    licenseNum: string;
    pwcr: string;         // 10 digits or "NA"
    fein: string;         // 9 digits, no dashes
    address: { street: string; city: string; state: string; zip: string };
    insuranceNum: string;
    email: string;
  };
  project: {
    contractAgency: string;
    projectID: string;      // DIR-assigned, 1-18 digits
    contractID?: string;
  };
  payroll: {
    statementOfNP: boolean;
    forWeekEnding: string;  // yyyy-mm-dd
    amendmentNum?: number | null;
  };
  employees: EcprEmployee[];
}

// ── Generator ─────────────────────────────────────────────────────────────

/**
 * Generates a CPR.xsd v1.3 compliant XML string for upload to the CA DIR eCPR portal.
 *
 * All numeric values are formatted with .toFixed(2).
 * Special characters in string values are automatically escaped by xmlbuilder2.
 * The <CPR:amendmentNum> element is always emitted per D-13.
 */
export function generateEcprXml(data: EcprData): string {
  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('CPR:eCPR', {
      'xmlns:CPR': 'http://www.dir.ca.gov/dlse/CPR-Prod-Test/CPR.xsd',
      'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
    });

  // ── CPR:contractorInfo ──────────────────────────────────────────────────
  const contractorInfo = root.ele('CPR:contractorInfo');
  contractorInfo.ele('CPR:contractorName').txt(data.contractor.name);
  const contractorLicense = contractorInfo.ele('CPR:contractorLicense');
  contractorLicense.ele('CPR:licenseType').txt(data.contractor.licenseType);
  contractorLicense.ele('CPR:licenseNum').txt(data.contractor.licenseNum);
  contractorInfo.ele('CPR:contractorPWCR').txt(data.contractor.pwcr);
  contractorInfo.ele('CPR:contractorFEIN').txt(data.contractor.fein);
  const contractorAddress = contractorInfo.ele('CPR:contractorAddress');
  contractorAddress.ele('CPR:street').txt(data.contractor.address.street);
  contractorAddress.ele('CPR:city').txt(data.contractor.address.city);
  contractorAddress.ele('CPR:state').txt(data.contractor.address.state);
  contractorAddress.ele('CPR:zip').txt(data.contractor.address.zip);
  contractorInfo.ele('CPR:insuranceNum').txt(data.contractor.insuranceNum);
  contractorInfo.ele('CPR:contractorEmail').txt(data.contractor.email);

  // ── CPR:projectInfo ─────────────────────────────────────────────────────
  const projectInfo = root.ele('CPR:projectInfo');
  projectInfo.ele('CPR:awardingBody').txt('');
  projectInfo.ele('CPR:contractAgencyID').txt('');
  projectInfo.ele('CPR:contractAgency').txt(data.project.contractAgency);
  projectInfo.ele('CPR:projectName').txt('');
  projectInfo.ele('CPR:projectID').txt(data.project.projectID);
  const projectLocation = projectInfo.ele('CPR:projectLocation');
  projectLocation.ele('CPR:street').txt('');
  projectLocation.ele('CPR:city').txt('');
  projectLocation.ele('CPR:state').txt('');
  projectLocation.ele('CPR:zip').txt('');
  projectInfo.ele('CPR:contractID').txt(data.project.contractID ?? '');

  // ── CPR:payrollInfo ─────────────────────────────────────────────────────
  const payrollInfo = root.ele('CPR:payrollInfo');
  payrollInfo.ele('CPR:statementOfNP').txt(data.payroll.statementOfNP ? 'true' : 'false');
  payrollInfo.ele('CPR:payrollNum').txt('');

  // Amendment marker — ALWAYS emitted per D-13
  // Empty for non-amendment weeks; populated for amendment weeks
  if (data.payroll.amendmentNum != null) {
    payrollInfo.ele('CPR:amendmentNum').txt(String(data.payroll.amendmentNum));
  } else {
    payrollInfo.ele('CPR:amendmentNum');
  }

  payrollInfo.ele('CPR:forWeekEnding').txt(data.payroll.forWeekEnding);

  // ── CPR:employees ───────────────────────────────────────────────────────
  const employeesEl = payrollInfo.ele('CPR:employees');

  for (const emp of data.employees) {
    // id attribute format: "SSN9digits::NAME"
    const ssn9 = emp.ssn.slice(0, 9);
    const employeeEl = employeesEl.ele('CPR:employee');

    employeeEl.ele('CPR:name', { id: `${ssn9}::${emp.name}` }).txt(emp.name);

    const addrEl = employeeEl.ele('CPR:address');
    addrEl.ele('CPR:street').txt(emp.address.street);
    addrEl.ele('CPR:city').txt(emp.address.city);
    addrEl.ele('CPR:state').txt(emp.address.state);
    addrEl.ele('CPR:zip').txt(emp.address.zip);

    employeeEl.ele('CPR:ssn').txt(emp.ssn);
    employeeEl.ele('CPR:numWithholdingExemp').txt(emp.numWithholdingExemp);
    employeeEl.ele('CPR:workClass').txt(emp.workClass);

    const payrollEl = employeeEl.ele('CPR:payroll');

    // 7-day grid (id=1=Sun through id=7=Sat per CA DIR spec)
    const hrsWorked = payrollEl.ele('CPR:hrsWorkedEachDay');
    for (let i = 0; i < 7; i++) {
      const day = emp.days[i]!;
      const dayEl = hrsWorked.ele('CPR:day', { id: String(i + 1) });
      dayEl.ele('CPR:date').txt(day.date);
      dayEl.ele('CPR:straightTime').txt(day.straightTime.toFixed(2));
      dayEl.ele('CPR:overtime').txt(day.overtime.toFixed(2));
      dayEl.ele('CPR:doubletime').txt(day.doubletime.toFixed(2));
    }

    const totHrs = payrollEl.ele('CPR:totHrs');
    totHrs.ele('CPR:totHrsStraightTime').txt(emp.totHrsStraightTime.toFixed(2));
    totHrs.ele('CPR:totHrsOvertime').txt(emp.totHrsOvertime.toFixed(2));
    totHrs.ele('CPR:totHrsDoubletime').txt(emp.totHrsDoubletime.toFixed(2));

    const hrlyRate = payrollEl.ele('CPR:hrlyPayRate');
    hrlyRate.ele('CPR:hrlyPayRateStraightTime').txt(emp.hrlyPayRateStraightTime.toFixed(2));
    hrlyRate.ele('CPR:hrlyPayRateOvertime').txt(emp.hrlyPayRateOvertime.toFixed(2));
    hrlyRate.ele('CPR:hrlyPayRateDoubletime').txt(emp.hrlyPayRateDoubletime.toFixed(2));

    const grossEl = payrollEl.ele('CPR:grossAmountEarned');
    grossEl.ele('CPR:thisProject').txt(emp.grossThisProject.toFixed(2));
    grossEl.ele('CPR:allWork').txt(emp.grossAllWork.toFixed(2));

    const deducEl = payrollEl.ele('CPR:deductionsContribPay');
    const d = emp.deductions;
    deducEl.ele('CPR:fedTax').txt(d.fedTax.toFixed(2));
    deducEl.ele('CPR:FICA').txt(d.FICA.toFixed(2));
    deducEl.ele('CPR:stateTax').txt(d.stateTax.toFixed(2));
    deducEl.ele('CPR:SDI').txt(d.SDI.toFixed(2));
    deducEl.ele('CPR:vacationHoliday').txt(d.vacationHoliday.toFixed(2));
    deducEl.ele('CPR:healthWelfare').txt(d.healthWelfare.toFixed(2));
    deducEl.ele('CPR:pension').txt(d.pension.toFixed(2));
    deducEl.ele('CPR:training').txt(d.training.toFixed(2));
    deducEl.ele('CPR:fundAdmin').txt(d.fundAdmin.toFixed(2));
    deducEl.ele('CPR:dues').txt(d.dues.toFixed(2));
    deducEl.ele('CPR:travelSubs').txt(d.travelSubs.toFixed(2));
    deducEl.ele('CPR:savings').txt(d.savings.toFixed(2));
    deducEl.ele('CPR:other').txt(d.other.toFixed(2));

    // Total = sum of all 13 deduction fields
    const total = d.fedTax + d.FICA + d.stateTax + d.SDI + d.vacationHoliday +
      d.healthWelfare + d.pension + d.training + d.fundAdmin + d.dues +
      d.travelSubs + d.savings + d.other;
    deducEl.ele('CPR:total').txt(total.toFixed(2));

    payrollEl.ele('CPR:netWagePaidWeek').txt(emp.netWagePaidWeek.toFixed(2));
    payrollEl.ele('CPR:checkNum').txt(emp.checkNum);
  }

  return root.end({ prettyPrint: true });
}
