// src/server/routes/ot.ts
// GET /api/ot-thresholds/:projectId  — fetch project OT threshold (or null)
// POST /api/ot-thresholds/:projectId — create or update threshold for project (upsert)

import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { otThresholds } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(requireAuth);

// ── Zod Schemas ───────────────────────────────────────────────────────────

const OtThresholdSchema = z.object({
  weeklyOtThreshold: z.number().gt(0, 'weeklyOtThreshold must be > 0'),
  dailyOtThreshold: z.number().gt(0).optional().nullable(),
  dailyDtThreshold: z.number().gt(0).optional().nullable(),
  otMultiplier: z.number().gt(0).optional(),
  dtMultiplier: z.number().gt(0).optional(),
  source: z.enum(['cwhssa', 'cba', 'state']).default('cwhssa'),
});

// ── Routes ────────────────────────────────────────────────────────────────

// GET /api/ot-thresholds/:projectId
// Returns 200 { threshold } or 200 { threshold: null } if no custom threshold set
router.get('/:projectId', async (req, res) => {
  const projectId = req.params.projectId as string;
  const db = getDb();

  const rows = await db
    .select()
    .from(otThresholds)
    .where(eq(otThresholds.projectId, projectId));

  const threshold = rows[0] ?? null;
  res.json({ threshold });
});

// POST /api/ot-thresholds/:projectId
// Upsert threshold for project — creates new record or updates existing one
router.post('/:projectId', validate(OtThresholdSchema), async (req, res) => {
  const projectId = req.params.projectId as string;
  const body = req.body as z.infer<typeof OtThresholdSchema>;
  const db = getDb();
  const now = new Date().toISOString();

  // Check if a threshold already exists for this project
  const [existing] = await db
    .select()
    .from(otThresholds)
    .where(eq(otThresholds.projectId, projectId));

  if (existing) {
    // Update existing threshold
    await db
      .update(otThresholds)
      .set({
        weeklyOtThreshold: body.weeklyOtThreshold,
        dailyOtThreshold: body.dailyOtThreshold ?? null,
        dailyDtThreshold: body.dailyDtThreshold ?? null,
        otMultiplier: body.otMultiplier ?? 1.5,
        dtMultiplier: body.dtMultiplier ?? 2.0,
        source: body.source,
        updatedAt: now,
      })
      .where(eq(otThresholds.projectId, projectId));

    res.status(201).json({ id: existing.id });
  } else {
    // Create new threshold
    const id = randomUUID();
    await db.insert(otThresholds).values({
      id,
      projectId,
      weeklyOtThreshold: body.weeklyOtThreshold,
      dailyOtThreshold: body.dailyOtThreshold ?? null,
      dailyDtThreshold: body.dailyDtThreshold ?? null,
      otMultiplier: body.otMultiplier ?? 1.5,
      dtMultiplier: body.dtMultiplier ?? 2.0,
      source: body.source,
      createdAt: now,
      updatedAt: now,
    });

    res.status(201).json({ id });
  }
});

export { router as otRouter };
