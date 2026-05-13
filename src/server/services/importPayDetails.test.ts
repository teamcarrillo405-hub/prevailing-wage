import { describe, expect, it } from 'vitest';
import {
  analyzeImportPayDetailColumns,
  extractImportPayDetails,
  mergeImportPayDetails,
} from './importPayDetails.js';

describe('import pay detail extraction', () => {
  it('extracts gross, deductions, net, check, taxes, fringe, and itemized deductions from provider rows', () => {
    const details = extractImportPayDetails({
      'Gross Pay': '$2,400.00',
      Deductions: '318.45',
      'Net Pay': '$2,081.55',
      'Check #': '1024',
      FIT: '190.00',
      SIT: '72.00',
      'H&W Fringe': '4.50',
      'Pension Fringe': '6.25',
      'Union Dues': '12.00',
      'Other Deduction Description': 'Tool repayment',
    });

    expect(details.grossWages).toBe(2400);
    expect(details.deductions).toBe(318.45);
    expect(details.netPay).toBe(2081.55);
    expect(details.checkNumber).toBe('1024');
    expect(details.federalIncomeTax).toBe(190);
    expect(details.stateIncomeTax).toBe(72);
    expect(details.fringeHealthWelfare).toBe(4.5);
    expect(details.fringePension).toBe(6.25);
    expect(details.deductionDues).toBe(12);
    expect(details.deductionOtherDescription).toBe('Tool repayment');
  });

  it('adds repeated numeric pay detail values during aggregation', () => {
    const target = extractImportPayDetails({ 'Gross Wages': '100.00', 'Net Pay': '80.00', 'Check Number': 'A1' });
    const next = extractImportPayDetails({ 'Gross Wages': '125.50', 'Net Pay': '99.25', 'Check Number': 'A2' });

    mergeImportPayDetails(target, next);

    expect(target.grossWages).toBe(225.5);
    expect(target.netPay).toBe(179.25);
    expect(target.checkNumber).toBe('A1');
  });

  it('reports core column preflight coverage', () => {
    const coverage = analyzeImportPayDetailColumns(['Employee', 'Gross Pay', 'Net Pay', 'Check #']);

    expect(coverage.find((item) => item.key === 'grossWages')?.found).toBe(true);
    expect(coverage.find((item) => item.key === 'deductions')?.found).toBe(false);
    expect(coverage.find((item) => item.key === 'netPay')?.matchedColumn).toBe('Net Pay');
    expect(coverage.find((item) => item.key === 'checkNumber')?.matchedColumn).toBe('Check #');
  });
});
