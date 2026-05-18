import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import path from 'path';
import { readFileSync } from 'fs';

export const WH347_FORM_REVISION = 'Rev. Jan. 2025';

export interface Wh347WorkerRow {
  entryNo: number;
  workerName: string;
  laborType: 'journeyworker' | 'apprentice';
  identifyingNo: string;
  classification: string;
  monSt: number; monOt: number;
  tueSt: number; tueOt: number;
  wedSt: number; wedOt: number;
  thuSt: number; thuOt: number;
  friSt: number; friOt: number;
  satSt: number; satOt: number;
  sunSt?: number; sunOt?: number;
  totalSt: number;
  totalOt: number;
  baseRate: number;
  fringeCredit: number;
  paymentInLieu?: number;
  grossWagesProject: number;
  grossWagesAll: number;
  taxWithheld?: number;
  fica?: number;
  otherDeductions?: number;
  deductions: number;
  netPay: number;
}

export interface Wh347Compliance {
  certProperPayment: boolean;
  certAccuratePayroll: boolean;
  certWorkPerformed: boolean;
  certApprentices: boolean;
  certFringeBenefits: boolean;
  certDeductions: boolean;
  officialName: string;
  officialTitle: string;
  signatureDate: string;
  phoneNumber: string;
}

export interface Wh347Data {
  contractorName: string;
  contractorAddress: string;
  payrollNumber: string;
  weekEndingDate: string;
  projectName: string;
  projectLocation?: string;
  projectContractNo: string;
  wageDeterminationNo: string;
  isFinal?: boolean;
  isPrime?: boolean;
  workers: Wh347WorkerRow[];
  compliance: Wh347Compliance;
}

interface Wh347Widget {
  name: string;
  page: 0 | 1;
  type: 'text' | 'checkbox';
  x: number;
  y: number;
  w: number;
  h: number;
}

const ROWS_PER_PAGE = 8;
const WIDGET_LAYOUT_PATH = path.join(process.cwd(), 'scripts', 'calibrate', 'wh347', 'widgets.json');

const fmtDollar = (n: number | undefined) => n != null ? n.toFixed(2) : '';
const fmtHours = (n: number | undefined) => (n != null && n > 0 ? String(n) : '');

function loadWidgetMap(): Map<string, Wh347Widget> {
  const layout = JSON.parse(readFileSync(WIDGET_LAYOUT_PATH, 'utf8')) as { widgets: Wh347Widget[] };
  return new Map(layout.widgets.map((widget) => [widget.name, widget]));
}

function fitTextSize(text: string, width: number, baseSize: number, font: PDFFont): number {
  let size = baseSize;
  while (size > 3.25 && font.widthOfTextAtSize(text, size) > width) size -= 0.25;
  return size;
}

function adjustedWidget(widget: Wh347Widget): Wh347Widget {
  // The flat DOL source and the calibration widgets share a page size, but a few
  // widget rectangles sit on label/table borders. Nudge only those overlays.
  if (/^w\d+_totalDeduct$/.test(widget.name)) {
    return { ...widget, x: widget.x - 7, w: Math.max(26, widget.w - 2) };
  }
  if (/^w\d+_netPay$/.test(widget.name)) {
    return { ...widget, x: widget.x - 28, w: 32 };
  }
  if (
    /^p2_(projectName|projectContractNo|payrollNo|contractorName|projectLocation|weekEndingDate|certifyingOfficial)$/.test(widget.name)
    || /^sig_(officialName|date|phone)$/.test(widget.name)
  ) {
    return { ...widget, y: widget.y - 14, h: Math.max(8, widget.h - 4) };
  }
  return widget;
}

function splitName(workerName: string): { last: string; first: string; middle: string } {
  if (workerName.includes(',')) {
    const [last, rest] = workerName.split(',', 2);
    const parts = (rest ?? '').trim().split(/\s+/);
    return { last: last.trim(), first: parts[0] ?? '', middle: parts[1] ?? '' };
  }
  return { last: workerName, first: '', middle: '' };
}

