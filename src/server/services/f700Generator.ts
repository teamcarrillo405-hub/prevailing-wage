// src/server/services/f700Generator.ts
//
// Washington L&I F700-065-000 Certified Payroll Report — PDF fill stub.
// TODO (Plan 25-02): Implement coordinate-based text overlay once field
// coordinates are measured from the official blank form.
//
// ── PDF Asset Notes (measured 2026-03-25) ───────────────────────────────────
//
//   CURRENT ASSET: assets/f700-official.pdf is a PLACEHOLDER.
//   The official LNI form at https://lni.wa.gov/forms-publications/F700-065-000.pdf
//   returned 404. The authenticated portal at secure.lni.wa.gov/pubs/f700-065-000.pdf
//   redirects to a TAM login page — the PDF requires portal authentication to download.
//
//   PLACEHOLDER DIMENSIONS: 612 x 792 pt (8.5" x 11" letter, portrait, /Rotate=0)
//   PLACEHOLDER ACROFORM: None (flat PDF)
//
//   ACTION REQUIRED for Plan 25-02:
//     1. Obtain the official F700-065-000 blank form from LNI (credentials needed)
//        or from a licensed construction software vendor.
//     2. Replace assets/f700-official.pdf with the official blank form.
//     3. Use pdfminer to extract text positions (same as a1131-official.pdf process):
//          python -m pdfminer.high_level extract -al <form>.pdf > /tmp/f700-coords.txt
//     4. Measure /Rotate value from page dictionary — placeholder is 0 (portrait).
//        If actual form is rotated, apply CTM as done in a1131Generator.ts.
//     5. Fill in HEADER and COL constants below with measured coordinates.
//
//   EXPECTED FORM STRUCTURE (from secondary sources, MEDIUM confidence):
//     - Page 1: Worker grid with ST/OT columns (Mon-Sun), no DT column
//     - Header: Contractor Name, UBI Number, L&I Certificate #, WC Account #,
//               Project Name, Location, Contract/Bid #, Week Ending, Payroll No.
//     - Per-worker: Name, Address, SSN (last 4), J/RA, Trade Code (4-letter),
//                   ST Rate, Fringe Rate, Mon-Sun ST, OT Hours total,
//                   Gross Wages, Deductions, Net Pay
//     - Certification: RCW 39.12.020 penalty of perjury
//
//   ORIENTATION NOTE: The A-1-131 (Phase 24) appeared portrait but had /Rotate=90
//   requiring a CTM. Do NOT assume the F700 has the same orientation. Inspect the
//   official file directly before setting any coordinate constants.

import {
  PDFDocument,
  StandardFonts,
  rgb,
} from 'pdf-lib';

// ── WA L&I Trade Code Mapping ────────────────────────────────────────────────
//
// Source: points-north.com, workyard.com, construction-business-forms.com
// Confidence: MEDIUM — confirmed from multiple secondary sources;
// full official list should be validated against lni.wa.gov prevailing wage rates.
//
// Usage: If workerClassifications.tradeCode exactly matches a key here, use it
// directly on the F700. If not matched, use workerClassifications.waTradeCode
// override (if set by user), or leave blank and warn in PWIA modal.

export const WA_TRADE_CODES: Record<string, string> = {
  BOIL: 'Boilermakers',
  CARP: 'Carpenters',
  ELEC: 'Electricians (Inside)',
  ELCO: 'Electricians (Outside/Line)',
  GLAZ: 'Glaziers',
  IRON: 'Ironworkers',
  LABO: 'Laborers',
  MASO: 'Masons (Brick/Block)',
  OPER: 'Operating Engineers',
  PAIN: 'Painters',
  PFRT: 'Pile Drivers',
  PLAS: 'Plasterers',
  PLUM: 'Plumbers and Pipefitters',
  ROOF: 'Roofers',
  SHEE: 'Sheet Metal Workers',
  TEAM: 'Teamsters',
};

// ── Interfaces ───────────────────────────────────────────────────────────────

