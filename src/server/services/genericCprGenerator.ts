// src/server/services/genericCprGenerator.ts
// Shared PDF generation logic for state CPR forms that follow the standard pattern:
// - Header block (title bar + contractor/project fields)
// - Worker table with M-Tu-W-Th-F-Sa-Su ST/OT hours, base, gross, deductions, net
// - Compliance page (always last, dedicated page)
//
// This module is used internally by state-specific generators.
// Do NOT import this directly from routes — use the state-specific generators.

import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from 'pdf-lib';

export const PAGE_W = 612;
export const PAGE_H = 792;
export const MARGIN = 36;
export const CONTENT_W = PAGE_W - 2 * MARGIN;
export const NAVY = rgb(0.08, 0.20, 0.42);
export const WHITE = rgb(1, 1, 1);
export const LIGHT_GRAY = rgb(0.94, 0.94, 0.94);
export const BLACK = rgb(0, 0, 0);

export function fmt(n: number): string { return n.toFixed(2); }
export function isoToDisplay(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
}

export interface GenericCprHeaderFields {
  titleText: string;
  formVersion: string;
  contractorName: string;
  contractorFein: string;
  contractorAddress: string;
  projectName: string;
  contractId: string | null;
  projectLocation: string;   // county, agency, or custom text shown bottom-right
  payrollNumber: string;
  weekEndingDate: string;    // ISO YYYY-MM-DD
}

export interface GenericCprEntry {
  workerName: string;
  workerSsnLast4: string | null;
  classification: string;
  isApprentice: boolean;
  monSt: number; monOt: number;
  tueSt: number; tueOt: number;
  wedSt: number; wedOt: number;
  thuSt: number; thuOt: number;
  friSt: number; friOt: number;
  satSt: number; satOt: number;
  sunSt: number; sunOt: number;
  baseRate: number;
  grossWages: number;
  ficaTax: number;
  fitWithheld: number;
  stateWithheld: number;
  otherDeductions: number;
  netPay: number;
}

export interface GenericCprCompliance {
  statuteCitation: string;    // e.g. "MD Code, Lab. & Emp. § 17-201 et seq."
  certifierName: string;
  certifierTitle: string;
  signatureDate: string;      // ISO YYYY-MM-DD
}

function drawPageHeader(page: PDFPage, bold: PDFFont, reg: PDFFont, header: GenericCprHeaderFields): number {
  let y = PAGE_H - MARGIN;
  page.drawRectangle({ x: MARGIN, y: y - 28, width: CONTENT_W, height: 28, color: NAVY });
  page.drawText(header.titleText, { x: MARGIN + 8, y: y - 20, size: 10, font: bold, color: WHITE });
  page.drawText(header.formVersion, { x: MARGIN + CONTENT_W - 120, y: y - 20, size: 7, font: reg, color: WHITE });
  y -= 36;
  const col2 = MARGIN + CONTENT_W / 2;
  page.drawText(`Contractor: ${header.contractorName}`, { x: MARGIN, y, size: 8, font: bold, color: BLACK });
  page.drawText(`Project: ${header.projectName}`, { x: col2, y, size: 8, font: bold, color: BLACK }); y -= 14;
  page.drawText(`Address: ${header.contractorAddress}`, { x: MARGIN, y, size: 8, font: reg, color: BLACK });
  page.drawText(`Contract No: ${header.contractId ?? '\u2014'}`, { x: col2, y, size: 8, font: reg, color: BLACK }); y -= 14;
  page.drawText(`FEIN: ${header.contractorFein}`, { x: MARGIN, y, size: 8, font: reg, color: BLACK });
  page.drawText(header.projectLocation, { x: col2, y, size: 8, font: reg, color: BLACK }); y -= 14;
  page.drawText(`Payroll No: ${header.payrollNumber}  Week Ending: ${isoToDisplay(header.weekEndingDate)}`, { x: MARGIN, y, size: 8, font: bold, color: BLACK });
  y -= 20;
  return y;
}

function drawTableHeader(page: PDFPage, bold: PDFFont, y: number): number {
  page.drawRectangle({ x: MARGIN, y: y - 16, width: CONTENT_W, height: 16, color: NAVY });
  const labels = ['Worker/Class','M','Tu','W','Th','F','Sa','Su','ST','OT','Base','Gross','Ded','Net'];
  const xs = [MARGIN+2,MARGIN+114,MARGIN+136,MARGIN+158,MARGIN+180,MARGIN+202,MARGIN+224,MARGIN+246,MARGIN+270,MARGIN+292,MARGIN+316,MARGIN+354,MARGIN+396,MARGIN+440];
  labels.forEach((h, i) => {
    page.drawText(h, { x: xs[i] ?? MARGIN, y: y - 12, size: 7, font: bold, color: WHITE });
  });
  return y - 20;
}

