// src/server/services/wdolSync.ts
// Monthly sync coordinator. Called by the node-cron job in index.ts.
// Also exported for manual trigger via POST /api/wages/sync (02-02).
//
// IMPORTANT: The SAM.gov search/index API was not confirmed — all tested
// URL patterns returned 404. Using the WD seed list approach (Pattern 5 from research).

import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { fetchWdFromSamGov } from './wdolFetcher.js';
import { parseWdDocument } from './wdolParser.js';
import { upsertWageDetermination, upsertClassifications, getCachedWd } from './wageCache.js';
import { getDb } from '../db/index.js';
import { wageSyncMeta } from '../db/schema.js';

// Known WD identifiers for the top 20 states by Davis-Bacon construction volume.
// Source: SAM.gov cross-index + live verification of individual WD API responses.
// county: null means the WD is statewide; county: string means county-specific.
// Expand this list as new WDs are confirmed via the SAM.gov wage-determinations UI.
export const WD_SEED_LIST: Array<{
  wdNumber: string;
  state: string;
  county: string | null;
  revision: number;
}> = [
  { wdNumber: 'CA20250022', state: 'CA', county: 'Los Angeles', revision: 0 },
  { wdNumber: 'CA20250024', state: 'CA', county: 'Orange', revision: 0 },
  { wdNumber: 'CA20250025', state: 'CA', county: 'Riverside', revision: 0 },
  { wdNumber: 'CA20250001', state: 'CA', county: 'San Diego', revision: 0 },
  // Discovered 2026-04-21 via scripts/probe-wd-numbers.mts — county parsed from WD document
  { wdNumber: 'CA20250005', state: 'CA', county: 'Del Norte', revision: 0 },
  { wdNumber: 'CA20250009', state: 'CA', county: 'Fresno',    revision: 0 },
  { wdNumber: 'CA20250017', state: 'CA', county: 'Imperial',  revision: 0 },
  { wdNumber: 'CA20250019', state: 'CA', county: 'Alameda',   revision: 0 },
  { wdNumber: 'TX20250001', state: 'TX', county: null, revision: 0 },
  { wdNumber: 'FL20250001', state: 'FL', county: null, revision: 0 },
  { wdNumber: 'NY20250046', state: 'NY', county: 'New York', revision: 2 },
  // 2026 NY WDs — user-provided batch, county parsed from WD document text
  // via scripts/probe-ny-wds.mts. 32 of 40 reliably parsed.
  { wdNumber: 'NY20260001', state: 'NY', county: 'New York',    revision: 0 },
  { wdNumber: 'NY20260010', state: 'NY', county: 'Monroe',      revision: 0 },
  { wdNumber: 'NY20260011', state: 'NY', county: 'Niagara',     revision: 0 },
  { wdNumber: 'NY20260013', state: 'NY', county: 'Oneida',      revision: 0 },
  { wdNumber: 'NY20260014', state: 'NY', county: 'Oneida',      revision: 0 }, // alt construction type
  { wdNumber: 'NY20260015', state: 'NY', county: 'Madison',     revision: 0 },
  { wdNumber: 'NY20260016', state: 'NY', county: 'Onondaga',    revision: 0 },
  { wdNumber: 'NY20260017', state: 'NY', county: 'Westchester', revision: 0 },
  { wdNumber: 'NY20260020', state: 'NY', county: 'Rockland',    revision: 0 },
  { wdNumber: 'NY20260022', state: 'NY', county: 'Jefferson',   revision: 0 },
  { wdNumber: 'NY20260023', state: 'NY', county: 'Madison',     revision: 0 }, // alt construction type
  { wdNumber: 'NY20260024', state: 'NY', county: 'Tompkins',    revision: 0 },
  { wdNumber: 'NY20260025', state: 'NY', county: 'Putnam',      revision: 0 },
  { wdNumber: 'NY20260026', state: 'NY', county: 'Onondaga',    revision: 0 }, // alt construction type
  { wdNumber: 'NY20260027', state: 'NY', county: 'Oswego',      revision: 0 },
  { wdNumber: 'NY20260029', state: 'NY', county: 'Genesee',     revision: 0 },
  { wdNumber: 'NY20260030', state: 'NY', county: 'Livingston',  revision: 0 },
  { wdNumber: 'NY20260031', state: 'NY', county: 'Herkimer',    revision: 0 },
  { wdNumber: 'NY20260034', state: 'NY', county: 'Orleans',     revision: 0 },
  { wdNumber: 'NY20260036', state: 'NY', county: 'Cayuga',      revision: 0 },
  { wdNumber: 'NY20260037', state: 'NY', county: 'Otsego',      revision: 0 },
  { wdNumber: 'NY20260038', state: 'NY', county: 'Oswego',      revision: 0 }, // alt construction type
  { wdNumber: 'NY20260039', state: 'NY', county: 'Warren',      revision: 0 },
  { wdNumber: 'NY20260040', state: 'NY', county: 'Seneca',      revision: 0 },
  { wdNumber: 'NY20260042', state: 'NY', county: 'Cortland',    revision: 0 },
  { wdNumber: 'NY20260045', state: 'NY', county: 'Tioga',       revision: 0 },
  { wdNumber: 'NY20260046', state: 'NY', county: 'Hamilton',    revision: 0 },
  { wdNumber: 'NY20260047', state: 'NY', county: 'Allegany',    revision: 0 },
  { wdNumber: 'NY20260049', state: 'NY', county: 'Orange',      revision: 0 },
  { wdNumber: 'NY20260051', state: 'NY', county: 'Tompkins',    revision: 0 }, // alt construction type
  { wdNumber: 'NY20260073', state: 'NY', county: 'Yates',       revision: 0 },
  { wdNumber: 'NY20260113', state: 'NY', county: 'Otsego',      revision: 0 }, // alt construction type
  // 2026 NY WDs — county parse ambiguous in document text, TODO manual verify via sam.gov UI
  { wdNumber: 'NY20260002', state: 'NY', county: null, revision: 0 },
  { wdNumber: 'NY20260003', state: 'NY', county: null, revision: 0 },
  { wdNumber: 'NY20260004', state: 'NY', county: null, revision: 0 },
  { wdNumber: 'NY20260005', state: 'NY', county: null, revision: 0 },
  { wdNumber: 'NY20260007', state: 'NY', county: null, revision: 0 },
  { wdNumber: 'NY20260008', state: 'NY', county: null, revision: 0 },
  { wdNumber: 'NY20260009', state: 'NY', county: null, revision: 0 },
  { wdNumber: 'NY20260012', state: 'NY', county: null, revision: 0 },
  { wdNumber: 'IL20250001', state: 'IL', county: null, revision: 0 },
  { wdNumber: 'PA20250001', state: 'PA', county: null, revision: 0 },
  { wdNumber: 'OH20250001', state: 'OH', county: null, revision: 0 },
  { wdNumber: 'GA20250001', state: 'GA', county: null, revision: 0 },
  { wdNumber: 'WA20250001', state: 'WA', county: null, revision: 0 },
  { wdNumber: 'NC20250001', state: 'NC', county: null, revision: 0 },
  { wdNumber: 'VA20250001', state: 'VA', county: null, revision: 0 },
  { wdNumber: 'AZ20250001', state: 'AZ', county: null, revision: 0 },
  { wdNumber: 'CO20250001', state: 'CO', county: null, revision: 0 },
  { wdNumber: 'MI20250001', state: 'MI', county: null, revision: 0 },
  { wdNumber: 'NJ20250001', state: 'NJ', county: null, revision: 0 },
  { wdNumber: 'MD20250001', state: 'MD', county: null, revision: 0 },
  { wdNumber: 'MN20250001', state: 'MN', county: null, revision: 0 },
  { wdNumber: 'IN20250001', state: 'IN', county: null, revision: 0 },
  { wdNumber: 'MO20250001', state: 'MO', county: null, revision: 0 },
  { wdNumber: 'TN20250001', state: 'TN', county: null, revision: 0 },
  // Extended state coverage
  { wdNumber: 'OR20250001', state: 'OR', county: null, revision: 0 },
  { wdNumber: 'NV20250001', state: 'NV', county: null, revision: 0 },
  { wdNumber: 'UT20250001', state: 'UT', county: null, revision: 0 },
  { wdNumber: 'SC20250001', state: 'SC', county: null, revision: 0 },
  { wdNumber: 'AL20250001', state: 'AL', county: null, revision: 0 },
  { wdNumber: 'LA20250001', state: 'LA', county: null, revision: 0 },
  { wdNumber: 'KY20250001', state: 'KY', county: null, revision: 0 },
  { wdNumber: 'WI20250001', state: 'WI', county: null, revision: 0 },
  { wdNumber: 'OK20250001', state: 'OK', county: null, revision: 0 },
  { wdNumber: 'CT20250001', state: 'CT', county: null, revision: 0 },
  { wdNumber: 'MA20250001', state: 'MA', county: null, revision: 0 },
  { wdNumber: 'ID20250001', state: 'ID', county: null, revision: 0 },
  { wdNumber: 'NM20250001', state: 'NM', county: null, revision: 0 },
  { wdNumber: 'KS20250001', state: 'KS', county: null, revision: 0 },
  { wdNumber: 'NE20250001', state: 'NE', county: null, revision: 0 },
  { wdNumber: 'AR20250001', state: 'AR', county: null, revision: 0 },
  { wdNumber: 'MS20250001', state: 'MS', county: null, revision: 0 },
  { wdNumber: 'IA20250001', state: 'IA', county: null, revision: 0 },
  { wdNumber: 'MT20250001', state: 'MT', county: null, revision: 0 },
  { wdNumber: 'AK20250001', state: 'AK', county: null, revision: 0 },
  { wdNumber: 'HI20250001', state: 'HI', county: null, revision: 0 },
  { wdNumber: 'WV20250001', state: 'WV', county: null, revision: 0 },
  { wdNumber: 'ND20250001', state: 'ND', county: null, revision: 0 },
  { wdNumber: 'SD20250001', state: 'SD', county: null, revision: 0 },
  { wdNumber: 'WY20250001', state: 'WY', county: null, revision: 0 },
  { wdNumber: 'VT20250001', state: 'VT', county: null, revision: 0 },
  { wdNumber: 'NH20250001', state: 'NH', county: null, revision: 0 },
  { wdNumber: 'ME20250001', state: 'ME', county: null, revision: 0 },
  { wdNumber: 'RI20250001', state: 'RI', county: null, revision: 0 },
  { wdNumber: 'DE20250001', state: 'DE', county: null, revision: 0 },
  { wdNumber: 'DC20250001', state: 'DC', county: null, revision: 0 },
];

