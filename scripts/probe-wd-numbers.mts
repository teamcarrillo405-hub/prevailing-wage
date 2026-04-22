// Probe SAM.gov WDOL API to discover which WD numbers exist for each state.
// Writes results to scripts/wd-probe-results.json for wdolSync.ts seed expansion.
//
//   npx tsx scripts/probe-wd-numbers.mts [state=CA] [max=50]
//
// Rate-limited to 1 req/sec to be polite. Takes ~50s for 50 numbers per state.

import { writeFileSync, existsSync, readFileSync } from 'fs';

interface ProbeResult {
  state: string;
  wdNumber: string;
  revision: number;
  status: 'valid' | 'not-found' | 'error';
  fullReferenceNumber?: string;
  county?: string | null;
  publishDate?: string;
}

const STATE = process.argv[2]?.toUpperCase() ?? 'CA';
const MAX  = parseInt(process.argv[3] ?? '50', 10);
const YEAR = 2025;
const RESULTS_FILE = 'scripts/wd-probe-results.json';

async function probeOne(state: string, n: number): Promise<ProbeResult> {
  const wdNumber = `${state}${YEAR}${String(n).padStart(4, '0')}`;
  // Try revisions 0, 1, 2
  for (const rev of [0, 1, 2]) {
    const url = `https://sam.gov/api/prod/wdol/v1/wd/${wdNumber}/${rev}`;
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json, text/plain, */*' },
      });
      if (res.status === 200) {
        const body = await res.json() as any;
        // Parse county out of fullReferenceNumber or from the document
        let county: string | null = null;
        const docSnippet = (body.document ?? '').slice(0, 500);
        const countyMatch = docSnippet.match(/State:\s*\S+\s+Construction Type[^\n]*\n[^\n]*\n[^\n]*Counties?:\s*([A-Z][a-z]+(?: [A-Z][a-z]+)?)/);
        if (countyMatch) county = countyMatch[1];
        return {
          state, wdNumber, revision: rev, status: 'valid',
          fullReferenceNumber: body.fullReferenceNumber,
          county,
          publishDate: body.publishDate,
        };
      }
    } catch (_e) { /* try next */ }
  }
  return { state, wdNumber, revision: 0, status: 'not-found' };
}

async function main() {
  const existing: ProbeResult[] = existsSync(RESULTS_FILE)
    ? JSON.parse(readFileSync(RESULTS_FILE, 'utf8'))
    : [];
  const knownSet = new Set(existing.map(r => `${r.wdNumber}/${r.revision}`));

  console.log(`Probing ${STATE}${YEAR}0001..${String(MAX).padStart(4, '0')}`);
  let found = 0;
  for (let n = 1; n <= MAX; n++) {
    const r = await probeOne(STATE, n);
    if (r.status === 'valid') {
      if (!knownSet.has(`${r.wdNumber}/${r.revision}`)) {
        existing.push(r);
        found++;
        console.log(`  ✓ ${r.wdNumber} rev ${r.revision} — ${r.county ?? 'statewide'}  (${r.fullReferenceNumber})`);
      }
    }
    // Flush results every 10 attempts
    if (n % 10 === 0) {
      writeFileSync(RESULTS_FILE, JSON.stringify(existing, null, 2));
    }
    // Rate limit: 1 req/sec
    await new Promise(r => setTimeout(r, 1000));
  }
  writeFileSync(RESULTS_FILE, JSON.stringify(existing, null, 2));
  console.log(`\nFound ${found} new valid WDs. Total catalog: ${existing.length}`);
}

main().catch(console.error);
