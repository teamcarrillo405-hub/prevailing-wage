import { logger } from '../logger.js';
import { Router } from 'express';
import { z } from 'zod';
import { randomUUID, randomBytes } from 'crypto';
import path from 'path';
import fs from 'fs';
import { eq, and, desc } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { payrollWeeks, subcontractors, subcontractorCprWeeks, subcontractorCertifications, projects } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { assertProjectAccess, assertProjectWriteAccess } from '../utils/assertProjectAccess.js';
import { sendSubUploadRequestEmail } from '../services/emailService.js';
import { deliverWebhook, WEBHOOK_EVENT_SUBCONTRACTOR_CPR_RECEIVED } from '../services/webhookService.js';

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
  dbeClassification: z.enum(['none', 'dbe', 'mbe', 'wbe', 'sdvosb']).optional().default('none'),
});

const UpdateSubSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  licenseNumber: z.string().max(200).optional().nullable(),
  contactName: z.string().max(200).optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  dbeClassification: z.enum(['none', 'dbe', 'mbe', 'wbe', 'sdvosb']).optional(),
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

const RequestCprWeekSchema = z.object({
  subcontractorId: z.string().min(1),
  weekEndingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'weekEndingDate must be YYYY-MM-DD'),
});

function getCprQueueStatus(weekEndingDate: string, receivedDate: string | null, isCompliant: number | null) {
  if (receivedDate) return isCompliant === 1 ? 'received-compliant' : 'received-non-compliant';
  const weekMs = new Date(`${weekEndingDate}T00:00:00.000Z`).getTime();
  const daysAgo = Math.floor((Date.now() - weekMs) / 86_400_000);
  return daysAgo > 7 ? 'overdue' : 'not-received';
}

function getDaysLate(weekEndingDate: string): number {
  const dueMs = new Date(`${weekEndingDate}T00:00:00.000Z`).getTime() + 7 * 86_400_000;
  return Math.max(0, Math.floor((Date.now() - dueMs) / 86_400_000));
}

// ── SUB-03: Subcontractor CRUD ─────────────────────────────────────────────

