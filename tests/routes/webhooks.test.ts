// tests/routes/webhooks.test.ts
// API-04 (SSRF protection) and API-05 (manual retry) route tests.

import { describe, it, expect, beforeAll, vi } from 'vitest';
import supertest from 'supertest';
import { app } from '../../src/server/index.js';
import { webhooks, webhookDeliveries } from '../../src/server/db/schema.js';
import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../../src/server/db/schema.js';

type TestDb = BetterSQLite3Database<typeof schema>;

async function registerUser(email: string, password = 'password123') {
  const res = await supertest(app)
    .post('/api/auth/register')
    .send({ email, password });
  const cookies = res.headers['set-cookie'] as string[] | string;
  return Array.isArray(cookies) ? cookies.join('; ') : cookies;
}

async function getUserId(cookie: string): Promise<string> {
  const res = await supertest(app).get('/api/auth/me').set('Cookie', cookie);
  return res.body.data?.user?.id as string;
}

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

// ── API-04: SSRF protection ──────────────────────────────────────────────────

describe('POST /api/webhooks — SSRF protection (API-04)', () => {
  it('rejects private IP 10.x.x.x with 422', async () => {
    const cookie = await registerUser(`ssrf-rfc1918-${Date.now()}@test.com`);
    const res = await supertest(app)
      .post('/api/webhooks')
      .set('Cookie', cookie)
      .send({ url: 'http://10.0.0.5/hook', events: ['payroll.submitted'] });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/private|loopback|SSRF/i);
  });

  it('rejects localhost with 422', async () => {
    const cookie = await registerUser(`ssrf-localhost-${Date.now()}@test.com`);
    const res = await supertest(app)
      .post('/api/webhooks')
      .set('Cookie', cookie)
      .send({ url: 'http://localhost/hook', events: ['payroll.submitted'] });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/private|loopback|SSRF/i);
  });

  it('accepts a public HTTPS URL with 201 (dns stubbed)', async () => {
    // Stub dns.promises.lookup to return a public IP (93.184.216.34 = example.com)
    const dnsModule = await import('node:dns');
    const lookupSpy = vi
      .spyOn(dnsModule.promises, 'lookup')
      .mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never);

    // Stub fetch so no real outbound call is made
    vi.stubGlobal('fetch', vi.fn(async () => new Response('ok', { status: 200 })));

    const cookie = await registerUser(`ssrf-public-${Date.now()}@test.com`);
    const res = await supertest(app)
      .post('/api/webhooks')
      .set('Cookie', cookie)
      .send({ url: 'https://hooks.example.com/pw', events: ['payroll.submitted'] });
    expect(res.status).toBe(201);
    expect(res.body.data?.id).toBeDefined();

    lookupSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});

// ── API-05: Manual delivery retry ────────────────────────────────────────────

describe('POST /api/webhooks/:id/deliveries/:deliveryId/retry (API-05)', () => {
  it('requeues a failed delivery — status=pending, retryCount=0', async () => {
    const ts = Date.now();
    const cookie = await registerUser(`retry-test-${ts}@test.com`);
    const userId = await getUserId(cookie);

    const db = (globalThis as { __testDb?: TestDb }).__testDb!;

    const webhookId = `test-wh-retry-${ts}`;
    const deliveryId = `test-del-retry-${ts}`;

    // Seed webhook owned by the test user
    await db.insert(webhooks).values({
      id: webhookId,
      userId,
      url: 'https://hooks.example.com/pw',
      events: '["payroll.submitted"]',
      secret: 'test-secret',
      active: true,
      failureCount: 0,
      createdAt: new Date().toISOString(),
    });

    // Seed a failed delivery
    await db.insert(webhookDeliveries).values({
      id: deliveryId,
      webhookId,
      event: 'payroll.submitted',
      payload: '{}',
      status: 'failed',
      retryCount: 5,
      failedAt: new Date().toISOString(),
    });

    const res = await supertest(app)
      .post(`/api/webhooks/${webhookId}/deliveries/${deliveryId}/retry`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/requeued/i);

    // Verify DB row was reset
    const [row] = await db
      .select({ status: webhookDeliveries.status, retryCount: webhookDeliveries.retryCount })
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, deliveryId));

    expect(row?.status).toBe('pending');
    expect(row?.retryCount).toBe(0);
  });
});
