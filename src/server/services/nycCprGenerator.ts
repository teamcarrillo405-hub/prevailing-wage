// src/server/services/nycCprGenerator.ts
// NYC DCAS Certified Payroll — extends NY PW-12 format with NYC-specific header fields.
// Authority: NYC Administrative Code § 6-109 (Living Wage) +
//            NY Labor Law § 220 (prevailing wage rates from NY DOL).

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PAGE_W, PAGE_H, MARGIN, CONTENT_W, NAVY, WHITE, LIGHT_GRAY, BLACK, fmt, isoToDisplay } from './genericCprGenerator.js';

export const NYC_CPR_FORM_VERSION = 'NYC DCAS CPR Rev. 2024';

export interface NycCprInput {
  contractor: {
    name: string;
    fein: string;
    address: string;
    nycVendorId: string | null;    // NYC DCAS vendor/contract ID
  };
  project: {
    name: string;
    nycContractNumber: string | null;  // NYC contract number (e.g. "PIN 8502017CP0001")
    borough: string;                    // Manhattan | Brooklyn | Queens | Bronx | Staten Island
    dcasProjectManager: string | null;  // optional
  };
  week: { weekEndingDate: string; payrollNumber: string };
  entries: Array<{
    workerName: string;
    workerSsnLast4: string | null;
    workerAddress: string;
    classification: string;
    isApprentice: boolean;
    monSt: number; monOt: number;
    tueSt: number; tueOt: number;
    wedSt: number; wedOt: number;
    thuSt: number; thuOt: number;
    friSt: number; friOt: number;
    satSt: number; satOt: number;
    sunSt: number; sunOt: number;
    baseRate: number; fringeRate: number;
    grossWages: number; deductions: number; netPay: number;
  }>;
  compliance: { certifierName: string; certifierTitle: string; signatureDate: string };
}

