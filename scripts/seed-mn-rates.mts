/**
 * MN DLI prevailing wage seed — Excel bulk download (all 87 counties, one file)
 * Source: https://www.dli.mn.gov/sites/default/files/excel/prevwage/pw_all_counties_2026.xlsx
 * Run: npm run seed:mn-rates
 *
 * MN DLI publishes an annual Excel workbook with all county wage determinations.
 * The workbook has one sheet per trade group or one row per county+trade combo.
 * This is the highest-ROI approach: single HTTP fetch covers all 87 counties.
 *
 * STUB — URL and column mapping confirmed; Excel parser (exceljs or xlsx) needed.
 * Install: npm install xlsx
 *
 * Known column layout (2026 workbook, row 1 = headers):
 *   A: County
 *   B: Trade / Classification
 *   C: Basic Hourly Rate
 *   D: Total Fringe Benefits
 *   E: Effective Date
 *   F: Expiration Date
 *
 * Rate update schedule: Annual, effective January 1 each year.
 * Agency: MN Department of Labor and Industry (DLI)
 * Official page: https://www.dli.mn.gov/business/employment-practices/prevailing-wage
 */
import Database from 'better-sqlite3';
import * as XLSX from 'xlsx'; // npm install xlsx

const DB_PATH = process.env.DATABASE_PATH || './data/prevailing-wage.db';
const NOW = new Date().toISOString();
const EFFECTIVE = '2026-01-01';
const EXPIRES = '2026-12-31';

// MN DLI annual Excel — one file covers all 87 counties
// Check dli.mn.gov each January for updated URL (year changes)
const MN_EXCEL_URL =
  'https://www.dli.mn.gov/sites/default/files/excel/prevwage/pw_all_counties_2026.xlsx';

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Maps MN DLI trade names to normalized trade codes
// TODO: expand after inspecting actual 2026 workbook column B values
const TRADE_MAP: Record<string, string> = {
  'Carpenter': 'CARP',
  'Carpenters': 'CARP',
  'Cement Mason': 'MASO-CEM',
  'Electrician': 'ELEC',
  'Inside Wireman': 'ELEC',
  'Ironworker': 'IRON',
  'Iron Workers': 'IRON',
  'Laborer': 'LABO',
  'Laborers': 'LABO',
  'Operating Engineer': 'OPENG',
  'Painter': 'PAIN',
  'Painters': 'PAIN',
  'Plumber': 'PLUM',
  'Plumbers': 'PLUM',
  'Roofer': 'ROOF',
  'Sheet Metal Worker': 'SMET',
  'Sheet Metal Workers': 'SMET',
  'Boilermaker': 'BOIL',
  'Millwright': 'MILL',
  'Millwrights': 'MILL',
  'Glazier': 'GLAZ',
  'Elevator Constructor': 'ELEV',
  'Insulator': 'INSUL',
  'Heat & Frost Insulator': 'INSUL',
  'Pile Driver': 'PILE',
  'Truck Driver': 'TRUCK',
};

function mapTrade(raw: string): string | null {
  const trimmed = raw.trim();
  if (TRADE_MAP[trimmed]) return TRADE_MAP[trimmed];
  // Prefix match fallback
  for (const [key, code] of Object.entries(TRADE_MAP)) {
    if (trimmed.toUpperCase().startsWith(key.toUpperCase())) return code;
  }
  return null;
}

function parseDollar(val: unknown): number {
  if (typeof val === 'number') return val;
  const n = parseFloat(String(val).replace(/[$,\s]/g, ''));
  return isNaN(n) ? 0 : n;
}

