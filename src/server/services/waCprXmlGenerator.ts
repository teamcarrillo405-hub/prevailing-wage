// src/server/services/waCprXmlGenerator.ts
//
// WA L&I PWIA CPR XML generator — WaPWCPR schema compliant
//
// Generates unqualified XML for upload to the WA L&I PWIA portal at
// https://lni.wa.gov/licensing-permits/public-works-projects/prevailing-wage-institute-administration/
//
// Schema reference: WA L&I PWIA XSD (WaPWCPR root, no namespace prefix)
// File naming convention: wa-cpr-{intentId}_{weekEndingDate}.xml
//
// SSN handling: Full 9-digit SSN is required. Per project decision, only
// ssnLast4 is stored. The generated XML uses a 00000XXXX placeholder where
// XXXX = ssnLast4. Contractors enter the full SSN directly in the portal.
//
// Day ordering: Day1=Monday through Day7=Sunday (WA XSD Monday-first spec)

import { create } from 'xmlbuilder2';

// ── Types ──────────────────────────────────────────────────────────────────

export interface WaCprTradeDay {
  regularHours: number;
  overtimeHours: number;
}

export interface WaCprTradeEntry {
  trade: string;            // 4-letter WA trade code
  jobClass: string;         // classification description
  county: string;           // Washington county name
  regularHourRateAmt: number;
  overtimeHourRateAmt: number;
  fringeRateAmt?: number;   // optional pension/fringe
  days: WaCprTradeDay[];    // 7 entries: [0]=Mon .. [6]=Sun
  apprenticeFlg: boolean;
}

export interface WaCprEmployee {
  firstName: string;
  lastName: string;
  ssn: string;              // 9-digit placeholder
  address1: string;
  city: string;
  state: string;
  zip: string;
  grossPay: number;
  tradeHoursWages: WaCprTradeEntry[];
}

export interface WaCprData {
  intentId: number;
  payrollWeek: {
    endOfWeekDate: string;  // yyyy-mm-dd
    noWorkPerformFlag: boolean;
    amendedFlag: boolean;
    amendReason?: string;
  };
  employees: WaCprEmployee[];
}

// ── Generator ─────────────────────────────────────────────────────────────

/**
 * Generates a WaPWCPR schema compliant XML string for upload to the WA L&I PWIA portal.
 *
 * All numeric values are formatted with .toFixed(2).
 * Special characters in string values are automatically escaped by xmlbuilder2.
 * Day ordering is Monday-first (Day1=Mon through Day7=Sun) per WA XSD spec.
 */
export function generateWaCprXml(data: WaCprData): string {
  // Root element — no namespace, no prefix
  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('WaPWCPR');

  // intentId as integer string
  root.ele('intentId').txt(String(data.intentId));

  // payrollWeek block
  const payrollWeekEl = root.ele('payrollWeek');
  payrollWeekEl.ele('endOfWeekDate').txt(data.payrollWeek.endOfWeekDate);
  payrollWeekEl.ele('noWorkPerformFlag').txt(data.payrollWeek.noWorkPerformFlag ? 'true' : 'false');
  payrollWeekEl.ele('amendedFlag').txt(data.payrollWeek.amendedFlag ? 'true' : 'false');

  // amendReason only emitted when amendedFlag=true and reason provided
  if (data.payrollWeek.amendedFlag && data.payrollWeek.amendReason) {
    payrollWeekEl.ele('amendReason').txt(data.payrollWeek.amendReason);
  }

  // employees collection inside payrollWeek
  const employeesEl = payrollWeekEl.ele('employees');

  for (const emp of data.employees) {
    const employeeEl = employeesEl.ele('employee');

    employeeEl.ele('firstName').txt(emp.firstName);
    employeeEl.ele('lastName').txt(emp.lastName);
    employeeEl.ele('ssn').txt(emp.ssn);

    const addressEl = employeeEl.ele('address');
    addressEl.ele('address1').txt(emp.address1);
    addressEl.ele('city').txt(emp.city);
    addressEl.ele('state').txt(emp.state);
    addressEl.ele('zip').txt(emp.zip);

    employeeEl.ele('grossPay').txt(emp.grossPay.toFixed(2));

    const tradeHoursWagesEl = employeeEl.ele('tradeHoursWages');

    for (const trade of emp.tradeHoursWages) {
      const tradeEl = tradeHoursWagesEl.ele('tradeHoursWage');

      tradeEl.ele('trade').txt(trade.trade);
      tradeEl.ele('jobClass').txt(trade.jobClass);
      tradeEl.ele('county').txt(trade.county);
      tradeEl.ele('regularHourRateAmt').txt(trade.regularHourRateAmt.toFixed(2));
      tradeEl.ele('overtimeHourRateAmt').txt(trade.overtimeHourRateAmt.toFixed(2));

      if (trade.fringeRateAmt !== undefined && trade.fringeRateAmt > 0) {
        tradeEl.ele('hourlyPensionRateAmt').txt(trade.fringeRateAmt.toFixed(2));
      }

      tradeEl.ele('apprenticeFlg').txt(trade.apprenticeFlg ? 'true' : 'false');

      // Day mapping: Day1=Mon through Day7=Sun (Monday-first per WA XSD)
      for (let i = 0; i < 7; i++) {
        const day = trade.days[i]!;
        tradeEl.ele(`regularDay${i + 1}Hours`).txt(day.regularHours.toFixed(2));
        tradeEl.ele(`overtimeDay${i + 1}Hours`).txt(day.overtimeHours.toFixed(2));
      }
    }
  }

  return root.end({ prettyPrint: true });
}
