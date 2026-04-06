import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { workers, workerClassifications } from '../db/schema.js';
import { getCachedWd, getCachedClassifications } from '../services/wageCache.js';
import { lookupWageDetermination } from '../services/wageLookup.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { assertProjectAccess } from '../utils/assertProjectAccess.js';
import type { Project } from '../utils/assertProjectAccess.js';
import { createWorker, updateWorker, deleteWorker } from '../services/workerService.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

const CreateWorkerSchema = z.object({
  name: z.string().min(1).max(200),
  ssn: z.string().length(9).regex(/^\d{9}$/, 'SSN must contain only digits').optional(),
  tradeUnion: z.string().max(200).optional(),
  // Phase 39 — structured address fields (address removed; use structured fields)
  addressStreet: z.string().max(500).optional(),
  addressCity: z.string().max(200).optional(),
  addressState: z.string().max(50).optional(),
  addressZip: z.string().max(20).optional(),
  unionLocal: z.string().max(200).optional(),
  unionBookNumber: z.string().max(100).optional(),
  apprenticeshipCommittee: z.string().max(200).optional(),
  apprenticeshipRegNumber: z.string().max(100).optional(),
  // Phase 40 — NY registered apprentice flag
  nysRegisteredApprentice: z.boolean().optional().default(false),
  // Phase 42 — IL compliance demographics
  race: z.string().max(100).optional(),
  ethnicity: z.string().max(100).optional(),
  gender: z.string().max(100).optional(),
  veteranStatus: z.string().max(100).optional(),
  skillLevel: z.enum(['journeyman', 'apprentice']).optional(),
});

const UpdateWorkerSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  ssn: z.string().length(9).regex(/^\d{9}$/, 'SSN must contain only digits').optional().nullable(),
  tradeUnion: z.string().max(200).optional().nullable(),
  // Phase 39 — structured address fields (address removed; use structured fields)
  addressStreet: z.string().max(500).optional().nullable(),
  addressCity: z.string().max(200).optional().nullable(),
  addressState: z.string().max(50).optional().nullable(),
  addressZip: z.string().max(20).optional().nullable(),
  unionLocal: z.string().max(200).optional().nullable(),
  unionBookNumber: z.string().max(100).optional().nullable(),
  apprenticeshipCommittee: z.string().max(200).optional().nullable(),
  apprenticeshipRegNumber: z.string().max(100).optional().nullable(),
  // Phase 40 — NY registered apprentice flag
  nysRegisteredApprentice: z.boolean().optional(),
  // Phase 42 — IL compliance demographics
  race: z.string().max(100).optional().nullable(),
  ethnicity: z.string().max(100).optional().nullable(),
  gender: z.string().max(100).optional().nullable(),
  veteranStatus: z.string().max(100).optional().nullable(),
  skillLevel: z.enum(['journeyman', 'apprentice']).optional().nullable(),
});

