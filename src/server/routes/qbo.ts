import { Router } from 'express';
import { writePayrollToQbo } from '../services/qboWriteBack.js';
import { db } from '../db/index.js';
import { payrollWeeks } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const router = Router();

router.post('/certify/:projectId/:weekId', async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const weekId = req.params.weekId;
  if (!process.env.QB_CLIENT_ID) {
    return res.status(501).json({ error: 'QB_NOT_CONFIGURED', message: 'Set QB_CLIENT_ID and QB_CLIENT_SECRET to enable QuickBooks integration.' });
  }
  await db.update(payrollWeeks).set({ qboJournalEntryId: 'PENDING' }).where(eq(payrollWeeks.id, weekId));
  const result = await writePayrollToQbo(projectId, parseInt(weekId), 0, 0);
  res.json({ queued: true, result });
});

export default router;
