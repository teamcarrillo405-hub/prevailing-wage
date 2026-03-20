import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { projects, workers, workerClassifications } from '../db/schema.js';
import { getCachedWd, getCachedClassifications } from '../services/wageCache.js';
import { lookupWageDetermination } from '../services/wageLookup.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

const CreateWorkerSchema = z.object({
  name: z.string().min(1).max(200),
  ssnLast4: z.string().length(4).optional(),
  tradeUnion: z.string().max(200).optional(),
  address: z.string().max(500).optional(),
});

const UpdateWorkerSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  ssnLast4: z.string().length(4).optional().nullable(),
  tradeUnion: z.string().max(200).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
});

const CreateClassificationSchema = z.object({
  tradeCode: z.string().min(1).max(50),
  tradeDescription: z.string().min(1).max(200),
  laborType: z.enum(['journeyworker', 'apprentice', 'foreman']),
  apprenticePercent: z.number().int().min(0).max(100).optional(),
  programName: z.string().max(200).optional(),
}).refine(
  (data) => data.laborType !== 'apprentice' || data.apprenticePercent !== undefined,
  { message: 'apprenticePercent is required when laborType is apprentice', path: ['apprenticePercent'] }
);

// GET /api/projects/:projectId/wage-classifications — available trades from WD for this project.
// Auto-fetches from SAM.gov if not cached — the project already knows its state + county.
router.get('/:projectId/wage-classifications', async (req, res) => {
  const projectId = req.params.projectId as string;
  const userId = req.user!.userId;
  const db = getDb();

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
  if (project.userId !== userId) { res.status(403).json({ error: 'Access denied' }); return; }

  // Try cache first, then auto-fetch from SAM.gov using the project's own state + county
  let wd = getCachedWd(project.state, project.county);
  if (!wd) {
    const fetched = await lookupWageDetermination(project.state, project.county);
    if (fetched) {
      wd = getCachedWd(project.state, project.county);
    }
  }

  if (!wd) {
    res.json({ data: { classifications: [], hasWd: false, state: project.state, county: project.county } });
    return;
  }

  const classifications = getCachedClassifications(wd.id);
  res.json({ data: { classifications, hasWd: true, wdNumber: wd.wdNumber, state: project.state, county: project.county } });
});

// GET /api/projects/:projectId/workers — list workers with classifications + live WD rates
router.get('/:projectId/workers', async (req, res) => {
  const projectId = req.params.projectId as string;
  const userId = req.user!.userId;
  const db = getDb();

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

  // Build a tradeCode → rate map from the project's wage determination
  const wd = getCachedWd(project.state, project.county);
  const rateMap = new Map<string, { baseRate: number; fringeRate: number }>();
  if (wd) {
    for (const wc of getCachedClassifications(wd.id)) {
      rateMap.set(wc.tradeCode, { baseRate: wc.baseRate, fringeRate: wc.fringeRate });
    }
  }

  const workerRows = await db
    .select()
    .from(workers)
    .where(eq(workers.projectId, projectId));

  // Attach classifications + rates to each worker
  const result = await Promise.all(
    workerRows.map(async (w) => {
      const classifications = await db
        .select()
        .from(workerClassifications)
        .where(eq(workerClassifications.workerId, w.id));
      return {
        ...w,
        classifications: classifications.map((c) => ({
          ...c,
          baseRate: rateMap.get(c.tradeCode)?.baseRate ?? null,
          fringeRate: rateMap.get(c.tradeCode)?.fringeRate ?? null,
        })),
      };
    }),
  );

  res.json({ data: { workers: result } });
});

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
    address: body.address ?? null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  const [worker] = await db.select().from(workers).where(eq(workers.id, id)).limit(1);
  res.status(201).json({ data: { worker } });
});

// PUT /api/projects/:projectId/workers/:workerId — update worker profile
router.put('/:projectId/workers/:workerId', validate(UpdateWorkerSchema), async (req, res) => {
  const { projectId, workerId } = req.params as { projectId: string; workerId: string };
  const userId = req.user!.userId;
  const db = getDb();

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
  if (project.userId !== userId) { res.status(403).json({ error: 'Access denied' }); return; }

  const [worker] = await db.select().from(workers).where(eq(workers.id, workerId)).limit(1);
  if (!worker || worker.projectId !== projectId) { res.status(404).json({ error: 'Worker not found' }); return; }

  const body = req.body as z.infer<typeof UpdateWorkerSchema>;
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updatedAt: now };
  if (body.name !== undefined) updates.name = body.name;
  if ('ssnLast4' in body) updates.ssnLast4 = body.ssnLast4 ?? null;
  if ('tradeUnion' in body) updates.tradeUnion = body.tradeUnion ?? null;
  if ('address' in body) updates.address = body.address ?? null;

  await db.update(workers).set(updates).where(eq(workers.id, workerId));
  const [updated] = await db.select().from(workers).where(eq(workers.id, workerId)).limit(1);
  res.json({ data: { worker: updated } });
});

// DELETE /api/projects/:projectId/workers/:workerId — remove worker (cascades classifications)
router.delete('/:projectId/workers/:workerId', async (req, res) => {
  const { projectId, workerId } = req.params as { projectId: string; workerId: string };
  const userId = req.user!.userId;
  const db = getDb();

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
  if (project.userId !== userId) { res.status(403).json({ error: 'Access denied' }); return; }

  const [worker] = await db.select().from(workers).where(eq(workers.id, workerId)).limit(1);
  if (!worker || worker.projectId !== projectId) { res.status(404).json({ error: 'Worker not found' }); return; }

  await db.delete(workers).where(eq(workers.id, workerId));
  res.json({ data: { deleted: true } });
});

// DELETE /api/projects/:projectId/workers/:workerId/classifications/:classificationId
router.delete('/:projectId/workers/:workerId/classifications/:classificationId', async (req, res) => {
  const { projectId, workerId, classificationId } = req.params as { projectId: string; workerId: string; classificationId: string };
  const userId = req.user!.userId;
  const db = getDb();

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
  if (project.userId !== userId) { res.status(403).json({ error: 'Access denied' }); return; }

  const [cls] = await db.select().from(workerClassifications)
    .where(and(eq(workerClassifications.id, classificationId), eq(workerClassifications.workerId, workerId)))
    .limit(1);
  if (!cls) { res.status(404).json({ error: 'Classification not found' }); return; }

  await db.delete(workerClassifications).where(eq(workerClassifications.id, classificationId));
  res.json({ data: { deleted: true } });
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
    programName: body.programName ?? null,
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
