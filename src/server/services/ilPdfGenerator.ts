// src/server/services/ilPdfGenerator.ts
//
// IL Certified Transcript of Payroll PDF generator using pdf-lib programmatic drawing.
//
// Unlike WH-347 which overlays a template, this form is drawn entirely from
// scratch using PDFDocument.create() — Illinois does not provide a state PDF template.
//
// Coordinate system: pdf-lib uses PDF origin at BOTTOM-LEFT.
//   Page dimensions: 612 × 792 pt (letter portrait — 8.5" × 11")
//   Content area: x = MARGIN (36) to PAGE_WIDTH - MARGIN (576)
//
// Form structure:
//   Page 1: Header block + worker table (PW hours, non-PW weekly total, fringes, pay)
//   Page 2 (ALWAYS dedicated): Statement of Compliance / Affidavit

import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from 'pdf-lib';

// ── Layout constants ────────────────────────────────────────────────────────

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

// ── Type definitions ────────────────────────────────────────────────────────

export interface IlPdfInput {
  contractor: {
    name: string;
    address: string;
    fein: string;
  };
  project: {
    name: string;
    number: string;          // IL project/contract number
    location: string;        // project location/address
    contractingAgency: string; // e.g., IDOT, City of Chicago
  };
  week: {
    weekEndingDate: string;  // ISO YYYY-MM-DD
    payrollNumber: string;   // e.g., "1" or "5 (AMENDED 1)"
  };
  entries: Array<{
    workerName: string;
    workerSsnLast4: string | null;
    workerAddress: string;
    classification: string;
    // PW hours Mon–Sun (IL form distinguishes PW vs non-PW, not ST vs OT)
    monPw: number; tuePw: number; wedPw: number; thuPw: number;
    friPw: number; satPw: number; sunPw: number;
    // Non-PW hours Mon–Sun (stored as daily splits; show only weekly total per Pitfall 2)
    monNonPw: number; tueNonPw: number; wedNonPw: number; thuNonPw: number;
    friNonPw: number; satNonPw: number; sunNonPw: number;
    totalPwHours: number;
    totalNonPwHours: number;
    baseRate: number;
    // Fringe hourly rates — each with F flag (true = jointly-managed LMRA fund)
    fringePension: number | null;
    fringePensionIsF: boolean;
    fringeHealthWelfare: number | null;
    fringeHealthWelfareIsF: boolean;
    fringeVacation: number | null;
    fringeVacationIsF: boolean;
    fringeTraining: number | null;
    fringeTrainingIsF: boolean;
    grossPay: number | null;
    deductions: number | null;
    netPay: number | null;
  }>;
  // Page 2 affidavit fields
  affidavit: {
    subcontractors: Array<{ name: string; address: string }>;
    fundDetails: Array<{
      fringeType: string;
      fundName: string;
      fundAdminAddress: string;
      employeeContributionRate: string;
    }>;
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtDollar(n: number | null): string {
  if (n === null || n === undefined) return '';
  return n.toFixed(2);
}

function fmtHours(n: number): string {
  return n > 0 ? String(n) : '';
}

function fmtFringe(value: number | null, isF: boolean): string {
  if (value === null || value === undefined) return '';
  const base = value.toFixed(2);
  return isF ? `${base}F` : base;
}

// ── Drawing context passed around to avoid repetitive parameters ─────────────

interface DrawCtx {
  pdfDoc: PDFDocument;
  font: PDFFont;
  boldFont: PDFFont;
  black: ReturnType<typeof rgb>;
}

// ── Add a fresh letter-portrait page ────────────────────────────────────────

function addPage(pdfDoc: PDFDocument): PDFPage {
  return pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
}

// ── Column positions for the IL worker table ────────────────────────────────

const IL_COL = {
  nameSSN:    MARGIN,           // width ~90: "Name / SSN-last4"
  address:    MARGIN + 92,      // width ~70: "Address"
  class:      MARGIN + 164,     // width ~60: "Classification"
  monPw:      MARGIN + 226,     // PW hours Mon–Sun (7 cols, ~16pt each)
  tuePw:      MARGIN + 242,
  wedPw:      MARGIN + 258,
  thuPw:      MARGIN + 274,
  friPw:      MARGIN + 290,
  satPw:      MARGIN + 306,
  sunPw:      MARGIN + 322,
  totalPw:    MARGIN + 338,     // total PW hrs
  totalNonPw: MARGIN + 356,     // total non-PW hrs (weekly total only)
  baseRate:   MARGIN + 374,     // base rate $
  pension:    MARGIN + 396,     // "$X.XX" or "$X.XXF"
  hw:         MARGIN + 418,     // health & welfare
  vac:        MARGIN + 440,     // vacation
  training:   MARGIN + 462,     // training
  gross:      MARGIN + 484,     // gross pay
  ded:        MARGIN + 506,     // deductions
  net:        MARGIN + 525,     // net pay
} as const;

// ── Draw header section on a page (returns y position after header) ──────────

function drawHeader(
  page: PDFPage,
  data: IlPdfInput,
  ctx: DrawCtx,
): number {
  const { font, boldFont, black } = ctx;
  let y = PAGE_HEIGHT - MARGIN;

  // Bold centered title
  const titleText = 'ILLINOIS CERTIFIED TRANSCRIPT OF PAYROLL';
  const titleSize = 10;
  const titleWidth = boldFont.widthOfTextAtSize(titleText, titleSize);
  page.drawText(titleText, {
    x: (PAGE_WIDTH - titleWidth) / 2,
    y,
    size: titleSize,
    font: boldFont,
    color: black,
  });
  y -= 14;

  // Horizontal rule under title
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1,
    color: black,
  });
  y -= 12;

