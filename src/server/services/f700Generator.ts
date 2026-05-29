// src/server/services/f700Generator.ts
//
// Washington State L&I F700-065-000 Certified Payroll Report
// Built from scratch with pdf-lib — landscape 11" × 8.5"
// No template PDF required; all layout is programmatic.
//
// Required fields (RCW 39.12.020):
//   Contractor, UBI, L&I Certificate, WC Account, Project, Contract No,
//   Week Ending, Payroll No, per-worker: name, SSN-last-4, J/RA,
//   trade code, daily ST hours, total OT, base rate, fringe, gross, deductions, net.
//
// Certification: "Under penalty of perjury as defined in RCW 9A.72.020,
// I declare that the information on this form is true and correct."

import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from 'pdf-lib';

// ── WA L&I Trade Code Mapping ────────────────────────────────────────────────

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
  identifyingNo: string;
  laborType: 'journeyworker' | 'apprentice';
  waTradeCode: string;
  classification: string;
  monSt: number; tueSt: number; wedSt: number; thuSt: number;
  friSt: number; satSt: number; sunSt: number;
  monOt: number; tueOt: number; wedOt: number; thuOt: number;
  friOt: number; satOt: number; sunOt: number;
  totalSt: number;
  totalOt: number;
  baseRate: number;
  otRate: number;
  grossWages: number;
  deductions: number;
  netPay: number;
  fringeCredit: number;
}

export interface F700Data {
  contractorName: string;
  contractorAddress: string;
  ubiNumber: string;
  lniCertificate: string;
  wcAccount: string;
  projectName: string;
  projectLocation: string;
  contractNo: string;
  weekEndingDate: string;
  payrollNumber: string;
  workers: F700WorkerRow[];
}

// ── Layout ────────────────────────────────────────────────────────────────────

const PW = 792;   // landscape: 11"
const PH = 612;   // landscape: 8.5"
const ML = 28;
const MR = 28;
const MT = 28;
const CW = PW - ML - MR;

// Colors
const NAVY    = rgb(0.05, 0.18, 0.40);
const WA_TEAL = rgb(0.00, 0.44, 0.56);
const WHITE   = rgb(1, 1, 1);
const LTGRAY  = rgb(0.93, 0.93, 0.93);
const MIDGRAY = rgb(0.65, 0.65, 0.65);
const BLACK   = rgb(0, 0, 0);

// Table column x-positions and widths (landscape, left-to-right)
const COLS = {
  no:        { x: ML,       w: 20  },   // #
  name:      { x: ML+20,    w: 90  },   // Worker Name
  ssn:       { x: ML+110,   w: 36  },   // ID No
  jr:        { x: ML+146,   w: 20  },   // J/RA
  trade:     { x: ML+166,   w: 30  },   // Trade
  mon:       { x: ML+196,   w: 28  },   // Mon
  tue:       { x: ML+224,   w: 28  },   // Tue
  wed:       { x: ML+252,   w: 28  },   // Wed
  thu:       { x: ML+280,   w: 28  },   // Thu
  fri:       { x: ML+308,   w: 28  },   // Fri
  sat:       { x: ML+336,   w: 28  },   // Sat
  sun:       { x: ML+364,   w: 28  },   // Sun
  totSt:     { x: ML+392,   w: 34  },   // Tot ST
  totOt:     { x: ML+426,   w: 34  },   // Tot OT
  stRate:    { x: ML+460,   w: 48  },   // ST Rate
  fringe:    { x: ML+508,   w: 44  },   // Fringe/hr
  gross:     { x: ML+552,   w: 52  },   // Gross Wages
  ded:       { x: ML+604,   w: 48  },   // Deductions
  net:       { x: ML+652,   w: 48  },   // Net Pay (ends at ~MR=28, total=700)
};

const ROWS_PER_PAGE = 8;
const ROW_H = 18;
const THEAD_H = 24;
const HEADER_H = 108;  // title bar + field block

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtH(n: number): string { return n > 0 ? String(n % 1 === 0 ? n : n.toFixed(1)) : ''; }
function fmtD(n: number): string { return n !== 0 ? n.toFixed(2) : ''; }
function truncate(s: string, maxChars: number): string {
  return s.length > maxChars ? s.slice(0, maxChars - 1) + '…' : s;
}

