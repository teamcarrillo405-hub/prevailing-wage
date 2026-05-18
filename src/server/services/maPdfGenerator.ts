// src/server/services/maPdfGenerator.ts
//
// MA DLS Weekly Certified Payroll Report PDF generator using pdf-lib programmatic drawing.
//
// Unlike WH-347 which overlays a template, this form is drawn entirely from
// scratch using PDFDocument.create() — Massachusetts does not provide a state PDF template
// compatible with pdf-lib coordinate overlay.
//
// Coordinate system: pdf-lib uses PDF origin at BOTTOM-LEFT.
//   Page dimensions: 612 × 792 pt (letter portrait — 8.5" × 11")
//   Content area: x = MARGIN (36) to PAGE_WIDTH - MARGIN (576)
//
// Form structure:
//   Page 1: Header block + worker table (Su-Mo-Tu-We-Th-Fr-Sa ST hours, fringes, pay)
//   Page 2 (ALWAYS dedicated): Statement of Compliance (MA MGL Ch. 149 Section 27)

import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from 'pdf-lib';

// ── Layout constants ────────────────────────────────────────────────────────

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

// ── Type definitions ────────────────────────────────────────────────────────

export interface MaPdfInput {
  contractor: {
    name: string;
    fein: string;
    address: string;
  };
  project: {
    name: string;
    dlsProjectId: string;    // MA DLS Project ID — goes in "Contract No." header field
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
    oshaTraining: boolean | null;    // OSHA 10 certification — filled box if true
    isWoman: boolean | null;         // Y/N/em-dash
    isMinority: boolean | null;      // Y/N/em-dash
    // ST hours — MA form is Sunday-first (Su-Mo-Tu-We-Th-Fr-Sa)
    sunSt: number;
    monSt: number;
    tueSt: number;
    wedSt: number;
    thuSt: number;
    friSt: number;
    satSt: number;
    baseRate: number;
    fringeHealthWelfare: number | null;
    fringePension: number | null;
    fringeVacation: number | null;
    fringeTraining: number | null;
    projectGross: number | null;      // gross wages for this project only
    totalWeekGross: number | null;    // total gross wages across all projects (may be null)
    allOtherHours: number | null;     // hours on other projects (may be null)
    checkNumber: string | null;       // paycheck number (may be null)
    deductions: number | null;        // total deductions (MA DLS required)
    netPay: number | null;            // net pay (MA DLS required)
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

/** Returns 'Y' for true, 'N' for false, em-dash for null. */
function fmtBoolean(v: boolean | null): string {
  if (v === true) return 'Y';
  if (v === false) return 'N';
  return '\u2014'; // em dash
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

// ── Draw OSHA checkbox: 8×8 outer box always; filled 6×6 inner square if true ──

function drawCheckbox(
  page: PDFPage,
  x: number,
  y: number,
  checked: boolean | null,
): void {
  // Always draw the outer 8×8 box border
  page.drawRectangle({
    x,
    y,
    width: 8,
    height: 8,
    borderColor: rgb(0, 0, 0),
    borderWidth: 0.5,
    color: undefined,
  });
  // Fill inner 6×6 square only when explicitly true
  if (checked === true) {
    page.drawRectangle({
      x: x + 1,
      y: y + 1,
      width: 6,
      height: 6,
      color: rgb(0, 0, 0),
    });
  }
}

// ── Column positions for the MA worker table ────────────────────────────────
// Day column order is SUNDAY-FIRST (Su-Mo-Tu-We-Th-Fr-Sa) — critical MA difference from IL

const MA_COL = {
  nameSSN:      36,
  address:     118,
  class:       185,
  oshaCheck:   242,
  isWoman:     260,
  isMinority:  274,
  sunSt:       288,   // SUNDAY FIRST — critical difference from IL
  monSt:       303,
  tueSt:       318,
  wedSt:       333,
  thuSt:       348,
  friSt:       363,
  satSt:       378,
  baseRate:    393,
  hw:          413,
  pension:     431,
  vacation:    449,
  training:    467,
  suppUnemp:   485,
  projectGross: 503,
  totalGross:  524,
  allOther:    546,
  checkNum:    540,
  deductions:  556,
  netPay:      572,
} as const;

// ── Draw header section on a page (returns y position after header) ──────────

function drawHeader(
  page: PDFPage,
  data: MaPdfInput,
  ctx: DrawCtx,
): number {
  const { font, boldFont, black } = ctx;
  let y = PAGE_HEIGHT - MARGIN;

  // Bold centered title
  const titleText = 'MASSACHUSETTS WEEKLY CERTIFIED PAYROLL REPORT';
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

  // Line: Tax Payer ID | Awarding Authority
  page.drawText('Tax Payer ID No.:', { x: MARGIN, y, size: labelSize, font, color: black });
  page.drawText(data.contractor.fein, { x: MARGIN + 75, y, size: valueSize, font, color: black, maxWidth: 200 });
  page.drawText('Awarding Authority:', { x: 340, y, size: labelSize, font, color: black });
  page.drawText(data.project.awardingAuthority, { x: 420, y, size: valueSize, font, color: black, maxWidth: 70 });
  y -= 11;

  // Line: Public Works Project (full width)
  page.drawText('Public Works Project:', { x: MARGIN, y, size: labelSize, font, color: black });
  page.drawText(data.project.name, { x: MARGIN + 100, y, size: valueSize, font, color: black, maxWidth: 300 });
  y -= 11;

  // Line: Location | Contract No
  page.drawText('Location:', { x: MARGIN, y, size: labelSize, font, color: black });
  page.drawText(data.project.location, { x: MARGIN + 75, y, size: valueSize, font, color: black, maxWidth: 200 });
  page.drawText('Contract No.:', { x: 340, y, size: labelSize, font, color: black });
  page.drawText(data.project.dlsProjectId, { x: 400, y, size: valueSize, font, color: black, maxWidth: 90 });
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

// ── Draw column headers for the MA worker table ──────────────────────────────

function drawTableHeaders(page: PDFPage, y: number, ctx: DrawCtx): number {
  const { boldFont, black } = ctx;
  const hSize = 5;

  page.drawText('Name/SSN',   { x: MA_COL.nameSSN,      y, size: hSize, font: boldFont, color: black, maxWidth: 80 });
  page.drawText('Address',    { x: MA_COL.address,       y, size: hSize, font: boldFont, color: black, maxWidth: 65 });
  page.drawText('Class.',     { x: MA_COL.class,         y, size: hSize, font: boldFont, color: black, maxWidth: 55 });
  page.drawText('OSHA',       { x: MA_COL.oshaCheck,     y, size: hSize, font: boldFont, color: black, maxWidth: 16 });
  page.drawText('W',          { x: MA_COL.isWoman,       y, size: hSize, font: boldFont, color: black, maxWidth: 12 });
  page.drawText('M',          { x: MA_COL.isMinority,    y, size: hSize, font: boldFont, color: black, maxWidth: 12 });
  page.drawText('Su',         { x: MA_COL.sunSt,         y, size: hSize, font: boldFont, color: black, maxWidth: 13 });
  page.drawText('Mo',         { x: MA_COL.monSt,         y, size: hSize, font: boldFont, color: black, maxWidth: 13 });
  page.drawText('Tu',         { x: MA_COL.tueSt,         y, size: hSize, font: boldFont, color: black, maxWidth: 13 });
  page.drawText('We',         { x: MA_COL.wedSt,         y, size: hSize, font: boldFont, color: black, maxWidth: 13 });
  page.drawText('Th',         { x: MA_COL.thuSt,         y, size: hSize, font: boldFont, color: black, maxWidth: 13 });
  page.drawText('Fr',         { x: MA_COL.friSt,         y, size: hSize, font: boldFont, color: black, maxWidth: 13 });
  page.drawText('Sa',         { x: MA_COL.satSt,         y, size: hSize, font: boldFont, color: black, maxWidth: 13 });
  page.drawText('Rate',       { x: MA_COL.baseRate,      y, size: hSize, font: boldFont, color: black, maxWidth: 18 });
  page.drawText('H&W',        { x: MA_COL.hw,            y, size: hSize, font: boldFont, color: black, maxWidth: 16 });
  page.drawText('Pen.',       { x: MA_COL.pension,       y, size: hSize, font: boldFont, color: black, maxWidth: 16 });
  page.drawText('Vac.',       { x: MA_COL.vacation,      y, size: hSize, font: boldFont, color: black, maxWidth: 16 });
  page.drawText('Trn.',       { x: MA_COL.training,      y, size: hSize, font: boldFont, color: black, maxWidth: 16 });
  page.drawText('S.U.',       { x: MA_COL.suppUnemp,     y, size: hSize, font: boldFont, color: black, maxWidth: 16 });
  page.drawText('Proj$',      { x: MA_COL.projectGross,  y, size: hSize, font: boldFont, color: black, maxWidth: 20 });
  page.drawText('Tot$',       { x: MA_COL.totalGross,    y, size: hSize, font: boldFont, color: black, maxWidth: 20 });
  page.drawText('Oth.Hr',     { x: MA_COL.allOther,      y, size: hSize, font: boldFont, color: black, maxWidth: 13 });
  page.drawText('Chk#',       { x: MA_COL.checkNum,      y, size: hSize, font: boldFont, color: black, maxWidth: 14 });
  page.drawText('Ded',        { x: MA_COL.deductions,    y, size: hSize, font: boldFont, color: black, maxWidth: 14 });
  page.drawText('Net',        { x: MA_COL.netPay,        y, size: hSize, font: boldFont, color: black, maxWidth: 14 });

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
  entry: MaPdfInput['entries'][number],
  y: number,
  ctx: DrawCtx,
): number {
  const { font, boldFont, black } = ctx;
  const rowSize = 6;

  // Name on line 1, SSN on line 2
  page.drawText(entry.workerName, {
    x: MA_COL.nameSSN,
    y,
    size: rowSize,
    font: boldFont,
    color: black,
    maxWidth: 80,
  });
  const ssnDisplay = entry.workerSsnLast4 ? `XXX-XX-${entry.workerSsnLast4}` : '';
  if (ssnDisplay) {
    page.drawText(ssnDisplay, {
      x: MA_COL.nameSSN,
      y: y - 8,
      size: rowSize,
      font,
      color: black,
      maxWidth: 80,
    });
  }

  page.drawText(entry.workerAddress, {
    x: MA_COL.address,
    y,
    size: rowSize,
    font,
    color: black,
    maxWidth: 65,
  });

  page.drawText(entry.classification, {
    x: MA_COL.class,
    y,
    size: rowSize,
    font,
    color: black,
    maxWidth: 55,
  });

  // OSHA 10 checkbox — filled for true, empty box for false/null
  drawCheckbox(page, MA_COL.oshaCheck, y, entry.oshaTraining);

  // Woman / Minority as Y/N/em-dash
  page.drawText(fmtBoolean(entry.isWoman), {
    x: MA_COL.isWoman,
    y,
    size: rowSize,
    font,
    color: black,
    maxWidth: 12,
  });
  page.drawText(fmtBoolean(entry.isMinority), {
    x: MA_COL.isMinority,
    y,
    size: rowSize,
    font,
    color: black,
    maxWidth: 12,
  });

  // Day columns — SUNDAY FIRST (Su-Mo-Tu-We-Th-Fr-Sa)
  page.drawText(fmtHours(entry.sunSt), { x: MA_COL.sunSt, y, size: rowSize, font, color: black, maxWidth: 13 });
  page.drawText(fmtHours(entry.monSt), { x: MA_COL.monSt, y, size: rowSize, font, color: black, maxWidth: 13 });
  page.drawText(fmtHours(entry.tueSt), { x: MA_COL.tueSt, y, size: rowSize, font, color: black, maxWidth: 13 });
  page.drawText(fmtHours(entry.wedSt), { x: MA_COL.wedSt, y, size: rowSize, font, color: black, maxWidth: 13 });
  page.drawText(fmtHours(entry.thuSt), { x: MA_COL.thuSt, y, size: rowSize, font, color: black, maxWidth: 13 });
  page.drawText(fmtHours(entry.friSt), { x: MA_COL.friSt, y, size: rowSize, font, color: black, maxWidth: 13 });
  page.drawText(fmtHours(entry.satSt), { x: MA_COL.satSt, y, size: rowSize, font, color: black, maxWidth: 13 });

  // Rates and fringes
  page.drawText(fmtDollar(entry.baseRate), { x: MA_COL.baseRate, y, size: rowSize, font, color: black, maxWidth: 18 });
  page.drawText(fmtDollar(entry.fringeHealthWelfare), { x: MA_COL.hw,       y, size: rowSize, font, color: black, maxWidth: 16 });
  page.drawText(fmtDollar(entry.fringePension),       { x: MA_COL.pension,  y, size: rowSize, font, color: black, maxWidth: 16 });
  page.drawText(fmtDollar(entry.fringeVacation),      { x: MA_COL.vacation, y, size: rowSize, font, color: black, maxWidth: 16 });
  page.drawText(fmtDollar(entry.fringeTraining),      { x: MA_COL.training, y, size: rowSize, font, color: black, maxWidth: 16 });

  // Supplemental unemployment — always blank (no DB column per spec)
  page.drawText('', { x: MA_COL.suppUnemp, y, size: rowSize, font, color: black, maxWidth: 16 });

  // Gross pay columns — null renders as blank, never as '0' or '0.00'
  page.drawText(fmtDollar(entry.projectGross),   { x: MA_COL.projectGross, y, size: rowSize, font, color: black, maxWidth: 20 });
  page.drawText(fmtDollar(entry.totalWeekGross), { x: MA_COL.totalGross,   y, size: rowSize, font, color: black, maxWidth: 20 });

  // Optional fields — null renders blank
  page.drawText(fmtOptional(entry.allOtherHours), { x: MA_COL.allOther,   y, size: rowSize, font, color: black, maxWidth: 13 });
  page.drawText(fmtOptional(entry.checkNumber),   { x: MA_COL.checkNum,   y, size: rowSize, font, color: black, maxWidth: 14 });
  // BUG-02: MA DLS requires deductions and net pay columns
  page.drawText(fmtDollar(entry.deductions),      { x: MA_COL.deductions, y, size: rowSize, font, color: black, maxWidth: 14 });
  page.drawText(fmtDollar(entry.netPay),          { x: MA_COL.netPay,     y, size: rowSize, font, color: black, maxWidth: 14 });

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
  data: MaPdfInput,
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

  // Paragraph 1 — statutory compliance certification referencing MGL Ch. 149, Section 27
  const para1 =
    `I do hereby certify that the payroll records for the payroll period ending ${data.week.weekEndingDate} are correct and complete, and that the wage rate paid to each worker was not less than the applicable prevailing wage rate required by Massachusetts General Laws, Chapter 149, Section 27. Workers employed as apprentices were registered in accordance with Chapter 149, Section 27F.`;
  page.drawText(para1, {
    x: MARGIN,
    y,
    size: 7,
    font,
    color: black,
    maxWidth: CONTENT_WIDTH,
    lineHeight: 10,
  });
  y -= 52;

  // Paragraph 2 — pains and penalties of perjury
  const para2 =
    'The undersigned hereby certifies under the pains and penalties of perjury that the above information is true and correct.';
  page.drawText(para2, {
    x: MARGIN,
    y,
    size: 7,
    font,
    color: black,
    maxWidth: CONTENT_WIDTH,
    lineHeight: 10,
  });
  y -= 26;

  // Paragraph 3 — OSHA 10 note
  const para3 =
    'Note: Documentation of OSHA 10 certification must be provided for each employee the first time they appear on a weekly payroll record.';
  page.drawText(para3, {
    x: MARGIN,
    y,
    size: 7,
    font,
    color: black,
    maxWidth: CONTENT_WIDTH,
    lineHeight: 10,
  });
  y -= 40;

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

export async function fillMaCertifiedPayroll(data: MaPdfInput): Promise<Uint8Array> {
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
  // Unconditional addPage() — per Phase 43 decision; affidavit never shares a page with worker rows.

  const compliancePage = addPage(pdfDoc);
  drawStatementOfCompliance(compliancePage, data, ctx);

  return pdfDoc.save();
}
