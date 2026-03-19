// src/server/services/wh347Generator.ts
//
// WH-347 PDF fill implementation using coordinate-based text overlay.
//
// Field discovery note (2026-03-19):
//   The official DOL WH-347 (January 2025 revision) downloaded from
//   https://www.dol.gov/sites/dolgov/files/WHD/legacy/files/wh347.pdf
//   is a FLAT (non-interactive) PDF — AcroForm /Fields[] is empty.
//   There are no AcroForm text field or checkbox widgets to target.
//   Strategy: use pdf-lib page.drawText() / page.drawRectangle() to
//   overlay content at measured (x, y) coordinates on the 792x612 pt pages.
//
// Coordinate system: pdf-lib uses PDF origin at BOTTOM-LEFT.
//   Page 1 and Page 2 are each 792 pts wide × 612 pts tall (landscape 11"×8.5").
//   Coordinates below were measured against the grid-annotated PDF:
//     wh347-grid.pdf (each grid line = 50 pts).
//
// NB: form.flatten() and form.getTextField() are NOT called — there are no
//     AcroForm fields to interact with. NeedAppearances is irrelevant for
//     flat PDFs (it only affects AcroForm widget appearance streams).
//     The DOL submission requirement is met because all field content is
//     rendered as real PDF text operators, visible in all PDF viewers without
//     any interaction required.

import { PDFDocument, PDFFont, StandardFonts, rgb } from 'pdf-lib';
import path from 'path';
import { readFileSync } from 'fs';

// ── Field coordinate map ───────────────────────────────────────────────────
// Each entry: { page: 0|1 (0-indexed), x, y } in pdf-lib coordinate space
// (origin = bottom-left of page).
//
// WH-347 page dimensions: 792 × 612 pt
// All coordinates are the START (left baseline) of the text to draw.
//
// Page 1 header rows (top area):
//   y≈460 = PROJECT NAME row data line
//   y≈435 = PROJECT LOCATION row data line
//
// Worker grid (8 rows), Page 1:
//   Rows counted top-to-bottom on screen = high y → low y in PDF coords.
//   Row 1 ST line ≈ y=313, OT line ≈ y=300
//   Each row pair (ST/OT) is ≈ 26 pts tall, rows are ≈ 26 pts apart
//
// Page 2 header: y≈568 (top label row), y≈540 (second row)
// Compliance checkboxes: drawn as filled squares at measured positions
// Signature block: near bottom of page 2

