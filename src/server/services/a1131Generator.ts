// src/server/services/a1131Generator.ts
//
// California DIR A-1-131 PDF fill — name-based AcroForm widget fill + flatten.
//
// Template: assets/a1131-fillable-template.pdf (built by
// scripts/build-a1131-template.mts from the pre-rotated landscape
// PDF assets/a1131-landscape.pdf + widget layout in
// scripts/calibrate/a1131/widgets.json).
//
// The DOL's official DIR A-1-131 is portrait (612×1008) with /Rotate=90.
// scripts/pre-rotate-a1131.mts flattens that rotation into the content
// stream so our template is landscape-native (1008×612, /Rotate=0).
// This bypasses the known pdf-lib flatten bug (PDFForm.js:465 hardcodes
// rotation:0) which breaks widget positioning on rotated pages.
//
// Widget naming:
//   header_*            : page 1 header text fields
//   w{1..5}_*           : page 1 worker-row cells (span / ST / OT / DT sub-rows)
//   cert_*              : page 2 certification text fields
//   pageOfPages         : "Page X of Y" indicator when overflow triggers

import { PDFDocument } from 'pdf-lib';
import path from 'path';
import { readFileSync } from 'fs';

// ── Interfaces (unchanged public API) ─────────────────────────────────────

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

const ROWS_PER_PAGE = 5;

// ── Helpers ────────────────────────────────────────────────────────────────

const fmtDollar = (n: number | undefined) => (n != null && n > 0 ? n.toFixed(2) : '');
const fmtHours  = (n: number | undefined) => (n != null && n > 0 ? String(n)  : '');

function setText(form: ReturnType<PDFDocument['getForm']>, name: string, value: string): void {
  try { form.getTextField(name).setText(value); } catch { /* widget not present — skip */ }
}

// ── Main entry ────────────────────────────────────────────────────────────

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

  // Overflow: fill each 5-worker chunk into a fresh template copy, flatten,
  // merge into master PDF.
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

// ── Per-page-set filler ───────────────────────────────────────────────────

async function fillSingleSet(
  data: A1131Data,
  workers: A1131WorkerRow[],
  setNumber: number,
  totalSets: number,
  templateBytes: Uint8Array | Buffer,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();

  // Header
  setText(form, 'header_contractorName',    data.contractorName);
  setText(form, 'header_cslbLicense',       data.cslbLicense);
  setText(form, 'header_contractorAddress', data.contractorAddress);
  setText(form, 'header_payrollNumber',     data.payrollNumber);
  setText(form, 'header_weekEndingDate',    data.weekEndingDate);
  setText(form, 'header_wcPolicyNumber',    data.wcPolicyNumber);
  setText(form, 'header_contractNo',        data.contractNo);
  setText(form, 'header_projectLocation',   data.projectLocation);

  if (totalSets > 1) {
    setText(form, 'pageOfPages', `Page ${setNumber} of ${totalSets}`);
  }

  // Worker rows
  for (let i = 0; i < workers.length; i++) {
    const w = workers[i];
    const wk = `w${i + 1}`;

    // Normalize worker name display ("Last, First" format)
    let displayName = w.workerName;
    if (w.workerName.includes(',')) {
      const [last, rest] = w.workerName.split(',');
      displayName = `${(last ?? '').trim()}, ${(rest ?? '').trim()}`;
    }

    // Span fields
    setText(form, `${wk}_entryNo`,        String(w.entryNo));
    setText(form, `${wk}_workerName`,     displayName);
    setText(form, `${wk}_identifyingNo`,  w.identifyingNo);
    setText(form, `${wk}_laborType`,      w.laborType === 'journeyworker' ? 'J' : 'RA');
    setText(form, `${wk}_classification`, w.classification);

    // ST sub-row — Mon–Sun hours + totals + rate + money columns
    setText(form, `${wk}_monSt`,           fmtHours(w.monSt));
    setText(form, `${wk}_tueSt`,           fmtHours(w.tueSt));
    setText(form, `${wk}_wedSt`,           fmtHours(w.wedSt));
    setText(form, `${wk}_thuSt`,           fmtHours(w.thuSt));
    setText(form, `${wk}_friSt`,           fmtHours(w.friSt));
    setText(form, `${wk}_satSt`,           fmtHours(w.satSt));
    setText(form, `${wk}_sunSt`,           fmtHours(w.sunSt));
    setText(form, `${wk}_totalSt`,         fmtHours(w.totalSt));
    setText(form, `${wk}_stRate`,          fmtDollar(w.stRate));
    setText(form, `${wk}_grossWages`,      fmtDollar(w.grossWages));
    setText(form, `${wk}_federalTax`,      fmtDollar(w.federalTax));
    setText(form, `${wk}_stateTax`,        fmtDollar(w.stateTax));
    setText(form, `${wk}_sdi`,             fmtDollar(w.sdi));
    setText(form, `${wk}_otherDeductions`, fmtDollar(w.otherDeductions));
    setText(form, `${wk}_netPay`,          fmtDollar(w.netPay));

    // OT sub-row
    setText(form, `${wk}_monOt`,        fmtHours(w.monOt));
    setText(form, `${wk}_tueOt`,        fmtHours(w.tueOt));
    setText(form, `${wk}_wedOt`,        fmtHours(w.wedOt));
    setText(form, `${wk}_thuOt`,        fmtHours(w.thuOt));
    setText(form, `${wk}_friOt`,        fmtHours(w.friOt));
    setText(form, `${wk}_satOt`,        fmtHours(w.satOt));
    setText(form, `${wk}_sunOt`,        fmtHours(w.sunOt));
    setText(form, `${wk}_totalOt`,      fmtHours(w.totalOt));
    setText(form, `${wk}_otRate`,       fmtDollar(w.otRate));
    setText(form, `${wk}_fringeCredit`, fmtDollar(w.fringeCredit));

    // DT sub-row (CA-specific doubletime)
    setText(form, `${wk}_monDt`,   fmtHours(w.monDt));
    setText(form, `${wk}_tueDt`,   fmtHours(w.tueDt));
    setText(form, `${wk}_wedDt`,   fmtHours(w.wedDt));
    setText(form, `${wk}_thuDt`,   fmtHours(w.thuDt));
    setText(form, `${wk}_friDt`,   fmtHours(w.friDt));
    setText(form, `${wk}_satDt`,   fmtHours(w.satDt));
    setText(form, `${wk}_sunDt`,   fmtHours(w.sunDt));
    setText(form, `${wk}_totalDt`, fmtHours(w.totalDt));
    setText(form, `${wk}_dtRate`,  fmtDollar(w.dtRate));

    // Total deductions — drawn between OT and DT rows per form layout
    setText(form, `${wk}_totalDeductions`, fmtDollar(w.totalDeductions));
  }

  // Page 2: certification
  setText(form, 'cert_contractorName',
    data.contractorName);
  setText(form, 'cert_payrollDescription',
    `Payroll #${data.payrollNumber} — ${data.projectLocation}`);
  setText(form, 'cert_weekEndingDate',
    data.weekEndingDate);

  form.flatten();
  return pdfDoc.save();
}

// ── Template loader ───────────────────────────────────────────────────────

export function getA1131TemplateBytes(): Uint8Array {
  const templatePath = path.join(
    process.cwd(),
    'assets',
    'a1131-fillable-template.pdf',
  );
  return readFileSync(templatePath);
}
