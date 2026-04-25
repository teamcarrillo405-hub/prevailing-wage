import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import { eq, and, gt } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { subcontractorCprWeeks, subcontractors, projects, subcontractorCertifications } from '../db/schema.js';
import { sendSubCprReceivedEmail } from '../services/emailService.js';

const router = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, process.env.UPLOAD_DIR || './uploads'),
  filename: (_req, _file, cb) => {
    cb(null, `sub-cpr-${randomUUID()}.pdf`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files allowed'));
  },
});

// GET /api/sub-upload/:token — fetch week info for the upload form (public)
router.get('/:token', async (req, res) => {
  const { token } = req.params;
  const db = getDb();
  const now = new Date().toISOString();

  const [row] = await db
    .select({ week: subcontractorCprWeeks, sub: subcontractors })
    .from(subcontractorCprWeeks)
    .innerJoin(subcontractors, eq(subcontractorCprWeeks.subcontractorId, subcontractors.id))
    .where(
      and(
        eq(subcontractorCprWeeks.uploadToken, token),
        gt(subcontractorCprWeeks.uploadTokenExpiresAt, now),
      ),
    )
    .limit(1);

  if (!row) {
    res.status(404).json({ error: 'Upload link not found or expired' });
    return;
  }

  res.json({
    subName: row.sub.name,
    weekEndingDate: row.week.weekEndingDate,
    alreadyUploaded: !!row.week.uploadedAt,
  });
});

// POST /api/sub-upload/:token — receive PDF upload (public)
router.post('/:token', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'File upload error' });
      return;
    }
    next();
  });
}, async (req, res) => {
  const token = req.params['token'] as string;
  if (!req.file) {
    res.status(400).json({ error: 'No file provided' });
    return;
  }

  const db = getDb();
  // ISO-8601 strings sort lexicographically in the same order as their timestamps — safe for SQLite gt()
  const now = new Date().toISOString();

  const [row] = await db
    .select({ week: subcontractorCprWeeks, sub: subcontractors, project: projects })
    .from(subcontractorCprWeeks)
    .innerJoin(subcontractors, eq(subcontractorCprWeeks.subcontractorId, subcontractors.id))
    .innerJoin(projects, eq(subcontractors.projectId, projects.id))
    .where(
      and(
        eq(subcontractorCprWeeks.uploadToken, token),
        gt(subcontractorCprWeeks.uploadTokenExpiresAt, now),
      ),
    )
    .limit(1);

  if (!row) {
    res.status(404).json({ error: 'Upload link not found or expired' });
    return;
  }

  if (row.week.uploadedAt) {
    res.status(409).json({ error: 'A file has already been uploaded for this week' });
    return;
  }

  // DBE-04: Block upload if sub has expired or suspended certification
  const subCerts = await db
    .select({
      expiresDate: subcontractorCertifications.expiresDate,
      reevaluationStatus: subcontractorCertifications.reevaluationStatus,
    })
    .from(subcontractorCertifications)
    .where(eq(subcontractorCertifications.subcontractorId, row.sub.id));

  const todayStr = new Date().toISOString().slice(0, 10);
  type SubCertRow = typeof subCerts[number];
  const hasSuspendedCert = subCerts.some((c: SubCertRow) => c.reevaluationStatus === 'suspended');
  const hasExpiredCert = subCerts.some((c: SubCertRow) => c.expiresDate && c.expiresDate < todayStr);

  if (hasSuspendedCert || hasExpiredCert) {
    res.status(422).json({
      error: hasSuspendedCert
        ? 'Sub has a suspended DBE certification — resolve before accepting CPR'
        : 'Sub has an expired certification — renew before accepting CPR',
      code: 'CERT_EXPIRED_OR_SUSPENDED',
    });
    return;
  }

  await db
    .update(subcontractorCprWeeks)
    .set({ uploadPath: req.file.path, uploadedAt: now, receivedDate: now.slice(0, 10) })
    .where(eq(subcontractorCprWeeks.id, row.week.id));

  await sendSubCprReceivedEmail({
    projectId: row.project.id,
    projectName: row.project.name,
    subName: row.sub.name,
    weekEndingDate: row.week.weekEndingDate,
  });

  res.json({ ok: true });
});

export default router;