function cell(
  page: PDFPage,
  text: string,
  col: { x: number; w: number },
  y: number,
  font: PDFFont,
  size: number,
  align: 'left' | 'center' | 'right' = 'left',
  color = BLACK,
) {
  if (!text) return;
  const tw = font.widthOfTextAtSize(text, size);
  let tx = col.x + 2;
  if (align === 'center') tx = col.x + (col.w - tw) / 2;
  if (align === 'right')  tx = col.x + col.w - tw - 2;
  page.drawText(text, { x: Math.max(tx, col.x + 1), y, size, font, color, maxWidth: col.w - 2 });
}

function hline(page: PDFPage, x1: number, x2: number, y: number, thickness = 0.4, color = MIDGRAY) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
}
function vline(page: PDFPage, x: number, y1: number, y2: number, thickness = 0.4, color = MIDGRAY) {
  page.drawLine({ start: { x, y: y1 }, end: { x, y: y2 }, thickness, color });
}

// ── Header block (drawn once per page) ───────────────────────────────────────

function drawPageHeader(
  page: PDFPage,
  bold: PDFFont,
  reg: PDFFont,
  data: F700Data,
  pageNum: number,
  totalPages: number,
  y0: number,
): number {
  let y = y0;

  // ── Title bar ──────────────────────────────────────────────────────────────
  page.drawRectangle({ x: ML, y: y - 24, width: CW, height: 24, color: NAVY });
  page.drawText('Washington State Department of Labor & Industries', {
    x: ML + 8, y: y - 17, size: 9, font: bold, color: WHITE,
  });
  page.drawText('Certified Payroll Report — F700-065-000', {
    x: ML + 8, y: y - 27 + 7, size: 7, font: reg, color: rgb(0.75, 0.90, 1.0),
  });
  page.drawText(`RCW 39.12.020  |  Page ${pageNum} of ${totalPages}`, {
    x: PW - MR - 120, y: y - 17, size: 7, font: reg, color: WHITE,
  });
  y -= 26;

  // ── Two-column field block ─────────────────────────────────────────────────
  const mid = ML + CW / 2 + 10;
  const lw = mid - ML - 12;
  const rw = PW - MR - mid - 4;

  const field = (label: string, value: string, lx: number, ly: number, fw: number) => {
    page.drawText(label, { x: lx, y: ly, size: 6.5, font: reg, color: MIDGRAY });
    page.drawText(truncate(value || '—', 50), { x: lx, y: ly - 9, size: 8, font: bold, color: BLACK, maxWidth: fw });
    hline(page, lx, lx + fw, ly - 10, 0.5, LTGRAY);
  };

  const lx = ML;
  const rx = mid;
  let ly = y - 4;

  field('Contractor Name',         data.contractorName,    lx, ly, lw);
  field('Project Name',             data.projectName,       rx, ly, rw);
  ly -= 22;
  field('Address',                  data.contractorAddress, lx, ly, lw);
  field('Project Location',         data.projectLocation,   rx, ly, rw);
  ly -= 22;
  field('UBI Number',               data.ubiNumber,         lx,       ly, lw * 0.30);
  field('L&I Certificate No.',      data.lniCertificate,    lx + lw * 0.33, ly, lw * 0.30);
  field('WC Account No.',           data.wcAccount,         lx + lw * 0.67, ly, lw * 0.30);
  field('Contract / Bid No.',       data.contractNo,        rx,       ly, rw * 0.48);
  field('Week Ending',              data.weekEndingDate,    rx + rw * 0.50, ly, rw * 0.24);
  field('Payroll No.',              data.payrollNumber,     rx + rw * 0.76, ly, rw * 0.24);

  y = ly - 18;
  hline(page, ML, ML + CW, y, 0.6, NAVY);
  return y;
}

// ── Table header row ──────────────────────────────────────────────────────────

