// src/server/routes/gsa.ts
import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { getDb } from '../db/index.js';
import * as schema from '../db/schema.js';
import { calculateGsaRate } from '../services/gsaRateBuilder.js';

export const gsaRouter = Router();

const gsaRateSchema = z.object({
  name: z.string().min(1).max(100),
  baseRate: z.number().min(0),
  fringeRate: z.number().min(0).default(0),
  overheadPct: z.number().min(0).max(200),
  gaPct: z.number().min(0).max(200),
  profitPct: z.number().min(0).max(100),
});

// GET /api/gsa/:projectId/rates — list saved GSA rates
gsaRouter.get('/:projectId/rates', requireAuth, async (req, res) => {
  const { projectId } = req.params;
  const db = getDb();
  const rates = await db
    .select()
    .from(schema.gsaRates)
    .where(eq(schema.gsaRates.projectId, projectId as string));
  res.json(rates);
});

// POST /api/gsa/:projectId/rates — create a new GSA rate config
gsaRouter.post('/:projectId/rates', requireAuth, async (req, res) => {
  const { projectId } = req.params;
  const parsed = gsaRateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { billableRate } = calculateGsaRate(parsed.data);
  const db = getDb();
  const now = new Date().toISOString();
  const newRate = {
    id: randomUUID(),
    projectId: projectId as string,
    ...parsed.data,
    fringeRate: parsed.data.fringeRate ?? 0,
    billableRate,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(schema.gsaRates).values(newRate);
  res.status(201).json(newRate);
});

// PUT /api/gsa/:projectId/rates/:rateId — update a GSA rate config
gsaRouter.put('/:projectId/rates/:rateId', requireAuth, async (req, res) => {
  const { projectId, rateId } = req.params;
  const parsed = gsaRateSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  // Recompute billableRate if any rate component changed
  // Fetch existing record first so we can merge partial updates
  const db = getDb();
  const [existing] = await db
    .select()
    .from(schema.gsaRates)
    .where(and(eq(schema.gsaRates.id, rateId as string), eq(schema.gsaRates.projectId, projectId as string)));
  if (!existing) {
    res.status(404).json({ error: 'Rate not found' });
    return;
  }
  const merged = { ...existing, ...parsed.data };
  const { billableRate } = calculateGsaRate(merged);
  await db
    .update(schema.gsaRates)
    .set({ ...parsed.data, billableRate, updatedAt: new Date().toISOString() })
    .where(and(eq(schema.gsaRates.id, rateId as string), eq(schema.gsaRates.projectId, projectId as string)));
  res.json({ ok: true, billableRate });
});

// DELETE /api/gsa/:projectId/rates/:rateId
gsaRouter.delete('/:projectId/rates/:rateId', requireAuth, async (req, res) => {
  const { projectId, rateId } = req.params;
  const db = getDb();
  await db
    .delete(schema.gsaRates)
    .where(and(eq(schema.gsaRates.id, rateId as string), eq(schema.gsaRates.projectId, projectId as string)));
  res.status(204).send();
});