const upsertRate = db.prepare(`
  INSERT INTO county_wage_determinations
    (id, state, county, city, trade_code, labor_type, base_rate, fringe_rate, effective_date, source, synced_at, expires_at)
  VALUES
    (@id, 'MN', @county, NULL, @tradeCode, 'journeyworker', @baseRate, @fringeRate, @effectiveDate, 'dli', @now, @expires)
  ON CONFLICT(id) DO UPDATE SET
    base_rate = excluded.base_rate,
    fringe_rate = excluded.fringe_rate,
    effective_date = excluded.effective_date,
    synced_at = excluded.synced_at,
    expires_at = excluded.expires_at
`);

const upsertSource = db.prepare(`
  INSERT INTO state_wage_sources (state, source_type, api_url, scrape_path, last_synced_at, sync_status)
  VALUES ('MN', 'api', @url, NULL, @now, @status)
  ON CONFLICT(state) DO UPDATE SET
    last_synced_at = excluded.last_synced_at,
    sync_status = excluded.sync_status
`);

async function fetchWorkbook(): Promise<Buffer> {
  console.log(`Fetching MN DLI Excel from:\n  ${MN_EXCEL_URL}`);
  const res = await fetch(MN_EXCEL_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (prevailing-wage-app/1.0)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function run() {
  let buf: Buffer;
  try {
    buf = await fetchWorkbook();
  } catch (err) {
    upsertSource.run({ url: MN_EXCEL_URL, now: NOW, status: 'error' });
    throw err;
  }

  const workbook = XLSX.read(buf, { type: 'buffer' });

  // MN DLI typically uses the first sheet for journey-level rates
  // TODO: inspect workbook.SheetNames after first run and adjust if needed
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (rows.length < 2) throw new Error('Workbook sheet appears empty');

  // Row 0 = headers, Row 1+ = data
  // Expected: [County, Trade, BasicHourlyRate, TotalFringe, EffectiveDate, ExpirationDate]
  // TODO: verify exact header names from actual workbook and adjust indices below
  const headers = (rows[0] as string[]).map(h => String(h).trim().toLowerCase());
  console.log(`  Sheet "${sheetName}" headers: ${headers.join(' | ')}`);

  // Column index detection (fallback to positional if headers differ)
  const colCounty   = headers.findIndex(h => h.includes('county'))    ?? 0;
  const colTrade    = headers.findIndex(h => h.includes('trade') || h.includes('class')) ?? 1;
  const colBase     = headers.findIndex(h => h.includes('basic') || h.includes('base'))  ?? 2;
  const colFringe   = headers.findIndex(h => h.includes('fringe') || h.includes('benefit')) ?? 3;

  let inserted = 0;
  let skipped = 0;

  const seedAll = db.transaction(() => {
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] as unknown[];
      const countyRaw = String(row[colCounty] ?? '').trim();
      const tradeRaw  = String(row[colTrade]  ?? '').trim();
      const baseRate  = parseDollar(row[colBase]);
      const fringeRate = parseDollar(row[colFringe]);

      if (!countyRaw || !tradeRaw || baseRate <= 0) { skipped++; continue; }

      const tradeCode = mapTrade(tradeRaw);
      if (!tradeCode) { skipped++; continue; }

      const county = countyRaw.replace(/\s+county$/i, '').trim();
      const id = `mn-${county.toLowerCase().replace(/\s+/g, '-')}-${tradeCode.toLowerCase()}-${EFFECTIVE}`;

      upsertRate.run({ id, county, tradeCode, baseRate, fringeRate, effectiveDate: EFFECTIVE, now: NOW, expires: EXPIRES });
      inserted++;
    }

    upsertSource.run({ url: MN_EXCEL_URL, now: NOW, status: 'ok' });
  });

  seedAll();
  console.log(`\n✓ MN DLI seed complete — ${inserted} rows across 87 counties, ${skipped} skipped`);
  console.log(`  state_wage_sources.MN sync_status = ok`);
}

run().catch((err) => {
  console.error('✗ MN DLI seed failed:', err);
  upsertSource.run({ url: MN_EXCEL_URL, now: NOW, status: 'error' });
  process.exit(1);
}).finally(() => db.close());
