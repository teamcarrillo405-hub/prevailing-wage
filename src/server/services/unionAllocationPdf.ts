// src/server/services/unionAllocationPdf.ts
// Generates a union trade allocation summary PDF from scratch.
// Use PDFDocument.create() — NOT load() — this is a generated document.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { UnionAllocationResult } from './unionAllocation.js';

const HCC_GOLD = rgb(0.961, 0.773, 0.094);  // #F5C518
const BLACK = rgb(0, 0, 0);
const GRAY = rgb(0.42, 0.45, 0.5);
const LIGHT_GRAY = rgb(0.95, 0.95, 0.95);

function fmtCurrency(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export async function generateUnionAllocationPdf(
  result: UnionAllocationResult,
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
  // Gold header bar
  page.drawRectangle({ x: 0, y: height - 60, width, height: 60, color: HCC_GOLD });
  page.drawText('Union Trade Allocation Summary', {
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

  // ── Column headers ───────────────────────────────────────────────────────
  const headerY = height - 90;
  const colWidths = [tableWidth * 0.40, tableWidth * 0.15, tableWidth * 0.20, tableWidth * 0.25];
  const colX = [
    tableLeft,
    tableLeft + colWidths[0],
    tableLeft + colWidths[0] + colWidths[1],
    tableLeft + colWidths[0] + colWidths[1] + colWidths[2],
  ];

  page.drawRectangle({ x: tableLeft, y: headerY - 4, width: tableWidth, height: 18, color: LIGHT_GRAY });
  const colLabels = ['Trade / Union', 'Headcount', 'Total Hours', 'Total Cost'];
  colLabels.forEach((label, i) => {
    const xPos = i === 0 ? colX[i] + 4 : colX[i] + colWidths[i] - font.widthOfTextAtSize(label, 9) - 4;
    page.drawText(label, { x: xPos, y: headerY, size: 9, font: boldFont, color: BLACK });
  });

  // ── Trade rows ───────────────────────────────────────────────────────────
  let rowY = headerY - 22;
  const rowHeight = 20;

  for (const trade of result.trades) {
    if (rowY < margin + 80) break; // safety — don't overflow footer area

    page.drawText(trade.tradeName, {
      x: colX[0] + 4, y: rowY,
      size: 9, font: boldFont, color: BLACK, maxWidth: colWidths[0] - 8,
    });
    page.drawText(trade.tradeCode, {
      x: colX[0] + 4, y: rowY - 10,
      size: 7, font, color: GRAY,
    });

    const headcountStr = String(trade.headcount);
    const hoursStr = trade.totalHours.toFixed(1);
    const costStr = fmtCurrency(trade.totalCost);

    page.drawText(headcountStr, {
      x: colX[1] + colWidths[1] - font.widthOfTextAtSize(headcountStr, 9) - 4,
      y: rowY, size: 9, font, color: BLACK,
    });
    page.drawText(hoursStr, {
      x: colX[2] + colWidths[2] - font.widthOfTextAtSize(hoursStr, 9) - 4,
      y: rowY, size: 9, font, color: BLACK,
    });
    page.drawText(costStr, {
      x: colX[3] + colWidths[3] - font.widthOfTextAtSize(costStr, 9) - 4,
      y: rowY, size: 9, font, color: BLACK,
    });

    // Separator line
    page.drawLine({
      start: { x: tableLeft, y: rowY - rowHeight + 4 },
      end: { x: tableRight, y: rowY - rowHeight + 4 },
      thickness: 0.5, color: LIGHT_GRAY,
    });

    rowY -= rowHeight + (trade.tradeCode !== trade.tradeName ? 8 : 0);
  }

  // ── Grand total row ───────────────────────────────────────────────────────
  rowY -= 4;
  page.drawRectangle({ x: tableLeft, y: rowY - 4, width: tableWidth, height: 18, color: LIGHT_GRAY });
  page.drawText('Grand Total', { x: colX[0] + 4, y: rowY, size: 9, font: boldFont, color: BLACK });

  const totalHeadcount = String(result.trades.reduce((s, t) => s + t.headcount, 0));
  const totalHoursStr = result.grandTotalHours.toFixed(1);
  const totalCostStr = fmtCurrency(result.grandTotalCost);

  page.drawText(totalHeadcount, {
    x: colX[1] + colWidths[1] - boldFont.widthOfTextAtSize(totalHeadcount, 9) - 4,
    y: rowY, size: 9, font: boldFont, color: BLACK,
  });
  page.drawText(totalHoursStr, {
    x: colX[2] + colWidths[2] - boldFont.widthOfTextAtSize(totalHoursStr, 9) - 4,
    y: rowY, size: 9, font: boldFont, color: BLACK,
  });
  page.drawText(totalCostStr, {
    x: colX[3] + colWidths[3] - boldFont.widthOfTextAtSize(totalCostStr, 9) - 4,
    y: rowY, size: 9, font: boldFont, color: HCC_GOLD,
  });

  // ── Blended rate row ─────────────────────────────────────────────────────
  rowY -= 22;
  page.drawText('Blended Hourly Rate', { x: colX[0] + 4, y: rowY, size: 9, font, color: GRAY });
  const blendedStr = `${fmtCurrency(result.blendedHourlyRate)}/hr`;
  page.drawText(blendedStr, {
    x: colX[3] + colWidths[3] - boldFont.widthOfTextAtSize(blendedStr, 9) - 4,
    y: rowY, size: 9, font: boldFont, color: BLACK,
  });

  // ── Footer note ───────────────────────────────────────────────────────────
  page.drawText(
    'Cost source: payroll entry rate snapshots. Blended rate = total cost / total hours across all trades.',
    { x: margin, y: margin, size: 7, font, color: GRAY, maxWidth: tableWidth },
  );

  return doc.save();
}
