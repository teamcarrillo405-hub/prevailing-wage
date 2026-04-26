// src/server/services/webhookService.ts
// Webhook delivery service — finds active webhooks for a user+event and POSTs to each.
// Tracks delivery outcomes and deactivates endpoints with >5 consecutive failures.

import { createHmac, randomUUID } from 'node:crypto';

// ── Event constants ──────────────────────────────────────────────────────────
// Original 2 events
export const WEBHOOK_EVENT_PAYROLL_SUBMITTED = 'payroll.submitted';
export const WEBHOOK_EVENT_VIOLATION_DETECTED = 'violation.detected';

// New events (Fix 3)
export const WEBHOOK_EVENT_WORKER_ADDED = 'worker.added';
export const WEBHOOK_EVENT_PAYROLL_WEEK_CREATED = 'payroll.week.created';
export const WEBHOOK_EVENT_CPR_SUBMITTED = 'cpr.submitted';
export const WEBHOOK_EVENT_SUBCONTRACTOR_CPR_RECEIVED = 'subcontractor.cpr.received';
export const WEBHOOK_EVENT_COMPLIANCE_CLEARED = 'compliance.cleared';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { webhooks, webhookDeliveries } from '../db/schema.js';
import { decryptSsn } from './cryptoService.js';
import { logger } from '../logger.js';

const DELIVERY_TIMEOUT_MS = 5_000;

export async function deliverWebhook(
  userId: string,
  event: string,
  payload: object,
): Promise<void> {
  const db = getDb();

  // 1. Find active webhooks for this user that subscribe to this event
  const activeWebhooks = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.userId, userId), eq(webhooks.active, true)));

  const subscribedWebhooks = activeWebhooks.filter((wh: typeof activeWebhooks[number]) => {
    try {
      const events = JSON.parse(wh.events) as string[];
      return events.includes(event) || events.includes('*');
    } catch {
      return false;
    }
  });

  if (subscribedWebhooks.length === 0) return;

  const payloadJson = JSON.stringify(payload);
  const deliveryId = randomUUID();

  for (const wh of subscribedWebhooks) {
    const deliveryRowId = randomUUID();
    let statusCode: number | undefined;
    let responseBody: string | undefined;
    let deliveredAt: string | undefined;
    let failedAt: string | undefined;

    try {
      // Decrypt the stored secret
      let secret: string;
      try {
        secret = decryptSsn(wh.secret);
      } catch {
        secret = wh.secret; // fallback if stored unencrypted (migration edge case)
      }

      const signature = createHmac('sha256', secret)
        .update(payloadJson)
        .digest('hex');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

      try {
        const response = await fetch(wh.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-PW-Event': event,
            'X-PW-Signature': `sha256=${signature}`,
            'X-PW-Delivery': deliveryId,
          },
          body: payloadJson,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        statusCode = response.status;
        responseBody = await response.text().catch(() => '');

        if (response.ok) {
          deliveredAt = new Date().toISOString();
          // Reset failure count on success
          await db
            .update(webhooks)
            .set({ failureCount: 0, lastDeliveredAt: deliveredAt })
            .where(eq(webhooks.id, wh.id));
        } else {
          failedAt = new Date().toISOString();
          await incrementFailureCount(wh.id, wh.failureCount ?? 0);
        }
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        failedAt = new Date().toISOString();
        responseBody = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
        await incrementFailureCount(wh.id, wh.failureCount ?? 0);
      }
    } catch (err) {
      failedAt = new Date().toISOString();
      responseBody = err instanceof Error ? err.message : String(err);
      logger.error({ err, webhookId: wh.id }, 'webhookService: unexpected error');
    }

    // 3. Record the delivery attempt
    try {
      await db.insert(webhookDeliveries).values({
        id: deliveryRowId,
        webhookId: wh.id,
        event,
        payload: payloadJson,
        statusCode: statusCode ?? null,
        responseBody: responseBody ?? null,
        deliveredAt: deliveredAt ?? null,
        failedAt: failedAt ?? null,
        retryCount: 0,
      });
    } catch (insertErr) {
      logger.error({ err: insertErr, webhookId: wh.id }, 'webhookService: failed to record delivery');
    }
  }
}

async function incrementFailureCount(webhookId: string, currentCount: number): Promise<void> {
  const db = getDb();
  const newCount = currentCount + 1;
  if (newCount > 5) {
    await db
      .update(webhooks)
      .set({ failureCount: newCount, active: false })
      .where(eq(webhooks.id, webhookId));
  } else {
    await db
      .update(webhooks)
      .set({ failureCount: newCount })
      .where(eq(webhooks.id, webhookId));
  }
}
