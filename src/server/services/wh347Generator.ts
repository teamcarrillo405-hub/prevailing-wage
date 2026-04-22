// src/server/services/wh347Generator.ts
//
// WH-347 PDF fill — name-based AcroForm widget fill + flatten.
//
// The widget template lives at assets/wh347-fillable-template.pdf and is
// built (and committed) by scripts/build-wh347-template.mts. Widget names
// follow a stable convention:
//
//   header_*            page 1 header text fields
//   cb_{final|prime|sub}  page 1 submission-type checkboxes
//   w{1..8}_*           page 1 worker-grid cells (18 span fields + 14 hour fields per row)
//   p2_*                page 2 header text fields
//   cert_*              page 2 compliance checkboxes
//   sig_*               page 2 signature block text fields
//
// To move a field, edit scripts/build-wh347-template.mts and re-run it.
// Runtime code here does not know or care about coordinates.

import { PDFDocument } from 'pdf-lib';
import path from 'path';
import { readFileSync } from 'fs';

// ── Interfaces (unchanged public API) ─────────────────────────────────────

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

// Rows per printed form (single page set).
const ROWS_PER_PAGE = 8;

// ── Helpers ────────────────────────────────────────────────────────────────

const fmtDollar = (n: number | undefined) => (n ?? 0).toFixed(2);
const fmtHours = (n: number | undefined) => (n != null && n > 0 ? String(n) : '');

/** Set a text-field value if the widget exists; silently skip otherwise. */
function setText(form: ReturnType<PDFDocument['getForm']>, name: string, value: string): void {
  try {
    form.getTextField(name).setText(value);
  } catch {
    // Field doesn't exist in template — ignore (allows partial templates).
  }
}

/** Set a checkbox value if the widget exists. */
function setCheck(
  form: ReturnType<PDFDocument['getForm']>,
  name: string,
  checked: boolean,
): void {
  try {
    const cb = form.getCheckBox(name);
    checked ? cb.check() : cb.uncheck();
  } catch {
    // Field doesn't exist — ignore.
  }
}

/** Split "Last, First M" into { last, first, middle } */
function splitName(workerName: string): { last: string; first: string; middle: string } {
  if (workerName.includes(',')) {
    const [l, rest] = workerName.split(',', 2);
    const parts = (rest ?? '').trim().split(/\s+/);
    return { last: l.trim(), first: parts[0] ?? '', middle: parts[1] ?? '' };
  }
  return { last: workerName, first: '', middle: '' };
}

// ── Main entry point ──────────────────────────────────────────────────────

export async function fillWh347(
  data: Wh347Data,
  templateBytes: Uint8Array,
): Promise<Uint8Array> {
  // Chunk workers into page-sets of ROWS_PER_PAGE. Empty worker list still
  // produces one (empty) page-set so every form renders the header.
  const chunks: Wh347WorkerRow[][] = [];
  for (let i = 0; i < data.workers.length; i += ROWS_PER_PAGE) {
    chunks.push(data.workers.slice(i, i + ROWS_PER_PAGE));
  }
  if (chunks.length === 0) chunks.push([]);

  // Single-set fast path: fill + flatten + return directly.
  if (chunks.length === 1) {
    return fillSingleSet(data, chunks[0], 1, 1, templateBytes);
  }

  // Overflow path: each 8-worker chunk gets its own filled+flattened copy of
  // the 2-page template. We merge all of them into one master PDF.
  //
  // This avoids AcroForm widget-name collisions entirely: after flatten(),
  // each chunk's widgets become inline content (PDF operators), so copying
  // pages into the master doc carries no widget state.
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
    for (const p of pages) master.addPage(p);
  }
  return master.save();
}

// ── Per-set filler (fills one template copy with up to 8 workers) ─────────

