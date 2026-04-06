import { describe, it, expect } from 'vitest';
import { generateMpwrXml } from '../../src/server/services/mpwrXmlGenerator.js';

// ── Sample Input Fixture ───────────────────────────────────────────────────
// Worker 1 (worker-A): has two entries with different tradeDescriptions (multi-classification)
// Worker 2 (worker-B): single entry, different worker
// This fixture drives Test 8 (multi-classification grouping)

const sampleInput = {
  project: {
    nyprcNumber: 'PRC-12345',
    nysContractorRegNumber: 'REG-67890',
    name: 'Test Contractor LLC',
    contractorFein: '12-3456789',
  },
  week: {
    weekEndingDate: '2026-04-05',
  },
  entries: [
    // Worker A — first classification (Carpenter)
    {
      workerId: 'worker-A',
      workerName: 'John Smith',
      workerSsnLast4: '1234',
      nysRegisteredApprentice: true,
      tradeDescription: 'Carpenter',
      laborType: 'journeyworker',
      workerAddress: '123 Main St, Albany, NY 12201',
      monSt: 8, monOt: 0,
      tueSt: 8, tueOt: 0,
      wedSt: 8, wedOt: 2,
      thuSt: 8, thuOt: 0,
      friSt: 8, friOt: 0,
      satSt: 0, satOt: 0,
      sunSt: 0, sunOt: 0,
      totalStHours: 40,
      totalOtHours: 2,
      baseRateSnapshot: 55.00,
      grossWages: 2310.00,
      deductions: 231.00,
      netPay: 2079.00,
      fringeHealthWelfare: 200.00,
      fringePension: 160.00,
      fringeVacation: 80.00,
      fringeTraining: 40.00,
    },
    // Worker A — second classification (Laborer) — same workerId, different trade
    {
      workerId: 'worker-A',
      workerName: 'John Smith',
      workerSsnLast4: '1234',
      nysRegisteredApprentice: true,
      tradeDescription: 'Laborer',
      laborType: 'journeyworker',
      workerAddress: '123 Main St, Albany, NY 12201',
      monSt: 0, monOt: 0,
      tueSt: 0, tueOt: 0,
      wedSt: 0, wedOt: 0,
      thuSt: 0, thuOt: 0,
      friSt: 0, friOt: 0,
      satSt: 4, satOt: 0,
      sunSt: 0, sunOt: 0,
      totalStHours: 4,
      totalOtHours: 0,
      baseRateSnapshot: 45.00,
      grossWages: 180.00,
      deductions: 18.00,
      netPay: 162.00,
      fringeHealthWelfare: 20.00,
      fringePension: 16.00,
      fringeVacation: 8.00,
      fringeTraining: 4.00,
    },
    // Worker B — single entry
    {
      workerId: 'worker-B',
      workerName: 'Jane Doe',
      workerSsnLast4: '5678',
      nysRegisteredApprentice: false,
      tradeDescription: 'Electrician',
      laborType: 'journeyworker',
      workerAddress: '456 Oak Ave, Buffalo, NY 14201',
      monSt: 8, monOt: 0,
      tueSt: 8, tueOt: 0,
      wedSt: 8, wedOt: 0,
      thuSt: 8, thuOt: 0,
      friSt: 8, friOt: 0,
      satSt: 0, satOt: 0,
      sunSt: 0, sunOt: 0,
      totalStHours: 40,
      totalOtHours: 0,
      baseRateSnapshot: 65.00,
      grossWages: 2600.00,
      deductions: 260.00,
      netPay: 2340.00,
      fringeHealthWelfare: 240.00,
      fringePension: 200.00,
      fringeVacation: 100.00,
      fringeTraining: 50.00,
    },
  ],
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('generateMpwrXml', () => {
  it('Test 1: returns XML string with <ProjectRollup> root element and no namespace prefix', () => {
    const xml = generateMpwrXml(sampleInput);
    expect(xml).toContain('<ProjectRollup>');
    expect(xml).toContain('</ProjectRollup>');
    // Must NOT use namespace-prefixed root like <CPR:ProjectRollup>
    expect(xml).not.toContain('CPR:ProjectRollup');
  });

  it('Test 2: output contains <prcNumber> and <nysContractorRegNumber> with correct values', () => {
    const xml = generateMpwrXml(sampleInput);
    expect(xml).toContain('<prcNumber>PRC-12345</prcNumber>');
    expect(xml).toContain('<nysContractorRegNumber>REG-67890</nysContractorRegNumber>');
  });

  it('Test 3: worker with nysRegisteredApprentice=true emits <nysRegisteredApprentice>true</nysRegisteredApprentice>', () => {
    const xml = generateMpwrXml(sampleInput);
    expect(xml).toContain('<nysRegisteredApprentice>true</nysRegisteredApprentice>');
  });

  it('Test 4: worker with nysRegisteredApprentice=false emits <nysRegisteredApprentice>false</nysRegisteredApprentice>', () => {
    const xml = generateMpwrXml(sampleInput);
    expect(xml).toContain('<nysRegisteredApprentice>false</nysRegisteredApprentice>');
  });

  it('Test 5: XML contains <supplementalPayment> elements with <stHourlyRate> and <otHourlyRate> children', () => {
    const xml = generateMpwrXml(sampleInput);
    expect(xml).toContain('<supplementalPayment>');
    expect(xml).toContain('<stHourlyRate>');
    expect(xml).toContain('<otHourlyRate>');
  });

  it('Test 6: SSN placeholder uses 000000+last4 — ssnLast4 element contains 0000001234 for worker with last4=1234', () => {
    const xml = generateMpwrXml(sampleInput);
    // Must NOT write raw last4 alone
    expect(xml).not.toContain('<ssnLast4>1234</ssnLast4>');
    // Must write 000000 + last4 placeholder
    expect(xml).toContain('<ssnLast4>0000001234</ssnLast4>');
  });

  it('Test 7: XML does NOT contain xmlns: namespace declarations', () => {
    const xml = generateMpwrXml(sampleInput);
    expect(xml).not.toContain('xmlns:');
  });

  it('Test 8: worker with 2 entries (different tradeDescriptions) produces exactly ONE <employeeWorkWeek> with TWO <workWeek> children', () => {
    const xml = generateMpwrXml(sampleInput);
    // Count occurrences of <employeeWorkWeek> — worker A has 2 entries but must produce 1 employeeWorkWeek
    const employeeWorkWeekMatches = xml.match(/<employeeWorkWeek>/g);
    // 2 unique workers (worker-A and worker-B) => 2 employeeWorkWeek elements
    expect(employeeWorkWeekMatches).not.toBeNull();
    expect(employeeWorkWeekMatches!.length).toBe(2);
    // Worker A must have 2 workWeek elements under its employeeWorkWeek
    // Count total <workWeek> opening tags: worker-A has 2, worker-B has 1 = 3 total
    const workWeekMatches = xml.match(/<workWeek>/g);
    expect(workWeekMatches).not.toBeNull();
    expect(workWeekMatches!.length).toBe(3);
  });
});
