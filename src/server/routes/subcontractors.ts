import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { eq, and, desc } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { subcontractors, subcontractorCprWeeks } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { assertProjectAccess } from '../utils/assertProjectAccess.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// ── Zod schemas ────────────────────────────────────────────────────────────

const CreateSubSchema = z.object({
  name: z.string().min(1).max(500),
  licenseNumber: z.string().max(200).optional(),
  contactName: z.string().max(200).optional(),
  contactEmail: z.string().email().optional(),
  address: z.string().max(500).optional(),
});

const UpdateSubSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  licenseNumber: z.string().max(200).optional().nullable(),
  contactName: z.string().max(200).optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
  address: z.string().max(500).optional().nullable(),
});

const CreateCprWeekSchema = z.object({
  weekEndingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'weekEndingDate must be YYYY-MM-DD'),
  receivedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  isCompliant: z.union([z.literal(0), z.literal(1)]).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

const UpdateCprWeekSchema = z.object({
  receivedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  isCompliant: z.union([z.literal(0), z.literal(1)]).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

// ── SUB-03: Subcontractor CRUD ─────────────────────────────────────────────

// GET /:id/subcontractors — list all subcontractors for a project
router.get('/:id/subcontractors', async (req, res) => {
  const projectId = req.params.id as string;
  const userId = req.user!.userId;
  const db = getDb();

  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  const rows = await db
    .select()
    .from(subcontractors)
    .where(eq(subcontractors.projectId, projectId));

  res.json({ data: { subcontractors: rows } });
});

// POST /:id/subcontractors — create a subcontractor
router.post('/:id/subcontractors', validate(CreateSubSchema), async (req, res) => {
  const projectId = req.params.id as string;
  const userId = req.user!.userId;
  const db = getDb();

  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  const body = req.body as z.infer<typeof CreateSubSchema>;
  const id = randomUUID();
  const now = new Date().toISOString();

  await db.insert(subcontractors).values({
    id,
    projectId,
    name: body.name,
    licenseNumber: body.licenseNumber ?? null,
    contactName: body.contactName ?? null,
    contactEmail: body.contactEmail ?? null,
    address: body.address ?? null,
    createdAt: now,
  });

  const [newSub] = await db
    .select()
    .from(subcontractors)
    .where(eq(subcontractors.id, id))
    .limit(1);

  // Best-effort audit log — dynamic import to avoid circular dependency risk
  try {
    const { insertAuditLog } = await import('../services/auditService.js');
    await insertAuditLog({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      ipAddress: req.ip ?? null,
      projectId,
      entityType: 'subcontractor',
      entityId: id,
      action: 'subcontractor.created',
      snapshot: { name: body.name },
    });
  } catch (auditErr) { console.error('[audit]', auditErr); }

  res.status(201).json({ data: { subcontractor: newSub } });
});

// PATCH /:id/subcontractors/:subId — update a subcontractor
router.patch('/:id/subcontractors/:subId', validate(UpdateSubSchema), async (req, res) => {
  const projectId = req.params.id as string;
  const subId = req.params.subId as string;
  const userId = req.user!.userId;
  const db = getDb();

  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  const [existing] = await db
    .select()
    .from(subcontractors)
    .where(and(eq(subcontractors.id, subId), eq(subcontractors.projectId, projectId)))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: 'Subcontractor not found' });
    return;
  }

  const body = req.body as z.infer<typeof UpdateSubSchema>;

  await db
    .update(subcontractors)
    .set({
      name: body.name !== undefined ? body.name : existing.name,
      licenseNumber: body.licenseNumber !== undefined ? body.licenseNumber : existing.licenseNumber,
      contactName: body.contactName !== undefined ? body.contactName : existing.contactName,
      contactEmail: body.contactEmail !== undefined ? body.contactEmail : existing.contactEmail,
      address: body.address !== undefined ? body.address : existing.address,
    })
    .where(eq(subcontractors.id, subId));

  const [updated] = await db
    .select()
    .from(subcontractors)
    .where(eq(subcontractors.id, subId))
    .limit(1);

  res.json({ data: { subcontractor: updated } });
});

// DELETE /:id/subcontractors/:subId — hard-delete a subcontractor (cascade CPR weeks)
router.delete('/:id/subcontractors/:subId', async (req, res) => {
  const projectId = req.params.id as string;
  const subId = req.params.subId as string;
  const userId = req.user!.userId;
  const db = getDb();

  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  const [existing] = await db
    .select()
    .from(subcontractors)
    .where(and(eq(subcontractors.id, subId), eq(subcontractors.projectId, projectId)))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: 'Subcontractor not found' });
    return;
  }

  await db.delete(subcontractors).where(eq(subcontractors.id, subId));

  // Best-effort audit log — dynamic import to avoid circular dependency risk
  try {
    const { insertAuditLog } = await import('../services/auditService.js');
    await insertAuditLog({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      ipAddress: req.ip ?? null,
      projectId,
      entityType: 'subcontractor',
      entityId: subId,
      action: 'subcontractor.removed',
      snapshot: { name: existing.name },
    });
  } catch (auditErr) { console.error('[audit]', auditErr); }

  res.json({ data: { deleted: true } });
});

