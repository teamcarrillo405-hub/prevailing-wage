import { logger } from '../logger.js';
// src/server/routes/payroll.ts
import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { payrollEntries, workers, projects } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { assertProjectAccess } from '../utils/assertProjectAccess.js';
import { sendSubmissionConfirmationEmail } from '../services/emailService.js';
import {
  createPayrollWeek,
  getPayrollWeek,
  listPayrollWeeks,
  upsertPayrollEntry,
  deletePayrollEntry,
  getPayrollEntries,
  assertWeekNotSubmitted,
  updateWeekSubmission,
  clearWeekSubmission,
  copyPayrollWeek,
  amendPayrollWeek,
  setCaEcprSubmitted,
  clearCaEcprSubmitted,
  setWaLniSubmitted,
  clearWaLniSubmitted,
  setNyMpwrSubmitted,
  setIlIdolSubmitted,
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
  monDt: HoursValue.optional(),
  tueDt: HoursValue.optional(),
  wedDt: HoursValue.optional(),
  thuDt: HoursValue.optional(),
  friDt: HoursValue.optional(),
  satDt: HoursValue.optional(),
  sunDt: HoursValue.optional(),
  baseRateSnapshot: z.number().min(0),
  fringeRateSnapshot: z.number().min(0),
  grossWages: z.number().nullable().optional(),
  deductions: z.number().min(0).optional(),
  netPay: z.number().nullable().optional(),
  fringeHealthWelfare: z.number().min(0).nullable().optional(),
  fringePension: z.number().min(0).nullable().optional(),
  fringeVacation: z.number().min(0).nullable().optional(),
  fringeTraining: z.number().min(0).nullable().optional(),
  // Phase 52 / Phase 65-66 — deduction breakdown (CA eCPR + NJ MW-562)
  ficaTax: z.number().min(0).nullable().optional(),
  federalIncomeTax: z.number().min(0).nullable().optional(),
  stateIncomeTax: z.number().min(0).nullable().optional(),
  sdiTax: z.number().min(0).nullable().optional(),
  // Phase 42 — IL non-prevailing-wage hours
  nonPwHours: z.number().min(0).nullable().optional(),
  // Phase 49 — MA payroll entry fields
  checkNumber: z.string().max(50).nullable().optional(),
  allOtherHours: z.number().min(0).nullable().optional(),
  totalWeekGrossWages: z.number().min(0).nullable().optional(),
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

const AmendWeekSchema = z.object({
  originalWeekId: z.string().min(1),
});

const AgencySubmitSchema = z.object({
  submitted: z.boolean(),
});

// ── Routes ────────────────────────────────────────────────────────────────

// POST /api/payroll/weeks — create a new payroll week for a project
router.post('/weeks', validate(CreateWeekSchema), async (req, res) => {
  const body = req.body as z.infer<typeof CreateWeekSchema>;
  const userId = req.user!.userId;
  const db = getDb();

  try {
    const { role } = await assertProjectAccess(db, body.projectId, userId);
    if (role === 'auditor') {
      res.status(403).json({ error: 'Requires member role or higher' });
      return;
    }
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

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

  const db = getDb();
  try {
    const { role } = await assertProjectAccess(db, sourceWeek.projectId, userId);
    if (role === 'auditor') {
      res.status(403).json({ error: 'Requires member role or higher' });
      return;
    }
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  const result = await copyPayrollWeek({
    projectId: sourceWeek.projectId,
    sourceWeekId: body.sourceWeekId,
    weekEndingDate: body.weekEndingDate,
    payrollNumber: body.payrollNumber,
    preview: body.preview,
  });

  res.status(body.preview ? 200 : 201).json(result);
});

// POST /api/payroll/weeks/amend — create an amendment of a submitted week (AMD-01 + AMD-03)
router.post('/weeks/amend', validate(AmendWeekSchema), async (req, res) => {
  const { originalWeekId } = req.body as z.infer<typeof AmendWeekSchema>;
  const userId = req.user!.userId;

  const originalWeek = await getPayrollWeek(originalWeekId);
  if (!originalWeek) {
    res.status(404).json({ error: 'Payroll week not found' });
    return;
  }

  const db = getDb();
  try {
    const { role } = await assertProjectAccess(db, originalWeek.projectId, userId);
    if (role === 'auditor') {
      res.status(403).json({ error: 'Requires member role or higher' });
      return;
    }
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  if (!originalWeek.submittedAt) {
    res.status(409).json({ error: 'Only submitted weeks can be amended' });
    return;
  }

  const result = await amendPayrollWeek({ originalWeekId, projectId: originalWeek.projectId });
  res.status(201).json(result);
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

  const db = getDb();
  try {
    await assertProjectAccess(db, week.projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  const entries = await getPayrollEntries(weekId);
  res.json({ week, entries });
});

// GET /api/payroll/projects/:projectId/weeks — list all weeks for a project
router.get('/projects/:projectId/weeks', async (req, res) => {
  const projectId = req.params.projectId as string;
  const userId = req.user!.userId;
  const db = getDb();

  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

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

  const db = getDb();
  try {
    const { role } = await assertProjectAccess(db, week.projectId, userId);
    if (role === 'auditor') {
      res.status(403).json({ error: 'Requires member role or higher' });
      return;
    }
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  const { locked } = await assertWeekNotSubmitted(body.payrollWeekId);
  if (locked) {
    res.status(409).json({ error: 'Payroll week is submitted and cannot be edited' });
    return;
  }

  // Look up worker name for audit meta (best-effort)
  let workerName: string | undefined;
  try {
    const [workerRow] = await db.select().from(workers).where(eq(workers.id, body.workerId)).limit(1);
    workerName = workerRow?.name;
  } catch { /* best-effort */ }

  const entry = await upsertPayrollEntry({
    ...body,
    userId,
    userEmail: req.user!.email,
    ipAddress: req.ip ?? null,
    workerName,
    payrollNumber: week.payrollNumber,
  });
  res.status(201).json({ id: entry?.id ?? null });
});

// PUT /api/payroll/entries/:id — upsert daily hours for a worker
// Note: :id is a semantic route parameter; actual upsert targets (weekId, workerId, classificationId) are in the body
router.put('/entries/:id', validate(UpsertEntrySchema), async (req, res) => {
  const body = req.body as z.infer<typeof UpsertEntrySchema>;
  const userId = req.user!.userId;

  // Verify the payroll week exists and user has access to the project
  const week = await getPayrollWeek(body.payrollWeekId);
  if (!week) {
    res.status(404).json({ error: 'Payroll week not found' });
    return;
  }

  const db = getDb();
  try {
    const { role } = await assertProjectAccess(db, week.projectId, userId);
    if (role === 'auditor') {
      res.status(403).json({ error: 'Requires member role or higher' });
      return;
    }
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  const { locked } = await assertWeekNotSubmitted(body.payrollWeekId);
  if (locked) {
    res.status(409).json({ error: 'Payroll week is submitted and cannot be edited' });
    return;
  }

  // Look up worker name for audit meta (best-effort)
  let workerNamePut: string | undefined;
  try {
    const [workerRow] = await db.select().from(workers).where(eq(workers.id, body.workerId)).limit(1);
    workerNamePut = workerRow?.name;
  } catch { /* best-effort */ }

  const entry = await upsertPayrollEntry({
    ...body,
    userId,
    userEmail: req.user!.email,
    ipAddress: req.ip ?? null,
    workerName: workerNamePut,
    payrollNumber: week.payrollNumber,
  });

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

// DELETE /api/payroll/entries/:entryId — delete a payroll entry (AUDIT-03)
router.delete('/entries/:entryId', async (req, res) => {
  const { entryId } = req.params as { entryId: string };
  const userId = req.user!.userId;
  const userEmail = req.user!.email;
  const ipAddress = req.ip ?? null;
  const db = getDb();

  try {
    // First look up the entry to get its projectId for access check
    const { payrollEntries: peTable, payrollWeeks: pwTable } = await import('../db/schema.js');
    const { eq: eqOp } = await import('drizzle-orm');
    const [entry] = await db.select().from(peTable).where(eqOp(peTable.id, entryId)).limit(1);
    if (!entry) {
      res.status(404).json({ error: 'Payroll entry not found' });
      return;
    }
    const [week] = await db.select().from(pwTable).where(eqOp(pwTable.id, entry.payrollWeekId)).limit(1);
    if (!week) {
      res.status(404).json({ error: 'Payroll week not found' });
      return;
    }

    // Verify user has access to the project before deleting
    const { role: deleteRole } = await assertProjectAccess(db, week.projectId, userId);
    if (deleteRole === 'auditor') {
      res.status(403).json({ error: 'Requires member role or higher' });
      return;
    }

    // Now perform the delete with audit
    const result = await deletePayrollEntry({ entryId, userId, userEmail, ipAddress });
    res.json({ data: result });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
  }
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

  const db = getDb();
  try {
    const { role } = await assertProjectAccess(db, week.projectId, userId);
    if (role === 'auditor') {
      res.status(403).json({ error: 'Requires member role or higher' });
      return;
    }
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  await updateWeekSubmission(weekId, body.submittedAt, body.submittedTo);

  // Best-effort audit log (AUDIT-03)
  try {
    const { insertAuditLog } = await import('../services/auditService.js');
    await insertAuditLog({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      ipAddress: req.ip ?? null,
      projectId: week.projectId,
      entityType: 'payroll_week',
      entityId: weekId,
      action: 'payroll_week.submitted',
      meta: { payrollNumber: week.payrollNumber, weekEnding: week.weekEndingDate, submittedTo: body.submittedTo },
    });
  } catch (auditErr) { logger.error({ err: auditErr }, '[audit]'); }

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

  const db = getDb();
  try {
    const { role } = await assertProjectAccess(db, week.projectId, userId);
    if (role === 'auditor') {
      res.status(403).json({ error: 'Requires member role or higher' });
      return;
    }
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  await clearWeekSubmission(weekId);

  // Best-effort audit log (AUDIT-03)
  try {
    const { insertAuditLog } = await import('../services/auditService.js');
    await insertAuditLog({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      ipAddress: req.ip ?? null,
      projectId: week.projectId,
      entityType: 'payroll_week',
      entityId: weekId,
      action: 'payroll_week.unsubmitted',
      meta: { payrollNumber: week.payrollNumber, weekEnding: week.weekEndingDate },
    });
  } catch (auditErr) { logger.error({ err: auditErr }, '[audit]'); }

  res.status(200).json({ message: 'Week submission cleared' });
});

// PATCH /api/payroll/weeks/:id/ca-submit — toggle CA eCPR submission status (AS-01)
router.patch('/weeks/:id/ca-submit', validate(AgencySubmitSchema), async (req, res) => {
  const weekId = req.params.id as string;
  const userId = req.user!.userId;
  const { submitted } = req.body as z.infer<typeof AgencySubmitSchema>;

  const week = await getPayrollWeek(weekId);
  if (!week) {
    res.status(404).json({ error: 'Payroll week not found' });
    return;
  }

  const db = getDb();
  try {
    const { role } = await assertProjectAccess(db, week.projectId, userId);
    if (role === 'auditor') {
      res.status(403).json({ error: 'Requires member role or higher' });
      return;
    }
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  // NOTE: No submittedAt guard — CA/WA tracking is independent of WH-347 edit lock (per D-05)
  const result = submitted
    ? await setCaEcprSubmitted(weekId)
    : await clearCaEcprSubmitted(weekId);

  // Best-effort audit log — only on submit=true (AUDIT-03)
  if (submitted) {
    try {
      const { insertAuditLog } = await import('../services/auditService.js');
      await insertAuditLog({
        userId: req.user!.userId,
        userEmail: req.user!.email,
        ipAddress: req.ip ?? null,
        projectId: week.projectId,
        entityType: 'payroll_week',
        entityId: weekId,
        action: 'agency_submission.created',
        meta: { agency: 'CA_DIR', payrollNumber: week.payrollNumber, weekEnding: week.weekEndingDate },
      });
    } catch (auditErr) { logger.error({ err: auditErr }, '[audit]'); }
  }

  // NOTIF-04: submission confirmation email — best-effort, non-fatal (NFR-02)
  if (submitted) {
    try {
      const [proj] = await db.select({ name: projects.name })
        .from(projects).where(eq(projects.id, week.projectId)).limit(1);
      await sendSubmissionConfirmationEmail(
        req.user!.email,
        proj?.name ?? week.projectId,
        'CA DIR eCPR',
        week.weekEndingDate,
        week.projectId,
      );
    } catch (err) {
      logger.error({ err: err }, '[email] NOTIF-04 submission confirmation failed:');
    }
  }

  res.status(200).json(result);
});

// PATCH /api/payroll/weeks/:id/wa-submit — toggle WA L&I submission status (AS-02)
router.patch('/weeks/:id/wa-submit', validate(AgencySubmitSchema), async (req, res) => {
  const weekId = req.params.id as string;
  const userId = req.user!.userId;
  const { submitted } = req.body as z.infer<typeof AgencySubmitSchema>;

  const week = await getPayrollWeek(weekId);
  if (!week) {
    res.status(404).json({ error: 'Payroll week not found' });
    return;
  }

  const db = getDb();
  try {
    const { role } = await assertProjectAccess(db, week.projectId, userId);
    if (role === 'auditor') {
      res.status(403).json({ error: 'Requires member role or higher' });
      return;
    }
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  // NOTE: No submittedAt guard — CA/WA tracking is independent of WH-347 edit lock (per D-05)
  const result = submitted
    ? await setWaLniSubmitted(weekId)
    : await clearWaLniSubmitted(weekId);

  // Best-effort audit log — only on submit=true (AUDIT-03)
  if (submitted) {
    try {
      const { insertAuditLog } = await import('../services/auditService.js');
      await insertAuditLog({
        userId: req.user!.userId,
        userEmail: req.user!.email,
        ipAddress: req.ip ?? null,
        projectId: week.projectId,
        entityType: 'payroll_week',
        entityId: weekId,
        action: 'agency_submission.created',
        meta: { agency: 'WA_LNI', payrollNumber: week.payrollNumber, weekEnding: week.weekEndingDate },
      });
    } catch (auditErr) { logger.error({ err: auditErr }, '[audit]'); }
  }

  // NOTIF-04: submission confirmation email — best-effort, non-fatal (NFR-02)
  if (submitted) {
    try {
      const [proj] = await db.select({ name: projects.name })
        .from(projects).where(eq(projects.id, week.projectId)).limit(1);
      await sendSubmissionConfirmationEmail(
        req.user!.email,
        proj?.name ?? week.projectId,
        'WA L&I',
        week.weekEndingDate,
        week.projectId,
      );
    } catch (err) {
      logger.error({ err: err }, '[email] NOTIF-04 submission confirmation failed:');
    }
  }

  res.status(200).json(result);
});

// PATCH /api/payroll/weeks/:id/ny-submit — mark NY MPWR as submitted (AS-03)
router.patch('/weeks/:id/ny-submit', async (req, res) => {
  const weekId = req.params.id as string;
  const userId = req.user!.userId;

  const week = await getPayrollWeek(weekId);
  if (!week) {
    res.status(404).json({ error: 'Payroll week not found' });
    return;
  }

  const db = getDb();
  try {
    const { role } = await assertProjectAccess(db, week.projectId, userId);
    if (role === 'auditor') {
      res.status(403).json({ error: 'Requires member role or higher' });
      return;
    }
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  // NOTE: No submittedAt guard — NY MPWR tracking is independent of WH-347 edit lock
  const result = await setNyMpwrSubmitted(weekId);

  // Best-effort audit log (AUDIT-03)
  try {
    const { insertAuditLog } = await import('../services/auditService.js');
    await insertAuditLog({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      ipAddress: req.ip ?? null,
      projectId: week.projectId,
      entityType: 'payroll_week',
      entityId: weekId,
      action: 'agency_submission.created',
      meta: { agency: 'NY_MPWR', payrollNumber: week.payrollNumber, weekEnding: week.weekEndingDate },
    });
  } catch (auditErr) { logger.error({ err: auditErr }, '[audit]'); }

  // NOTIF-04: submission confirmation email — best-effort, non-fatal (NFR-02)
  // ny-submit always submits (no toggle), so fire unconditionally
  try {
    const [proj] = await db.select({ name: projects.name })
      .from(projects).where(eq(projects.id, week.projectId)).limit(1);
    await sendSubmissionConfirmationEmail(
      req.user!.email,
      proj?.name ?? week.projectId,
      'NY MPWR',
      week.weekEndingDate,
      week.projectId,
    );
  } catch (err) {
    logger.error({ err: err }, '[email] NOTIF-04 submission confirmation failed:');
  }

  res.status(200).json(result);
});

// PATCH /api/payroll/weeks/:id/il-submit — mark IL IDOL as submitted (STATE-11)
router.patch('/weeks/:id/il-submit', async (req, res) => {
  const weekId = req.params.id as string;
  const userId = req.user!.userId;

  const week = await getPayrollWeek(weekId);
  if (!week) {
    res.status(404).json({ error: 'Payroll week not found' });
    return;
  }

  const db = getDb();
  try {
    const { role } = await assertProjectAccess(db, week.projectId, userId);
    if (role === 'auditor') {
      res.status(403).json({ error: 'Requires member role or higher' });
      return;
    }
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  // NOTE: No submittedAt guard — IL IDOL tracking is independent of WH-347 edit lock
  const result = await setIlIdolSubmitted(weekId);

  // Best-effort audit log (AUDIT-03)
  try {
    const { insertAuditLog } = await import('../services/auditService.js');
    await insertAuditLog({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      ipAddress: req.ip ?? null,
      projectId: week.projectId,
      entityType: 'payroll_week',
      entityId: weekId,
      action: 'agency_submission.created',
      meta: { agency: 'IL_IDOL', payrollNumber: week.payrollNumber, weekEnding: week.weekEndingDate },
    });
  } catch (auditErr) { logger.error({ err: auditErr }, '[audit]'); }

  // NOTIF-04: submission confirmation email — best-effort, non-fatal (NFR-02)
  // il-submit always submits (no toggle), so fire unconditionally
  try {
    const [proj] = await db.select({ name: projects.name })
      .from(projects).where(eq(projects.id, week.projectId)).limit(1);
    await sendSubmissionConfirmationEmail(
      req.user!.email,
      proj?.name ?? week.projectId,
      'IL IDOL',
      week.weekEndingDate,
      week.projectId,
    );
  } catch (err) {
    logger.error({ err: err }, '[email] NOTIF-04 submission confirmation failed:');
  }

  res.status(200).json(result);
});

export { router as payrollRouter };
