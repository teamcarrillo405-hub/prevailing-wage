// One-time extractor: takes the coordinate constants from the original
// build script and emits scripts/calibrate/widgets.json as the calibration
// source of truth. After this runs, widgets.json is edited by the calibration
// UI; this script is kept for reproducibility but normally not re-run.
//
//   npx tsx scripts/calibrate/extract-widgets.mts

import { writeFileSync } from 'fs';

// ── Current layout (copied from scripts/build-wh347-template.mts) ─────────

const HEADER_ROW1_Y = 463, HEADER_ROW2_Y = 432, HEADER_ROW_H = 14;

const HEADER: Record<string, { x: number; y: number; w: number; h: number }> = {
  projectName:         { x: 45,  y: HEADER_ROW1_Y, w: 150, h: HEADER_ROW_H },
  projectContractNo:   { x: 198, y: HEADER_ROW1_Y, w: 145, h: HEADER_ROW_H },
  payrollNumber:       { x: 346, y: HEADER_ROW1_Y, w: 100, h: HEADER_ROW_H },
  contractorName:      { x: 448, y: HEADER_ROW1_Y, w: 320, h: HEADER_ROW_H },
  projectLocation:     { x: 45,  y: HEADER_ROW2_Y, w: 150, h: HEADER_ROW_H },
  wageDeterminationNo: { x: 198, y: HEADER_ROW2_Y, w: 145, h: HEADER_ROW_H },
  weekEndingDate:      { x: 346, y: HEADER_ROW2_Y, w: 100, h: HEADER_ROW_H },
  contractorAddress:   { x: 448, y: HEADER_ROW2_Y, w: 320, h: HEADER_ROW_H },
};

const SUBMISSION_CB = {
  final: { x: 41,  y: 501, size: 9 },
  prime: { x: 432, y: 501, size: 9 },
  sub:   { x: 576, y: 501, size: 9 },
};

const COL = {
  entryNo:        { x: 53,  w: 15 },
  lastName:       { x: 70,  w: 47 },
  firstName:      { x: 120, w: 47 },
  middle:         { x: 170, w: 22 },
  ident:          { x: 195, w: 27 },
  labor:          { x: 225, w: 33 },
  classification: { x: 261, w: 90 },
  monHours:       { x: 355, w: 12 },
  tueHours:       { x: 369, w: 11 },
  wedHours:       { x: 381, w: 11 },
  thuHours:       { x: 393, w: 11 },
  friHours:       { x: 405, w: 12 },
  satHours:       { x: 418, w: 11 },
  sunHours:       { x: 430, w: 27 },
  totalHours:     { x: 461, w: 40 },
  baseRate:       { x: 503, w: 25 },
  fringe:         { x: 529, w: 25 },
  inLieu:         { x: 555, w: 25 },
  grossProject:   { x: 581, w: 27 },
  grossAll:       { x: 609, w: 26 },
  taxWithheld:    { x: 636, w: 26 },
  fica:           { x: 663, w: 29 },
  otherDeduct:    { x: 693, w: 23 },
  totalDeduct:    { x: 717, w: 35 },
  netPay:         { x: 753, w: 36 },
};

const GRID_ROWS = Array.from({ length: 8 }, (_, i) => ({
  st: 326 - i * 29,
  ot: 312 - i * 29,
}));

const SPAN_H = 28, HALF_H = 12;

const SPAN_FIELDS = [
  'entryNo', 'lastName', 'firstName', 'middle', 'ident', 'labor', 'classification',
  'totalHours', 'baseRate', 'fringe', 'inLieu', 'grossProject', 'grossAll',
  'taxWithheld', 'fica', 'otherDeduct', 'totalDeduct', 'netPay',
];
const HOUR_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const HOUR_COL: Record<string, keyof typeof COL> = {
  mon: 'monHours', tue: 'tueHours', wed: 'wedHours', thu: 'thuHours',
  fri: 'friHours', sat: 'satHours', sun: 'sunHours',
};

