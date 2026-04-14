import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface ComplianceSummaryProjectRow {
  name: string;
  state: string;
  awardDate: string;
  workerCount: number;
  weeksTotal: number;
  weeksSubmitted: number;
  weeksPending: number;
  cprOverdueCount: number;
  subCprTotal: number;
  subCprCompliant: number;
  subCprViolation: number;
  subCprPending: number;
}

export interface ComplianceSummaryInput {
  generatedAt: Date;
  contractorEmail: string;
  projects: ComplianceSummaryProjectRow[];
}

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 36;

function fmtDate(iso: string): string {
  return iso.slice(0, 10);
}

export async function generateComplianceSummaryPdf(input: ComplianceSummaryInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedStandardFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedStandardFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  // Title page header
  page.drawText('Compliance Summary Report', { x: MARGIN, y: 700, size: 20, font: boldFont, color: rgb(0, 0, 0) });
  page.drawText(`Generated: ${fmtDate(input.generatedAt.toISOString())}`, { x: MARGIN, y: 675, size: 11, font, color: rgb(0, 0, 0) });
  page.drawText(`Contractor: ${input.contractorEmail}`, { x: MARGIN, y: 658, size: 11, font, color: rgb(0, 0, 0) });
  page.drawText(`Total Active Projects: ${input.projects.length}`, { x: MARGIN, y: 641, size: 11, font, color: rgb(0, 0, 0) });
  page.drawLine({ start: { x: MARGIN, y: 628 }, end: { x: PAGE_WIDTH - MARGIN, y: 628 }, thickness: 1, color: rgb(0, 0, 0) });
  y = 610;

  // Project sections
  for (const proj of input.projects) {
    if (y < 120) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }

    // Project name
    page.drawText(proj.name, { x: MARGIN, y, size: 12, font: boldFont, color: rgb(0, 0, 0) });
    y -= 16;

    // State + award date
    page.drawText(`${proj.state} · Award: ${fmtDate(proj.awardDate)}`, { x: MARGIN, y, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
    y -= 20;

    // Table header background
    page.drawRectangle({ x: MARGIN, y: y - 12, width: PAGE_WIDTH - MARGIN * 2, height: 16, color: rgb(0.9, 0.9, 0.9) });
    page.drawText('Workers', { x: 236, y, size: 9, font: boldFont, color: rgb(0, 0, 0) });
    page.drawText('Wks Total', { x: 306, y, size: 9, font: boldFont, color: rgb(0, 0, 0) });
    page.drawText('Submitted', { x: 376, y, size: 9, font: boldFont, color: rgb(0, 0, 0) });
    page.drawText('Pending', { x: 436, y, size: 9, font: boldFont, color: rgb(0, 0, 0) });
    page.drawText('CPR Overdue', { x: 496, y, size: 9, font: boldFont, color: rgb(0, 0, 0) });
    y -= 16;

    // Data row
    page.drawText(String(proj.workerCount), { x: 236, y, size: 10, font, color: rgb(0, 0, 0) });
    page.drawText(String(proj.weeksTotal), { x: 306, y, size: 10, font, color: rgb(0, 0, 0) });
    page.drawText(String(proj.weeksSubmitted), { x: 376, y, size: 10, font, color: rgb(0, 0, 0) });
    page.drawText(String(proj.weeksPending), { x: 436, y, size: 10, font, color: rgb(0, 0, 0) });
    const overdueColor = proj.cprOverdueCount > 0 ? rgb(0.8, 0, 0) : rgb(0, 0, 0);
    page.drawText(String(proj.cprOverdueCount), { x: 496, y, size: 10, font, color: overdueColor });
    y -= 14;

    // Sub-CPR line
    page.drawText(
      `Sub CPRs: ${proj.subCprTotal} total, ${proj.subCprCompliant} compliant, ${proj.subCprViolation} violations, ${proj.subCprPending} pending`,
      { x: MARGIN, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) }
    );
    y -= 18;
  }

  // Page numbers
  const pages = pdfDoc.getPages();
  const totalPages = pages.length;
  for (let i = 0; i < totalPages; i++) {
    pages[i].drawText(`Page ${i + 1} of ${totalPages}`, {
      x: PAGE_WIDTH - MARGIN - 60,
      y: MARGIN + 10,
      size: 9,
      font,
      color: rgb(0, 0, 0),
    });
  }

  return pdfDoc.save();
}
