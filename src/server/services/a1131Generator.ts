// src/server/services/a1131Generator.ts
//
// California DIR A-1-131 PDF fill implementation using coordinate-based text overlay.
//
// Field discovery note (2026-03-25):
//   The official DIR A-1-131 is a FLAT PDF stored as portrait (612×1008) with
//   page rotation=90° (CW). The viewer rotates the whole page 90° CW on display,
//   producing a landscape (1008×612) form.
//
//   To draw text that appears horizontal on the landscape form, we apply a
//   CTM (concat transformation matrix) of [0, 1, -1, 0, 612, 0] to the page
//   content stream. This pre-rotates our drawing context 90° CCW, cancelling
//   out the page's 90° CW display rotation.
//
//   After applying the CTM, ALL coordinates are in LANDSCAPE space:
//     lx: 0–1008 (left=0, right=1008)
//     ly: 0–612  (bottom=0, top=612)
//
//   The cert page (page 2) has /Rotate=0 and native portrait dimensions
//   (612×1008). Its content stream ends with an active translation CTM
//   "1 0 0 1 79.08 788.76 cm". drawText calls appended by pdf-lib are in
//   that shifted user space, so coordinates = page_position − (79.08, 788.76).

import {
  PDFDocument,
  StandardFonts,
  rgb,
  pushGraphicsState,
  popGraphicsState,
  concatTransformationMatrix,
} from 'pdf-lib';

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
  stRate: number;
  otRate: number;
  dtRate: number;
  grossWages: number;
  federalTax: number;
  stateTax: number;
  sdi: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
  fringeCredit: number;
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

// ── Layout constants (ALL in LANDSCAPE space: lx 0–1008, ly 0–612) ──────────
//
// Column positions verified via pdfminer text extraction from a1131-official.pdf.
// pdfminer bbox for page 1 is (0,0,1008,612) — already in landscape coords
// after applying /Rotate 90, so pdfminer x == lx directly.

// Header data field positions — where we draw the actual values
const HEADER = {
  contractorName:    { lx: 315, ly: 535 },   // blank starts after "NAME OF CONTRACTOR:" label (x1≈314)
  cslbLicense:       { lx: 618, ly: 535 },   // blank starts after "CONTRACTOR'S LICENSE NO.:" (x1≈616)
  address:           { lx: 770, ly: 535 },   // blank starts after "ADDRESS:" label (x1≈768)
  payrollNo:         { lx: 283, ly: 514 },   // blank starts after "PAYROLL NO.:" label (x1≈279)
  weekEndingDate:    { lx: 454, ly: 514 },   // blank starts after "FOR WEEK ENDING:" label (x1≈446)
  wcPolicyNumber:    { lx: 675, ly: 497 },   // blank starts after "WORKERS' COMPENSATION POLICY NO.:" (x1≈672)
  projectNo:         { lx: 866, ly: 514 },   // blank starts after "PROJECT OR CONTRACT NO.:" (x1≈863)
  projectLocation:   { lx: 856, ly: 497 },   // blank starts after "PROJECT AND LOCATION:" (x1≈853)
} as const;

