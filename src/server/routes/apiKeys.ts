// src/server/routes/apiKeys.ts
// Mounted at /api/keys — manages user API keys for the public v1 API.
// Key is generated once and returned in plaintext; only the SHA-256 hash is stored.

import { Router } from 'express';
import { randomBytes, createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { eq, and, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getDb } from '../db/index.js';
import { apiKeys } from '../db/schema.js';

const router = Router();
router.use(requireAuth);

const CreateKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.enum(['projects:read', 'payroll:read', 'workers:read'])).min(1),
  expiresAt: z.string().datetime().optional(),
});

// Phase 82 (Gap-2): public rate-limit window. Surface this in the API key
// listing so consumers can see their quota without grepping docs.
const PUBLIC_API_RATE_LIMIT = {
  requests: 1000,
  windowHours: 1,
  scope: 'per-api-key',
};

// GET /api/keys — list user's API keys (never return hash, only prefix + metadata)
router.get('/', async (req, res) => {
  const userId = req.user!.userId;
  const db = getDb();

  const rows = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      scopes: apiKeys.scopes,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
      createdAt: apiKeys.createdAt,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)));

  res.json({
    data: rows.map((r: typeof rows[number]) => ({ ...r, scopes: JSON.parse(r.scopes) as string[] })),
    rateLimit: PUBLIC_API_RATE_LIMIT,
  });
});

// POST /api/keys — create a new API key
router.post('/', validate(CreateKeySchema), async (req, res) => {
  const userId = req.user!.userId;
  const body = req.body as z.infer<typeof CreateKeySchema>;
  const db = getDb();

  // Generate: pw_live_ prefix + 32 random bytes as hex
  const rawKey = 'pw_live_' + randomBytes(32).toString('hex');
  const keyPrefix = rawKey.slice(0, 15); // "pw_live_" + 7 chars
  const keyHash = createHash('sha256').update(rawKey).digest('hex');

  const id = randomUUID();
  const now = new Date().toISOString();

  await db.insert(apiKeys).values({
    id,
    userId,
    name: body.name,
    keyHash,
    keyPrefix,
    scopes: JSON.stringify(body.scopes),
    expiresAt: body.expiresAt ?? null,
    createdAt: now,
  });

  // Return the plaintext key ONCE — never stored, cannot be recovered
  res.status(201).json({
    data: {
      id,
      name: body.name,
      keyPrefix,
      scopes: body.scopes,
      createdAt: now,
      key: rawKey, // shown once
    },
  });
});

// DELETE /api/keys/:id — revoke a key
router.delete('/:id', async (req, res) => {
  const userId = req.user!.userId;
  const keyId = req.params['id'] as string;
  const db = getDb();

  const [existing] = await db
    .select({ id: apiKeys.id, userId: apiKeys.userId })
    .from(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: 'API key not found' });
    return;
  }

  await db
    .update(apiKeys)
    .set({ revokedAt: new Date().toISOString() })
    .where(eq(apiKeys.id, keyId));

  res.status(200).json({ message: 'API key revoked' });
});

export default router;
