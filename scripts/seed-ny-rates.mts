/**
 * NY DOL prevailing wage manual seed — Suffolk County + Albany County
 * Source: NY DOL PDF schedules, effective 07/01/2025
 * Run: npm run seed:ny-rates
 */
import Database from 'better-sqlite3';
import crypto from 'crypto';

const DB_PATH = process.env.DATABASE_PATH || './data/prevailing-wage.db';
const NOW = new Date().toISOString();
const EFFECTIVE = '2025-07-01';
const EXPIRES = '2026-06-30';

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

type RateRow = {
  state: string;
  county: string;
  city?: string;
  tradeCode: string;
  laborType: string;
  baseRate: number;
  fringeRate: number;
};

const RATES: RateRow[] = [
  // ── Suffolk County (Nassau/Suffolk District 4 trades) ─────────────────────
  // Source: NY DOL General Construction Schedule, Suffolk County, 07/01/2025-06/30/2026
  { state: 'NY', county: 'Suffolk', tradeCode: 'CARP',     laborType: 'journeyworker', baseRate: 53.56, fringeRate: 34.43 },
  { state: 'NY', county: 'Suffolk', tradeCode: 'ELEC',     laborType: 'journeyworker', baseRate: 64.25, fringeRate: 47.26 }, // 18% wage + $35.69 → $47.265
  { state: 'NY', county: 'Suffolk', tradeCode: 'IRON',     laborType: 'journeyworker', baseRate: 58.95, fringeRate: 92.60 }, // structural; fringe includes premium overtime
  { state: 'NY', county: 'Suffolk', tradeCode: 'LABO',     laborType: 'journeyworker', baseRate: 45.35, fringeRate: 32.36 },
  { state: 'NY', county: 'Suffolk', tradeCode: 'LABO-HH',  laborType: 'journeyworker', baseRate: 57.89, fringeRate: 37.18 }, // H&H Gr.3 basic/flagger
  { state: 'NY', county: 'Suffolk', tradeCode: 'MASO',     laborType: 'journeyworker', baseRate: 68.84, fringeRate: 36.70 }, // bricklayer
  { state: 'NY', county: 'Suffolk', tradeCode: 'MASO-CEM', laborType: 'journeyworker', baseRate: 59.87, fringeRate: 34.81 },
  { state: 'NY', county: 'Suffolk', tradeCode: 'OPENG-A',  laborType: 'journeyworker', baseRate: 80.43, fringeRate: 42.40 }, // building class A
  { state: 'NY', county: 'Suffolk', tradeCode: 'PAIN',     laborType: 'journeyworker', baseRate: 54.56, fringeRate: 35.23 },
  { state: 'NY', county: 'Suffolk', tradeCode: 'PLUM',     laborType: 'journeyworker', baseRate: 60.73, fringeRate: 51.95 }, // commercial
  { state: 'NY', county: 'Suffolk', tradeCode: 'ROOF',     laborType: 'journeyworker', baseRate: 58.75, fringeRate: 39.86 },
  { state: 'NY', county: 'Suffolk', tradeCode: 'SMET',     laborType: 'journeyworker', baseRate: 62.34, fringeRate: 55.00 },
  { state: 'NY', county: 'Suffolk', tradeCode: 'GLAZ',     laborType: 'journeyworker', baseRate: 64.23, fringeRate: 43.03 },
  { state: 'NY', county: 'Suffolk', tradeCode: 'ELEV',     laborType: 'journeyworker', baseRate: 83.27, fringeRate: 47.65 }, // elevator constructor

  // ── Albany County (Capital District — District 1/2/12 trades) ─────────────
  // Source: NY DOL General Construction Schedule, Albany County, 07/01/2025-06/30/2026
  { state: 'NY', county: 'Albany', tradeCode: 'CARP',     laborType: 'journeyworker', baseRate: 36.38, fringeRate: 24.84 },
  { state: 'NY', county: 'Albany', tradeCode: 'CARP-HH',  laborType: 'journeyworker', baseRate: 46.27, fringeRate: 25.80 }, // heavy & highway
  { state: 'NY', county: 'Albany', tradeCode: 'ELEC',     laborType: 'journeyworker', baseRate: 50.00, fringeRate: 33.00 }, // $31.50 + 3% of $50 = $33.00
  { state: 'NY', county: 'Albany', tradeCode: 'ELEV',     laborType: 'journeyworker', baseRate: 57.73, fringeRate: 38.44 },
  { state: 'NY', county: 'Albany', tradeCode: 'GLAZ',     laborType: 'journeyworker', baseRate: 40.36, fringeRate: 24.40 },
  { state: 'NY', county: 'Albany', tradeCode: 'INSUL',    laborType: 'journeyworker', baseRate: 41.74, fringeRate: 27.58 }, // heat & frost insulator
  { state: 'NY', county: 'Albany', tradeCode: 'IRON',     laborType: 'journeyworker', baseRate: 40.75, fringeRate: 34.17 },
  { state: 'NY', county: 'Albany', tradeCode: 'LABO',     laborType: 'journeyworker', baseRate: 38.16, fringeRate: 26.93 }, // building gr.1
  { state: 'NY', county: 'Albany', tradeCode: 'LABO-HH',  laborType: 'journeyworker', baseRate: 43.69, fringeRate: 28.65 }, // H&H gr.A
  { state: 'NY', county: 'Albany', tradeCode: 'MASO',     laborType: 'journeyworker', baseRate: 41.79, fringeRate: 24.08 }, // bricklayer
  { state: 'NY', county: 'Albany', tradeCode: 'MASO-CEM', laborType: 'journeyworker', baseRate: 41.79, fringeRate: 24.08 },
];

