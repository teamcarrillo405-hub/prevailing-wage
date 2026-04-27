// Phase 98 — Offline checklist sync endpoint (MOB-22)
// POST /api/checklists/sync — receives completed checklists, stores to checklist_syncs table
import { Router } from 'express';
import { randomUUID } from 'crypto';
import { getDb } from '../db/index.js';
import { checklistSyncs } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// POST /api/checklists/sync
// Body: { checklists: Checklist[] }
router.post('/sync', async (req, res) => {
  const { checklists } = req.body as {
    checklists: Array<{ id: string; projectId: string; [key: string]: unknown }>;
  };
  if (!Array.isArray(checklists) || checklists.length === 0) {
    res.status(400).json({ error: 'checklists array required' });
    return;
  }
  const db = getDb();
  const now = new Date().toISOString();
  const inserted: string[] = [];
  for (const checklist of checklists) {
    if (!checklist.id || !checklist.projectId) continue;
    const id = randomUUID();
    await db.insert(checklistSyncs).values({
      id,
      projectId: checklist.projectId,
      payload: JSON.stringify(checklist),
      syncedAt: now,
    });
    inserted.push(checklist.id);
  }
  res.json({ data: { synced: inserted.length } });
});

export default router;
