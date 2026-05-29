/**
 * OR BOLI prevailing wage seed — per-county HTML scraper (36 counties)
 * Source: https://www.oregon.gov/boli/prevailing-wage/Pages/rates.aspx
 * Run: npm run seed:or-rates
 *
 * Oregon BOLI publishes prevailing wage rates on a per-county basis via HTML pages.
 * The main rates page lists links to each county's rate schedule.
 *
 * URL patterns (to be confirmed on live site — BOLI site structure as of 2026):
 *   Index: https://www.oregon.gov/boli/prevailing-wage/Pages/rates.aspx
 *   Per-county: https://www.oregon.gov/boli/prevailing-wage/Pages/{County}-County-Rates.aspx
 *   e.g. https://www.oregon.gov/boli/prevailing-wage/Pages/Multnomah-County-Rates.aspx
 *        https://www.oregon.gov/boli/prevailing-wage/Pages/Lane-County-Rates.aspx
 *
 * Alternative: BOLI also publishes a master PDF/Excel which may be faster to parse.
 * Check: https://www.oregon.gov/boli/prevailing-wage/Pages/publications.aspx
 *
 * STUB — URL pattern confirmed; HTML table structure needs calibration against live page.
 *
 * Rate update schedule: Annual (effective January 1 each year, sometimes July 1)
 * Agency: Oregon Bureau of Labor and Industries (BOLI)
 * Official page: https://www.oregon.gov/boli/prevailing-wage
 */
import Database from 'better-sqlite3';

const DB_PATH = process.env.DATABASE_PATH || './data/prevailing-wage.db';
const NOW = new Date().toISOString();
const EFFECTIVE = '2026-01-01';
const EXPIRES = '2026-12-31';

const BOLI_BASE = 'https://www.oregon.gov/boli/prevailing-wage/Pages';
const BOLI_INDEX = `${BOLI_BASE}/rates.aspx`;

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// All 36 OR counties with BOLI URL slug
// OR BOLI uses "CountyName-County-Rates.aspx" — capitalized county name
const OR_COUNTIES: Array<{ name: string; slug: string }> = [
  // Portland metro (highest volume)
  { name: 'Multnomah', slug: 'Multnomah' },
  { name: 'Washington', slug: 'Washington' },
  { name: 'Clackamas',  slug: 'Clackamas' },
  // Other major metros
  { name: 'Lane',       slug: 'Lane' },
  { name: 'Marion',     slug: 'Marion' },
  { name: 'Jackson',    slug: 'Jackson' },
  { name: 'Deschutes',  slug: 'Deschutes' },
  { name: 'Linn',       slug: 'Linn' },
  // Remaining 28 counties
  { name: 'Benton',     slug: 'Benton' },
  { name: 'Clatsop',    slug: 'Clatsop' },
  { name: 'Columbia',   slug: 'Columbia' },
  { name: 'Coos',       slug: 'Coos' },
  { name: 'Crook',      slug: 'Crook' },
  { name: 'Curry',      slug: 'Curry' },
  { name: 'Douglas',    slug: 'Douglas' },
  { name: 'Gilliam',    slug: 'Gilliam' },
  { name: 'Grant',      slug: 'Grant' },
  { name: 'Harney',     slug: 'Harney' },
  { name: 'Hood River', slug: 'Hood-River' },
  { name: 'Jefferson',  slug: 'Jefferson' },
  { name: 'Josephine',  slug: 'Josephine' },
  { name: 'Klamath',    slug: 'Klamath' },
  { name: 'Lake',       slug: 'Lake' },
  { name: 'Lincoln',    slug: 'Lincoln' },
  { name: 'Malheur',    slug: 'Malheur' },
  { name: 'Morrow',     slug: 'Morrow' },
  { name: 'Polk',       slug: 'Polk' },
  { name: 'Sherman',    slug: 'Sherman' },
  { name: 'Tillamook',  slug: 'Tillamook' },
  { name: 'Umatilla',   slug: 'Umatilla' },
  { name: 'Union',      slug: 'Union' },
  { name: 'Wallowa',    slug: 'Wallowa' },
  { name: 'Wasco',      slug: 'Wasco' },
  { name: 'Wheeler',    slug: 'Wheeler' },
  { name: 'Yamhill',    slug: 'Yamhill' },
];

