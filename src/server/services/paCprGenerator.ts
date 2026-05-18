// src/server/services/paCprGenerator.ts
//
// Pennsylvania PA-CPR Certified Payroll PDF generator (pdf-lib programmatic drawing).
// Authority: PA Prevailing Wage Act, 43 P.S. § 165-1 et seq.
// Form: PA-CPR Rev. 2024 — drawn from scratch (no fillable template).
//
// Layout: letter portrait 612 × 792 pt, MARGIN 36, origin BOTTOM-LEFT.
// Pages: 1 (header + worker table, overflow to additional pages) + compliance page (always last).

import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from 'pdf-lib';

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 36;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const NAVY = rgb(0.08, 0.20, 0.42);
const WHITE = rgb(1, 1, 1);
const LIGHT_GRAY = rgb(0.94, 0.94, 0.94);
const BLACK = rgb(0, 0, 0);

export const PA_CPR_FORM_VERSION = 'PA-CPR Rev. 2024';

export interface PaCprInput {
  contractor: {
    name: string;
    fein: string;
    address: string;
    paContractorLicense: string | null;
  };
  project: {
    name: string;
    paContractId: string | null;
    county: string;
    awardingAuthority: string;
  };
  week: {
    weekEndingDate: string;  // ISO YYYY-MM-DD
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
    signatureDate: string;  // ISO YYYY-MM-DD
  };
}

function fmt(n: number): string {
  return n.toFixed(2);
}

function isoToDisplay(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
}

async function drawHeader(page: PDFPage, bold: PDFFont, reg: PDFFont, data: PaCprInput): Promise<void> {
  const { contractor, project, week } = data;
  let y = PAGE_H - MARGIN;

  // Title bar
  page.drawRectangle({ x: MARGIN, y: y - 28, width: CONTENT_W, height: 28, color: NAVY });
  page.drawText('PENNSYLVANIA CERTIFIED PAYROLL RECORD', {
    x: MARGIN + 8, y: y - 20, size: 11, font: bold, color: WHITE,
  });
  page.drawText(PA_CPR_FORM_VERSION, {
    x: MARGIN + CONTENT_W - 120, y: y - 20, size: 8, font: reg, color: WHITE,
  });
  y -= 36;

  // Contractor / project row
  const col2 = MARGIN + CONTENT_W / 2;
  page.drawText(`Contractor: ${contractor.name}`, { x: MARGIN, y, size: 8, font: bold, color: BLACK });
  page.drawText(`Project: ${project.name}`, { x: col2, y, size: 8, font: bold, color: BLACK });
  y -= 14;
  page.drawText(`Address: ${contractor.address}`, { x: MARGIN, y, size: 8, font: reg, color: BLACK });
  page.drawText(`Contract No: ${project.paContractId ?? '\u2014'}`, { x: col2, y, size: 8, font: reg, color: BLACK });
  y -= 14;
  page.drawText(`FEIN: ${contractor.fein}  License: ${contractor.paContractorLicense ?? '\u2014'}`, { x: MARGIN, y, size: 8, font: reg, color: BLACK });
  page.drawText(`County: ${project.county}  Awarding Authority: ${project.awardingAuthority}`, { x: col2, y, size: 8, font: reg, color: BLACK });
  y -= 14;
  page.drawText(`Payroll No: ${week.payrollNumber}  Week Ending: ${isoToDisplay(week.weekEndingDate)}`, { x: MARGIN, y, size: 8, font: bold, color: BLACK });
}

async function drawTableHeader(page: PDFPage, bold: PDFFont, y: number): Promise<void> {
  page.drawRectangle({ x: MARGIN, y: y - 16, width: CONTENT_W, height: 16, color: NAVY });
  const cols = [
    { label: 'Worker / Classification', x: MARGIN + 2, w: 110 },
    { label: 'M', x: MARGIN + 114, w: 22 },
    { label: 'Tu', x: MARGIN + 136, w: 22 },
    { label: 'W', x: MARGIN + 158, w: 22 },
    { label: 'Th', x: MARGIN + 180, w: 22 },
    { label: 'F', x: MARGIN + 202, w: 22 },
    { label: 'Sa', x: MARGIN + 224, w: 22 },
    { label: 'Su', x: MARGIN + 246, w: 22 },
    { label: 'ST', x: MARGIN + 270, w: 22 },
    { label: 'OT', x: MARGIN + 292, w: 22 },
    { label: 'Base', x: MARGIN + 316, w: 36 },
    { label: 'Gross', x: MARGIN + 354, w: 40 },
    { label: 'Deduct', x: MARGIN + 396, w: 42 },
    { label: 'Net', x: MARGIN + 440, w: 36 },
  ];
  for (const col of cols) {
    page.drawText(col.label, { x: col.x, y: y - 12, size: 7, font: bold, color: WHITE });
  }
}