function drawWorkerRow(page: PDFPage, reg: PDFFont, y: number, e: GenericCprEntry, idx: number): number {
  const bg = idx % 2 === 0 ? WHITE : LIGHT_GRAY;
  page.drawRectangle({ x: MARGIN, y: y - 24, width: CONTENT_W, height: 24, color: bg });
  const ssn = e.workerSsnLast4 ? `***-**-${e.workerSsnLast4}` : '';
  page.drawText(`${e.workerName} ${ssn}`, { x: MARGIN + 2, y: y - 10, size: 7, font: reg, color: BLACK });
  page.drawText(`${e.classification}${e.isApprentice ? ' (App)' : ''}`, { x: MARGIN + 2, y: y - 20, size: 6, font: reg, color: BLACK });
  const totSt = e.monSt+e.tueSt+e.wedSt+e.thuSt+e.friSt+e.satSt+e.sunSt;
  const totOt = e.monOt+e.tueOt+e.wedOt+e.thuOt+e.friOt+e.satOt+e.sunOt;
  [e.monSt,e.tueSt,e.wedSt,e.thuSt,e.friSt,e.satSt,e.sunSt,totSt,totOt].forEach((h, j) => {
    page.drawText(h > 0 ? String(h) : '\u2014', { x: MARGIN+114+j*22, y: y-14, size: 7, font: reg, color: BLACK });
  });
  const ded = e.ficaTax + e.fitWithheld + e.stateWithheld + e.otherDeductions;
  page.drawText(`$${fmt(e.baseRate)}`, { x: MARGIN+316, y: y-14, size: 7, font: reg, color: BLACK });
  page.drawText(`$${fmt(e.grossWages)}`, { x: MARGIN+354, y: y-14, size: 7, font: reg, color: BLACK });
  page.drawText(`$${fmt(ded)}`, { x: MARGIN+396, y: y-14, size: 7, font: reg, color: BLACK });
  page.drawText(`$${fmt(e.netPay)}`, { x: MARGIN+440, y: y-14, size: 7, font: reg, color: BLACK });
  return y - 26;
}

function drawCompliancePage(doc: PDFDocument, bold: PDFFont, reg: PDFFont, compliance: GenericCprCompliance): void {
  const page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  page.drawRectangle({ x: MARGIN, y: y-28, width: CONTENT_W, height: 28, color: NAVY });
  page.drawText(`STATEMENT OF COMPLIANCE \u2014 ${compliance.statuteCitation}`, { x: MARGIN+8, y: y-20, size: 8, font: bold, color: WHITE });
  y -= 50;
  [
    'I, the undersigned, hereby certify under penalty of law that:',
    '',
    '(1) The payroll records for this period are correct and complete;',
    `(2) Wage rates paid to each worker are not less than the applicable prevailing wage rate`,
    `    required under ${compliance.statuteCitation};`,
    '(3) Each worker has been paid not less than the applicable prevailing wage and fringe',
    '    benefits for the classification of work actually performed;',
    '(4) All deductions from wages are authorized under law or by written agreement signed by',
    '    the employee.',
  ].forEach(line => {
    page.drawText(line, { x: MARGIN, y, size: 8, font: reg, color: BLACK });
    y -= 14;
  });
  y -= 30;
  page.drawText('Signature: _______________________________', { x: MARGIN, y, size: 9, font: reg, color: BLACK });
  page.drawText(`Date: ${isoToDisplay(compliance.signatureDate)}`, { x: MARGIN+280, y, size: 9, font: reg, color: BLACK });
  y -= 20;
  page.drawText(`Printed Name: ${compliance.certifierName}`, { x: MARGIN, y, size: 9, font: reg, color: BLACK });
  page.drawText(`Title: ${compliance.certifierTitle}`, { x: MARGIN+280, y, size: 9, font: reg, color: BLACK });
}

export async function generateGenericCpr(
  docTitle: string,
  header: GenericCprHeaderFields,
  entries: GenericCprEntry[],
  compliance: GenericCprCompliance,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(docTitle);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);

  let currentPage = doc.addPage([PAGE_W, PAGE_H]);
  let y = drawPageHeader(currentPage, bold, reg, header);
  y = drawTableHeader(currentPage, bold, y);

  for (let i = 0; i < entries.length; i++) {
    if (y - 26 < MARGIN + 40) {
      currentPage = doc.addPage([PAGE_W, PAGE_H]);
      y = drawPageHeader(currentPage, bold, reg, header);
      y = drawTableHeader(currentPage, bold, y);
    }
    y = drawWorkerRow(currentPage, reg, y, entries[i], i);
  }

  drawCompliancePage(doc, bold, reg, compliance);
  return doc.save();
}
