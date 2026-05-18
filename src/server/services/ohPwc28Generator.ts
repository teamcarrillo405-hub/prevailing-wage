// src/server/services/ohPwc28Generator.ts
//
// Ohio PWC-28 Certified Payroll PDF generator (pdf-lib programmatic drawing).
// Authority: Ohio Prevailing Wage Law, ORC Chapter 4115.
// Form: OH PWC-28 Rev. 2023 — drawn from scratch (no fillable template).

import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from 'pdf-lib';

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 36;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const NAVY = rgb(0.08, 0.20, 0.42);
const WHITE = rgb(1, 1, 1);
const LIGHT_GRAY = rgb(0.94, 0.94, 0.94);
const BLACK = rgb(0, 0, 0);

export const OH_PWC28_FORM_VERSION = 'OH PWC-28 Rev. 2023';

export interface OhPwc28Input {
  contractor: {
    name: string;
    fein: string;
    address: string;
  };
  project: {
    name: string;
    ohContractId: string | null;
    ohAwardingAuthority: string;
    county: string;
  };
  week: {
    weekEndingDate: string;
    payrollNumber: string;
  };
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
    baseRate: number;
    fringeRate: number;
    grossWages: number;
    ficaTax: number;
    fitWithheld: number;
    stateWithheld: number;
    otherDeductions: number;
    netPay: number;
  }>;
  compliance: {
    certifierName: string;
    certifierTitle: string;
    signatureDate: string;
  };
}

function fmt(n: number): string { return n.toFixed(2); }
function isoToDisplay(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
}

async function drawHeader(page: PDFPage, bold: PDFFont, reg: PDFFont, data: OhPwc28Input): Promise<void> {
  let y = PAGE_H - MARGIN;
  page.drawRectangle({ x: MARGIN, y: y - 28, width: CONTENT_W, height: 28, color: NAVY });
  page.drawText('OHIO CERTIFIED PAYROLL RECORD (PWC-28)', {
    x: MARGIN + 8, y: y - 20, size: 11, font: bold, color: WHITE,
  });
  page.drawText(OH_PWC28_FORM_VERSION, {
    x: MARGIN + CONTENT_W - 120, y: y - 20, size: 8, font: reg, color: WHITE,
  });
  y -= 36;
  const col2 = MARGIN + CONTENT_W / 2;
  page.drawText(`Contractor: ${data.contractor.name}`, { x: MARGIN, y, size: 8, font: bold, color: BLACK });
  page.drawText(`Project: ${data.project.name}`, { x: col2, y, size: 8, font: bold, color: BLACK });
  y -= 14;
  page.drawText(`Address: ${data.contractor.address}`, { x: MARGIN, y, size: 8, font: reg, color: BLACK });
  page.drawText(`Contract No: ${data.project.ohContractId ?? '\u2014'}`, { x: col2, y, size: 8, font: reg, color: BLACK });
  y -= 14;
  page.drawText(`FEIN: ${data.contractor.fein}`, { x: MARGIN, y, size: 8, font: reg, color: BLACK });
  page.drawText(`Awarding Authority: ${data.project.ohAwardingAuthority}  County: ${data.project.county}`, { x: col2, y, size: 8, font: reg, color: BLACK });
  y -= 14;
  page.drawText(`Payroll No: ${data.week.payrollNumber}  Week Ending: ${isoToDisplay(data.week.weekEndingDate)}`, { x: MARGIN, y, size: 8, font: bold, color: BLACK });
}

async function drawTableHeader(page: PDFPage, bold: PDFFont, y: number): Promise<void> {
  page.drawRectangle({ x: MARGIN, y: y - 16, width: CONTENT_W, height: 16, color: NAVY });
  const cols = [
    { label: 'Worker / Classification', x: MARGIN + 2 },
    { label: 'M', x: MARGIN + 114 },
    { label: 'Tu', x: MARGIN + 136 },
    { label: 'W', x: MARGIN + 158 },
    { label: 'Th', x: MARGIN + 180 },
    { label: 'F', x: MARGIN + 202 },
    { label: 'Sa', x: MARGIN + 224 },
    { label: 'Su', x: MARGIN + 246 },
    { label: 'ST', x: MARGIN + 270 },
    { label: 'OT', x: MARGIN + 292 },
    { label: 'Base', x: MARGIN + 316 },
    { label: 'Gross', x: MARGIN + 354 },
    { label: 'Deduct', x: MARGIN + 396 },
    { label: 'Net', x: MARGIN + 440 },
  ];
  for (const col of cols) {
    page.drawText(col.label, { x: col.x, y: y - 12, size: 7, font: bold, color: WHITE });
  }
}

