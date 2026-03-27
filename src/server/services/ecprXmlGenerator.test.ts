import { describe, it, expect } from 'vitest';
import { generateEcprXml, type EcprData } from './ecprXmlGenerator.js';

// ── Test data helper ──────────────────────────────────────────────────────

function makeTestData(): EcprData {
  return {
    contractor: {
      name: 'Acme Construction Inc',
      licenseType: 'CSLB',
      licenseNum: '1234567',
      pwcr: 'NA',
      fein: '123456789',
      address: { street: '123 Main St', city: 'Los Angeles', state: 'CA', zip: '90001' },
      insuranceNum: 'WC-POLICY-123',
      email: 'info@acme.com',
    },
    project: {
      contractAgency: 'City of Los Angeles',
      projectID: '9876543210',
      contractID: 'CTR-001',
    },
    payroll: {
      statementOfNP: false,
      forWeekEnding: '2025-05-31',
      amendmentNum: null,
    },
    employees: [
      {
        name: 'John Smith',
        ssn: '0000001234',
        address: { street: '456 Oak Ave', city: 'Los Angeles', state: 'CA', zip: '90002' },
        numWithholdingExemp: '1',
        workClass: 'Carpenter',
        days: [
          { date: '2025-05-25', straightTime: 8, overtime: 0, doubletime: 0 },
          { date: '2025-05-26', straightTime: 8, overtime: 2, doubletime: 0 },
          { date: '2025-05-27', straightTime: 8, overtime: 0, doubletime: 0 },
          { date: '2025-05-28', straightTime: 8, overtime: 0, doubletime: 0 },
          { date: '2025-05-29', straightTime: 8, overtime: 0, doubletime: 0 },
          { date: '2025-05-30', straightTime: 0, overtime: 0, doubletime: 0 },
          { date: '2025-05-31', straightTime: 0, overtime: 0, doubletime: 0 },
        ],
        totHrsStraightTime: 40,
        totHrsOvertime: 2,
        totHrsDoubletime: 0,
        hrlyPayRateStraightTime: 55.00,
        hrlyPayRateOvertime: 82.50,
        hrlyPayRateDoubletime: 110.00,
        grossThisProject: 2365.00,
        grossAllWork: 2365.00,
        deductions: {
          fedTax: 350.00,
          FICA: 180.00,
          stateTax: 120.00,
          SDI: 25.00,
          vacationHoliday: 42.00,
          healthWelfare: 95.00,
          pension: 80.00,
          training: 15.00,
          fundAdmin: 5.00,
          dues: 10.00,
          travelSubs: 0,
          savings: 0,
          other: 0,
        },
        netWagePaidWeek: 1443.00,
        checkNum: 'DIRECT DEPOSIT',
      },
    ],
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('generateEcprXml', () => {
  it('Test 1: returns well-formed XML with declaration and CPR:eCPR root', () => {
    const xml = generateEcprXml(makeTestData());
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    expect(xml).toContain('<CPR:eCPR');
  });

  it('Test 2: contractorInfo section has contractorName and contractorFEIN (9 digits)', () => {
    const xml = generateEcprXml(makeTestData());
    expect(xml).toContain('<CPR:contractorInfo>');
    expect(xml).toContain('<CPR:contractorName>Acme Construction Inc</CPR:contractorName>');
    expect(xml).toContain('<CPR:contractorFEIN>123456789</CPR:contractorFEIN>');
    // Verify exactly 9 digits (no dashes)
    const feinMatch = xml.match(/<CPR:contractorFEIN>(\d+)<\/CPR:contractorFEIN>/);
    expect(feinMatch).not.toBeNull();
    expect(feinMatch![1]).toHaveLength(9);
  });

  it('Test 3: projectInfo section has projectID matching input dirProjectId', () => {
    const xml = generateEcprXml(makeTestData());
    expect(xml).toContain('<CPR:projectInfo>');
    expect(xml).toContain('<CPR:projectID>9876543210</CPR:projectID>');
  });

  it('Test 4: payrollInfo section has forWeekEnding in yyyy-mm-dd format', () => {
    const xml = generateEcprXml(makeTestData());
    expect(xml).toContain('<CPR:payrollInfo>');
    expect(xml).toContain('<CPR:forWeekEnding>2025-05-31</CPR:forWeekEnding>');
  });

  it('Test 5: employee ssn element is 10-char string 000000 + ssnLast4', () => {
    const xml = generateEcprXml(makeTestData());
    expect(xml).toContain('<CPR:ssn>0000001234</CPR:ssn>');
    const ssnMatch = xml.match(/<CPR:ssn>(\w+)<\/CPR:ssn>/);
    expect(ssnMatch).not.toBeNull();
    expect(ssnMatch![1]).toHaveLength(10);
    expect(ssnMatch![1]).toMatch(/^000000\d{4}$/);
  });

  it('Test 6: employee has exactly 7 day elements with id 1-7, each with date, straightTime, overtime, doubletime', () => {
    const xml = generateEcprXml(makeTestData());
    // Check all 7 day id attributes are present
    for (let i = 1; i <= 7; i++) {
      expect(xml).toContain(`id="${i}"`);
    }
    // Count total day elements
    const dayMatches = xml.match(/<CPR:day /g);
    expect(dayMatches).toHaveLength(7);
    // Check required sub-elements
    expect(xml).toContain('<CPR:date>');
    expect(xml).toContain('<CPR:straightTime>');
    expect(xml).toContain('<CPR:overtime>');
    expect(xml).toContain('<CPR:doubletime>');
  });

  it('Test 7: employee has all 13 deduction fields plus total', () => {
    const xml = generateEcprXml(makeTestData());
    const deductionFields = [
      'fedTax', 'FICA', 'stateTax', 'SDI', 'vacationHoliday',
      'healthWelfare', 'pension', 'training', 'fundAdmin',
      'dues', 'travelSubs', 'savings', 'other',
    ];
    for (const field of deductionFields) {
      expect(xml).toContain(`<CPR:${field}>`);
    }
    expect(xml).toContain('<CPR:total>');
  });

  it('Test 8: employee checkNum element present with correct value', () => {
    const xml = generateEcprXml(makeTestData());
    expect(xml).toContain('<CPR:checkNum>DIRECT DEPOSIT</CPR:checkNum>');
  });

  it('Test 9a: when amendmentNumber is present, output contains amendmentNum element with number', () => {
    const data = makeTestData();
    data.payroll.amendmentNum = 2;
    const xml = generateEcprXml(data);
    expect(xml).toContain('<CPR:amendmentNum>2</CPR:amendmentNum>');
  });

  it('Test 9b: when amendmentNumber is null, amendmentNum element is emitted empty (per D-13)', () => {
    const data = makeTestData();
    data.payroll.amendmentNum = null;
    const xml = generateEcprXml(data);
    // Should contain either empty element or self-closing
    const hasEmpty = xml.includes('<CPR:amendmentNum></CPR:amendmentNum>') ||
                     xml.includes('<CPR:amendmentNum/>');
    expect(hasEmpty).toBe(true);
  });

  it('Test 10: statementOfNP is "true" when employees empty, "false" when employees present', () => {
    const dataWithWorkers = makeTestData();
    dataWithWorkers.payroll.statementOfNP = false;
    const xmlWithWorkers = generateEcprXml(dataWithWorkers);
    expect(xmlWithWorkers).toContain('<CPR:statementOfNP>false</CPR:statementOfNP>');

    const dataNoPayroll = makeTestData();
    dataNoPayroll.payroll.statementOfNP = true;
    dataNoPayroll.employees = [];
    const xmlNoPayroll = generateEcprXml(dataNoPayroll);
    expect(xmlNoPayroll).toContain('<CPR:statementOfNP>true</CPR:statementOfNP>');
  });

  it('Test 11: special characters in contractor name are XML-escaped', () => {
    const data = makeTestData();
    data.contractor.name = 'Smith & Jones <Construction>';
    const xml = generateEcprXml(data);
    // xmlbuilder2 handles escaping automatically
    expect(xml).not.toContain('<CPR:contractorName>Smith & Jones <Construction></CPR:contractorName>');
    expect(xml).toContain('Smith');
    expect(xml).toContain('Jones');
  });

  it('xmlns:CPR attribute is set to CA DIR schema namespace', () => {
    const xml = generateEcprXml(makeTestData());
    expect(xml).toContain('xmlns:CPR="http://www.dir.ca.gov/dlse/CPR-Prod-Test/CPR.xsd"');
  });
});