// Worker row column x-positions (landscape lx)
// All positions from pdfminer extraction: lx == pdfminer x for page 1 (/Rotate 90).
// CA A-1-131 column order: (1) Name | ID | J/RA | (3) Classification |
//   (4) M T W TH F S S | (5) Total | (6) Rate | (7) Gross | Deductions | (8) Net | (9) Fringe
const COL = {
  entryNo:         205,   // Column (2) — NO. OF WITHHOLDING EXEMPTIONS, pdfminer "(2)" x0=205
  workerName:       57,   // Column (1) left margin — pdfminer "NAME, ADDRESS AND" x0=56
  identifyingNo:   228,   // SSN last 4
  laborType:       252,   // J or RA
  classification:  265,   // Column (3), label at pdfminer x0=257
  // Day columns: Mon first — CA form shows M T W TH F S S
  // pdfminer: M(325) T(344) W(357) TH(379) F(401) S(419) S(437)
  monHours:        327,
  tueHours:        344,
  wedHours:        357,
  thuHours:        379,
  friHours:        401,
  satHours:        419,
  sunHours:        437,
  totalHours:      462,   // Column (5), pdfminer label x0=459
  hourlyRate:      499,   // Column (6), pdfminer label x0=496
  grossWages:      540,   // Column (7) THIS PROJECT, pdfminer sub-label x0=537
  fedTax:          638,   // pdfminer FED TAX x0=637
  stateTax:        720,   // pdfminer STATE TAX x0=719
  sdi:             761,   // pdfminer SDI x0=760
  otherDeductions: 830,   // pdfminer HEALTH x0=829 (catch-all other deductions)
  // totalDeductions drawn at stY-39 — matches pdfminer "TOTAL DEDUC-TIONS" label position
  totalDeductions: 869,   // pdfminer TOTAL DEDUC-TIONS x0=869 (drawn at stY-39)
  netPay:          912,   // pdfminer NET WGS x0=911
  fringeCredit:    912,   // NET WGS column — employer fringe credit drawn at otY to avoid overlap with netPay
} as const;

const ROWS_PER_PAGE = 5;

