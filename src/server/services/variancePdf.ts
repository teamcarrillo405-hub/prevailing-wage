// src/server/services/variancePdf.ts
// Generates variance report PDF from scratch.
// Use PDFDocument.create() — NOT load() — this is a generated document.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { VarianceReport } from './varianceService.js';

const HCC_GOLD = rgb(0.961, 0.773, 0.094);  // #F5C518
const BLACK = rgb(0, 0, 0);
const GRAY = rgb(0.42, 0.45, 0.5);
const LIGHT_GRAY = rgb(0.95, 0.95, 0.95);
const RED_FLAG = rgb(0.87, 0.20, 0.20);

function fmtCurrency(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function fmtPct(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

export async function generateVariancePdf(
  report: VarianceReport,
  projectName: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();  // create() — NOT load()
  const page = doc.addPage([612, 792]);    // US Letter portrait
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  const margin = 48;
  const tableLeft = margin;
  const tableRight = width - margin;
  const tableWidth = tableRight - tableLeft;

  // ── Header ──────────────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: height - 60, width, height: 60, color: HCC_GOLD });
  page.drawText('Job Cost Variance Report', {
    x: margin, y: height - 38,
    size: 16, font: boldFont, color: BLACK,
  });
  page.drawText(`Project: ${projectName}`, {
    x: margin, y: height - 54,
    size: 9, font, color: BLACK,
  });
  page.drawText(`Generated: ${new Date().toLocaleDateString('en-US')}`, {
    x: tableRight - 120, y: height - 54,
    size: 9, font, color: BLACK,
  });

  // ── Budget summary ───────────────────────────────────────────────────────
  const summaryY = height - 80;
  const budgetStr = `Working Budget: ${fmtCurrency(report.workingBudget)}`;
  const thresholdStr = `Flag Threshold: ${report.varianceThresholdPct}%`;
  const overallStr = `Overall Variance: ${fmtPct(report.overallVariancePct)}`;
  page.drawText(budgetStr, { x: margin, y: summaryY, size: 9, font, color: GRAY });
  page.drawText(thresholdStr, { x: margin + 160, y: summaryY, size: 9, font, color: GRAY });
  page.drawText(overallStr, {
    x: tableRight - boldFont.widthOfTextAtSize(overallStr, 9) - 0,
    y: summaryY, size: 9, font: boldFont,
    color: Math.abs(report.overallVariancePct) > report.varianceThresholdPct ? RED_FLAG : BLACK,
  });

  // ── Column headers ───────────────────────────────────────────────────────
  const headerY = summaryY - 22;
  const colWidths = [
    tableWidth * 0.18,  // Week Ending
    tableWidth * 0.06,  // #
    tableWidth * 0.18,  // Actual
    tableWidth * 0.18,  // Burn Rate
    tableWidth * 0.18,  // Cum. Actual
    tableWidth * 0.18,  // Cum. Budget
    tableWidth * 0.12,  // Variance %
    tableWidth * 0.06,  // Flag
  ];
  let cx = tableLeft;
  const colX: number[] = [];
  for (const w of colWidths) { colX.push(cx); cx += w; }

  page.drawRectangle({ x: tableLeft, y: headerY - 4, width: tableWidth, height: 18, color: LIGHT_GRAY });
  const colLabels = ['Week Ending', '#', 'Actual', 'Burn Rate', 'Cum. Actual', 'Cum. Budget', 'Var %', '!'];
  colLabels.forEach((label, i) => {
    const xPos = i === 0 ? colX[i] + 3 : colX[i] + colWidths[i] - font.widthOfTextAtSize(label, 8) - 3;
    page.drawText(label, { x: xPos, y: headerY, size: 8, font: boldFont, color: BLACK });
  });

  // ── Data rows ────────────────────────────────────────────────────────────
  let rowY = headerY - 18;
  const rowHeight = 16;

  for (const row of report.weeks) {
    if (rowY < margin + 40) break; // safety overflow guard

    const rowColor = row.isOverThreshold ? rgb(1.0, 0.97, 0.97) : undefined;
    if (rowColor) {
      page.drawRectangle({ x: tableLeft, y: rowY - 4, width: tableWidth, height: rowHeight, color: rowColor });
    }

    const cells = [
      row.weekEndingDate,
      String(row.payrollNumber),
      fmtCurrency(row.actualCost),
      fmtCurrency(row.burnRate),
      fmtCurrency(row.cumulativeActual),
      fmtCurrency(row.cumulativeBurnRate),
      fmtPct(row.variancePct),
      row.isOverThreshold ? '!' : '',
    ];

    cells.forEach((cell, i) => {
      const isRightAligned = i !== 0;
      const xPos = isRightAligned
        ? colX[i] + colWidths[i] - font.widthOfTextAtSize(cell, 8) - 3
        : colX[i] + 3;
      const cellColor = i === 6
        ? (row.isOverThreshold ? RED_FLAG : BLACK)
        : (i === 7 ? RED_FLAG : BLACK);
      const cellFont = i === 7 ? boldFont : font;
      page.drawText(cell, { x: xPos, y: rowY, size: 8, font: cellFont, color: cellColor });
    });

    // Row separator
    page.drawLine({
      start: { x: tableLeft, y: rowY - rowHeight + 4 },
      end: { x: tableRight, y: rowY - rowHeight + 4 },
      thickness: 0.3, color: LIGHT_GRAY,
    });

    rowY -= rowHeight;
  }

  // ── Footer note ───────────────────────────────────────────────────────────
  page.drawText(
    'Burn rate is linear: working budget / total weeks x payroll number. "!" = variance exceeds threshold.',
    { x: margin, y: margin, size: 7, font, color: GRAY, maxWidth: tableWidth },
  );

  return doc.save();
}
