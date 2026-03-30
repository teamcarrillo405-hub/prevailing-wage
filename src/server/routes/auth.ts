import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { users, projectMembers, teamInvites } from '../db/schema.js';
import { hashPassword, verifyPassword, createSessionToken } from '../services/auth.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { validateToken } from '../services/inviteService.js';

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

const AcceptInviteSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

// POST /api/auth/accept-invite
authRouter.post('/accept-invite', validate(AcceptInviteSchema), async (req, res) => {
  const { token, password } = req.body as z.infer<typeof AcceptInviteSchema>;
  const result = await validateToken(token);

  if (result.status === 'not_found') {
    res.status(404).json({ error: 'Invite not found' });
    return;
  }
  if (result.status !== 'valid') {
    res.status(410).json({ error: 'Invite link has expired or has already been used' });
    return;
  }

  const invite = result.invite!;
  const db = getDb();

  // Check if email already registered
  const [existingUser] = await db.select().from(users).where(eq(users.email, invite.inviteeEmail)).limit(1);
  if (existingUser) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();
  const newUserId = randomUUID();

  // Create user
  await db.insert(users).values({
    id: newUserId,
    email: invite.inviteeEmail,
    passwordHash,
    createdAt: now,
    updatedAt: now,
  });

  // Insert project_members for ALL inviter's projects (D-10 critical)
  const inviterProjects = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.userId, invite.inviterUserId),
        isNull(projectMembers.removedAt),
      ),
    );

  if (inviterProjects.length > 0) {
    await db.insert(projectMembers).values(
      inviterProjects.map((p: { projectId: string }) => ({
        id: randomUUID(),
        projectId: p.projectId,
        userId: newUserId,
        role: 'member' as const,
        joinedAt: now,
      }))
    );
  }

  // Mark invite as accepted
  await db
    .update(teamInvites)
    .set({ acceptedAt: now })
    .where(eq(teamInvites.id, invite.id));

  // Create session and log in
  const sessionToken = await createSessionToken({ userId: newUserId, email: invite.inviteeEmail });
  res.cookie(COOKIE_NAME, sessionToken, COOKIE_OPTS);
  res.status(201).json({ data: { user: { id: newUserId, email: invite.inviteeEmail } } });
});

// GET /api/auth/me
authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ data: { user: { id: req.user!.userId, email: req.user!.email } } });
});

export default authRouter;
