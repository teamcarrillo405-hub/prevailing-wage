#!/usr/bin/env node
// Run: node scripts/discover-wh347-fields.js
// Downloads the 2025 DOL WH-347 PDF and lists all AcroForm field names and types.
// Output must be committed as WH347_FIELDS constant in src/server/services/wh347Generator.ts
// Source: github.com/Hopding/pdf-lib/issues/615 pattern

import { PDFDocument } from 'pdf-lib';
import { readFileSync, existsSync } from 'fs';
import { createWriteStream } from 'fs';
import https from 'https';

const PDF_PATH = './assets/wh347-official-2025.pdf';
const PDF_URL = 'https://www.dol.gov/sites/dolgov/files/WHD/legacy/files/wh347.pdf';

async function downloadPdf() {
  if (existsSync(PDF_PATH)) {
    console.log('PDF already exists at', PDF_PATH);
    return;
  }
  console.log('Downloading WH-347 from', PDF_URL, '...');
  await new Promise((resolve, reject) => {
    const file = createWriteStream(PDF_PATH);
    https.get(PDF_URL, (res) => {
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', reject);
  });
  console.log('Downloaded to', PDF_PATH);
}

async function discoverFields() {
  await downloadPdf();
  const bytes = readFileSync(PDF_PATH);
  const doc = await PDFDocument.load(bytes);
  const form = doc.getForm();
  const fields = form.getFields();

  console.log('\n=== WH-347 AcroForm Fields ===');
  console.log(`Total fields: ${fields.length}\n`);
  fields.forEach(f => {
    console.log(`${f.constructor.name.padEnd(20)} | ${f.getName()}`);
  });

  console.log('\n=== Paste this into wh347Generator.ts as WH347_FIELDS ===');
  const map = {};
  fields.forEach(f => {
    const key = f.getName().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    map[key] = f.getName();
  });
  console.log(JSON.stringify(map, null, 2));
}

discoverFields().catch(console.error);
