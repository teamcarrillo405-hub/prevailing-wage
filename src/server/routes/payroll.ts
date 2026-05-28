// src/server/routes/payroll.ts
import { logger } from '../logger.js';
import { Router } from 'express';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { payrollEntries, payrollWeeks, workers, projects } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { assertProjectAccess } from '../utils/assertProjectAccess.js';
import { sendSubmissionConfirmationEmail, sendEmail } from '../services/emailService.js';
import { computeCompliance } from '../services/complianceService.js';
import { readFileSync } from 'fs';
import path from 'path';

// Load violation-alert template at module init (fail-safe: empty string if missing)
let violationTemplate = '';
try {
  violationTemplate = readFileSync(
    path.join(process.cwd(), 'src/server/email/templates/violation-alert.html'),
    'utf8',
  );
} catch {
  console.warn('[payroll] violation-alert.html template not found — violation alert emails disabled');
}
import { deliverWebhook, WEBHOOK_EVENT_PAYROLL_WEEK_CREATED } from '../services/webhookService.js';
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

// ── Violation alert helper — fire-and-forget after entry save ─────────────
// Only fires when APP_URL is set (skips in test environments).
function maybeSendViolationAlert(weekId: string, projectId: string, ownerEmail: string, projectName: string, weekEndingDate: string) {
  if (!violationTemplate || !process.env.APP_URL) return;
  computeCompliance(getDb() as any, weekId).then(result => {
    if (!result) return;
    const total = result.violations.length + result.weekViolations.length + result.deductionViolations.length;
    if (total === 0) return;
    const allViolations = [
      ...result.violations.map(v => v.workerName + ': ' + v.violationType),
      ...result.weekViolations.map(wv => wv.detail),
      ...result.deductionViolations.map(dv => dv.workerName + ': excessive deductions'),
    ];
    const weekUrl = `${process.env.APP_URL}/projects/${projectId}/payroll/${weekId}`;
    const violationHtml = violationTemplate
      .replace('{{projectName}}', projectName)
      .replace('{{weekEnding}}', weekEndingDate)
      .replace('{{violationList}}', allViolations.map(v => `<li>${v}</li>`).join(''))
      .replace('{{weekUrl}}', weekUrl);
    sendEmail(ownerEmail, `[${projectName}] Compliance issue detected`, violationHtml)
      .catch((err: unknown) => logger.warn({ err }, '[payroll] violation-alert email failed'));
  }).catch((err: unknown) => logger.warn({ err }, '[payroll] compliance check failed before violation alert'));
}

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
  deductionVacationHoliday: z.number().min(0).nullable().optional(),
  deductionHealthWelfare: z.number().min(0).nullable().optional(),
  deductionPension: z.number().min(0).nullable().optional(),
  deductionTraining: z.number().min(0).nullable().optional(),
  deductionFundAdmin: z.number().min(0).nullable().optional(),
  deductionDues: z.number().min(0).nullable().optional(),
  deductionTravelSubsistence: z.number().min(0).nullable().optional(),
  deductionSavings: z.number().min(0).nullable().optional(),
  deductionOther: z.number().min(0).nullable().optional(),
  deductionOtherDescription: z.string().max(120).nullable().optional(),
  // Phase 42 — IL non-prevailing-wage hours
  nonPwHours: z.number().min(0).nullable().optional(),
  // Phase 49 — MA payroll entry fields
  checkNumber: z.string().max(50).nullable().optional(),
  allOtherHours: z.number().min(0).nullable().optional(),
  totalWeekGrossWages: z.number().min(0).nullable().optional(),
  // Phase 108 (DBE-08): optional sub attribution
  subcontractorId: z.string().uuid().nullable().optional(),
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

  // COMP-FIX-04: federal projects must have week-ending dates on Saturday (29 CFR Part 3.4)
  {
    const [projectRow] = await db
      .select({ fundingType: projects.fundingType, state: projects.state })
      .from(projects)
      .where(eq(projects.id, body.projectId))
      .limit(1);
    if (projectRow) {
      const isFederal = projectRow.fundingType === 'federal' || !projectRow.state;
      if (isFederal && body.weekEndingDate) {
        const dayOfWeek = new Date(body.weekEndingDate + 'T00:00:00Z').getUTCDay(); // 6 = Saturday
        if (dayOfWeek !== 6) {
          res.status(422).json({
            error: 'WEEK_MUST_END_SATURDAY',
            message: 'Federal certified payroll weeks must end on Saturday (29 CFR Part 3.4).',
          });
          return;
        }
      }
    }
  }

  const [existingWeek] = await db
    .select({ id: payrollWeeks.id })
    .from(payrollWeeks)
    .where(
      and(
        eq(payrollWeeks.projectId, body.projectId),
        eq(payrollWeeks.payrollNumber, body.payrollNumber),
      ),
    )
    .limit(1);
  if (existingWeek) {
    res.status(409).json({ error: `Payroll Week #${body.payrollNumber} already exists for this project.` });
    return;
  }

  let result: Awaited<ReturnType<typeof createPayrollWeek>>;
  try {
    result = await createPayrollWeek(body);
  } catch (err: any) {
    if (
      err?.message?.includes('UNIQUE constraint failed') ||
      err?.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
      err?.code === 'SQLITE_CONSTRAINT'
    ) {
      res.status(409).json({
        error: 'DUPLICATE_PAYROLL_NUMBER',
        message: 'A payroll week with this payroll number already exists for this project.',
      });
      return;
    }
    throw err;
  }

  // Fire webhook (non-blocking)
  void deliverWebhook(userId, WEBHOOK_EVENT_PAYROLL_WEEK_CREATED, {
    event: WEBHOOK_EVENT_PAYROLL_WEEK_CREATED,
    weekId: result.id,
    projectId: body.projectId,
    weekEndingDate: body.weekEndingDate,
    payrollNumber: result.payrollNumber,
  });

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

  let entry;
  try {
    entry = await upsertPayrollEntry({
      ...body,
      userId,
      userEmail: req.user!.email,
      ipAddress: req.ip ?? null,
      workerName,
      payrollNumber: week.payrollNumber,
    });
  } catch (err: any) {
    if (err.status === 422) {
      res.status(422).json({ error: err.code, message: err.message });
      return;
    }
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  // Fire violation alert email (non-blocking, best-effort)
  try {
    const [projectRow] = await db.select({ name: projects.name }).from(projects).where(eq(projects.id, week.projectId)).limit(1);
    if (projectRow && week.weekEndingDate) {
      maybeSendViolationAlert(body.payrollWeekId, week.projectId, req.user!.email, projectRow.name, week.weekEndingDate);
    }
  } catch { /* best-effort */ }

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

  let entryPut;
  try {
    entryPut = await upsertPayrollEntry({
      ...body,
      userId,
      userEmail: req.user!.email,
      ipAddress: req.ip ?? null,
      workerName: workerNamePut,
      payrollNumber: week.payrollNumber,
    });
  } catch (err: any) {
    if (err.status === 422) {
      res.status(422).json({ error: err.code, message: err.message });
      return;
    }
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  // Fire violation alert email (non-blocking, best-effort)
  try {
    const [projectRow] = await db.select({ name: projects.name }).from(projects).where(eq(projects.id, week.projectId)).limit(1);
    if (projectRow && week.weekEndingDate) {
      maybeSendViolationAlert(body.payrollWeekId, week.projectId, req.user!.email, projectRow.name, week.weekEndingDate);
    }
  } catch { /* best-effort */ }

  if (!entryPut) {
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

  res.json({ id: entryPut.id });
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

  // Best-effort webhook delivery — API-01
  try {
    const { deliverWebhook } = await import('../services/webhookService.js');
    await deliverWebhook(userId, 'payroll.submitted', {
      projectId: week.projectId,
      weekId,
      payrollNumber: week.payrollNumber,
      weekEndingDate: week.weekEndingDate,
      submittedAt: body.submittedAt,
      submittedTo: body.submittedTo,
    });
  } catch (whErr) { logger.error({ err: whErr }, '[webhook] payroll.submitted'); }

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

// GET /api/payroll/due-soon
// Returns unsubmitted payroll weeks whose weekEndingDate is within the next
// DUE_SOON_WINDOW days (or already past) for all projects the user belongs to.
// Fixed 7-day lookahead — separate from per-project email notif settings.
const DUE_SOON_WINDOW = 7;

router.get('/due-soon', async (req, res) => {
  const userId = (req as any).user?.userId as string;
  const db = getDb();
  const { payrollWeeks: pw, projectMembers } = await import('../db/schema.js');
  const { sql: sq } = await import('drizzle-orm');

  const memberships = db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(eq(projectMembers.userId, userId))
    .all();

  if (memberships.length === 0) return res.json([]);

  const projectIds = memberships.map((m: { projectId: string }) => m.projectId);
  const today = new Date().toISOString().slice(0, 10);
  const windowEnd = new Date(Date.now() + DUE_SOON_WINDOW * 86_400_000).toISOString().slice(0, 10);

  const idList = sq.join(projectIds.map((id: string) => sq`${id}`), sq`, `);

  const rows = db
    .select({
      weekId: pw.id,
      projectId: pw.projectId,
      weekEndingDate: pw.weekEndingDate,
      payrollNumber: pw.payrollNumber,
      projectName: projects.name,
    })
    .from(pw)
    .innerJoin(projects, eq(pw.projectId, projects.id))
    .where(sq`${pw.submittedAt} IS NULL AND ${pw.projectId} IN (${idList}) AND ${pw.weekEndingDate} <= ${windowEnd}`)
    .orderBy(pw.weekEndingDate)
    .all();

  const result = rows.map((r: typeof rows[number]) => ({
    weekId: r.weekId,
    projectId: r.projectId,
    projectName: r.projectName,
    weekEndingDate: r.weekEndingDate,
    payrollNumber: r.payrollNumber,
    status: r.weekEndingDate < today ? 'overdue' : r.weekEndingDate === today ? 'due-today' : 'due-soon',
    daysUntil: Math.round(
      (new Date(r.weekEndingDate + 'T00:00:00Z').getTime() - new Date(today + 'T00:00:00Z').getTime()) / 86_400_000,
    ),
  }));

  res.json(result);
});

export { router as payrollRouter };
