// src/server/services/txCprPdfGenerator.ts
//
// Texas DOT Contractor's Certified Statement of Compliance — PWC-1 form
// Generated programmatically using pdf-lib (landscape letter format).
//
// No fillable PDF template is used — all content is drawn from scratch.
// Coordinate system: pdf-lib origin is at BOTTOM-LEFT.
//   Page dimensions: 792 × 612 pt (landscape 11" × 8.5")
//
// Sections:
//   1. Header — form title and state label
//   2. Project info row — project name, TXDOT project ID, contractor FEIN
//   3. Worker table — name, classification, ST/OT hours, base rate, gross, deductions, net
//   4. Certification statement
//   5. Footer — form ID "Texas Prevailing Wage - Form PWC-1"

import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from 'pdf-lib';

// ── Layout constants ──────────────────────────────────────────────────────────

const PAGE_W = 792;  // landscape width
const PAGE_H = 612;  // landscape height
const MARGIN = 36;
const CONTENT_W = PAGE_W - 2 * MARGIN;

// Row heights
const HEADER_H = 56;
const FIELD_ROW_H = 22;
const TABLE_HEADER_H = 18;
const TABLE_ROW_H = 16;
const CERT_H = 72;
const FOOTER_H = 18;

// Colors
const NAVY = rgb(0.10, 0.17, 0.27);
const GOLD = rgb(0.87, 0.71, 0.00);
const WHITE = rgb(1, 1, 1);
const LIGHT_GRAY = rgb(0.95, 0.95, 0.95);
const MED_GRAY = rgb(0.70, 0.70, 0.70);
const BLACK = rgb(0, 0, 0);

// ── Type definitions ──────────────────────────────────────────────────────────

export interface TxCprInput {
  contractor: {
    name: string;
    fein: string;
    address: string;
    txContractorLicense: string | null;
  };
  project: {
    name: string;
    txdotProjectId: string | null;
    txAwardingAgency: string | null;
    location: string;
  };
  week: {
    weekEndingDate: string;   // ISO YYYY-MM-DD
    payrollNumber: string;
  };
  entries: Array<{
    workerName: string;
    workerSsnLast4: string | null;
    classification: string;
    monSt: number; tueSt: number; wedSt: number; thuSt: number; friSt: number; satSt: number; sunSt: number;
    monOt: number; tueOt: number; wedOt: number; thuOt: number; friOt: number; satOt: number; sunOt: number;
    baseRate: number;
    grossWages: number | null;
    deductions: number;
    netPay: number | null;
  }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
}

function fmtDollar(n: number | null): string {
  if (n == null) return '';
  return `$${n.toFixed(2)}`;
}

function fmtHours(n: number): string {
  return n > 0 ? n.toString() : '';
}

function truncate(s: string, maxLen: number): string {
  return s.length > maxLen ? s.slice(0, maxLen - 1) + '\u2026' : s;
}

// Draw a filled rectangle
function fillRect(
  page: PDFPage,
  x: number, y: number, w: number, h: number,
  color: ReturnType<typeof rgb>,
) {
  page.drawRectangle({ x, y, width: w, height: h, color });
}

// Draw a stroked rectangle
function strokeRect(
  page: PDFPage,
  x: number, y: number, w: number, h: number,
  borderColor: ReturnType<typeof rgb>,
  borderWidth = 0.5,
) {
  page.drawRectangle({ x, y, width: w, height: h, color: undefined, borderColor, borderWidth });
}

// Draw text clipped to a cell
function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color: ReturnType<typeof rgb> = BLACK,
) {
  if (!text) return;
  page.drawText(text, { x, y, font, size, color });
}

// ── Main generator ────────────────────────────────────────────────────────────

