import { describe, it, expect } from 'vitest';
import { generateWaCprXml, type WaCprData } from '../../src/server/services/waCprXmlGenerator.js';

const sampleData: WaCprData = {
  intentId: 12345,
  payrollWeek: {
    endOfWeekDate: '2026-03-28',
    noWorkPerformFlag: false,
    amendedFlag: false,
  },
  employees: [
    {
      firstName: 'John',
      lastName: 'Smith',
      ssn: '000001234',
      address1: '123 Main St',
      city: 'Seattle',
      state: 'WA',
      zip: '98101',
      grossPay: 2400.00,
      tradeHoursWages: [
        {
          trade: 'CARP',
          jobClass: 'Carpenter',
          county: 'King',
          regularHourRateAmt: 55.00,
          overtimeHourRateAmt: 82.50,
          fringeRateAmt: 12.50,
          days: [
            { regularHours: 8, overtimeHours: 0 },  // Mon
            { regularHours: 8, overtimeHours: 0 },  // Tue
            { regularHours: 8, overtimeHours: 2 },  // Wed
            { regularHours: 8, overtimeHours: 0 },  // Thu
            { regularHours: 8, overtimeHours: 0 },  // Fri
            { regularHours: 0, overtimeHours: 0 },  // Sat
            { regularHours: 0, overtimeHours: 0 },  // Sun
          ],
          apprenticeFlg: false,
        },
      ],
    },
  ],
};

describe('generateWaCprXml', () => {
  it('produces XML with WaPWCPR root element (no namespace)', () => {
    const xml = generateWaCprXml(sampleData);
    expect(xml).toContain('<WaPWCPR>');
    expect(xml).toContain('</WaPWCPR>');
    // No namespace prefix — WA uses plain unqualified elements
    expect(xml).not.toContain('xmlns:');
  });

  it('emits intentId as integer element', () => {
    const xml = generateWaCprXml(sampleData);
    expect(xml).toContain('<intentId>12345</intentId>');
  });

  it('maps Monday as Day1 through Sunday as Day7', () => {
    const xml = generateWaCprXml(sampleData);
    // Mon=8 ST, Wed=2 OT
    expect(xml).toContain('<regularDay1Hours>8.00</regularDay1Hours>');  // Mon
    expect(xml).toContain('<regularDay3Hours>8.00</regularDay3Hours>');  // Wed
    expect(xml).toContain('<overtimeDay3Hours>2.00</overtimeDay3Hours>'); // Wed OT
    expect(xml).toContain('<regularDay6Hours>0.00</regularDay6Hours>');  // Sat
    expect(xml).toContain('<regularDay7Hours>0.00</regularDay7Hours>');  // Sun
  });

  it('sets amendedFlag=false for non-amendment weeks', () => {
    const xml = generateWaCprXml(sampleData);
    expect(xml).toContain('<amendedFlag>false</amendedFlag>');
    expect(xml).not.toContain('<amendReason>');
  });

  it('sets amendedFlag=true and amendReason for amendment weeks', () => {
    const amendedData: WaCprData = {
      ...sampleData,
      payrollWeek: {
        ...sampleData.payrollWeek,
        amendedFlag: true,
        amendReason: 'Amendment 1',
      },
    };
    const xml = generateWaCprXml(amendedData);
    expect(xml).toContain('<amendedFlag>true</amendedFlag>');
    expect(xml).toContain('<amendReason>Amendment 1</amendReason>');
  });

  it('emits employee personal info and grossPay', () => {
    const xml = generateWaCprXml(sampleData);
    expect(xml).toContain('<firstName>John</firstName>');
    expect(xml).toContain('<lastName>Smith</lastName>');
    expect(xml).toContain('<ssn>000001234</ssn>');
    expect(xml).toContain('<grossPay>2400.00</grossPay>');
  });

  it('emits trade code and county in tradeHoursWage', () => {
    const xml = generateWaCprXml(sampleData);
    expect(xml).toContain('<trade>CARP</trade>');
    expect(xml).toContain('<county>King</county>');
    expect(xml).toContain('<jobClass>Carpenter</jobClass>');
  });

  it('emits rate amounts with 2 decimal places', () => {
    const xml = generateWaCprXml(sampleData);
    expect(xml).toContain('<regularHourRateAmt>55.00</regularHourRateAmt>');
    expect(xml).toContain('<overtimeHourRateAmt>82.50</overtimeHourRateAmt>');
  });

  it('emits apprenticeFlg as boolean', () => {
    const xml = generateWaCprXml(sampleData);
    expect(xml).toContain('<apprenticeFlg>false</apprenticeFlg>');
  });
});