export interface F700WorkerRow {
  entryNo: number;
  workerName: string;
  identifyingNo: string;    // SSN last 4 — privacy default
  laborType: 'journeyworker' | 'apprentice';
  waTradeCode: string;      // 4-letter WA L&I code (CARP, ELEC, LABO, etc.)
  classification: string;   // human-readable description
  // Daily straight-time hours (Mon–Sun)
  monSt: number;
  tueSt: number;
  wedSt: number;
  thuSt: number;
  friSt: number;
  satSt: number;
  sunSt: number;
  // Daily overtime hours (Mon–Sun) — WA OT is 1.5x after 40 hrs/week (RCW 49.28.010)
  monOt: number;
  tueOt: number;
  wedOt: number;
  thuOt: number;
  friOt: number;
  satOt: number;
  sunOt: number;
  totalSt: number;
  totalOt: number;
  baseRate: number;         // straight-time rate (WA prevailing wage manual rate)
  otRate: number;           // 1.5x baseRate
  grossWages: number;
  deductions: number;
  netPay: number;
  fringeCredit: number;     // employer fringe benefit credit per hour
}

export interface F700Data {
  contractorName: string;
  contractorAddress: string;
  ubiNumber: string;        // WA 9-digit Unified Business Identifier
  lniCertificate: string;   // WA L&I contractor registration certificate #
  wcAccount: string;        // WA workers' compensation industrial insurance account #
  projectName: string;
  projectLocation: string;
  contractNo: string;
  weekEndingDate: string;
  payrollNumber: string;
  workers: F700WorkerRow[];
}

// ── Layout constants ─────────────────────────────────────────────────────────
//
// TODO (Plan 25-02): Replace all placeholder values with measured coordinates
// from the official F700-065-000 blank form.
// Placeholder values are 0 — fillF700() will render but text will appear at
// origin until real coordinates are measured and plugged in.

// ── WA F700-065A field coordinates (portrait, 8.5x11, 72 dpi PDF units) ──────
//
// Source: secondary sources (workyard.com, construction-business-forms.com).
// Confidence: MEDIUM — estimated from standard LNI form layout.
// TODO (Plan 25-02): Verify against the official blank form once obtained from LNI.
// Replace with pdfminer-measured values if they differ.

const HEADER = {
  contractorName:    { x: 85,  y: 698 },
  ubiNumber:         { x: 350, y: 698 },
  lniCertificate:    { x: 85,  y: 680 },
  wcAccount:         { x: 350, y: 680 },
  address:           { x: 85,  y: 662 },
  payrollNo:         { x: 500, y: 698 },
  weekEndingDate:    { x: 350, y: 644 },
  projectName:       { x: 85,  y: 644 },
  projectLocation:   { x: 85,  y: 626 },
  contractNo:        { x: 350, y: 626 },
} as const;

// Worker row layout — x-positions for each column, y-positions computed per row.
// Row 0 baseline y = 580; each subsequent row is 20pt lower.
const COL = {
  entryNo:        40,
  workerName:     70,
  identifyingNo:  195,
  laborType:      245,
  waTradeCode:    265,
  classification: 295,
  monHours:       370,
  tueHours:       393,
  wedHours:       416,
  thuHours:       439,
  friHours:       462,
  satHours:       485,
  sunHours:       508,
  totalStHours:   531,
  totalOtHours:   554,
  baseRate:       420,
  grossWages:     490,
  deductions:     540,
  netPay:         565,
  fringeCredit:   340,
} as const;

const ROW_BASE_Y  = 580;
const ROW_STEP_PT = 20;

const ROWS_PER_PAGE = 8;  // TODO: confirm from official form

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDollar(n: number): string {
  return n > 0 ? n.toFixed(2) : '';
}

function fmtHours(n: number): string {
  return n > 0 ? String(n) : '';
}

// ── Main export: fillF700 ─────────────────────────────────────────────────────
//
// Returns filled PDF bytes. Currently renders placeholder coordinates —
// all text will appear at (0,0) until HEADER and COL constants are populated
// with measured values from the official F700-065-000 form in Plan 25-02.

