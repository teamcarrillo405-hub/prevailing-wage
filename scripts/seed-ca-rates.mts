/**
 * CA DIR prevailing wage seed — HTML scraper for all 58 counties
 * Source: https://www.dir.ca.gov/OPRL/2026-1/PWD/Determinations/Subtrades/{COUNTY}.html
 * Run: npm run seed:ca-rates
 *
 * Parses CA DIR HTML tables. The table structure per row:
 *   <th>  CRAFT name
 *   td[0] Classification
 *   td[2] Issue Date
 *   td[3] Expiration Date
 *   td[4] Basic Hourly Rate
 *   td[6] Health & Welfare
 *   td[8] Pension
 *   td[10] Vacation/Holiday
 *   td[12] Training
 *   td[14] Other Payments
 * Fringe = H&W + Pension + Vacation + Training + Other
 * Footnote <td> cells appear after each data cell — odd indices 5,7,9,11,13,15 are footnotes.
 */
import Database from 'better-sqlite3';

const DB_PATH = process.env.DATABASE_PATH || './data/prevailing-wage.db';
const NOW = new Date().toISOString();
const EFFECTIVE = '2026-01-01';
const BASE_URL = 'https://www.dir.ca.gov/OPRL/2026-1/PWD/Determinations/Subtrades';

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// All 58 CA county codes used by CA DIR
const CA_COUNTIES: Array<{ code: string; name: string }> = [
  { code: 'ALA', name: 'Alameda' },
  { code: 'ALP', name: 'Alpine' },
  { code: 'AMA', name: 'Amador' },
  { code: 'BUT', name: 'Butte' },
  { code: 'CAL', name: 'Calaveras' },
  { code: 'COL', name: 'Colusa' },
  { code: 'CONTRA', name: 'Contra Costa' },
  { code: 'DEL', name: 'Del Norte' },
  { code: 'ELD', name: 'El Dorado' },
  { code: 'FRE', name: 'Fresno' },
  { code: 'GLE', name: 'Glenn' },
  { code: 'HUM', name: 'Humboldt' },
  { code: 'IMP', name: 'Imperial' },
  { code: 'INY', name: 'Inyo' },
  { code: 'KER', name: 'Kern' },
  { code: 'KIN', name: 'Kings' },
  { code: 'LAK', name: 'Lake' },
  { code: 'LAS', name: 'Lassen' },
  { code: 'LOS', name: 'Los Angeles' },
  { code: 'MAD', name: 'Madera' },
  { code: 'MAR', name: 'Marin' },
  { code: 'MAP', name: 'Mariposa' },
  { code: 'MEN', name: 'Mendocino' },
  { code: 'MER', name: 'Merced' },
  { code: 'MOD', name: 'Modoc' },
  { code: 'MON', name: 'Mono' },
  { code: 'MTY', name: 'Monterey' },
  { code: 'NAP', name: 'Napa' },
  { code: 'NEV', name: 'Nevada' },
  { code: 'ORA', name: 'Orange' },
  { code: 'PLA', name: 'Placer' },
  { code: 'PLU', name: 'Plumas' },
  { code: 'RIV', name: 'Riverside' },
  { code: 'SAC', name: 'Sacramento' },
  { code: 'SBE', name: 'San Bernardino' },
  { code: 'SBR', name: 'Santa Barbara' },
  { code: 'SDI', name: 'San Diego' },
  { code: 'SFR', name: 'San Francisco' },
  { code: 'SJO', name: 'San Joaquin' },
  { code: 'SLO', name: 'San Luis Obispo' },
  { code: 'SMA', name: 'San Mateo' },
  { code: 'STC', name: 'Santa Clara' },
  { code: 'STZ', name: 'Santa Cruz' },
  { code: 'SHA', name: 'Shasta' },
  { code: 'SIE', name: 'Sierra' },
  { code: 'SIS', name: 'Siskiyou' },
  { code: 'SOL', name: 'Solano' },
  { code: 'SON', name: 'Sonoma' },
  { code: 'STA', name: 'Stanislaus' },
  { code: 'SUT', name: 'Sutter' },
  { code: 'TEH', name: 'Tehama' },
  { code: 'TRI', name: 'Trinity' },
  { code: 'TUL', name: 'Tulare' },
  { code: 'TUO', name: 'Tuolumne' },
  { code: 'VEN', name: 'Ventura' },
  { code: 'YOL', name: 'Yolo' },
  { code: 'YUB', name: 'Yuba' },
];

