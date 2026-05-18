// src/server/services/pw12Generator.ts
//
// NY PW-12 Weekly Payroll PDF generator using pdf-lib programmatic drawing.
//
// Unlike WH-347 which overlays a template, PW-12 is drawn entirely from
// scratch using PDFDocument.create() — no fillable template exists.
//
// Coordinate system: pdf-lib uses PDF origin at BOTTOM-LEFT.
//   Page dimensions: 612 × 792 pt (letter portrait — 8.5" × 11")
//   Content area: x = MARGIN (36) to PAGE_WIDTH - MARGIN (576)

import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from 'pdf-lib';

// ── Layout constants ────────────────────────────────────────────────────────

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

// ── Type definitions ────────────────────────────────────────────────────────

export interface Pw12Input {
  contractor: { name: string; fein: string; address: string };
  week: { weekEndingDate: string; payrollNumber: string };
  project: { name: string; nyprcNumber: string; county: string };
  entries: Array<{
    workerName: string;
    workerSsnLast4: string | null;
    tradeDescription: string;
    laborType: string;
    monSt: number; monOt: number;
    tueSt: number; tueOt: number;
    wedSt: number; wedOt: number;
    thuSt: number; thuOt: number;
    friSt: number; friOt: number;
    satSt: number; satOt: number;
    sunSt: number; sunOt: number;
    totalStHours: number;
    totalOtHours: number;
    baseRateSnapshot: number;
    grossWages: number | null;
    deductions: number | null;
    netPay: number | null;
    fringeHealthWelfare: number | null;
    fringePension: number | null;
    fringeVacation: number | null;
    fringeTraining: number | null;
  }>;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtDollar(n: number | null): string {
  if (n === null || n === undefined) return '';
  return n.toFixed(2);
}

function fmtHours(n: number): string {
  return n > 0 ? String(n) : '';
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

// ── Draw header section on a page (returns y position after header) ───────────

function drawHeader(
  page: PDFPage,
  data: Pw12Input,
  ctx: DrawCtx,
): number {
  const { font, boldFont, black } = ctx;
  let y = PAGE_HEIGHT - MARGIN; // Start near top

  // Bold centered title
  const titleText = 'NEW YORK STATE — WEEKLY PAYROLL (PW-12)';
  const titleSize = 11;
  const titleWidth = boldFont.widthOfTextAtSize(titleText, titleSize);
  page.drawText(titleText, {
    x: (PAGE_WIDTH - titleWidth) / 2,
    y,
    size: titleSize,
    font: boldFont,
    color: black,
  });
  y -= 16;

  // Subtitle
  const subtitleText = 'CERTIFIED PAYROLL REPORT';
  const subtitleSize = 9;
  const subtitleWidth = font.widthOfTextAtSize(subtitleText, subtitleSize);
  page.drawText(subtitleText, {
    x: (PAGE_WIDTH - subtitleWidth) / 2,
    y,
    size: subtitleSize,
    font,
    color: black,
  });
  y -= 14;

  // Horizontal rule under titles
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1,
    color: black,
  });
  y -= 12;

  // Contractor fields: left column
  const labelSize = 7;
  const valueSize = 8;

  page.drawText('Contractor:', { x: MARGIN, y, size: labelSize, font, color: black });
  page.drawText(data.contractor.name, { x: MARGIN + 60, y, size: valueSize, font: boldFont, color: black, maxWidth: 200 });

  page.drawText('FEIN:', { x: 330, y, size: labelSize, font, color: black });
  page.drawText(data.contractor.fein, { x: 360, y, size: valueSize, font, color: black, maxWidth: 120 });
  y -= 12;

  page.drawText('Address:', { x: MARGIN, y, size: labelSize, font, color: black });
  page.drawText(data.contractor.address, { x: MARGIN + 60, y, size: valueSize, font, color: black, maxWidth: 200 });

  page.drawText('Week Ending:', { x: 330, y, size: labelSize, font, color: black });
  page.drawText(data.week.weekEndingDate, { x: 400, y, size: valueSize, font, color: black, maxWidth: 80 });
  y -= 12;

