// Phase 96 — Contractor digital signature routes (MOB-19)
// POST   /api/projects/:projectId/signature  — receive PNG blob, upsert to disk+DB
// GET    /api/projects/:projectId/signature  — return signature metadata + data URL
// DELETE /api/projects/:projectId/signature  — remove signature
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { contractorSignatures } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { assertProjectAccess } from '../utils/assertProjectAccess.js';

const SIGNATURES_DIR = process.env.SIGNATURES_DIR || './var/data/signatures';
fs.mkdirSync(SIGNATURES_DIR, { recursive: true });

const sigStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, SIGNATURES_DIR),
  filename: (_req, _file, cb) => cb(null, `sig-${randomUUID()}.png`),
});

const sigUpload = multer({
  storage: sigStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB max for a signature PNG
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg') cb(null, true);
    else cb(new Error('Signature must be PNG or JPEG'));
  },
});

const router = Router();
router.use(requireAuth);

// POST — upsert signature for project
router.post('/:projectId/signature', (req, res, next) => {
  sigUpload.single('signature')(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Upload error' });
      return;
    }
    next();
  });
}, async (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const userId = req.user!.userId;
  const db = getDb();
  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(err.status ?? 500).json({ error: err.message });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: 'No signature file provided' });
    return;
  }

  const now = new Date().toISOString();
  const filePath = path.relative(SIGNATURES_DIR, req.file.path).replace(/\\/g, '/');

  // Upsert: delete old file + row if exists
  const [existing] = await db.select().from(contractorSignatures).where(eq(contractorSignatures.projectId, projectId)).limit(1);
  if (existing) {
    const oldAbs = path.join(SIGNATURES_DIR, existing.filePath);
    fs.unlink(oldAbs, () => {});
    await db.delete(contractorSignatures).where(eq(contractorSignatures.projectId, projectId));
  }

  const id = randomUUID();
  await db.insert(contractorSignatures).values({
    id,
    projectId,
    uploadedBy: userId,
    filePath,
    createdAt: now,
    updatedAt: now,
  });
  const [sig] = await db.select().from(contractorSignatures).where(eq(contractorSignatures.id, id)).limit(1);
  res.status(201).json({ data: { signature: sig } });
});

// GET — return signature record + base64 data URL for display
router.get('/:projectId/signature', async (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const userId = req.user!.userId;
  const db = getDb();
  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message });
    return;
  }

  const [sig] = await db.select().from(contractorSignatures).where(eq(contractorSignatures.projectId, projectId)).limit(1);
  if (!sig) {
    res.status(404).json({ error: 'No signature on file' });
    return;
  }

  const absPath = path.join(SIGNATURES_DIR, sig.filePath);
  if (!fs.existsSync(absPath)) {
    res.status(404).json({ error: 'Signature file not found' });
    return;
  }

  const buffer = fs.readFileSync(absPath);
  const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;
  res.json({ data: { signature: { ...sig, dataUrl } } });
});

// DELETE — remove signature
router.delete('/:projectId/signature', async (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const userId = req.user!.userId;
  const db = getDb();
  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message });
    return;
  }

  const [sig] = await db.select().from(contractorSignatures).where(eq(contractorSignatures.projectId, projectId)).limit(1);
  if (!sig) {
    res.status(404).json({ error: 'No signature on file' });
    return;
  }
  const absPath = path.join(SIGNATURES_DIR, sig.filePath);
  fs.unlink(absPath, () => {});
  await db.delete(contractorSignatures).where(eq(contractorSignatures.projectId, projectId));
  res.json({ data: { ok: true } });
});

export default router;
