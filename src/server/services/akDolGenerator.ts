// src/server/services/akDolGenerator.ts
// Alaska DOL Certified Payroll PDF generator.
// Authority: AS 36.05.010 et seq. (Alaska Prevailing Wage Act)
// Form: AK DOL CPR Rev. 2024
// Note: AK uses Sunday-first 7-day week (Su-Mo-Tu-We-Th-Fr-Sa), same as MA.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PAGE_W, PAGE_H, MARGIN, CONTENT_W, NAVY, WHITE, LIGHT_GRAY, BLACK, fmt, isoToDisplay, type GenericCprCompliance } from './genericCprGenerator.js';

export const AK_DOL_FORM_VERSION = 'AK DOL CPR Rev. 2024';

export interface AkDolInput {
  contractor: { name: string; fein: string; address: string };
  project: { name: string; akContractId: string | null; akAwardingAgency: string };
  week: { weekEndingDate: string; payrollNumber: string };
  entries: Array<{
    workerName: string; workerSsnLast4: string | null; classification: string; isApprentice: boolean;
    // Su-Mo-Tu-We-Th-Fr-Sa order (Sunday first)
    sunSt: number; monSt: number; tueSt: number; wedSt: number; thuSt: number; friSt: number; satSt: number;
    sunOt: number; monOt: number; tueOt: number; wedOt: number; thuOt: number; friOt: number; satOt: number;
    baseRate: number; grossWages: number; ficaTax: number; fitWithheld: number;
    stateWithheld: number; otherDeductions: number; netPay: number;
  }>;
  compliance: GenericCprCompliance;
}