async function drawWorkerRow(page: PDFPage, reg: PDFFont, y: number, entry: OhPwc28Input['entries'][0], idx: number): Promise<void> {
  const bg = idx % 2 === 0 ? WHITE : LIGHT_GRAY;
  page.drawRectangle({ x: MARGIN, y: y - 24, width: CONTENT_W, height: 24, color: bg });
  const totalSt = entry.monSt + entry.tueSt + entry.wedSt + entry.thuSt + entry.friSt + entry.satSt + entry.sunSt;
  const totalOt = entry.monOt + entry.tueOt + entry.wedOt + entry.thuOt + entry.friOt + entry.satOt + entry.sunOt;
  const totalDeduct = entry.ficaTax + entry.fitWithheld + entry.stateWithheld + entry.otherDeductions;
  const ssn = entry.workerSsnLast4 ? `***-**-${entry.workerSsnLast4}` : '';
  page.drawText(`${entry.workerName}  ${ssn}`, { x: MARGIN + 2, y: y - 10, size: 7, font: reg, color: BLACK });
  page.drawText(`${entry.classification}${entry.isApprentice ? ' (App)' : ''}`, { x: MARGIN + 2, y: y - 20, size: 6, font: reg, color: BLACK });
  [entry.monSt, entry.tueSt, entry.wedSt, entry.thuSt, entry.friSt, entry.satSt, entry.sunSt, totalSt, totalOt].forEach((h, i) => {
    page.drawText(h > 0 ? String(h) : '\u2014', { x: MARGIN + 114 + i * 22, y: y - 14, size: 7, font: reg, color: BLACK });
  });
  page.drawText(`$${fmt(entry.baseRate)}`, { x: MARGIN + 316, y: y - 14, size: 7, font: reg, color: BLACK });
  page.drawText(`$${fmt(entry.grossWages)}`, { x: MARGIN + 354, y: y - 14, size: 7, font: reg, color: BLACK });
  page.drawText(`$${fmt(totalDeduct)}`, { x: MARGIN + 396, y: y - 14, size: 7, font: reg, color: BLACK });
  page.drawText(`$${fmt(entry.netPay)}`, { x: MARGIN + 440, y: y - 14, size: 7, font: reg, color: BLACK });
}

async function drawCompliancePage(doc: PDFDocument, bold: PDFFont, reg: PDFFont, data: OhPwc28Input): Promise<void> {
  const page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  page.drawRectangle({ x: MARGIN, y: y - 28, width: CONTENT_W, height: 28, color: NAVY });
  page.drawText('STATEMENT OF COMPLIANCE \u2014 Ohio Prevailing Wage Law (ORC Chapter 4115)', {
    x: MARGIN + 8, y: y - 20, size: 9, font: bold, color: WHITE,
  });
  y -= 50;
  const lines = [
    'I, the undersigned, do hereby certify under penalty of law that:',
    '',
    '(1) The payroll is correct and complete; wage rates paid to each worker are not less than',
    '    the applicable prevailing wage rate required under ORC \u00a7 4115.07;',
    '',
    '(2) Each laborer or mechanic has been paid not less than the applicable prevailing wage',
    '    rate for the classification of work actually performed;',
    '',
    '(3) All deductions shown are authorized under applicable law or written agreement.',
  ];
  for (const line of lines) {
    page.drawText(line, { x: MARGIN, y, size: 8, font: reg, color: BLACK });
    y -= 14;
  }
  y -= 30;
  page.drawText('Signature: _______________________________', { x: MARGIN, y, size: 9, font: reg, color: BLACK });
  page.drawText(`Date: ${isoToDisplay(data.compliance.signatureDate)}`, { x: MARGIN + 280, y, size: 9, font: reg, color: BLACK });
  y -= 20;
  page.drawText(`Printed Name: ${data.compliance.certifierName}`, { x: MARGIN, y, size: 9, font: reg, color: BLACK });
  page.drawText(`Title: ${data.compliance.certifierTitle}`, { x: MARGIN + 280, y, size: 9, font: reg, color: BLACK });
}

export async function fillOhPwc28(data: OhPwc28Input): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`OH Certified Payroll \u2014 ${OH_PWC28_FORM_VERSION}`);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);

  const page1 = doc.addPage([PAGE_W, PAGE_H]);
  await drawHeader(page1, bold, reg, data);

  let currentPage = page1;
  let y = PAGE_H - MARGIN - 110;
  await drawTableHeader(currentPage, bold, y);
  y -= 20;

  for (let i = 0; i < data.entries.length; i++) {
    if (y - 30 < MARGIN + 40) {
      currentPage = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
      await drawTableHeader(currentPage, bold, y);
      y -= 20;
    }
    await drawWorkerRow(currentPage, reg, y, data.entries[i], i);
    y -= 26;
  }

  await drawCompliancePage(doc, bold, reg, data);
  return doc.save();
}