// GET /:id/subcontractors — list all subcontractors for a project
router.get('/:id/subcontractor-cpr-queue', async (req, res) => {
  const projectId = req.params.id as string;
  const userId = req.user!.userId;
  const db = getDb();
  const includeComplete = req.query.includeComplete === 'true';

  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  const [subRows, weekRows, cprRows] = await Promise.all([
    db
      .select({
        id: subcontractors.id,
        name: subcontractors.name,
        contactEmail: subcontractors.contactEmail,
      })
      .from(subcontractors)
      .where(eq(subcontractors.projectId, projectId)),
    db
      .select({
        id: payrollWeeks.id,
        payrollNumber: payrollWeeks.payrollNumber,
        weekEndingDate: payrollWeeks.weekEndingDate,
      })
      .from(payrollWeeks)
      .where(eq(payrollWeeks.projectId, projectId))
      .orderBy(desc(payrollWeeks.weekEndingDate)),
    db
      .select({
        id: subcontractorCprWeeks.id,
        subcontractorId: subcontractorCprWeeks.subcontractorId,
        weekEndingDate: subcontractorCprWeeks.weekEndingDate,
        receivedDate: subcontractorCprWeeks.receivedDate,
        isCompliant: subcontractorCprWeeks.isCompliant,
        notes: subcontractorCprWeeks.notes,
        uploadTokenExpiresAt: subcontractorCprWeeks.uploadTokenExpiresAt,
        uploadedAt: subcontractorCprWeeks.uploadedAt,
      })
      .from(subcontractorCprWeeks)
      .innerJoin(subcontractors, eq(subcontractors.id, subcontractorCprWeeks.subcontractorId))
      .where(eq(subcontractors.projectId, projectId)),
  ]);

  const typedSubRows = subRows as Array<{ id: string; name: string; contactEmail: string | null }>;
  const typedWeekRows = weekRows as Array<{ id: string; payrollNumber: number; weekEndingDate: string }>;
  const typedCprRows = cprRows as Array<{
    id: string;
    subcontractorId: string;
    weekEndingDate: string;
    receivedDate: string | null;
    isCompliant: number | null;
    notes: string | null;
    uploadTokenExpiresAt: string | null;
    uploadedAt: string | null;
  }>;

  const cprBySubAndWeek = new Map(
    typedCprRows.map((row) => [`${row.subcontractorId}::${row.weekEndingDate}`, row]),
  );
  const weekRowsByDate = new Map(typedWeekRows.map((week) => [week.weekEndingDate, week]));
  const allWeekRows = [
    ...typedWeekRows,
    ...typedCprRows
      .filter((row) => !weekRowsByDate.has(row.weekEndingDate))
      .map((row) => ({
        id: null,
        payrollNumber: null,
        weekEndingDate: row.weekEndingDate,
      })),
  ] as Array<{ id: string | null; payrollNumber: number | null; weekEndingDate: string }>;

  const queue = typedSubRows.flatMap((sub) => allWeekRows.map((week) => {
    const cpr = cprBySubAndWeek.get(`${sub.id}::${week.weekEndingDate}`);
    const status = getCprQueueStatus(week.weekEndingDate, cpr?.receivedDate ?? null, cpr?.isCompliant ?? null);
    return {
      subcontractorId: sub.id,
      subcontractorName: sub.name,
      contactEmail: sub.contactEmail,
      weekId: cpr?.id ?? null,
      payrollWeekId: week.id,
      payrollNumber: week.payrollNumber,
      weekEndingDate: week.weekEndingDate,
      receivedDate: cpr?.receivedDate ?? null,
      isCompliant: cpr?.isCompliant ?? null,
      status,
      daysLate: cpr?.receivedDate ? 0 : getDaysLate(week.weekEndingDate),
      notes: cpr?.notes ?? null,
      uploadTokenExpiresAt: cpr?.uploadTokenExpiresAt ?? null,
      uploadedAt: cpr?.uploadedAt ?? null,
      nextAction:
        status === 'received-compliant'
          ? 'No action needed.'
          : status === 'received-non-compliant'
          ? 'Request corrected CPR and document the issue.'
          : sub.contactEmail
          ? 'Send CPR upload request.'
          : 'Add a subcontractor contact email.',
    };
  }))
    .filter((row) => includeComplete || row.status === 'overdue' || row.status === 'not-received' || row.status === 'received-non-compliant')
    .sort((a, b) => {
      const rank: Record<string, number> = { overdue: 0, 'received-non-compliant': 1, 'not-received': 2 };
      return (rank[a.status] ?? 3) - (rank[b.status] ?? 3) || a.weekEndingDate.localeCompare(b.weekEndingDate);
    });

  const summary = {
    total: queue.length,
    overdue: queue.filter((row) => row.status === 'overdue').length,
    notReceived: queue.filter((row) => row.status === 'not-received').length,
    nonCompliant: queue.filter((row) => row.status === 'received-non-compliant').length,
    readyToRequest: queue.filter((row) => row.contactEmail && (row.status === 'overdue' || row.status === 'not-received')).length,
  };

  res.json({ data: { queue, summary } });
});

