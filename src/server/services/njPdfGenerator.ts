// src/server/services/njPdfGenerator.ts
//
// NJ DOL MW-562 Weekly Certified Payroll PDF generator using pdf-lib programmatic drawing.
// Form version: MW-562 (Feb 2025 revision)
//
// Unlike WH-347 which overlays a template, this form is drawn entirely from
// scratch using PDFDocument.create() — New Jersey does not provide a state PDF template
// compatible with pdf-lib coordinate overlay.
//
// Coordinate system: pdf-lib uses PDF origin at BOTTOM-LEFT.
//   Page dimensions: 612 × 792 pt (letter portrait — 8.5" × 11")
//   Content area: x = MARGIN (36) to PAGE_WIDTH - MARGIN (576)
//
// Key NJ differences from MA form:
//   - Day column order is MONDAY-FIRST (Mo-Tu-We-Th-Fr-Sa-Su) — NJ standard
//   - EEO columns: Sex (M/F/N), Race (W/B/A/N/I/M 6-code NJ system), Ethnicity (H/N)
//   - Deduction columns: FICA Tax, FIT (Federal Income Tax), SIT (State Income Tax)
//   - Header includes NJ PWC Registration Number and Contract No. fields
//   - Page 2 (ALWAYS dedicated): Statement of Compliance (N.J.S.A. 34:11-56.25 et seq.)

import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from 'pdf-lib';

// ── Layout constants ────────────────────────────────────────────────────────

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

// ── Type definitions ────────────────────────────────────────────────────────

