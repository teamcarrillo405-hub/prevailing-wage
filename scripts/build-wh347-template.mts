// Build the WH-347 fillable widget template from scripts/calibrate/widgets.json.
//
// Reads:  assets/wh347-official-2025.pdf      (DOL flat source)
//         scripts/calibrate/widgets.json      (layout — edited via calibration UI)
// Writes: assets/wh347-fillable-template.pdf  (widgets baked in)
//
// Run:            npx tsx scripts/build-wh347-template.mts
// Calibration:    npx tsx scripts/build-wh347-template.mts --grid
//
// The --grid flag renders each widget rect with a visible border (red for
// text fields, blue for checkboxes). Useful for visual verification in
// Acrobat after a calibration session.

import { PDFDocument, PDFName, rgb } from 'pdf-lib';
import { readFileSync, writeFileSync } from 'fs';

const GRID_MODE = process.argv.includes('--grid');
const SRC = 'assets/wh347-official-2025.pdf';
const LAYOUT = 'scripts/calibrate/widgets.json';
const OUT = GRID_MODE
  ? 'assets/wh347-fillable-grid.pdf'
  : 'assets/wh347-fillable-template.pdf';

interface Widget {
  name: string;
  page: 0 | 1;
  type: 'text' | 'checkbox';
  x: number; y: number; w: number; h: number;
}
interface Layout {
  pageSize: { w: number; h: number };
  widgets: Widget[];
}

const layout: Layout = JSON.parse(readFileSync(LAYOUT, 'utf8'));
const doc = await PDFDocument.load(readFileSync(SRC));
const form = doc.getForm();
const pages = doc.getPages();

// Enable field highlighting when viewed in Acrobat.
form.acroForm.dict.set(PDFName.of('NeedAppearances'), doc.context.obj(true));

let count = 0;
for (const w of layout.widgets) {
  const page = pages[w.page];
  if (!page) {
    console.warn(`skip ${w.name}: page ${w.page} missing`);
    continue;
  }
  const rect = { x: w.x, y: w.y, width: w.w, height: w.h };
  if (w.type === 'text') {
    const tf = form.createTextField(w.name);
    tf.addToPage(page, {
      ...rect,
      borderWidth: GRID_MODE ? 0.5 : 0,
      borderColor: GRID_MODE ? rgb(1, 0, 0) : undefined,
    });
    tf.setFontSize(7);
  } else {
    const cb = form.createCheckBox(w.name);
    cb.addToPage(page, {
      ...rect,
      borderWidth: GRID_MODE ? 0.5 : 0,
      borderColor: GRID_MODE ? rgb(0, 0, 1) : undefined,
    });
  }
  count++;
}

writeFileSync(OUT, await doc.save({ useObjectStreams: false }));
console.log(`Wrote ${OUT} — ${count} widgets (grid=${GRID_MODE})`);