function drawTableHeader(page: PDFPage, bold: PDFFont, y: number): number {
  // Background band
  page.drawRectangle({ x: ML, y: y - THEAD_H, width: CW, height: THEAD_H, color: WA_TEAL });

  const th = (text: string, col: { x: number; w: number }, top = true) => {
    const ty = top ? y - 9 : y - 18;
    cell(page, text, col, ty, bold, 6, 'center', WHITE);
  };

  // Row 1 labels
  th('#',            COLS.no);
  th('Worker Name',  COLS.name);
  th('ID No.',       COLS.ssn);
  th('J/RA',         COLS.jr);
  th('Trade',        COLS.trade);
  th('Mon',          COLS.mon);
  th('Tue',          COLS.tue);
  th('Wed',          COLS.wed);
  th('Thu',          COLS.thu);
  th('Fri',          COLS.fri);
  th('Sat',          COLS.sat);
  th('Sun',          COLS.sun);
  th('Tot ST',       COLS.totSt);
  th('Tot OT',       COLS.totOt);
  th('ST Rate',      COLS.stRate);
  th('Fringe/hr',    COLS.fringe);
  th('Gross Wages',  COLS.gross);
  th('Deductions',   COLS.ded);
  th('Net Pay',      COLS.net);

  // Vertical dividers
  const divX = [
    COLS.ssn.x, COLS.jr.x, COLS.trade.x, COLS.mon.x,
    COLS.totSt.x, COLS.stRate.x, COLS.gross.x, COLS.ded.x, COLS.net.x,
    COLS.net.x + COLS.net.w,
  ];
  for (const x of divX) vline(page, x, y - THEAD_H, y, 0.3, rgb(0.5, 0.7, 0.9));

  return y - THEAD_H;
}

// ── Worker data row ───────────────────────────────────────────────────────────

function drawWorkerRow(page: PDFPage, bold: PDFFont, reg: PDFFont, w: F700WorkerRow, y: number, shade: boolean) {
  if (shade) {
    page.drawRectangle({ x: ML, y: y - ROW_H + 2, width: CW, height: ROW_H - 1, color: LTGRAY });
  }

  const ty = y - ROW_H + 5;

  cell(page, String(w.entryNo),                    COLS.no,    ty, reg,  7, 'center');
  cell(page, truncate(w.workerName, 18),            COLS.name,  ty, bold, 7, 'left');
  cell(page, w.identifyingNo || '—',               COLS.ssn,   ty, reg,  7, 'center');
  cell(page, w.laborType === 'journeyworker' ? 'J' : 'RA', COLS.jr, ty, bold, 7, 'center');
  cell(page, w.waTradeCode,                         COLS.trade, ty, reg,  7, 'center');

  cell(page, fmtH(w.monSt), COLS.mon,   ty, reg, 7, 'center');
  cell(page, fmtH(w.tueSt), COLS.tue,   ty, reg, 7, 'center');
  cell(page, fmtH(w.wedSt), COLS.wed,   ty, reg, 7, 'center');
  cell(page, fmtH(w.thuSt), COLS.thu,   ty, reg, 7, 'center');
  cell(page, fmtH(w.friSt), COLS.fri,   ty, reg, 7, 'center');
  cell(page, fmtH(w.satSt), COLS.sat,   ty, reg, 7, 'center');
  cell(page, fmtH(w.sunSt), COLS.sun,   ty, reg, 7, 'center');

  cell(page, fmtH(w.totalSt),           COLS.totSt,  ty, bold, 7, 'center');
  cell(page, fmtH(w.totalOt),           COLS.totOt,  ty, bold, 7, 'center');
  cell(page, `$${w.baseRate.toFixed(2)}`,COLS.stRate, ty, reg,  7, 'right');
  cell(page, fmtD(w.fringeCredit),      COLS.fringe, ty, reg,  7, 'right');
  cell(page, `$${fmtD(w.grossWages)}`,  COLS.gross,  ty, bold, 7, 'right');
  cell(page, fmtD(w.deductions),        COLS.ded,    ty, reg,  7, 'right');
  cell(page, `$${fmtD(w.netPay)}`,      COLS.net,    ty, bold, 7, 'right');

  hline(page, ML, ML + CW, y - ROW_H + 2, 0.3, MIDGRAY);

  // Vertical column dividers (light)
  const divX = [
    COLS.ssn.x, COLS.jr.x, COLS.trade.x, COLS.mon.x,
    COLS.totSt.x, COLS.stRate.x, COLS.gross.x, COLS.ded.x, COLS.net.x,
    COLS.net.x + COLS.net.w,
  ];
  for (const x of divX) vline(page, x, y - ROW_H + 2, y + 2, 0.3, MIDGRAY);
}

// ── Totals row ────────────────────────────────────────────────────────────────

