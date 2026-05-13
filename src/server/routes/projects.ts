import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { eq, and, isNull, count } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { projects, projectMembers, users } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { assertProjectAccess, assertProjectReviewAccess, assertProjectWriteAccess } from '../utils/assertProjectAccess.js';
import type { Project } from '../utils/assertProjectAccess.js';
import { getLimits, type PlanTier } from '../utils/planLimits.js';

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
  // Phase 40 — New York-specific fields
  nyprcNumber: z.string().max(100).optional(),
  nysContractorRegNumber: z.string().max(100).optional(),
  // Phase 47 — Texas-specific fields
  txdotProjectId: z.string().max(100).optional(),
  txContractorLicense: z.string().max(100).optional(),
  txAwardingAgency: z.string().max(200).optional(),
  // Phase 49 — Massachusetts-specific fields
  maDlsProjectId: z.string().max(100).optional(),
  maSicCode: z.string().max(50).optional(),
  // Phase 51 — NJ project fields
  njPwcNumber: z.string().max(50).optional(),
  njContractId: z.string().max(100).optional(),
  mnContractId: z.string().max(100).optional(),
  vaContractId: z.string().max(100).optional(),
  projectSettings: z.string().optional(),
  // Phase 70 — Apprenticeship ratio enforcement
  apprenticeshipRequirements: z.string().optional(), // JSON string
  isIraIijaProject: z.boolean().optional(),
});

// Fields that MUST be rejected in PATCH — immutable by design (WD version lock)
const IMMUTABLE_FIELDS = ['awardDate', 'fundingType', 'wdIdentifier', 'wdModNumber', 'wdLockedAt'];

const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(['active', 'closed']).optional(),
  cslbLicense: z.string().max(50).optional().nullable(),
  wcPolicyNumber: z.string().max(100).optional().nullable(),
  ubiNumber: z.string().max(50).optional().nullable(),
  lniCertificate: z.string().max(100).optional().nullable(),
  wcAccount: z.string().max(100).optional().nullable(),
  contractorFein: z.string().max(9).optional(),
  dirProjectId: z.string().max(18).optional(),
  awardingAgency: z.string().max(56).optional(),
  contractNumber: z.string().max(25).optional(),
  pwiaIntentId: z.string().max(20).optional(),
  // Phase 40 — New York-specific fields
  nyprcNumber: z.string().max(100).optional(),
  nysContractorRegNumber: z.string().max(100).optional(),
  // Phase 47 — Texas-specific fields
  txdotProjectId: z.string().max(100).optional(),
  txContractorLicense: z.string().max(100).optional(),
  txAwardingAgency: z.string().max(200).optional(),
  // Phase 49 — Massachusetts-specific fields
  maDlsProjectId: z.string().max(100).optional(),
  maSicCode: z.string().max(50).optional(),
  // Phase 51 — NJ project fields
  njPwcNumber: z.string().max(50).optional().nullable(),
  njContractId: z.string().max(100).optional().nullable(),
  mnContractId: z.string().max(100).optional().nullable(),
  vaContractId: z.string().max(100).optional().nullable(),
  projectSettings: z.string().optional(),
  // Phase 70 — Apprenticeship ratio enforcement
  apprenticeshipRequirements: z.string().optional().nullable(),
  isIraIijaProject: z.boolean().optional(),
  // Phase 75 — GPS clock-in settings
  gpsClockInEnabled: z.boolean().optional(),
  gpsLatitude: z.number().min(-90).max(90).optional().nullable(),
  gpsLongitude: z.number().min(-180).max(180).optional().nullable(),
  gpsRadiusMeters: z.number().min(50).max(10000).optional(),
});

const ReviewProjectSchema = z.object({
  status: z.enum(['draft', 'ready_for_review', 'approved', 'rejected']),
  note: z.string().max(1000).optional().nullable(),
});

// POST /api/projects — create a project
router.post('/', validate(CreateProjectSchema), async (req, res) => {
  const body = req.body as z.infer<typeof CreateProjectSchema>;
  const userId = req.user!.userId;
  const db = getDb();

  // Enforce per-plan project cap
  const [userRow] = await db
    .select({ planTier: users.planTier })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const rawTier = userRow?.planTier;
  const tier: PlanTier = (rawTier === 'pro' || rawTier === 'enterprise') ? rawTier : 'starter';
  const limits = getLimits(tier);

  if (limits.maxProjects !== Infinity) {
    const [{ value: projectCount }] = await db
      .select({ value: count() })
      .from(projects)
      .where(eq(projects.userId, userId));
    if (projectCount >= limits.maxProjects) {
      res.status(409).json({
        error: 'Project limit reached. Upgrade to Pro to create unlimited projects.',
        upgradeRequired: true,
      });
      return;
    }
  }

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
    nyprcNumber: body.nyprcNumber ?? null,
    nysContractorRegNumber: body.nysContractorRegNumber ?? null,
    txdotProjectId: body.txdotProjectId ?? null,
    txContractorLicense: body.txContractorLicense ?? null,
    txAwardingAgency: body.txAwardingAgency ?? null,
    maDlsProjectId: body.maDlsProjectId ?? null,
    maSicCode: body.maSicCode ?? null,
    njPwcNumber: body.njPwcNumber ?? null,
    njContractId: body.njContractId ?? null,
    mnContractId: body.mnContractId ?? null,
    vaContractId: body.vaContractId ?? null,
    projectSettings: body.projectSettings ?? null,
    apprenticeshipRequirements: body.apprenticeshipRequirements ?? null,
    isIraIijaProject: body.isIraIijaProject ?? false,
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

  const statusCondition = (!statusFilter || statusFilter === 'active')
    ? eq(projects.status, 'active')
    : undefined;

  const userProjects = await db
    .select({ project: projects })
    .from(projects)
    .innerJoin(
      projectMembers,
      and(
        eq(projectMembers.projectId, projects.id),
        eq(projectMembers.userId, userId),
        isNull(projectMembers.removedAt),
      ),
    )
    .where(statusCondition);

  res.json({ data: { projects: userProjects.map((r: { project: typeof projects.$inferSelect }) => r.project) } });
});

