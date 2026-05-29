/**
 * IL IDOL prevailing wage seed — HTML index + per-county rate tables
 * Source: https://idol.illinois.gov/wage-rates/prevailing-wage
 * Run: npm run seed:il-rates
 *
 * IL IDOL publishes monthly prevailing wage determinations per county.
 * The index page lists county links as HTML. Each county page has HTML tables
 * with trade name, classification, basic rate, and fringe breakdown.
 *
 * URL pattern for county index:
 *   https://idol.illinois.gov/wage-rates/prevailing-wage
 *
 * URL pattern per county determination:
 *   https://idol.illinois.gov/wage-rates/prevailing-wage/{COUNTY-SLUG}
 *   e.g. https://idol.illinois.gov/wage-rates/prevailing-wage/cook
 *        https://idol.illinois.gov/wage-rates/prevailing-wage/dupage
 *
 * STUB — URL pattern confirmed from IDOL site; HTML parser needs calibration
 * against live county page structure. Priority: Cook County first (Chicago metro).
 *
 * IL has 102 counties. Cook County alone drives ~60% of IL construction volume.
 * Collar counties (DuPage, Kane, Lake, McHenry, Will) are second priority.
 *
 * Rate update schedule: Monthly (first business day of each month)
 * Agency: IL Department of Employment Security / IDOL
 * Official page: https://idol.illinois.gov/wage-rates/prevailing-wage
 */
import Database from 'better-sqlite3';

const DB_PATH = process.env.DATABASE_PATH || './data/prevailing-wage.db';
const NOW = new Date().toISOString();
const EFFECTIVE = '2026-05-01'; // Update each month
const EXPIRES = '2026-06-01';

