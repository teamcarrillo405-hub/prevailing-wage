import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { users } from '../db/schema.js';
import { hashPassword, verifyPassword, createSessionToken } from '../services/auth.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const authRouter = Router();

const COOKIE_NAME = 'pw_session';
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  inviteCode: z.string().optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/auth/register
authRouter.post('/register', validate(RegisterSchema), async (req, res) => {
  const { email, password, inviteCode } = req.body as z.infer<typeof RegisterSchema>;

  if (process.env.INVITE_CODE && inviteCode !== process.env.INVITE_CODE) {
    res.status(403).json({ error: 'Invalid invitation code' });
    return;
  }

  const db = getDb();

  // Check for duplicate email
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();
  const id = randomUUID();

  await db.insert(users).values({
    id,
    email,
    passwordHash,
    createdAt: now,
    updatedAt: now,
  });

  const token = await createSessionToken({ userId: id, email });
  res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
  res.status(201).json({ data: { user: { id, email } } });
});

// POST /api/auth/login
authRouter.post('/login', validate(LoginSchema), async (req, res) => {
  const { email, password } = req.body as z.infer<typeof LoginSchema>;
  const db = getDb();

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    res.status(404).json({ error: 'Email not found' });
    return;
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    res.status(401).json({ error: 'Invalid password' });
    return;
  }

  const token = await createSessionToken({ userId: user.id, email: user.email });
  res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
  res.status(200).json({ data: { user: { id: user.id, email: user.email } } });
});

// POST /api/auth/logout
authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.status(200).json({ data: { message: 'Logged out' } });
});

// GET /api/auth/me
authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ data: { user: { id: req.user!.userId, email: req.user!.email } } });
});

export default authRouter;
