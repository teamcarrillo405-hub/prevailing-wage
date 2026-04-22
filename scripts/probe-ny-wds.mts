// Probe specific NY WDs provided by user. Try multiple county-extraction
// patterns since NY WD docs format counties differently than CA.
//
//   npx tsx scripts/probe-ny-wds.mts

import { writeFileSync } from 'fs';

const WDS = [
  'NY20260001', 'NY20260002', 'NY20260003', 'NY20260004', 'NY20260005',
  'NY20260007', 'NY20260008', 'NY20260009', 'NY20260010', 'NY20260011',
  'NY20260012', 'NY20260013', 'NY20260014', 'NY20260015', 'NY20260016',
  'NY20260017', 'NY20260020', 'NY20260022', 'NY20260023', 'NY20260024',
  'NY20260025', 'NY20260026', 'NY20260027', 'NY20260029', 'NY20260030',
  'NY20260031', 'NY20260034', 'NY20260036', 'NY20260037', 'NY20260038',
  'NY20260039', 'NY20260040', 'NY20260042', 'NY20260045', 'NY20260046',
  'NY20260047', 'NY20260049', 'NY20260051', 'NY20260073', 'NY20260113',
];

function parseCounty(doc: string, wdNumber: string): { county: string | null; notes: string } {
  // Try many patterns NY WDs use to identify covered counties
  const patterns: RegExp[] = [
    /Counties?:\s*([A-Z][^\n]+?)(?:Construction|County|State|Decision)/i,
    /County:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
    /Counties covered:\s*([A-Z][^\n]+)/i,
    /Area[s]?\s+Covered[:\s]+([A-Z][^\n]+)/i,
    /General Decision Number:.+?\s+(?:Counties?|County):\s*([A-Z][^\n]+?)\n/is,
    /for\s+the\s+following\s+Counties?:\s*([A-Z][^\n]+)/i,
  ];
  for (const re of patterns) {
    const m = doc.match(re);
    if (m) {
      const raw = m[1].trim();
      // Take just the first county if it's a list
      const first = raw.split(/[,;]|\s+and\s+/)[0].trim();
      if (first && first.length < 50) return { county: first, notes: `matched:${re.source.slice(0, 40)}` };
    }
  }
  // Check if doc explicitly mentions "statewide" or "entire state"
  if (/statewide/i.test(doc.slice(0, 2000)) || /entire state of new york/i.test(doc.slice(0, 2000))) {
    return { county: null, notes: 'explicit-statewide' };
  }
  return { county: null, notes: 'no-county-pattern-matched' };
}

async function fetchOne(wdNumber: string) {
  for (const rev of [0, 1, 2]) {
    const url = `https://sam.gov/api/prod/wdol/v1/wd/${wdNumber}/${rev}`;
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json, text/plain, */*' } });
      if (res.status === 200) {
        const body = await res.json() as any;
        const doc = (body.document ?? '') as string;
        const { county, notes } = parseCounty(doc, wdNumber);
        return { wdNumber, revision: rev, county, notes, snippet: doc.slice(0, 300).replace(/\n/g, ' | ') };
      }
    } catch (_e) { /* try next */ }
  }
  return { wdNumber, revision: -1, county: null, notes: 'not-found', snippet: '' };
}

async function main() {
  const out: Array<{ wdNumber: string; revision: number; county: string | null; notes: string; snippet: string }> = [];
  for (const wd of WDS) {
    const r = await fetchOne(wd);
    out.push(r);
    console.log(`  ${wd}  rev=${r.revision}  county=${r.county ?? '(none)'}   notes=${r.notes}`);
    await new Promise(r => setTimeout(r, 800));
  }
  writeFileSync('scripts/ny-probe-full.json', JSON.stringify(out, null, 2));
  console.log(`\nWrote scripts/ny-probe-full.json`);
  const withCounty = out.filter(r => r.county);
  console.log(`${withCounty.length} of ${out.length} WDs have parsed county`);
}

main().catch(console.error);
