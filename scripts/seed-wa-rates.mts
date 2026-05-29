/**
 * WA L&I prevailing wage seed — Socrata API (data.wa.gov)
 * Dataset: L&I Affidavit Details - Journey Level Trades And Wage Rates (pcn2-jime)
 * Run: npm run seed:wa-rates
 *
 * Note: This dataset reflects rates reported on certified payrolls.
 * Rates are grouped by county+trade and the max rate observed is used as the prevailing rate.
 * For the authoritative official schedule, see Option B in research notes (Playwright export).
 */
import Database from 'better-sqlite3';

const DB_PATH = process.env.DATABASE_PATH || './data/prevailing-wage.db';
const NOW = new Date().toISOString();
// WA L&I publishes Feb and Aug; current effective date per research: 03/04/2026
const EFFECTIVE = '2026-03-04';
const EXPIRES = '2026-09-01';

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Maps Socrata trade names to normalized trade codes
const TRADE_MAP: Record<string, string> = {
  'Carpenters': 'CARP',
  'Carpenter Tenders': 'CARP-TEND',
  'Cement Masons': 'MASO-CEM',
  'Electrician Motor Shop': 'ELEC',
  'Inside Wireman Electrician': 'ELEC',
  'Electronic Technicians': 'ELEC-TECH',
  'Power Line Construction Electricians': 'ELEC-PL',
  'Glaziers': 'GLAZ',
  'Ironworkers': 'IRON',
  'Laborers': 'LABO',
  'Laborers in Utilities Construction': 'LABO-UTIL',
  'Landscape Construction': 'LABO-LAND',
  'Operating Engineers/Power Equipment Operators': 'OPENG',
  'Painters': 'PAIN',
  'Plumbers, Pipefitters, and Steamfitters': 'PLUM',
  'Refrigeration Mechanics': 'REFRIG',
  'Roofers': 'ROOF',
  'Sheet Metal Workers': 'SMET',
  'Truck Drivers': 'TRUCK',
  'Heat & Frost Insulators': 'INSUL',
  'Drywall Applicators': 'DRYWL',
  'Drywall Finishers/Tapers': 'DRYWL-FIN',
  'Flaggers': 'FLAGGER',
  'Boilermakers': 'BOIL',
  'Millwrights': 'MILL',
  'Brick Masons': 'MASO',
  'Elevator Constructors': 'ELEV',
  'Sprinkler Fitters': 'SPRINK',
  'Stone Masons': 'MASO-STONE',
  'Lathers': 'LATH',
  'Plasterers': 'PLAST',
};

type SocrataRow = {
  trade: string;
  county: string;
  rate: string;
  fringe: string;
};

const SOCRATA_URL =
  'https://data.wa.gov/resource/pcn2-jime.json' +
  '?$select=trade,county,max(hourly_rate)%20as%20rate,max(hourly_fringe_benefits_rate)%20as%20fringe' +
  '&$where=job_classification=%27Journey%20Level%27%20AND%20hourly_rate%20IS%20NOT%20NULL' +
  '&$group=trade,county' +
  '&$limit=50000';

async function fetchRates(): Promise<SocrataRow[]> {
  console.log('Fetching WA L&I rates from Socrata API...');
  const res = await fetch(SOCRATA_URL, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`Socrata API error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<SocrataRow[]>;
}

const upsertRate = db.prepare(`
  INSERT INTO county_wage_determinations
    (id, state, county, city, trade_code, labor_type, base_rate, fringe_rate, effective_date, source, synced_at, expires_at)
  VALUES
    (@id, 'WA', @county, NULL, @tradeCode, 'journeyworker', @baseRate, @fringeRate, @effectiveDate, 'lni', @now, @expires)
  ON CONFLICT(id) DO UPDATE SET
    base_rate = excluded.base_rate,
    fringe_rate = excluded.fringe_rate,
    synced_at = excluded.synced_at,
    expires_at = excluded.expires_at
`);

const upsertSource = db.prepare(`
  INSERT INTO state_wage_sources (state, source_type, api_url, scrape_path, last_synced_at, sync_status)
  VALUES ('WA', 'api', 'https://data.wa.gov/resource/pcn2-jime.json', NULL, @now, @status)
  ON CONFLICT(state) DO UPDATE SET
    last_synced_at = excluded.last_synced_at,
    sync_status = excluded.sync_status
`);

async function run() {
  let rows: SocrataRow[];
  try {
    rows = await fetchRates();
    console.log(`  API returned ${rows.length} trade/county combinations`);
  } catch (err) {
    upsertSource.run({ now: NOW, status: 'error' });
    throw err;
  }

  let inserted = 0;
  let skipped = 0;

  const seedAll = db.transaction(() => {
    for (const row of rows) {
      const tradeCode = TRADE_MAP[row.trade];
      if (!tradeCode) { skipped++; continue; }

      const county = row.county ? row.county.trim() : null;
      if (!county) { skipped++; continue; }

      const baseRate = parseFloat(row.rate);
      const fringeRate = parseFloat(row.fringe ?? '0');
      if (isNaN(baseRate) || baseRate <= 0) { skipped++; continue; }

      const id = `wa-${county.toLowerCase().replace(/\s+/g, '-')}-${tradeCode.toLowerCase()}-${EFFECTIVE}`;
      upsertRate.run({ id, county, tradeCode, baseRate, fringeRate: isNaN(fringeRate) ? 0 : fringeRate, effectiveDate: EFFECTIVE, now: NOW, expires: EXPIRES });
      inserted++;
    }

    upsertSource.run({ now: NOW, status: 'ok' });
  });

  seedAll();
  console.log(`✓ WA L&I seed complete — ${inserted} rows upserted, ${skipped} skipped (unmapped trades)`);
  console.log(`  state_wage_sources.WA sync_status = ok`);
}

run().catch((err) => {
  console.error('✗ WA L&I seed failed:', err);
  process.exit(1);
}).finally(() => db.close());