export async function generateTxCprPdf(input: TxCprInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  // Embed fonts
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontReg  = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Split entries into pages of 15 rows each
  const ROWS_PER_PAGE = 15;
  const pageGroups: TxCprInput['entries'][] = [];
  for (let i = 0; i < Math.max(1, input.entries.length); i += ROWS_PER_PAGE) {
    pageGroups.push(input.entries.slice(i, i + ROWS_PER_PAGE));
  }

  for (let pageIdx = 0; pageIdx < pageGroups.length; pageIdx++) {
    const pageEntries = pageGroups[pageIdx];
    const page = pdfDoc.addPage([PAGE_W, PAGE_H]);

    let curY = PAGE_H - MARGIN;

    // ── 1. Header ───────────────────────────────────────────────────────────

    // Background bar
    fillRect(page, MARGIN, curY - HEADER_H, CONTENT_W, HEADER_H, NAVY);

    drawText(page, "CONTRACTOR'S CERTIFIED STATEMENT OF COMPLIANCE", MARGIN + 12, curY - 20, fontBold, 13, WHITE);
    drawText(page, 'Texas Department of Transportation', MARGIN + 12, curY - 36, fontReg, 9, GOLD);
    drawText(page, 'Texas Prevailing Wage - Form PWC-1', PAGE_W - MARGIN - 160, curY - 20, fontReg, 8, GOLD);
    drawText(page, `Page ${pageIdx + 1} of ${pageGroups.length}`, PAGE_W - MARGIN - 80, curY - 36, fontReg, 8, WHITE);

    curY -= HEADER_H + 6;

    // ── 2. Project info row ─────────────────────────────────────────────────

    // Row 1: Project name | TXDOT Project ID | Week Ending | Payroll No.
    fillRect(page, MARGIN, curY - FIELD_ROW_H, CONTENT_W, FIELD_ROW_H, LIGHT_GRAY);
    strokeRect(page, MARGIN, curY - FIELD_ROW_H, CONTENT_W, FIELD_ROW_H, MED_GRAY);

    const col1W = CONTENT_W * 0.36;
    const col2W = CONTENT_W * 0.20;
    const col3W = CONTENT_W * 0.22;
    const col4W = CONTENT_W - col1W - col2W - col3W;

    let fx = MARGIN + 4;
    drawText(page, 'Project:', fx, curY - 13, fontBold, 7, NAVY);
    drawText(page, truncate(input.project.name, 42), fx + 32, curY - 13, fontReg, 7, BLACK);

    fx += col1W;
    drawText(page, 'TXDOT Project ID:', fx, curY - 13, fontBold, 7, NAVY);
    drawText(page, input.project.txdotProjectId ?? 'N/A', fx + 70, curY - 13, fontReg, 7, BLACK);

    fx += col2W;
    drawText(page, 'Week Ending:', fx, curY - 13, fontBold, 7, NAVY);
    drawText(page, fmtDate(input.week.weekEndingDate), fx + 52, curY - 13, fontReg, 7, BLACK);

    fx += col3W;
    drawText(page, 'Payroll No.:', fx, curY - 13, fontBold, 7, NAVY);
    drawText(page, input.week.payrollNumber, fx + 48, curY - 13, fontReg, 7, BLACK);

    curY -= FIELD_ROW_H;

    // Row 2: Contractor name | FEIN | Awarding agency | License
    fillRect(page, MARGIN, curY - FIELD_ROW_H, CONTENT_W, FIELD_ROW_H, WHITE);
    strokeRect(page, MARGIN, curY - FIELD_ROW_H, CONTENT_W, FIELD_ROW_H, MED_GRAY);

    fx = MARGIN + 4;
    drawText(page, 'Contractor:', fx, curY - 13, fontBold, 7, NAVY);
    drawText(page, truncate(input.contractor.name, 40), fx + 42, curY - 13, fontReg, 7, BLACK);

    fx += col1W;
    drawText(page, 'FEIN:', fx, curY - 13, fontBold, 7, NAVY);
    drawText(page, input.contractor.fein || 'N/A', fx + 22, curY - 13, fontReg, 7, BLACK);

    fx += col2W;
    drawText(page, 'Awarding Agency:', fx, curY - 13, fontBold, 7, NAVY);
    drawText(page, truncate(input.project.txAwardingAgency ?? 'Texas DOT', 22), fx + 66, curY - 13, fontReg, 7, BLACK);

    fx += col3W;
    drawText(page, 'TX License:', fx, curY - 13, fontBold, 7, NAVY);
    drawText(page, input.contractor.txContractorLicense ?? 'N/A', fx + 44, curY - 13, fontReg, 7, BLACK);

    curY -= FIELD_ROW_H + 4;

    // ── 3. Worker table ─────────────────────────────────────────────────────

    // Column definitions (widths in points, total = CONTENT_W)
    type ColDef = { label: string; w: number; align: 'left' | 'right' | 'center' };
    const cols: ColDef[] = [
      { label: 'Worker Name / SSN Last 4',  w: CONTENT_W * 0.17, align: 'left'   },
      { label: 'Classification',            w: CONTENT_W * 0.13, align: 'left'   },
      { label: 'ST Hours',                  w: CONTENT_W * 0.07, align: 'right'  },
      { label: 'OT Hours',                  w: CONTENT_W * 0.07, align: 'right'  },
      { label: 'Base Rate',                 w: CONTENT_W * 0.09, align: 'right'  },
      { label: 'Gross Wages',               w: CONTENT_W * 0.11, align: 'right'  },
      { label: 'Deductions',                w: CONTENT_W * 0.11, align: 'right'  },
      { label: 'Net Pay',                   w: CONTENT_W * 0.11, align: 'right'  },
      { label: 'Days (M-T-W-T-F-S-S)',      w: CONTENT_W - (CONTENT_W * 0.86),   align: 'center' },
    ];
    // Recalculate last column width to fill exactly
    const sumW = cols.slice(0, cols.length - 1).reduce((s, c) => s + c.w, 0);
    cols[cols.length - 1].w = CONTENT_W - sumW;

    // Table header
    fillRect(page, MARGIN, curY - TABLE_HEADER_H, CONTENT_W, TABLE_HEADER_H, NAVY);
    let tx = MARGIN;
    for (const col of cols) {
      const labelX = col.align === 'right'
        ? tx + col.w - fontBold.widthOfTextAtSize(col.label, 6) - 2
        : tx + 2;
      drawText(page, col.label, labelX, curY - 13, fontBold, 6, WHITE);
      // Vertical divider
      page.drawLine({ start: { x: tx + col.w, y: curY }, end: { x: tx + col.w, y: curY - TABLE_HEADER_H }, thickness: 0.3, color: WHITE });
      tx += col.w;
    }

    curY -= TABLE_HEADER_H;

    // Worker rows
    for (let ri = 0; ri < pageEntries.length; ri++) {
      const entry = pageEntries[ri];
      const rowBg = ri % 2 === 0 ? WHITE : LIGHT_GRAY;
      fillRect(page, MARGIN, curY - TABLE_ROW_H, CONTENT_W, TABLE_ROW_H, rowBg);
      strokeRect(page, MARGIN, curY - TABLE_ROW_H, CONTENT_W, TABLE_ROW_H, MED_GRAY, 0.3);

      const totalSt = entry.monSt + entry.tueSt + entry.wedSt + entry.thuSt + entry.friSt + entry.satSt + entry.sunSt;
      const totalOt = entry.monOt + entry.tueOt + entry.wedOt + entry.thuOt + entry.friOt + entry.satOt + entry.sunOt;

      const ssnStr = entry.workerSsnLast4 ? `***-**-${entry.workerSsnLast4}` : '';
      const dayStr = [
        fmtHours(entry.monSt), fmtHours(entry.tueSt), fmtHours(entry.wedSt),
        fmtHours(entry.thuSt), fmtHours(entry.friSt), fmtHours(entry.satSt), fmtHours(entry.sunSt),
      ].map((h) => h || '0').join('-');

      const cells: string[] = [
        truncate(`${entry.workerName}${ssnStr ? ' ' + ssnStr : ''}`, 28),
        truncate(entry.classification, 20),
        totalSt > 0 ? totalSt.toString() : '',
        totalOt > 0 ? totalOt.toString() : '',
        `$${entry.baseRate.toFixed(2)}`,
        fmtDollar(entry.grossWages),
        fmtDollar(entry.deductions),
        fmtDollar(entry.netPay),
        dayStr,
      ];

      tx = MARGIN;
      const textY = curY - TABLE_ROW_H + 4;
      for (let ci = 0; ci < cols.length; ci++) {
        const col = cols[ci];
        const cellText = cells[ci] ?? '';
        const cellX = col.align === 'right'
          ? tx + col.w - fontReg.widthOfTextAtSize(cellText, 6.5) - 2
          : col.align === 'center'
          ? tx + (col.w - fontReg.widthOfTextAtSize(cellText, 6.5)) / 2
          : tx + 2;
        drawText(page, cellText, cellX, textY, fontReg, 6.5, BLACK);
        // Vertical divider
        page.drawLine({ start: { x: tx + col.w, y: curY }, end: { x: tx + col.w, y: curY - TABLE_ROW_H }, thickness: 0.3, color: MED_GRAY });
        tx += col.w;
      }

      curY -= TABLE_ROW_H;
    }

    curY -= 8;

    // ── 4. Certification statement ──────────────────────────────────────────

    // Only on last page
    if (pageIdx === pageGroups.length - 1) {
      fillRect(page, MARGIN, curY - CERT_H, CONTENT_W, CERT_H, LIGHT_GRAY);
      strokeRect(page, MARGIN, curY - CERT_H, CONTENT_W, CERT_H, MED_GRAY);

      const certLines = [
        'STATEMENT OF COMPLIANCE (Texas Government Code §2258)',
        `I, the undersigned contractor or authorized representative of ${input.contractor.name}, do hereby certify that`,
        'all workers employed during the payroll period shown above have been paid in full the prevailing wage rates',
        'established for this project, and that all deductions shown above are bona fide deductions lawfully made.',
        '',
        `Signature: ___________________________________    Date: _______________    Title: ____________________________`,
      ];

      let certY = curY - 14;
      for (const line of certLines) {
        const font = line.startsWith('STATEMENT') ? fontBold : fontReg;
        const size = line.startsWith('STATEMENT') ? 7.5 : 7;
        drawText(page, line, MARGIN + 8, certY, font, size, line.startsWith('STATEMENT') ? NAVY : BLACK);
        certY -= 10;
      }

      curY -= CERT_H + 4;
    }

    // ── 5. Footer ───────────────────────────────────────────────────────────

    const footerY = MARGIN;
    fillRect(page, MARGIN, footerY, CONTENT_W, FOOTER_H, NAVY);
    drawText(page, 'Texas Prevailing Wage - Form PWC-1  |  Texas Department of Transportation', MARGIN + 8, footerY + 5, fontReg, 7, WHITE);
    drawText(page, `Generated ${new Date().toLocaleDateString('en-US')}`, PAGE_W - MARGIN - 120, footerY + 5, fontReg, 7, GOLD);
  }

  return pdfDoc.save();
}