const IDOL_BASE = 'https://idol.illinois.gov';
const IDOL_INDEX = `${IDOL_BASE}/wage-rates/prevailing-wage`;

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// All 102 IL counties — slug form used in IDOL URLs
// Priority order: Cook first, then collar counties, then downstate
const IL_COUNTIES: Array<{ name: string; slug: string }> = [
  // Chicago metro (highest volume)
  { name: 'Cook',      slug: 'cook' },
  { name: 'DuPage',    slug: 'dupage' },
  { name: 'Kane',      slug: 'kane' },
  { name: 'Lake',      slug: 'lake' },
  { name: 'McHenry',   slug: 'mchenry' },
  { name: 'Will',      slug: 'will' },
  // Other high-volume downstate
  { name: 'Sangamon',  slug: 'sangamon' },
  { name: 'Peoria',    slug: 'peoria' },
  { name: 'Champaign', slug: 'champaign' },
  { name: 'Madison',   slug: 'madison' },
  { name: 'St. Clair', slug: 'st-clair' },
  // Remaining 91 counties — stub placeholders
  // TODO: populate full list after verifying IDOL slug conventions
  // IDOL slugs appear to be county name lowercased with spaces replaced by hyphens
  { name: 'Adams',      slug: 'adams' },
  { name: 'Alexander',  slug: 'alexander' },
  { name: 'Bond',       slug: 'bond' },
  { name: 'Boone',      slug: 'boone' },
  { name: 'Brown',      slug: 'brown' },
  { name: 'Bureau',     slug: 'bureau' },
  { name: 'Calhoun',    slug: 'calhoun' },
  { name: 'Carroll',    slug: 'carroll' },
  { name: 'Cass',       slug: 'cass' },
  { name: 'Christian',  slug: 'christian' },
  { name: 'Clark',      slug: 'clark' },
  { name: 'Clay',       slug: 'clay' },
  { name: 'Clinton',    slug: 'clinton' },
  { name: 'Coles',      slug: 'coles' },
  { name: 'Crawford',   slug: 'crawford' },
  { name: 'Cumberland', slug: 'cumberland' },
  { name: 'DeKalb',     slug: 'dekalb' },
  { name: 'DeWitt',     slug: 'dewitt' },
  { name: 'Douglas',    slug: 'douglas' },
  { name: 'Edgar',      slug: 'edgar' },
  { name: 'Edwards',    slug: 'edwards' },
  { name: 'Effingham',  slug: 'effingham' },
  { name: 'Fayette',    slug: 'fayette' },
  { name: 'Ford',       slug: 'ford' },
  { name: 'Franklin',   slug: 'franklin' },
  { name: 'Fulton',     slug: 'fulton' },
  { name: 'Gallatin',   slug: 'gallatin' },
  { name: 'Greene',     slug: 'greene' },
  { name: 'Grundy',     slug: 'grundy' },
  { name: 'Hamilton',   slug: 'hamilton' },
  { name: 'Hancock',    slug: 'hancock' },
  { name: 'Hardin',     slug: 'hardin' },
  { name: 'Henderson',  slug: 'henderson' },
  { name: 'Henry',      slug: 'henry' },
  { name: 'Iroquois',   slug: 'iroquois' },
  { name: 'Jackson',    slug: 'jackson' },
  { name: 'Jasper',     slug: 'jasper' },
  { name: 'Jefferson',  slug: 'jefferson' },
  { name: 'Jersey',     slug: 'jersey' },
  { name: 'Jo Daviess', slug: 'jo-daviess' },
  { name: 'Johnson',    slug: 'johnson' },
  { name: 'Kankakee',   slug: 'kankakee' },
  { name: 'Kendall',    slug: 'kendall' },
  { name: 'Knox',       slug: 'knox' },
  { name: 'LaSalle',    slug: 'lasalle' },
  { name: 'Lawrence',   slug: 'lawrence' },
  { name: 'Lee',        slug: 'lee' },
  { name: 'Livingston', slug: 'livingston' },
  { name: 'Logan',      slug: 'logan' },
  { name: 'Macon',      slug: 'macon' },
  { name: 'Macoupin',   slug: 'macoupin' },
  { name: 'Marion',     slug: 'marion' },
  { name: 'Marshall',   slug: 'marshall' },
  { name: 'Mason',      slug: 'mason' },
  { name: 'Massac',     slug: 'massac' },
  { name: 'McDonough',  slug: 'mcdonough' },
  { name: 'McLean',     slug: 'mclean' },
  { name: 'Menard',     slug: 'menard' },
  { name: 'Mercer',     slug: 'mercer' },
  { name: 'Monroe',     slug: 'monroe' },
  { name: 'Montgomery', slug: 'montgomery' },
  { name: 'Morgan',     slug: 'morgan' },
  { name: 'Moultrie',   slug: 'moultrie' },
  { name: 'Ogle',       slug: 'ogle' },
  { name: 'Piatt',      slug: 'piatt' },
  { name: 'Pike',       slug: 'pike' },
  { name: 'Pope',       slug: 'pope' },
  { name: 'Pulaski',    slug: 'pulaski' },
  { name: 'Putnam',     slug: 'putnam' },
  { name: 'Randolph',   slug: 'randolph' },
  { name: 'Richland',   slug: 'richland' },
  { name: 'Rock Island',slug: 'rock-island' },
  { name: 'Saline',     slug: 'saline' },
  { name: 'Schuyler',   slug: 'schuyler' },
  { name: 'Scott',      slug: 'scott' },
  { name: 'Shelby',     slug: 'shelby' },
  { name: 'Stark',      slug: 'stark' },
  { name: 'Stephenson', slug: 'stephenson' },
  { name: 'Tazewell',   slug: 'tazewell' },
  { name: 'Union',      slug: 'union' },
  { name: 'Vermilion',  slug: 'vermilion' },
  { name: 'Wabash',     slug: 'wabash' },
  { name: 'Warren',     slug: 'warren' },
  { name: 'Washington', slug: 'washington' },
  { name: 'Wayne',      slug: 'wayne' },
  { name: 'White',      slug: 'white' },
  { name: 'Whiteside',  slug: 'whiteside' },
  { name: 'Williamson', slug: 'williamson' },
  { name: 'Winnebago',  slug: 'winnebago' },
  { name: 'Woodford',   slug: 'woodford' },
];

