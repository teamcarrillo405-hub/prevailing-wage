import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { projects, projectMembers } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { assertProjectAccess } from '../utils/assertProjectAccess.js';
import type { Project } from '../utils/assertProjectAccess.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  state: z.string().length(2).toUpperCase(),
  county: z.string().min(1),
  contractType: z.enum(['federal-davis-bacon', 'state-prevailing', 'gsa-schedule', 'private']),
  awardDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'awardDate must be YYYY-MM-DD'),
  fundingType: z.enum(['federal', 'state', 'mixed']),
  // Phase 24 — California-specific fields
  cslbLicense: z.string().max(50).optional(),
  wcPolicyNumber: z.string().max(100).optional(),
  // Phase 25 — Washington-specific fields
  ubiNumber: z.string().max(50).optional(),
  lniCertificate: z.string().max(100).optional(),
  wcAccount: z.string().max(100).optional(),
});

// Fields that MUST be rejected in PATCH — immutable by design (WD version lock)
const IMMUTABLE_FIELDS = ['awardDate', 'fundingType', 'wdIdentifier', 'wdModNumber', 'wdLockedAt'];

const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(['active', 'closed']).optional(),
  contractorFein: z.string().max(9).optional(),
  dirProjectId: z.string().max(18).optional(),
  awardingAgency: z.string().max(56).optional(),
  contractNumber: z.string().max(25).optional(),
  pwiaIntentId: z.string().max(20).optional(),
});

// POST /api/projects — create a project
router.post('/', validate(CreateProjectSchema), async (req, res) => {
  const body = req.body as z.infer<typeof CreateProjectSchema>;
  const userId = req.user!.userId;
  const db = getDb();
  const now = new Date().toISOString();
  const id = randomUUID();

  await db.insert(projects).values({
    id,
    userId,
    name: body.name,
    state: body.state,
    county: body.county,
    contractType: body.contractType,
    awardDate: body.awardDate,
    fundingType: body.fundingType,
    status: 'active',
    cslbLicense: body.cslbLicense ?? null,
    wcPolicyNumber: body.wcPolicyNumber ?? null,
    ubiNumber: body.ubiNumber ?? null,
    lniCertificate: body.lniCertificate ?? null,
    wcAccount: body.wcAccount ?? null,
    createdAt: now,
    updatedAt: now,
  });

  // Insert owner membership row so assertProjectAccess works for the new project
  await db.insert(projectMembers).values({
    id: randomUUID(),
    projectId: id,
    userId,
    role: 'owner',
    joinedAt: now,
  });

  const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  res.status(201).json({ data: { project } });
});

// GET /api/projects — list projects for authenticated user
// Default: active-only. Pass ?status=all to include closed projects.
router.get('/', async (req, res) => {
  const userId = req.user!.userId;
  const db = getDb();
  const statusFilter = req.query.status as string | undefined;

  // Default to active-only; pass 'all' to include closed projects
  const conditions = [eq(projects.userId, userId)];
  if (!statusFilter || statusFilter === 'active') {
    conditions.push(eq(projects.status, 'active'));
  }
  // statusFilter === 'all' => no additional status condition

  const userProjects = await db
    .select()
    .from(projects)
    .where(and(...conditions));

  res.json({ data: { projects: userProjects } });
});

// GET /api/projects/:id — get single project
router.get('/:id', async (req, res) => {
  const userId = req.user!.userId;
  const db = getDb();

  let project: Project;
  try {
    project = await assertProjectAccess(db, req.params.id, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  res.json({ data: { project } });
});

// PATCH /api/projects/:id — update mutable fields only
router.patch('/:id', async (req, res) => {
  // Guard: check request body keys against IMMUTABLE_FIELDS before any parsing
  const attempted = IMMUTABLE_FIELDS.filter(f => f in req.body);
  if (attempted.length > 0) {
    res.status(400).json({ error: `Cannot modify immutable fields: ${attempted.join(', ')}` });
    return;
  }

  const parsed = UpdateProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    return;
  }

  const userId = req.user!.userId;
  const db = getDb();

  try {
    await assertProjectAccess(db, req.params.id, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  const updates = parsed.data;
  const now = new Date().toISOString();

  await db
    .update(projects)
    .set({ ...updates, updatedAt: now })
    .where(eq(projects.id, req.params.id));

  const [updated] = await db.select().from(projects).where(eq(projects.id, req.params.id)).limit(1);
  res.json({ data: { project: updated } });
});

// DELETE /api/projects/:id — soft delete (set status to 'closed')
router.delete('/:id', async (req, res) => {
  const userId = req.user!.userId;
  const db = getDb();

  try {
    await assertProjectAccess(db, req.params.id, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  const now = new Date().toISOString();
  await db
    .update(projects)
    .set({ status: 'closed', updatedAt: now })
    .where(eq(projects.id, req.params.id));

  res.json({ data: { message: 'Project closed' } });
});

export default router;