// Maps OR BOLI trade names to normalized trade codes
const TRADE_MAP: Array<{ prefix: string; code: string }> = [
  { prefix: 'CARPENTER',          code: 'CARP' },
  { prefix: 'CEMENT MASON',       code: 'MASO-CEM' },
  { prefix: 'CONCRETE FINISHER',  code: 'MASO-CEM' },
  { prefix: 'ELECTRICIAN',        code: 'ELEC' },
  { prefix: 'INSIDE WIREMAN',     code: 'ELEC' },
  { prefix: 'GLAZIER',            code: 'GLAZ' },
  { prefix: 'IRONWORKER',         code: 'IRON' },
  { prefix: 'IRON WORKER',        code: 'IRON' },
  { prefix: 'LABORER',            code: 'LABO' },
  { prefix: 'OPERATING ENGINEER', code: 'OPENG' },
  { prefix: 'PAINTER',            code: 'PAIN' },
  { prefix: 'PLUMBER',            code: 'PLUM' },
  { prefix: 'PIPEFITTER',         code: 'PLUM' },
  { prefix: 'ROOFER',             code: 'ROOF' },
  { prefix: 'SHEET METAL',        code: 'SMET' },
  { prefix: 'BOILERMAKER',        code: 'BOIL' },
  { prefix: 'MILLWRIGHT',         code: 'MILL' },
  { prefix: 'ELEVATOR',           code: 'ELEV' },
  { prefix: 'INSULATOR',          code: 'INSUL' },
  { prefix: 'HEAT AND FROST',     code: 'INSUL' },
  { prefix: 'BRICKLAYER',         code: 'MASO' },
  { prefix: 'DRYWALL',            code: 'DRYWL' },
  { prefix: 'TRUCK DRIVER',       code: 'TRUCK' },
  { prefix: 'PILE DRIVER',        code: 'PILE' },
  { prefix: 'SPRINKLER FITTER',   code: 'SPRINK' },
];

function mapTrade(raw: string): string | null {
  const upper = raw.trim().toUpperCase().replace(/[^A-Z\s]/g, '');
  for (const { prefix, code } of TRADE_MAP) {
    if (upper.startsWith(prefix)) return code;
  }
  return null;
}

function parseDollar(val: string): number {
  const n = parseFloat(val.replace(/[$,\s]/g, ''));
  return isNaN(n) ? 0 : n;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

type ParsedRate = {
  trade: string;
  tradeCode: string;
  baseRate: number;
  fringeRate: number;
};

/**
 * Parse BOLI county HTML page.
 *
 * BOLI county pages have HTML tables with trade rates.
 * Expected column structure (confirm against live Multnomah County page):
 *   Col 0: Trade classification
 *   Col 1: Straight-time basic hourly rate
 *   Col 2: H&W (fringe)
 *   Col 3: Pension (fringe)
 *   Col 4: Training (fringe)
 *   Col 5: Vacation/Holiday (fringe)
 *   Col 6: Other (fringe)
 *
 * OR BOLI also includes apprentice rates in separate rows — skip rows where
 * the trade name contains "Apprentice" or percentage indicators like "50%".
 *
 * TODO: inspect live Multnomah County page and adjust column indices.
 */
function parseCountyHtml(html: string): ParsedRate[] {
  const results: ParsedRate[] = [];

  const trMatches = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) ?? [];

  for (const tr of trMatches) {
    const tds = (tr.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) ?? []).map(td => stripTags(td));
    if (tds.length < 2) continue;

    const tradeRaw = tds[0];
    if (!tradeRaw || tradeRaw.length < 3) continue;

    // Skip apprentice rows
    if (/apprentice|appr\.|[1-9]\d*%/i.test(tradeRaw)) continue;

    const tradeCode = mapTrade(tradeRaw);
    if (!tradeCode) continue;

    const baseRate = parseDollar(tds[1] ?? '0');
    if (baseRate <= 0) continue;

    // Fringe = sum of cols 2–6
    const fringeRate = [2, 3, 4, 5, 6]
      .map(i => parseDollar(tds[i] ?? '0'))
      .reduce((a, b) => a + b, 0);

    // Keep highest rate per trade code (handles multiple sub-classifications)
    const existing = results.find(r => r.tradeCode === tradeCode);
    if (!existing || baseRate > existing.baseRate) {
      const entry: ParsedRate = { trade: tradeRaw, tradeCode, baseRate, fringeRate };
      const idx = existing ? results.indexOf(existing) : -1;
      if (idx >= 0) results[idx] = entry;
      else results.push(entry);
    }
  }

  return results;
}

