// src/server/services/a1131Generator.ts
//
// California DIR A-1-131 PDF fill implementation using coordinate-based text overlay.
//
// Field discovery note (2026-03-24):
//   The official DIR A-1-131 is a FLAT PDF — coordinate overlay approach used
//   (same as WH-347 generator). Page dimensions: 612 x 1008 pt (portrait legal 8.5"x14").
//
// Coordinate system: pdf-lib uses PDF origin at BOTTOM-LEFT.
//   Page dimensions: 612 pts wide × 1008 pts tall.
//
// Key CA-specific differences from WH-347:
//   - Day order: Sun, Mon, Tue, Wed, Thu, Fri, Sat (Sunday FIRST)
//   - Three rows per worker: ST / OT / DT
//   - SDI is a named deduction field (not generic "Other")
//   - CSLB License and WC Policy in header section
//   - Fringe contributions in a SEPARATE section — NOT included in totalDeductions

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface A1131WorkerRow {
  entryNo: number;
  workerName: string;
  identifyingNo: string;   // SSN last 4 (privacy default = empty string)
  laborType: 'journeyworker' | 'apprentice';
  classification: string;
  // Daily hours: Sun-Sat order (Sunday FIRST — CA form)
  sunSt: number; sunOt: number; sunDt: number;
  monSt: number; monOt: number; monDt: number;
  tueSt: number; tueOt: number; tueDt: number;
  wedSt: number; wedOt: number; wedDt: number;
  thuSt: number; thuOt: number; thuDt: number;
  friSt: number; friOt: number; friDt: number;
  satSt: number; satOt: number; satDt: number;
  totalSt: number;
  totalOt: number;
  totalDt: number;
  stRate: number;      // base rate (1.0x)
  otRate: number;      // 1.5x base
  dtRate: number;      // 2.0x base
  grossWages: number;
  // Deductions
  federalTax: number;
  stateTax: number;
  sdi: number;         // CA State Disability Insurance
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
  // Fringe contributions (SEPARATE from deductions)
  fringeCredit: number; // per-hour fringe rate * total hours
}

export interface A1131Data {
  contractorName: string;
  contractorAddress: string;
  cslbLicense: string;
  wcPolicyNumber: string;
  projectName: string;
  projectLocation: string;
  contractNo: string;
  wageDeterminationNo: string;
  weekEndingDate: string;
  payrollNumber: string;
  workers: A1131WorkerRow[];
}

// ── Layout constants ─────────────────────────────────────────────────────────
//
// Page is 612 x 1008 pt (portrait legal).
// Coordinates measured from bottom-left (pdf-lib convention).
//
// Header section occupies top ~180 pts of the page (y ≈ 828 to 1008).
// Worker grid occupies the middle section.
// Fringe/deductions summary at the bottom.
//
// Worker grid: ~5 workers per page, 3 rows each (ST/OT/DT).
// Row height: ~40 pts per worker (3 sub-rows @ ~13 pts each + spacing).

// Header field y-positions (from bottom of page, legal 8.5"x14"):
// Top of page ≈ 1008, bottom ≈ 0.
// Header area: y ~820-1000.
const HEADER = {
  // Row 1: Contractor name / address / CSLB / WC Policy
  contractorName:    { x: 70,  y: 920 },
  contractorAddress: { x: 70,  y: 905 },
  cslbLicense:       { x: 370, y: 920 },
  wcPolicyNumber:    { x: 370, y: 905 },
  // Row 2: Project name / location
  projectName:       { x: 70,  y: 882 },
  projectLocation:   { x: 70,  y: 867 },
  // Row 3: Contract no / WD no / Week ending / Payroll no
  contractNo:        { x: 70,  y: 845 },
  wageDeterminationNo: { x: 230, y: 845 },
  weekEndingDate:    { x: 400, y: 845 },
  payrollNumber:     { x: 520, y: 845 },
} as const;

// Worker grid column x-positions
const WORKER_COLS = {
  entryNo:        36,
  workerName:     52,
  identifyingNo:  135,
  laborType:      168,
  classification: 185,
  // Hour columns (Sun first)
  sunHours:       250,
  monHours:       272,
  tueHours:       294,
  wedHours:       316,
  thuHours:       338,
  friHours:       360,
  satHours:       382,
  totalHours:     404,
  // Rates
  stRate:         424,
  otRate:         448,
  dtRate:         472,
  grossWages:     496,
  // Deductions
  fedTax:         524,
  stateTax:       548,
  sdi:            572,
  totalDeductions: 596,
  netPay:         572,  // netPay uses same area as right side
} as const;