// GET /api/projects/:id — get single project
router.get('/:id', async (req, res) => {
  const userId = req.user!.userId;
  const db = getDb();

  let project: Project;
  try {
    ({ project } = await assertProjectAccess(db, req.params.id, userId));
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
    await assertProjectWriteAccess(db, req.params.id, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  const updates = parsed.data;
  const now = new Date().toISOString();

  // NOTIF-05: If projectSettings is being updated, merge with current value to preserve sibling keys
  // (NY form data, lastDueSoonNotifiedAt, and any future keys all live in this JSON blob)
  let resolvedProjectSettings = updates.projectSettings;
  if (updates.projectSettings !== undefined) {
    const [current] = await db.select({ projectSettings: projects.projectSettings })
      .from(projects)
      .where(eq(projects.id, req.params.id))
      .limit(1);
    const currentParsed: Record<string, unknown> = (() => {
      if (!current?.projectSettings) return {};
      try { return JSON.parse(current.projectSettings); } catch { return {}; }
    })();
    const incomingParsed: Record<string, unknown> = (() => {
      try { return JSON.parse(updates.projectSettings); } catch { return {}; }
    })();
    resolvedProjectSettings = JSON.stringify({ ...currentParsed, ...incomingParsed });
  }

  await db
    .update(projects)
    .set({
      ...updates,
      ...(updates.nyprcNumber !== undefined && { nyprcNumber: updates.nyprcNumber }),
      ...(updates.nysContractorRegNumber !== undefined && { nysContractorRegNumber: updates.nysContractorRegNumber }),
      ...(updates.txdotProjectId !== undefined && { txdotProjectId: updates.txdotProjectId }),
      ...(updates.txContractorLicense !== undefined && { txContractorLicense: updates.txContractorLicense }),
      ...(updates.txAwardingAgency !== undefined && { txAwardingAgency: updates.txAwardingAgency }),
      ...(updates.maDlsProjectId !== undefined && { maDlsProjectId: updates.maDlsProjectId }),
      ...(updates.maSicCode !== undefined && { maSicCode: updates.maSicCode }),
      ...(updates.njPwcNumber !== undefined && { njPwcNumber: updates.njPwcNumber }),
      ...(updates.njContractId !== undefined && { njContractId: updates.njContractId }),
      ...(updates.mnContractId !== undefined && { mnContractId: updates.mnContractId }),
      ...(updates.vaContractId !== undefined && { vaContractId: updates.vaContractId }),
      ...(resolvedProjectSettings !== undefined && { projectSettings: resolvedProjectSettings }),
      // Phase 75 — GPS clock-in settings
      ...(updates.gpsClockInEnabled !== undefined && { gpsClockInEnabled: updates.gpsClockInEnabled }),
      ...(updates.gpsLatitude !== undefined && { gpsLatitude: updates.gpsLatitude }),
      ...(updates.gpsLongitude !== undefined && { gpsLongitude: updates.gpsLongitude }),
      ...(updates.gpsRadiusMeters !== undefined && { gpsRadiusMeters: updates.gpsRadiusMeters }),
      updatedAt: now,
    })
    .where(eq(projects.id, req.params.id));

  const [updated] = await db.select().from(projects).where(eq(projects.id, req.params.id)).limit(1);
  res.json({ data: { project: updated } });
});

// DELETE /api/projects/:id — soft delete (set status to 'closed')
router.delete('/:id', async (req, res) => {
  const userId = req.user!.userId;
  const projectId = String(req.params.id);
  const db = getDb();

  try {
    await assertProjectWriteAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  const now = new Date().toISOString();
  await db
    .update(projects)
    .set({ status: 'closed', updatedAt: now })
    .where(eq(projects.id, projectId));

  res.json({ data: { message: 'Project closed' } });
});

router.post('/:id/review', validate(ReviewProjectSchema), async (req, res) => {
  const userId = req.user!.userId;
  const projectId = String(req.params.id);
  const db = getDb();
  let role: Awaited<ReturnType<typeof assertProjectReviewAccess>>['role'];

  try {
    ({ role } = await assertProjectReviewAccess(db, projectId, userId));
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  const [current] = await db.select({ projectSettings: projects.projectSettings })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  const currentSettings = (() => {
    if (!current?.projectSettings) return {};
    try { return JSON.parse(current.projectSettings) as Record<string, unknown>; } catch { return {}; }
  })();
  const body = req.body as z.infer<typeof ReviewProjectSchema>;
  const now = new Date().toISOString();
  const reviewState = {
    status: body.status,
    note: body.note ?? null,
    reviewedAt: now,
    reviewedBy: userId,
    reviewedByRole: role,
  };

  await db.update(projects)
    .set({
      projectSettings: JSON.stringify({ ...currentSettings, reviewState }),
      updatedAt: now,
    })
    .where(eq(projects.id, projectId));

  res.json({ data: { reviewState } });
});

export default router;
