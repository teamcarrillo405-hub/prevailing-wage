// src/server/routes/payroll.ts
import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { projects, payrollEntries } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createPayrollWeek,
  getPayrollWeek,
  listPayrollWeeks,
  upsertPayrollEntry,
  getPayrollEntries,
  assertWeekNotSubmitted,
  updateWeekSubmission,
  clearWeekSubmission,
  copyPayrollWeek,
} from '../services/payrollService.js';

const router = Router();
router.use(requireAuth);

// ── Zod Schemas ───────────────────────────────────────────────────────────

const CreateWeekSchema = z.object({
  projectId: z.string().min(1),
  weekEndingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'weekEndingDate must be YYYY-MM-DD',
  }),
  payrollNumber: z.number().int().min(1),
});

const HoursValue = z.number().min(0, { message: 'hours must be >= 0' });

const UpsertEntrySchema = z.object({
  payrollWeekId: z.string().min(1),
  workerId: z.string().min(1),
  classificationId: z.string().min(1),
  monSt: HoursValue.optional(),
  tueSt: HoursValue.optional(),
  wedSt: HoursValue.optional(),
  thuSt: HoursValue.optional(),
  friSt: HoursValue.optional(),
  satSt: HoursValue.optional(),
  sunSt: HoursValue.optional(),
  monOt: HoursValue.optional(),
  tueOt: HoursValue.optional(),
  wedOt: HoursValue.optional(),
  thuOt: HoursValue.optional(),
  friOt: HoursValue.optional(),
  satOt: HoursValue.optional(),
  sunOt: HoursValue.optional(),
  baseRateSnapshot: z.number().min(0),
  fringeRateSnapshot: z.number().min(0),
  grossWages: z.number().nullable().optional(),
  deductions: z.number().min(0).optional(),
  netPay: z.number().nullable().optional(),
});

const SubmitWeekSchema = z.object({
  submittedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'submittedAt must be YYYY-MM-DD',
  }),
  submittedTo: z.string().min(1).max(200),
});

const CopyWeekSchema = z.object({
  sourceWeekId: z.string().min(1),
  weekEndingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'weekEndingDate must be YYYY-MM-DD',
  }),
  payrollNumber: z.number().int().min(1),
  preview: z.boolean().default(false),
});

// ── Helper: verify project ownership ──────────────────────────────────────

async function assertProjectOwner(
  projectId: string,
  userId: string,
  res: import('express').Response,
): Promise<boolean> {
  const db = getDb();
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return false;
  }
  if (project.userId !== userId) {
    res.status(403).json({ error: 'Access denied' });
    return false;
  }
  return true;
}

// ── Routes ────────────────────────────────────────────────────────────────

// POST /api/payroll/weeks — create a new payroll week for a project
router.post('/weeks', validate(CreateWeekSchema), async (req, res) => {
  const body = req.body as z.infer<typeof CreateWeekSchema>;
  const userId = req.user!.userId;

  const ok = await assertProjectOwner(body.projectId, userId, res);
  if (!ok) return;

  const result = await createPayrollWeek(body);
  res.status(201).json(result);
});

// POST /api/payroll/weeks/copy — copy a previous week with live rate re-fetch (PAY-01 + PAY-02)
router.post('/weeks/copy', validate(CopyWeekSchema), async (req, res) => {
  const body = req.body as z.infer<typeof CopyWeekSchema>;
  const userId = req.user!.userId;

  // Verify the source week exists and get its projectId
  const sourceWeek = await getPayrollWeek(body.sourceWeekId);
  if (!sourceWeek) {
    res.status(404).json({ error: 'Source payroll week not found' });
    return;
  }

  const ok = await assertProjectOwner(sourceWeek.projectId, userId, res);
  if (!ok) return;

  const result = await copyPayrollWeek({
    projectId: sourceWeek.projectId,
    sourceWeekId: body.sourceWeekId,
    weekEndingDate: body.weekEndingDate,
    payrollNumber: body.payrollNumber,
    preview: body.preview,
  });

  res.status(body.preview ? 200 : 201).json(result);
});

