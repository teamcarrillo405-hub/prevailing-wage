// src/server/jobs/webhookDelivery.ts
// API-04: SSRF protection for webhook URLs (assertNotPrivateIp)
// API-05: Delivery retry poller with exponential backoff (deliverPending)

import dns from 'node:dns';
import { createHmac } from 'node:crypto';
import { eq, and, lt } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { webhooks, webhookDeliveries } from '../db/schema.js';
import { decryptSsn } from '../services/cryptoService.js';
import { logger } from '../logger.js';

const DELIVERY_TIMEOUT_MS = 5_000;
const BASE_BACKOFF_MS = 60_000;   // 60s base (2^n * 60s)
const MAX_ATTEMPTS = 5;

/** RFC 1918 + loopback + link-local + IPv6 private range matchers */
function isPrivateIp(ip: string): boolean {
  // IPv6 loopback
  if (ip === '::1') return true;
  // IPv6 ULA fc00::/7
  if (/^fc[0-9a-f]{2}:/i.test(ip)) return true;
  if (/^fd[0-9a-f]{2}:/i.test(ip)) return true;
  // IPv6 link-local fe80::/10
  if (/^fe[89ab][0-9a-f]:/i.test(ip)) return true;

  // IPv4 checks
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4) return false; // IPv6 non-special — allow

  const [a, b] = parts;
  if (a === 10) return true;                                     // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true;             // 172.16.0.0/12
  if (a === 192 && b === 168) return true;                      // 192.168.0.0/16
  if (a === 127) return true;                                   // 127.0.0.0/8 loopback
  if (a === 0) return true;                                     // 0.0.0.0/8
  if (a === 169 && b === 254) return true;                      // 169.254.0.0/16 link-local
  return false;
}

/**
 * Throws an Error if `rawUrl` resolves to a private/loopback address.
 * Must be called before inserting a new webhook URL.
 */
export async function assertNotPrivateIp(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('URL is invalid');
  }

  const host = parsed.hostname;

  // Reject literal loopback/any-address without DNS
  if (host === 'localhost' || host === '0.0.0.0') {
    throw new Error(`URL targets a private/loopback address (${host}). SSRF not allowed.`);
  }

  // DNS resolution
  let addresses: { address: string; family: number }[];
  try {
    addresses = await dns.promises.lookup(host, { all: true });
  } catch {
    // If DNS lookup fails the URL is undeliverable; block it
    throw new Error(`URL hostname "${host}" could not be resolved. SSRF check failed.`);
  }

  for (const { address } of addresses) {
    if (isPrivateIp(address)) {
      throw new Error(
        `URL "${rawUrl}" resolves to private/loopback address ${address}. SSRF not allowed.`,
      );
    }
  }
}

/**
 * Retry poller: called every 30s from server startup.
 * Finds pending deliveries whose backoff window has elapsed and re-attempts delivery.
 */
export async function deliverPending(): Promise<void> {
  const db = getDb();

  let candidates: Array<{
    id: string;
    webhookId: string;
    event: string;
    payload: string;
    retryCount: number | null;
    failedAt: string | null;
  }>;

  try {
    candidates = await db
      .select({
        id: webhookDeliveries.id,
        webhookId: webhookDeliveries.webhookId,
        event: webhookDeliveries.event,
        payload: webhookDeliveries.payload,
        retryCount: webhookDeliveries.retryCount,
        failedAt: webhookDeliveries.failedAt,
      })
      .from(webhookDeliveries)
      .where(
        and(
          eq(webhookDeliveries.status, 'pending'),
          lt(webhookDeliveries.retryCount, MAX_ATTEMPTS),
        ),
      )
      .limit(50);
  } catch (err) {
    logger.error({ err }, 'webhookDelivery: failed to query pending deliveries');
    return;
  }

  const now = Date.now();

  for (const candidate of candidates) {
    try {
      const retryCount = candidate.retryCount ?? 0;

      // Enforce exponential backoff
      if (retryCount > 0 && candidate.failedAt) {
        const waitMs = Math.pow(2, retryCount) * BASE_BACKOFF_MS;
        const lastAttemptMs = new Date(candidate.failedAt).getTime();
        if (now - lastAttemptMs < waitMs) {
          continue; // Too soon — skip this delivery
        }
      }

      // Load webhook to get URL and secret
      const [wh] = await db
        .select({ id: webhooks.id, url: webhooks.url, secret: webhooks.secret, active: webhooks.active })
        .from(webhooks)
        .where(eq(webhooks.id, candidate.webhookId))
        .limit(1);

      if (!wh || !wh.active) {
        // Webhook deleted or disabled — mark failed
        await db
          .update(webhookDeliveries)
          .set({ status: 'failed', retryCount: MAX_ATTEMPTS, failedAt: new Date().toISOString() })
          .where(eq(webhookDeliveries.id, candidate.id));
        continue;
      }

      // Decrypt secret
      let secret: string;
      try {
        secret = decryptSsn(wh.secret);
      } catch {
        secret = wh.secret;
      }

      const signature = createHmac('sha256', secret)
        .update(candidate.payload)
        .digest('hex');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

      let statusCode: number | undefined;
      let responseBody: string | undefined;
      let succeeded = false;

      try {
        const response = await fetch(wh.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-PW-Event': candidate.event,
            'X-PW-Signature': `sha256=${signature}`,
          },
          body: candidate.payload,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        statusCode = response.status;
        responseBody = await response.text().catch(() => '');
        succeeded = response.ok;
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        responseBody = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      }

      if (succeeded) {
        await db
          .update(webhookDeliveries)
          .set({
            status: 'succeeded',
            deliveredAt: new Date().toISOString(),
            statusCode: statusCode ?? null,
            responseBody: responseBody ?? null,
          })
          .where(eq(webhookDeliveries.id, candidate.id));
      } else {
        const newRetryCount = retryCount + 1;
        const newStatus = newRetryCount >= MAX_ATTEMPTS ? 'failed' : 'pending';
        await db
          .update(webhookDeliveries)
          .set({
            status: newStatus,
            retryCount: newRetryCount,
            failedAt: new Date().toISOString(),
            statusCode: statusCode ?? null,
            responseBody: responseBody ?? null,
          })
          .where(eq(webhookDeliveries.id, candidate.id));
      }
    } catch (err) {
      logger.error({ err, deliveryId: candidate.id }, 'webhookDelivery: unexpected error processing delivery');
    }
  }
}