export const WH347_FIELDS = {
  // ── Page 1 Header ──────────────────────────────────────────────────────
  // Row 1 of the orange header band: PROJECT NAME | PROJECT NO. | CERTIFIED PAYROLL NO. | BUSINESS NAME
  // Row 2: PROJECT LOCATION | WAGE DETERMINATION NO. | WEEK ENDING DATE | BUSINESS ADDRESS
  // Row 3 checkboxes: FINAL | PRIME CONTRACTOR | SUBCONTRACTOR

  // Checkbox row (y≈500) — drawn as filled rectangles
  checkboxFinal:            { page: 0, x: 39,  y: 497, type: 'checkbox' },
  checkboxPrime:            { page: 0, x: 645, y: 497, type: 'checkbox' },
  checkboxSubcontractor:    { page: 0, x: 756, y: 497, type: 'checkbox' },

  // Header row 1 — data entry cells (y≈458 = data line inside the cell)
  projectName:              { page: 0, x: 39,  y: 458, type: 'text' },
  projectContractNo:        { page: 0, x: 300, y: 458, type: 'text' },
  payrollNumber:            { page: 0, x: 510, y: 458, type: 'text' },
  contractorName:           { page: 0, x: 630, y: 458, type: 'text' },

  // Header row 2 — data entry cells (y≈433)
  projectLocation:          { page: 0, x: 39,  y: 433, type: 'text' },
  wageDeterminationNo:      { page: 0, x: 300, y: 433, type: 'text' },
  weekEndingDate:           { page: 0, x: 510, y: 433, type: 'text' },
  contractorAddress:        { page: 0, x: 630, y: 433, type: 'text' },

  // ── Page 1 Worker Grid ─────────────────────────────────────────────────
  // 8 worker rows, each has ST and OT sub-rows.
  // Column x-positions (measured from grid):
  //   (1A) Entry#: x≈39
  //   (1B) Last Name: x≈60
  //   (1C) First Name: x≈108
  //   (1D) Middle Initial: x≈157
  //   (1E) Identifying No.: x≈175
  //   (J/RA) Type checkbox: x≈200
  //   (2) Classification: x≈225
  //   Hours columns (ST row): Mon=280, Tue=304, Wed=328, Thu=352, Fri=376, Sat=400
  //   (5) Total Hours: x≈424
  //   (6A) Base Rate: x≈449
  //   (6B) Fringe Credit: x≈475
  //   (6C) Payment in Lieu: x≈502
  //   (7A) Gross Amt Project: x≈529
  //   (7B) Gross Amt All: x≈555
  //   (8) Deductions Tax: x≈580, FICA: x≈600, Other: x≈620, Total: x≈640
  //   (9) Net Pay: x≈660
  //
  // Row 1 ST line y≈313; OT y≈300
  // Each subsequent row: -26 pts per worker entry (ST/OT pair height ≈26)
  // Row 1: y=313/300, Row2: y=287/274, Row3: y=261/248, Row4: y=235/222
  // Row 5: y=209/196, Row6: y=183/170, Row7: y=157/144, Row8: y=131/118

  // ── Page 2 Header ──────────────────────────────────────────────────────
  p2_projectName:           { page: 1, x: 39,  y: 568, type: 'text' },
  p2_projectContractNo:     { page: 1, x: 360, y: 568, type: 'text' },
  p2_payrollNo:             { page: 1, x: 550, y: 568, type: 'text' },
  p2_contractorName:        { page: 1, x: 650, y: 568, type: 'text' },
  p2_projectLocation:       { page: 1, x: 39,  y: 543, type: 'text' },
  p2_weekEndingDate:        { page: 1, x: 550, y: 543, type: 'text' },
  p2_certifyingOfficial:    { page: 1, x: 650, y: 543, type: 'text' },

  // ── Page 2 Compliance checkboxes ───────────────────────────────────────
  // Five checkboxes on left margin, measured y positions:
  certProperPayment:        { page: 1, x: 39,  y: 488, type: 'checkbox' },
  certAccuratePayroll:      { page: 1, x: 39,  y: 447, type: 'checkbox' },
  certWorkPerformed:        { page: 1, x: 39,  y: 417, type: 'checkbox' },
  certApprentices:          { page: 1, x: 39,  y: 378, type: 'checkbox' },
  certFringeBenefits:       { page: 1, x: 39,  y: 298, type: 'checkbox' },

  // ── Page 2 Signature block ─────────────────────────────────────────────
  // Bottom row: SIGNATURE | DATE | TELEPHONE | EMAIL
  signatureDate:            { page: 1, x: 510, y: 63, type: 'text' },
  phoneNumber:              { page: 1, x: 655, y: 63, type: 'text' },
} as const;

// ── Interfaces ─────────────────────────────────────────────────────────────

export interface Wh347WorkerRow {
  entryNo: number;
  workerName: string;
  laborType: 'journeyworker' | 'apprentice';
  identifyingNo: string;
  classification: string;
  monSt: number; monOt: number;
  tueSt: number; tueOt: number;
  wedSt: number; wedOt: number;
  thuSt: number; thuOt: number;
  friSt: number; friOt: number;
  satSt: number; satOt: number;
  totalSt: number;
  totalOt: number;
  baseRate: number;
  fringeCredit: number;
  grossWagesProject: number;
  grossWagesAll: number;
  deductions: number;
  netPay: number;
}

export interface Wh347Compliance {
  certProperPayment: boolean;
  certAccuratePayroll: boolean;
  certWorkPerformed: boolean;
  certApprentices: boolean;
  certFringeBenefits: boolean;
  certDeductions: boolean;
  officialName: string;
  officialTitle: string;
  signatureDate: string;
  phoneNumber: string;
}

export interface Wh347Data {
  // Header fields (Page 1)
  contractorName: string;
  contractorAddress: string;
  payrollNumber: string;
  weekEndingDate: string;
  projectName: string;
  projectLocation?: string;
  projectContractNo: string;
  wageDeterminationNo: string;
  isFinal?: boolean;
  isPrime?: boolean;    // true = Prime, false = Subcontractor

  // Per-worker rows (up to 8)
  workers: Wh347WorkerRow[];

  // Statement of Compliance (Page 2)
  compliance: Wh347Compliance;
}

// ── Layout constants for worker grid ──────────────────────────────────────

const WORKER_COLUMNS = {
  entryNo:        39,
  lastName:       52,
  firstName:      100,
  middleInitial:  155,
  identifyingNo:  172,
  laborTypeBox:   198,   // checkbox square x position
  classification: 220,
  // Hour columns (ST row)
  monHours:       278,
  tueHours:       303,
  wedHours:       327,
  thuHours:       351,
  friHours:       375,
  satHours:       399,
  totalHours:     422,
  baseRate:       445,
  fringeCredit:   471,
  grossProject:   525,
  grossAll:       551,
  deductions:     635,
  netPay:         658,
} as const;

