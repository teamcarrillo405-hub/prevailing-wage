import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { payrollWeekClassifications } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { assertProjectAccess } from '../utils/assertProjectAccess.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

const CreateClassificationOverrideSchema = z.object({
  payrollWeekId: z.string().uuid(),
  workerId: z.string().uuid(),
  classificationId: z.string().uuid(),
});

// POST /api/projects/:projectId/payroll-week-classifications
// Upsert: DELETE existing override for this worker+week, then INSERT new one.
// This handles the unique constraint on (payroll_week_id, worker_id).
router.post(
  '/:projectId/payroll-week-classifications',
  validate(CreateClassificationOverrideSchema),
  async (req, res) => {
    const projectId = req.params.projectId as string;
    const userId = req.user!.userId;
    const db = getDb();

    try {
      await assertProjectAccess(db, projectId, userId);
    } catch (err: any) {
      res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
      return;
    }

    const body = req.body as z.infer<typeof CreateClassificationOverrideSchema>;

    // DELETE existing override for this worker+week pair (handles unique constraint on re-override)
    await db
      .delete(payrollWeekClassifications)
      .where(
        and(
          eq(payrollWeekClassifications.payrollWeekId, body.payrollWeekId),
          eq(payrollWeekClassifications.workerId, body.workerId),
        ),
      );

    // INSERT new override row
    const id = randomUUID();
    const now = new Date().toISOString();
    await db.insert(payrollWeekClassifications).values({
      id,
      payrollWeekId: body.payrollWeekId,
      workerId: body.workerId,
      classificationId: body.classificationId,
      createdAt: now,
    });

    const [inserted] = await db
      .select()
      .from(payrollWeekClassifications)
      .where(eq(payrollWeekClassifications.id, id))
      .limit(1);

    res.status(201).json({ data: { classification: inserted } });
  },
);

// DELETE /api/projects/:projectId/payroll-week-classifications/:id
// Remove a specific classification override by its ID.
router.delete('/:projectId/payroll-week-classifications/:id', async (req, res) => {
  const { projectId, id } = req.params as { projectId: string; id: string };
  const userId = req.user!.userId;
  const db = getDb();

  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  await db
    .delete(payrollWeekClassifications)
    .where(eq(payrollWeekClassifications.id, id));

  res.status(204).send();
});

export { router as payrollWeekClassificationsRouter };