router.post('/:id/subcontractor-cpr-queue/request-bulk', async (req, res) => {
  const projectId = req.params.id as string;
  const userId = req.user!.userId;
  const db = getDb();

  try {
    await assertProjectWriteAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  const [subRows, weekRows] = await Promise.all([
    db.select().from(subcontractors).where(eq(subcontractors.projectId, projectId)),
    db.select().from(payrollWeeks).where(eq(payrollWeeks.projectId, projectId)).orderBy(desc(payrollWeeks.weekEndingDate)).limit(4),
  ]);

  let created = 0;
  let emailed = 0;
  const requests: Array<{ subcontractorId: string; subcontractorName: string; weekEndingDate: string; uploadUrl: string; emailed: boolean }> = [];

  for (const sub of subRows) {
    if (!sub.contactEmail) continue;
    for (const week of weekRows) {
      const [existing] = await db.select().from(subcontractorCprWeeks)
        .where(and(eq(subcontractorCprWeeks.subcontractorId, sub.id), eq(subcontractorCprWeeks.weekEndingDate, week.weekEndingDate)))
        .limit(1);
      if (existing?.receivedDate) continue;

      const uploadToken = randomBytes(32).toString('hex');
      const uploadTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const now = new Date().toISOString();

      if (existing) {
        await db.update(subcontractorCprWeeks)
          .set({ uploadToken, uploadTokenExpiresAt })
          .where(eq(subcontractorCprWeeks.id, existing.id));
      } else {
        await db.insert(subcontractorCprWeeks).values({
          id: randomUUID(),
          subcontractorId: sub.id,
          weekEndingDate: week.weekEndingDate,
          receivedDate: null,
          isCompliant: null,
          notes: null,
          uploadToken,
          uploadTokenExpiresAt,
          uploadedAt: null,
          uploadPath: null,
          createdAt: now,
        });
        created += 1;
      }

      const uploadUrl = `${process.env.APP_URL || 'http://localhost:3000'}/sub-upload/${uploadToken}`;
      const [project] = await db.select({ name: projects.name }).from(projects).where(eq(projects.id, projectId)).limit(1);
      await sendSubUploadRequestEmail({
        toEmail: sub.contactEmail,
        subName: sub.name,
        projectName: project?.name ?? 'Project',
        weekEndingDate: week.weekEndingDate,
        uploadUrl,
      });
      emailed += 1;
      requests.push({ subcontractorId: sub.id, subcontractorName: sub.name, weekEndingDate: week.weekEndingDate, uploadUrl, emailed: true });
    }
  }

  res.json({ data: { created, emailed, requests } });
});

router.post('/:id/subcontractor-cpr-queue/request', validate(RequestCprWeekSchema), async (req, res) => {
  const projectId = req.params.id as string;
  const userId = req.user!.userId;
  const db = getDb();
  const body = req.body as z.infer<typeof RequestCprWeekSchema>;

  try {
    await assertProjectWriteAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  const [sub] = await db
    .select()
    .from(subcontractors)
    .where(and(eq(subcontractors.id, body.subcontractorId), eq(subcontractors.projectId, projectId)))
    .limit(1);

  if (!sub) {
    res.status(404).json({ error: 'Subcontractor not found' });
    return;
  }

  const now = new Date().toISOString();
  const uploadToken = randomBytes(32).toString('hex');
  const uploadTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const [existing] = await db
    .select()
    .from(subcontractorCprWeeks)
    .where(and(
      eq(subcontractorCprWeeks.subcontractorId, body.subcontractorId),
      eq(subcontractorCprWeeks.weekEndingDate, body.weekEndingDate),
    ))
    .limit(1);

  let cprWeek: typeof subcontractorCprWeeks.$inferSelect;
  if (existing) {
    const [updated] = await db
      .update(subcontractorCprWeeks)
      .set({ uploadToken, uploadTokenExpiresAt })
      .where(eq(subcontractorCprWeeks.id, existing.id))
      .returning();
    cprWeek = updated;
  } else {
    const [created] = await db
      .insert(subcontractorCprWeeks)
      .values({
        id: randomUUID(),
        subcontractorId: body.subcontractorId,
        weekEndingDate: body.weekEndingDate,
        receivedDate: null,
        isCompliant: null,
        notes: null,
        uploadToken,
        uploadTokenExpiresAt,
        uploadedAt: null,
        uploadPath: null,
        createdAt: now,
      })
      .returning();
    cprWeek = created;
  }

  const [project] = await db
    .select({ name: projects.name })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  const uploadUrl = `${process.env.APP_URL || 'http://localhost:3000'}/sub-upload/${uploadToken}`;
  if (sub.contactEmail) {
    await sendSubUploadRequestEmail({
      toEmail: sub.contactEmail,
      subName: sub.name,
      projectName: project?.name ?? 'Project',
      weekEndingDate: body.weekEndingDate,
      uploadUrl,
    });
  }

  res.status(existing ? 200 : 201).json({
    data: {
      cprWeek,
      uploadUrl,
      emailed: Boolean(sub.contactEmail),
    },
  });
});

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

  // DBE-05: Attach cert summary to each sub so the participation card can be derived
  // without additional per-sub round trips.
  const today = new Date().toISOString().slice(0, 10);
  const subsWithCertSummary = await Promise.all(
    rows.map(async (sub: typeof rows[number]) => {
      const certs = await db
        .select({
          expiresDate: subcontractorCertifications.expiresDate,
          reevaluationStatus: subcontractorCertifications.reevaluationStatus,
        })
        .from(subcontractorCertifications)
        .where(eq(subcontractorCertifications.subcontractorId, sub.id));

      type CertRow = typeof certs[number];
      const hasExpiredCert = certs.some((c: CertRow) => c.expiresDate && c.expiresDate < today);
      const hasSuspendedCert = certs.some((c: CertRow) => c.reevaluationStatus === 'suspended');
      const hasPendingCert = certs.some((c: CertRow) => c.reevaluationStatus === 'pending');
      const isCertified = certs.length > 0;

      return {
        ...sub,
        certSummary: {
          certCount: certs.length,
          isCertified,
          hasExpiredCert,
          hasSuspendedCert,
          hasPendingCert,
        },
      };
    }),
  );

  res.json({ data: { subcontractors: subsWithCertSummary } });
});