// Y positions for each of 8 worker rows (ST line, OT line)
// Measured from grid: Row 1 ST = 313, OT = 300; spacing = 26 pts per row
const WORKER_ROW_Y: Array<{ st: number; ot: number }> = [
  { st: 313, ot: 300 },
  { st: 287, ot: 274 },
  { st: 261, ot: 248 },
  { st: 235, ot: 222 },
  { st: 209, ot: 196 },
  { st: 183, ot: 170 },
  { st: 157, ot: 144 },
  { st: 131, ot: 118 },
];

// ── Helper: draw a checkbox mark ──────────────────────────────────────────

function drawCheckbox(
  page: { drawRectangle: Function },
  x: number,
  y: number,
  checked: boolean,
): void {
  if (!checked) return;
  // Draw a filled black square (8×8 pt) to represent a checked checkbox
  (page as any).drawRectangle({
    x: x + 1,
    y: y + 1,
    width: 7,
    height: 7,
    color: rgb(0, 0, 0),
  });
}

// ── Helper: format number as dollar string ────────────────────────────────

function fmtDollar(n: number): string {
  return n.toFixed(2);
}

// ── Helper: format hours (0 shown as blank, positive as string) ───────────

function fmtHours(n: number): string {
  return n > 0 ? String(n) : '';
}

// ── Main export ────────────────────────────────────────────────────────────