export interface NjPdfInput {
  contractor: {
    name: string;
    fein: string;
    address: string;
    njPwcNumber: string | null;   // NJ Public Works Contractor Registration Number
  };
  project: {
    name: string;
    njContractId: string | null;  // goes in "Contract No." header field
    location: string;
    awardingAuthority: string;
  };
  week: {
    weekEndingDate: string;       // ISO YYYY-MM-DD
    payrollNumber: string;
  };
  entries: Array<{
    workerName: string;
    workerSsnLast4: string | null;
    workerAddress: string;
    classification: string;
    workerSex: string | null;     // M / F / N (stored as text)
    race: string | null;          // W/B/A/N/I/M (6-code NJ system)
    ethnicity: string | null;     // H/N
    // Monday-first day order (NJ standard)
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
    ficaTax: number | null;
    federalIncomeTax: number | null;
    stateIncomeTax: number | null;
    netPay: number | null;
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

/**
 * fmtEeo: returns the EEO code letter as-is (M/F/N, W/B/A/N/I/M, H/N),
 * or em-dash for null/undefined/empty. NOT Y/N — NJ uses code letters.
 */
function fmtEeo(v: string | null): string {
  if (v === null || v === undefined || v === '') return '\u2014'; // em dash
  return v;
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

// ── Column positions for the NJ worker table ────────────────────────────────
// Day column order is MONDAY-FIRST (Mo-Tu-We-Th-Fr-Sa-Su) — NJ standard
// Final column (netPay at x=558) + its content stays at or below x=576 (right margin)

const NJ_COL = {
  nameSSN:     36,   // width ~82
  address:    120,   // width ~60
  class:      182,   // width ~50
  workerSex:  234,   // width 14
  race:       250,   // width 14
  ethnicity:  266,   // width 14
  monSt:      282,
  tueSt:      297,
  wedSt:      312,
  thuSt:      327,
  friSt:      342,
  satSt:      357,
  sunSt:      372,
  baseRate:   389,   // width ~22
  hw:         413,
  pension:    431,
  vacation:   449,
  training:   467,
  grossWages: 485,   // width ~20
  ficaTax:    507,
  fedTax:     524,
  stateTax:   541,
  netPay:     558,   // ends at ~576 (right margin)
} as const;

// ── Draw header section on a page (returns y position after header) ──────────

function drawHeader(
  page: PDFPage,
  data: NjPdfInput,
  ctx: DrawCtx,
): number {
  const { font, boldFont, black } = ctx;
  let y = PAGE_HEIGHT - MARGIN;

  // Bold centered title
  const titleText = 'NEW JERSEY MW-562 WEEKLY CERTIFIED PAYROLL REPORT';
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

  // Line: NJ PWC Reg. No. | Contract No.
  page.drawText('NJ PWC Reg. No.:', { x: MARGIN, y, size: labelSize, font, color: black });
  page.drawText(data.contractor.njPwcNumber ?? '', { x: MARGIN + 75, y, size: valueSize, font, color: black, maxWidth: 200 });
  page.drawText('Contract No.:', { x: 340, y, size: labelSize, font, color: black });
  page.drawText(data.project.njContractId ?? '', { x: 400, y, size: valueSize, font, color: black, maxWidth: 90 });
  y -= 11;

  // Line: Public Works Project (full width)
  page.drawText('Public Works Project:', { x: MARGIN, y, size: labelSize, font, color: black });
  page.drawText(data.project.name, { x: MARGIN + 100, y, size: valueSize, font, color: black, maxWidth: 300 });
  y -= 11;

  // Line: Location
  page.drawText('Location:', { x: MARGIN, y, size: labelSize, font, color: black });
  page.drawText(data.project.location, { x: MARGIN + 75, y, size: valueSize, font, color: black, maxWidth: 300 });
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

// ── Draw column headers for the NJ worker table ──────────────────────────────

function drawTableHeaders(page: PDFPage, y: number, ctx: DrawCtx): number {
  const { boldFont, black } = ctx;
  const hSize = 5;

  page.drawText('Name/SSN',  { x: NJ_COL.nameSSN,    y, size: hSize, font: boldFont, color: black, maxWidth: 82 });
  page.drawText('Address',   { x: NJ_COL.address,    y, size: hSize, font: boldFont, color: black, maxWidth: 60 });
  page.drawText('Class.',    { x: NJ_COL.class,      y, size: hSize, font: boldFont, color: black, maxWidth: 50 });
  page.drawText('Sex',       { x: NJ_COL.workerSex,  y, size: hSize, font: boldFont, color: black, maxWidth: 14 });
  page.drawText('Race',      { x: NJ_COL.race,       y, size: hSize, font: boldFont, color: black, maxWidth: 14 });
  page.drawText('Eth',       { x: NJ_COL.ethnicity,  y, size: hSize, font: boldFont, color: black, maxWidth: 14 });
  // Monday-first day order (NJ standard)
  page.drawText('Mo',        { x: NJ_COL.monSt,      y, size: hSize, font: boldFont, color: black, maxWidth: 13 });
  page.drawText('Tu',        { x: NJ_COL.tueSt,      y, size: hSize, font: boldFont, color: black, maxWidth: 13 });
  page.drawText('We',        { x: NJ_COL.wedSt,      y, size: hSize, font: boldFont, color: black, maxWidth: 13 });
  page.drawText('Th',        { x: NJ_COL.thuSt,      y, size: hSize, font: boldFont, color: black, maxWidth: 13 });
  page.drawText('Fr',        { x: NJ_COL.friSt,      y, size: hSize, font: boldFont, color: black, maxWidth: 13 });
  page.drawText('Sa',        { x: NJ_COL.satSt,      y, size: hSize, font: boldFont, color: black, maxWidth: 13 });
  page.drawText('Su',        { x: NJ_COL.sunSt,      y, size: hSize, font: boldFont, color: black, maxWidth: 13 });
  page.drawText('Rate',      { x: NJ_COL.baseRate,   y, size: hSize, font: boldFont, color: black, maxWidth: 22 });
  page.drawText('H&W',       { x: NJ_COL.hw,         y, size: hSize, font: boldFont, color: black, maxWidth: 16 });
  page.drawText('Pen.',      { x: NJ_COL.pension,    y, size: hSize, font: boldFont, color: black, maxWidth: 16 });
  page.drawText('Vac.',      { x: NJ_COL.vacation,   y, size: hSize, font: boldFont, color: black, maxWidth: 16 });
  page.drawText('Trn.',      { x: NJ_COL.training,   y, size: hSize, font: boldFont, color: black, maxWidth: 16 });
  page.drawText('Gross$',    { x: NJ_COL.grossWages, y, size: hSize, font: boldFont, color: black, maxWidth: 20 });
  page.drawText('FICA',      { x: NJ_COL.ficaTax,    y, size: hSize, font: boldFont, color: black, maxWidth: 16 });
  page.drawText('FIT',       { x: NJ_COL.fedTax,     y, size: hSize, font: boldFont, color: black, maxWidth: 16 });
  page.drawText('SIT',       { x: NJ_COL.stateTax,   y, size: hSize, font: boldFont, color: black, maxWidth: 16 });
  page.drawText('Net$',      { x: NJ_COL.netPay,     y, size: hSize, font: boldFont, color: black, maxWidth: 18 });

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
  entry: NjPdfInput['entries'][number],
  y: number,
  ctx: DrawCtx,
): number {
  const { font, boldFont, black } = ctx;
  const rowSize = 6;

  // Name on line 1, SSN on line 2
  page.drawText(entry.workerName, {
    x: NJ_COL.nameSSN,
    y,
    size: rowSize,
    font: boldFont,
    color: black,
    maxWidth: 82,
  });
  const ssnDisplay = entry.workerSsnLast4 ? `XXX-XX-${entry.workerSsnLast4}` : '';
  if (ssnDisplay) {
    page.drawText(ssnDisplay, {
      x: NJ_COL.nameSSN,
      y: y - 8,
      size: rowSize,
      font,
      color: black,
      maxWidth: 82,
    });
  }

  page.drawText(entry.workerAddress, {
    x: NJ_COL.address,
    y,
    size: rowSize,
    font,
    color: black,
    maxWidth: 60,
  });

  page.drawText(entry.classification, {
    x: NJ_COL.class,
    y,
    size: rowSize,
    font,
    color: black,
    maxWidth: 50,
  });

  // EEO columns — use fmtEeo (returns code letter or em-dash, NOT Y/N)
  page.drawText(fmtEeo(entry.workerSex), {
    x: NJ_COL.workerSex,
    y,
    size: rowSize,
    font,
    color: black,
    maxWidth: 14,
  });
  page.drawText(fmtEeo(entry.race), {
    x: NJ_COL.race,
    y,
    size: rowSize,
    font,
    color: black,
    maxWidth: 14,
  });
  page.drawText(fmtEeo(entry.ethnicity), {
    x: NJ_COL.ethnicity,
    y,
    size: rowSize,
    font,
    color: black,
    maxWidth: 14,
  });

  // Day columns — MONDAY FIRST (Mo-Tu-We-Th-Fr-Sa-Su) — NJ standard
  page.drawText(fmtHours(entry.monSt), { x: NJ_COL.monSt, y, size: rowSize, font, color: black, maxWidth: 13 });
  page.drawText(fmtHours(entry.tueSt), { x: NJ_COL.tueSt, y, size: rowSize, font, color: black, maxWidth: 13 });
  page.drawText(fmtHours(entry.wedSt), { x: NJ_COL.wedSt, y, size: rowSize, font, color: black, maxWidth: 13 });
  page.drawText(fmtHours(entry.thuSt), { x: NJ_COL.thuSt, y, size: rowSize, font, color: black, maxWidth: 13 });
  page.drawText(fmtHours(entry.friSt), { x: NJ_COL.friSt, y, size: rowSize, font, color: black, maxWidth: 13 });
  page.drawText(fmtHours(entry.satSt), { x: NJ_COL.satSt, y, size: rowSize, font, color: black, maxWidth: 13 });
  page.drawText(fmtHours(entry.sunSt), { x: NJ_COL.sunSt, y, size: rowSize, font, color: black, maxWidth: 13 });

  // Rates and fringes
  page.drawText(fmtDollar(entry.baseRate),            { x: NJ_COL.baseRate,   y, size: rowSize, font, color: black, maxWidth: 22 });
  page.drawText(fmtDollar(entry.fringeHealthWelfare), { x: NJ_COL.hw,         y, size: rowSize, font, color: black, maxWidth: 16 });
  page.drawText(fmtDollar(entry.fringePension),       { x: NJ_COL.pension,    y, size: rowSize, font, color: black, maxWidth: 16 });
  page.drawText(fmtDollar(entry.fringeVacation),      { x: NJ_COL.vacation,   y, size: rowSize, font, color: black, maxWidth: 16 });
  page.drawText(fmtDollar(entry.fringeTraining),      { x: NJ_COL.training,   y, size: rowSize, font, color: black, maxWidth: 16 });

  // Pay and deduction columns — null renders as blank, never as '0' or '0.00'
  page.drawText(fmtOptional(entry.grossWages),       { x: NJ_COL.grossWages, y, size: rowSize, font, color: black, maxWidth: 20 });
  page.drawText(fmtOptional(entry.ficaTax),          { x: NJ_COL.ficaTax,    y, size: rowSize, font, color: black, maxWidth: 16 });
  page.drawText(fmtOptional(entry.federalIncomeTax), { x: NJ_COL.fedTax,     y, size: rowSize, font, color: black, maxWidth: 16 });
  page.drawText(fmtOptional(entry.stateIncomeTax),   { x: NJ_COL.stateTax,   y, size: rowSize, font, color: black, maxWidth: 16 });
  page.drawText(fmtOptional(entry.netPay),           { x: NJ_COL.netPay,     y, size: rowSize, font, color: black, maxWidth: 18 });

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
  data: NjPdfInput,
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

  // Paragraph 1 — statutory compliance certification referencing N.J.S.A. 34:11-56.25 et seq.
  const para1 =
    `I do hereby certify that the payroll records for the payroll period ending ${data.week.weekEndingDate} are correct and complete, ` +
    `and that the wage rate paid to each worker was not less than the applicable prevailing wage rate required by the ` +
    `New Jersey Prevailing Wage Act (N.J.S.A. 34:11-56.25 et seq.). Workers employed as apprentices were registered ` +
    `in accordance with applicable apprenticeship registration requirements.`;
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

  // Paragraph 2 — penalty of perjury
  const para2 =
    'The undersigned hereby certifies under penalty of perjury that the above information is true and correct.';
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

export async function fillNjCertifiedPayroll(data: NjPdfInput): Promise<Uint8Array> {
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
  // Unconditional addPage() — per Phase 43/50 pattern; compliance page never shares with worker rows.

  const compliancePage = addPage(pdfDoc);
  drawStatementOfCompliance(compliancePage, data, ctx);

  return pdfDoc.save();
}
