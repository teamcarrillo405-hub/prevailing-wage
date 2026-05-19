import { Router } from 'express';
import { sql } from 'drizzle-orm';
import { getDb } from '../db/index.js';

const router = Router();

// GET /api/agency/projects — returns projects the reviewer has access to
router.get('/projects', async (req, res) => {
  try {
    const db = getDb();
    const userId = req.user!.userId;
    const rows = await db.all(sql`
      SELECT p.id, p.name, p.status, p.funding_type, rpa.granted_at
      FROM projects p
      JOIN reviewer_project_access rpa ON rpa.project_id = p.id
      WHERE rpa.reviewer_user_id = ${userId}
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// GET /api/agency/projects/:id/weeks — returns payroll weeks for a project (read-only)
router.get('/projects/:id/weeks', async (req, res) => {
  try {
    const db = getDb();
    const userId = req.user!.userId;
    const projectId = req.params.id;
    const access = await db.get(sql`
      SELECT 1 FROM reviewer_project_access
      WHERE reviewer_user_id = ${userId} AND project_id = ${projectId}
    `);
    if (!access) return res.status(403).json({ error: 'NO_ACCESS' });
    const weeks = await db.all(sql`
      SELECT id, project_id, week_ending_date, submitted_at, submitted_to, amendment_number
      FROM payroll_weeks
      WHERE project_id = ${projectId}
      ORDER BY week_ending_date DESC
    `);
    res.json(weeks);
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// POST /api/agency/weeks/:weekId/review — creates a review comment/stamp
router.post('/weeks/:weekId/review', async (req, res) => {
  try {
    const db = getDb();
    const userId = req.user!.userId;
    const weekId = req.params.weekId;
    const { comment, review_stamp } = req.body as { comment?: string; review_stamp?: string };
    if (!comment) return res.status(400).json({ error: 'COMMENT_REQUIRED' });
    const stamp = review_stamp ?? 'pending';
    await db.run(sql`
      INSERT INTO payroll_week_comments (week_id, user_id, comment, review_stamp)
      VALUES (${weekId}, ${userId}, ${comment}, ${stamp})
    `);
    // Get the last inserted id
    const row = await db.get(sql`SELECT last_insert_rowid() as id`);
    const insertedId = (row as { id: number } | undefined)?.id;
    res.status(201).json({ id: insertedId });
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

export default router;
