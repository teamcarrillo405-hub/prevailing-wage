/**
 * Phase 126-03: ERP integrations router (INTG-07)
 * Mounted at /api/erp-integrations in src/server/index.ts
 *
 * Routes:
 *   GET  /                   — list user's integration_connections (credentials_encrypted OMITTED)
 *   POST /:erpType/config    — upsert file_path_config (importDir + exportDir)
 *   POST /:erpType/sync      — trigger manual sync via syncOrchestrator
 *
 * Security:
 *   - credentials_encrypted is NEVER returned in any response (SEC-02)
 *   - importDir/exportDir validated against path injection (no '..' or NUL bytes)
 *   - All routes require requireAuth middleware
 *
 * SQLite writes are sequential (no Promise.all) per STATE.md locked decision.
 */

import { Router } from 'express';
import { randomUUID } from 'crypto';
import { normalize } from 'path';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { getDb } from '../db/index.js';
import type { InferSelectModel } from 'drizzle-orm';
import { integrationConnections } from '../db/schema.js';

type IntegrationConnection = InferSelectModel<typeof integrationConnections>;
import { runSyncForConnection, type ConnectionRow } from '../integrations/syncOrchestrator.js';
import { logger } from '../logger.js';

const ALLOWED_ERPS = ['procore', 'sage300', 'vista'] as const;
type ErpType = (typeof ALLOWED_ERPS)[number];

export const erpIntegrationsRouter = Router();

/**
 * Path injection guard — rejects paths containing '..' or NUL bytes.
 * Uses path.normalize() to resolve relative components before checking.
 */
function isValidPath(p: string): boolean {
  if (!p || typeof p !== 'string') return false;
  if (p.includes('\u0000')) return false;
  const normalized = normalize(p);
  if (normalized.includes('..')) return false;
  return true;
}

// ── GET / — list authenticated user's integration connections ────────────────
erpIntegrationsRouter.get('/', requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const db = getDb();
  const rows = await db
    .select()
    .from(integrationConnections)
    .where(eq(integrationConnections.userId, userId));

  const connections = rows.map((r: IntegrationConnection) => ({
    id: r.id,
    erpType: r.erpType,
    syncStatus: r.syncStatus,
    lastSyncAt: r.lastSyncAt,
    lastError: r.lastError,
    filePathConfig: r.filePathConfig ? (JSON.parse(r.filePathConfig) as unknown) : null,
    connectedAt: r.connectedAt,
    updatedAt: r.updatedAt,
    consecutiveFailureCount: r.consecutiveFailureCount,
    // credentials_encrypted INTENTIONALLY OMITTED (SEC-02)
  }));

  res.json({ connections });
});

// ── POST /:erpType/config — upsert file path config ──────────────────────────
erpIntegrationsRouter.post('/:erpType/config', requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const { erpType } = req.params;

  if (!ALLOWED_ERPS.includes(erpType as ErpType)) {
    res.status(400).json({ error: 'Invalid erpType' });
    return;
  }

  const { importDir, exportDir } = (req.body ?? {}) as { importDir?: string; exportDir?: string };

  if (importDir != null && !isValidPath(importDir)) {
    res.status(400).json({ error: 'Invalid importDir path' });
    return;
  }
  if (exportDir != null && !isValidPath(exportDir)) {
    res.status(400).json({ error: 'Invalid exportDir path' });
    return;
  }

  const db = getDb();
  const now = new Date().toISOString();
  const filePathConfig = JSON.stringify({
    importDir: importDir ?? null,
    exportDir: exportDir ?? null,
  });

  const existing = await db
    .select()
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.userId, userId),
        eq(integrationConnections.erpType, erpType as ErpType)
      )
    )
    .limit(1);

  if (existing.length === 0) {
    const id = randomUUID();
    await db.insert(integrationConnections).values({
      id,
      userId,
      erpType: erpType as ErpType,
      filePathConfig,
      syncStatus: 'idle',
      consecutiveFailureCount: 0,
      connectedAt: now,
      updatedAt: now,
    });
    logger.info({ userId, erpType, id }, 'erp-config: new connection created');
    res.json({
      id,
      erpType,
      filePathConfig: JSON.parse(filePathConfig) as unknown,
      syncStatus: 'idle',
    });
    return;
  }

  await db
    .update(integrationConnections)
    .set({ filePathConfig, updatedAt: now })
    .where(eq(integrationConnections.id, existing[0].id));

  logger.info({ userId, erpType, id: existing[0].id }, 'erp-config: connection updated');
  res.json({
    id: existing[0].id,
    erpType,
    filePathConfig: JSON.parse(filePathConfig) as unknown,
    syncStatus: existing[0].syncStatus,
  });
});

// ── POST /:erpType/sync — trigger manual sync ────────────────────────────────
erpIntegrationsRouter.post('/:erpType/sync', requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const { erpType } = req.params;

  if (!ALLOWED_ERPS.includes(erpType as ErpType)) {
    res.status(400).json({ error: 'Invalid erpType' });
    return;
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.userId, userId),
        eq(integrationConnections.erpType, erpType as ErpType)
      )
    )
    .limit(1);

  if (rows.length === 0) {
    res.status(404).json({ error: 'No connection configured for this ERP' });
    return;
  }

  const conn = rows[0];
  if (conn.syncStatus === 'running') {
    res.status(409).json({ error: 'Sync already in progress' });
    return;
  }

  const connection: ConnectionRow = {
    id: conn.id,
    userId: conn.userId,
    erpType: conn.erpType as ErpType,
    syncStatus: conn.syncStatus as 'idle' | 'running' | 'error',
    consecutiveFailureCount: conn.consecutiveFailureCount,
  };

  const { runId, result } = await runSyncForConnection(connection, 'manual');
  res.json({ runId, recordsSynced: result.recordsSynced, errors: result.errors });
});
