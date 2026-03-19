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
  { wdNumber: 'CA20250001', state: 'CA', county: 'Los Angeles', revision: 0 },
  { wdNumber: 'TX20250001', state: 'TX', county: null, revision: 0 },
  { wdNumber: 'FL20250001', state: 'FL', county: null, revision: 0 },
  { wdNumber: 'NY20250046', state: 'NY', county: 'New York', revision: 2 },
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
