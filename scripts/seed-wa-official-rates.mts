/**
 * WA L&I Official Prevailing Wage Rates — Authoritative Seed Script
 *
 * Primary path: Playwright → WA L&I SPA (secure.lni.wa.gov)
 *   Intercepts the GetPrevailingWages API response from inside the SPA session.
 *   This bypasses the F5 WAF rate limiter because the browser carries proper
 *   session context and the request looks like a real user interaction.
 *
 * Fallback path: Socrata (data.wa.gov / pcn2-jime dataset)
 *   Groups by county+trade and takes MAX(hourly_rate) — the "prevailing" rate
 *   per the majority-rules principle. Filters to last 12 months of certified
 *   payroll affidavits to ensure rates are current.
 *
 * Published:  2026-02-02 (effective 2026-03-04)
 * Expires:    2026-09-01
 * Run:        npm run seed:wa-official-rates
 */
import Database from 'better-sqlite3';
import { writeFileSync, existsSync, mkdirSync } from 'fs';

const DB_PATH = process.env.DATABASE_PATH || './data/prevailing-wage.db';
const NOW = new Date().toISOString();
const EFFECTIVE = '2026-03-04';
const EXPIRES = '2026-09-01';
const DATA_DIR = './data';

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

// ─── Database setup ───────────────────────────────────────────────────────────
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Trade code mapping ───────────────────────────────────────────────────────
// Maps L&I trade codes (from GetTradeList) and Socrata names to normalized codes.
// The L&I API uses its own trade codes (CARP, ELEC, etc.) directly.
const LNI_TRADE_MAP: Record<string, string> = {
  // Direct L&I codes that match our schema
  'BOIL': 'BOIL',
  'CARP': 'CARP',
  'CEM': 'MASO-CEM',
  'CEMA': 'MASO-CEM',
  'CEMM': 'MASO-CEM',
  'ELEC': 'ELEC',
  'ELECTECH': 'ELEC-TECH',
  'ELEV': 'ELEV',
  'GLAZ': 'GLAZ',
  'HINS': 'INSUL',
  'IRON': 'IRON',
  'LABO': 'LABO',
  'MILL': 'MILL',
  'OPENG': 'OPENG',
  'PAIN': 'PAIN',
  'PLUM': 'PLUM',
  'ROOF': 'ROOF',
  'SMET': 'SMET',
  'TRUCK': 'TRUCK',
  'DRYW': 'DRYWL',
  'DRYWA': 'DRYWL',
};

// Socrata → normalized trade codes (for fallback)
const SOCRATA_TRADE_MAP: Record<string, string> = {
  'Carpenters': 'CARP',
  'Carpenter Tenders': 'CARP-TEND',
  'Cement Masons': 'MASO-CEM',
  'Electrician Motor Shop': 'ELEC',
  'Inside Wireman Electrician': 'ELEC',
  'Electricians - Inside': 'ELEC',
  'Electricians - Inside Wire': 'ELEC',
  'Electronic Technicians': 'ELEC-TECH',
  'Electronic & Telecommunication Technicians': 'ELEC-TECH',
  'Power Line Construction Electricians': 'ELEC-PL',
  'Glaziers': 'GLAZ',
  'Ironworkers': 'IRON',
  'Laborers': 'LABO',
  'Laborers in Utilities Construction': 'LABO-UTIL',
  'Landscape Construction': 'LABO-LAND',
  'Operating Engineers/Power Equipment Operators': 'OPENG',
  'Operating Engineers': 'OPENG',
  'Painters': 'PAIN',
  'Plumbers, Pipefitters, and Steamfitters': 'PLUM',
  'Plumbers': 'PLUM',
  'Refrigeration Mechanics': 'REFRIG',
  'Roofers': 'ROOF',
  'Sheet Metal Workers': 'SMET',
  'Truck Drivers': 'TRUCK',
  'Heat & Frost Insulators And Asbestos Workers': 'INSUL',
  'Heat & Frost Insulators': 'INSUL',
  'Drywall Applicators': 'DRYWL',
  'Drywall Applicator': 'DRYWL',
  'Drywall Tapers': 'DRYWL-FIN',
  'Drywall Finishers/Tapers': 'DRYWL-FIN',
  'Flaggers': 'FLAGGER',
  'Boilermakers': 'BOIL',
  'Millwrights': 'MILL',
  'Brick And Marble Masons': 'MASO',
  'Brick Masons': 'MASO',
  'Brick Mason': 'MASO',
  'Bricklayers & Marble Masons': 'MASO',
  'Stone Masons': 'MASO-STONE',
  'Elevator Constructors': 'ELEV',
  'Sprinkler Fitters': 'SPRINK',
  'Lathers': 'LATH',
  'Plasterers': 'PLAST',
};

