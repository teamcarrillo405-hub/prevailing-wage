// src/server/routes/union.ts
import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { getDb } from '../db/index.js';
import * as schema from '../db/schema.js';
import { calculateUnionAllocation } from '../services/unionAllocation.js';
import { generateUnionAllocationPdf } from '../services/unionAllocationPdf.js';

export const unionRouter = Router();

const createTradeConfigSchema = z.object({
  tradeCode: z.string().min(1).max(50),
  tradeName: z.string().min(1).max(100),
  unionName: z.string().max(100).optional(),
  baseRate: z.number().min(0),
  fringeRate: z.number().min(0).default(0),
});

// GET /api/union/:projectId/trades — list trade configs for a project
unionRouter.get('/:projectId/trades', requireAuth, async (req, res) => {
  const { projectId } = req.params;
  const db = getDb();
  const configs = await db
    .select()
    .from(schema.unionTradeConfigs)
    .where(eq(schema.unionTradeConfigs.projectId, projectId as string));
  res.json(configs);
});

// POST /api/union/:projectId/trades — create a trade config
unionRouter.post('/:projectId/trades', requireAuth, async (req, res) => {
  const { projectId } = req.params;
  const parsed = createTradeConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const db = getDb();
  const now = new Date().toISOString();
  const newConfig = {
    id: randomUUID(),
    projectId: projectId as string,
    ...parsed.data,
    fringeRate: parsed.data.fringeRate ?? 0,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(schema.unionTradeConfigs).values(newConfig);
  res.status(201).json(newConfig);
});

// PUT /api/union/:projectId/trades/:tradeId — update a trade config
unionRouter.put('/:projectId/trades/:tradeId', requireAuth, async (req, res) => {
  const { projectId, tradeId } = req.params;
  const parsed = createTradeConfigSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const db = getDb();
  await db
    .update(schema.unionTradeConfigs)
    .set({ ...parsed.data, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(schema.unionTradeConfigs.id, tradeId as string),
        eq(schema.unionTradeConfigs.projectId, projectId as string),
      ),
    );
  res.json({ ok: true });
});

// DELETE /api/union/:projectId/trades/:tradeId — remove a trade config
unionRouter.delete('/:projectId/trades/:tradeId', requireAuth, async (req, res) => {
  const { projectId, tradeId } = req.params;
  const db = getDb();
  await db
    .delete(schema.unionTradeConfigs)
    .where(
      and(
        eq(schema.unionTradeConfigs.id, tradeId as string),
        eq(schema.unionTradeConfigs.projectId, projectId as string),
      ),
    );
  res.status(204).send();
});

// GET /api/union/:projectId/allocation — compute trade allocation result
unionRouter.get('/:projectId/allocation', requireAuth, async (req, res) => {
  const { projectId } = req.params;
  const db = getDb();
  const result = await calculateUnionAllocation(db, projectId as string);
  res.json(result);
});

// GET /api/union/:projectId/allocation/pdf — download PDF summary
unionRouter.get('/:projectId/allocation/pdf', requireAuth, async (req, res) => {
  const { projectId } = req.params;
  const db = getDb();
  const result = await calculateUnionAllocation(db, projectId as string);
  // Fetch project name for PDF header
  const [project] = await db
    .select({ name: schema.projects.name })
    .from(schema.projects)
    .where(eq(schema.projects.id, projectId as string));
  const pdfBytes = await generateUnionAllocationPdf(result, project?.name ?? (projectId as string));
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="union-allocation-${projectId}.pdf"`,
  });
  res.send(Buffer.from(pdfBytes));
});