  const labelSize = 7;
  const valueSize = 8;

  // Line 2: Contractor name | FEIN
  page.drawText('Contractor:', { x: MARGIN, y, size: labelSize, font, color: black });
  page.drawText(data.contractor.name, { x: MARGIN + 60, y, size: valueSize, font: boldFont, color: black, maxWidth: 200 });
  page.drawText('FEIN:', { x: 330, y, size: labelSize, font, color: black });
  page.drawText(data.contractor.fein, { x: 360, y, size: valueSize, font, color: black, maxWidth: 150 });
  y -= 12;

  // Line 3: Address | Week Ending
  page.drawText('Address:', { x: MARGIN, y, size: labelSize, font, color: black });
  page.drawText(data.contractor.address, { x: MARGIN + 60, y, size: valueSize, font, color: black, maxWidth: 200 });
  page.drawText('Week Ending:', { x: 330, y, size: labelSize, font, color: black });
  page.drawText(data.week.weekEndingDate, { x: 400, y, size: valueSize, font, color: black, maxWidth: 110 });
  y -= 12;

  // Line 4: Project name | Payroll No
  page.drawText('Project:', { x: MARGIN, y, size: labelSize, font, color: black });
  page.drawText(data.project.name, { x: MARGIN + 60, y, size: valueSize, font, color: black, maxWidth: 200 });
  page.drawText('Payroll No:', { x: 330, y, size: labelSize, font, color: black });
  page.drawText(data.week.payrollNumber, { x: 400, y, size: valueSize, font, color: black, maxWidth: 110 });
  y -= 12;

  // Line 5: Project Number | Location
  page.drawText('Project No:', { x: MARGIN, y, size: labelSize, font, color: black });
  page.drawText(data.project.number, { x: MARGIN + 60, y, size: valueSize, font, color: black, maxWidth: 200 });
  page.drawText('Location:', { x: 330, y, size: labelSize, font, color: black });
  page.drawText(data.project.location, { x: 380, y, size: valueSize, font, color: black, maxWidth: 130 });
  y -= 12;

  // Line 6: Contracting Agency (full width)
  page.drawText('Contracting Agency:', { x: MARGIN, y, size: labelSize, font, color: black });
  page.drawText(data.project.contractingAgency, { x: MARGIN + 100, y, size: valueSize, font, color: black, maxWidth: 400 });
  y -= 10;

  // Horizontal rule below header
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.5,
    color: black,
  });
  y -= 8;

  return y;
}

// ── Draw column headers for the IL worker table ──────────────────────────────