const upsertRate = db.prepare(`
  INSERT INTO county_wage_determinations
    (id, state, county, city, trade_code, labor_type, base_rate, fringe_rate, effective_date, source, synced_at, expires_at)
  VALUES
    (@id, @state, @county, @city, @tradeCode, @laborType, @baseRate, @fringeRate, @effectiveDate, 'dol', @now, @expires)
  ON CONFLICT(id) DO UPDATE SET
    base_rate = excluded.base_rate,
    fringe_rate = excluded.fringe_rate,
    effective_date = excluded.effective_date,
    synced_at = excluded.synced_at,
    expires_at = excluded.expires_at
`);

const upsertSource = db.prepare(`
  INSERT INTO state_wage_sources (state, source_type, api_url, scrape_path, last_synced_at, sync_status)
  VALUES (@state, 'pdf', @apiUrl, @scrapePath, @now, 'ok')
  ON CONFLICT(state) DO UPDATE SET
    last_synced_at = excluded.last_synced_at,
    sync_status = 'ok'
`);

let inserted = 0;
const seedAll = db.transaction(() => {
  for (const row of RATES) {
    const id = `ny-${row.county.toLowerCase()}-${row.tradeCode.toLowerCase()}-${EFFECTIVE}`;
    upsertRate.run({
      id,
      state: row.state,
      county: row.county,
      city: row.city ?? null,
      tradeCode: row.tradeCode,
      laborType: row.laborType,
      baseRate: row.baseRate,
      fringeRate: row.fringeRate,
      effectiveDate: EFFECTIVE,
      now: NOW,
      expires: EXPIRES,
    });
    inserted++;
  }

  upsertSource.run({
    state: 'NY',
    apiUrl: 'https://apps.labor.ny.gov/wpp/viewPrevailingWageSchedule.do',
    scrapePath: '?typeid=1&county={countyId}',
    now: NOW,
  });
});

try {
  seedAll();
  console.log(`✓ NY DOL seed complete — ${inserted} rows upserted (Suffolk + Albany)`);
  console.log(`  state_wage_sources.NY sync_status = ok`);
} catch (err) {
  console.error('✗ NY DOL seed failed:', err);
  process.exit(1);
} finally {
  db.close();
}
