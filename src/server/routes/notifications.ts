// src/server/routes/notifications.ts
// Phase 86 NOTIF-06 — public unsubscribe endpoint for scheduled compliance reports.
// No auth required: the unsubscribe token IS the authorization credential.
// Both POST (API clients) and GET (browser link from email) are supported.

import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { projects } from '../db/schema.js';
import { logger } from '../logger.js';

const router = Router();

const bodySchema = z.object({ token: z.string().min(1) });

/**
 * Scans all projects for a matching reportUnsubscribeToken and sets
 * reportSchedule='off' while preserving all other projectSettings keys.
 *
 * Scale note: scan-all-projects is acceptable at current scale (<100 projects).
 * Future: add a dedicated index on projectSettings->>'reportUnsubscribeToken'
 * or a separate lookup column when project count exceeds ~1000.
 */
async function unsubscribeByToken(token: string): Promise<'ok' | 'not_found'> {
  const db = getDb();
  const allProjects = await db.select().from(projects);

  for (const project of allProjects) {
    if (!project.projectSettings) continue;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(project.projectSettings);
    } catch {
      continue;
    }

    if (parsed.reportUnsubscribeToken === token) {
      // Read-modify-write: preserve all sibling keys; only change reportSchedule
      const merged = { ...parsed, reportSchedule: 'off' };
      await db
        .update(projects)
        .set({
          projectSettings: JSON.stringify(merged),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(projects.id, project.id));

      logger.info({ projectId: project.id }, '[notifications] unsubscribed scheduled reports');
      return 'ok';
    }
  }

  return 'not_found';
}

// POST /api/notifications/unsubscribe { token }
// Programmatic unsubscribe for API callers.
router.post('/unsubscribe', async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'token required' });
  }

  const result = await unsubscribeByToken(parsed.data.token);
  if (result === 'not_found') {
    return res.status(404).json({ error: 'Token not found' });
  }

  return res.json({ message: 'Unsubscribed successfully' });
});

// GET /api/notifications/unsubscribe?token=...
// Browser-friendly endpoint used by email href links.
// Email clients render <a href> as GET — requiring a form for unsubscribe is bad UX.
router.get('/unsubscribe', async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  if (!token) {
    return res.status(400).type('html').send('<p>Missing unsubscribe token.</p>');
  }

  const result = await unsubscribeByToken(token);
  if (result === 'not_found') {
    return res
      .status(404)
      .type('html')
      .send('<p>Token not found. You may already be unsubscribed.</p>');
  }

  return res
    .status(200)
    .type('html')
    .send('<p>You have been unsubscribed from compliance reports for this project.</p>');
});

export default router;