function drawTableHeaders(page: PDFPage, y: number, ctx: DrawCtx): number {
  const { boldFont, black } = ctx;
  const hSize = 6;

  page.drawText('Name / SSN',      { x: IL_COL.nameSSN,    y, size: hSize, font: boldFont, color: black, maxWidth: 90 });
  page.drawText('Address',         { x: IL_COL.address,    y, size: hSize, font: boldFont, color: black, maxWidth: 70 });
  page.drawText('Class',           { x: IL_COL.class,      y, size: hSize, font: boldFont, color: black, maxWidth: 60 });
  page.drawText('Mo',              { x: IL_COL.monPw,      y, size: hSize, font: boldFont, color: black, maxWidth: 14 });
  page.drawText('Tu',              { x: IL_COL.tuePw,      y, size: hSize, font: boldFont, color: black, maxWidth: 14 });
  page.drawText('We',              { x: IL_COL.wedPw,      y, size: hSize, font: boldFont, color: black, maxWidth: 14 });
  page.drawText('Th',              { x: IL_COL.thuPw,      y, size: hSize, font: boldFont, color: black, maxWidth: 14 });
  page.drawText('Fr',              { x: IL_COL.friPw,      y, size: hSize, font: boldFont, color: black, maxWidth: 14 });
  page.drawText('Sa',              { x: IL_COL.satPw,      y, size: hSize, font: boldFont, color: black, maxWidth: 14 });
  page.drawText('Su',              { x: IL_COL.sunPw,      y, size: hSize, font: boldFont, color: black, maxWidth: 14 });
  page.drawText('PW',              { x: IL_COL.totalPw,    y, size: hSize, font: boldFont, color: black, maxWidth: 16 });
  page.drawText('NPW',             { x: IL_COL.totalNonPw, y, size: hSize, font: boldFont, color: black, maxWidth: 16 });
  page.drawText('Base',            { x: IL_COL.baseRate,   y, size: hSize, font: boldFont, color: black, maxWidth: 20 });
  page.drawText('Pen',             { x: IL_COL.pension,    y, size: hSize, font: boldFont, color: black, maxWidth: 20 });
  page.drawText('H&W',             { x: IL_COL.hw,         y, size: hSize, font: boldFont, color: black, maxWidth: 20 });
  page.drawText('Vac',             { x: IL_COL.vac,        y, size: hSize, font: boldFont, color: black, maxWidth: 20 });
  page.drawText('Trn',             { x: IL_COL.training,   y, size: hSize, font: boldFont, color: black, maxWidth: 20 });
  page.drawText('Gross',           { x: IL_COL.gross,      y, size: hSize, font: boldFont, color: black, maxWidth: 20 });
  page.drawText('Ded',             { x: IL_COL.ded,        y, size: hSize, font: boldFont, color: black, maxWidth: 18 });
  page.drawText('Net',             { x: IL_COL.net,        y, size: hSize, font: boldFont, color: black, maxWidth: 40 });

  y -= 3;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.5,
    color: black,
  });
  y -= 8;

  return y;
}

// ── Draw a single worker entry (two rows: PW row and Non-PW row) ─────────────

