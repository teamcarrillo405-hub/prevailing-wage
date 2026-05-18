// src/server/services/orBoliGenerator.ts
// Oregon BOLI Certified Payroll PDF generator.
// Authority: ORS 279C.800 et seq. (Oregon Bureau of Labor and Industries)
// Form: OR BOLI CPR Rev. 2024

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { generateGenericCpr, PAGE_W, PAGE_H, MARGIN, CONTENT_W, NAVY, WHITE, LIGHT_GRAY, BLACK, fmt, isoToDisplay, type GenericCprCompliance } from './genericCprGenerator.js';

export const OR_BOLI_FORM_VERSION = 'OR BOLI CPR Rev. 2024';

export interface OrBoliInput {
  contractor: { name: string; fein: string; address: string; orCcbLicense: string | null };
  project: { name: string; orBoliProjectId: string | null; county?: string };
  week: { weekEndingDate: string; payrollNumber: string };
  entries: Array<{
    workerName: string; workerSsnLast4: string | null; classification: string; isApprentice: boolean;
    isWoman: boolean | null; isMinority: boolean | null;
    monSt: number; monOt: number; tueSt: number; tueOt: number; wedSt: number; wedOt: number;
    thuSt: number; thuOt: number; friSt: number; friOt: number; satSt: number; satOt: number;
    sunSt: number; sunOt: number;
    baseRate: number; grossWages: number; ficaTax: number; fitWithheld: number;
    stateWithheld: number; otherDeductions: number; netPay: number;
  }>;
  compliance: GenericCprCompliance;
}

function fmtBool(v: boolean | null): string {
  if (v === true) return 'Y';
  if (v === false) return 'N';
  return '\u2014';
}

export async function fillOrBoli(data: OrBoliInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`OR Certified Payroll \u2014 ${OR_BOLI_FORM_VERSION}`);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);

  const drawHeader = (page: ReturnType<typeof doc.addPage>) => {
    let y = PAGE_H - MARGIN;
    page.drawRectangle({ x: MARGIN, y: y-28, width: CONTENT_W, height: 28, color: NAVY });
    page.drawText('OREGON BOLI CERTIFIED PAYROLL RECORD', { x: MARGIN+8, y: y-20, size: 10, font: bold, color: WHITE });
    page.drawText(OR_BOLI_FORM_VERSION, { x: MARGIN+CONTENT_W-120, y: y-20, size: 7, font: reg, color: WHITE });
    y -= 36;
    const col2 = MARGIN + CONTENT_W / 2;
    page.drawText(`Contractor: ${data.contractor.name}`, { x: MARGIN, y, size: 8, font: bold, color: BLACK });
    page.drawText(`Project: ${data.project.name}`, { x: col2, y, size: 8, font: bold, color: BLACK }); y -= 14;
    page.drawText(`Address: ${data.contractor.address}`, { x: MARGIN, y, size: 8, font: reg, color: BLACK });
    page.drawText(`BOLI Project ID: ${data.project.orBoliProjectId ?? '\u2014'}`, { x: col2, y, size: 8, font: reg, color: BLACK }); y -= 14;
    page.drawText(`FEIN: ${data.contractor.fein}  CCB: ${data.contractor.orCcbLicense ?? '\u2014'}`, { x: MARGIN, y, size: 8, font: reg, color: BLACK });
    if (data.project.county) page.drawText(`County: ${data.project.county}`, { x: col2, y, size: 8, font: reg, color: BLACK });
    y -= 14;
    page.drawText(`Payroll No: ${data.week.payrollNumber}  Week Ending: ${isoToDisplay(data.week.weekEndingDate)}`, { x: MARGIN, y, size: 8, font: bold, color: BLACK });
    y -= 20;
    // Table header with EEO columns
    page.drawRectangle({ x: MARGIN, y: y-16, width: CONTENT_W, height: 16, color: NAVY });
    [['Worker/Class',MARGIN+2],['W',MARGIN+100],['M',MARGIN+112],['Mon',MARGIN+124],['Tu',MARGIN+142],['W',MARGIN+160],['Th',MARGIN+178],['F',MARGIN+196],['Sa',MARGIN+214],['Su',MARGIN+232],['ST',MARGIN+252],['OT',MARGIN+272],['Base',MARGIN+294],['Gross',MARGIN+330],['Ded',MARGIN+370],['Net',MARGIN+408]].forEach(([h,x]) => {
      page.drawText(String(h), { x: Number(x), y: y-12, size: 6, font: bold, color: WHITE });
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
    currentPage.drawText(fmtBool(e.isWoman), { x: MARGIN+100, y: y-14, size: 7, font: reg, color: BLACK });
    currentPage.drawText(fmtBool(e.isMinority), { x: MARGIN+112, y: y-14, size: 7, font: reg, color: BLACK });
    const totSt=e.monSt+e.tueSt+e.wedSt+e.thuSt+e.friSt+e.satSt+e.sunSt;
    const totOt=e.monOt+e.tueOt+e.wedOt+e.thuOt+e.friOt+e.satOt+e.sunOt;
    [e.monSt,e.tueSt,e.wedSt,e.thuSt,e.friSt,e.satSt,e.sunSt,totSt,totOt].forEach((h,j) => {
      currentPage.drawText(h>0?String(h):'\u2014', { x: MARGIN+124+j*18, y: y-14, size: 7, font: reg, color: BLACK });
    });
    const ded=e.ficaTax+e.fitWithheld+e.stateWithheld+e.otherDeductions;
    currentPage.drawText(`$${fmt(e.baseRate)}`, { x: MARGIN+294, y: y-14, size: 7, font: reg, color: BLACK });
    currentPage.drawText(`$${fmt(e.grossWages)}`, { x: MARGIN+330, y: y-14, size: 7, font: reg, color: BLACK });
    currentPage.drawText(`$${fmt(ded)}`, { x: MARGIN+370, y: y-14, size: 7, font: reg, color: BLACK });
    currentPage.drawText(`$${fmt(e.netPay)}`, { x: MARGIN+408, y: y-14, size: 7, font: reg, color: BLACK });
    y -= 26;
  }

  // Compliance page
  const comp = doc.addPage([PAGE_W, PAGE_H]);
  let cy = PAGE_H - MARGIN;
  comp.drawRectangle({ x: MARGIN, y: cy-28, width: CONTENT_W, height: 28, color: NAVY });
  comp.drawText('STATEMENT OF COMPLIANCE \u2014 ORS 279C.800 (Oregon BOLI)', { x: MARGIN+8, y: cy-20, size: 9, font: bold, color: WHITE });
  cy -= 50;
  ['I hereby certify that this payroll is correct and complete, that the wage rates paid',
   'are not less than the applicable prevailing wage rates required under ORS 279C.800 et seq.,',
   'and all deductions are authorized under law or written agreement.'
  ].forEach(line => { comp.drawText(line, { x: MARGIN, y: cy, size: 8, font: reg, color: BLACK }); cy -= 14; });
  cy -= 30;
  comp.drawText('Signature: _______________________________', { x: MARGIN, y: cy, size: 9, font: reg, color: BLACK });
  comp.drawText(`Date: ${isoToDisplay(data.compliance.signatureDate)}`, { x: MARGIN+280, y: cy, size: 9, font: reg, color: BLACK });
  cy -= 20;
  comp.drawText(`Name: ${data.compliance.certifierName}  Title: ${data.compliance.certifierTitle}`, { x: MARGIN, y: cy, size: 9, font: reg, color: BLACK });

  return doc.save();
}