export async function fillWh347(
  data: Wh347Data,
  templateBytes: Uint8Array,
): Promise<Uint8Array> {
  const chunks: Wh347WorkerRow[][] = [];
  for (let i = 0; i < data.workers.length; i += ROWS_PER_PAGE) {
    chunks.push(data.workers.slice(i, i + ROWS_PER_PAGE));
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
  data: Wh347Data,
  workers: Wh347WorkerRow[],
  setNumber: number,
  totalSets: number,
  templateBytes: Uint8Array,
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
    const padding = 1.5;
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

  const drawCheck = (name: string, checked: boolean) => {
    if (!checked) return;
    const widget = widgetMap.get(name);
    if (!widget) return;
    const page = pages[widget.page];
    if (!page) return;
    page.drawText('X', {
      x: widget.x + 1.5,
      y: widget.y + 0.5,
      size: Math.max(7, widget.h - 1),
      font,
      color: black,
    });
  };

  drawText('header_projectName', data.projectName);
  drawText('header_projectContractNo', data.projectContractNo);
  drawText('header_payrollNumber', data.payrollNumber, { align: 'center' });
  drawText('header_contractorName', data.contractorName);
  drawText('header_projectLocation', data.projectLocation ?? '');
  drawText('header_wageDeterminationNo', data.wageDeterminationNo);
  drawText('header_weekEndingDate', data.weekEndingDate, { align: 'center' });
  drawText('header_contractorAddress', data.contractorAddress);

  drawCheck('cb_final', !!data.isFinal);
  drawCheck('cb_prime', data.isPrime !== false);
  drawCheck('cb_sub', data.isPrime === false);

  if (totalSets > 1) {
    drawText('pageOfPages', `Page ${setNumber} of ${totalSets}`);
  }

  for (let i = 0; i < workers.length; i++) {
    const worker = workers[i];
    const wk = `w${i + 1}`;
    const { last, first, middle } = splitName(worker.workerName);
    const totalHours = (worker.totalSt ?? 0) + (worker.totalOt ?? 0);

    drawText(`${wk}_entryNo`, String(worker.entryNo), { align: 'center' });
    drawText(`${wk}_lastName`, last);
    drawText(`${wk}_firstName`, first);
    drawText(`${wk}_middle`, middle);
    drawText(`${wk}_ident`, worker.identifyingNo, { align: 'center' });
    drawText(`${wk}_labor`, worker.laborType === 'journeyworker' ? 'J' : 'RA', { align: 'center' });
    drawText(`${wk}_classification`, worker.classification);

    drawText(`${wk}_monSt`, fmtHours(worker.monSt), { align: 'center' });
    drawText(`${wk}_monOt`, fmtHours(worker.monOt), { align: 'center' });
    drawText(`${wk}_tueSt`, fmtHours(worker.tueSt), { align: 'center' });
    drawText(`${wk}_tueOt`, fmtHours(worker.tueOt), { align: 'center' });
    drawText(`${wk}_wedSt`, fmtHours(worker.wedSt), { align: 'center' });
    drawText(`${wk}_wedOt`, fmtHours(worker.wedOt), { align: 'center' });
    drawText(`${wk}_thuSt`, fmtHours(worker.thuSt), { align: 'center' });
    drawText(`${wk}_thuOt`, fmtHours(worker.thuOt), { align: 'center' });
    drawText(`${wk}_friSt`, fmtHours(worker.friSt), { align: 'center' });
    drawText(`${wk}_friOt`, fmtHours(worker.friOt), { align: 'center' });
    drawText(`${wk}_satSt`, fmtHours(worker.satSt), { align: 'center' });
    drawText(`${wk}_satOt`, fmtHours(worker.satOt), { align: 'center' });
    drawText(`${wk}_sunSt`, fmtHours(worker.sunSt), { align: 'center' });
    drawText(`${wk}_sunOt`, fmtHours(worker.sunOt), { align: 'center' });
    drawText(`${wk}_totalHours`, fmtHours(totalHours), { align: 'center' });
    drawText(`${wk}_totalHoursSt`, fmtHours(worker.totalSt), { align: 'center' });
    drawText(`${wk}_totalHoursOt`, fmtHours(worker.totalOt), { align: 'center' });

    drawText(`${wk}_baseRateSt`, fmtDollar(worker.baseRate), { align: 'right', size: 5.25 });
    if ((worker.totalOt ?? 0) > 0) {
      drawText(`${wk}_baseRateOt`, fmtDollar(worker.baseRate), { align: 'right', size: 5.25 });
    }
    drawText(`${wk}_fringeSt`, fmtDollar(worker.fringeCredit), { align: 'right', size: 5.25 });
    if ((worker.totalOt ?? 0) > 0) {
      drawText(`${wk}_fringeOt`, fmtDollar(worker.fringeCredit), { align: 'right', size: 5.25 });
    }
    drawText(`${wk}_inLieuSt`, fmtDollar(worker.paymentInLieu), { align: 'right', size: 5.25 });
    if ((worker.totalOt ?? 0) > 0) {
      drawText(`${wk}_inLieuOt`, fmtDollar(worker.paymentInLieu), { align: 'right', size: 5.25 });
    }
    drawText(`${wk}_grossProject`, fmtDollar(worker.grossWagesProject), { align: 'right', size: 5.5 });
    drawText(`${wk}_grossAll`, fmtDollar(worker.grossWagesAll), { align: 'right', size: 5.5 });
    drawText(`${wk}_taxWithheld`, fmtDollar(worker.taxWithheld), { align: 'right' });
    drawText(`${wk}_fica`, fmtDollar(worker.fica), { align: 'right' });
    drawText(`${wk}_otherDeduct`, fmtDollar(worker.otherDeductions), { align: 'right' });
    drawText(`${wk}_totalDeduct`, fmtDollar(worker.deductions), { align: 'right', size: 4 });
    drawText(`${wk}_netPay`, fmtDollar(worker.netPay), { align: 'right', size: 4 });
  }

  drawText('p2_projectName', data.projectName, { size: 5 });
  drawText('p2_projectContractNo', data.projectContractNo, { size: 5 });
  drawText('p2_payrollNo', data.payrollNumber, { align: 'center', size: 5 });
  drawText('p2_contractorName', data.contractorName, { size: 5 });
  drawText('p2_projectLocation', data.projectLocation ?? '', { size: 5 });
  drawText('p2_weekEndingDate', data.weekEndingDate, { align: 'center', size: 5 });
  drawText('p2_certifyingOfficial', `${data.compliance.officialName}, ${data.compliance.officialTitle}`, { size: 5 });

  drawCheck('cert_properPayment', data.compliance.certProperPayment);
  drawCheck('cert_accuratePayroll', data.compliance.certAccuratePayroll);
  drawCheck('cert_workPerformed', data.compliance.certWorkPerformed);
  drawCheck('cert_apprentices', data.compliance.certApprentices);
  drawCheck('cert_fringeBenefits', data.compliance.certFringeBenefits);
  drawCheck('cert_deductions', data.compliance.certDeductions);

  drawText('sig_officialName', data.compliance.officialName, { size: 5 });
  drawText('sig_date', data.compliance.signatureDate, { align: 'center', size: 5 });
  drawText('sig_phone', data.compliance.phoneNumber, { size: 5 });
  drawText('header_formRevision', WH347_FORM_REVISION);

  pdfDoc.setTitle(`WH-347 Certified Payroll — ${WH347_FORM_REVISION}`);
  try {
    const form = pdfDoc.getForm();
    for (const field of form.getFields()) form.removeField(field);
  } catch {
    // Official WH-347 source is flat; this only strips calibration widgets in tests.
  }
  return pdfDoc.save();
}

export function getWh347TemplateBytes(): Uint8Array {
  const templatePath = path.join(
    process.cwd(),
    'assets',
    'wh347-official-2025.pdf',
  );
  return readFileSync(templatePath);
}
