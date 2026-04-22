// Repair widgets.json:
//   1. Strip any widget whose name contains '_copy' (accidental duplicates).
//   2. Restore missing grid span widgets (totalHours..netPay) at default x/w.
//   3. Restore missing sun ST/OT cells.
//   4. Use each row's existing widgets to determine the row's spanY and hour Y's.
//
//   npx tsx scripts/calibrate/repair-widgets.mts
//
// The script preserves calibrated positions for widgets that exist.
// After running, open the calibration UI to fine-tune the restored columns.

import { readFileSync, writeFileSync, copyFileSync } from 'fs';

const FILE = 'scripts/calibrate/widgets.json';
type Widget = {
  name: string; page: 0 | 1; type: 'text' | 'checkbox';
  x: number; y: number; w: number; h: number;
  col?: string; row?: number; kind?: 'span' | 'st' | 'ot' | 'individual';
};

const layout = JSON.parse(readFileSync(FILE, 'utf8')) as {
  pageSize: { w: number; h: number };
  widgets: Widget[];
};

// Backup first
copyFileSync(FILE, FILE + '.before-repair.bak');
console.log(`Backup: ${FILE}.before-repair.bak`);

// 1. Remove all accidental duplicate junk: '_copy' OR trailing '_2' suffix chains
const isJunk = (name: string) =>
  name.includes('_copy') || /_2(_2)*$/.test(name);
const before = layout.widgets.length;
layout.widgets = layout.widgets.filter(w => !isJunk(w.name));
console.log(`Removed ${before - layout.widgets.length} duplicate/junk widgets`);

// 2. Default X/W per span column (from the original layout — user may re-calibrate)
const DEFAULT_COL_XW: Record<string, { x: number; w: number }> = {
  entryNo:        { x: 53,  w: 15 },
  lastName:       { x: 70,  w: 47 },
  firstName:      { x: 120, w: 47 },
  middle:         { x: 170, w: 22 },
  ident:          { x: 195, w: 27 },
  labor:          { x: 225, w: 33 },
  classification: { x: 261, w: 90 },
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
  // Hour day columns (used for sun repair)
  mon: { x: 355, w: 12 }, tue: { x: 369, w: 11 }, wed: { x: 381, w: 11 },
  thu: { x: 393, w: 11 }, fri: { x: 405, w: 12 }, sat: { x: 418, w: 11 },
  sun: { x: 430, w: 27 },
};

const SPAN_COLS = [
  'entryNo','lastName','firstName','middle','ident','labor','classification',
  'totalHours','baseRate','fringe','inLieu','grossProject','grossAll',
  'taxWithheld','fica','otherDeduct','totalDeduct','netPay',
];
const DAYS = ['mon','tue','wed','thu','fri','sat','sun'];

// Helper: find a row's representative span Y (from any existing span widget in that row)
function getRowSpanY(row: number): number | null {
  const existing = layout.widgets.find(w => w.row === row && w.kind === 'span');
  return existing ? existing.y : null;
}
function getRowSpanH(row: number): number {
  const existing = layout.widgets.find(w => w.row === row && w.kind === 'span');
  return existing ? existing.h : 28;
}
function getRowStY(row: number): number | null {
  const existing = layout.widgets.find(w => w.row === row && w.kind === 'st');
  return existing ? existing.y : null;
}
function getRowOtY(row: number): number | null {
  const existing = layout.widgets.find(w => w.row === row && w.kind === 'ot');
  return existing ? existing.y : null;
}
function getRowHourH(row: number): number {
  const existing = layout.widgets.find(w => w.row === row && (w.kind === 'st' || w.kind === 'ot'));
  return existing ? existing.h : 12;
}

// 3. Restore missing span widgets
let restoredSpan = 0;
for (let r = 0; r < 8; r++) {
  const spanY = getRowSpanY(r);
  const spanH = getRowSpanH(r);
  if (spanY === null) {
    console.warn(`Row ${r+1}: no span reference — skipping restoration`);
    continue;
  }
  for (const col of SPAN_COLS) {
    const name = `w${r + 1}_${col}`;
    if (layout.widgets.some(w => w.name === name)) continue;
    const d = DEFAULT_COL_XW[col];
    if (!d) continue;
    layout.widgets.push({
      name, page: 0, type: 'text',
      x: d.x, y: spanY, w: d.w, h: spanH,
      col, row: r, kind: 'span',
    });
    restoredSpan++;
  }
}

// 4. Restore missing hour sun widgets (ST + OT) and any other missing hour cells
let restoredHour = 0;
for (let r = 0; r < 8; r++) {
  const stY = getRowStY(r);
  const otY = getRowOtY(r);
  const hourH = getRowHourH(r);
  if (stY === null || otY === null) {
    console.warn(`Row ${r+1}: no hour reference — skipping hour restoration`);
    continue;
  }
  for (const day of DAYS) {
    for (const kind of ['st', 'ot'] as const) {
      const name = `w${r + 1}_${day}${kind === 'st' ? 'St' : 'Ot'}`;
      if (layout.widgets.some(w => w.name === name)) continue;
      const d = DEFAULT_COL_XW[day];
      const y = kind === 'st' ? stY : otY;
      layout.widgets.push({
        name, page: 0, type: 'text',
        x: d.x, y, w: d.w, h: hourH,
        col: day, row: r, kind,
      });
      restoredHour++;
    }
  }
}

console.log(`Restored ${restoredSpan} span widgets + ${restoredHour} hour widgets`);
console.log(`Final widget count: ${layout.widgets.length}`);

writeFileSync(FILE, JSON.stringify(layout, null, 2));
console.log(`Saved ${FILE}`);
