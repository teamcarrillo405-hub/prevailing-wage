// Phase 103: AI Classification Assist — AI-01, AI-02
// POST /api/ai/classify — Davis-Bacon trade classification via Claude
// Requires: @anthropic-ai/sdk (npm install @anthropic-ai/sdk)

import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { getDb } from '../db/index.js';
import { aiClassifications } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';

// Lazy-init Anthropic client so import doesn't fail at startup if key not set
let anthropicClient: { messages: { create: (opts: any) => Promise<any> } } | null = null;

function getAnthropicClient(): { messages: { create: (opts: any) => Promise<any> } } {
  if (!anthropicClient) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AnthropicModule = require('@anthropic-ai/sdk');
    const AnthropicClass = AnthropicModule.default ?? AnthropicModule;
    anthropicClient = new AnthropicClass({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient!;
}

export const aiClassifyRouter = Router();
aiClassifyRouter.use(requireAuth);

const ClassifyBodySchema = z.object({
  jobDescription: z.string().min(10).max(2000),
  projectId: z.string().optional(),
});

const SYSTEM_PROMPT = `You are a Davis-Bacon Act wage classification expert.
Given a construction job description, return the most appropriate DOL trade classification.
Respond ONLY with valid JSON in this exact shape:
{
  "tradeCode": "CARP",
  "tradeDescription": "Carpenter",
  "confidence": 0.92,
  "reasoning": "One sentence explaining the match.",
  "alternatives": [
    { "tradeCode": "LABO", "tradeDescription": "Laborer", "confidence": 0.60 }
  ]
}
tradeCode must be a real DOL Davis-Bacon trade code (CARP, ELEC, LABO, PLUM, IRON, PAIN, OPER, MASO, ROOF, SHEE, TILE, GLAZ, BOIL, PLAS, TEAM).
confidence must be between 0.0 and 1.0.
alternatives array must have 1-3 entries sorted by confidence descending.`;

const MODEL = 'claude-3-5-haiku-20241022'; // fast + cheap for classification
const LOCAL_MODEL = 'local-classification-rules-v1';

function localClassify(jobDescription: string) {
  const text = jobDescription.toLowerCase();
  const rules: Array<{ code: string; description: string; confidence: number; keywords: string[] }> = [
    { code: 'ELEC', description: 'Electrician', confidence: 0.86, keywords: ['electrical', 'conduit', 'wire', 'panel', 'lighting'] },
    { code: 'PLUM', description: 'Plumber', confidence: 0.84, keywords: ['plumbing', 'pipe', 'fixture', 'water line', 'drain'] },
    { code: 'CARP', description: 'Carpenter', confidence: 0.82, keywords: ['carpentry', 'framing', 'door', 'formwork', 'cabinet'] },
    { code: 'OPER', description: 'Power Equipment Operator', confidence: 0.82, keywords: ['excavator', 'loader', 'crane', 'equipment', 'backhoe'] },
    { code: 'LABO', description: 'Laborer', confidence: 0.72, keywords: ['cleanup', 'demolition', 'material handling', 'site prep', 'labor'] },
    { code: 'PAIN', description: 'Painter', confidence: 0.78, keywords: ['paint', 'coating', 'sandblast', 'finish'] },
    { code: 'ROOF', description: 'Roofer', confidence: 0.8, keywords: ['roof', 'membrane', 'flashing'] },
  ];

  const scored = rules
    .map((rule) => ({
      ...rule,
      score: rule.keywords.filter((keyword) => text.includes(keyword)).length,
    }))
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence);

  const best = scored[0].score > 0 ? scored[0] : scored.find((rule) => rule.code === 'LABO')!;
  const alternatives = scored
    .filter((rule) => rule.code !== best.code)
    .slice(0, 3)
    .map((rule) => ({
      tradeCode: rule.code,
      tradeDescription: rule.description,
      confidence: rule.score > 0 ? Math.max(rule.confidence - 0.1, 0.5) : 0.42,
    }));

  return {
    tradeCode: best.code,
    tradeDescription: best.description,
    confidence: best.score > 0 ? best.confidence : 0.58,
    reasoning: best.score > 0
      ? 'Matched task language to common Davis-Bacon trade keywords; human review is still required.'
      : 'No strong keyword match was found, so Laborer is suggested as a review starting point.',
    alternatives,
  };
}

aiClassifyRouter.post('/classify', async (req, res) => {
  const parseResult = ClassifyBodySchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid request', details: parseResult.error.flatten() });
    return;
  }

  const userId = req.user!.userId;
  const { jobDescription, projectId } = parseResult.data;
  const startMs = Date.now();

  try {
    let parsed2: {
      tradeCode: string;
      tradeDescription: string;
      confidence: number;
      reasoning: string;
      alternatives: Array<{ tradeCode: string; tradeDescription: string; confidence: number }>;
    };
    let modelUsed = MODEL;
    let latencyMs = Date.now() - startMs;

    if (!process.env.ANTHROPIC_API_KEY) {
      parsed2 = localClassify(jobDescription);
      modelUsed = LOCAL_MODEL;
    } else {
      const client = getAnthropicClient();
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Job description: ${jobDescription}` }],
      });

      latencyMs = Date.now() - startMs;
      const rawText =
        Array.isArray(message.content) && message.content[0]?.type === 'text'
          ? message.content[0].text
          : '{}';

      try {
        parsed2 = JSON.parse(rawText);
      } catch {
        res.status(502).json({ error: 'AI returned unparseable response', raw: rawText });
        return;
      }
    }

    // Audit trail (AI-02)
    const auditId = randomUUID();
    const db = getDb();
    await db.insert(aiClassifications).values({
      id: auditId,
      userId,
      projectId: projectId ?? null,
      jobDescription,
      tradeCode: parsed2.tradeCode,
      tradeDescription: parsed2.tradeDescription,
      confidence: parsed2.confidence,
      reasoning: parsed2.reasoning ?? null,
      alternativesJson: JSON.stringify(parsed2.alternatives ?? []),
      modelUsed,
      latencyMs,
      createdAt: new Date().toISOString(),
    });

    res.json({
      tradeCode: parsed2.tradeCode,
      tradeDescription: parsed2.tradeDescription,
      confidence: parsed2.confidence,
      reasoning: parsed2.reasoning,
      alternatives: parsed2.alternatives ?? [],
      aiClassificationId: auditId,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[aiClassify] error:', msg);
    if (msg.includes('401') || msg.includes('authentication')) {
      res.status(503).json({ error: 'AI service authentication failed — check ANTHROPIC_API_KEY' });
      return;
    }
    res.status(503).json({ error: 'AI classification service unavailable', detail: msg });
  }
});