function drawWorkerRow(
  page: PDFPage,
  entry: IlPdfInput['entries'][number],
  y: number,
  ctx: DrawCtx,
): number {
  const { font, boldFont, black } = ctx;
  const rowSize = 6;

  // ── PW row ──
  const ssnDisplay = entry.workerSsnLast4 ? `XXX-XX-${entry.workerSsnLast4}` : '';
  const nameSSN = entry.workerName + (ssnDisplay ? ` ${ssnDisplay}` : '');

  page.drawText(nameSSN,             { x: IL_COL.nameSSN,    y, size: rowSize, font: boldFont, color: black, maxWidth: 90 });
  page.drawText(entry.workerAddress, { x: IL_COL.address,    y, size: rowSize, font, color: black, maxWidth: 70 });
  page.drawText(entry.classification,{ x: IL_COL.class,      y, size: rowSize, font, color: black, maxWidth: 60 });

  page.drawText(fmtHours(entry.monPw), { x: IL_COL.monPw,  y, size: rowSize, font, color: black, maxWidth: 14 });
  page.drawText(fmtHours(entry.tuePw), { x: IL_COL.tuePw,  y, size: rowSize, font, color: black, maxWidth: 14 });
  page.drawText(fmtHours(entry.wedPw), { x: IL_COL.wedPw,  y, size: rowSize, font, color: black, maxWidth: 14 });
  page.drawText(fmtHours(entry.thuPw), { x: IL_COL.thuPw,  y, size: rowSize, font, color: black, maxWidth: 14 });
  page.drawText(fmtHours(entry.friPw), { x: IL_COL.friPw,  y, size: rowSize, font, color: black, maxWidth: 14 });
  page.drawText(fmtHours(entry.satPw), { x: IL_COL.satPw,  y, size: rowSize, font, color: black, maxWidth: 14 });
  page.drawText(fmtHours(entry.sunPw), { x: IL_COL.sunPw,  y, size: rowSize, font, color: black, maxWidth: 14 });

  page.drawText(String(entry.totalPwHours),                       { x: IL_COL.totalPw,    y, size: rowSize, font, color: black, maxWidth: 16 });
  // Non-PW hours shown as weekly total only (Pitfall 2: no fabricated daily splits)
  page.drawText(entry.totalNonPwHours > 0 ? String(entry.totalNonPwHours) : '', { x: IL_COL.totalNonPw, y, size: rowSize, font, color: black, maxWidth: 16 });
  page.drawText(fmtDollar(entry.baseRate),                        { x: IL_COL.baseRate,   y, size: rowSize, font, color: black, maxWidth: 20 });
  page.drawText(fmtFringe(entry.fringePension, entry.fringePensionIsF),             { x: IL_COL.pension,  y, size: rowSize, font, color: black, maxWidth: 20 });
  page.drawText(fmtFringe(entry.fringeHealthWelfare, entry.fringeHealthWelfareIsF), { x: IL_COL.hw,       y, size: rowSize, font, color: black, maxWidth: 20 });
  page.drawText(fmtFringe(entry.fringeVacation, entry.fringeVacationIsF),           { x: IL_COL.vac,      y, size: rowSize, font, color: black, maxWidth: 20 });
  page.drawText(fmtFringe(entry.fringeTraining, entry.fringeTrainingIsF),           { x: IL_COL.training, y, size: rowSize, font, color: black, maxWidth: 20 });
  page.drawText(fmtDollar(entry.grossPay),                        { x: IL_COL.gross,      y, size: rowSize, font, color: black, maxWidth: 20 });
  page.drawText(fmtDollar(entry.deductions),                      { x: IL_COL.ded,        y, size: rowSize, font, color: black, maxWidth: 18 });
  page.drawText(fmtDollar(entry.netPay),                          { x: IL_COL.net,        y, size: rowSize, font, color: black, maxWidth: 40 });

  y -= 10;

  // ── Non-PW row — show "Non-PW" label; daily cells blank (weekly total shown above) ──
  page.drawText('Non-PW', { x: IL_COL.nameSSN, y, size: rowSize, font, color: black, maxWidth: 90 });
  // All daily non-PW cells are blank per Pitfall 2 constraint

  y -= 6;

  // Thin separator after each worker
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.25,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 6;

  return y;
}

// ── Draw Statement of Compliance / Affidavit (always page 2) ─────────────────