// Worker block Y positions (landscape ly, counted from top down).
// From pdfminer: first worker S label at y0=391, S-to-S block spacing=92,
// S-to-O sub-row spacing=47. Confirmed by 4 visible worker blocks in template.
function getWorkerRowLY(workerIdx: number): { st: number; ot: number; dt: number } {
  const baseY = 391;
  const blockSpacing = 92;
  const subRowSpacing = 47;
  const stY = baseY - workerIdx * blockSpacing;
  return {
    st: stY,
    ot: stY - subRowSpacing,
    dt: stY - subRowSpacing * 2,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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
  const totalPageSets = chunks.length === 0 ? 1 : chunks.length;

  // ── Step 2: Copy additional template pages ───────────────────────────────

  for (let setIdx = 1; setIdx < totalPageSets; setIdx++) {
    const [extraWorkerPage] = await pdfDoc.copyPages(pdfDoc, [0]);
    const [extraCertPage] = await pdfDoc.copyPages(pdfDoc, [1]);
    pdfDoc.addPage(extraWorkerPage);
    pdfDoc.addPage(extraCertPage);
  }

  const allPages = pdfDoc.getPages();

  // ── Step 3: Fill each worker-grid page ───────────────────────────────────

  for (let setIdx = 0; setIdx < totalPageSets; setIdx++) {
    const workerPage = allPages[setIdx * 2];

    // Apply CTM so we draw in landscape coordinates.
    // The page has rotation=90° (CW). Applying [0, 1, -1, 0, 612, 0] rotates
    // our drawing context 90° CCW, cancelling the page rotation.
    // After this, lx=0–1008 (left→right) and ly=0–612 (bottom→top).
    workerPage.pushOperators(
      pushGraphicsState(),
      concatTransformationMatrix(0, 1, -1, 0, 612, 0),
    );

    // Helper: draw text at landscape position
    const dt = (text: string, lx: number, ly: number, opts?: { size?: number; bold?: boolean; maxWidth?: number }) => {
      workerPage.drawText(text, {
        x: lx,
        y: ly,
        size: opts?.size ?? TEXT_SIZE,
        font: opts?.bold ? boldFont : font,
        color: black,
        maxWidth: opts?.maxWidth,
      });
    };

    // Header fields
    dt(data.contractorName,    HEADER.contractorName.lx,    HEADER.contractorName.ly,    { maxWidth: 380 });
    dt(data.cslbLicense,       HEADER.cslbLicense.lx,       HEADER.cslbLicense.ly,       { maxWidth: 200 });
    dt(data.contractorAddress, HEADER.address.lx,           HEADER.address.ly,           { maxWidth: 200 });
    dt(data.payrollNumber,     HEADER.payrollNo.lx,         HEADER.payrollNo.ly);
    dt(data.weekEndingDate,    HEADER.weekEndingDate.lx,    HEADER.weekEndingDate.ly);
    dt(data.wcPolicyNumber,    HEADER.wcPolicyNumber.lx,    HEADER.wcPolicyNumber.ly,    { maxWidth: 280 });
    dt(data.contractNo,        HEADER.projectNo.lx,         HEADER.projectNo.ly,         { maxWidth: 200 });
    dt(data.projectLocation,   HEADER.projectLocation.lx,  HEADER.projectLocation.ly,   { maxWidth: 200 });

    if (totalPageSets > 1) {
      dt(`Page ${setIdx + 1} of ${totalPageSets}`, 940, 556);
    }

    // Worker rows
    const chunk = chunks[setIdx] ?? [];

    for (let i = 0; i < chunk.length; i++) {
      const w = chunk[i];
      const rowY = getWorkerRowLY(i);
      const stY = rowY.st;
      const otY = rowY.ot;
      const dtY = rowY.dt;

      // Entry number
      dt(String(w.entryNo), COL.entryNo, stY, { size: SMALL_SIZE });

      // Worker name
      let displayName = w.workerName;
      if (w.workerName.includes(',')) {
        const [last, rest] = w.workerName.split(',');
        displayName = `${(last ?? '').trim()}, ${(rest ?? '').trim()}`;
      }
      dt(displayName, COL.workerName, stY, { size: SMALL_SIZE, maxWidth: 43 });

      // Identifying No (SSN last 4)
      dt(w.identifyingNo, COL.identifyingNo, stY, { size: SMALL_SIZE });

      // Labor type: J or RA
      const laborLabel = w.laborType === 'journeyworker' ? 'J' : 'RA';
      dt(laborLabel, COL.laborType, stY, { size: SMALL_SIZE, bold: true });

      // Classification
      dt(w.classification, COL.classification, stY, { size: SMALL_SIZE, maxWidth: 42 });

      // NOTE: S / O / DT labels are pre-printed on the form — do not draw them

      // ST hours (Mon first — CA form column order: M T W TH F S S)
      dt(fmtHours(w.monSt), COL.monHours, stY, { size: SMALL_SIZE });
      dt(fmtHours(w.tueSt), COL.tueHours, stY, { size: SMALL_SIZE });
      dt(fmtHours(w.wedSt), COL.wedHours, stY, { size: SMALL_SIZE });
      dt(fmtHours(w.thuSt), COL.thuHours, stY, { size: SMALL_SIZE });
      dt(fmtHours(w.friSt), COL.friHours, stY, { size: SMALL_SIZE });
      dt(fmtHours(w.satSt), COL.satHours, stY, { size: SMALL_SIZE });
      dt(fmtHours(w.sunSt), COL.sunHours, stY, { size: SMALL_SIZE });
      dt(fmtHours(w.totalSt), COL.totalHours, stY, { size: SMALL_SIZE });
      dt(fmtDollar(w.stRate), COL.hourlyRate, stY, { size: SMALL_SIZE });

      // OT hours
      dt(fmtHours(w.monOt), COL.monHours, otY, { size: SMALL_SIZE });
      dt(fmtHours(w.tueOt), COL.tueHours, otY, { size: SMALL_SIZE });
      dt(fmtHours(w.wedOt), COL.wedHours, otY, { size: SMALL_SIZE });
      dt(fmtHours(w.thuOt), COL.thuHours, otY, { size: SMALL_SIZE });
      dt(fmtHours(w.friOt), COL.friHours, otY, { size: SMALL_SIZE });
      dt(fmtHours(w.satOt), COL.satHours, otY, { size: SMALL_SIZE });
      dt(fmtHours(w.sunOt), COL.sunHours, otY, { size: SMALL_SIZE });
      dt(fmtHours(w.totalOt), COL.totalHours, otY, { size: SMALL_SIZE });
      dt(fmtDollar(w.otRate), COL.hourlyRate, otY, { size: SMALL_SIZE });

      // DT hours (CA-specific)
      dt(fmtHours(w.monDt), COL.monHours, dtY, { size: SMALL_SIZE });
      dt(fmtHours(w.tueDt), COL.tueHours, dtY, { size: SMALL_SIZE });
      dt(fmtHours(w.wedDt), COL.wedHours, dtY, { size: SMALL_SIZE });
      dt(fmtHours(w.thuDt), COL.thuHours, dtY, { size: SMALL_SIZE });
      dt(fmtHours(w.friDt), COL.friHours, dtY, { size: SMALL_SIZE });
      dt(fmtHours(w.satDt), COL.satHours, dtY, { size: SMALL_SIZE });
      dt(fmtHours(w.sunDt), COL.sunHours, dtY, { size: SMALL_SIZE });
      dt(fmtHours(w.totalDt), COL.totalHours, dtY, { size: SMALL_SIZE });
      dt(fmtDollar(w.dtRate), COL.hourlyRate, dtY, { size: SMALL_SIZE });

      // Gross wages, deductions, net pay — on ST row
      dt(fmtDollar(w.grossWages),      COL.grossWages,      stY, { size: SMALL_SIZE });
      dt(fmtDollar(w.federalTax),      COL.fedTax,          stY, { size: SMALL_SIZE });
      dt(fmtDollar(w.stateTax),        COL.stateTax,        stY, { size: SMALL_SIZE });
      dt(fmtDollar(w.sdi),             COL.sdi,             stY, { size: SMALL_SIZE });
      dt(fmtDollar(w.otherDeductions), COL.otherDeductions, stY, { size: SMALL_SIZE });
      dt(fmtDollar(w.totalDeductions), COL.totalDeductions, stY - 39, { size: SMALL_SIZE });
      dt(fmtDollar(w.netPay),          COL.netPay,          stY,  { size: SMALL_SIZE });
      dt(fmtDollar(w.fringeCredit),    COL.fringeCredit,    otY,  { size: SMALL_SIZE });
    }

    // Restore graphics state
    workerPage.pushOperators(popGraphicsState());
  }

  // ── Step 4: Fill certification page ──────────────────────────────────────
  // Page 2: /Rotate=0, mediabox 612×1008 (portrait).
  //
  // pdf-lib's normalize() wraps every page's existing template content with
  // shared document-level q/Q streams:
  //   [q_stream, template_stream(s), Q_stream, our_new_stream]
  // The Q stream RESTORES graphics state to identity before our new stream
  // runs — so the translation CTM "1 0 0 1 79.08 788.76 cm" inside the
  // template stream is already undone. Draw at ABSOLUTE portrait coords.
  //
  // Blank positions (absolute portrait coords, y from bottom of 612×1008 page):
  //   x=80,  y=630 — "[company name], certify under penalty of perjury..." blank
  //   x=375, y=588 — "...consisting of [payroll description]" blank
  //   x=108, y=451 — "Date: ___" blank

  for (let setIdx = 0; setIdx < totalPageSets; setIdx++) {
    const certPage = allPages[setIdx * 2 + 1];

    // Business / contractor name on the "[company name], certify..." blank
    certPage.drawText(data.contractorName, {
      x: 80, y: 630,
      size: TEXT_SIZE, font, color: black, maxWidth: 290,
    });
    // Payroll description in the "...consisting of [description]" blank
    certPage.drawText(`Payroll #${data.payrollNumber} — ${data.projectLocation}`, {
      x: 375, y: 588,
      size: TEXT_SIZE, font, color: black, maxWidth: 160,
    });
    // Week ending date on the "Date: ___" blank
    certPage.drawText(data.weekEndingDate, {
      x: 108, y: 451,
      size: TEXT_SIZE, font, color: black,
    });
  }

  return pdfDoc.save();
}
