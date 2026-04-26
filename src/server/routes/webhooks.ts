// src/server/routes/webhooks.ts
// Mounted at /api/webhooks — manages webhook endpoints for the authenticated user.
// Secrets are encrypted at rest using encryptSsn (AES-256-GCM).

import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { randomBytes } from 'node:crypto';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getDb } from '../db/index.js';
import { webhooks, webhookDeliveries } from '../db/schema.js';
import { encryptSsn } from '../services/cryptoService.js';
import { deliverWebhook } from '../services/webhookService.js';

const router = Router();
router.use(requireAuth);

const VALID_EVENTS = ['payroll.submitted', 'violation.detected', '*'] as const;

const CreateWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.enum(VALID_EVENTS)).min(1),
});

const UpdateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.enum(VALID_EVENTS)).min(1).optional(),
  active: z.boolean().optional(),
});

// GET /api/webhooks — list user's webhooks
router.get('/', async (req, res) => {
  const userId = req.user!.userId;
  const db = getDb();

  const rows = await db
    .select({
      id: webhooks.id,
      url: webhooks.url,
      events: webhooks.events,
      active: webhooks.active,
      failureCount: webhooks.failureCount,
      lastDeliveredAt: webhooks.lastDeliveredAt,
      createdAt: webhooks.createdAt,
    })
    .from(webhooks)
    .where(eq(webhooks.userId, userId));

  res.json({ data: rows.map((r: typeof rows[number]) => ({ ...r, events: JSON.parse(r.events) as string[] })) });
});

// POST /api/webhooks — create a webhook
router.post('/', validate(CreateWebhookSchema), async (req, res) => {
  const userId = req.user!.userId;
  const body = req.body as z.infer<typeof CreateWebhookSchema>;
  const db = getDb();

  // Generate and encrypt HMAC signing secret
  const rawSecret = randomBytes(32).toString('hex');
  const encryptedSecret = encryptSsn(rawSecret);

  const id = randomUUID();
  const now = new Date().toISOString();

  await db.insert(webhooks).values({
    id,
    userId,
    url: body.url,
    secret: encryptedSecret,
    events: JSON.stringify(body.events),
    active: true,
    failureCount: 0,
    createdAt: now,
  });

  res.status(201).json({
    data: {
      id,
      url: body.url,
      events: body.events,
      active: true,
      failureCount: 0,
      createdAt: now,
      signingSecret: rawSecret, // shown once
    },
  });
});

// PATCH /api/webhooks/:id — update url/events/active
router.patch('/:id', validate(UpdateWebhookSchema), async (req, res) => {
  const userId = req.user!.userId;
  const webhookId = req.params['id'] as string;
  const body = req.body as z.infer<typeof UpdateWebhookSchema>;
  const db = getDb();

  const [existing] = await db
    .select({ id: webhooks.id })
    .from(webhooks)
    .where(and(eq(webhooks.id, webhookId), eq(webhooks.userId, userId)))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: 'Webhook not found' });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (body.url !== undefined) updates['url'] = body.url;
  if (body.events !== undefined) updates['events'] = JSON.stringify(body.events);
  if (body.active !== undefined) {
    updates['active'] = body.active;
    if (body.active) updates['failureCount'] = 0; // reset on re-activation
  }

  await db.update(webhooks).set(updates).where(eq(webhooks.id, webhookId));
  res.json({ message: 'Webhook updated' });
});

// DELETE /api/webhooks/:id — delete a webhook
router.delete('/:id', async (req, res) => {
  const userId = req.user!.userId;
  const webhookId = req.params['id'] as string;
  const db = getDb();

  const [existing] = await db
    .select({ id: webhooks.id })
    .from(webhooks)
    .where(and(eq(webhooks.id, webhookId), eq(webhooks.userId, userId)))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: 'Webhook not found' });
    return;
  }

  await db.delete(webhooks).where(eq(webhooks.id, webhookId));
  res.json({ message: 'Webhook deleted' });
});

// POST /api/webhooks/:id/test — send a test ping payload
router.post('/:id/test', async (req, res) => {
  const userId = req.user!.userId;
  const webhookId = req.params['id'] as string;
  const db = getDb();

  const [existing] = await db
    .select({ id: webhooks.id, url: webhooks.url })
    .from(webhooks)
    .where(and(eq(webhooks.id, webhookId), eq(webhooks.userId, userId)))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: 'Webhook not found' });
    return;
  }

  // Fire a synthetic test event
  try {
    await deliverWebhook(userId, 'webhook.test', {
      webhookId,
      message: 'This is a test delivery from PrevWage.',
      timestamp: new Date().toISOString(),
    });
    res.json({ message: 'Test ping sent' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send test ping' });
  }
});

// GET /api/webhooks/:id/deliveries — last 50 deliveries
router.get('/:id/deliveries', async (req, res) => {
  const userId = req.user!.userId;
  const webhookId = req.params['id'] as string;
  const db = getDb();

  // Verify ownership
  const [existing] = await db
    .select({ id: webhooks.id })
    .from(webhooks)
    .where(and(eq(webhooks.id, webhookId), eq(webhooks.userId, userId)))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: 'Webhook not found' });
    return;
  }

  const deliveries = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.webhookId, webhookId))
    .orderBy(desc(webhookDeliveries.deliveredAt))
    .limit(50);

  res.json({ data: deliveries });
});

export default router;
