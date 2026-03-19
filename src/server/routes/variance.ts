// src/server/routes/variance.ts
import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { getDb } from '../db/index.js';
import * as schema from '../db/schema.js';
import { calculateVarianceReport } from '../services/varianceService.js';
import { generateVariancePdf } from '../services/variancePdf.js';

export const varianceRouter = Router();

const budgetSchema = z.object({
  bidAmount: z.number().min(0).optional(),
  workingBudget: z.number().min(0.01),
  totalWeeks: z.number().int().min(1),
  varianceThresholdPct: z.number().min(0).max(100).default(10),
});

// GET /api/variance/:projectId/report — compute and return variance report
varianceRouter.get('/:projectId/report', requireAuth, async (req, res) => {
  const { projectId } = req.params;
  const db = getDb();
  const report = await calculateVarianceReport(db, projectId as string);
  if (!report) {
    res.status(404).json({ error: 'No budget configured for this project. Set a budget first.' });
    return;
  }
  res.json(report);
});

// GET /api/variance/:projectId/report/pdf — download PDF
varianceRouter.get('/:projectId/report/pdf', requireAuth, async (req, res) => {
  const { projectId } = req.params;
  const db = getDb();
  const report = await calculateVarianceReport(db, projectId as string);
  if (!report) {
    res.status(404).json({ error: 'No budget configured for this project.' });
    return;
  }
  const [project] = await db
    .select({ name: schema.projects.name })
    .from(schema.projects)
    .where(eq(schema.projects.id, projectId as string));
  const pdfBytes = await generateVariancePdf(report, project?.name ?? (projectId as string));
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="variance-report-${projectId}.pdf"`,
  });
  res.send(Buffer.from(pdfBytes));
});

// POST /api/variance/:projectId/budget — create or replace budget config
varianceRouter.post('/:projectId/budget', requireAuth, async (req, res) => {
  const { projectId } = req.params;
  const parsed = budgetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const db = getDb();
  const now = new Date().toISOString();
  // Upsert pattern: delete existing then insert (SQLite)
  await db.delete(schema.projectBudgets).where(eq(schema.projectBudgets.projectId, projectId as string));
  const newBudget = {
    id: randomUUID(),
    projectId: projectId as string,
    bidAmount: parsed.data.bidAmount ?? null,
    workingBudget: parsed.data.workingBudget,
    totalWeeks: parsed.data.totalWeeks,
    varianceThresholdPct: parsed.data.varianceThresholdPct ?? 10,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(schema.projectBudgets).values(newBudget);
  res.status(201).json(newBudget);
});

// PUT /api/variance/:projectId/budget — update budget config
varianceRouter.put('/:projectId/budget', requireAuth, async (req, res) => {
  const { projectId } = req.params;
  const parsed = budgetSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const db = getDb();
  await db
    .update(schema.projectBudgets)
    .set({ ...parsed.data, updatedAt: new Date().toISOString() })
    .where(eq(schema.projectBudgets.projectId, projectId as string));
  res.json({ ok: true });
});

// GET /api/variance/:projectId/budget — get budget config
varianceRouter.get('/:projectId/budget', requireAuth, async (req, res) => {
  const { projectId } = req.params;
  const db = getDb();
  const [budget] = await db
    .select()
    .from(schema.projectBudgets)
    .where(eq(schema.projectBudgets.projectId, projectId as string));
  if (!budget) {
    res.status(404).json({ error: 'No budget configured.' });
    return;
  }
  res.json(budget);
});