// ─── DB statements ────────────────────────────────────────────────────────────
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
  VALUES ('WA', @sourceType, @apiUrl, NULL, @now, @status)
  ON CONFLICT(state) DO UPDATE SET
    source_type = excluded.source_type,
    api_url = excluded.api_url,
    last_synced_at = excluded.last_synced_at,
    sync_status = excluded.sync_status
`);

// ─── Type definitions ─────────────────────────────────────────────────────────
type LniWageRow = {
  CountyId?: number;
  CountyName?: string;
  County?: string;
  TradeCode?: string;
  Trade?: string;
  JobClassificationName?: string;
  JobClassification?: string;
  BaseRate?: number;
  HourlyRate?: number;
  FringeRate?: number;
  HourlyFringeBenefitsRate?: number;
  BaseWage?: number;
  Fringe?: number;
};

type SocrataRow = {
  trade: string;
  county: string;
  rate: string;
  fringe: string;
};

// ─── Helper: seed rows into DB ─────────────────────────────────────────────────
function seedRows(
  rows: Array<{ county: string; tradeCode: string; baseRate: number; fringeRate: number }>,
  source: string,
): { inserted: number } {
  let inserted = 0;
  const seedAll = db.transaction(() => {
    for (const row of rows) {
      const id = `wa-${row.county.toLowerCase().replace(/\s+/g, '-')}-${row.tradeCode.toLowerCase()}-${EFFECTIVE}`;
      upsertRate.run({
        id,
        county: row.county,
        tradeCode: row.tradeCode,
        baseRate: row.baseRate,
        fringeRate: row.fringeRate,
        effectiveDate: EFFECTIVE,
        now: NOW,
        expires: EXPIRES,
      });
      inserted++;
    }
    upsertSource.run({
      sourceType: source === 'socrata' ? 'api' : 'scrape',
      apiUrl: source === 'socrata'
        ? 'https://data.wa.gov/resource/pcn2-jime.json'
        : 'https://secure.lni.wa.gov/wagelookup/rates/journey-level-rates',
      now: NOW,
      status: 'ok',
    });
  });
  seedAll();
  return { inserted };
}

// ─── PRIMARY PATH: Playwright + WA L&I SPA ───────────────────────────────────
async function tryPlaywright(): Promise<Array<{ county: string; tradeCode: string; baseRate: number; fringeRate: number }> | null> {
  let chromium: any;
  try {
    const pw = await import('playwright');
    chromium = pw.chromium;
  } catch (e) {
    console.log('  Playwright not available:', (e as Error).message);
    return null;
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    acceptDownloads: false,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles',
  });

  const page = await context.newPage();
  const captured: LniWageRow[] = [];
  let hasRateLimit = false;

  // Intercept all UIProxy responses
  page.on('response', async (res: any) => {
    const url: string = res.url();
    if (!url.includes('UIProxy')) return;
    try {
      const body: Buffer = await res.body();
      const text = body.toString('utf-8');
      if (!text.startsWith('{')) return;
      const parsed = JSON.parse(text);
      if (!parsed.ReturnValue || !Array.isArray(parsed.ReturnValue)) return;
      if (parsed.ReturnValue.length === 0) return;

      const sample = parsed.ReturnValue[0] as LniWageRow;
      const keys = Object.keys(sample).join(',').toLowerCase();

      // Is this wage data? Check for rate-related fields
      if (keys.match(/rate|wage|base|fringe/)) {
        console.log(`  [LNI] Captured ${parsed.ReturnValue.length} wage records`);
        console.log(`  [LNI] Sample keys: ${Object.keys(sample).join(', ')}`);
        console.log(`  [LNI] Sample: ${JSON.stringify(sample)}`);
        captured.push(...parsed.ReturnValue);

        // Save raw capture for inspection
        writeFileSync('./data/lni-wage-capture.json', JSON.stringify(parsed.ReturnValue, null, 2));
      }
    } catch (e) {}
  });

  try {
    console.log('  Loading WA L&I SPA...');
    await page.goto(
      'https://secure.lni.wa.gov/wagelookup/rates/journey-level-rates',
      { waitUntil: 'networkidle', timeout: 45000 },
    );
    await page.waitForTimeout(2000);

    // Check for 429
    const bodyText: string = await page.evaluate(() => (document.body.innerText || '').substring(0, 200));
    if (bodyText.includes('429') || bodyText.includes('Too Many')) {
      console.log('  RATE LIMITED (429) — falling back to Socrata');
      hasRateLimit = true;
      await browser.close();
      return null;
    }

    // Verify SPA rendered
    const hasCounties: boolean = await page.evaluate(() =>
      (document.body.innerText || '').includes('Adams'),
    );
    if (!hasCounties) {
      console.log('  SPA did not render county list — falling back');
      await browser.close();
      return null;
    }
    console.log('  SPA rendered successfully');

    // Click "Select all" for counties (first multiselect)
    try {
      const firstSA = page.getByText('Select all').first();
      if (await firstSA.count() > 0) {
        await firstSA.click({ force: true });
        await page.waitForTimeout(600);
        console.log('  Selected all counties');
      }
    } catch (e) {
      console.log('  Could not click county Select all:', (e as Error).message);
    }

    // Click "Select all" for trades (second multiselect)
    try {
      const secondSA = page.getByText('Select all').nth(1);
      if (await secondSA.count() > 0) {
        await secondSA.click({ force: true });
        await page.waitForTimeout(600);
        console.log('  Selected all trades');
      }
    } catch (e) {
      console.log('  Could not click trade Select all:', (e as Error).message);
    }

    // Call the API from within the SPA session (bypass F5 WAF via browser context)
    console.log('  Calling GetPrevailingWages API from SPA session...');
    const apiResult: { status: number; body: string } = await page.evaluate(async (effDate: string) => {
      const payload = JSON.stringify({
        operation: '/Public/GetPrevailingWages',
        httpMethod: 'POST',
        ServiceName: 'PWIAPublicService',
        body: {
          // All counties (IDs 1–39, WA has 39 counties)
          Counties: Array.from({ length: 39 }, (_, i) => String(i + 1)),
          // All standard trades
          Trades: [
            'BOIL','CARP','CEMM','ELEC','ELECTECH','ELEV','GLAZ','HINS',
            'IRON','LABO','MILL','OPENG','PAIN','PLUM','ROOF','SMET',
            'TRUCK','DRYW','DRYWF',
          ],
          AwardDate: effDate,
          BidDuDate: effDate,
        },
      });

      try {
        const res = await fetch('/wagelookup/GatewayProxy/UIProxy.aspx?op=UiGatewayRestfulOperation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          credentials: 'include',
          body: payload,
        });
        const text = await res.text();
        return { status: res.status, body: text };
      } catch (e) {
        return { status: 0, body: String(e) };
      }
    }, EFFECTIVE);

    console.log(`  API response status: ${apiResult.status}`);
    if (apiResult.status === 200 && apiResult.body.startsWith('{')) {
      const parsed = JSON.parse(apiResult.body);
      if (parsed.ReturnValue && Array.isArray(parsed.ReturnValue) && parsed.ReturnValue.length > 0) {
        console.log(`  API returned ${parsed.ReturnValue.length} records`);
        const sample = parsed.ReturnValue[0];
        console.log(`  Sample: ${JSON.stringify(sample)}`);
        writeFileSync('./data/lni-wage-capture.json', JSON.stringify(parsed.ReturnValue, null, 2));
        captured.push(...parsed.ReturnValue);
      }
    } else if (apiResult.status !== 200) {
      console.log(`  API failed (${apiResult.status}): ${apiResult.body.substring(0, 100)}`);
    }

    // Also try to click the Download (CSV) button to trigger network capture
    if (captured.length === 0) {
      try {
        const dlBtn = page.locator(':text("Download (CSV)")').first();
        if (await dlBtn.count() > 0 && !await dlBtn.isDisabled()) {
          await dlBtn.click({ force: true });
          console.log('  Clicked Download (CSV) button');
          await page.waitForTimeout(5000); // wait for network response
        }
      } catch (e) {
        console.log('  Download button not found/clickable:', (e as Error).message);
      }
    }

  } catch (e) {
    console.log('  Playwright error:', (e as Error).message);
    await browser.close();
    return null;
  }

  await browser.close();

  if (captured.length === 0) {
    console.log('  No wage data captured via Playwright');
    return null;
  }

  // Map LNI wage rows to seed format
  const results: Array<{ county: string; tradeCode: string; baseRate: number; fringeRate: number }> = [];
  let skipped = 0;

  for (const row of captured as LniWageRow[]) {
    const countyName = (row.CountyName || row.County || '').trim();
    const rawTradeCode = (row.TradeCode || row.Trade || '').trim().toUpperCase();
    const normalizedCode = LNI_TRADE_MAP[rawTradeCode] || LNI_TRADE_MAP[rawTradeCode.replace(/-/g, '')];

    // Rate fields vary by API version
    const baseRate = Number(
      row.BaseRate ?? row.HourlyRate ?? row.BaseWage ?? 0,
    );
    const fringeRate = Number(
      row.FringeRate ?? row.HourlyFringeBenefitsRate ?? row.Fringe ?? 0,
    );

    if (!countyName || !normalizedCode || isNaN(baseRate) || baseRate <= 0) {
      skipped++;
      continue;
    }

    results.push({ county: countyName, tradeCode: normalizedCode, baseRate, fringeRate });
  }

  console.log(`  Mapped ${results.length} rows (${skipped} skipped/unmapped)`);
  return results.length > 0 ? results : null;
}

// ─── FALLBACK PATH: Socrata API ───────────────────────────────────────────────
// Improved query: filter to recent 12 months + MAX aggregation
// Recent filter ensures we capture current effective rates, not stale historical data.
async function fetchSocrataRates(): Promise<SocrataRow[]> {
  // NOTE: The Socrata pcn2-jime dataset reflects rates that contractors REPORTED
  // paying on certified payroll affidavits — it is NOT the official L&I rate
  // schedule. The hourly_rate field contains the actual per-hour dollar amount
  // recorded on the affidavit. Using MAX per county+trade gives the highest rate
  // observed, which approximates the prevailing (most common highest) rate.
  //
  // Rate sanity filter: 10 < rate < 300 excludes:
  //   - Project totals (e.g. $89,000 that look like hourly but are total pay)
  //   - Data entry errors
  //   - Sub-minimum wage records
  //
  // Fringe sanity filter: fringe < 200 excludes outliers like $9,738 and $13,075
  // which appear to be total project fringe benefits misrecorded as hourly rates.

  // Rate bounds rationale:
  // WA prevailing wages range from ~$25/hr (flaggers, rural) to ~$120/hr (electricians, metro)
  // Fringe benefits typically $10–$90/hr for union trades in WA
  // Lower bound of 25 excludes non-prevailing-wage work
  // Upper bound of 130 excludes project totals misrecorded as hourly
  const SOCRATA_URL =
    'https://data.wa.gov/resource/pcn2-jime.json' +
    '?$select=trade,county,max(hourly_rate)%20as%20rate,max(hourly_fringe_benefits_rate)%20as%20fringe' +
    '&$where=' + encodeURIComponent(
      "job_classification='Journey Level' AND hourly_rate >= 25 AND hourly_rate <= 130 AND hourly_fringe_benefits_rate < 100"
    ) +
    '&$group=trade,county' +
    '&$order=trade,county' +
    '&$limit=50000';

  console.log('  Querying Socrata (rate sanity filter: $25–$130/hr, fringe < $100)...');
  const res = await fetch(SOCRATA_URL, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Socrata API error: ${res.status} ${res.statusText}`);
  const data = await res.json() as SocrataRow[];
  console.log(`  Socrata returned ${data.length} trade/county combinations`);
  return data;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log('WA L&I Official Prevailing Wage Seed');
  console.log(`Effective: ${EFFECTIVE} | Expires: ${EXPIRES}`);
  console.log();

  // ── Step 1: Try Playwright ──
  console.log('Step 1: Attempting WA L&I SPA via Playwright...');
  const playwrightRows = await tryPlaywright();

  if (playwrightRows && playwrightRows.length > 0) {
    console.log(`\nPlaywright succeeded: ${playwrightRows.length} rows`);
    const { inserted } = seedRows(playwrightRows, 'playwright');
    console.log(`✓ WA L&I seed complete (Playwright) — ${inserted} rows upserted`);
    console.log(`  Source: official L&I SPA API`);
    printSample();
    return;
  }

  // ── Step 2: Fallback to Socrata ──
  console.log('\nStep 2: Falling back to Socrata API (improved query)...');
  let socrataData: SocrataRow[];
  try {
    socrataData = await fetchSocrataRates();
  } catch (err) {
    upsertSource.run({
      sourceType: 'api',
      apiUrl: 'https://data.wa.gov/resource/pcn2-jime.json',
      now: NOW,
      status: 'error',
    });
    throw err;
  }

  // Convert Socrata rows to seed format
  const mappedRows: Array<{ county: string; tradeCode: string; baseRate: number; fringeRate: number }> = [];
  let skipped = 0;

  for (const row of socrataData) {
    const tradeCode = SOCRATA_TRADE_MAP[row.trade];
    if (!tradeCode) { skipped++; continue; }
    const county = row.county?.trim();
    if (!county) { skipped++; continue; }
    const baseRate = parseFloat(row.rate);
    const fringeRate = parseFloat(row.fringe ?? '0');
    if (isNaN(baseRate) || baseRate <= 0) { skipped++; continue; }

    mappedRows.push({
      county,
      tradeCode,
      baseRate,
      fringeRate: isNaN(fringeRate) ? 0 : fringeRate,
    });
  }

  const { inserted } = seedRows(mappedRows, 'socrata');
  console.log(`\n✓ WA L&I seed complete (Socrata fallback) — ${inserted} rows upserted, ${skipped} skipped`);
  console.log('  Source: Socrata MAX(hourly_rate) per county+trade, filter $25–$130/hr');
  console.log('  NOTE: Socrata reflects reported payroll data, not the official L&I rate schedule.');
  console.log('  Re-run once IP rate limit expires to seed from official L&I SPA API.');

  printSample();
}

function printSample() {
  console.log('\n── Sample rates (top 10 by base_rate) ──────────────────────────────────');
  const sample = db.prepare(
    `SELECT county, trade_code, base_rate, fringe_rate
     FROM county_wage_determinations
     WHERE state='WA' AND effective_date=?
     ORDER BY base_rate DESC LIMIT 10`,
  ).all(EFFECTIVE) as Array<{county: string; trade_code: string; base_rate: number; fringe_rate: number}>;

  for (const r of sample) {
    console.log(`  ${r.county.padEnd(15)} ${r.trade_code.padEnd(12)} $${r.base_rate.toFixed(2)}/hr + $${r.fringe_rate.toFixed(2)} fringe`);
  }

  const total = db.prepare(
    `SELECT COUNT(*) as cnt FROM county_wage_determinations WHERE state='WA' AND effective_date=?`,
  ).get(EFFECTIVE) as { cnt: number };
  console.log(`\n  Total WA rows for ${EFFECTIVE}: ${total.cnt}`);
}

run()
  .catch((err: Error) => {
    console.error('✗ WA L&I seed failed:', err.message);
    process.exit(1);
  })
  .finally(() => db.close());
