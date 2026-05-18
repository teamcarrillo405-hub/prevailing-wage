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
  ficaTax: number;
  stateTax: number;
  sdi: number;
  vacationHoliday: number;
  healthWelfare: number;
  pension: number;
  training: number;
  fundAdmin: number;
  dues: number;
  travelSubsistence: number;
  savings: number;
  otherDeductions: number;
  otherDeductionDescription?: string;
  totalDeductions: number;
  netPay: number;
  fringeCredit: number;
  checkNumber?: string | null;
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

const ROWS_PER_PAGE = 4;
const WIDGET_LAYOUT_PATH = path.join(process.cwd(), 'scripts', 'calibrate', 'a1131', 'widgets.json');

const fmtDollar = (n: number | undefined) => (n != null && n > 0 ? n.toFixed(2) : '');
const fmtHours = (n: number | undefined) => (n != null && n > 0 ? String(n) : '');

function loadWidgetMap(): Map<string, A1131Widget> {
  const layout = JSON.parse(readFileSync(WIDGET_LAYOUT_PATH, 'utf8')) as { widgets: A1131Widget[] };
  return new Map(layout.widgets.map((widget) => [widget.name, widget]));
}

function fitTextSize(text: string, width: number, baseSize: number, font: PDFFont): number {
  let size = baseSize;
  while (size > 2.5 && font.widthOfTextAtSize(text, size) > width) size -= 0.25;
  return size;
}

function displayWorkerName(workerName: string): string {
  if (!workerName.includes(',')) return workerName;
  const [last, rest] = workerName.split(',');
  return `${(last ?? '').trim()}, ${(rest ?? '').trim()}`;
}

function fitClassificationLabel(classification: string): string {
  return classification.length > 13 ? `${classification.slice(0, 10)}...` : classification;
}

function adjustedWidget(widget: A1131Widget): A1131Widget {
  if (/^header_/.test(widget.name)) {
    return { ...widget, y: widget.y + 11, h: Math.max(8, widget.h - 2) };
  }
  if (/^w\d+_(federalTax|stateTax|sdi|otherDeductions|totalDeductions)$/.test(widget.name)) {
    return { ...widget, y: widget.y - 4, h: Math.max(8, widget.h - 2) };
  }
  return widget;
}