  page.drawText('Project:', { x: MARGIN, y, size: labelSize, font, color: black });
  page.drawText(data.project.name, { x: MARGIN + 60, y, size: valueSize, font, color: black, maxWidth: 200 });

  page.drawText('Payroll No:', { x: 330, y, size: labelSize, font, color: black });
  page.drawText(data.week.payrollNumber, { x: 400, y, size: valueSize, font, color: black, maxWidth: 80 });
  y -= 12;

  page.drawText('PRC No:', { x: MARGIN, y, size: labelSize, font, color: black });
  page.drawText(data.project.nyprcNumber, { x: MARGIN + 60, y, size: valueSize, font, color: black, maxWidth: 150 });

  page.drawText('County:', { x: 330, y, size: labelSize, font, color: black });
  page.drawText(data.project.county, { x: 380, y, size: valueSize, font, color: black, maxWidth: 120 });
  y -= 12;

  // Horizontal rule below header
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.5,
    color: black,
  });
  y -= 10;

  return y;
}

// ── Draw column headers for the worker table ────────────────────────────────

const COL = {
  nameSSN:     MARGIN,
  class:       MARGIN + 100,
  mon:         MARGIN + 185,
  tue:         MARGIN + 210,
  wed:         MARGIN + 235,
  thu:         MARGIN + 260,
  fri:         MARGIN + 285,
  sat:         MARGIN + 310,
  sun:         MARGIN + 335,
  totalHrs:    MARGIN + 355,
  rate:        MARGIN + 380,
  gross:       MARGIN + 405,
  ded:         MARGIN + 435,
  net:         MARGIN + 465,
  // BUG-06: fringe benefit columns for NY PW-12 form
  fringeHW:    MARGIN + 100,
  fringePen:   MARGIN + 145,
  fringeVac:   MARGIN + 190,
  fringeTrn:   MARGIN + 235,
} as const;

