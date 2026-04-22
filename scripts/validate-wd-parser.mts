// Validate wdolParser.ts against a sample of real WDs spanning all states.
// Reports success rate, failure patterns, and flags parser bugs.
//
//   npx tsx scripts/validate-wd-parser.mts [sampleSize=30]

import { readFileSync, writeFileSync } from 'fs';
import { parseWdDocument } from '../src/server/services/wdolParser.js';

interface ProbeResult {
  wdNumber: string;
  state: string;
  revision: number;
  county: string | null;
  constructionType: string | null;
}

const SAMPLE_SIZE = parseInt(process.argv[2] ?? '30', 10);
const probe: ProbeResult[] = JSON.parse(readFileSync('scripts/wd-all-states.json', 'utf8'));

// Pick one WD from each state (spread sample across all states)
const byState: Record<string, ProbeResult[]> = {};
for (const r of probe) {
  if (!byState[r.state]) byState[r.state] = [];
  byState[r.state].push(r);
}
const states = Object.keys(byState).sort();
const sample: ProbeResult[] = [];
// One per state until we hit SAMPLE_SIZE
for (let i = 0; i < 10 && sample.length < SAMPLE_SIZE; i++) {
  for (const s of states) {
    if (byState[s][i]) sample.push(byState[s][i]);
    if (sample.length >= SAMPLE_SIZE) break;
  }
}

console.log(`Validating parser against ${sample.length} WDs across ${states.length} states...\n`);

interface ValidationResult {
  wdNumber: string;
  state: string;
  constructionType: string | null;
  classificationCount: number;
  docSize: number;
  docPreview: string;
}

const results: ValidationResult[] = [];
const failures: ValidationResult[] = [];

for (const wd of sample) {
  const url = `https://sam.gov/api/prod/wdol/v1/wd/${wd.wdNumber}/${wd.revision}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json, text/plain, */*' },
    });
    if (res.status !== 200) continue;
    const body = await res.json() as any;
    const doc = body.document ?? '';
    const classifications = parseWdDocument(doc);
    const result: ValidationResult = {
      wdNumber: wd.wdNumber,
      state: wd.state,
      constructionType: wd.constructionType,
      classificationCount: classifications.length,
      docSize: doc.length,
      docPreview: doc.slice(0, 500).replace(/\n/g, ' | ').slice(0, 200),
    };
    results.push(result);
    if (classifications.length === 0) failures.push(result);
    console.log(`  ${wd.wdNumber} [${wd.state} ${wd.constructionType ?? '?'}]  classes=${classifications.length}  doc=${doc.length}b`);
    await new Promise(r => setTimeout(r, 400)); // rate limit
  } catch (e) {
    console.log(`  ${wd.wdNumber}: ERROR ${(e as Error).message}`);
  }
}

const successRate = ((results.length - failures.length) / results.length * 100).toFixed(1);
console.log(`\n=== Summary ===`);
console.log(`Total sampled: ${results.length}`);
console.log(`Parsed classifications: ${results.length - failures.length} (${successRate}%)`);
console.log(`Empty results (parser failed): ${failures.length}`);

if (failures.length > 0) {
  console.log(`\n=== Failures by state / construction type ===`);
  const failsByState: Record<string, number> = {};
  for (const f of failures) {
    const key = `${f.state}/${f.constructionType ?? '?'}`;
    failsByState[key] = (failsByState[key] ?? 0) + 1;
  }
  for (const [k, n] of Object.entries(failsByState).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${n} failures`);
  }
  console.log(`\n=== Sample failure docs (first 200 chars each) ===`);
  for (const f of failures.slice(0, 3)) {
    console.log(`\n--- ${f.wdNumber} ---`);
    console.log(f.docPreview);
  }
}

// Histogram of class counts
const classCounts: Record<number, number> = {};
for (const r of results) {
  const bucket = r.classificationCount === 0 ? 0
    : r.classificationCount < 10 ? 1
    : r.classificationCount < 30 ? 2
    : r.classificationCount < 100 ? 3 : 4;
  classCounts[bucket] = (classCounts[bucket] ?? 0) + 1;
}
console.log(`\n=== Classification-count distribution ===`);
console.log(`  0 classes:     ${classCounts[0] ?? 0}`);
console.log(`  1-9 classes:   ${classCounts[1] ?? 0}`);
console.log(`  10-29 classes: ${classCounts[2] ?? 0}`);
console.log(`  30-99 classes: ${classCounts[3] ?? 0}`);
console.log(`  100+ classes:  ${classCounts[4] ?? 0}`);

writeFileSync('scripts/parser-validation-results.json', JSON.stringify({
  sampleSize: results.length,
  successRate,
  failures: failures.length,
  results,
}, null, 2));
console.log(`\nWrote scripts/parser-validation-results.json`);