const P2 = {
  p2_projectName:        { x: 32,  y: 565, w: 210, h: 16 },
  p2_projectContractNo:  { x: 240, y: 565, w: 140, h: 16 },
  p2_payrollNo:          { x: 378, y: 565, w: 95,  h: 16 },
  p2_contractorName:     { x: 473, y: 565, w: 287, h: 16 },
  p2_projectLocation:    { x: 32,  y: 535, w: 345, h: 16 },
  p2_weekEndingDate:     { x: 378, y: 535, w: 95,  h: 16 },
  p2_certifyingOfficial: { x: 473, y: 535, w: 287, h: 16 },
  sig_officialName:      { x: 32,  y: 70,  w: 350, h: 14 },
  sig_date:              { x: 378, y: 70,  w: 95,  h: 14 },
  sig_phone:             { x: 473, y: 70,  w: 145, h: 14 },
  sig_email:             { x: 620, y: 70,  w: 148, h: 14 },
};

const CERT_CB = {
  properPayment:   { x: 37, y: 478 },
  accuratePayroll: { x: 37, y: 447 },
  workPerformed:   { x: 37, y: 427 },
  apprentices:     { x: 37, y: 403 },
  fringeBenefits:  { x: 37, y: 318 },
  deductions:      { x: 37, y: 131 },
};

// ── Assemble widgets array ────────────────────────────────────────────────

type Widget = {
  name: string;
  page: 0 | 1;
  type: 'text' | 'checkbox';
  x: number; y: number; w: number; h: number;
  col?: string;
  row?: number;
  kind?: 'span' | 'st' | 'ot' | 'individual';
};

const widgets: Widget[] = [];

// Page 1: headers
for (const [key, r] of Object.entries(HEADER)) {
  widgets.push({ name: `header_${key}`, page: 0, type: 'text', ...r, kind: 'individual' });
}

// Page 1: submission checkboxes
for (const [key, cb] of Object.entries(SUBMISSION_CB)) {
  widgets.push({ name: `cb_${key}`, page: 0, type: 'checkbox',
    x: cb.x, y: cb.y, w: cb.size, h: cb.size, kind: 'individual' });
}

// Page 1: worker grid — span fields
for (let r = 0; r < GRID_ROWS.length; r++) {
  const row = GRID_ROWS[r];
  const spanY = row.ot - 2;
  for (const colName of SPAN_FIELDS) {
    const c = (COL as any)[colName];
    widgets.push({
      name: `w${r + 1}_${colName}`, page: 0, type: 'text',
      x: c.x, y: spanY, w: c.w, h: SPAN_H,
      col: colName, row: r, kind: 'span',
    });
  }
}

// Page 1: worker grid — hour cells (ST + OT per day)
for (let r = 0; r < GRID_ROWS.length; r++) {
  const row = GRID_ROWS[r];
  const stY = row.st - 2;
  const otY = row.ot - 2;
  for (const day of HOUR_DAYS) {
    const c = (COL as any)[HOUR_COL[day]];
    widgets.push({
      name: `w${r + 1}_${day}St`, page: 0, type: 'text',
      x: c.x, y: stY, w: c.w, h: HALF_H,
      col: day, row: r, kind: 'st',
    });
    widgets.push({
      name: `w${r + 1}_${day}Ot`, page: 0, type: 'text',
      x: c.x, y: otY, w: c.w, h: HALF_H,
      col: day, row: r, kind: 'ot',
    });
  }
}

// Page 2: text fields
for (const [name, r] of Object.entries(P2)) {
  widgets.push({ name, page: 1, type: 'text', ...r, kind: 'individual' });
}

// Page 2: compliance checkboxes
for (const [key, cb] of Object.entries(CERT_CB)) {
  widgets.push({ name: `cert_${key}`, page: 1, type: 'checkbox',
    x: cb.x, y: cb.y, w: 9, h: 9, kind: 'individual' });
}

writeFileSync(
  'scripts/calibrate/widgets.json',
  JSON.stringify({ pageSize: { w: 792, h: 612 }, widgets }, null, 2),
);
console.log(`Wrote scripts/calibrate/widgets.json (${widgets.length} widgets)`);