export async function fillAkDol(data: AkDolInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`AK Certified Payroll \u2014 ${AK_DOL_FORM_VERSION}`);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);

  const drawHeader = (page: ReturnType<typeof doc.addPage>) => {
    let y = PAGE_H - MARGIN;
    page.drawRectangle({ x: MARGIN, y: y-28, width: CONTENT_W, height: 28, color: NAVY });
    page.drawText('ALASKA DOL CERTIFIED PAYROLL RECORD', { x: MARGIN+8, y: y-20, size: 10, font: bold, color: WHITE });
    page.drawText(AK_DOL_FORM_VERSION, { x: MARGIN+CONTENT_W-120, y: y-20, size: 7, font: reg, color: WHITE });
    y -= 36;
    const col2 = MARGIN + CONTENT_W / 2;
    page.drawText(`Contractor: ${data.contractor.name}`, { x: MARGIN, y, size: 8, font: bold, color: BLACK });
    page.drawText(`Project: ${data.project.name}`, { x: col2, y, size: 8, font: bold, color: BLACK }); y -= 14;
    page.drawText(`Address: ${data.contractor.address}`, { x: MARGIN, y, size: 8, font: reg, color: BLACK });
    page.drawText(`Contract No: ${data.project.akContractId ?? '\u2014'}`, { x: col2, y, size: 8, font: reg, color: BLACK }); y -= 14;
    page.drawText(`FEIN: ${data.contractor.fein}`, { x: MARGIN, y, size: 8, font: reg, color: BLACK });
    page.drawText(`Agency: ${data.project.akAwardingAgency}`, { x: col2, y, size: 8, font: reg, color: BLACK }); y -= 14;
    page.drawText(`Payroll No: ${data.week.payrollNumber}  Week Ending: ${isoToDisplay(data.week.weekEndingDate)}`, { x: MARGIN, y, size: 8, font: bold, color: BLACK });
    y -= 20;
    page.drawRectangle({ x: MARGIN, y: y-16, width: CONTENT_W, height: 16, color: NAVY });
    // Sunday-first columns
    ['Worker/Class','Su','Mo','Tu','We','Th','Fr','Sa','ST','OT','Base','Gross','Ded','Net'].forEach((h,i) => {
      const xs = [MARGIN+2,MARGIN+114,MARGIN+136,MARGIN+158,MARGIN+180,MARGIN+202,MARGIN+224,MARGIN+246,MARGIN+270,MARGIN+292,MARGIN+316,MARGIN+354,MARGIN+396,MARGIN+440];
      page.drawText(h, { x: xs[i]??MARGIN, y: y-12, size: 7, font: bold, color: WHITE });
    });
    y -= 20;
    return y;
  };

  let currentPage = doc.addPage([PAGE_W, PAGE_H]);
  let y = drawHeader(currentPage);

  for (let i = 0; i < data.entries.length; i++) {
    if (y - 26 < MARGIN + 40) { currentPage = doc.addPage([PAGE_W, PAGE_H]); y = drawHeader(currentPage); }
    const e = data.entries[i];
    const bg = i % 2 === 0 ? WHITE : LIGHT_GRAY;
    currentPage.drawRectangle({ x: MARGIN, y: y-24, width: CONTENT_W, height: 24, color: bg });
    const ssn = e.workerSsnLast4 ? `***-**-${e.workerSsnLast4}` : '';
    currentPage.drawText(`${e.workerName} ${ssn}`, { x: MARGIN+2, y: y-10, size: 7, font: reg, color: BLACK });
    currentPage.drawText(`${e.classification}${e.isApprentice?' (App)':''}`, { x: MARGIN+2, y: y-20, size: 6, font: reg, color: BLACK });
    // Sunday-first order
    const totSt=e.sunSt+e.monSt+e.tueSt+e.wedSt+e.thuSt+e.friSt+e.satSt;
    const totOt=e.sunOt+e.monOt+e.tueOt+e.wedOt+e.thuOt+e.friOt+e.satOt;
    [e.sunSt,e.monSt,e.tueSt,e.wedSt,e.thuSt,e.friSt,e.satSt,totSt,totOt].forEach((h,j) => {
      currentPage.drawText(h>0?String(h):'\u2014', { x: MARGIN+114+j*22, y: y-14, size: 7, font: reg, color: BLACK });
    });
    const ded=e.ficaTax+e.fitWithheld+e.stateWithheld+e.otherDeductions;
    currentPage.drawText(`$${fmt(e.baseRate)}`, { x: MARGIN+316, y: y-14, size: 7, font: reg, color: BLACK });
    currentPage.drawText(`$${fmt(e.grossWages)}`, { x: MARGIN+354, y: y-14, size: 7, font: reg, color: BLACK });
    currentPage.drawText(`$${fmt(ded)}`, { x: MARGIN+396, y: y-14, size: 7, font: reg, color: BLACK });
    currentPage.drawText(`$${fmt(e.netPay)}`, { x: MARGIN+440, y: y-14, size: 7, font: reg, color: BLACK });
    y -= 26;
  }

  // Compliance page
  const comp = doc.addPage([PAGE_W, PAGE_H]);
  let cy = PAGE_H - MARGIN;
  comp.drawRectangle({ x: MARGIN, y: cy-28, width: CONTENT_W, height: 28, color: NAVY });
  comp.drawText('STATEMENT OF COMPLIANCE \u2014 AS 36.05.010 (Alaska Prevailing Wage Act)', { x: MARGIN+8, y: cy-20, size: 9, font: bold, color: WHITE });
  cy -= 50;
  ['I hereby certify that this payroll is correct and complete, that the wage rates paid are not',
   'less than the applicable prevailing wage rates required under AS 36.05.010 et seq.',
   'All deductions are authorized under law or written agreement.'
  ].forEach(line => { comp.drawText(line, { x: MARGIN, y: cy, size: 8, font: reg, color: BLACK }); cy -= 14; });
  cy -= 30;
  comp.drawText('Signature: _______________________________', { x: MARGIN, y: cy, size: 9, font: reg, color: BLACK });
  comp.drawText(`Date: ${isoToDisplay(data.compliance.signatureDate)}`, { x: MARGIN+280, y: cy, size: 9, font: reg, color: BLACK });
  cy -= 20;
  comp.drawText(`Name: ${data.compliance.certifierName}  Title: ${data.compliance.certifierTitle}`, { x: MARGIN, y: cy, size: 9, font: reg, color: BLACK });

  return doc.save();
}