async function fillSingleSet(
  data: Wh347Data,
  workers: Wh347WorkerRow[],
  setNumber: number,     // 1-based (shown as "Page X of Y")
  totalSets: number,
  templateBytes: Uint8Array,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();

  // ── Page 1 header ───────────────────────────────────────────────────────
  setText(form, 'header_projectName',         data.projectName);
  setText(form, 'header_projectContractNo',   data.projectContractNo);
  setText(form, 'header_payrollNumber',       data.payrollNumber);
  setText(form, 'header_contractorName',      data.contractorName);
  setText(form, 'header_projectLocation',     data.projectLocation ?? '');
  setText(form, 'header_wageDeterminationNo', data.wageDeterminationNo);
  setText(form, 'header_weekEndingDate',      data.weekEndingDate);
  setText(form, 'header_contractorAddress',   data.contractorAddress);

  // Submission-type checkboxes
  setCheck(form, 'cb_final', !!data.isFinal);
  setCheck(form, 'cb_prime', data.isPrime !== false);
  setCheck(form, 'cb_sub',   data.isPrime === false);

  // Optional "Page X of Y" indicator widget, if template includes one
  if (totalSets > 1) {
    setText(form, 'pageOfPages', `Page ${setNumber} of ${totalSets}`);
  }

  // ── Worker rows ─────────────────────────────────────────────────────────
  for (let i = 0; i < workers.length; i++) {
    const w = workers[i];
    const wk = `w${i + 1}`;
    const { last, first, middle } = splitName(w.workerName);

    setText(form, `${wk}_entryNo`,        String(w.entryNo));
    setText(form, `${wk}_lastName`,       last);
    setText(form, `${wk}_firstName`,      first);
    setText(form, `${wk}_middle`,         middle);
    setText(form, `${wk}_ident`,          w.identifyingNo);
    setText(form, `${wk}_labor`,          w.laborType === 'journeyworker' ? 'J' : 'RA');
    setText(form, `${wk}_classification`, w.classification);

    // Daily hours — ST + OT per day
    setText(form, `${wk}_monSt`, fmtHours(w.monSt));
    setText(form, `${wk}_monOt`, fmtHours(w.monOt));
    setText(form, `${wk}_tueSt`, fmtHours(w.tueSt));
    setText(form, `${wk}_tueOt`, fmtHours(w.tueOt));
    setText(form, `${wk}_wedSt`, fmtHours(w.wedSt));
    setText(form, `${wk}_wedOt`, fmtHours(w.wedOt));
    setText(form, `${wk}_thuSt`, fmtHours(w.thuSt));
    setText(form, `${wk}_thuOt`, fmtHours(w.thuOt));
    setText(form, `${wk}_friSt`, fmtHours(w.friSt));
    setText(form, `${wk}_friOt`, fmtHours(w.friOt));
    setText(form, `${wk}_satSt`, fmtHours(w.satSt));
    setText(form, `${wk}_satOt`, fmtHours(w.satOt));
    setText(form, `${wk}_sunSt`, fmtHours(w.sunSt));
    setText(form, `${wk}_sunOt`, fmtHours(w.sunOt));

    // Totals — supports both single full-span field AND split ST/OT boxes.
    // Whichever widget exists in the template gets filled; missing ones skip.
    const totalHours = (w.totalSt ?? 0) + (w.totalOt ?? 0);
    setText(form, `${wk}_totalHours`,   fmtHours(totalHours));
    setText(form, `${wk}_totalHoursSt`, fmtHours(w.totalSt));
    setText(form, `${wk}_totalHoursOt`, fmtHours(w.totalOt));

    // Money columns. Each supports a single span field OR a split ST/OT pair.
    // Same value goes into both sub-boxes unless the data distinguishes them.
    setText(form, `${wk}_baseRate`,     fmtDollar(w.baseRate));
    setText(form, `${wk}_baseRateSt`,   fmtDollar(w.baseRate));
    setText(form, `${wk}_baseRateOt`,   fmtDollar(w.baseRate));

    setText(form, `${wk}_fringe`,       fmtDollar(w.fringeCredit));
    setText(form, `${wk}_fringeSt`,     fmtDollar(w.fringeCredit));
    setText(form, `${wk}_fringeOt`,     fmtDollar(w.fringeCredit));

    setText(form, `${wk}_inLieu`,       fmtDollar(w.paymentInLieu));
    setText(form, `${wk}_inLieuSt`,     fmtDollar(w.paymentInLieu));
    setText(form, `${wk}_inLieuOt`,     fmtDollar(w.paymentInLieu));

    setText(form, `${wk}_grossProject`, fmtDollar(w.grossWagesProject));
    setText(form, `${wk}_grossAll`,     fmtDollar(w.grossWagesAll));
    setText(form, `${wk}_taxWithheld`,  fmtDollar(w.taxWithheld));
    setText(form, `${wk}_fica`,         fmtDollar(w.fica));
    setText(form, `${wk}_otherDeduct`,  fmtDollar(w.otherDeductions));
    setText(form, `${wk}_totalDeduct`,  fmtDollar(w.deductions));
    setText(form, `${wk}_netPay`,       fmtDollar(w.netPay));
  }

  // ── Page 2: Statement of Compliance ─────────────────────────────────────
  setText(form, 'p2_projectName',        data.projectName);
  setText(form, 'p2_projectContractNo',  data.projectContractNo);
  setText(form, 'p2_payrollNo',          data.payrollNumber);
  setText(form, 'p2_contractorName',     data.contractorName);
  setText(form, 'p2_projectLocation',    data.projectLocation ?? '');
  setText(form, 'p2_weekEndingDate',     data.weekEndingDate);
  setText(form, 'p2_certifyingOfficial', `${data.compliance.officialName}, ${data.compliance.officialTitle}`);

  setCheck(form, 'cert_properPayment',   data.compliance.certProperPayment);
  setCheck(form, 'cert_accuratePayroll', data.compliance.certAccuratePayroll);
  setCheck(form, 'cert_workPerformed',   data.compliance.certWorkPerformed);
  setCheck(form, 'cert_apprentices',     data.compliance.certApprentices);
  setCheck(form, 'cert_fringeBenefits',  data.compliance.certFringeBenefits);
  setCheck(form, 'cert_deductions',      data.compliance.certDeductions);

  setText(form, 'sig_officialName', data.compliance.officialName);
  setText(form, 'sig_date',         data.compliance.signatureDate);
  setText(form, 'sig_phone',        data.compliance.phoneNumber);

  // ── Flatten: convert widgets into drawn content so the output is a
  // plain (non-editable) PDF, per project decision (option b). ────────────
  form.flatten();

  return pdfDoc.save();
}

// ── Template loader ───────────────────────────────────────────────────────

export function getWh347TemplateBytes(): Uint8Array {
  const templatePath = path.join(
    process.cwd(),
    'assets',
    'wh347-fillable-template.pdf',
  );
  return readFileSync(templatePath);
}