// Maps CA DIR craft names to normalized trade codes (prefix matching, case-insensitive)
const CRAFT_MAP: Array<{ prefix: string; code: string }> = [
  { prefix: 'BRICKLAYER', code: 'MASO' },
  { prefix: 'CARPENTER', code: 'CARP' },
  { prefix: 'CEMENT MASON', code: 'MASO-CEM' },
  { prefix: 'ELECTRICIAN', code: 'ELEC' },
  { prefix: 'GLAZIER', code: 'GLAZ' },
  { prefix: 'INSULATION', code: 'INSUL' },
  { prefix: 'IRONWORKER', code: 'IRON' },
  { prefix: 'LABORER', code: 'LABO' },
  { prefix: 'OPERATING ENGINEER', code: 'OPENG' },
  { prefix: 'PAINTER', code: 'PAIN' },
  { prefix: 'PLASTERER', code: 'PLAST' },
  { prefix: 'PLUMBER', code: 'PLUM' },
  { prefix: 'ROOFER', code: 'ROOF' },
  { prefix: 'SHEET METAL', code: 'SMET' },
  { prefix: 'TERRAZZO', code: 'TERR' },
  { prefix: 'TILE', code: 'TILE' },
  { prefix: 'PILE DRIVER', code: 'PILE' },
  { prefix: 'LATHER', code: 'LATH' },
  { prefix: 'DRYWALL', code: 'DRYWL' },
  { prefix: 'ELEVATOR', code: 'ELEV' },
  { prefix: 'BOILERMAKER', code: 'BOIL' },
  { prefix: 'MILLWRIGHT', code: 'MILL' },
];

function mapCraft(craftRaw: string): string | null {
  const upper = craftRaw.replace(/[^A-Z\s]/g, '').trim().toUpperCase();
  for (const { prefix, code } of CRAFT_MAP) {
    if (upper.startsWith(prefix)) return code;
  }
  return null;
}

function parseDollar(val: string): number {
  const n = parseFloat(val.replace(/[$,\s]/g, ''));
  return isNaN(n) ? 0 : n;
}

// Extract text content from an HTML element, stripping tags
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

type ParsedRate = {
  craft: string;
  tradeCode: string;
  baseRate: number;
  fringeRate: number;
  effectiveDate: string;
  expiresAt: string | null;
};

function parseCountyHtml(html: string): ParsedRate[] {
  const results: ParsedRate[] = [];

  // Extract all <tr> elements from <tbody>
  const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) return results;

  const tbody = tbodyMatch[1];
  const trMatches = tbody.match(/<tr>([\s\S]*?)<\/tr>/gi) ?? [];

  for (const tr of trMatches) {
    // Craft is in <th scope="row">
    const thMatch = tr.match(/<th[^>]*>([\s\S]*?)<\/th>/i);
    if (!thMatch) continue;
    const craftRaw = stripTags(thMatch[1]).replace(/:$/, '').trim();

    const tradeCode = mapCraft(craftRaw);
    if (!tradeCode) continue;

    // Collect all <td> elements
    const tdMatches = tr.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) ?? [];
    if (tdMatches.length < 15) continue;

    const tds = tdMatches.map(td => stripTags(td));

    // Column layout (0-indexed after th):
    // 0=Classification, 1=CraftFootnote, 2=IssueDate, 3=ExpirationDate, 4=BasicRate, 5=BasicRateNote
    // 6=HealthWelfare, 7=H&WNote, 8=Pension, 9=PensionNote, 10=Vacation, 11=VacNote
    // 12=Training, 13=TrainNote, 14=OtherPayments, 15=OtherNote
    const baseRate = parseDollar(tds[4] ?? '');
    const healthWelfare = parseDollar(tds[6] ?? '');
    const pension = parseDollar(tds[8] ?? '');
    const vacation = parseDollar(tds[10] ?? '');
    const training = parseDollar(tds[12] ?? '');
    const other = parseDollar(tds[14] ?? '');
    const fringeRate = healthWelfare + pension + vacation + training + other;

    if (baseRate <= 0) continue;

    // IssueDate = tds[2], ExpirationDate = tds[3]
    const issueDateStr = tds[2] ?? '';
    const expDateStr = tds[3] ?? '';
    const effectiveDate = parseDate(issueDateStr) ?? EFFECTIVE;
    const expiresAt = parseDate(expDateStr);

    // Keep only the first row per trade code per county (journey-level, highest rate)
    const existing = results.find(r => r.tradeCode === tradeCode);
    if (!existing || baseRate > existing.baseRate) {
      const idx = existing ? results.indexOf(existing) : -1;
      const entry: ParsedRate = { craft: craftRaw, tradeCode, baseRate, fringeRate, effectiveDate, expiresAt };
      if (idx >= 0) results[idx] = entry;
      else results.push(entry);
    }
  }

  return results;
}