const CreateClassificationSchema = z.object({
  tradeCode: z.string().min(1).max(50),
  tradeDescription: z.string().min(1).max(200),
  laborType: z.enum(['journeyworker', 'apprentice', 'foreman']),
  apprenticePercent: z.number().int().min(0).max(100).optional(),
  programName: z.string().max(200).optional(),
  // Phase 25 — WA manual prevailing wage rate (SAM.gov not used for WA state projects)
  waManualRate: z.number().positive().optional(),
  // Phase 25 — WA-specific 4-letter trade code override for F700-065-000
  waTradeCode: z.string().max(10).optional(),
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

  let project: Project;
  try {
    project = await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

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

  let project: Project;
  try {
    project = await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
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
  type WorkerRow = (typeof workerRows)[number];
  const result = await Promise.all(
    workerRows.map(async (w: WorkerRow) => {
      const classifications = await db
        .select()
        .from(workerClassifications)
        .where(eq(workerClassifications.workerId, w.id));
      type ClassificationRow = (typeof classifications)[number];
      // Derive hasFullSsn from envelope len field without decrypting (per plan task 2 step 6)
      const hasFullSsn = w.ssnEncrypted
        ? (JSON.parse(w.ssnEncrypted) as { len?: number }).len === 9
        : false;
      const { ssnEncrypted: _enc, ...safeW } = w;
      return {
        ...safeW,
        hasFullSsn,
        classifications: classifications.map((c: ClassificationRow) => ({
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

  // Verify user has access to the project
  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  const body = req.body as z.infer<typeof CreateWorkerSchema>;

  const result = await createWorker(db, {
    userId,
    userEmail: req.user!.email,
    ipAddress: req.ip ?? null,
    projectId,
    name: body.name,
    ssn: body.ssn,
    tradeUnion: body.tradeUnion,
    addressStreet: body.addressStreet,
    addressCity: body.addressCity,
    addressState: body.addressState,
    addressZip: body.addressZip,
    unionLocal: body.unionLocal,
    unionBookNumber: body.unionBookNumber,
    apprenticeshipCommittee: body.apprenticeshipCommittee,
    apprenticeshipRegNumber: body.apprenticeshipRegNumber,
    nysRegisteredApprentice: body.nysRegisteredApprentice,
    race: body.race,
    ethnicity: body.ethnicity,
    gender: body.gender,
    veteranStatus: body.veteranStatus,
    skillLevel: body.skillLevel,
  });
  res.status(201).json({ data: { worker: result } });
});

// PUT /api/projects/:projectId/workers/:workerId — update worker profile
router.put('/:projectId/workers/:workerId', validate(UpdateWorkerSchema), async (req, res) => {
  const { projectId, workerId } = req.params as { projectId: string; workerId: string };
  const userId = req.user!.userId;
  const db = getDb();

  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  const body = req.body as z.infer<typeof UpdateWorkerSchema>;

  try {
    const result = await updateWorker(db, {
      userId,
      userEmail: req.user!.email,
      ipAddress: req.ip ?? null,
      projectId,
      workerId,
      name: body.name,
      ssn: body.ssn,
      tradeUnion: body.tradeUnion,
      addressStreet: body.addressStreet,
      addressCity: body.addressCity,
      addressState: body.addressState,
      addressZip: body.addressZip,
      unionLocal: body.unionLocal,
      unionBookNumber: body.unionBookNumber,
      apprenticeshipCommittee: body.apprenticeshipCommittee,
      apprenticeshipRegNumber: body.apprenticeshipRegNumber,
      nysRegisteredApprentice: body.nysRegisteredApprentice,
      race: body.race,
      ethnicity: body.ethnicity,
      gender: body.gender,
      veteranStatus: body.veteranStatus,
      skillLevel: body.skillLevel,
    });
    res.json({ data: { worker: result } });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
  }
});

// DELETE /api/projects/:projectId/workers/:workerId — remove worker (cascades classifications)
router.delete('/:projectId/workers/:workerId', async (req, res) => {
  const { projectId, workerId } = req.params as { projectId: string; workerId: string };
  const userId = req.user!.userId;
  const db = getDb();

  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  try {
    const result = await deleteWorker(db, {
      userId,
      userEmail: req.user!.email,
      ipAddress: req.ip ?? null,
      projectId,
      workerId,
    });
    res.json({ data: result });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
  }
});

// DELETE /api/projects/:projectId/workers/:workerId/classifications/:classificationId
router.delete('/:projectId/workers/:workerId/classifications/:classificationId', async (req, res) => {
  const { projectId, workerId, classificationId } = req.params as { projectId: string; workerId: string; classificationId: string };
  const userId = req.user!.userId;
  const db = getDb();

  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

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

  // Verify user has access to the project
  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
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
    waManualRate: body.waManualRate ?? null,
    waTradeCode: body.waTradeCode ?? null,
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