// ── SUB-04: CPR week tracking ──────────────────────────────────────────────

// GET /:id/subcontractors/:subId/cpr-weeks — list CPR weeks for a sub
router.get('/:id/subcontractors/:subId/cpr-weeks', async (req, res) => {
  const projectId = req.params.id as string;
  const subId = req.params.subId as string;
  const userId = req.user!.userId;
  const db = getDb();

  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  // Second-level ownership check: sub must belong to this project
  const [sub] = await db
    .select()
    .from(subcontractors)
    .where(and(eq(subcontractors.id, subId), eq(subcontractors.projectId, projectId)))
    .limit(1);

  if (!sub) {
    res.status(404).json({ error: 'Subcontractor not found' });
    return;
  }

  const rows = await db
    .select()
    .from(subcontractorCprWeeks)
    .where(eq(subcontractorCprWeeks.subcontractorId, subId))
    .orderBy(desc(subcontractorCprWeeks.weekEndingDate));

  res.json({ data: { cprWeeks: rows } });
});

// POST /:id/subcontractors/:subId/cpr-weeks — create a CPR week record
router.post('/:id/subcontractors/:subId/cpr-weeks', validate(CreateCprWeekSchema), async (req, res) => {
  const projectId = req.params.id as string;
  const subId = req.params.subId as string;
  const userId = req.user!.userId;
  const db = getDb();

  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  // Second-level ownership check: sub must belong to this project
  const [sub] = await db
    .select()
    .from(subcontractors)
    .where(and(eq(subcontractors.id, subId), eq(subcontractors.projectId, projectId)))
    .limit(1);

  if (!sub) {
    res.status(404).json({ error: 'Subcontractor not found' });
    return;
  }

  const body = req.body as z.infer<typeof CreateCprWeekSchema>;

  // Check for duplicate (subcontractorId, weekEndingDate)
  const [existing] = await db
    .select()
    .from(subcontractorCprWeeks)
    .where(
      and(
        eq(subcontractorCprWeeks.subcontractorId, subId),
        eq(subcontractorCprWeeks.weekEndingDate, body.weekEndingDate),
      ),
    )
    .limit(1);

  if (existing) {
    res.status(409).json({ error: 'CPR week record already exists for this subcontractor and week ending date' });
    return;
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  await db.insert(subcontractorCprWeeks).values({
    id,
    subcontractorId: subId,
    weekEndingDate: body.weekEndingDate,
    receivedDate: body.receivedDate ?? null,
    isCompliant: body.isCompliant ?? null,
    notes: body.notes ?? null,
    createdAt: now,
  });

  const [newWeek] = await db
    .select()
    .from(subcontractorCprWeeks)
    .where(eq(subcontractorCprWeeks.id, id))
    .limit(1);

  res.status(201).json({ data: { cprWeek: newWeek } });
});

// PATCH /:id/subcontractors/:subId/cpr-weeks/:weekId — update a CPR week record
router.patch('/:id/subcontractors/:subId/cpr-weeks/:weekId', validate(UpdateCprWeekSchema), async (req, res) => {
  const projectId = req.params.id as string;
  const subId = req.params.subId as string;
  const weekId = req.params.weekId as string;
  const userId = req.user!.userId;
  const db = getDb();

  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  // Second-level ownership check: sub must belong to this project
  const [sub] = await db
    .select()
    .from(subcontractors)
    .where(and(eq(subcontractors.id, subId), eq(subcontractors.projectId, projectId)))
    .limit(1);

  if (!sub) {
    res.status(404).json({ error: 'Subcontractor not found' });
    return;
  }

  const [existingWeek] = await db
    .select()
    .from(subcontractorCprWeeks)
    .where(
      and(
        eq(subcontractorCprWeeks.id, weekId),
        eq(subcontractorCprWeeks.subcontractorId, subId),
      ),
    )
    .limit(1);

  if (!existingWeek) {
    res.status(404).json({ error: 'CPR week not found' });
    return;
  }

  const body = req.body as z.infer<typeof UpdateCprWeekSchema>;

  await db
    .update(subcontractorCprWeeks)
    .set({
      receivedDate: body.receivedDate !== undefined ? body.receivedDate : existingWeek.receivedDate,
      isCompliant: body.isCompliant !== undefined ? body.isCompliant : existingWeek.isCompliant,
      notes: body.notes !== undefined ? body.notes : existingWeek.notes,
    })
    .where(eq(subcontractorCprWeeks.id, weekId));

  const [updated] = await db
    .select()
    .from(subcontractorCprWeeks)
    .where(eq(subcontractorCprWeeks.id, weekId))
    .limit(1);

  res.json({ data: { cprWeek: updated } });
});

export default router;
