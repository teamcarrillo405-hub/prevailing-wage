import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { getDb } from '../db/index.js';
import { roiLeads } from '../db/schema.js';
import { validate } from '../middleware/validate.js';

export const roiLeadsRouter = Router();

const roiLeadSchema = z.object({
  email: z.string().email(),
  projectCount: z.number().int().min(1).max(1000),
  workerCount: z.number().int().min(1).max(10000),
  estimatedSavings: z.number().min(0),
});

roiLeadsRouter.post('/', validate(roiLeadSchema), async (req, res, next) => {
  try {
    const { email, projectCount, workerCount, estimatedSavings } =
      req.body as z.infer<typeof roiLeadSchema>;
    const db = getDb();
    const id = randomUUID();
    const capturedAt = new Date().toISOString();
    await db.insert(roiLeads).values({ id, email, projectCount, workerCount, estimatedSavings, capturedAt });
    res.status(201).json({ id, email, projectCount, workerCount, estimatedSavings, capturedAt });
  } catch (err) {
    next(err);
  }
});
