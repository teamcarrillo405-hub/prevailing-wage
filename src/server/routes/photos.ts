// Phase 76 — Field Photo Capture routes (MOB-09)
// POST /api/projects/:projectId/weeks/:weekId/photos  — multer upload, save, return photo
// GET  /api/projects/:projectId/weeks/:weekId/photos  — list photos for week
// DELETE /api/projects/:projectId/weeks/:weekId/photos/:photoId — delete file + DB row
// GET  /api/photos/:photoId/file                      — stream file from disk
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { weekPhotos } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { assertProjectAccess } from '../utils/assertProjectAccess.js';

const router = Router();
router.use(requireAuth);

const PHOTOS_DIR = process.env.PHOTOS_DIR || './var/data/photos';
// Ensure directory exists at module load time
fs.mkdirSync(PHOTOS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PHOTOS_DIR),
  filename: (_req, _file, cb) => {
    const ext = path.extname(_file.originalname).toLowerCase() || '.jpg';
    cb(null, `photo-${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// ── POST /api/projects/:projectId/weeks/:weekId/photos ──────────────────────
router.post('/:projectId/weeks/:weekId/photos', (req, res, next) => {
  upload.single('photo')(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'File upload error' });
      return;
    }
    next();
  });
}, async (req, res) => {
  const { projectId, weekId } = req.params as { projectId: string; weekId: string };
  const userId = req.user!.userId;
  const db = getDb();

  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    // Clean up uploaded file if access denied
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: 'No photo file provided' });
    return;
  }

  const now = new Date().toISOString();
  const id = randomUUID();
  // Store path relative to PHOTOS_DIR for portability
  const filePath = path.relative(PHOTOS_DIR, req.file.path).replace(/\\/g, '/');

  const caption = typeof req.body.caption === 'string' ? req.body.caption.trim() || null : null;
  const takenAt = typeof req.body.takenAt === 'string' ? req.body.takenAt : now;
  const latitude = req.body.latitude != null ? parseFloat(req.body.latitude) : null;
  const longitude = req.body.longitude != null ? parseFloat(req.body.longitude) : null;

  await db.insert(weekPhotos).values({
    id,
    projectId,
    payrollWeekId: weekId,
    uploadedBy: userId,
    filePath,
    caption,
    takenAt,
    latitude: isNaN(latitude as number) ? null : latitude,
    longitude: isNaN(longitude as number) ? null : longitude,
    createdAt: now,
  });

  const [photo] = await db.select().from(weekPhotos).where(eq(weekPhotos.id, id)).limit(1);
  res.status(201).json({ data: { photo } });
});

// ── GET /api/projects/:projectId/weeks/:weekId/photos ───────────────────────
router.get('/:projectId/weeks/:weekId/photos', async (req, res) => {
  const { projectId, weekId } = req.params as { projectId: string; weekId: string };
  const userId = req.user!.userId;
  const db = getDb();

  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  const photos = await db
    .select()
    .from(weekPhotos)
    .where(and(eq(weekPhotos.projectId, projectId), eq(weekPhotos.payrollWeekId, weekId)));

  res.json({ data: { photos } });
});

// ── DELETE /api/projects/:projectId/weeks/:weekId/photos/:photoId ───────────
router.delete('/:projectId/weeks/:weekId/photos/:photoId', async (req, res) => {
  const { projectId, weekId, photoId } = req.params as {
    projectId: string; weekId: string; photoId: string;
  };
  const userId = req.user!.userId;
  const db = getDb();

  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  const [photo] = await db
    .select()
    .from(weekPhotos)
    .where(
      and(
        eq(weekPhotos.id, photoId),
        eq(weekPhotos.projectId, projectId),
        eq(weekPhotos.payrollWeekId, weekId),
      ),
    )
    .limit(1);

  if (!photo) {
    res.status(404).json({ error: 'Photo not found' });
    return;
  }

  // Delete file from disk (non-blocking; don't fail request if file already gone)
  const absPath = path.join(PHOTOS_DIR, photo.filePath);
  fs.unlink(absPath, (unlinkErr) => {
    if (unlinkErr && unlinkErr.code !== 'ENOENT') {
      console.error('[photos] Failed to delete file:', unlinkErr);
    }
  });

  await db.delete(weekPhotos).where(eq(weekPhotos.id, photoId));
  res.json({ data: { ok: true } });
});

// ── GET /api/photos/:photoId/file — stream file, auth via photoId→projectId ─
// NOTE: This route is exported separately (mounted at /api/photos) in index.ts
export const photoFileRouter = Router();
photoFileRouter.use(requireAuth);

photoFileRouter.get('/:photoId/file', async (req, res) => {
  const { photoId } = req.params as { photoId: string };
  const userId = req.user!.userId;
  const db = getDb();

  const [photo] = await db.select().from(weekPhotos).where(eq(weekPhotos.id, photoId)).limit(1);
  if (!photo) {
    res.status(404).json({ error: 'Photo not found' });
    return;
  }

  // Auth check via projectId lookup
  try {
    await assertProjectAccess(db, photo.projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  const absPath = path.join(PHOTOS_DIR, photo.filePath);
  if (!fs.existsSync(absPath)) {
    res.status(404).json({ error: 'Photo file not found on disk' });
    return;
  }

  res.sendFile(path.resolve(absPath));
});

export default router;