// GET /api/payroll/weeks/:id — get a week with its entries
router.get('/weeks/:id', async (req, res) => {
  const weekId = req.params.id as string;
  const userId = req.user!.userId;

  const week = await getPayrollWeek(weekId);
  if (!week) {
    res.status(404).json({ error: 'Payroll week not found' });
    return;
  }

  const ok = await assertProjectOwner(week.projectId, userId, res);
  if (!ok) return;

  const entries = await getPayrollEntries(weekId);
  res.json({ week, entries });
});

// GET /api/payroll/projects/:projectId/weeks — list all weeks for a project
router.get('/projects/:projectId/weeks', async (req, res) => {
  const projectId = req.params.projectId as string;
  const userId = req.user!.userId;

  const ok = await assertProjectOwner(projectId, userId, res);
  if (!ok) return;

  const weeks = await listPayrollWeeks(projectId);
  res.json({ weeks });
});

// POST /api/payroll/entries — create or upsert an entry (convenience for test seeders and future clients)
router.post('/entries', validate(UpsertEntrySchema), async (req, res) => {
  const body = req.body as z.infer<typeof UpsertEntrySchema>;
  const userId = req.user!.userId;

  const week = await getPayrollWeek(body.payrollWeekId);
  if (!week) {
    res.status(404).json({ error: 'Payroll week not found' });
    return;
  }

  const ok = await assertProjectOwner(week.projectId, userId, res);
  if (!ok) return;

  const { locked } = await assertWeekNotSubmitted(body.payrollWeekId);
  if (locked) {
    res.status(409).json({ error: 'Payroll week is submitted and cannot be edited' });
    return;
  }

  const entry = await upsertPayrollEntry(body);
  res.status(201).json({ id: entry?.id ?? null });
});

// PUT /api/payroll/entries/:id — upsert daily hours for a worker
// Note: :id is a semantic route parameter; actual upsert targets (weekId, workerId, classificationId) are in the body
router.put('/entries/:id', validate(UpsertEntrySchema), async (req, res) => {
  const body = req.body as z.infer<typeof UpsertEntrySchema>;
  const userId = req.user!.userId;

  // Verify the payroll week exists and user owns the project
  const week = await getPayrollWeek(body.payrollWeekId);
  if (!week) {
    res.status(404).json({ error: 'Payroll week not found' });
    return;
  }

  const ok = await assertProjectOwner(week.projectId, userId, res);
  if (!ok) return;

  const { locked } = await assertWeekNotSubmitted(body.payrollWeekId);
  if (locked) {
    res.status(409).json({ error: 'Payroll week is submitted and cannot be edited' });
    return;
  }

  const entry = await upsertPayrollEntry(body);

  if (!entry) {
    // Fallback: fetch the entry via the payroll week id after upsert
    const db = getDb();
    const [found] = await db
      .select()
      .from(payrollEntries)
      .where(eq(payrollEntries.payrollWeekId, body.payrollWeekId))
      .limit(1);
    res.json({ id: found?.id ?? req.params.id });
    return;
  }

  res.json({ id: entry.id });
});

// PATCH /api/payroll/weeks/:id/submit — mark week as submitted (SUB-01)
router.patch('/weeks/:id/submit', validate(SubmitWeekSchema), async (req, res) => {
  const weekId = req.params.id as string;
  const userId = req.user!.userId;
  const body = req.body as z.infer<typeof SubmitWeekSchema>;

  const week = await getPayrollWeek(weekId);
  if (!week) {
    res.status(404).json({ error: 'Payroll week not found' });
    return;
  }

  const ok = await assertProjectOwner(week.projectId, userId, res);
  if (!ok) return;

  await updateWeekSubmission(weekId, body.submittedAt, body.submittedTo);
  res.status(200).json({ message: 'Week marked as submitted' });
});

// DELETE /api/payroll/weeks/:id/submit — clear submission status (SUB-03)
router.delete('/weeks/:id/submit', async (req, res) => {
  const weekId = req.params.id as string;
  const userId = req.user!.userId;

  const week = await getPayrollWeek(weekId);
  if (!week) {
    res.status(404).json({ error: 'Payroll week not found' });
    return;
  }

  const ok = await assertProjectOwner(week.projectId, userId, res);
  if (!ok) return;

  await clearWeekSubmission(weekId);
  res.status(200).json({ message: 'Week submission cleared' });
});

export { router as payrollRouter };
