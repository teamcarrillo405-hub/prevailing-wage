/**
 * Phase 126-03: Nightly ERP sync job — INTG-06
 *
 * Iterates all integration_connections rows SEQUENTIALLY and calls
 * runSyncForConnection for each one. No parallel execution — SQLite is
 * single-writer (STATE.md locked decision).
 *
 * Phase 127+ replaces the no-op dispatch inside syncOrchestrator with
 * real adapter calls. This file does not change when adapters are added.
 *
 * Scheduled at 2:00 AM UTC (cron job #6 inside server.listen callback).
 */

import { getDb } from '../db/index.js';
import { integrationConnections } from '../db/schema.js';
import { runSyncForConnection, type ConnectionRow } from '../integrations/syncOrchestrator.js';
import { logger } from '../logger.js';

export async function runErpNightlySync(): Promise<void> {
  const db = getDb();
  const rows = await db.select().from(integrationConnections);
  logger.info({ count: rows.length }, 'erp-sync: iterating connections');

  for (const row of rows) {
    try {
      // Skip rows already running — manual sync is in-flight, avoid double-trigger.
      if (row.syncStatus === 'running') {
        logger.warn({ id: row.id }, 'erp-sync: skipping connection already running');
        continue;
      }

      const connection: ConnectionRow = {
        id: row.id,
        userId: row.userId,
        erpType: row.erpType as 'procore' | 'sage300' | 'vista',
        syncStatus: row.syncStatus as 'idle' | 'running' | 'error',
        consecutiveFailureCount: row.consecutiveFailureCount,
      };

      await runSyncForConnection(connection, 'cron');
    } catch (err) {
      // runSyncForConnection already handles its own errors internally.
      // This catch is defense-in-depth — never rethrow from the loop body.
      logger.error({ err, connectionId: row.id }, 'erp-sync: unexpected error in nightly sync');
    }
  }
}