// Workers per page and row Y positions
// Page is legal (1008 pts), header takes ~200 pts, footer ~100 pts
// Available for workers: ~708 pts, 5 workers × 3 rows each = 15 sub-rows
// Each sub-row ≈ 13 pts, worker spacing ≈ 40 pts
const ROWS_PER_PAGE = 5;

// Y positions for each worker group (ST, OT, DT sub-rows)
// Starting from top (high y) to bottom (low y), below header
function getWorkerRowY(workerIdx: number): { st: number; ot: number; dt: number } {
  // First worker starts at y ≈ 810, each worker group is ~42 pts apart
  const baseY = 808;
  const rowSpacing = 42;
  const subRowSpacing = 14;
  const stY = baseY - (workerIdx * rowSpacing);
  return {
    st: stY,
    ot: stY - subRowSpacing,
    dt: stY - (subRowSpacing * 2),
  };
}

// ── Helper functions ─────────────────────────────────────────────────────────

function fmtDollar(n: number): string {
  return n > 0 ? n.toFixed(2) : '';
}

function fmtHours(n: number): string {
  return n > 0 ? String(n) : '';
}

// ── Main export: fillA1131 ───────────────────────────────────────────────────

export async function fillA1131(
  data: A1131Data,
  templateBytes: Uint8Array | Buffer,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(templateBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const TEXT_SIZE = 7;
  const SMALL_SIZE = 6;
  const black = rgb(0, 0, 0);

  // ── Step 1: Chunk workers into groups of ROWS_PER_PAGE ──────────────────

  const chunks: A1131WorkerRow[][] = [];
  for (let i = 0; i < data.workers.length; i += ROWS_PER_PAGE) {
    chunks.push(data.workers.slice(i, i + ROWS_PER_PAGE));
  }
  // Always have at least 1 page set (even with 0 workers)
  const totalPageSets = chunks.length === 0 ? 1 : chunks.length;

  // ── Step 2: Copy additional template pages BEFORE filling any content ───
  // Template has 2 pages: [0] worker grid page, [1] certification page.
  // For each additional page set beyond the first, append both template pages.

  for (let setIdx = 1; setIdx < totalPageSets; setIdx++) {
    const [extraWorkerPage] = await pdfDoc.copyPages(pdfDoc, [0]);
    const [extraCertPage] = await pdfDoc.copyPages(pdfDoc, [1]);
    pdfDoc.addPage(extraWorkerPage);
    pdfDoc.addPage(extraCertPage);
  }

  const allPages = pdfDoc.getPages();

  // ── Step 3: Fill header + workers on each worker-grid page ───────────────

  for (let setIdx = 0; setIdx < totalPageSets; setIdx++) {
    const workerPage = allPages[setIdx * 2];

    // Header fields
    workerPage.drawText(data.contractorName,      { x: HEADER.contractorName.x,    y: HEADER.contractorName.y,    size: TEXT_SIZE, font, color: black, maxWidth: 280 });
    workerPage.drawText(data.contractorAddress,   { x: HEADER.contractorAddress.x, y: HEADER.contractorAddress.y, size: TEXT_SIZE, font, color: black, maxWidth: 280 });
    workerPage.drawText(data.cslbLicense,         { x: HEADER.cslbLicense.x,       y: HEADER.cslbLicense.y,       size: TEXT_SIZE, font, color: black, maxWidth: 220 });
    workerPage.drawText(data.wcPolicyNumber,      { x: HEADER.wcPolicyNumber.x,    y: HEADER.wcPolicyNumber.y,    size: TEXT_SIZE, font, color: black, maxWidth: 220 });
    workerPage.drawText(data.projectName,         { x: HEADER.projectName.x,       y: HEADER.projectName.y,       size: TEXT_SIZE, font, color: black, maxWidth: 530 });
    workerPage.drawText(data.projectLocation,     { x: HEADER.projectLocation.x,   y: HEADER.projectLocation.y,   size: TEXT_SIZE, font, color: black, maxWidth: 530 });
    workerPage.drawText(data.contractNo,          { x: HEADER.contractNo.x,        y: HEADER.contractNo.y,        size: TEXT_SIZE, font, color: black, maxWidth: 150 });
    workerPage.drawText(data.wageDeterminationNo, { x: HEADER.wageDeterminationNo.x, y: HEADER.wageDeterminationNo.y, size: TEXT_SIZE, font, color: black, maxWidth: 160 });
    workerPage.drawText(data.weekEndingDate,      { x: HEADER.weekEndingDate.x,    y: HEADER.weekEndingDate.y,    size: TEXT_SIZE, font, color: black });
    workerPage.drawText(data.payrollNumber,       { x: HEADER.payrollNumber.x,     y: HEADER.payrollNumber.y,     size: TEXT_SIZE, font, color: black });

    // Page X of Y notation for multi-page
    if (totalPageSets > 1) {
      workerPage.drawText(`Page ${setIdx + 1} of ${totalPageSets}`, {
        x: 540,
        y: 845,
        size: SMALL_SIZE,
        font,
        color: black,
      });
    }

    // ── Step 4: Fill worker rows ─────────────────────────────────────────

    const chunk = chunks[setIdx] ?? [];

    for (let i = 0; i < chunk.length; i++) {
      const w = chunk[i];
      const rowY = getWorkerRowY(i);
      const stY = rowY.st;
      const otY = rowY.ot;
      const dtY = rowY.dt;

      // Entry number (on ST row)
      workerPage.drawText(String(w.entryNo), { x: WORKER_COLS.entryNo, y: stY, size: SMALL_SIZE, font, color: black });

      // Worker name — split last/first if comma-separated
      let displayName = w.workerName;
      if (w.workerName.includes(',')) {
        const [last, rest] = w.workerName.split(',');
        displayName = `${(last ?? '').trim()}, ${(rest ?? '').trim()}`;
      }
      workerPage.drawText(displayName, { x: WORKER_COLS.workerName, y: stY, size: SMALL_SIZE, font, color: black, maxWidth: 80 });

      // Identifying No (SSN last 4)
      workerPage.drawText(w.identifyingNo, { x: WORKER_COLS.identifyingNo, y: stY, size: SMALL_SIZE, font, color: black });

      // Labor type: J or RA (on ST row)
      const laborLabel = w.laborType === 'journeyworker' ? 'J' : 'RA';
      workerPage.drawText(laborLabel, { x: WORKER_COLS.laborType, y: stY, size: SMALL_SIZE, font: boldFont, color: black });

      // Classification (on ST row)
      workerPage.drawText(w.classification, { x: WORKER_COLS.classification, y: stY, size: SMALL_SIZE, font, color: black, maxWidth: 60 });

      // Hours — ST row (Sun first)
      workerPage.drawText(fmtHours(w.sunSt), { x: WORKER_COLS.sunHours, y: stY, size: SMALL_SIZE, font, color: black });
      workerPage.drawText(fmtHours(w.monSt), { x: WORKER_COLS.monHours, y: stY, size: SMALL_SIZE, font, color: black });
      workerPage.drawText(fmtHours(w.tueSt), { x: WORKER_COLS.tueHours, y: stY, size: SMALL_SIZE, font, color: black });
      workerPage.drawText(fmtHours(w.wedSt), { x: WORKER_COLS.wedHours, y: stY, size: SMALL_SIZE, font, color: black });
      workerPage.drawText(fmtHours(w.thuSt), { x: WORKER_COLS.thuHours, y: stY, size: SMALL_SIZE, font, color: black });
      workerPage.drawText(fmtHours(w.friSt), { x: WORKER_COLS.friHours, y: stY, size: SMALL_SIZE, font, color: black });
      workerPage.drawText(fmtHours(w.satSt), { x: WORKER_COLS.satHours, y: stY, size: SMALL_SIZE, font, color: black });
      workerPage.drawText(fmtHours(w.totalSt), { x: WORKER_COLS.totalHours, y: stY, size: SMALL_SIZE, font, color: black });

      // Rates (on ST row)
      workerPage.drawText(fmtDollar(w.stRate), { x: WORKER_COLS.stRate, y: stY, size: SMALL_SIZE, font, color: black });

      // Hours — OT row (Sun first)
      workerPage.drawText(fmtHours(w.sunOt), { x: WORKER_COLS.sunHours, y: otY, size: SMALL_SIZE, font, color: black });
      workerPage.drawText(fmtHours(w.monOt), { x: WORKER_COLS.monHours, y: otY, size: SMALL_SIZE, font, color: black });
      workerPage.drawText(fmtHours(w.tueOt), { x: WORKER_COLS.tueHours, y: otY, size: SMALL_SIZE, font, color: black });
      workerPage.drawText(fmtHours(w.wedOt), { x: WORKER_COLS.wedHours, y: otY, size: SMALL_SIZE, font, color: black });
      workerPage.drawText(fmtHours(w.thuOt), { x: WORKER_COLS.thuHours, y: otY, size: SMALL_SIZE, font, color: black });
      workerPage.drawText(fmtHours(w.friOt), { x: WORKER_COLS.friHours, y: otY, size: SMALL_SIZE, font, color: black });
      workerPage.drawText(fmtHours(w.satOt), { x: WORKER_COLS.satHours, y: otY, size: SMALL_SIZE, font, color: black });
      workerPage.drawText(fmtHours(w.totalOt), { x: WORKER_COLS.totalHours, y: otY, size: SMALL_SIZE, font, color: black });
      workerPage.drawText(fmtDollar(w.otRate), { x: WORKER_COLS.otRate, y: otY, size: SMALL_SIZE, font, color: black });

      // Hours — DT row (Sun first) — CA-specific
      workerPage.drawText(fmtHours(w.sunDt), { x: WORKER_COLS.sunHours, y: dtY, size: SMALL_SIZE, font, color: black });
      workerPage.drawText(fmtHours(w.monDt), { x: WORKER_COLS.monHours, y: dtY, size: SMALL_SIZE, font, color: black });
      workerPage.drawText(fmtHours(w.tueDt), { x: WORKER_COLS.tueHours, y: dtY, size: SMALL_SIZE, font, color: black });
      workerPage.drawText(fmtHours(w.wedDt), { x: WORKER_COLS.wedHours, y: dtY, size: SMALL_SIZE, font, color: black });
      workerPage.drawText(fmtHours(w.thuDt), { x: WORKER_COLS.thuHours, y: dtY, size: SMALL_SIZE, font, color: black });
      workerPage.drawText(fmtHours(w.friDt), { x: WORKER_COLS.friHours, y: dtY, size: SMALL_SIZE, font, color: black });
      workerPage.drawText(fmtHours(w.satDt), { x: WORKER_COLS.satHours, y: dtY, size: SMALL_SIZE, font, color: black });
      workerPage.drawText(fmtHours(w.totalDt), { x: WORKER_COLS.totalHours, y: dtY, size: SMALL_SIZE, font, color: black });
      workerPage.drawText(fmtDollar(w.dtRate), { x: WORKER_COLS.dtRate, y: dtY, size: SMALL_SIZE, font, color: black });

      // Gross wages, deductions, net pay (on ST row)
      workerPage.drawText(fmtDollar(w.grossWages),      { x: WORKER_COLS.grossWages,    y: stY, size: SMALL_SIZE, font, color: black });
      workerPage.drawText(fmtDollar(w.federalTax),      { x: WORKER_COLS.fedTax,        y: stY, size: SMALL_SIZE, font, color: black });
      workerPage.drawText(fmtDollar(w.stateTax),        { x: WORKER_COLS.stateTax,      y: stY, size: SMALL_SIZE, font, color: black });
      workerPage.drawText(fmtDollar(w.sdi),             { x: WORKER_COLS.sdi,           y: stY, size: SMALL_SIZE, font, color: black });
      workerPage.drawText(fmtDollar(w.totalDeductions), { x: WORKER_COLS.totalDeductions, y: stY, size: SMALL_SIZE, font, color: black });
      workerPage.drawText(fmtDollar(w.netPay),          { x: WORKER_COLS.netPay,        y: otY, size: SMALL_SIZE, font, color: black });

      // Fringe credit — in separate section (below deductions area on same row)
      // The A-1-131 has a fringe contributions section below each worker's deductions.
      // Draw it on the DT row right side to distinguish from deductions.
      workerPage.drawText(fmtDollar(w.fringeCredit),    { x: 548, y: dtY, size: SMALL_SIZE, font, color: black });
    }
  }

  // ── Step 5: Fill certification page (page 2) for each page set ──────────
  // The A-1-131 page 2 is the penalty of perjury statement / signature page.
  // We fill contractor name, week ending, payroll number as identifiers.

  for (let setIdx = 0; setIdx < totalPageSets; setIdx++) {
    const certPage = allPages[setIdx * 2 + 1];

    // Basic identifier fields on certification page
    certPage.drawText(data.contractorName,  { x: 70,  y: 920, size: TEXT_SIZE, font, color: black, maxWidth: 280 });
    certPage.drawText(data.projectName,     { x: 70,  y: 890, size: TEXT_SIZE, font, color: black, maxWidth: 530 });
    certPage.drawText(data.weekEndingDate,  { x: 400, y: 890, size: TEXT_SIZE, font, color: black });
    certPage.drawText(data.payrollNumber,   { x: 520, y: 890, size: TEXT_SIZE, font, color: black });
  }

  return pdfDoc.save();
}