const upsertRate = db.prepare(`
  INSERT INTO county_wage_determinations
    (id, state, county, city, trade_code, labor_type, base_rate, fringe_rate, effective_date, source, synced_at, expires_at)
  VALUES
    (@id, 'OR', @county, NULL, @tradeCode, 'journeyworker', @baseRate, @fringeRate, @effectiveDate, 'boli', @now, @expires)
  ON CONFLICT(id) DO UPDATE SET
    base_rate = excluded.base_rate,
    fringe_rate = excluded.fringe_rate,
    effective_date = excluded.effective_date,
    synced_at = excluded.synced_at,
    expires_at = excluded.expires_at
`);

const upsertSource = db.prepare(`
  INSERT INTO state_wage_sources (state, source_type, api_url, scrape_path, last_synced_at, sync_status)
  VALUES ('OR', 'pdf', @url, '{COUNTY}-County-Rates.aspx', @now, @status)
  ON CONFLICT(state) DO UPDATE SET
    last_synced_at = excluded.last_synced_at,
    sync_status = excluded.sync_status
`);

async function fetchCounty(slug: string): Promise<string> {
  const url = `${BOLI_BASE}/${slug}-County-Rates.aspx`;
  const res = await fetch(url, {
    headers: {
      'Accept': 'text/html',
      'User-Agent': 'Mozilla/5.0 (prevailing-wage-app/1.0)',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function run() {
  let totalInserted = 0;
  const failedCounties: string[] = [];

  for (const county of OR_COUNTIES) {
    try {
      const html = await fetchCounty(county.slug);
      const rates = parseCountyHtml(html);

      if (rates.length === 0) {
        process.stdout.write(`  ? ${county.name} — 0 rates parsed (check HTML structure or URL slug)\n`);
        failedCounties.push(county.name);
        continue;
      }

      const seedCounty = db.transaction(() => {
        for (const r of rates) {
          const id = `or-${county.name.toLowerCase().replace(/\s+/g, '-')}-${r.tradeCode.toLowerCase()}-${EFFECTIVE}`;
          upsertRate.run({
            id,
            county: county.name,
            tradeCode: r.tradeCode,
            baseRate: r.baseRate,
            fringeRate: r.fringeRate,
            effectiveDate: EFFECTIVE,
            now: NOW,
            expires: EXPIRES,
          });
          totalInserted++;
        }
      });

      seedCounty();
      process.stdout.write(`  ✓ ${county.name} (${rates.length} trades)\n`);
    } catch (err) {
      process.stdout.write(`  ✗ ${county.name}: ${err instanceof Error ? err.message : String(err)}\n`);
      failedCounties.push(county.name);
    }

    // Polite crawl — BOLI Oregon.gov
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  const status = failedCounties.length === 0 ? 'ok' : 'error';
  upsertSource.run({ url: BOLI_INDEX, now: NOW, status });

  console.log(`\n✓ OR BOLI seed complete — ${totalInserted} rows across ${OR_COUNTIES.length - failedCounties.length} counties`);
  if (failedCounties.length > 0) {
    console.log(`  Failed / zero-parse: ${failedCounties.join(', ')}`);
    console.log(`  NOTE: Verify BOLI slug patterns — county page URL may differ`);
    console.log(`  Alternative: try BOLI bulk download at ${BOLI_BASE}/publications.aspx`);
  }
  console.log(`  state_wage_sources.OR sync_status = ${status}`);
}

run().catch((err) => {
  console.error('✗ OR BOLI seed failed:', err);
  upsertSource.run({ url: BOLI_INDEX, now: NOW, status: 'error' });
  process.exit(1);
}).finally(() => db.close());
