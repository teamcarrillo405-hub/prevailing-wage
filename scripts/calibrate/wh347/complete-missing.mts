// complete-missing.mts — one-shot helper.
//
// Adds ONLY the widgets explicitly identified as missing by the audit.
// Does not touch existing widgets. Positions are derived from each row's
// existing same-kind siblings so new widgets stack naturally with neighbors.
//
//   npx tsx scripts/calibrate/complete-missing.mts
//
// What it adds (per row 1..8 if missing):
//   - w{N}_netPay        : full-row span in (9); x/w from default col, y from row's span baseline
//   - w{N}_totalHoursOt  : below existing w{N}_totalHoursSt (14pt lower)
//   - w{N}_baseRateSt    : top half of existing w{N}_baseRate
//   - w{N}_baseRateOt    : bottom half of existing w{N}_baseRate

import { readFileSync, writeFileSync, copyFileSync } from 'fs';

const FILE = 'scripts/calibrate/widgets.json';
type W = {
  name: string; page: 0 | 1; type: 'text' | 'checkbox';
  x: number; y: number; w: number; h: number;
  col?: string; row?: number; kind?: string;
};
const data = JSON.parse(readFileSync(FILE, 'utf8')) as {
  pageSize: { w: number; h: number }; widgets: W[];
};
copyFileSync(FILE, FILE + '.before-complete.bak');
console.log(`Backup: ${FILE}.before-complete.bak`);

const has = (n: string) => data.widgets.some(w => w.name === n);
const find = (n: string) => data.widgets.find(w => w.name === n);
const added: string[] = [];

// --- netPay: 8 rows. Use row's span baseline (from wN_entryNo) for y/h. ---
for (let r = 1; r <= 8; r++) {
  const name = `w${r}_netPay`;
  if (has(name)) continue;
  const anchor = find(`w${r}_entryNo`) ?? find(`w${r}_lastName`);
  if (!anchor) { console.warn(`row ${r}: no anchor for netPay, skipping`); continue; }
  data.widgets.push({
    name, page: 0, type: 'text',
    x: 753, y: anchor.y, w: 36, h: anchor.h,
    col: 'netPay', row: r - 1, kind: 'span',
  });
  added.push(name);
}

// --- totalHoursOt: only fill gaps. Anchor = same row's totalHoursSt. ---
for (let r = 1; r <= 8; r++) {
  const name = `w${r}_totalHoursOt`;
  if (has(name)) continue;
  const st = find(`w${r}_totalHoursSt`);
  if (!st) { console.warn(`row ${r}: no totalHoursSt anchor, skipping totalHoursOt`); continue; }
  data.widgets.push({
    name, page: 0, type: 'text',
    x: st.x, y: st.y - 14, w: st.w, h: st.h,
    col: 'totalHours', row: r - 1, kind: 'ot',
  });
  added.push(name);
}

// --- baseRateSt: 8 rows. Anchor = existing baseRate (single box) — use its
//     TOP HALF for ST. Shrink original to just the top, or leave it and stack
//     the new widget. We'll split: new ST box occupies top half. ---
for (let r = 1; r <= 8; r++) {
  const name = `w${r}_baseRateSt`;
  if (has(name)) continue;
  const base = find(`w${r}_baseRate`);
  if (!base) { console.warn(`row ${r}: no baseRate anchor, skipping baseRateSt`); continue; }
  const halfH = base.h / 2;
  data.widgets.push({
    name, page: 0, type: 'text',
    x: base.x, y: base.y + halfH, w: base.w, h: halfH,
    col: 'baseRate', row: r - 1, kind: 'st',
  });
  added.push(name);
}

// --- baseRateOt: only gaps. Anchor = same row's baseRate (bottom half). ---
for (let r = 1; r <= 8; r++) {
  const name = `w${r}_baseRateOt`;
  if (has(name)) continue;
  const base = find(`w${r}_baseRate`);
  if (!base) { console.warn(`row ${r}: no baseRate anchor, skipping baseRateOt`); continue; }
  const halfH = base.h / 2;
  data.widgets.push({
    name, page: 0, type: 'text',
    x: base.x, y: base.y, w: base.w, h: halfH,
    col: 'baseRate', row: r - 1, kind: 'ot',
  });
  added.push(name);
}

writeFileSync(FILE, JSON.stringify(data, null, 2));
console.log(`Added ${added.length} widgets:`);
for (const n of added) console.log('  +', n);
console.log(`Final widget count: ${data.widgets.length}`);
