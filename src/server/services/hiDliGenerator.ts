// src/server/services/hiDliGenerator.ts
// Hawaii DLI Certified Payroll PDF generator.
// Authority: HRS Chapter 104 (Hawaii Wages and Hours of Employees on Public Works)
// Form: HI DLI CPR Rev. 2024
// Note: HI requires double-time (DT) columns — after 10 hours/day or 7th consecutive day.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PAGE_W, PAGE_H, MARGIN, CONTENT_W, NAVY, WHITE, LIGHT_GRAY, BLACK, fmt, isoToDisplay, type GenericCprCompliance } from './genericCprGenerator.js';

export const HI_DLI_FORM_VERSION = 'HI DLI CPR Rev. 2024';

export interface HiDliInput {
  contractor: { name: string; fein: string; address: string };
  project: { name: string; hiContractId: string | null; hiAwardingAgency: string };
  week: { weekEndingDate: string; payrollNumber: string };
  entries: Array<{
    workerName: string; workerSsnLast4: string | null; classification: string; isApprentice: boolean;
    monSt: number; monOt: number; monDt: number;
    tueSt: number; tueOt: number; tueDt: number;
    wedSt: number; wedOt: number; wedDt: number;
    thuSt: number; thuOt: number; thuDt: number;
    friSt: number; friOt: number; friDt: number;
    satSt: number; satOt: number; satDt: number;
    sunSt: number; sunOt: number; sunDt: number;
    baseRate: number; dtRate: number;
    grossWages: number; ficaTax: number; fitWithheld: number;
    stateWithheld: number; otherDeductions: number; netPay: number;
  }>;
  compliance: GenericCprCompliance;
}