function drawTotalsRow(page: PDFPage, bold: PDFFont, workers: F700WorkerRow[], y: number) {
  const totSt    = workers.reduce((a, w) => a + w.totalSt, 0);
  const totOt    = workers.reduce((a, w) => a + w.totalOt, 0);
  const totGross = workers.reduce((a, w) => a + w.grossWages, 0);
  const totDed   = workers.reduce((a, w) => a + w.deductions, 0);
  const totNet   = workers.reduce((a, w) => a + w.netPay, 0);

  page.drawRectangle({ x: ML, y: y - ROW_H + 2, width: CW, height: ROW_H - 1, color: rgb(0.92, 0.95, 0.98) });

  const ty = y - ROW_H + 5;
  cell(page, 'TOTALS', COLS.no, ty, bold, 7, 'left', NAVY);
  cell(page, fmtH(totSt),              COLS.totSt,  ty, bold, 7, 'center', NAVY);
  cell(page, fmtH(totOt),              COLS.totOt,  ty, bold, 7, 'center', NAVY);
  cell(page, `$${totGross.toFixed(2)}`, COLS.gross, ty, bold, 7, 'right',  NAVY);
  cell(page, totDed.toFixed(2),        COLS.ded,    ty, bold, 7, 'right',  NAVY);
  cell(page, `$${totNet.toFixed(2)}`,  COLS.net,    ty, bold, 7, 'right',  NAVY);

  hline(page, ML, ML + CW, y - ROW_H + 2, 0.8, NAVY);
}

// ── Certification block ───────────────────────────────────────────────────────

function drawCertification(page: PDFPage, bold: PDFFont, reg: PDFFont, y: number) {
  const CERT_TEXT =
    'Under penalty of perjury as defined in RCW 9A.72.020, I declare that the information on this report is true and correct ' +
    'and that all workers listed have been paid the prevailing wage required by RCW 39.12.020 and Chapter 296-127 WAC.';

  page.drawRectangle({ x: ML, y: y - 56, width: CW, height: 56, color: rgb(0.97, 0.98, 1.0) });
  hline(page, ML, ML + CW, y, 0.8, NAVY);
  hline(page, ML, ML + CW, y - 56, 0.8, NAVY);

  page.drawText('Certification — RCW 39.12.020', { x: ML + 6, y: y - 10, size: 7, font: bold, color: NAVY });
  page.drawText(CERT_TEXT, { x: ML + 6, y: y - 21, size: 6.5, font: reg, color: BLACK, maxWidth: CW * 0.60 });

  // Signature fields
  const sf = (label: string, sx: number, sy: number, sw: number) => {
    page.drawText(label, { x: sx, y: sy - 7, size: 6, font: reg, color: MIDGRAY });
    hline(page, sx, sx + sw, sy - 8, 0.5, MIDGRAY);
  };

  const sigX = ML + CW * 0.62;
  sf('Signature',            sigX,        y - 14, 180);
  sf('Printed Name & Title', sigX,        y - 30, 180);
  sf('Date',                 sigX + 190,  y - 14, 80);
  sf('Phone',                sigX + 190,  y - 30, 80);
}

// ── Footer ─────────────────────────────────────────────────────────────────

function drawFooter(page: PDFPage, reg: PDFFont, y: number) {
  page.drawText(
    'Washington State Department of Labor & Industries  |  F700-065-000 Certified Payroll Report  |  Generated by AVERO Prevailing Wage',
    { x: ML, y, size: 5.5, font: reg, color: MIDGRAY },
  );
}

// ── Main export: fillF700 ─────────────────────────────────────────────────────

export async function fillF700(
  data: F700Data,
  _templateBytes?: Uint8Array | Buffer,  // no longer used — kept for route signature compat
): Promise<Uint8Array> {
  const chunks: F700WorkerRow[][] = [];
  for (let i = 0; i < data.workers.length; i += ROWS_PER_PAGE) {
    chunks.push(data.workers.slice(i, i + ROWS_PER_PAGE));
  }
  const totalPages = Math.max(chunks.length, 1);

  const pdfDoc = await PDFDocument.create();
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const page = pdfDoc.addPage([PW, PH]);
    let y = PH - MT;

    y = drawPageHeader(page, bold, reg, data, pageIdx + 1, totalPages, y);
    y -= 4;
    y = drawTableHeader(page, bold, y);

    const chunk = chunks[pageIdx] ?? [];
    for (let i = 0; i < chunk.length; i++) {
      drawWorkerRow(page, bold, reg, chunk[i], y, i % 2 === 1);
      y -= ROW_H;
    }

    // Totals row on last page only
    if (pageIdx === totalPages - 1 && data.workers.length > 0) {
      y -= 2;
      drawTotalsRow(page, bold, data.workers, y);
      y -= ROW_H + 4;
    }

    drawCertification(page, bold, reg, Math.min(y - 4, MT + 58));
    drawFooter(page, reg, MT - 10);
  }

  return pdfDoc.save();
}