// Maps IL IDOL trade names to normalized trade codes
// TODO: expand after inspecting live county HTML — IL uses full union names
const TRADE_MAP: Array<{ prefix: string; code: string }> = [
  { prefix: 'CARPENTER',        code: 'CARP' },
  { prefix: 'CEMENT MASON',     code: 'MASO-CEM' },
  { prefix: 'ELECTRICIAN',      code: 'ELEC' },
  { prefix: 'INSIDE WIREMAN',   code: 'ELEC' },
  { prefix: 'GLAZIER',          code: 'GLAZ' },
  { prefix: 'IRONWORKER',       code: 'IRON' },
  { prefix: 'IRON WORKER',      code: 'IRON' },
  { prefix: 'LABORER',          code: 'LABO' },
  { prefix: 'OPERATING ENGINEER', code: 'OPENG' },
  { prefix: 'PAINTER',          code: 'PAIN' },
  { prefix: 'PLUMBER',          code: 'PLUM' },
  { prefix: 'PIPEFITTER',       code: 'PLUM' },
  { prefix: 'ROOFER',           code: 'ROOF' },
  { prefix: 'SHEET METAL',      code: 'SMET' },
  { prefix: 'BOILERMAKER',      code: 'BOIL' },
  { prefix: 'MILLWRIGHT',       code: 'MILL' },
  { prefix: 'ELEVATOR',         code: 'ELEV' },
  { prefix: 'INSULATOR',        code: 'INSUL' },
  { prefix: 'BRICKLAYER',       code: 'MASO' },
  { prefix: 'TERRAZZO',         code: 'TERR' },
  { prefix: 'TILE',             code: 'TILE' },
  { prefix: 'DRYWALL',          code: 'DRYWL' },
  { prefix: 'TRUCK DRIVER',     code: 'TRUCK' },
  { prefix: 'PILE DRIVER',      code: 'PILE' },
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
 * Parse IDOL county HTML page.
 *
 * IDOL county pages contain tables with structure (to be confirmed on live site):
 *   Column 0: Trade / Classification
 *   Column 1: Straight-Time Basic Rate (per hour)
 *   Column 2: H&W (health & welfare)
 *   Column 3: Pension
 *   Column 4: Vacation
 *   Column 5: Training
 *   Column 6: Other
 *
 * TODO: inspect live Cook County page and adjust column indices.
 * The parser below uses a best-guess layout based on other state DOL pages.
 */
function parseCountyHtml(html: string, countyName: string): ParsedRate[] {
  const results: ParsedRate[] = [];

  // Find all table rows
  const trMatches = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) ?? [];

  for (const tr of trMatches) {
    const tds = (tr.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) ?? []).map(td => stripTags(td));
    if (tds.length < 2) continue;

    const tradeRaw = tds[0];
    if (!tradeRaw || tradeRaw.length < 3) continue;

    const tradeCode = mapTrade(tradeRaw);
    if (!tradeCode) continue;

    const baseRate = parseDollar(tds[1] ?? '0');
    if (baseRate <= 0) continue;

    // Fringe = H&W + Pension + Vacation + Training + Other (cols 2–6)
    const fringeRate = [2, 3, 4, 5, 6]
      .map(i => parseDollar(tds[i] ?? '0'))
      .reduce((a, b) => a + b, 0);

    // Keep highest rate per trade code (journey level)
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
    (@id, 'IL', @county, NULL, @tradeCode, 'journeyworker', @baseRate, @fringeRate, @effectiveDate, 'idol', @now, @expires)
  ON CONFLICT(id) DO UPDATE SET
    base_rate = excluded.base_rate,
    fringe_rate = excluded.fringe_rate,
    effective_date = excluded.effective_date,
    synced_at = excluded.synced_at,
    expires_at = excluded.expires_at
`);

const upsertSource = db.prepare(`
  INSERT INTO state_wage_sources (state, source_type, api_url, scrape_path, last_synced_at, sync_status)
  VALUES ('IL', 'pdf', @url, '{COUNTY}', @now, @status)
  ON CONFLICT(state) DO UPDATE SET
    last_synced_at = excluded.last_synced_at,
    sync_status = excluded.sync_status
`);

async function fetchCounty(slug: string): Promise<string> {
  const url = `${IDOL_INDEX}/${slug}`;
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

  for (const county of IL_COUNTIES) {
    try {
      const html = await fetchCounty(county.slug);
      const rates = parseCountyHtml(html, county.name);

      if (rates.length === 0) {
        process.stdout.write(`  ? ${county.name} — 0 rates parsed (check HTML structure)\n`);
        continue;
      }

      const seedCounty = db.transaction(() => {
        for (const r of rates) {
          const id = `il-${county.name.toLowerCase().replace(/[\s.]+/g, '-')}-${r.tradeCode.toLowerCase()}-${EFFECTIVE}`;
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

    // Polite crawl — IDOL site; avoid hammering
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  const status = failedCounties.length === 0 ? 'ok' : 'error';
  upsertSource.run({ url: IDOL_INDEX, now: NOW, status });

  console.log(`\n✓ IL IDOL seed complete — ${totalInserted} rows across ${IL_COUNTIES.length - failedCounties.length} counties`);
  if (failedCounties.length > 0) {
    console.log(`  Failed: ${failedCounties.join(', ')}`);
    console.log(`  NOTE: Check IDOL URL slugs — may require adjustment for some counties`);
  }
  console.log(`  state_wage_sources.IL sync_status = ${status}`);
}

run().catch((err) => {
  console.error('✗ IL IDOL seed failed:', err);
  upsertSource.run({ url: IDOL_INDEX, now: NOW, status: 'error' });
  process.exit(1);
}).finally(() => db.close());