export async function fillHiDli(data: HiDliInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`HI Certified Payroll \u2014 ${HI_DLI_FORM_VERSION}`);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);

  const drawHeader = (page: ReturnType<typeof doc.addPage>) => {
    let y = PAGE_H - MARGIN;
    page.drawRectangle({ x: MARGIN, y: y-28, width: CONTENT_W, height: 28, color: NAVY });
    page.drawText('HAWAII DLI CERTIFIED PAYROLL RECORD', { x: MARGIN+8, y: y-20, size: 10, font: bold, color: WHITE });
    page.drawText(HI_DLI_FORM_VERSION, { x: MARGIN+CONTENT_W-120, y: y-20, size: 7, font: reg, color: WHITE });
    y -= 36;
    const col2 = MARGIN + CONTENT_W / 2;
    page.drawText(`Contractor: ${data.contractor.name}`, { x: MARGIN, y, size: 8, font: bold, color: BLACK });
    page.drawText(`Project: ${data.project.name}`, { x: col2, y, size: 8, font: bold, color: BLACK }); y -= 14;
    page.drawText(`Address: ${data.contractor.address}`, { x: MARGIN, y, size: 8, font: reg, color: BLACK });
    page.drawText(`Contract No: ${data.project.hiContractId ?? '\u2014'}`, { x: col2, y, size: 8, font: reg, color: BLACK }); y -= 14;
    page.drawText(`FEIN: ${data.contractor.fein}`, { x: MARGIN, y, size: 8, font: reg, color: BLACK });
    page.drawText(`Agency: ${data.project.hiAwardingAgency}`, { x: col2, y, size: 8, font: reg, color: BLACK }); y -= 14;
    page.drawText(`Payroll No: ${data.week.payrollNumber}  Week Ending: ${isoToDisplay(data.week.weekEndingDate)}`, { x: MARGIN, y, size: 8, font: bold, color: BLACK });
    y -= 20;
    page.drawRectangle({ x: MARGIN, y: y-16, width: CONTENT_W, height: 16, color: NAVY });
    // Compressed header with ST/OT/DT per day
    const hdrs: Array<[string, number]> = [
      ['Worker/Class',MARGIN+2],['M-ST',MARGIN+106],['OT',MARGIN+122],['DT',MARGIN+138],
      ['Tu-S',MARGIN+154],['OT',MARGIN+170],['DT',MARGIN+186],
      ['W-ST',MARGIN+202],['OT',MARGIN+218],
      ['Th-S',MARGIN+234],['OT',MARGIN+250],
      ['F-ST',MARGIN+266],['OT',MARGIN+282],
      ['Sa-S',MARGIN+298],['Su-S',MARGIN+314],
      ['T-ST',MARGIN+330],['T-OT',MARGIN+346],['T-DT',MARGIN+362],
      ['Base',MARGIN+382],['Gross',MARGIN+416],['Ded',MARGIN+452],['Net',MARGIN+486],
    ];
    hdrs.forEach(([h,x]) => page.drawText(h, { x, y: y-12, size: 5, font: bold, color: WHITE }));
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
    const totDt=e.monDt+e.tueDt+e.wedDt+e.thuDt+e.friDt+e.satDt+e.sunDt;
    const vals: Array<[number,number]> = [
      [e.monSt,MARGIN+106],[e.monOt,MARGIN+122],[e.monDt,MARGIN+138],
      [e.tueSt,MARGIN+154],[e.tueOt,MARGIN+170],[e.tueDt,MARGIN+186],
      [e.wedSt,MARGIN+202],[e.wedOt,MARGIN+218],
      [e.thuSt,MARGIN+234],[e.thuOt,MARGIN+250],
      [e.friSt,MARGIN+266],[e.friOt,MARGIN+282],
      [e.satSt,MARGIN+298],[e.sunSt,MARGIN+314],
      [totSt,MARGIN+330],[totOt,MARGIN+346],[totDt,MARGIN+362],
    ];
    vals.forEach(([h,x]) => currentPage.drawText(h>0?String(h):'\u2014', { x, y: y-14, size: 6, font: reg, color: BLACK }));
    const ded=e.ficaTax+e.fitWithheld+e.stateWithheld+e.otherDeductions;
    currentPage.drawText(`$${fmt(e.baseRate)}`, { x: MARGIN+382, y: y-14, size: 6, font: reg, color: BLACK });
    currentPage.drawText(`$${fmt(e.grossWages)}`, { x: MARGIN+416, y: y-14, size: 6, font: reg, color: BLACK });
    currentPage.drawText(`$${fmt(ded)}`, { x: MARGIN+452, y: y-14, size: 6, font: reg, color: BLACK });
    currentPage.drawText(`$${fmt(e.netPay)}`, { x: MARGIN+486, y: y-14, size: 6, font: reg, color: BLACK });
    y -= 26;
  }

  // Compliance page
  const comp = doc.addPage([PAGE_W, PAGE_H]);
  let cy = PAGE_H - MARGIN;
  comp.drawRectangle({ x: MARGIN, y: cy-28, width: CONTENT_W, height: 28, color: NAVY });
  comp.drawText('STATEMENT OF COMPLIANCE \u2014 HRS Chapter 104', { x: MARGIN+8, y: cy-20, size: 9, font: bold, color: WHITE });
  cy -= 50;
  ['I hereby certify that this payroll is correct and complete, that the wage rates paid are not',
   'less than the applicable prevailing wage rates required under HRS Chapter 104, including',
   'straight-time, overtime, and double-time as required.',
   'All deductions are authorized under law or written agreement.'
  ].forEach(line => { comp.drawText(line, { x: MARGIN, y: cy, size: 8, font: reg, color: BLACK }); cy -= 14; });
  cy -= 30;
  comp.drawText('Signature: _______________________________', { x: MARGIN, y: cy, size: 9, font: reg, color: BLACK });
  comp.drawText(`Date: ${isoToDisplay(data.compliance.signatureDate)}`, { x: MARGIN+280, y: cy, size: 9, font: reg, color: BLACK });
  cy -= 20;
  comp.drawText(`Name: ${data.compliance.certifierName}  Title: ${data.compliance.certifierTitle}`, { x: MARGIN, y: cy, size: 9, font: reg, color: BLACK });

  return doc.save();
}
