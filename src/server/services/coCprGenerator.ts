// src/server/services/coCprGenerator.ts
// Colorado COWC Certified Payroll PDF generator.
// Authority: CRS § 8-17-101 et seq. (Colorado Prevailing Wage Act)
// Form: CO COWC CPR Rev. 2024

import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from 'pdf-lib';

const PAGE_W = 612, PAGE_H = 792, MARGIN = 36, CONTENT_W = PAGE_W - 2 * MARGIN;
const NAVY = rgb(0.08, 0.20, 0.42), WHITE = rgb(1, 1, 1), LIGHT_GRAY = rgb(0.94, 0.94, 0.94), BLACK = rgb(0, 0, 0);

export const CO_CPR_FORM_VERSION = 'CO COWC CPR Rev. 2024';

export interface CoCprInput {
  contractor: { name: string; fein: string; address: string };
  project: { name: string; coContractId: string | null; coAwardingAgency: string; projectCounty: string };
  week: { weekEndingDate: string; payrollNumber: string };
  entries: Array<{
    workerName: string; workerSsnLast4: string | null; workerAddress: string;
    classification: string; isApprentice: boolean;
    monSt: number; monOt: number; tueSt: number; tueOt: number; wedSt: number; wedOt: number;
    thuSt: number; thuOt: number; friSt: number; friOt: number; satSt: number; satOt: number;
    sunSt: number; sunOt: number;
    baseRate: number; fringeRate: number; grossWages: number;
    ficaTax: number; fitWithheld: number; stateWithheld: number; otherDeductions: number; netPay: number;
  }>;
  compliance: { certifierName: string; certifierTitle: string; signatureDate: string };
}

function fmt(n: number) { return n.toFixed(2); }
function isoToDisplay(iso: string) { const [y,m,d]=iso.split('-'); return `${m}/${d}/${y}`; }

export async function fillCoCpr(data: CoCprInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`CO Certified Payroll \u2014 ${CO_CPR_FORM_VERSION}`);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);

  const addWorkerPage = () => {
    const p = doc.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - MARGIN;
    p.drawRectangle({ x: MARGIN, y: y-28, width: CONTENT_W, height: 28, color: NAVY });
    p.drawText('COLORADO CERTIFIED PAYROLL RECORD', { x: MARGIN+8, y: y-20, size: 11, font: bold, color: WHITE });
    p.drawText(CO_CPR_FORM_VERSION, { x: MARGIN+CONTENT_W-120, y: y-20, size: 8, font: reg, color: WHITE });
    y -= 36;
    const col2 = MARGIN + CONTENT_W / 2;
    p.drawText(`Contractor: ${data.contractor.name}`, { x: MARGIN, y, size: 8, font: bold, color: BLACK });
    p.drawText(`Project: ${data.project.name}`, { x: col2, y, size: 8, font: bold, color: BLACK }); y -= 14;
    p.drawText(`Address: ${data.contractor.address}`, { x: MARGIN, y, size: 8, font: reg, color: BLACK });
    p.drawText(`Contract No: ${data.project.coContractId ?? '\u2014'}`, { x: col2, y, size: 8, font: reg, color: BLACK }); y -= 14;
    p.drawText(`FEIN: ${data.contractor.fein}`, { x: MARGIN, y, size: 8, font: reg, color: BLACK });
    p.drawText(`Agency: ${data.project.coAwardingAgency}  County: ${data.project.projectCounty}`, { x: col2, y, size: 8, font: reg, color: BLACK }); y -= 14;
    p.drawText(`Payroll No: ${data.week.payrollNumber}  Week Ending: ${isoToDisplay(data.week.weekEndingDate)}`, { x: MARGIN, y, size: 8, font: bold, color: BLACK });
    y -= 20;
    // Table header
    p.drawRectangle({ x: MARGIN, y: y-16, width: CONTENT_W, height: 16, color: NAVY });
    ['Worker/Class','M','Tu','W','Th','F','Sa','Su','ST','OT','Base','Gross','Ded','Net'].forEach((h,i) => {
      const xs = [MARGIN+2,MARGIN+114,MARGIN+136,MARGIN+158,MARGIN+180,MARGIN+202,MARGIN+224,MARGIN+246,MARGIN+270,MARGIN+292,MARGIN+316,MARGIN+354,MARGIN+396,MARGIN+440];
      p.drawText(h, { x: xs[i]??MARGIN, y: y-12, size: 7, font: bold, color: WHITE });
    });
    y -= 20;
    return { p, y };
  };

  let { p: currentPage, y } = addWorkerPage();

  for (let i = 0; i < data.entries.length; i++) {
    if (y - 26 < MARGIN + 40) { const np = addWorkerPage(); currentPage = np.p; y = np.y; }
    const e = data.entries[i];
    const bg = i % 2 === 0 ? WHITE : LIGHT_GRAY;
    currentPage.drawRectangle({ x: MARGIN, y: y-24, width: CONTENT_W, height: 24, color: bg });
    const ssn = e.workerSsnLast4 ? `***-**-${e.workerSsnLast4}` : '';
    currentPage.drawText(`${e.workerName} ${ssn}`, { x: MARGIN+2, y: y-10, size: 7, font: reg, color: BLACK });
    currentPage.drawText(`${e.classification}${e.isApprentice?' (App)':''}`, { x: MARGIN+2, y: y-20, size: 6, font: reg, color: BLACK });
    const totSt = e.monSt+e.tueSt+e.wedSt+e.thuSt+e.friSt+e.satSt+e.sunSt;
    const totOt = e.monOt+e.tueOt+e.wedOt+e.thuOt+e.friOt+e.satOt+e.sunOt;
    [e.monSt,e.tueSt,e.wedSt,e.thuSt,e.friSt,e.satSt,e.sunSt,totSt,totOt].forEach((h,j) => {
      currentPage.drawText(h>0?String(h):'\u2014', { x: MARGIN+114+j*22, y: y-14, size: 7, font: reg, color: BLACK });
    });
    const ded = e.ficaTax+e.fitWithheld+e.stateWithheld+e.otherDeductions;
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
  comp.drawText('STATEMENT OF COMPLIANCE \u2014 CRS \u00a7 8-17-101 (Colorado Prevailing Wage Act)', { x: MARGIN+8, y: cy-20, size: 9, font: bold, color: WHITE });
  cy -= 50;
  ['I hereby certify that this payroll is correct and complete, that the wage rates paid are not',
   'less than the applicable prevailing wage rates required under CRS \u00a7 8-17-101 et seq.,',
   'and that all deductions are authorized under law or written agreement.',
  ].forEach(line => { comp.drawText(line, { x: MARGIN, y: cy, size: 8, font: reg, color: BLACK }); cy -= 14; });
  cy -= 30;
  comp.drawText('Signature: _______________________________', { x: MARGIN, y: cy, size: 9, font: reg, color: BLACK });
  comp.drawText(`Date: ${isoToDisplay(data.compliance.signatureDate)}`, { x: MARGIN+280, y: cy, size: 9, font: reg, color: BLACK });
  cy -= 20;
  comp.drawText(`Name: ${data.compliance.certifierName}  Title: ${data.compliance.certifierTitle}`, { x: MARGIN, y: cy, size: 9, font: reg, color: BLACK });

  return doc.save();
}
