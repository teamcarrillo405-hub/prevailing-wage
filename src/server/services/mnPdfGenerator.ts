// src/server/services/mnPdfGenerator.ts
//
// MN DLI Weekly Certified Payroll Report PDF generator using pdf-lib programmatic drawing.
//
// Unlike WH-347 which overlays a template, this form is drawn entirely from
// scratch using PDFDocument.create() — Minnesota does not provide a state PDF template
// compatible with pdf-lib coordinate overlay.
//
// Coordinate system: pdf-lib uses PDF origin at BOTTOM-LEFT.
//   Page dimensions: 612 × 792 pt (letter portrait — 8.5" × 11")
//   Content area: x = MARGIN (36) to PAGE_WIDTH - MARGIN (576)
//
// Form structure:
//   Page 1: Header block + worker table (Mo-Tu-We-Th-Fr-Sa-Su ST hours, fringes, pay)
//   Page 2 (ALWAYS dedicated): Statement of Compliance (Minn. Stat. 177.42)

import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from 'pdf-lib';

// ── Layout constants ────────────────────────────────────────────────────────

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

// ── Type definitions ────────────────────────────────────────────────────────

export interface MnPdfInput {
  contractor: {
    name: string;
    fein: string;
    address: string;
  };
  project: {
    name: string;
    mnContractId: string | null;  // MN contract ID — goes in "Contract No." header field
    location: string;
    awardingAuthority: string;
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
    // MN day order is MONDAY-FIRST (Mo-Tu-We-Th-Fr-Sa-Su) — standard for DLI form
    monSt: number;
    tueSt: number;
    wedSt: number;
    thuSt: number;
    friSt: number;
    satSt: number;
    sunSt: number;
    baseRate: number;
    fringeHealthWelfare: number | null;
    fringePension: number | null;
    fringeVacation: number | null;
    fringeTraining: number | null;
    grossWages: number | null;
    checkNumber: string | null;
    deductions: number | null;  // total deductions (MN DLI required)
    netPay: number | null;      // net pay (MN DLI required)
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

/**
 * fmtOptional: renders blank for null/undefined, number.toFixed(2) for numbers,
 * or string as-is. CRITICAL: null must render as '' not '0' or '0.00'.
 */
function fmtOptional(n: number | string | null | undefined): string {
  if (n === null || n === undefined) return '';
  if (typeof n === 'number') return n.toFixed(2);
  return n;
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

// ── Column positions for the MN worker table ────────────────────────────────
// Day column order is MONDAY-FIRST (Mo-Tu-We-Th-Fr-Sa-Su) — MN DLI form standard

const MN_COL = {
  nameSSN:    36,
  address:   118,
  class:     185,
  monSt:     250,
  tueSt:     265,
  wedSt:     280,
  thuSt:     295,
  friSt:     310,
  satSt:     325,
  sunSt:     340,
  baseRate:  360,
  hw:        385,
  pension:   405,
  vacation:  425,
  training:  445,
  gross:     468,
  checkNum:  492,
  deductions: 514,
  netPay:    540,
} as const;

// ── Draw header section on a page (returns y position after header) ──────────

function drawHeader(
  page: PDFPage,
  data: MnPdfInput,
  ctx: DrawCtx,
): number {
  const { font, boldFont, black } = ctx;
  let y = PAGE_HEIGHT - MARGIN;

  // Bold centered title
  const titleText = 'MINNESOTA CERTIFIED PAYROLL REPORT';
  const titleSize = 9;
  const titleWidth = boldFont.widthOfTextAtSize(titleText, titleSize);
  page.drawText(titleText, {
    x: (PAGE_WIDTH - titleWidth) / 2,
    y,
    size: titleSize,
    font: boldFont,
    color: black,
  });
  y -= 12;

  // Horizontal rule under title
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1,
    color: black,
  });
  y -= 10;

  const labelSize = 7;
  const valueSize = 8;

  // Line: Company Name | Payroll No
  page.drawText("Company's Name:", { x: MARGIN, y, size: labelSize, font, color: black });
  page.drawText(data.contractor.name, { x: MARGIN + 75, y, size: valueSize, font: boldFont, color: black, maxWidth: 200 });
  page.drawText('Payroll No.:', { x: 340, y, size: labelSize, font, color: black });
  page.drawText(data.week.payrollNumber, { x: 395, y, size: valueSize, font, color: black, maxWidth: 80 });
  y -= 11;

  // Line: Address | Week Ending
  page.drawText('Address:', { x: MARGIN, y, size: labelSize, font, color: black });
  page.drawText(data.contractor.address, { x: MARGIN + 75, y, size: valueSize, font, color: black, maxWidth: 200 });
  page.drawText('Work Week Ending:', { x: 340, y, size: labelSize, font, color: black });
  page.drawText(data.week.weekEndingDate, { x: 420, y, size: valueSize, font, color: black, maxWidth: 70 });
  y -= 11;

  // Line: FEIN | Awarding Authority
  page.drawText('Tax Payer ID No.:', { x: MARGIN, y, size: labelSize, font, color: black });
  page.drawText(data.contractor.fein, { x: MARGIN + 75, y, size: valueSize, font, color: black, maxWidth: 200 });
  page.drawText('Awarding Authority:', { x: 340, y, size: labelSize, font, color: black });
  page.drawText(data.project.awardingAuthority, { x: 420, y, size: valueSize, font, color: black, maxWidth: 70 });
  y -= 11;

  // Line: Project Name (full width)
  page.drawText('Project Name:', { x: MARGIN, y, size: labelSize, font, color: black });
  page.drawText(data.project.name, { x: MARGIN + 75, y, size: valueSize, font, color: black, maxWidth: 300 });
  y -= 11;

  // Line: Location | Contract No
  page.drawText('Location:', { x: MARGIN, y, size: labelSize, font, color: black });
  page.drawText(data.project.location, { x: MARGIN + 75, y, size: valueSize, font, color: black, maxWidth: 200 });
  page.drawText('Contract No.:', { x: 340, y, size: labelSize, font, color: black });
  page.drawText(data.project.mnContractId ?? '', { x: 400, y, size: valueSize, font, color: black, maxWidth: 90 });
  y -= 8;

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

// ── Draw column headers for the MN worker table ──────────────────────────────

function drawTableHeaders(page: PDFPage, y: number, ctx: DrawCtx): number {
  const { boldFont, black } = ctx;
  const hSize = 5;

  page.drawText('Name/SSN', { x: MN_COL.nameSSN,  y, size: hSize, font: boldFont, color: black, maxWidth: 80 });
  page.drawText('Address',  { x: MN_COL.address,   y, size: hSize, font: boldFont, color: black, maxWidth: 65 });
  page.drawText('Class.',   { x: MN_COL.class,     y, size: hSize, font: boldFont, color: black, maxWidth: 63 });
  page.drawText('Mo',       { x: MN_COL.monSt,     y, size: hSize, font: boldFont, color: black, maxWidth: 13 });
  page.drawText('Tu',       { x: MN_COL.tueSt,     y, size: hSize, font: boldFont, color: black, maxWidth: 13 });
  page.drawText('We',       { x: MN_COL.wedSt,     y, size: hSize, font: boldFont, color: black, maxWidth: 13 });
  page.drawText('Th',       { x: MN_COL.thuSt,     y, size: hSize, font: boldFont, color: black, maxWidth: 13 });
  page.drawText('Fr',       { x: MN_COL.friSt,     y, size: hSize, font: boldFont, color: black, maxWidth: 13 });
  page.drawText('Sa',       { x: MN_COL.satSt,     y, size: hSize, font: boldFont, color: black, maxWidth: 13 });
  page.drawText('Su',       { x: MN_COL.sunSt,     y, size: hSize, font: boldFont, color: black, maxWidth: 13 });
  page.drawText('Rate',     { x: MN_COL.baseRate,  y, size: hSize, font: boldFont, color: black, maxWidth: 23 });
  page.drawText('H&W',      { x: MN_COL.hw,        y, size: hSize, font: boldFont, color: black, maxWidth: 18 });
  page.drawText('Pen.',     { x: MN_COL.pension,   y, size: hSize, font: boldFont, color: black, maxWidth: 18 });
  page.drawText('Vac.',     { x: MN_COL.vacation,  y, size: hSize, font: boldFont, color: black, maxWidth: 18 });
  page.drawText('Trn.',     { x: MN_COL.training,  y, size: hSize, font: boldFont, color: black, maxWidth: 21 });
  page.drawText('Gross',    { x: MN_COL.gross,      y, size: hSize, font: boldFont, color: black, maxWidth: 22 });
  page.drawText('Chk#',    { x: MN_COL.checkNum,   y, size: hSize, font: boldFont, color: black, maxWidth: 20 });
  page.drawText('Ded',     { x: MN_COL.deductions, y, size: hSize, font: boldFont, color: black, maxWidth: 24 });
  page.drawText('Net',     { x: MN_COL.netPay,     y, size: hSize, font: boldFont, color: black, maxWidth: 24 });

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

// ── Draw a single worker row ─────────────────────────────────────────────────

function drawWorkerRow(
  page: PDFPage,
  entry: MnPdfInput['entries'][number],
  y: number,
  ctx: DrawCtx,
): number {
  const { font, boldFont, black } = ctx;
  const rowSize = 6;

  // Name on line 1, SSN on line 2
  page.drawText(entry.workerName, {
    x: MN_COL.nameSSN,
    y,
    size: rowSize,
    font: boldFont,
    color: black,
    maxWidth: 80,
  });
  const ssnDisplay = entry.workerSsnLast4 ? `XXX-XX-${entry.workerSsnLast4}` : '';
  if (ssnDisplay) {
    page.drawText(ssnDisplay, {
      x: MN_COL.nameSSN,
      y: y - 8,
      size: rowSize,
      font,
      color: black,
      maxWidth: 80,
    });
  }

  page.drawText(entry.workerAddress, {
    x: MN_COL.address,
    y,
    size: rowSize,
    font,
    color: black,
    maxWidth: 65,
  });

  page.drawText(entry.classification, {
    x: MN_COL.class,
    y,
    size: rowSize,
    font,
    color: black,
    maxWidth: 63,
  });

  // Day columns — MONDAY FIRST (Mo-Tu-We-Th-Fr-Sa-Su)
  page.drawText(fmtHours(entry.monSt), { x: MN_COL.monSt,    y, size: rowSize, font, color: black, maxWidth: 13 });
  page.drawText(fmtHours(entry.tueSt), { x: MN_COL.tueSt,    y, size: rowSize, font, color: black, maxWidth: 13 });
  page.drawText(fmtHours(entry.wedSt), { x: MN_COL.wedSt,    y, size: rowSize, font, color: black, maxWidth: 13 });
  page.drawText(fmtHours(entry.thuSt), { x: MN_COL.thuSt,    y, size: rowSize, font, color: black, maxWidth: 13 });
  page.drawText(fmtHours(entry.friSt), { x: MN_COL.friSt,    y, size: rowSize, font, color: black, maxWidth: 13 });
  page.drawText(fmtHours(entry.satSt), { x: MN_COL.satSt,    y, size: rowSize, font, color: black, maxWidth: 13 });
  page.drawText(fmtHours(entry.sunSt), { x: MN_COL.sunSt,    y, size: rowSize, font, color: black, maxWidth: 13 });

  // Rates and fringes
  page.drawText(fmtDollar(entry.baseRate),           { x: MN_COL.baseRate, y, size: rowSize, font, color: black, maxWidth: 23 });
  page.drawText(fmtDollar(entry.fringeHealthWelfare), { x: MN_COL.hw,       y, size: rowSize, font, color: black, maxWidth: 18 });
  page.drawText(fmtDollar(entry.fringePension),       { x: MN_COL.pension,  y, size: rowSize, font, color: black, maxWidth: 18 });
  page.drawText(fmtDollar(entry.fringeVacation),      { x: MN_COL.vacation, y, size: rowSize, font, color: black, maxWidth: 18 });
  page.drawText(fmtDollar(entry.fringeTraining),      { x: MN_COL.training, y, size: rowSize, font, color: black, maxWidth: 21 });

  // Gross pay — null renders as blank
  page.drawText(fmtOptional(entry.grossWages),  { x: MN_COL.gross,      y, size: rowSize, font, color: black, maxWidth: 22 });
  page.drawText(fmtOptional(entry.checkNumber), { x: MN_COL.checkNum,   y, size: rowSize, font, color: black, maxWidth: 20 });
  // BUG-03: MN DLI requires deductions and net pay columns
  page.drawText(fmtDollar(entry.deductions),    { x: MN_COL.deductions, y, size: rowSize, font, color: black, maxWidth: 24 });
  page.drawText(fmtDollar(entry.netPay),        { x: MN_COL.netPay,     y, size: rowSize, font, color: black, maxWidth: 24 });

  // Thin separator after each worker
  const separatorY = y - 20;
  page.drawLine({
    start: { x: MARGIN, y: separatorY },
    end: { x: PAGE_WIDTH - MARGIN, y: separatorY },
    thickness: 0.25,
    color: rgb(0.7, 0.7, 0.7),
  });

  // Row height 18pt (name + SSN on two lines)
  return y - 18;
}

// ── Draw Statement of Compliance (always dedicated page 2) ───────────────────

function drawStatementOfCompliance(
  page: PDFPage,
  data: MnPdfInput,
  ctx: DrawCtx,
): void {
  const { font, boldFont, black } = ctx;
  let y = PAGE_HEIGHT - MARGIN;

  // Centered bold title
  const titleText = 'STATEMENT OF COMPLIANCE';
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

  // Horizontal rule below title
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1,
    color: black,
  });
  y -= 14;

  // Paragraph 1 — statutory compliance certification referencing Minn. Stat. 177.42
  const para1 =
    `I do hereby certify that the payroll records for the payroll period ending ${data.week.weekEndingDate} are correct and complete, and that the wage rate paid to each worker was not less than the applicable prevailing wage rate required under Minnesota Statutes, Section 177.42.`;
  page.drawText(para1, {
    x: MARGIN,
    y,
    size: 7,
    font,
    color: black,
    maxWidth: CONTENT_WIDTH,
    lineHeight: 10,
  });
  y -= 46;

  // Paragraph 2 — perjury certification
  const para2 =
    'The undersigned certifies under penalty of perjury that the above information is true and correct.';
  page.drawText(para2, {
    x: MARGIN,
    y,
    size: 7,
    font,
    color: black,
    maxWidth: CONTENT_WIDTH,
    lineHeight: 10,
  });
  y -= 30;

  // ── Signature block ───────────────────────────────────────────────────────

  // Signature line
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: MARGIN + 200, y },
    thickness: 0.5,
    color: black,
  });
  page.drawText('Signature', {
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

export async function fillMnCertifiedPayroll(data: MnPdfInput): Promise<Uint8Array> {
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
    // Each worker block is ~18pt; need 80pt clearance so row is not crowded at page bottom
    if (y < 80) {
      page = addPage(pdfDoc);
      y = drawHeader(page, data, ctx);
      y = drawTableHeaders(page, y, ctx);
    }
    y = drawWorkerRow(page, entry, y, ctx);
  }

  // ── Page 2: Statement of Compliance (ALWAYS dedicated page) ───────────────
  // Unconditional addPage() — affidavit never shares a page with worker rows.

  const compliancePage = addPage(pdfDoc);
  drawStatementOfCompliance(compliancePage, data, ctx);

  return pdfDoc.save();
}