export async function fillWh347(
  data: Wh347Data,
  templateBytes: Uint8Array,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(templateBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();
  const [page1, page2] = pages;

  const TEXT_SIZE = 7;
  const SMALL_SIZE = 6;
  const black = rgb(0, 0, 0);

  // ── Page 1 Header ────────────────────────────────────────────────────────

  // Checkboxes: FINAL, PRIME, SUBCONTRACTOR
  if (data.isFinal) {
    drawCheckbox(page1 as any, WH347_FIELDS.checkboxFinal.x, WH347_FIELDS.checkboxFinal.y, true);
  }
  if (data.isPrime !== false) {
    // Default: Prime Contractor
    drawCheckbox(page1 as any, WH347_FIELDS.checkboxPrime.x, WH347_FIELDS.checkboxPrime.y, true);
  } else {
    drawCheckbox(page1 as any, WH347_FIELDS.checkboxSubcontractor.x, WH347_FIELDS.checkboxSubcontractor.y, true);
  }

  // Header row 1
  page1.drawText(data.projectName,      { x: WH347_FIELDS.projectName.x,      y: WH347_FIELDS.projectName.y,      size: TEXT_SIZE, font, color: black });
  page1.drawText(data.projectContractNo,{ x: WH347_FIELDS.projectContractNo.x, y: WH347_FIELDS.projectContractNo.y, size: TEXT_SIZE, font, color: black });
  page1.drawText(data.payrollNumber,    { x: WH347_FIELDS.payrollNumber.x,    y: WH347_FIELDS.payrollNumber.y,    size: TEXT_SIZE, font, color: black });
  page1.drawText(data.contractorName,   { x: WH347_FIELDS.contractorName.x,   y: WH347_FIELDS.contractorName.y,   size: TEXT_SIZE, font, color: black });

  // Header row 2
  page1.drawText(data.projectLocation ?? '',     { x: WH347_FIELDS.projectLocation.x,     y: WH347_FIELDS.projectLocation.y,     size: TEXT_SIZE, font, color: black });
  page1.drawText(data.wageDeterminationNo,        { x: WH347_FIELDS.wageDeterminationNo.x,  y: WH347_FIELDS.wageDeterminationNo.y,  size: TEXT_SIZE, font, color: black });
  page1.drawText(data.weekEndingDate,             { x: WH347_FIELDS.weekEndingDate.x,        y: WH347_FIELDS.weekEndingDate.y,        size: TEXT_SIZE, font, color: black });
  page1.drawText(data.contractorAddress,          { x: WH347_FIELDS.contractorAddress.x,    y: WH347_FIELDS.contractorAddress.y,    size: TEXT_SIZE, font, color: black });

  // ── Page 1 Worker Rows ───────────────────────────────────────────────────

  const maxRows = Math.min(data.workers.length, 8);
  for (let i = 0; i < maxRows; i++) {
    const w = data.workers[i];
    const row = WORKER_ROW_Y[i];
    const stY = row.st;
    const otY = row.ot;

    // Split workerName into last/first/middle if comma-separated, otherwise put all in last
    let lastName = w.workerName;
    let firstName = '';
    let middle = '';
    if (w.workerName.includes(',')) {
      const parts = w.workerName.split(',');
      lastName = (parts[0] ?? '').trim();
      const rest = (parts[1] ?? '').trim().split(' ');
      firstName = rest[0] ?? '';
      middle = rest[1] ?? '';
    }

    // Column (1A) Entry No
    page1.drawText(String(w.entryNo), { x: WORKER_COLUMNS.entryNo, y: stY, size: SMALL_SIZE, font, color: black });
    // (1B-1D) Name
    page1.drawText(lastName,  { x: WORKER_COLUMNS.lastName,  y: stY, size: SMALL_SIZE, font, color: black, maxWidth: 46 });
    page1.drawText(firstName, { x: WORKER_COLUMNS.firstName, y: stY, size: SMALL_SIZE, font, color: black, maxWidth: 43 });
    page1.drawText(middle,    { x: WORKER_COLUMNS.middleInitial, y: stY, size: SMALL_SIZE, font, color: black, maxWidth: 15 });
    // (1E) Identifying No
    page1.drawText(w.identifyingNo, { x: WORKER_COLUMNS.identifyingNo, y: stY, size: SMALL_SIZE, font, color: black, maxWidth: 24 });
    // (J/RA) Labor type: print J or RA
    const laborLabel = w.laborType === 'journeyworker' ? 'J' : 'RA';
    page1.drawText(laborLabel, { x: WORKER_COLUMNS.laborTypeBox, y: stY, size: SMALL_SIZE, font: boldFont, color: black });
    // (2) Classification
    page1.drawText(w.classification, { x: WORKER_COLUMNS.classification, y: stY, size: SMALL_SIZE, font, color: black, maxWidth: 52 });

    // Hours — ST row
    page1.drawText(fmtHours(w.monSt), { x: WORKER_COLUMNS.monHours, y: stY, size: SMALL_SIZE, font, color: black });
    page1.drawText(fmtHours(w.tueSt), { x: WORKER_COLUMNS.tueHours, y: stY, size: SMALL_SIZE, font, color: black });
    page1.drawText(fmtHours(w.wedSt), { x: WORKER_COLUMNS.wedHours, y: stY, size: SMALL_SIZE, font, color: black });
    page1.drawText(fmtHours(w.thuSt), { x: WORKER_COLUMNS.thuHours, y: stY, size: SMALL_SIZE, font, color: black });
    page1.drawText(fmtHours(w.friSt), { x: WORKER_COLUMNS.friHours, y: stY, size: SMALL_SIZE, font, color: black });
    page1.drawText(fmtHours(w.satSt), { x: WORKER_COLUMNS.satHours, y: stY, size: SMALL_SIZE, font, color: black });

    // Hours — OT row
    page1.drawText(fmtHours(w.monOt), { x: WORKER_COLUMNS.monHours, y: otY, size: SMALL_SIZE, font, color: black });
    page1.drawText(fmtHours(w.tueOt), { x: WORKER_COLUMNS.tueHours, y: otY, size: SMALL_SIZE, font, color: black });
    page1.drawText(fmtHours(w.wedOt), { x: WORKER_COLUMNS.wedHours, y: otY, size: SMALL_SIZE, font, color: black });
    page1.drawText(fmtHours(w.thuOt), { x: WORKER_COLUMNS.thuHours, y: otY, size: SMALL_SIZE, font, color: black });
    page1.drawText(fmtHours(w.friOt), { x: WORKER_COLUMNS.friHours, y: otY, size: SMALL_SIZE, font, color: black });
    page1.drawText(fmtHours(w.satOt), { x: WORKER_COLUMNS.satHours, y: otY, size: SMALL_SIZE, font, color: black });

    // Total hours (ST/OT on their respective lines)
    page1.drawText(fmtHours(w.totalSt), { x: WORKER_COLUMNS.totalHours, y: stY, size: SMALL_SIZE, font, color: black });
    page1.drawText(fmtHours(w.totalOt), { x: WORKER_COLUMNS.totalHours, y: otY, size: SMALL_SIZE, font, color: black });

    // Rates and pay (on ST row)
    page1.drawText(fmtDollar(w.baseRate),          { x: WORKER_COLUMNS.baseRate,     y: stY, size: SMALL_SIZE, font, color: black });
    page1.drawText(fmtDollar(w.fringeCredit),      { x: WORKER_COLUMNS.fringeCredit, y: stY, size: SMALL_SIZE, font, color: black });
    page1.drawText(fmtDollar(w.grossWagesProject),  { x: WORKER_COLUMNS.grossProject, y: stY, size: SMALL_SIZE, font, color: black });
    page1.drawText(fmtDollar(w.grossWagesAll),      { x: WORKER_COLUMNS.grossAll,     y: stY, size: SMALL_SIZE, font, color: black });
    page1.drawText(fmtDollar(w.deductions),         { x: WORKER_COLUMNS.deductions,   y: stY, size: SMALL_SIZE, font, color: black });
    page1.drawText(fmtDollar(w.netPay),             { x: WORKER_COLUMNS.netPay,       y: stY, size: SMALL_SIZE, font, color: black });
  }

  // ── Page 2 Header ────────────────────────────────────────────────────────

  page2.drawText(data.projectName,          { x: WH347_FIELDS.p2_projectName.x,       y: WH347_FIELDS.p2_projectName.y,       size: TEXT_SIZE, font, color: black });
  page2.drawText(data.projectContractNo,    { x: WH347_FIELDS.p2_projectContractNo.x, y: WH347_FIELDS.p2_projectContractNo.y, size: TEXT_SIZE, font, color: black });
  page2.drawText(data.payrollNumber,        { x: WH347_FIELDS.p2_payrollNo.x,         y: WH347_FIELDS.p2_payrollNo.y,         size: TEXT_SIZE, font, color: black });
  page2.drawText(data.contractorName,       { x: WH347_FIELDS.p2_contractorName.x,    y: WH347_FIELDS.p2_contractorName.y,    size: TEXT_SIZE, font, color: black });
  page2.drawText(data.projectLocation ?? '',{ x: WH347_FIELDS.p2_projectLocation.x,   y: WH347_FIELDS.p2_projectLocation.y,   size: TEXT_SIZE, font, color: black });
  page2.drawText(data.weekEndingDate,       { x: WH347_FIELDS.p2_weekEndingDate.x,    y: WH347_FIELDS.p2_weekEndingDate.y,    size: TEXT_SIZE, font, color: black });

  // Certifying official name and title combined
  const officialLine = `${data.compliance.officialName}, ${data.compliance.officialTitle}`;
  page2.drawText(officialLine, { x: WH347_FIELDS.p2_certifyingOfficial.x, y: WH347_FIELDS.p2_certifyingOfficial.y, size: TEXT_SIZE, font, color: black, maxWidth: 130 });

  // ── Page 2 Compliance Checkboxes ─────────────────────────────────────────

  drawCheckbox(page2 as any, WH347_FIELDS.certProperPayment.x,    WH347_FIELDS.certProperPayment.y,    data.compliance.certProperPayment);
  drawCheckbox(page2 as any, WH347_FIELDS.certAccuratePayroll.x,  WH347_FIELDS.certAccuratePayroll.y,  data.compliance.certAccuratePayroll);
  drawCheckbox(page2 as any, WH347_FIELDS.certWorkPerformed.x,    WH347_FIELDS.certWorkPerformed.y,    data.compliance.certWorkPerformed);
  drawCheckbox(page2 as any, WH347_FIELDS.certApprentices.x,      WH347_FIELDS.certApprentices.y,      data.compliance.certApprentices);
  drawCheckbox(page2 as any, WH347_FIELDS.certFringeBenefits.x,   WH347_FIELDS.certFringeBenefits.y,   data.compliance.certFringeBenefits);

  // ── Page 2 Signature Block ────────────────────────────────────────────────

  page2.drawText(data.compliance.signatureDate, { x: WH347_FIELDS.signatureDate.x, y: WH347_FIELDS.signatureDate.y, size: TEXT_SIZE, font, color: black });
  page2.drawText(data.compliance.phoneNumber,   { x: WH347_FIELDS.phoneNumber.x,   y: WH347_FIELDS.phoneNumber.y,   size: TEXT_SIZE, font, color: black });
  // Certifying official name also appears in the signature area
  page2.drawText(data.compliance.officialName,  { x: 39,  y: WH347_FIELDS.signatureDate.y, size: TEXT_SIZE, font, color: black });

  return pdfDoc.save();
}

// ── Convenience: load template from assets directory ──────────────────────

export function getWh347TemplateBytes(): Uint8Array {
  const templatePath = path.join(process.cwd(), 'assets', 'wh347-official-2025.pdf');
  return readFileSync(templatePath);
}
