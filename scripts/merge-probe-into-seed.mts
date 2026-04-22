// Merge scripts/wd-all-states.json probe results into WD_SEED_LIST in
// src/server/services/wdolSync.ts.
//
//   npx tsx scripts/merge-probe-into-seed.mts
//
// Strategy:
//   - Preserve existing WD_SEED_LIST entries verbatim (they've been verified)
//   - Add any probe results not already in the list
//   - Sort by state, then county (null/statewide first), then wdNumber
//   - Write back as a generated code block wrapped in markers

import { readFileSync, writeFileSync } from 'fs';

interface ProbeResult {
  wdNumber: string;
  state: string;
  revision: number;
  county: string | null;
  constructionType: string | null;
  publishDate: string | null;
  active: boolean;
}

interface SeedEntry {
  wdNumber: string;
  state: string;
  county: string | null;
  revision: number;
}

const SYNC_FILE = 'src/server/services/wdolSync.ts';
const PROBE_FILE = 'scripts/wd-all-states.json';

const probe: ProbeResult[] = JSON.parse(readFileSync(PROBE_FILE, 'utf8'));
const syncSrc = readFileSync(SYNC_FILE, 'utf8');

// Extract existing seed entries by parsing the WD_SEED_LIST array
const listStart = syncSrc.indexOf('export const WD_SEED_LIST');
const arrStart = syncSrc.indexOf('[', listStart);
const arrEnd = syncSrc.indexOf('\n];', arrStart);
const arrContent = syncSrc.slice(arrStart + 1, arrEnd);

const existingEntries: SeedEntry[] = [];
const entryRe = /\{\s*wdNumber:\s*'([^']+)',\s*state:\s*'([^']+)',\s*county:\s*(?:'([^']+)'|null),\s*revision:\s*(\d+)\s*\}/g;
let m: RegExpExecArray | null;
while ((m = entryRe.exec(arrContent)) !== null) {
  existingEntries.push({
    wdNumber: m[1],
    state: m[2],
    county: m[3] ?? null,
    revision: parseInt(m[4], 10),
  });
}
console.log(`Existing seed: ${existingEntries.length} entries`);

// Build merged set: existing entries PLUS any probe results not already present.
const existingKeys = new Set(existingEntries.map(e => `${e.wdNumber}/${e.revision}`));
const toAdd: SeedEntry[] = probe
  .filter(p => !existingKeys.has(`${p.wdNumber}/${p.revision}`))
  // Reject low-quality county parses (common noise words)
  .filter(p => {
    if (!p.county) return true;
    const noise = /^(by|the|of|in|are|this|that|as|if|for|and|or|its|it|be|an|a)$/i;
    if (noise.test(p.county)) { p.county = null; return true; }
    return true;
  })
  .map(p => ({
    wdNumber: p.wdNumber,
    state: p.state,
    county: p.county,
    revision: p.revision,
  }));

console.log(`Probe candidates: ${probe.length}  |  new to add: ${toAdd.length}`);

const merged = [...existingEntries, ...toAdd];

// Sort: state, then county (null first), then wdNumber
merged.sort((a, b) => {
  if (a.state !== b.state) return a.state.localeCompare(b.state);
  if (a.county === null && b.county !== null) return -1;
  if (a.county !== null && b.county === null) return 1;
  if (a.county !== b.county) return (a.county ?? '').localeCompare(b.county ?? '');
  return a.wdNumber.localeCompare(b.wdNumber);
});

// Re-emit WD_SEED_LIST body
const formattedBody = merged
  .map(e => {
    const county = e.county === null ? 'null' : `'${e.county}'`;
    return `  { wdNumber: '${e.wdNumber}', state: '${e.state}', county: ${county}, revision: ${e.revision} },`;
  })
  .join('\n');

// Splice into the original file
const newSrc =
  syncSrc.slice(0, arrStart + 1) +
  '\n' +
  formattedBody +
  '\n' +
  syncSrc.slice(arrEnd);

writeFileSync(SYNC_FILE, newSrc);
console.log(`Wrote ${merged.length} entries to WD_SEED_LIST`);

// Report per-state coverage
const byState: Record<string, { total: number; counties: Set<string | null> }> = {};
for (const e of merged) {
  if (!byState[e.state]) byState[e.state] = { total: 0, counties: new Set() };
  byState[e.state].total++;
  byState[e.state].counties.add(e.county);
}
console.log('\nPer-state coverage:');
for (const s of Object.keys(byState).sort()) {
  const b = byState[s];
  const ctys = [...b.counties].filter(c => c !== null).length;
  console.log(`  ${s}: ${b.total} WDs, ${ctys} distinct counties${b.counties.has(null) ? ' + statewide' : ''}`);
}