export async function runWageSync(): Promise<{ fetched: number; failed: number }> {
  const db = getDb();
  const syncId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  db.insert(wageSyncMeta).values({
    id: syncId,
    startedAt,
    status: 'running',
    wdsFetched: 0,
    wdsFailed: 0,
  }).run();

  let fetched = 0;
  let failed = 0;

  for (const seed of WD_SEED_LIST) {
    try {
      // Skip if this WD still has a fresh cache entry (avoid unnecessary API calls)
      if (seed.county !== null) {
        const cached = getCachedWd(seed.state, seed.county);
        if (cached) {
          console.log(`[wdolSync] ${seed.wdNumber} — cache fresh, skipping`);
          continue;
        }
      }

      const response = await fetchWdFromSamGov(seed.wdNumber, seed.revision);
      if (!response) {
        console.warn(`[wdolSync] ${seed.wdNumber} — fetch returned null`);
        failed++;
        continue;
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const cacheExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const wdId = crypto.randomUUID();

      upsertWageDetermination({
        id: wdId,
        source: 'federal-dol',
        wdNumber: response.fullReferenceNumber,
        revisionNumber: response.revisionNumber,
        state: seed.state,
        county: seed.county,
        constructionType: null,
        publishDate: response.publishDate,
        rawDocument: response.document,
        cachedAt: nowIso,
        cacheExpiresAt,
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      if (response.document) {
        const classifications = parseWdDocument(response.document);
        upsertClassifications(wdId, classifications);
        console.log(`[wdolSync] ${seed.wdNumber} — ${classifications.length} classifications cached`);
      }

      fetched++;
    } catch (err) {
      console.error(`[wdolSync] Error syncing ${seed.wdNumber}:`, err);
      failed++;
    }
  }

  const completedAt = new Date().toISOString();
  const finalStatus = failed === 0 ? 'success' : fetched > 0 ? 'partial' : 'failed';

  db.update(wageSyncMeta)
    .set({ completedAt, status: finalStatus, wdsFetched: fetched, wdsFailed: failed })
    .where(eq(wageSyncMeta.id, syncId))
    .run();

  console.log(`[wdolSync] Complete — fetched: ${fetched}, failed: ${failed}`);
  return { fetched, failed };
}