function drawTableHeaders(page: PDFPage, y: number, ctx: DrawCtx): number {
  const { boldFont, black } = ctx;
  const hSize = 6;

  page.drawText('Name / SSN',      { x: COL.nameSSN,  y, size: hSize, font: boldFont, color: black, maxWidth: 98 });
  page.drawText('Classification',  { x: COL.class,    y, size: hSize, font: boldFont, color: black, maxWidth: 83 });
  page.drawText('Mon',             { x: COL.mon,      y, size: hSize, font: boldFont, color: black });
  page.drawText('Tue',             { x: COL.tue,      y, size: hSize, font: boldFont, color: black });
  page.drawText('Wed',             { x: COL.wed,      y, size: hSize, font: boldFont, color: black });
  page.drawText('Thu',             { x: COL.thu,      y, size: hSize, font: boldFont, color: black });
  page.drawText('Fri',             { x: COL.fri,      y, size: hSize, font: boldFont, color: black });
  page.drawText('Sat',             { x: COL.sat,      y, size: hSize, font: boldFont, color: black });
  page.drawText('Sun',             { x: COL.sun,      y, size: hSize, font: boldFont, color: black });
  page.drawText('Hrs',             { x: COL.totalHrs, y, size: hSize, font: boldFont, color: black });
  page.drawText('Rate',            { x: COL.rate,     y, size: hSize, font: boldFont, color: black });
  page.drawText('Gross',           { x: COL.gross,    y, size: hSize, font: boldFont, color: black });
  page.drawText('Ded',             { x: COL.ded,      y, size: hSize, font: boldFont, color: black });
  page.drawText('Net',             { x: COL.net,      y, size: hSize, font: boldFont, color: black, maxWidth: 50 });

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

// ── Draw a single worker entry (two rows: ST and OT) ────────────────────────

function drawWorkerRow(
  page: PDFPage,
  entry: Pw12Input['entries'][number],
  y: number,
  ctx: DrawCtx,
): number {
  const { font, boldFont, black } = ctx;
  const rowSize = 7;

  // ── ST row ──
  const ssnDisplay = entry.workerSsnLast4
    ? `XXX-XX-${entry.workerSsnLast4}`
    : '';
  const nameSSN = entry.workerName + (ssnDisplay ? ` ${ssnDisplay}` : '');
  page.drawText(nameSSN, { x: COL.nameSSN, y, size: rowSize, font, color: black, maxWidth: 98 });
  page.drawText(`${entry.tradeDescription} (ST)`, { x: COL.class, y, size: rowSize, font, color: black, maxWidth: 83 });

  page.drawText(fmtHours(entry.monSt), { x: COL.mon,  y, size: rowSize, font, color: black, maxWidth: 22 });
  page.drawText(fmtHours(entry.tueSt), { x: COL.tue,  y, size: rowSize, font, color: black, maxWidth: 22 });
  page.drawText(fmtHours(entry.wedSt), { x: COL.wed,  y, size: rowSize, font, color: black, maxWidth: 22 });
  page.drawText(fmtHours(entry.thuSt), { x: COL.thu,  y, size: rowSize, font, color: black, maxWidth: 22 });
  page.drawText(fmtHours(entry.friSt), { x: COL.fri,  y, size: rowSize, font, color: black, maxWidth: 22 });
  page.drawText(fmtHours(entry.satSt), { x: COL.sat,  y, size: rowSize, font, color: black, maxWidth: 22 });
  page.drawText(fmtHours(entry.sunSt), { x: COL.sun,  y, size: rowSize, font, color: black, maxWidth: 22 });

  page.drawText(String(entry.totalStHours),          { x: COL.totalHrs, y, size: rowSize, font, color: black, maxWidth: 22 });
  page.drawText(fmtDollar(entry.baseRateSnapshot),   { x: COL.rate,     y, size: rowSize, font, color: black, maxWidth: 28 });
  page.drawText(fmtDollar(entry.grossWages),         { x: COL.gross,    y, size: rowSize, font, color: black, maxWidth: 28 });
  page.drawText(fmtDollar(entry.deductions),         { x: COL.ded,      y, size: rowSize, font, color: black, maxWidth: 28 });
  page.drawText(fmtDollar(entry.netPay),             { x: COL.net,      y, size: rowSize, font, color: black, maxWidth: 28 });

  y -= 12;

  // ── OT row ──
  page.drawText(`${entry.tradeDescription} (OT)`, { x: COL.class, y, size: rowSize, font, color: black, maxWidth: 83 });

  page.drawText(fmtHours(entry.monOt), { x: COL.mon,  y, size: rowSize, font, color: black, maxWidth: 22 });
  page.drawText(fmtHours(entry.tueOt), { x: COL.tue,  y, size: rowSize, font, color: black, maxWidth: 22 });
  page.drawText(fmtHours(entry.wedOt), { x: COL.wed,  y, size: rowSize, font, color: black, maxWidth: 22 });
  page.drawText(fmtHours(entry.thuOt), { x: COL.thu,  y, size: rowSize, font, color: black, maxWidth: 22 });
  page.drawText(fmtHours(entry.friOt), { x: COL.fri,  y, size: rowSize, font, color: black, maxWidth: 22 });
  page.drawText(fmtHours(entry.satOt), { x: COL.sat,  y, size: rowSize, font, color: black, maxWidth: 22 });
  page.drawText(fmtHours(entry.sunOt), { x: COL.sun,  y, size: rowSize, font, color: black, maxWidth: 22 });

  const otRate = entry.baseRateSnapshot * 1.5;
  page.drawText(String(entry.totalOtHours),       { x: COL.totalHrs, y, size: rowSize, font, color: black, maxWidth: 22 });
  page.drawText(fmtDollar(otRate),                { x: COL.rate,     y, size: rowSize, font, color: black, maxWidth: 28 });

  y -= 10;

  // BUG-06: fringe benefit summary row for NY PW-12
  const hasFringes = entry.fringeHealthWelfare != null || entry.fringePension != null ||
    entry.fringeVacation != null || entry.fringeTraining != null;
  if (hasFringes) {
    const fringeSize = rowSize - 1;
    page.drawText('Fringes:', { x: COL.nameSSN, y, size: fringeSize, font: boldFont, color: black, maxWidth: 98 });
    page.drawText(`H&W: ${fmtDollar(entry.fringeHealthWelfare)}`, { x: COL.fringeHW,  y, size: fringeSize, font, color: black, maxWidth: 43 });
    page.drawText(`Pen: ${fmtDollar(entry.fringePension)}`,       { x: COL.fringePen, y, size: fringeSize, font, color: black, maxWidth: 43 });
    page.drawText(`Vac: ${fmtDollar(entry.fringeVacation)}`,     { x: COL.fringeVac, y, size: fringeSize, font, color: black, maxWidth: 43 });
    page.drawText(`Trn: ${fmtDollar(entry.fringeTraining)}`,     { x: COL.fringeTrn, y, size: fringeSize, font, color: black, maxWidth: 43 });
    y -= 8;
  } else {
    y -= 4;
  }

  // Thin separator after each worker
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.25,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 8;

  return y;
}

// ── Draw Statement of Compliance block ──────────────────────────────────────

function drawStatementOfCompliance(
  page: PDFPage,
  data: Pw12Input,
  ctx: DrawCtx,
  startY: number,
): void {
  const { font, boldFont, black } = ctx;

  let y = startY;

  // Section rule
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1,
    color: black,
  });
  y -= 14;

  page.drawText('STATEMENT OF COMPLIANCE', {
    x: MARGIN,
    y,
    size: 9,
    font: boldFont,
    color: black,
    maxWidth: CONTENT_WIDTH,
  });
  y -= 12;

  const preamble =
    'The undersigned contractor or subcontractor executing this certified payroll affirms, under penalty of perjury, that the information provided is correct and complete, and that workers have been paid no less than the applicable prevailing wage rates and fringe benefits as required by Section 220 of the New York State Labor Law.';
  page.drawText(preamble, {
    x: MARGIN,
    y,
    size: 7,
    font,
    color: black,
    maxWidth: CONTENT_WIDTH,
    lineHeight: 10,
  });
  y -= 36;

  page.drawText('FRINGE BENEFIT STATEMENT:', {
    x: MARGIN,
    y,
    size: 8,
    font: boldFont,
    color: black,
    maxWidth: CONTENT_WIDTH,
  });
  y -= 12;

  const clauseB =
    '(b) Fringe benefits are paid to approved plans, funds, or programs on behalf of each worker listed above, at the rates shown in the applicable wage determination.';
  page.drawText(clauseB, {
    x: MARGIN,
    y,
    size: 7,
    font,
    color: black,
    maxWidth: CONTENT_WIDTH,
    lineHeight: 10,
  });
  y -= 22;

  const clauseC =
    '(c) Fringe benefits are paid as cash in lieu of plans, funds, or programs — included in the gross wage amounts shown above.';
  page.drawText(clauseC, {
    x: MARGIN,
    y,
    size: 7,
    font,
    color: black,
    maxWidth: CONTENT_WIDTH,
    lineHeight: 10,
  });
  y -= 30;

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

export async function fillPw12(data: Pw12Input): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0);

  const ctx: DrawCtx = { pdfDoc, font, boldFont, black };

  // Add the first page
  let page = addPage(pdfDoc);

  // Draw header and get the y position after the header
  let y = drawHeader(page, data, ctx);

  // Draw column headers for the worker table
  y = drawTableHeaders(page, y, ctx);

  // Draw each worker entry
  for (const entry of data.entries) {
    // If too close to bottom (need space for at least one worker row ~28pt plus compliance ~120pt)
    if (y < 150) {
      page = addPage(pdfDoc);
      y = drawHeader(page, data, ctx);
      y = drawTableHeaders(page, y, ctx);
    }
    y = drawWorkerRow(page, entry, y, ctx);
  }

  // Draw Statement of Compliance — ensure enough room (need ~120pt), add new page if not
  if (y < 150) {
    page = addPage(pdfDoc);
    y = PAGE_HEIGHT - MARGIN - 20;
  }

  drawStatementOfCompliance(page, data, ctx, y);

  return pdfDoc.save();
}
