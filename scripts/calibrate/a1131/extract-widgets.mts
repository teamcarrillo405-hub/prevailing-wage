// Seeds scripts/calibrate/a1131/widgets.json from coordinate constants
// extracted from the original a1131Generator.ts.
//
//   npx tsx scripts/calibrate/a1131/extract-widgets.mts
//
// Page 1 is landscape (1008×612) — works with pre-rotated template
// (assets/a1131-landscape.pdf). Page 2 is portrait (612×1008) with
// absolute coords (no CTM).

import { writeFileSync } from 'fs';

// Column X positions (landscape space on page 1)
const COL = {
  entryNo:         { x: 205, w: 17 },
  workerName:      { x: 57,  w: 50 },
  identifyingNo:   { x: 228, w: 22 },
  laborType:       { x: 252, w: 12 },
  classification:  { x: 265, w: 42 },
  monHours:        { x: 327, w: 15 },
  tueHours:        { x: 344, w: 12 },
  wedHours:        { x: 357, w: 22 },
  thuHours:        { x: 379, w: 22 },
  friHours:        { x: 401, w: 18 },
  satHours:        { x: 419, w: 18 },
  sunHours:        { x: 437, w: 22 },
  totalHours:      { x: 462, w: 35 },
  hourlyRate:      { x: 499, w: 40 },
  grossWages:      { x: 540, w: 45 },
  fedTax:          { x: 638, w: 40 },
  stateTax:        { x: 720, w: 38 },
  sdi:             { x: 761, w: 35 },
  otherDeductions: { x: 830, w: 38 },
  totalDeductions: { x: 869, w: 38 },
  netPay:          { x: 912, w: 40 },
  fringeCredit:    { x: 912, w: 40 },
};

// Worker row Y positions: baseY=391, spacing=92, st→ot gap=47
const ROW_HEIGHT = 11;
function getRowY(idx: number): { st: number; ot: number; dt: number } {
  const baseY = 391;
  const blockSpacing = 92;
  const subRowSpacing = 47;
  const stY = baseY - idx * blockSpacing;
  return { st: stY, ot: stY - subRowSpacing, dt: stY - subRowSpacing * 2 };
}

type Widget = {
  name: string; page: 0 | 1; type: 'text' | 'checkbox';
  x: number; y: number; w: number; h: number;
  col?: string; row?: number; kind?: 'span' | 'st' | 'ot' | 'dt' | 'individual';
};

const widgets: Widget[] = [];

// ── Page 1 header ───────────────────────────────────────────────────────
// Text baselines from generator: contractorName at ly=535, etc. Widgets sit
// slightly below with a modest height so they're readable.
const HEADER_FIELDS: Array<[string, number, number, number]> = [
  // [name, x, y-baseline, width]
  ['contractorName',    315, 535, 295],
  ['cslbLicense',       618, 535, 145],
  ['contractorAddress', 770, 535, 200],
  ['payrollNumber',     283, 514, 160],
  ['weekEndingDate',    454, 514, 200],
  ['wcPolicyNumber',    675, 497, 180],
  ['contractNo',        866, 514, 130],
  ['projectLocation',   856, 497, 140],
];
for (const [name, x, y, w] of HEADER_FIELDS) {
  widgets.push({
    name: `header_${name}`, page: 0, type: 'text',
    x, y: y - 2, w, h: 12, kind: 'individual',
  });
}

// Page indicator (shown when overflow)
widgets.push({
  name: 'pageOfPages', page: 0, type: 'text',
  x: 930, y: 554, w: 60, h: 10, kind: 'individual',
});

