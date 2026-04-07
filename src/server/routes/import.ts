// src/server/routes/import.ts
// Express router for payroll CSV import: preview (multipart) + commit (JSON).
// Phase 35 Plan 02 — Payroll Import Server Pipeline.

import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { assertProjectAccess } from '../utils/assertProjectAccess.js';
import { getPayrollWeek } from '../services/payrollService.js';
import { parseImportFile } from '../services/importService.js';
import { getDb } from '../db/index.js';
import { payrollEntries, payrollImports } from '../db/schema.js';
import type { ImportedRow, ImportProvider } from '../services/importTypes.js';

export const importRouter = Router();
importRouter.use(requireAuth);

// ── multer setup: memory storage, 5 MB limit, CSV MIME types only (D-14) ──

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per D-14
  fileFilter: (_req, file, cb) => {
    const allowed = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// ── POST /preview ─────────────────────────────────────────────────────────
// Accepts multipart/form-data with a CSV file field "file" and a form field "weekId".
// Returns ImportPreviewResult JSON on success.

importRouter.post('/preview', (req, res) => {
  // Wrap multer in manual invocation to catch MulterError as 400 (not 500)
  upload.single('file')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      res.status(400).json({
        error: err.code === 'LIMIT_FILE_SIZE' ? 'File too large. Maximum 5 MB.' : err.message,
      });
      return;
    }
    if (err) {
      res.status(400).json({ error: (err as Error).message ?? 'Upload error' });
      return;
    }

    const weekId = (req.body as { weekId?: string }).weekId;
    if (!weekId) {
      res.status(400).json({ error: 'weekId is required' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const week = await getPayrollWeek(weekId);
    if (!week) {
      res.status(404).json({ error: 'Payroll week not found' });
      return;
    }

    const db = getDb();
    const userId = req.user!.userId;

    try {
      await assertProjectAccess(db, week.projectId, userId);
    } catch (accessErr: any) {
      res.status(accessErr.status ?? 500).json({ error: accessErr.message ?? 'Internal server error' });
      return;
    }

    // Submitted-week guard (D-10) — non-negotiable
    if (week.submittedAt) {
      res.status(423).json({ error: 'This payroll week is submitted and cannot be modified.' });
      return;
    }

    try {
      const previewResult = await parseImportFile(req.file.buffer, weekId, week.projectId, db);
      res.json(previewResult);
    } catch (parseErr: any) {
      res.status(400).json({ error: parseErr.message ?? 'Failed to parse import file' });
    }
  });
});

// ── POST /commit ──────────────────────────────────────────────────────────
// Accepts JSON body with resolved rows. Creates payrollEntries + audit row.
// Does NOT re-parse the file (D-09) — client sends the resolved rows back.

interface CommitBody {
  weekId: string;
  provider: ImportProvider;
  matched: ImportedRow[];
  unmatchedCount?: number;
  sourceFilename?: string;
}

importRouter.post('/commit', async (req, res) => {
  const body = req.body as CommitBody;
  const userId = req.user!.userId;

  if (!body.weekId || !body.provider || !Array.isArray(body.matched)) {
    res.status(400).json({ error: 'weekId, provider, and matched array are required' });
    return;
  }

  const week = await getPayrollWeek(body.weekId);
  if (!week) {
    res.status(404).json({ error: 'Payroll week not found' });
    return;
  }

  const db = getDb();

  try {
    await assertProjectAccess(db, week.projectId, userId);
  } catch (accessErr: any) {
    res.status(accessErr.status ?? 500).json({ error: accessErr.message ?? 'Internal server error' });
    return;
  }

  // Submitted-week guard (D-10) — non-negotiable
  if (week.submittedAt) {
    res.status(423).json({ error: 'This payroll week is submitted and cannot be modified.' });
    return;
  }

  // Re-validate: conflict check before any inserts (D-06, per context pitfalls)
  const existingEntries = await db
    .select({
      workerId: payrollEntries.workerId,
      classificationId: payrollEntries.classificationId,
    })
    .from(payrollEntries)
    .where(eq(payrollEntries.payrollWeekId, body.weekId));

  const conflictSet = new Set(
    existingEntries.map((e: { workerId: string; classificationId: string }) => `${e.workerId}::${e.classificationId}`),
  );

  const conflicts = body.matched.filter(
    (row) => conflictSet.has(`${row.workerId}::${row.classificationId}`),
  );

  if (conflicts.length > 0) {
    res.status(409).json({
      error: 'Some workers already have entries for this week. Delete existing entries before importing.',
      conflicts: conflicts.map((c) => ({ workerId: c.workerId, workerName: c.workerName })),
    });
    return;
  }

  const now = new Date().toISOString();

  // Insert payrollEntries for each matched row
  for (const row of body.matched) {
    await db.insert(payrollEntries).values({
      id: randomUUID(),
      payrollWeekId: body.weekId,
      workerId: row.workerId,
      classificationId: row.classificationId,
      monSt: row.monSt,
      tueSt: row.tueSt,
      wedSt: row.wedSt,
      thuSt: row.thuSt,
      friSt: row.friSt,
      satSt: row.satSt,
      sunSt: row.sunSt,
      monOt: row.monOt,
      tueOt: row.tueOt,
      wedOt: row.wedOt,
      thuOt: row.thuOt,
      friOt: row.friOt,
      satOt: row.satOt,
      sunOt: row.sunOt,
      monDt: 0,
      tueDt: 0,
      wedDt: 0,
      thuDt: 0,
      friDt: 0,
      satDt: 0,
      sunDt: 0,
      baseRateSnapshot: row.baseRateSnapshot,
      fringeRateSnapshot: row.fringeRateSnapshot,
      grossWages: null,
      deductions: 0,
      netPay: null,
      fringeHealthWelfare: null,
      fringePension: null,
      fringeVacation: null,
      fringeTraining: null,
      createdByUserId: userId,
      updatedByUserId: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Insert payrollImports audit row (D-11)
  const importId = randomUUID();
  await db.insert(payrollImports).values({
    id: importId,
    payrollWeekId: body.weekId,
    importedByUserId: userId,
    provider: body.provider,
    sourceFilename: body.sourceFilename ?? null,
    committedCount: body.matched.length,
    unmatchedCount: body.unmatchedCount ?? 0,
    createdAt: now,
  });

  // Best-effort audit log (AUDIT-03)
  try {
    const { insertAuditLog } = await import('../services/auditService.js');
    await insertAuditLog({
      userId,
      userEmail: req.user!.email,
      ipAddress: req.ip ?? null,
      projectId: week.projectId,
      entityType: 'payroll_import',
      entityId: importId,
      action: 'payroll_import.committed',
      meta: {
        provider: body.provider,
        committedCount: body.matched.length,
        sourceFilename: body.sourceFilename ?? null,
        weekEnding: week.weekEndingDate,
      },
    });
  } catch (auditErr) { console.error('[audit]', auditErr); }

  res.json({ committed: body.matched.length });
});