// POST /:id/subcontractors — create a subcontractor
router.post('/:id/subcontractors', validate(CreateSubSchema), async (req, res) => {
  const projectId = req.params.id as string;
  const userId = req.user!.userId;
  const db = getDb();

  try {
    await assertProjectWriteAccess(db, projectId, userId);
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
    dbeClassification: body.dbeClassification ?? 'none',
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
  } catch (auditErr) { logger.error({ err: auditErr }, '[audit]'); }

  res.status(201).json({ data: { subcontractor: newSub } });
});

// PATCH /:id/subcontractors/:subId — update a subcontractor
router.patch('/:id/subcontractors/:subId', validate(UpdateSubSchema), async (req, res) => {
  const projectId = req.params.id as string;
  const subId = req.params.subId as string;
  const userId = req.user!.userId;
  const db = getDb();

  try {
    await assertProjectWriteAccess(db, projectId, userId);
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
      ...(body.dbeClassification !== undefined ? { dbeClassification: body.dbeClassification } : {}),
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
    await assertProjectWriteAccess(db, projectId, userId);
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
  } catch (auditErr) { logger.error({ err: auditErr }, '[audit]'); }

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
    await assertProjectWriteAccess(db, projectId, userId);
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

  // DBE-04: Block CPR creation if the sub has an expired or suspended certification
  const subCerts = await db
    .select({
      expiresDate: subcontractorCertifications.expiresDate,
      reevaluationStatus: subcontractorCertifications.reevaluationStatus,
    })
    .from(subcontractorCertifications)
    .where(eq(subcontractorCertifications.subcontractorId, subId));

  const today = new Date().toISOString().slice(0, 10);
  type SubCertRow = typeof subCerts[number];
  const hasSuspendedCert = subCerts.some((c: SubCertRow) => c.reevaluationStatus === 'suspended');
  const hasExpiredCert = subCerts.some((c: SubCertRow) => c.expiresDate && c.expiresDate < today);

  if (hasSuspendedCert || hasExpiredCert) {
    res.status(422).json({
      error: hasSuspendedCert
        ? 'Sub has a suspended DBE certification — resolve before accepting CPR'
        : 'Sub has an expired certification — renew before accepting CPR',
      code: 'CERT_EXPIRED_OR_SUSPENDED',
    });
    return;
  }

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
  const uploadToken = randomBytes(32).toString('hex');
  const uploadTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await db.insert(subcontractorCprWeeks).values({
    id,
    subcontractorId: subId,
    weekEndingDate: body.weekEndingDate,
    receivedDate: body.receivedDate ?? null,
    isCompliant: body.isCompliant ?? null,
    notes: body.notes ?? null,
    uploadToken,
    uploadTokenExpiresAt,
    createdAt: now,
  });

  const [newWeek] = await db
    .select()
    .from(subcontractorCprWeeks)
    .where(eq(subcontractorCprWeeks.id, id))
    .limit(1);

  // Email sub contact if they have an email on file
  if (sub.contactEmail) {
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const uploadUrl = `${baseUrl}/sub-upload/${uploadToken}`;
    const [projectRow] = await db.select({ name: projects.name }).from(projects).where(eq(projects.id, projectId)).limit(1);
    await sendSubUploadRequestEmail({
      toEmail: sub.contactEmail,
      subName: sub.name,
      projectName: projectRow?.name ?? projectId,
      weekEndingDate: body.weekEndingDate,
      uploadUrl,
    });
  }

  // Fire webhook (non-blocking)
  void deliverWebhook(userId, WEBHOOK_EVENT_SUBCONTRACTOR_CPR_RECEIVED, {
    event: WEBHOOK_EVENT_SUBCONTRACTOR_CPR_RECEIVED,
    cprWeekId: id,
    subcontractorId: subId,
    projectId,
    weekEndingDate: body.weekEndingDate,
    isCompliant: body.isCompliant ?? null,
  });

  res.status(201).json({ data: { cprWeek: newWeek } });
});

// ── Phase 71: DBE/MBE/WBE Certification CRUD ──────────────────────────────

const CreateCertSchema = z.object({
  certTypes: z.string().min(1),
  certifyingAgency: z.string().optional(),
  certNumber: z.string().optional(),
  naicsCodes: z.string().optional(),
  issueDate: z.string().optional(),
  expiresDate: z.string().optional(),
  reevaluationStatus: z.enum(['not_required', 'pending', 'cleared', 'suspended']).default('not_required'),
  selfCertified: z.boolean().default(false),
  // Phase 82 (Gap-2) — SAM.gov-derived fields
  uei: z.string().min(1).max(20).optional(),
  cageCode: z.string().min(1).max(10).optional(),
  samRegistrationStatus: z.string().max(50).optional(),
});