const DEDUCTION_COL = {
  federalTax: { x: 638, w: 40, row: 'top' },
  ficaTax: { x: 682, w: 38, row: 'top' },
  stateTax: { x: 720, w: 38, row: 'top' },
  sdi: { x: 761, w: 35, row: 'top' },
  vacationHoliday: { x: 797, w: 32, row: 'top' },
  healthWelfare: { x: 830, w: 38, row: 'top' },
  pension: { x: 869, w: 38, row: 'top' },
  training: { x: 638, w: 40, row: 'bottom' },
  fundAdmin: { x: 682, w: 38, row: 'bottom' },
  dues: { x: 720, w: 38, row: 'bottom' },
  travelSubsistence: { x: 761, w: 35, row: 'bottom' },
  savings: { x: 797, w: 32, row: 'bottom' },
  otherDeductions: { x: 830, w: 38, row: 'bottom' },
  totalDeductions: { x: 869, w: 38, row: 'bottom' },
} as const;

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
    page.drawText(value, { x, y, size, font, color: black });
  };

  const drawAt = (
    pageIndex: 0 | 1,
    value: string,
    widget: { x: number; y: number; w: number; h: number },
    opts: { align?: 'left' | 'center' | 'right'; size?: number } = {},
  ) => {
    if (!value) return;
    const page = pages[pageIndex];
    if (!page) return;
    const padding = 1.25;
    const maxWidth = Math.max(1, widget.w - padding * 2);
    const size = fitTextSize(value, maxWidth, opts.size ?? 5, font);
    const textWidth = font.widthOfTextAtSize(value, size);
    const x = opts.align === 'right'
      ? widget.x + widget.w - textWidth - padding
      : opts.align === 'center'
        ? widget.x + (widget.w - textWidth) / 2
        : widget.x + padding;
    const y = widget.y + Math.max(1, (widget.h - size) / 2) - 0.5;
    page.drawText(value, { x, y, size, font, color: black });
  };

  const drawDeduction = (
    row: number,
    field: keyof typeof DEDUCTION_COL,
    value: string,
  ) => {
    const anchor = widgetMap.get(`w${row}_${field === 'ficaTax' ? 'federalTax' : field}`);
    const totalAnchor = widgetMap.get(`w${row}_totalDeductions`);
    const col = DEDUCTION_COL[field];
    const y = col.row === 'bottom'
      ? (totalAnchor?.y ?? 0) - 4
      : (anchor?.y ?? widgetMap.get(`w${row}_federalTax`)?.y ?? 0) - 4;
    drawAt(0, value, { x: col.x, y, w: col.w, h: 9 }, { align: 'right', size: 5 });
  };

  drawText('header_contractorName', data.contractorName, { size: 5.25 });
  drawText('header_cslbLicense', data.cslbLicense, { align: 'center', size: 5.25 });
  drawText('header_contractorAddress', data.contractorAddress, { size: 5.25 });
  drawText('header_payrollNumber', data.payrollNumber, { align: 'center', size: 5.25 });
  drawText('header_weekEndingDate', data.weekEndingDate, { align: 'center', size: 5.25 });
  drawText('header_wcPolicyNumber', data.wcPolicyNumber, { align: 'center', size: 5.25 });
  drawText('header_contractNo', data.contractNo, { align: 'center', size: 5.25 });
  // BUG-05: CA DIR requires the applicable wage determination number on every CPR
  drawText('header_wageDeterminationNo', data.wageDeterminationNo ?? '', { align: 'center', size: 5.25 });
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
    drawText(`${wk}_classification`, fitClassificationLabel(worker.classification));

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
    drawText(`${wk}_netPay`, fmtDollar(worker.netPay), { align: 'right', size: 5.5 });

    drawText(`${wk}_monOt`, fmtHours(worker.monOt), { align: 'center' });
    drawText(`${wk}_tueOt`, fmtHours(worker.tueOt), { align: 'center' });
    drawText(`${wk}_wedOt`, fmtHours(worker.wedOt), { align: 'center' });
    drawText(`${wk}_thuOt`, fmtHours(worker.thuOt), { align: 'center' });
    drawText(`${wk}_friOt`, fmtHours(worker.friOt), { align: 'center' });
    drawText(`${wk}_satOt`, fmtHours(worker.satOt), { align: 'center' });
    drawText(`${wk}_sunOt`, fmtHours(worker.sunOt), { align: 'center' });
    drawText(`${wk}_totalOt`, fmtHours(worker.totalOt), { align: 'center' });
    if ((worker.totalOt ?? 0) > 0) {
      drawText(`${wk}_otRate`, fmtDollar(worker.otRate), { align: 'right' });
    }

    drawText(`${wk}_monDt`, fmtHours(worker.monDt), { align: 'center' });
    drawText(`${wk}_tueDt`, fmtHours(worker.tueDt), { align: 'center' });
    drawText(`${wk}_wedDt`, fmtHours(worker.wedDt), { align: 'center' });
    drawText(`${wk}_thuDt`, fmtHours(worker.thuDt), { align: 'center' });
    drawText(`${wk}_friDt`, fmtHours(worker.friDt), { align: 'center' });
    drawText(`${wk}_satDt`, fmtHours(worker.satDt), { align: 'center' });
    drawText(`${wk}_sunDt`, fmtHours(worker.sunDt), { align: 'center' });
    drawText(`${wk}_totalDt`, fmtHours(worker.totalDt), { align: 'center' });
    if ((worker.totalDt ?? 0) > 0) {
      drawText(`${wk}_dtRate`, fmtDollar(worker.dtRate), { align: 'right' });
    }
    drawDeduction(i + 1, 'federalTax', fmtDollar(worker.federalTax));
    drawDeduction(i + 1, 'ficaTax', fmtDollar(worker.ficaTax));
    drawDeduction(i + 1, 'stateTax', fmtDollar(worker.stateTax));
    drawDeduction(i + 1, 'sdi', fmtDollar(worker.sdi));
    drawDeduction(i + 1, 'vacationHoliday', fmtDollar(worker.vacationHoliday));
    drawDeduction(i + 1, 'healthWelfare', fmtDollar(worker.healthWelfare));
    drawDeduction(i + 1, 'pension', fmtDollar(worker.pension));
    drawDeduction(i + 1, 'training', fmtDollar(worker.training));
    drawDeduction(i + 1, 'fundAdmin', fmtDollar(worker.fundAdmin));
    drawDeduction(i + 1, 'dues', fmtDollar(worker.dues));
    drawDeduction(i + 1, 'travelSubsistence', fmtDollar(worker.travelSubsistence));
    drawDeduction(i + 1, 'savings', fmtDollar(worker.savings));
    drawDeduction(i + 1, 'otherDeductions', fmtDollar(worker.otherDeductions));
    drawDeduction(i + 1, 'totalDeductions', fmtDollar(worker.totalDeductions));
    if (worker.checkNumber) {
      drawAt(0, worker.checkNumber, { x: 953, y: widgetMap.get(`${wk}_netPay`)?.y ?? 0, w: 40, h: 11 }, { align: 'center', size: 5 });
    }
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
