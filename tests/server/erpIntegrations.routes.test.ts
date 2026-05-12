/**
 * Phase 126-03 — /api/erp-integrations route tests (INTG-07)
 *
 * Tests the GET list, POST config, and POST sync routes.
 * Uses in-memory SQLite with migration 0070 so the full DB round-trip
 * is exercised without touching the production DB.
 *
 * Auth: requireAuth is mocked to inject req.user = { userId: 'u1' } so we can
 * test the route logic without needing a real JWT cookie.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import request from 'supertest';
import express from 'express';

// Mock requireAuth so route tests don't need real JWT cookies
vi.mock('../../src/server/middleware/auth.js', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { userId: (req as any).__testUserId ?? 'u1' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
}));

// ── In-memory DB setup ───────────────────────────────────────────────────────

async function setupTestDb() {
  const Database = (await import('better-sqlite3')).default;
  const { drizzle } = await import('drizzle-orm/better-sqlite3');
  const schema = await import('../../src/server/db/schema.js');
  const sqlite = new (Database as any)(':memory:');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec('CREATE TABLE users (id text PRIMARY KEY)');
  sqlite.prepare("INSERT INTO users (id) VALUES (?)").run('u1');
  sqlite.prepare("INSERT INTO users (id) VALUES (?)").run('u2');
  const sql = readFileSync(
    resolve(__dirname, '../../src/server/db/migrations/0070_integration_foundation.sql'),
    'utf-8'
  );
  for (const stmt of sql.split('--> statement-breakpoint')) {
    const t = stmt.trim();
    if (t) sqlite.exec(t);
  }
  const db = drizzle(sqlite, { schema });
  (globalThis as any).__testDb = db;
  return { sqlite, db };
}

// ── App builder ───────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  return app;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Phase 126 — /api/erp-integrations routes (INTG-07)', () => {
  let sqlite: any;

  beforeEach(async () => {
    const setup = await setupTestDb();
    sqlite = setup.sqlite;
  });

  describe('POST /:erpType/config', () => {
    it('rejects invalid erpType with 400', async () => {
      const { erpIntegrationsRouter } = await import('../../src/server/routes/erpIntegrations.js');
      const app = buildApp();
      app.use('/api/erp-integrations', erpIntegrationsRouter);
      const res = await request(app)
        .post('/api/erp-integrations/badtype/config')
        .send({ importDir: '/tmp/exports' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid erptype/i);
    });

    it('rejects importDir containing ".." with 400', async () => {
      const { erpIntegrationsRouter } = await import('../../src/server/routes/erpIntegrations.js');
      const app = buildApp();
      app.use('/api/erp-integrations', erpIntegrationsRouter);
      const res = await request(app)
        .post('/api/erp-integrations/sage300/config')
        .send({ importDir: '../etc/passwd' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/path/i);
    });

    it('creates a new connection row when none exists', async () => {
      const { erpIntegrationsRouter } = await import('../../src/server/routes/erpIntegrations.js');
      const app = buildApp();
      app.use('/api/erp-integrations', erpIntegrationsRouter);
      const res = await request(app)
        .post('/api/erp-integrations/sage300/config')
        .send({ importDir: '/var/data/sage', exportDir: '/var/data/sage/out' });
      expect(res.status).toBe(200);
      expect(res.body.erpType).toBe('sage300');
      expect(res.body.syncStatus).toBe('idle');
      expect(res.body.filePathConfig.importDir).toBe('/var/data/sage');
    });

    it('does not expose credentialsEncrypted in response', async () => {
      const { erpIntegrationsRouter } = await import('../../src/server/routes/erpIntegrations.js');
      const app = buildApp();
      app.use('/api/erp-integrations', erpIntegrationsRouter);
      const res = await request(app)
        .post('/api/erp-integrations/vista/config')
        .send({ importDir: '/tmp/vista' });
      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty('credentialsEncrypted');
      expect(res.body).not.toHaveProperty('credentials_encrypted');
    });
  });

  describe('POST /:erpType/sync', () => {
    it('returns 404 when no connection exists', async () => {
      const { erpIntegrationsRouter } = await import('../../src/server/routes/erpIntegrations.js');
      const app = buildApp();
      app.use('/api/erp-integrations', erpIntegrationsRouter);
      const res = await request(app)
        .post('/api/erp-integrations/vista/sync');
      expect(res.status).toBe(404);
    });

    it('returns 200 with runId on successful sync', async () => {
      const now = new Date().toISOString();
      sqlite.prepare(
        "INSERT INTO integration_connections (id,user_id,erp_type,sync_status,consecutive_failure_count,connected_at,updated_at) VALUES (?,?,?,?,?,?,?)"
      ).run('c1', 'u1', 'sage300', 'idle', 0, now, now);

      const { erpIntegrationsRouter } = await import('../../src/server/routes/erpIntegrations.js');
      const app = buildApp();
      app.use('/api/erp-integrations', erpIntegrationsRouter);
      const res = await request(app)
        .post('/api/erp-integrations/sage300/sync');

      expect(res.status).toBe(200);
      expect(typeof res.body.runId).toBe('string');
      expect(res.body.recordsSynced).toBe(0);
      expect(Array.isArray(res.body.errors)).toBe(true);

      // Verify sync_runs row was written
      const run = sqlite.prepare("SELECT * FROM integration_sync_runs WHERE id=?").get(res.body.runId) as any;
      expect(run).toBeDefined();
      expect(run.trigger).toBe('manual');
    });

    it('returns 409 when sync is already running', async () => {
      const now = new Date().toISOString();
      sqlite.prepare(
        "INSERT INTO integration_connections (id,user_id,erp_type,sync_status,consecutive_failure_count,connected_at,updated_at) VALUES (?,?,?,?,?,?,?)"
      ).run('c1', 'u1', 'procore', 'running', 0, now, now);

      const { erpIntegrationsRouter } = await import('../../src/server/routes/erpIntegrations.js');
      const app = buildApp();
      app.use('/api/erp-integrations', erpIntegrationsRouter);
      const res = await request(app)
        .post('/api/erp-integrations/procore/sync');
      expect(res.status).toBe(409);
    });
  });

  describe('GET /', () => {
    it('returns connections array without credentialsEncrypted', async () => {
      const now = new Date().toISOString();
      sqlite.prepare(
        "INSERT INTO integration_connections (id,user_id,erp_type,sync_status,consecutive_failure_count,connected_at,updated_at) VALUES (?,?,?,?,?,?,?)"
      ).run('c1', 'u1', 'vista', 'idle', 0, now, now);

      const { erpIntegrationsRouter } = await import('../../src/server/routes/erpIntegrations.js');
      const app = buildApp();
      app.use('/api/erp-integrations', erpIntegrationsRouter);
      const res = await request(app).get('/api/erp-integrations');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.connections)).toBe(true);
      expect(res.body.connections.length).toBe(1);
      expect(res.body.connections[0].erpType).toBe('vista');
      expect(res.body.connections[0]).not.toHaveProperty('credentialsEncrypted');
      expect(res.body.connections[0]).not.toHaveProperty('credentials_encrypted');
    });
  });
});
