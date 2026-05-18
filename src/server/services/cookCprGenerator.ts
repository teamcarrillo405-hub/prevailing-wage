// src/server/services/cookCprGenerator.ts
// Cook County CPR generator — IL prevailing wage rates with Cook County LWO compliance.
// Follows ilPdfGenerator.ts pattern.
// Authority: 820 ILCS 130/5 (IL prevailing wage) + Cook County Living Wage Ordinance (CCLLWO)
// Form: Cook County CPR Rev. 2024

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PAGE_W, PAGE_H, MARGIN, CONTENT_W, NAVY, WHITE, LIGHT_GRAY, BLACK, fmt, isoToDisplay, type GenericCprEntry, type GenericCprCompliance } from './genericCprGenerator.js';

export const COOK_CPR_FORM_VERSION = 'Cook County CPR Rev. 2024';

export interface CookCprInput {
  contractor: { name: string; fein: string; address: string };
  project: {
    name: string;
    cookContractId: string | null;         // Cook County contract number
    location: string;
    contractingAgency: string;
    cookLivingWageApplies: boolean;        // CCLLWO threshold ($25k+) — adds page 3 LWO affidavit
    ccllwoContractYear: string | null;     // e.g. "2025"
  };
  week: { weekEndingDate: string; payrollNumber: string };
  entries: GenericCprEntry[];
  compliance: GenericCprCompliance;
}

function drawLwoAffidavit(doc: PDFDocument, bold: ReturnType<typeof doc.embedFont extends Promise<infer R> ? Promise<R> : never> extends never ? any : any, reg: any, data: CookCprInput): void {
  // This function is called with already-resolved font objects
}