// ── Page 1: 5 worker rows ────────────────────────────────────────────────
const SPAN_FIELDS: Array<[string, keyof typeof COL]> = [
  ['entryNo', 'entryNo'],
  ['workerName', 'workerName'],
  ['identifyingNo', 'identifyingNo'],
  ['laborType', 'laborType'],
  ['classification', 'classification'],
];
const ST_FIELDS: Array<[string, keyof typeof COL]> = [
  ['monSt', 'monHours'], ['tueSt', 'tueHours'], ['wedSt', 'wedHours'],
  ['thuSt', 'thuHours'], ['friSt', 'friHours'], ['satSt', 'satHours'],
  ['sunSt', 'sunHours'], ['totalSt', 'totalHours'], ['stRate', 'hourlyRate'],
  ['grossWages', 'grossWages'],
  ['federalTax', 'fedTax'], ['stateTax', 'stateTax'],
  ['sdi', 'sdi'], ['otherDeductions', 'otherDeductions'],
  ['netPay', 'netPay'],
];
const OT_FIELDS: Array<[string, keyof typeof COL]> = [
  ['monOt', 'monHours'], ['tueOt', 'tueHours'], ['wedOt', 'wedHours'],
  ['thuOt', 'thuHours'], ['friOt', 'friHours'], ['satOt', 'satHours'],
  ['sunOt', 'sunHours'], ['totalOt', 'totalHours'], ['otRate', 'hourlyRate'],
  ['fringeCredit', 'fringeCredit'],
];
const DT_FIELDS: Array<[string, keyof typeof COL]> = [
  ['monDt', 'monHours'], ['tueDt', 'tueHours'], ['wedDt', 'wedHours'],
  ['thuDt', 'thuHours'], ['friDt', 'friHours'], ['satDt', 'satHours'],
  ['sunDt', 'sunHours'], ['totalDt', 'totalHours'], ['dtRate', 'hourlyRate'],
];

for (let r = 0; r < 5; r++) {
  const y = getRowY(r);
  const wk = `w${r + 1}`;

  // Span fields (entryNo, name, ident, labor, classification) — stretched
  // across full ST+OT+DT sub-rows for the left-side columns.
  const spanH = y.st - (y.dt - ROW_HEIGHT);  // from DT bottom to ST top
  for (const [fName, cName] of SPAN_FIELDS) {
    const c = COL[cName];
    widgets.push({
      name: `${wk}_${fName}`, page: 0, type: 'text',
      x: c.x, y: y.dt - 2, w: c.w, h: spanH,
      col: cName, row: r, kind: 'span',
    });
  }

  // ST sub-row fields
  for (const [fName, cName] of ST_FIELDS) {
    const c = COL[cName];
    widgets.push({
      name: `${wk}_${fName}`, page: 0, type: 'text',
      x: c.x, y: y.st - 2, w: c.w, h: ROW_HEIGHT,
      col: cName, row: r, kind: 'st',
    });
  }

  // OT sub-row fields
  for (const [fName, cName] of OT_FIELDS) {
    const c = COL[cName];
    widgets.push({
      name: `${wk}_${fName}`, page: 0, type: 'text',
      x: c.x, y: y.ot - 2, w: c.w, h: ROW_HEIGHT,
      col: cName, row: r, kind: 'ot',
    });
  }

  // DT sub-row fields (CA-specific doubletime)
  for (const [fName, cName] of DT_FIELDS) {
    const c = COL[cName];
    widgets.push({
      name: `${wk}_${fName}`, page: 0, type: 'text',
      x: c.x, y: y.dt - 2, w: c.w, h: ROW_HEIGHT,
      col: cName, row: r, kind: 'dt',
    });
  }

  // Total deductions — generator draws at stY-39, which is between OT and DT
  widgets.push({
    name: `${wk}_totalDeductions`, page: 0, type: 'text',
    x: COL.totalDeductions.x, y: y.st - 41, w: COL.totalDeductions.w, h: ROW_HEIGHT,
    col: 'totalDeductions', row: r, kind: 'span',
  });
}

// ── Page 2: Certification page (portrait, absolute coords) ──────────────
widgets.push({
  name: 'cert_contractorName', page: 1, type: 'text',
  x: 80, y: 628, w: 290, h: 12, kind: 'individual',
});
widgets.push({
  name: 'cert_payrollDescription', page: 1, type: 'text',
  x: 375, y: 586, w: 160, h: 12, kind: 'individual',
});
widgets.push({
  name: 'cert_weekEndingDate', page: 1, type: 'text',
  x: 108, y: 449, w: 150, h: 12, kind: 'individual',
});

writeFileSync(
  'scripts/calibrate/a1131/widgets.json',
  JSON.stringify({ pageSize: { w: 1008, h: 612 }, widgets }, null, 2),
);
console.log(`Wrote scripts/calibrate/a1131/widgets.json (${widgets.length} widgets)`);
