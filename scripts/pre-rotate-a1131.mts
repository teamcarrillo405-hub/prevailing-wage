// Pre-rotate the A-1-131 template to make it landscape-native.
//
// Why: the official DIR A-1-131 PDF is portrait (612×1008) with /Rotate=90.
// pdf-lib's form.flatten() has a bug (PDFForm.js:465 hardcodes rotation:0)
// that breaks widget positioning on pages with /Rotate != 0. We work around
// it by baking the rotation into the content stream once: the new template
// is landscape-native (1008×612, /Rotate=0) and widgets placed on it
// behave normally.
//
//   npx tsx scripts/pre-rotate-a1131.mts
//
// Input:  assets/a1131-official.pdf  (portrait, /Rotate=90)
// Output: assets/a1131-landscape.pdf (landscape, /Rotate=0, same visuals)

import { PDFDocument, degrees } from 'pdf-lib';
import { readFileSync, writeFileSync } from 'fs';

const src = await PDFDocument.load(readFileSync('assets/a1131-official.pdf'));
const dst = await PDFDocument.create();

// embedPages returns EmbeddedPage objects we can draw onto new pages with rotation
const embedded = await dst.embedPages(src.getPages());

for (let i = 0; i < src.getPages().length; i++) {
  const srcPage = src.getPages()[i];
  const emb = embedded[i];
  const rotation = srcPage.getRotation().angle;
  const [nativeW, nativeH] = [srcPage.getWidth(), srcPage.getHeight()];

  // New page dimensions: swap W/H if the page is rotated 90 or 270.
  const isSideways = rotation === 90 || rotation === 270;
  const newW = isSideways ? nativeH : nativeW;
  const newH = isSideways ? nativeW : nativeH;

  const page = dst.addPage([newW, newH]);

  // Draw the embedded page rotated to counteract /Rotate. For /Rotate=90 CW,
  // we draw the content rotated -90 (= 270°) so it appears upright in the new
  // landscape page.
  //
  // When you rotate an embedded page, pdf-lib positions the rotated bbox at
  // the origin; we compensate with x/y offsets depending on rotation.
  let x = 0, y = 0;
  if (rotation === 90) {
    // Content's bottom edge → right side of new page; top edge → left side.
    // Drawing rotate -90 (=270) puts origin at top-left of rotated bbox.
    x = 0;
    y = nativeW; // native width becomes height after rotate; shift up by native width
  } else if (rotation === 270) {
    x = nativeH;
    y = 0;
  } else if (rotation === 180) {
    x = nativeW;
    y = nativeH;
  }

  page.drawPage(emb, {
    x,
    y,
    rotate: degrees(-rotation),
  });

  console.log(`page ${i + 1}: ${nativeW}x${nativeH} /Rotate=${rotation}  →  ${newW}x${newH} /Rotate=0`);
}

writeFileSync('assets/a1131-landscape.pdf', await dst.save());
console.log('\nWrote assets/a1131-landscape.pdf');