async function drawWorkerRow(
  page: PDFPage,
  reg: PDFFont,
  y: number,
  entry: PaCprInput['entries'][0],
  idx: number,
): Promise<void> {
  const bg = idx % 2 === 0 ? WHITE : LIGHT_GRAY;
  page.drawRectangle({ x: MARGIN, y: y - 24, width: CONTENT_W, height: 24, color: bg });

  const totalSt = entry.monSt + entry.tueSt + entry.wedSt + entry.thuSt + entry.friSt + entry.satSt + entry.sunSt;
  const totalOt = entry.monOt + entry.tueOt + entry.wedOt + entry.thuOt + entry.friOt + entry.satOt + entry.sunOt;
  const totalDeduct = entry.ficaTax + entry.fitWithheld + entry.stateWithheld + entry.otherDeductions;
  const ssnDisplay = entry.workerSsnLast4 ? `***-**-${entry.workerSsnLast4}` : '';

  page.drawText(`${entry.workerName}  ${ssnDisplay}`, { x: MARGIN + 2, y: y - 10, size: 7, font: reg, color: BLACK });
  page.drawText(`${entry.classification}${entry.isApprentice ? ' (App)' : ''}`, { x: MARGIN + 2, y: y - 20, size: 6, font: reg, color: BLACK });

  const hours = [entry.monSt, entry.tueSt, entry.wedSt, entry.thuSt, entry.friSt, entry.satSt, entry.sunSt, totalSt, totalOt];
  const hxBase = MARGIN + 114;
  hours.forEach((h, i) => {
    page.drawText(h > 0 ? String(h) : '\u2014', { x: hxBase + i * 22, y: y - 14, size: 7, font: reg, color: BLACK });
  });

  page.drawText(`$${fmt(entry.baseRate)}`, { x: MARGIN + 316, y: y - 14, size: 7, font: reg, color: BLACK });
  page.drawText(`$${fmt(entry.grossWages)}`, { x: MARGIN + 354, y: y - 14, size: 7, font: reg, color: BLACK });
  page.drawText(`$${fmt(totalDeduct)}`, { x: MARGIN + 396, y: y - 14, size: 7, font: reg, color: BLACK });
  page.drawText(`$${fmt(entry.netPay)}`, { x: MARGIN + 440, y: y - 14, size: 7, font: reg, color: BLACK });
}

async function drawCompliancePage(doc: PDFDocument, bold: PDFFont, reg: PDFFont, data: PaCprInput): Promise<void> {
  const page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  page.drawRectangle({ x: MARGIN, y: y - 28, width: CONTENT_W, height: 28, color: NAVY });
  page.drawText('STATEMENT OF COMPLIANCE \u2014 Pennsylvania Prevailing Wage Act (43 P.S. \u00a7 165-1)', {
    x: MARGIN + 8, y: y - 20, size: 9, font: bold, color: WHITE,
  });
  y -= 50;

  const text = [
    'I, the undersigned, do hereby state:',
    '',
    '(1) That the payroll is correct and complete; that the wage rates paid to each worker are not',
    '    less than the applicable prevailing wage rate required under the Pennsylvania Prevailing',
    '    Wage Act, 43 P.S. \u00a7 165-1 et seq.;',
    '',
    '(2) That each worker has been paid not less than the applicable prevailing wage rate and',
    '    fringe benefits for the classification of work actually performed;',
    '',
    '(3) That all deductions from wages shown are authorized under law or by written agreement',
    '    signed by the employee.',
  ];

  for (const line of text) {
    page.drawText(line, { x: MARGIN, y, size: 8, font: reg, color: BLACK });
    y -= 14;
  }

  y -= 30;
  page.drawText(`Signature: _______________________________`, { x: MARGIN, y, size: 9, font: reg, color: BLACK });
  page.drawText(`Date: ${isoToDisplay(data.compliance.signatureDate)}`, { x: MARGIN + 280, y, size: 9, font: reg, color: BLACK });
  y -= 20;
  page.drawText(`Printed Name: ${data.compliance.certifierName}`, { x: MARGIN, y, size: 9, font: reg, color: BLACK });
  page.drawText(`Title: ${data.compliance.certifierTitle}`, { x: MARGIN + 280, y, size: 9, font: reg, color: BLACK });
}

export async function fillPaCpr(data: PaCprInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`PA Certified Payroll \u2014 ${PA_CPR_FORM_VERSION}`);

  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);

  const page1 = doc.addPage([PAGE_W, PAGE_H]);
  await drawHeader(page1, bold, reg, data);

  let currentPage = page1;
  let y = PAGE_H - MARGIN - 110; // below header
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
