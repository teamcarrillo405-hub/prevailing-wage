import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import path from 'path';
import { readFileSync } from 'fs';

export interface A1131WorkerRow {
  entryNo: number;
  workerName: string;
  identifyingNo: string;
  laborType: 'journeyworker' | 'apprentice';
  classification: string;
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

interface A1131Widget {
  name: string;
  page: 0 | 1;
  type: 'text' | 'checkbox';
  x: number;
  y: number;
  w: number;
  h: number;
}

const ROWS_PER_PAGE = 5;
const WIDGET_LAYOUT_PATH = path.join(process.cwd(), 'scripts', 'calibrate', 'a1131', 'widgets.json');

const fmtDollar = (n: number | undefined) => (n != null && n > 0 ? n.toFixed(2) : '');
const fmtHours = (n: number | undefined) => (n != null && n > 0 ? String(n) : '');

function loadWidgetMap(): Map<string, A1131Widget> {
  const layout = JSON.parse(readFileSync(WIDGET_LAYOUT_PATH, 'utf8')) as { widgets: A1131Widget[] };
  return new Map(layout.widgets.map((widget) => [widget.name, widget]));
}

function fitTextSize(text: string, width: number, baseSize: number, font: PDFFont): number {
  let size = baseSize;
  while (size > 4.25 && font.widthOfTextAtSize(text, size) > width) size -= 0.25;
  return size;
}

function displayWorkerName(workerName: string): string {
  if (!workerName.includes(',')) return workerName;
  const [last, rest] = workerName.split(',');
  return `${(last ?? '').trim()}, ${(rest ?? '').trim()}`;
}

function adjustedWidget(widget: A1131Widget): A1131Widget {
  if (/^w\d+_(federalTax|stateTax|sdi|otherDeductions|totalDeductions)$/.test(widget.name)) {
    return { ...widget, y: widget.y - 4, h: Math.max(8, widget.h - 2) };
  }
  return widget;
}

export async function fillA1131(
  data: A1131Data,
  templateBytes: Uint8Array | Buffer,
): Promise<Uint8Array> {
  const workers = data.workers ?? [];
  const chunks: A1131WorkerRow[][] = [];
  for (let i = 0; i < workers.length; i += ROWS_PER_PAGE) {
    chunks.push(workers.slice(i, i + ROWS_PER_PAGE));
  }
  if (chunks.length === 0) chunks.push([]);

  if (chunks.length === 1) {
    return fillSingleSet(data, chunks[0], 1, 1, templateBytes);
  }

  const filledSets: Uint8Array[] = [];
  for (let setIdx = 0; setIdx < chunks.length; setIdx++) {
    filledSets.push(
      await fillSingleSet(data, chunks[setIdx], setIdx + 1, chunks.length, templateBytes),
    );
  }

  const master = await PDFDocument.create();
  for (const bytes of filledSets) {
    const src = await PDFDocument.load(bytes);
    const pages = await master.copyPages(src, src.getPageIndices());
    for (const page of pages) master.addPage(page);
  }
  return master.save();
}

async function fillSingleSet(
  data: A1131Data,
  workers: A1131WorkerRow[],
  setNumber: number,
  totalSets: number,
  templateBytes: Uint8Array | Buffer,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(templateBytes);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const widgetMap = loadWidgetMap();
  const black = rgb(0, 0, 0);

  const drawText = (
    name: string,
    value: string,
    opts: { align?: 'left' | 'center' | 'right'; size?: number } = {},
  ) => {
    const sourceWidget = widgetMap.get(name);
    if (!sourceWidget || !value) return;
    const widget = adjustedWidget(sourceWidget);
    const page = pages[widget.page];
    if (!page) return;
    const padding = 1.25;
    const maxWidth = Math.max(1, widget.w - padding * 2);
    const size = fitTextSize(value, maxWidth, opts.size ?? 6, font);
    const textWidth = font.widthOfTextAtSize(value, size);
    const x = opts.align === 'right'
      ? widget.x + widget.w - textWidth - padding
      : opts.align === 'center'
        ? widget.x + (widget.w - textWidth) / 2
        : widget.x + padding;
    const y = widget.y + Math.max(1, (widget.h - size) / 2) - 0.5;
    page.drawText(value, { x, y, size, font, color: black, maxWidth });
  };

  drawText('header_contractorName', data.contractorName, { size: 5.25 });
  drawText('header_cslbLicense', data.cslbLicense, { align: 'center', size: 5.25 });
  drawText('header_contractorAddress', data.contractorAddress, { size: 5.25 });
  drawText('header_payrollNumber', data.payrollNumber, { align: 'center', size: 5.25 });
  drawText('header_weekEndingDate', data.weekEndingDate, { align: 'center', size: 5.25 });
  drawText('header_wcPolicyNumber', data.wcPolicyNumber, { align: 'center', size: 5.25 });
  drawText('header_contractNo', data.contractNo, { align: 'center', size: 5.25 });
  drawText('header_projectLocation', data.projectLocation, { size: 5.25 });

  if (totalSets > 1) {
    drawText('pageOfPages', `Page ${setNumber} of ${totalSets}`, { align: 'center' });
  }

  for (let i = 0; i < workers.length; i++) {
    const worker = workers[i];
    const wk = `w${i + 1}`;

    drawText(`${wk}_entryNo`, String(worker.entryNo), { align: 'center' });
    drawText(`${wk}_workerName`, displayWorkerName(worker.workerName));
    drawText(`${wk}_identifyingNo`, worker.identifyingNo, { align: 'center' });
    drawText(`${wk}_laborType`, worker.laborType === 'journeyworker' ? 'J' : 'RA', { align: 'center' });
    drawText(`${wk}_classification`, worker.classification);

    drawText(`${wk}_monSt`, fmtHours(worker.monSt), { align: 'center' });
    drawText(`${wk}_tueSt`, fmtHours(worker.tueSt), { align: 'center' });
    drawText(`${wk}_wedSt`, fmtHours(worker.wedSt), { align: 'center' });
    drawText(`${wk}_thuSt`, fmtHours(worker.thuSt), { align: 'center' });
    drawText(`${wk}_friSt`, fmtHours(worker.friSt), { align: 'center' });
    drawText(`${wk}_satSt`, fmtHours(worker.satSt), { align: 'center' });
    drawText(`${wk}_sunSt`, fmtHours(worker.sunSt), { align: 'center' });
    drawText(`${wk}_totalSt`, fmtHours(worker.totalSt), { align: 'center' });
    drawText(`${wk}_stRate`, fmtDollar(worker.stRate), { align: 'right' });
    drawText(`${wk}_grossWages`, fmtDollar(worker.grossWages), { align: 'right', size: 5.5 });
    drawText(`${wk}_federalTax`, fmtDollar(worker.federalTax), { align: 'right', size: 5 });
    drawText(`${wk}_stateTax`, fmtDollar(worker.stateTax), { align: 'right', size: 5 });
    drawText(`${wk}_sdi`, fmtDollar(worker.sdi), { align: 'right', size: 5 });
    drawText(`${wk}_otherDeductions`, fmtDollar(worker.otherDeductions), { align: 'right', size: 5 });
    drawText(`${wk}_netPay`, fmtDollar(worker.netPay), { align: 'right', size: 5.5 });

    drawText(`${wk}_monOt`, fmtHours(worker.monOt), { align: 'center' });
    drawText(`${wk}_tueOt`, fmtHours(worker.tueOt), { align: 'center' });
    drawText(`${wk}_wedOt`, fmtHours(worker.wedOt), { align: 'center' });
    drawText(`${wk}_thuOt`, fmtHours(worker.thuOt), { align: 'center' });
    drawText(`${wk}_friOt`, fmtHours(worker.friOt), { align: 'center' });
    drawText(`${wk}_satOt`, fmtHours(worker.satOt), { align: 'center' });
    drawText(`${wk}_sunOt`, fmtHours(worker.sunOt), { align: 'center' });
    drawText(`${wk}_totalOt`, fmtHours(worker.totalOt), { align: 'center' });
    drawText(`${wk}_otRate`, fmtDollar(worker.otRate), { align: 'right' });

    drawText(`${wk}_monDt`, fmtHours(worker.monDt), { align: 'center' });
    drawText(`${wk}_tueDt`, fmtHours(worker.tueDt), { align: 'center' });
    drawText(`${wk}_wedDt`, fmtHours(worker.wedDt), { align: 'center' });
    drawText(`${wk}_thuDt`, fmtHours(worker.thuDt), { align: 'center' });
    drawText(`${wk}_friDt`, fmtHours(worker.friDt), { align: 'center' });
    drawText(`${wk}_satDt`, fmtHours(worker.satDt), { align: 'center' });
    drawText(`${wk}_sunDt`, fmtHours(worker.sunDt), { align: 'center' });
    drawText(`${wk}_totalDt`, fmtHours(worker.totalDt), { align: 'center' });
    drawText(`${wk}_dtRate`, fmtDollar(worker.dtRate), { align: 'right' });
    drawText(`${wk}_totalDeductions`, fmtDollar(worker.totalDeductions), { align: 'right', size: 5 });
  }

  drawText('cert_contractorName', data.contractorName);
  drawText('cert_payrollDescription', `Payroll #${data.payrollNumber} - ${data.projectLocation}`);
  drawText('cert_weekEndingDate', data.weekEndingDate, { align: 'center' });

  try {
    const form = pdfDoc.getForm();
    for (const field of form.getFields()) form.removeField(field);
  } catch {
    // The production source is flat; this strips calibration widgets in tests.
  }

  return pdfDoc.save();
}

export function getA1131TemplateBytes(): Uint8Array {
  const templatePath = path.join(
    process.cwd(),
    'assets',
    'a1131-landscape.pdf',
  );
  return readFileSync(templatePath);
}