// Phase 122 (DBE-02): UpdateCertSchema for PATCH cert route — all fields optional
const UpdateCertSchema = z.object({
  certTypes: z.string().min(1).optional(),
  certifyingAgency: z.string().optional().nullable(),
  certNumber: z.string().optional().nullable(),
  naicsCodes: z.string().optional().nullable(),
  issueDate: z.string().optional().nullable(),
  expiresDate: z.string().optional().nullable(),
  reevaluationStatus: z.enum(['not_required', 'pending', 'cleared', 'suspended']).optional(),
  selfCertified: z.boolean().optional(),
  uei: z.string().optional().nullable(),
  cageCode: z.string().optional().nullable(),
  samRegistrationStatus: z.string().optional().nullable(),
});

// GET /:id/subcontractors/:subId/certifications — list certs for a sub
router.get('/:id/subcontractors/:subId/certifications', async (req, res) => {
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

  const [sub] = await db
    .select()
    .from(subcontractors)
    .where(and(eq(subcontractors.id, subId), eq(subcontractors.projectId, projectId)))
    .limit(1);

  if (!sub) {
    res.status(404).json({ error: 'Subcontractor not found' });
    return;
  }

  const certs = await db
    .select()
    .from(subcontractorCertifications)
    .where(eq(subcontractorCertifications.subcontractorId, subId))
    .orderBy(desc(subcontractorCertifications.createdAt));

  res.json({ data: { certifications: certs } });
});

