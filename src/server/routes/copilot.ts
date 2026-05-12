import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { getDb } from '../db/index.js';
import { copilotInteractions } from '../db/schema.js';
import {
  acknowledgeCopilotAction,
  applyCopilotAction,
  buildCopilotStateSnapshot,
  copilotAcknowledgeActionSchema,
  copilotApplyActionSchema,
  copilotChatSchema,
  copilotPrepareActionSchema,
  copilotVisibleFieldSchema,
  prepareCopilotAction,
  runCopilotChat,
} from '../services/copilotService.js';
import { logger } from '../logger.js';
import { assertProjectAccess } from '../utils/assertProjectAccess.js';

export const copilotRouter = Router();

copilotRouter.use(requireAuth);

function parseSuggestionPayload(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

copilotRouter.get('/interactions', async (req, res) => {
  const limitRaw = Number(req.query.limit ?? 50);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 50;
  const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : null;

  try {
    const db = getDb();
    if (projectId) {
      await assertProjectAccess(db, projectId, req.user!.userId);
    }

    const base = db
      .select({
        id: copilotInteractions.id,
        projectId: copilotInteractions.projectId,
        payrollWeekId: copilotInteractions.payrollWeekId,
        pagePath: copilotInteractions.pagePath,
        userMessage: copilotInteractions.userMessage,
        assistantMessage: copilotInteractions.assistantMessage,
        suggestionsJson: copilotInteractions.suggestionsJson,
        modelUsed: copilotInteractions.modelUsed,
        latencyMs: copilotInteractions.latencyMs,
        createdAt: copilotInteractions.createdAt,
      })
      .from(copilotInteractions)
      .where(projectId ? eq(copilotInteractions.projectId, projectId) : eq(copilotInteractions.userId, req.user!.userId))
      .orderBy(desc(copilotInteractions.createdAt))
      .limit(limit);

    const rows = await base;
    res.json({
      data: rows.map((row: typeof rows[number]) => ({
        ...row,
        suggestions: parseSuggestionPayload(row.suggestionsJson),
      })),
    });
  } catch (err: any) {
    logger.error({ err }, '[copilot] interactions failed');
    res.status(500).json({ error: 'Copilot audit ledger unavailable' });
  }
});

copilotRouter.post('/state', async (req, res) => {
  const parsed = copilotChatSchema
    .pick({ pagePath: true, projectId: true, payrollWeekId: true, visibleFields: true, pageContext: true })
    .extend({ visibleFields: copilotVisibleFieldSchema.array().max(80).optional() })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  try {
    const result = await buildCopilotStateSnapshot({
      userId: req.user!.userId,
      ...parsed.data,
    });
    res.json({ data: result });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    const message = typeof err?.message === 'string' ? err.message : 'Copilot state unavailable';
    logger.error({ err }, '[copilot] state failed');
    res.status(status).json({ error: message });
  }
});

copilotRouter.post('/chat', async (req, res) => {
  const parsed = copilotChatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  try {
    const result = await runCopilotChat({
      userId: req.user!.userId,
      ...parsed.data,
    });
    res.json({ data: result });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    const message = typeof err?.message === 'string' ? err.message : 'Copilot unavailable';
    logger.error({ err }, '[copilot] chat failed');
    res.status(status).json({ error: message });
  }
});

copilotRouter.post('/actions/prepare', async (req, res) => {
  const parsed = copilotPrepareActionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  try {
    const result = await prepareCopilotAction({
      userId: req.user!.userId,
      ...parsed.data,
    });
    res.json({ data: result });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    const message = typeof err?.message === 'string' ? err.message : 'Copilot action unavailable';
    logger.error({ err }, '[copilot] prepare action failed');
    res.status(status).json({ error: message });
  }
});

copilotRouter.post('/actions/acknowledge', async (req, res) => {
  const parsed = copilotAcknowledgeActionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  try {
    const result = await acknowledgeCopilotAction({
      userId: req.user!.userId,
      ...parsed.data,
    });
    res.json({ data: result });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    const message = typeof err?.message === 'string' ? err.message : 'Copilot acknowledgement unavailable';
    logger.error({ err }, '[copilot] acknowledge action failed');
    res.status(status).json({ error: message });
  }
});

copilotRouter.post('/actions/apply', async (req, res) => {
  const parsed = copilotApplyActionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  try {
    const result = await applyCopilotAction({
      userId: req.user!.userId,
      ...parsed.data,
    });
    res.json({ data: result });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    const message = typeof err?.message === 'string' ? err.message : 'Copilot apply unavailable';
    logger.error({ err }, '[copilot] apply action failed');
    res.status(status).json({ error: message });
  }
});
