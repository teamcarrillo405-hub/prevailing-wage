// Enumerate all SAM.gov WDs for all 50 states + DC in year 2026.
//
//   npx tsx scripts/probe-all-states.mts [year=2026] [maxPerState=300] [stopAfter404s=25]
//
// Strategy:
//   - 5 concurrent workers, each processing 10 states from a shared queue
//   - Per state: probe NNN = 1..maxPerState, stop after `stopAfter404s`
//     consecutive not-founds (indicates end of sequence for that state/year)
//   - Try revisions [0, 1, 2] per number
//   - Extract county and construction type from document text via multi-pattern parsing
//   - Write incremental progress to scripts/wd-all-states.json every 100 requests
//   - Polite: 500ms between requests PER WORKER (so total ~10 req/s across 5 workers)

import { writeFileSync, existsSync, readFileSync } from 'fs';

const YEAR = parseInt(process.argv[2] ?? '2026', 10);
const MAX_PER_STATE = parseInt(process.argv[3] ?? '300', 10);
const STOP_AFTER_404S = parseInt(process.argv[4] ?? '25', 10);
const CONCURRENCY = 5;
const REQUEST_DELAY_MS = 500; // per worker; 5 workers × 2 req/s = 10 req/s total

const STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM',
  'NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA',
  'WV','WI','WY',
];

interface Result {
  wdNumber: string;
  state: string;
  revision: number;
  county: string | null;
  constructionType: string | null;
  publishDate: string | null;
  active: boolean;
}

const RESULTS_FILE = 'scripts/wd-all-states.json';
const existing: Result[] = existsSync(RESULTS_FILE)
  ? JSON.parse(readFileSync(RESULTS_FILE, 'utf8'))
  : [];
const knownKeys = new Set(existing.map(r => `${r.wdNumber}/${r.revision}`));

function parseWdMeta(doc: string): { county: string | null; constructionType: string | null } {
  let county: string | null = null;
  let constructionType: string | null = null;

  // Construction type patterns — DOL uses these four
  const typeMatch = doc.match(/\b(Building|Residential|Highway|Heavy)\s+(?:Construction|Projects?)/i);
  if (typeMatch) constructionType = typeMatch[1];

  // County — multi-pattern (forms vary by state)
  const countyPatterns: RegExp[] = [
    /Counties?:\s*([A-Z][A-Za-z ]+?)(?:\s{2,}|Construction|State|Decision|\n)/,
    /County:\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)\s+(?:County|\n)/,
    /for\s+the\s+following\s+Counties?:\s*([A-Z][A-Za-z ,]+)/i,
  ];
  for (const re of countyPatterns) {
    const m = doc.match(re);
    if (m) {
      const cand = m[1].trim().replace(/\s+County\s*$/i, '');
      // Reject obvious false positives (noise words from surrounding text)
      if (/^(by|the|of|in|and|are|this|that)$/i.test(cand)) continue;
      if (cand.length > 60) continue;
      if (cand.length < 3) continue;
      county = cand.split(/[,;]|\s+and\s+/)[0].trim();
      break;
    }
  }
  // Check "statewide" explicitly if nothing matched
  if (!county && /\bstatewide\b/i.test(doc.slice(0, 3000))) {
    county = null; // null == statewide by convention
  }
  return { county, constructionType };
}

async function fetchWd(wdNumber: string, revision: number): Promise<Result | null> {
  const url = `https://sam.gov/api/prod/wdol/v1/wd/${wdNumber}/${revision}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json, text/plain, */*' },
    });
    if (res.status !== 200) return null;
    const body = await res.json() as any;
    const doc = (body.document ?? '') as string;
    const { county, constructionType } = parseWdMeta(doc);
    return {
      wdNumber,
      state: wdNumber.slice(0, 2),
      revision,
      county,
      constructionType,
      publishDate: body.publishDate ?? null,
      active: body.active ?? true,
    };
  } catch { return null; }
}

async function probeState(state: string): Promise<number> {
  let found = 0;
  let consecutive404s = 0;
  for (let n = 1; n <= MAX_PER_STATE; n++) {
    const wdNumber = `${state}${YEAR}${String(n).padStart(4, '0')}`;
    let hitThisN = false;
    for (const rev of [0, 1, 2]) {
      const key = `${wdNumber}/${rev}`;
      if (knownKeys.has(key)) { hitThisN = true; continue; }
      const r = await fetchWd(wdNumber, rev);
      await new Promise(res => setTimeout(res, REQUEST_DELAY_MS));
      if (r) {
        existing.push(r);
        knownKeys.add(key);
        found++;
        hitThisN = true;
        // Only try additional revisions if rev 0 worked (higher revs share the number)
        if (rev === 0) break; // keep it simple: one rev per number
      }
    }
    if (hitThisN) {
      consecutive404s = 0;
    } else {
      consecutive404s++;
      if (consecutive404s >= STOP_AFTER_404S) {
        break; // end of sequence for this state
      }
    }
  }
  return found;
}

async function worker(queue: string[]): Promise<void> {
  while (queue.length > 0) {
    const state = queue.shift();
    if (!state) break;
    const t0 = Date.now();
    const found = await probeState(state);
    const dt = ((Date.now() - t0) / 1000).toFixed(0);
    console.log(`[${state}] found ${found} WDs in ${dt}s`);
    // Persist after each state
    writeFileSync(RESULTS_FILE, JSON.stringify(existing, null, 2));
  }
}

async function main() {
  console.log(`Probing ${STATES.length} states for year ${YEAR} (max ${MAX_PER_STATE} per state, stop after ${STOP_AFTER_404S} 404s)`);
  console.log(`Already cached: ${existing.length} results`);
  const queue = [...STATES];
  const workers = Array.from({ length: CONCURRENCY }, () => worker(queue));
  await Promise.all(workers);
  writeFileSync(RESULTS_FILE, JSON.stringify(existing, null, 2));
  console.log(`\nDone. Total cached: ${existing.length} WDs`);
  const byState = existing.reduce<Record<string, number>>((acc, r) => {
    acc[r.state] = (acc[r.state] ?? 0) + 1; return acc;
  }, {});
  console.log('Per-state counts:');
  Object.entries(byState).sort((a, b) => b[1] - a[1]).forEach(([s, n]) => {
    console.log(`  ${s}: ${n}`);
  });
}

main().catch(console.error);
