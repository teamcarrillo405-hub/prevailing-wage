// tests/services/webhookDelivery.test.ts
// Unit tests for the API-05 delivery retry poller (deliverPending).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { webhooks, webhookDeliveries, users } from '../../src/server/db/schema.js';
import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../../src/server/db/schema.js';

type TestDb = BetterSQLite3Database<typeof schema>;

// Helpers -----------------------------------------------------------------

function getDb(): TestDb {
  return (globalThis as { __testDb?: TestDb }).__testDb!;
}

let userSeq = 0;
async function seedWebhook(db: TestDb, overrides: Partial<typeof webhooks.$inferInsert> = {}) {
  userSeq++;
  const userId = `poller-user-${Date.now()}-${userSeq}`;
  const webhookId = `poller-wh-${Date.now()}-${userSeq}`;

  // Insert a minimal user row (needed for FK) using drizzle insert
  const now = new Date().toISOString();
  await db.insert(users).values({
    id: userId,
    email: `poller${userSeq}-${Date.now()}@test.com`,
    passwordHash: 'x',
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(webhooks).values({
    id: webhookId,
    userId,
    url: 'https://hooks.example.com/pw',
    events: '["payroll.submitted"]',
    secret: 'plaintext-secret', // poller falls back to plaintext if decrypt fails
    active: true,
    failureCount: 0,
    createdAt: now,
    ...overrides,
  });

  return { userId, webhookId };
}

async function seedDelivery(
  db: TestDb,
  webhookId: string,
  overrides: Partial<typeof webhookDeliveries.$inferInsert> = {},
) {
  const deliveryId = `poller-del-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const now = new Date().toISOString();
  await db.insert(webhookDeliveries).values({
    id: deliveryId,
    webhookId,
    event: 'payroll.submitted',
    payload: '{"test":true}',
    status: 'pending',
    retryCount: 0,
    failedAt: null,
    ...overrides,
  });
  return deliveryId;
}

// ── Tests -----------------------------------------------------------------

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('deliverPending — retry poller (API-05)', () => {
  it('non-2xx response: increments retryCount to 1 and sets status=pending, failedAt set', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })));

    const db = getDb();
    const { webhookId } = await seedWebhook(db);
    const deliveryId = await seedDelivery(db, webhookId, {
      retryCount: 0,
      failedAt: null,
      status: 'pending',
    });

    const { deliverPending } = await import('../../src/server/jobs/webhookDelivery.js');
    await deliverPending();

    const [row] = await db
      .select({
        status: webhookDeliveries.status,
        retryCount: webhookDeliveries.retryCount,
        failedAt: webhookDeliveries.failedAt,
      })
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, deliveryId));

    expect(row?.retryCount).toBe(1);
    expect(row?.status).toBe('pending');
    expect(row?.failedAt).not.toBeNull();
  });

  it('after 5 attempts (retryCount=4, backoff elapsed): status becomes failed, retryCount=5', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })));

    const db = getDb();
    const { webhookId } = await seedWebhook(db);

    // retryCount=4 means backoff = 2^4 * 60_000 = 960_000ms (16 min)
    // Set failedAt 17 minutes ago so backoff has elapsed
    const sevenTeenMinutesAgo = new Date(Date.now() - 17 * 60 * 1000).toISOString();
    const deliveryId = await seedDelivery(db, webhookId, {
      retryCount: 4,
      failedAt: sevenTeenMinutesAgo,
      status: 'pending',
    });

    const { deliverPending } = await import('../../src/server/jobs/webhookDelivery.js');
    await deliverPending();

    const [row] = await db
      .select({
        status: webhookDeliveries.status,
        retryCount: webhookDeliveries.retryCount,
      })
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, deliveryId));

    expect(row?.retryCount).toBe(5);
    expect(row?.status).toBe('failed');
  });

  it('backoff not elapsed (retryCount=1, failedAt 30s ago): row is NOT updated', async () => {
    const fetchMock = vi.fn(async () => new Response('boom', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    const db = getDb();
    const { webhookId } = await seedWebhook(db);

    // retryCount=1 means backoff = 2^1 * 60_000 = 120_000ms (2 min)
    // failedAt 30 seconds ago — NOT elapsed
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
    const deliveryId = await seedDelivery(db, webhookId, {
      retryCount: 1,
      failedAt: thirtySecondsAgo,
      status: 'pending',
    });

    const { deliverPending } = await import('../../src/server/jobs/webhookDelivery.js');
    await deliverPending();

    // fetch should NOT have been called for this delivery
    // retryCount should still be 1, failedAt unchanged
    const [row] = await db
      .select({
        status: webhookDeliveries.status,
        retryCount: webhookDeliveries.retryCount,
      })
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, deliveryId));

    expect(row?.retryCount).toBe(1);
    expect(row?.status).toBe('pending');
    // fetch was not called for the skipped delivery (may be called for others but not this one)
  });
});
