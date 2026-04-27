/**
 * Integration tests for POST /api/roi-leads
 *
 * Uses the same in-memory SQLite DB created by tests/helpers/db.ts (via
 * globalThis.__testDb). Migration 0061_roi_leads.sql is run automatically
 * by the migrator in the setup file.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-32-chars-minimum-okay';
if (!process.env.CORS_ORIGIN) {
  process.env.CORS_ORIGIN = 'http://localhost:4200';
}

import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { roiLeads } from '../db/schema.js';

const ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:4200';

function post(path: string) {
  return request(app)
    .post(path)
    .set('Origin', ORIGIN)
    .set('X-Forwarded-For', '10.9.0.1'); // unique IP to avoid rate-limit collisions
}

afterEach(async () => {
  const db = (globalThis as any).__testDb;
  if (db) {
    await db.delete(roiLeads);
  }
});

describe('POST /api/roi-leads', () => {
  const VALID_PAYLOAD = {
    email: 'lead@example.com',
    projectCount: 5,
    workerCount: 20,
    estimatedSavings: 117000,
  };

  it('returns 201 with full row on valid payload', async () => {
    const res = await post('/api/roi-leads').send(VALID_PAYLOAD);
    expect(res.status).toBe(201);
    expect(res.body.email).toBe('lead@example.com');
    expect(res.body.projectCount).toBe(5);
    expect(res.body.workerCount).toBe(20);
    expect(res.body.estimatedSavings).toBe(117000);
    expect(typeof res.body.id).toBe('string');
    expect(res.body.id.length).toBeGreaterThan(0);
    expect(typeof res.body.capturedAt).toBe('string');
    // capturedAt should be a valid ISO 8601 date
    expect(() => new Date(res.body.capturedAt)).not.toThrow();
  });

  it('returns 400 when email is missing', async () => {
    const { email: _email, ...noEmail } = VALID_PAYLOAD;
    const res = await post('/api/roi-leads').send(noEmail);
    expect(res.status).toBe(400);
  });

  it('returns 400 when email is invalid format', async () => {
    const res = await post('/api/roi-leads').send({ ...VALID_PAYLOAD, email: 'notanemail' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when projectCount is negative', async () => {
    const res = await post('/api/roi-leads').send({ ...VALID_PAYLOAD, projectCount: -1 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when workerCount is missing', async () => {
    const { workerCount: _wc, ...noWorkerCount } = VALID_PAYLOAD;
    const res = await post('/api/roi-leads').send(noWorkerCount);
    expect(res.status).toBe(400);
  });

  it('persists lead to the DB on success', async () => {
    await post('/api/roi-leads').send(VALID_PAYLOAD);
    const db = (globalThis as any).__testDb;
    const rows = await db.select().from(roiLeads);
    expect(rows.length).toBe(1);
    expect(rows[0].email).toBe('lead@example.com');
  });
});