export async function fillF700(
  data: F700Data,
  templateBytes: Uint8Array | Buffer,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(templateBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const TEXT_SIZE = 8;
  const black = rgb(0, 0, 0);

  // ── Step 1: Chunk workers into groups of ROWS_PER_PAGE ──────────────────

  const chunks: F700WorkerRow[][] = [];
  for (let i = 0; i < data.workers.length; i += ROWS_PER_PAGE) {
    chunks.push(data.workers.slice(i, i + ROWS_PER_PAGE));
  }
  const totalPages = chunks.length === 0 ? 1 : chunks.length;

  // ── Step 2: Copy additional template pages if needed ─────────────────────

  for (let pageIdx = 1; pageIdx < totalPages; pageIdx++) {
    const [extraPage] = await pdfDoc.copyPages(pdfDoc, [0]);
    pdfDoc.addPage(extraPage);
  }

  const allPages = pdfDoc.getPages();

  // ── Step 3: Fill each page ────────────────────────────────────────────────
  //
  // TODO (Plan 25-02): Apply CTM here if form has /Rotate != 0.
  // See a1131Generator.ts for the CTM pattern: concatTransformationMatrix(0, 1, -1, 0, 612, 0)

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const page = allPages[pageIdx];

    // Helper: draw text at absolute page coordinates
    const dt = (text: string, x: number, y: number, opts?: { size?: number; maxWidth?: number }) => {
      if (!text) return;
      page.drawText(text, {
        x,
        y,
        size: opts?.size ?? TEXT_SIZE,
        font,
        color: black,
        maxWidth: opts?.maxWidth,
      });
    };

    // Header fields
    dt(data.contractorName,  HEADER.contractorName.x,  HEADER.contractorName.y,  { maxWidth: 200 });
    dt(data.ubiNumber,       HEADER.ubiNumber.x,       HEADER.ubiNumber.y);
    dt(data.lniCertificate,  HEADER.lniCertificate.x,  HEADER.lniCertificate.y);
    dt(data.wcAccount,       HEADER.wcAccount.x,       HEADER.wcAccount.y);
    dt(data.contractorAddress, HEADER.address.x,       HEADER.address.y,         { maxWidth: 200 });
    dt(data.payrollNumber,   HEADER.payrollNo.x,       HEADER.payrollNo.y);
    dt(data.weekEndingDate,  HEADER.weekEndingDate.x,  HEADER.weekEndingDate.y);
    dt(data.projectName,     HEADER.projectName.x,     HEADER.projectName.y,     { maxWidth: 200 });
    dt(data.projectLocation, HEADER.projectLocation.x, HEADER.projectLocation.y, { maxWidth: 200 });
    dt(data.contractNo,      HEADER.contractNo.x,      HEADER.contractNo.y);

    // Worker rows
    const chunk = chunks[pageIdx] ?? [];

    for (let i = 0; i < chunk.length; i++) {
      const w = chunk[i];
      // TODO (Plan 25-02): Replace 0 with actual Y position per row
      const rowY = ROW_BASE_Y - i * ROW_STEP_PT;

      dt(String(w.entryNo),   COL.entryNo,       rowY);
      dt(w.workerName,        COL.workerName,     rowY, { maxWidth: 80 });
      dt(w.identifyingNo,     COL.identifyingNo,  rowY);
      dt(w.laborType === 'journeyworker' ? 'J' : 'RA', COL.laborType, rowY);
      dt(w.waTradeCode,       COL.waTradeCode,    rowY);
      dt(w.classification,    COL.classification, rowY, { maxWidth: 60 });
      dt(fmtHours(w.monSt),   COL.monHours,       rowY);
      dt(fmtHours(w.tueSt),   COL.tueHours,       rowY);
      dt(fmtHours(w.wedSt),   COL.wedHours,       rowY);
      dt(fmtHours(w.thuSt),   COL.thuHours,       rowY);
      dt(fmtHours(w.friSt),   COL.friHours,       rowY);
      dt(fmtHours(w.satSt),   COL.satHours,       rowY);
      dt(fmtHours(w.sunSt),   COL.sunHours,       rowY);
      dt(fmtHours(w.totalSt), COL.totalStHours,   rowY);
      dt(fmtHours(w.totalOt), COL.totalOtHours,   rowY);
      dt(fmtDollar(w.baseRate),     COL.baseRate,     rowY);
      dt(fmtDollar(w.grossWages),   COL.grossWages,   rowY);
      dt(fmtDollar(w.deductions),   COL.deductions,   rowY);
      dt(fmtDollar(w.netPay),       COL.netPay,       rowY);
      dt(fmtDollar(w.fringeCredit), COL.fringeCredit, rowY);
    }
  }

  return pdfDoc.save();
}
