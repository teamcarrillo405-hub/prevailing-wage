// Build assets/a1131-fillable-template.pdf from widgets.json + the
// pre-rotated landscape template (assets/a1131-landscape.pdf).
//
//   npx tsx scripts/build-a1131-template.mts [--grid]

import { PDFDocument, PDFName, rgb } from 'pdf-lib';
import { readFileSync, writeFileSync } from 'fs';

const GRID_MODE = process.argv.includes('--grid');
const SRC = 'assets/a1131-landscape.pdf';
const LAYOUT = 'scripts/calibrate/a1131/widgets.json';
const OUT = GRID_MODE
  ? 'assets/a1131-fillable-grid.pdf'
  : 'assets/a1131-fillable-template.pdf';

interface Widget {
  name: string; page: 0 | 1; type: 'text' | 'checkbox';
  x: number; y: number; w: number; h: number;
}
const layout = JSON.parse(readFileSync(LAYOUT, 'utf8')) as {
  pageSize: { w: number; h: number }; widgets: Widget[];
};

const doc = await PDFDocument.load(readFileSync(SRC));
const form = doc.getForm();
const pages = doc.getPages();

form.acroForm.dict.set(PDFName.of('NeedAppearances'), doc.context.obj(true));

let count = 0;
for (const w of layout.widgets) {
  const page = pages[w.page];
  if (!page) continue;
  const rect = { x: w.x, y: w.y, width: w.w, height: w.h };
  if (w.type === 'text') {
    const tf = form.createTextField(w.name);
    tf.addToPage(page, {
      ...rect,
      borderWidth: GRID_MODE ? 0.5 : 0,
      borderColor: GRID_MODE ? rgb(1, 0, 0) : undefined,
    });
    tf.setFontSize(6);
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