function parseDate(str: string): string | null {
  const m = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

const upsertRate = db.prepare(`
  INSERT INTO county_wage_determinations
    (id, state, county, city, trade_code, labor_type, base_rate, fringe_rate, effective_date, source, synced_at, expires_at)
  VALUES
    (@id, 'CA', @county, NULL, @tradeCode, 'journeyworker', @baseRate, @fringeRate, @effectiveDate, 'dir', @now, @expiresAt)
  ON CONFLICT(id) DO UPDATE SET
    base_rate = excluded.base_rate,
    fringe_rate = excluded.fringe_rate,
    effective_date = excluded.effective_date,
    synced_at = excluded.synced_at,
    expires_at = excluded.expires_at
`);

const upsertSource = db.prepare(`
  INSERT INTO state_wage_sources (state, source_type, api_url, scrape_path, last_synced_at, sync_status)
  VALUES ('CA', 'pdf', 'https://www.dir.ca.gov/OPRL/2026-1/PWD/Determinations/Subtrades/', '{COUNTY}.html', @now, @status)
  ON CONFLICT(state) DO UPDATE SET
    last_synced_at = excluded.last_synced_at,
    sync_status = excluded.sync_status
`);

async function fetchCounty(code: string): Promise<string> {
  const url = `${BASE_URL}/${code}.html`;
  const res = await fetch(url, { headers: { 'Accept': 'text/html' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function run() {
  let totalInserted = 0;
  let failedCounties: string[] = [];

  for (const county of CA_COUNTIES) {
    try {
      const html = await fetchCounty(county.code);
      const rates = parseCountyHtml(html);

      const seedCounty = db.transaction(() => {
        for (const r of rates) {
          const id = `ca-${county.name.toLowerCase().replace(/\s+/g, '-')}-${r.tradeCode.toLowerCase()}-${r.effectiveDate}`;
          upsertRate.run({
            id,
            county: county.name,
            tradeCode: r.tradeCode,
            baseRate: r.baseRate,
            fringeRate: r.fringeRate,
            effectiveDate: r.effectiveDate,
            now: NOW,
            expiresAt: r.expiresAt,
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

    // Brief pause to avoid hammering CA DIR server
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  const status = failedCounties.length === 0 ? 'ok' : 'error';
  upsertSource.run({ now: NOW, status });

  console.log(`\n✓ CA DIR seed complete — ${totalInserted} rows across ${CA_COUNTIES.length - failedCounties.length} counties`);
  if (failedCounties.length > 0) {
    console.log(`  Failed counties: ${failedCounties.join(', ')}`);
  }
  console.log(`  state_wage_sources.CA sync_status = ${status}`);
}

run().catch((err) => {
  console.error('✗ CA DIR seed failed:', err);
  upsertSource.run({ now: NOW, status: 'error' });
  process.exit(1);
}).finally(() => db.close());
