import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { projects, workers, workerClassifications } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

const CreateWorkerSchema = z.object({
  name: z.string().min(1).max(200),
  ssnLast4: z.string().length(4).optional(),
  tradeUnion: z.string().max(200).optional(),
});

const CreateClassificationSchema = z.object({
  tradeCode: z.string().min(1).max(50),
  tradeDescription: z.string().min(1).max(200),
  laborType: z.enum(['journeyworker', 'apprentice', 'foreman']),
  apprenticePercent: z.number().int().min(0).max(100).optional(),
}).refine(
  (data) => data.laborType !== 'apprentice' || data.apprenticePercent !== undefined,
  { message: 'apprenticePercent is required when laborType is apprentice', path: ['apprenticePercent'] }
);

// POST /api/projects/:projectId/workers — create a worker on a project
router.post('/:projectId/workers', validate(CreateWorkerSchema), async (req, res) => {
  const projectId = req.params.projectId as string;
  const userId = req.user!.userId;
  const db = getDb();

  // Verify user owns the project
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  if (project.userId !== userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const body = req.body as z.infer<typeof CreateWorkerSchema>;
  const now = new Date().toISOString();
  const id = randomUUID();

  await db.insert(workers).values({
    id,
    projectId,
    name: body.name,
    ssnLast4: body.ssnLast4 ?? null,
    tradeUnion: body.tradeUnion ?? null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  const [worker] = await db.select().from(workers).where(eq(workers.id, id)).limit(1);
  res.status(201).json({ data: { worker } });
});

// POST /api/projects/:projectId/workers/:workerId/classifications — add classification to worker
router.post('/:projectId/workers/:workerId/classifications', validate(CreateClassificationSchema), async (req, res) => {
  const projectId = req.params.projectId as string;
  const workerId = req.params.workerId as string;
  const userId = req.user!.userId;
  const db = getDb();

  // Verify user owns the project
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  if (project.userId !== userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  // Verify worker exists and belongs to this project
  const [worker] = await db
    .select()
    .from(workers)
    .where(eq(workers.id, workerId as string))
    .limit(1);

  if (!worker || worker.projectId !== projectId) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }

  const body = req.body as z.infer<typeof CreateClassificationSchema>;
  const now = new Date().toISOString();
  const id = randomUUID();

  await db.insert(workerClassifications).values({
    id,
    workerId,
    projectId,
    tradeCode: body.tradeCode,
    tradeDescription: body.tradeDescription,
    laborType: body.laborType,
    apprenticePercent: body.apprenticePercent ?? null,
    isActive: true,
    createdAt: now,
  });

  const [classification] = await db
    .select()
    .from(workerClassifications)
    .where(eq(workerClassifications.id, id))
    .limit(1);

  res.status(201).json({ data: { classification } });
});

export default router;