// POST /:id/subcontractors/:subId/certifications — create a cert
router.post('/:id/subcontractors/:subId/certifications', validate(CreateCertSchema), async (req, res) => {
  const projectId = req.params.id as string;
  const subId = req.params.subId as string;
  const userId = req.user!.userId;
  const db = getDb();

  try {
    await assertProjectWriteAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  const [sub] = await db
    .select()
    .from(subcontractors)
    .where(and(eq(subcontractors.id, subId), eq(subcontractors.projectId, projectId)))
    .limit(1);

  if (!sub) {
    res.status(404).json({ error: 'Subcontractor not found' });
    return;
  }

  const body = req.body as z.infer<typeof CreateCertSchema>;

  // DBE-06: certs issued before DOT IFR (Oct 3 2025) default reevaluationStatus to 'pending'
  // when the GC has not explicitly opted out by setting it to 'cleared' or 'suspended'.
  let finalReevalStatus = body.reevaluationStatus;
  if (
    body.issueDate &&
    body.issueDate < '2025-10-03' &&
    body.reevaluationStatus === 'not_required'
  ) {
    finalReevalStatus = 'pending';
  }

  const now = new Date().toISOString();
  const id = randomUUID();

  await db.insert(subcontractorCertifications).values({
    id,
    subcontractorId: subId,
    certTypes: body.certTypes,
    certifyingAgency: body.certifyingAgency ?? null,
    certNumber: body.certNumber ?? null,
    naicsCodes: body.naicsCodes ?? null,
    issueDate: body.issueDate ?? null,
    expiresDate: body.expiresDate ?? null,
    reevaluationStatus: finalReevalStatus,
    selfCertified: body.selfCertified,
    // Phase 82 (Gap-2) — SAM.gov fields persisted at create time
    uei: body.uei ?? null,
    cageCode: body.cageCode ?? null,
    samRegistrationStatus: body.samRegistrationStatus ?? null,
    samLastVerifiedAt: body.samRegistrationStatus ? now : null,
    createdAt: now,
    updatedAt: now,
  });

  const [newCert] = await db
    .select()
    .from(subcontractorCertifications)
    .where(eq(subcontractorCertifications.id, id))
    .limit(1);

  res.status(201).json({ data: { certification: newCert } });
});

// DELETE /:id/subcontractors/:subId/certifications/:certId — remove a cert
router.delete('/:id/subcontractors/:subId/certifications/:certId', async (req, res) => {
  const projectId = req.params.id as string;
  const subId = req.params.subId as string;
  const certId = req.params.certId as string;
  const userId = req.user!.userId;
  const db = getDb();

  try {
    await assertProjectWriteAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  await db
    .delete(subcontractorCertifications)
    .where(and(eq(subcontractorCertifications.id, certId), eq(subcontractorCertifications.subcontractorId, subId)));

  res.json({ data: { deleted: true } });
});

// PATCH /:id/subcontractors/:subId/certifications/:certId — partial update (DBE-02)
router.patch('/:id/subcontractors/:subId/certifications/:certId',
  validate(UpdateCertSchema),
  async (req, res) => {
    const projectId = req.params.id as string;
    const subId = req.params.subId as string;
    const certId = req.params.certId as string;
    const userId = req.user!.userId;
    const db = getDb();

    try {
      await assertProjectWriteAccess(db, projectId, userId);
    } catch (err: any) {
      res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
      return;
    }

    // Verify sub belongs to project
    const [sub] = await db.select().from(subcontractors)
      .where(and(eq(subcontractors.id, subId), eq(subcontractors.projectId, projectId)))
      .limit(1);
    if (!sub) { res.status(404).json({ error: 'Subcontractor not found' }); return; }

    // Verify cert belongs to sub
    const [existing] = await db.select().from(subcontractorCertifications)
      .where(and(
        eq(subcontractorCertifications.id, certId),
        eq(subcontractorCertifications.subcontractorId, subId),
      ))
      .limit(1);
    if (!existing) { res.status(404).json({ error: 'Certification not found' }); return; }

    const body = req.body as z.infer<typeof UpdateCertSchema>;
    const now = new Date().toISOString();

    await db.update(subcontractorCertifications).set({
      certTypes: body.certTypes !== undefined ? body.certTypes : existing.certTypes,
      certifyingAgency: body.certifyingAgency !== undefined ? body.certifyingAgency : existing.certifyingAgency,
      certNumber: body.certNumber !== undefined ? body.certNumber : existing.certNumber,
      naicsCodes: body.naicsCodes !== undefined ? body.naicsCodes : existing.naicsCodes,
      issueDate: body.issueDate !== undefined ? body.issueDate : existing.issueDate,
      expiresDate: body.expiresDate !== undefined ? body.expiresDate : existing.expiresDate,
      reevaluationStatus: body.reevaluationStatus !== undefined ? body.reevaluationStatus : existing.reevaluationStatus,
      selfCertified: body.selfCertified !== undefined ? body.selfCertified : existing.selfCertified,
      uei: body.uei !== undefined ? body.uei : existing.uei,
      cageCode: body.cageCode !== undefined ? body.cageCode : existing.cageCode,
      samRegistrationStatus: body.samRegistrationStatus !== undefined ? body.samRegistrationStatus : existing.samRegistrationStatus,
      updatedAt: now,
    }).where(eq(subcontractorCertifications.id, certId));

    const [updated] = await db.select().from(subcontractorCertifications)
      .where(eq(subcontractorCertifications.id, certId)).limit(1);

    res.json({ data: { certification: updated } });
  }
);

// PATCH /:id/subcontractors/:subId/cpr-weeks/:weekId — update a CPR week record
router.get('/:id/subcontractors/:subId/cpr-weeks/:weekId/file', async (req, res) => {
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

  const [row] = await db
    .select({
      weekEndingDate: subcontractorCprWeeks.weekEndingDate,
      uploadPath: subcontractorCprWeeks.uploadPath,
      subName: subcontractors.name,
    })
    .from(subcontractorCprWeeks)
    .innerJoin(subcontractors, eq(subcontractorCprWeeks.subcontractorId, subcontractors.id))
    .where(and(
      eq(subcontractorCprWeeks.id, weekId),
      eq(subcontractorCprWeeks.subcontractorId, subId),
      eq(subcontractors.projectId, projectId),
    ))
    .limit(1);

  if (!row?.uploadPath) {
    res.status(404).json({ error: 'Uploaded CPR file not found' });
    return;
  }

  const resolvedPath = path.resolve(row.uploadPath);
  if (!fs.existsSync(resolvedPath)) {
    res.status(404).json({ error: 'Uploaded CPR file is missing from storage' });
    return;
  }

  const safeSubName = row.subName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeSubName}-cpr-${row.weekEndingDate}.pdf"`);
  res.sendFile(resolvedPath);
});

router.patch('/:id/subcontractors/:subId/cpr-weeks/:weekId', validate(UpdateCprWeekSchema), async (req, res) => {
  const projectId = req.params.id as string;
  const subId = req.params.subId as string;
  const weekId = req.params.weekId as string;
  const userId = req.user!.userId;
  const db = getDb();

  try {
    await assertProjectWriteAccess(db, projectId, userId);
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