export async function fillNycCpr(data: NycCprInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`NYC DCAS Certified Payroll \u2014 ${NYC_CPR_FORM_VERSION}`);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);

  const page1 = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  // Title bar
  page1.drawRectangle({ x: MARGIN, y: y-28, width: CONTENT_W, height: 28, color: NAVY });
  page1.drawText('NEW YORK CITY DCAS CERTIFIED PAYROLL RECORD', {
    x: MARGIN+8, y: y-20, size: 10, font: bold, color: WHITE });
  page1.drawText(NYC_CPR_FORM_VERSION, {
    x: MARGIN+CONTENT_W-130, y: y-20, size: 8, font: reg, color: WHITE });
  y -= 38;

  const col2 = MARGIN + CONTENT_W / 2;
  page1.drawText(`Contractor: ${data.contractor.name}`, { x: MARGIN, y, size: 8, font: bold, color: BLACK });
  page1.drawText(`Contract No: ${data.project.nycContractNumber ?? '\u2014'}`, { x: col2, y, size: 8, font: bold, color: BLACK });
  y -= 14;
  page1.drawText(`FEIN: ${data.contractor.fein}  Vendor ID: ${data.contractor.nycVendorId ?? '\u2014'}`, { x: MARGIN, y, size: 8, font: reg, color: BLACK });
  page1.drawText(`Borough: ${data.project.borough}  PM: ${data.project.dcasProjectManager ?? '\u2014'}`, { x: col2, y, size: 8, font: reg, color: BLACK });
  y -= 14;
  page1.drawText(`Payroll No: ${data.week.payrollNumber}  Week Ending: ${data.week.weekEndingDate}`, { x: MARGIN, y, size: 8, font: bold, color: BLACK });
  y -= 24;

  // Table header
  page1.drawRectangle({ x: MARGIN, y: y-16, width: CONTENT_W, height: 16, color: NAVY });
  ['Worker', 'M','Tu','W','Th','F','Sa','Su','ST','OT','Base','Gross','Deduct','Net'].forEach((h, i) => {
    const xs = [MARGIN+2, MARGIN+112, MARGIN+134, MARGIN+156, MARGIN+178, MARGIN+200, MARGIN+222, MARGIN+244, MARGIN+266, MARGIN+288, MARGIN+312, MARGIN+352, MARGIN+394, MARGIN+438];
    page1.drawText(h, { x: xs[i] ?? MARGIN, y: y-12, size: 7, font: bold, color: WHITE });
  });
  y -= 20;

  let currentPage = page1;
  data.entries.forEach((e, idx) => {
    if (y - 26 < MARGIN + 40) {
      currentPage = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
    const bg = idx % 2 === 0 ? WHITE : LIGHT_GRAY;
    currentPage.drawRectangle({ x: MARGIN, y: y-24, width: CONTENT_W, height: 24, color: bg });
    const ssn = e.workerSsnLast4 ? `***-**-${e.workerSsnLast4}` : '';
    currentPage.drawText(`${e.workerName} ${ssn}`, { x: MARGIN+2, y: y-10, size: 7, font: reg, color: BLACK });
    currentPage.drawText(`${e.classification}${e.isApprentice?' (App)':''}`, { x: MARGIN+2, y: y-20, size: 6, font: reg, color: BLACK });
    const totSt = e.monSt+e.tueSt+e.wedSt+e.thuSt+e.friSt+e.satSt+e.sunSt;
    const totOt = e.monOt+e.tueOt+e.wedOt+e.thuOt+e.friOt+e.satOt+e.sunOt;
    [e.monSt,e.tueSt,e.wedSt,e.thuSt,e.friSt,e.satSt,e.sunSt,totSt,totOt].forEach((h, i) => {
      const hxs = [MARGIN+112, MARGIN+134, MARGIN+156, MARGIN+178, MARGIN+200, MARGIN+222, MARGIN+244, MARGIN+266, MARGIN+288];
      currentPage.drawText(h>0?String(h):'\u2014', { x: hxs[i]??MARGIN, y: y-14, size: 7, font: reg, color: BLACK });
    });
    currentPage.drawText(`$${e.baseRate.toFixed(2)}`, { x: MARGIN+312, y: y-14, size: 7, font: reg, color: BLACK });
    currentPage.drawText(`$${e.grossWages.toFixed(2)}`, { x: MARGIN+352, y: y-14, size: 7, font: reg, color: BLACK });
    currentPage.drawText(`$${e.deductions.toFixed(2)}`, { x: MARGIN+394, y: y-14, size: 7, font: reg, color: BLACK });
    currentPage.drawText(`$${e.netPay.toFixed(2)}`, { x: MARGIN+438, y: y-14, size: 7, font: reg, color: BLACK });
    y -= 26;
  });

  // Compliance page
  const comp = doc.addPage([PAGE_W, PAGE_H]);
  let cy = PAGE_H - MARGIN;
  comp.drawRectangle({ x: MARGIN, y: cy-28, width: CONTENT_W, height: 28, color: NAVY });
  comp.drawText('STATEMENT OF COMPLIANCE \u2014 NY Labor Law \u00a7 220 / NYC Admin. Code \u00a7 6-109', {
    x: MARGIN+8, y: cy-20, size: 9, font: bold, color: WHITE });
  cy -= 50;
  [
    'I hereby certify that this payroll is correct and complete, that the wage rates paid are not',
    'less than the applicable prevailing wage rates established under New York Labor Law \u00a7 220',
    'and, where applicable, the NYC Living Wage per Administrative Code \u00a7 6-109.',
    '',
    'All deductions from wages are authorized under law or by written agreement signed by',
    'the employee.',
  ].forEach(line => {
    comp.drawText(line, { x: MARGIN, y: cy, size: 8, font: reg, color: BLACK });
    cy -= 14;
  });
  cy -= 30;
  comp.drawText('Signature: ____________________________', { x: MARGIN, y: cy, size: 9, font: reg, color: BLACK });
  comp.drawText(`Date: ${data.compliance.signatureDate}`, { x: MARGIN+300, y: cy, size: 9, font: reg, color: BLACK });
  cy -= 20;
  comp.drawText(`Name: ${data.compliance.certifierName}  Title: ${data.compliance.certifierTitle}`, { x: MARGIN, y: cy, size: 9, font: reg, color: BLACK });

  return doc.save();
}