function drawAffidavit(
  page: PDFPage,
  data: IlPdfInput,
  ctx: DrawCtx,
): void {
  const { font, boldFont, black } = ctx;
  let y = PAGE_HEIGHT - MARGIN;

  // Heading
  page.drawText('STATEMENT OF COMPLIANCE / AFFIDAVIT', {
    x: MARGIN,
    y,
    size: 9,
    font: boldFont,
    color: black,
    maxWidth: CONTENT_WIDTH,
  });
  y -= 14;

  // Horizontal rule below heading
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1,
    color: black,
  });
  y -= 12;

  // Preamble
  const preamble =
    'The undersigned contractor or subcontractor executing this certified transcript of payroll affirms, under penalty of perjury, that the information provided is correct and complete, and that workers have been paid no less than the applicable prevailing wage rates and fringe benefits as required by 820 ILCS 130 (Illinois Prevailing Wage Act).';
  page.drawText(preamble, {
    x: MARGIN,
    y,
    size: 7,
    font,
    color: black,
    maxWidth: CONTENT_WIDTH,
    lineHeight: 10,
  });
  y -= 44;

  // ── Subcontractor List ───────────────────────────────────────────────────

  page.drawText('SUBCONTRACTOR LIST', {
    x: MARGIN,
    y,
    size: 8,
    font: boldFont,
    color: black,
    maxWidth: CONTENT_WIDTH,
  });
  y -= 12;

  if (data.affidavit.subcontractors.length === 0) {
    page.drawText('None', { x: MARGIN, y, size: 7, font, color: black, maxWidth: CONTENT_WIDTH });
    y -= 12;
  } else {
    for (const sub of data.affidavit.subcontractors) {
      page.drawText(`${sub.name} — ${sub.address}`, {
        x: MARGIN,
        y,
        size: 7,
        font,
        color: black,
        maxWidth: CONTENT_WIDTH,
      });
      y -= 10;
    }
  }

  y -= 6;

  // ── Fund Details ──────────────────────────────────────────────────────────

  page.drawText('FUND DETAILS', {
    x: MARGIN,
    y,
    size: 8,
    font: boldFont,
    color: black,
    maxWidth: CONTENT_WIDTH,
  });
  y -= 12;

  if (data.affidavit.fundDetails.length === 0) {
    page.drawText(
      'N/A \u2014 all fringe benefits paid as cash in lieu of fund contributions.',
      { x: MARGIN, y, size: 7, font, color: black, maxWidth: CONTENT_WIDTH },
    );
    y -= 10;
    page.drawText(
      'F = Payment to jointly-managed LMRA fund (verify with contractor records).',
      { x: MARGIN, y, size: 7, font, color: black, maxWidth: CONTENT_WIDTH },
    );
    y -= 12;
  } else {
    for (const fd of data.affidavit.fundDetails) {
      page.drawText(
        `${fd.fringeType}: ${fd.fundName} — ${fd.fundAdminAddress} — ${fd.employeeContributionRate}`,
        { x: MARGIN, y, size: 7, font, color: black, maxWidth: CONTENT_WIDTH },
      );
      y -= 10;
    }
    y -= 6;
    page.drawText(
      'F = Payment to jointly-managed LMRA fund (verify with contractor records).',
      { x: MARGIN, y, size: 7, font, color: black, maxWidth: CONTENT_WIDTH },
    );
    y -= 12;
  }

  y -= 20;

  // ── Signature Block ───────────────────────────────────────────────────────

  // Signature line
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: MARGIN + 200, y },
    thickness: 0.5,
    color: black,
  });
  page.drawText('Signature of Authorized Agent', {
    x: MARGIN,
    y: y - 10,
    size: 7,
    font,
    color: black,
    maxWidth: 200,
  });

  // Title line
  page.drawLine({
    start: { x: MARGIN + 220, y },
    end: { x: MARGIN + 340, y },
    thickness: 0.5,
    color: black,
  });
  page.drawText('Title', {
    x: MARGIN + 220,
    y: y - 10,
    size: 7,
    font,
    color: black,
    maxWidth: 120,
  });

  // Date line
  page.drawLine({
    start: { x: MARGIN + 360, y },
    end: { x: MARGIN + 460, y },
    thickness: 0.5,
    color: black,
  });
  page.drawText('Date', {
    x: MARGIN + 360,
    y: y - 10,
    size: 7,
    font,
    color: black,
    maxWidth: 100,
  });
}

// ── Main export ─────────────────────────────────────────────────────────────

export async function fillIlCertifiedTranscript(data: IlPdfInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0);

  const ctx: DrawCtx = { pdfDoc, font, boldFont, black };

  // ── Page 1: Header + Worker Table ─────────────────────────────────────────

  let page = addPage(pdfDoc);
  let y = drawHeader(page, data, ctx);
  y = drawTableHeaders(page, y, ctx);

  for (const entry of data.entries) {
    // Each worker block is ~22pt; need space + room to not crowd the bottom
    if (y < 150) {
      page = addPage(pdfDoc);
      y = drawHeader(page, data, ctx);
      y = drawTableHeaders(page, y, ctx);
    }
    y = drawWorkerRow(page, entry, y, ctx);
  }

  // ── Page 2: Affidavit (ALWAYS a dedicated page — Pitfall 6) ───────────────
  // Even if page 1 has space, the affidavit goes on its own page.

  const affidavitPage = addPage(pdfDoc);
  drawAffidavit(affidavitPage, data, ctx);

  return pdfDoc.save();
}
