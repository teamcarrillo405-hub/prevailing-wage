/**
 * Phase 126-03: Sync orchestrator — shared by POST /api/erp-integrations/:erpType/sync
 * (manual trigger) and runErpNightlySync cron job (Phase 126-03, INTG-06).
 *
 * runSyncForConnection:
 *   1. Inserts an integration_sync_runs row with startedAt
 *   2. Sets connection.sync_status = 'running'
 *   3. Calls the no-op stub dispatch (Phase 127+ replaces with real adapter)
 *   4. On success: marks completed, resets consecutive_failure_count to 0
 *   5. On error: marks error, increments consecutive_failure_count
 *
 * NEVER uses parallel Promise execution — SQLite is single-writer (STATE.md locked decision).
 */

import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { integrationConnections, integrationSyncRuns } from '../db/schema.js';
import { logger } from '../logger.js';
import type { SyncResult } from './IErpAdapter.js';

export type SyncTrigger = 'cron' | 'manual';

export interface ConnectionRow {
  id: string;
  userId: string;
  erpType: 'procore' | 'sage300' | 'vista';
  syncStatus: 'idle' | 'running' | 'error';
  consecutiveFailureCount: number;
}

/**
 * Phase 126 stub dispatch — Phase 127+ replaces this with real adapter calls.
 * Returns a zero-row, zero-error SyncResult so the orchestrator scaffolding
 * is testable end-to-end without ERP-specific logic.
 */
async function dispatchNoop(connection: ConnectionRow): Promise<SyncResult> {
  logger.info(
    { erpType: connection.erpType, connectionId: connection.id },
    'erp-sync: stub dispatch (Phase 126)'
  );
  return { recordsSynced: 0, errors: [] };
}

export async function runSyncForConnection(
  connection: ConnectionRow,
  trigger: SyncTrigger
): Promise<{ runId: string; result: SyncResult }> {
  const db = getDb();
  const runId = randomUUID();
  const startedAt = new Date().toISOString();

  // 1. Insert sync_runs row
  await db.insert(integrationSyncRuns).values({
    id: runId,
    connectionId: connection.id,
    erpType: connection.erpType,
    startedAt,
    recordsSynced: 0,
    errorsCount: 0,
    trigger,
  });

  // 2. Mark connection as running
  await db
    .update(integrationConnections)
    .set({ syncStatus: 'running', updatedAt: startedAt })
    .where(eq(integrationConnections.id, connection.id));

  try {
    // 3. Dispatch (stub in Phase 126; real adapter in Phase 127+)
    const result = await dispatchNoop(connection);
    const completedAt = new Date().toISOString();

    // 4. Update sync_runs with completion
    await db
      .update(integrationSyncRuns)
      .set({
        completedAt,
        recordsSynced: result.recordsSynced,
        errorsCount: result.errors.length,
      })
      .where(eq(integrationSyncRuns.id, runId));

    // 5. Reset connection to idle
    await db
      .update(integrationConnections)
      .set({
        syncStatus: 'idle',
        lastSyncAt: completedAt,
        lastError: null,
        consecutiveFailureCount: 0,
        updatedAt: completedAt,
      })
      .where(eq(integrationConnections.id, connection.id));

    return { runId, result };
  } catch (err) {
    const completedAt = new Date().toISOString();
    const message = err instanceof Error ? err.message : String(err);

    await db
      .update(integrationSyncRuns)
      .set({ completedAt, errorsCount: 1, errorDetail: message })
      .where(eq(integrationSyncRuns.id, runId));

    await db
      .update(integrationConnections)
      .set({
        syncStatus: 'error',
        lastError: message,
        consecutiveFailureCount: connection.consecutiveFailureCount + 1,
        updatedAt: completedAt,
      })
      .where(eq(integrationConnections.id, connection.id));

    logger.error({ err, connectionId: connection.id }, 'erp-sync: failed');
    return { runId, result: { recordsSynced: 0, errors: [message] } };
  }
}