export async function fillCookCpr(data: CookCprInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Cook County Certified Payroll \u2014 ${COOK_CPR_FORM_VERSION}`);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);

  const drawHeader = (page: ReturnType<typeof doc.addPage>) => {
    let y = PAGE_H - MARGIN;
    page.drawRectangle({ x: MARGIN, y: y-28, width: CONTENT_W, height: 28, color: NAVY });
    page.drawText('COOK COUNTY CERTIFIED PAYROLL RECORD', { x: MARGIN+8, y: y-20, size: 10, font: bold, color: WHITE });
    page.drawText(COOK_CPR_FORM_VERSION, { x: MARGIN+CONTENT_W-120, y: y-20, size: 7, font: reg, color: WHITE });
    y -= 36;
    const col2 = MARGIN + CONTENT_W / 2;
    page.drawText(`Contractor: ${data.contractor.name}`, { x: MARGIN, y, size: 8, font: bold, color: BLACK });
    page.drawText(`Project: ${data.project.name}`, { x: col2, y, size: 8, font: bold, color: BLACK }); y -= 14;
    page.drawText(`Address: ${data.contractor.address}`, { x: MARGIN, y, size: 8, font: reg, color: BLACK });
    page.drawText(`Contract No: ${data.project.cookContractId ?? '\u2014'}`, { x: col2, y, size: 8, font: reg, color: BLACK }); y -= 14;
    page.drawText(`FEIN: ${data.contractor.fein}`, { x: MARGIN, y, size: 8, font: reg, color: BLACK });
    page.drawText(`Agency: ${data.project.contractingAgency}`, { x: col2, y, size: 8, font: reg, color: BLACK }); y -= 14;
    page.drawText(`Payroll No: ${data.week.payrollNumber}  Week Ending: ${isoToDisplay(data.week.weekEndingDate)}`, { x: MARGIN, y, size: 8, font: bold, color: BLACK });
    y -= 20;
    page.drawRectangle({ x: MARGIN, y: y-16, width: CONTENT_W, height: 16, color: NAVY });
    ['Worker/Class','M','Tu','W','Th','F','Sa','Su','ST','OT','Base','Gross','Ded','Net'].forEach((h,i) => {
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
    const totSt=e.monSt+e.tueSt+e.wedSt+e.thuSt+e.friSt+e.satSt+e.sunSt;
    const totOt=e.monOt+e.tueOt+e.wedOt+e.thuOt+e.friOt+e.satOt+e.sunOt;
    [e.monSt,e.tueSt,e.wedSt,e.thuSt,e.friSt,e.satSt,e.sunSt,totSt,totOt].forEach((h,j) => {
      currentPage.drawText(h>0?String(h):'\u2014', { x: MARGIN+114+j*22, y: y-14, size: 7, font: reg, color: BLACK });
    });
    const ded=e.ficaTax+e.fitWithheld+e.stateWithheld+e.otherDeductions;
    currentPage.drawText(`$${fmt(e.baseRate)}`, { x: MARGIN+316, y: y-14, size: 7, font: reg, color: BLACK });
    currentPage.drawText(`$${fmt(e.grossWages)}`, { x: MARGIN+354, y: y-14, size: 7, font: reg, color: BLACK });
    currentPage.drawText(`$${fmt(ded)}`, { x: MARGIN+396, y: y-14, size: 7, font: reg, color: BLACK });
    currentPage.drawText(`$${fmt(e.netPay)}`, { x: MARGIN+440, y: y-14, size: 7, font: reg, color: BLACK });
    y -= 26;
  }

  // Compliance page (820 ILCS 130/5)
  const comp = doc.addPage([PAGE_W, PAGE_H]);
  let cy = PAGE_H - MARGIN;
  comp.drawRectangle({ x: MARGIN, y: cy-28, width: CONTENT_W, height: 28, color: NAVY });
  comp.drawText('STATEMENT OF COMPLIANCE \u2014 820 ILCS 130/5 / Cook County CCLLWO', { x: MARGIN+8, y: cy-20, size: 9, font: bold, color: WHITE });
  cy -= 50;
  ['I hereby certify that this payroll is correct and complete, that the wage rates paid are not',
   'less than the applicable prevailing wage rates required under 820 ILCS 130/5 (IL Prevailing',
   'Wage Act) and, where applicable, the Cook County Living Wage Ordinance.',
   'All deductions are authorized under law or written agreement.'
  ].forEach(line => { comp.drawText(line, { x: MARGIN, y: cy, size: 8, font: reg, color: BLACK }); cy -= 14; });
  cy -= 30;
  comp.drawText('Signature: _______________________________', { x: MARGIN, y: cy, size: 9, font: reg, color: BLACK });
  comp.drawText(`Date: ${isoToDisplay(data.compliance.signatureDate)}`, { x: MARGIN+280, y: cy, size: 9, font: reg, color: BLACK });
  cy -= 20;
  comp.drawText(`Name: ${data.compliance.certifierName}  Title: ${data.compliance.certifierTitle}`, { x: MARGIN, y: cy, size: 9, font: reg, color: BLACK });

  // LWO Affidavit page (only if applies)
  if (data.project.cookLivingWageApplies) {
    const lwo = doc.addPage([PAGE_W, PAGE_H]);
    let ly = PAGE_H - MARGIN;
    lwo.drawRectangle({ x: MARGIN, y: ly-28, width: CONTENT_W, height: 28, color: NAVY });
    lwo.drawText('COOK COUNTY LIVING WAGE ORDINANCE (CCLLWO) COMPLIANCE AFFIDAVIT', { x: MARGIN+8, y: ly-20, size: 9, font: bold, color: WHITE });
    ly -= 50;
    [
      `Contract Year: ${data.project.ccllwoContractYear ?? '\u2014'}`,
      `Contractor: ${data.contractor.name}  FEIN: ${data.contractor.fein}`,
      `Cook County Contract No: ${data.project.cookContractId ?? '\u2014'}`,
      '',
      'I hereby certify that all covered employees listed on this payroll have been paid',
      'a wage rate not less than the Cook County Living Wage Ordinance minimum for the',
      'applicable contract year, as published by the Cook County Department of Human',
      'Rights and Ethics.',
    ].forEach(line => { lwo.drawText(line, { x: MARGIN, y: ly, size: 8, font: reg, color: BLACK }); ly -= 14; });
    ly -= 30;
    lwo.drawText('Signature: _______________________________', { x: MARGIN, y: ly, size: 9, font: reg, color: BLACK });
    lwo.drawText(`Date: ${isoToDisplay(data.compliance.signatureDate)}`, { x: MARGIN+280, y: ly, size: 9, font: reg, color: BLACK });
  }

  return doc.save();
}
