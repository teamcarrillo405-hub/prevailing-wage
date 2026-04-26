import { Router } from 'express';
import { z } from 'zod';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { projectMembers, users } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createInvite, validateToken, sendInviteEmail,
  getPendingInvite, revokeInvite, getTeamMemberCount,
} from '../services/inviteService.js';
import { getMemberLimit, type PlanTier } from '../utils/planLimits.js';
import { verifyPassword } from '../services/auth.js';
import { insertSecurityEvent } from '../db/auditHelpers.js';

const router = Router();

// --- PUBLIC route (no auth) — must be BEFORE router.use(requireAuth) ---

// GET /api/team/invite/:token — validate invite token (public)
router.get('/invite/:token', async (req, res) => {
  const result = await validateToken(req.params.token);
  if (result.status === 'not_found') {
    res.status(404).json({ error: 'Invite not found' });
    return;
  }
  if (result.status !== 'valid') {
    // expired, used, revoked all return 410 Gone
    res.status(410).json({ error: 'Invite link has expired or has already been used' });
    return;
  }
  res.json({ data: { email: result.invite!.inviteeEmail, inviterEmail: result.inviterEmail } });
});

// --- All routes below require auth ---
router.use(requireAuth);

// Helper: check if current user is owner
async function isOwner(userId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.userId, userId),
        eq(projectMembers.role, 'owner'),
        isNull(projectMembers.removedAt),
      ),
    )
    .limit(1);
  return !!row;
}

// Helper: get the "owner" userId for a team that includes the given user
async function getOwnerUserId(userId: string): Promise<string | null> {
  const db = getDb();
  // Find any project this user belongs to
  const [memberRow] = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(and(eq(projectMembers.userId, userId), isNull(projectMembers.removedAt)))
    .limit(1);
  if (!memberRow) return null;
  // Find the owner of that project
  const [ownerRow] = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, memberRow.projectId),
        eq(projectMembers.role, 'owner'),
        isNull(projectMembers.removedAt),
      ),
    )
    .limit(1);
  return ownerRow?.userId || null;
}

// GET /api/team — list team members + pending invite
router.get('/', async (req, res) => {
  const userId = req.user!.userId;
  const db = getDb();

  // Determine owner context — if user is owner, use their id; if member, find owner
  const ownerUserId = await isOwner(userId) ? userId : await getOwnerUserId(userId);
  if (!ownerUserId) {
    // User has no project memberships at all — return empty
    res.json({ data: { members: [], pendingInvite: null, isOwner: false } });
    return;
  }

  // Get one project owned by the owner to find all team members
  const [ownerProject] = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.userId, ownerUserId),
        eq(projectMembers.role, 'owner'),
        isNull(projectMembers.removedAt),
      ),
    )
    .limit(1);

  let members: { id: string; email: string; role: string; joinedAt: string }[] = [];
  if (ownerProject) {
    const rows = await db
      .select({
        userId: projectMembers.userId,
        role: projectMembers.role,
        joinedAt: projectMembers.joinedAt,
        email: users.email,
      })
      .from(projectMembers)
      .innerJoin(users, eq(projectMembers.userId, users.id))
      .where(
        and(
          eq(projectMembers.projectId, ownerProject.projectId),
          isNull(projectMembers.removedAt),
        ),
      );
    members = rows.map((r: { userId: string; email: string; role: string; joinedAt: string }) => ({ id: r.userId, email: r.email, role: r.role, joinedAt: r.joinedAt }));
  }

  const pendingInvite = await getPendingInvite(ownerUserId);
  const userIsOwner = await isOwner(userId);

  res.json({
    data: {
      members,
      pendingInvite: pendingInvite
        ? { id: pendingInvite.id, email: pendingInvite.inviteeEmail, role: pendingInvite.inviteeRole, expiresAt: pendingInvite.expiresAt }
        : null,
      isOwner: userIsOwner,
    },
  });
});

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['member', 'auditor']).default('member'),
});

// POST /api/team/invite — owner sends invite
router.post('/invite', validate(InviteSchema), async (req, res) => {
  const userId = req.user!.userId;
  if (!(await isOwner(userId))) {
    res.status(403).json({ error: 'Owner access required' });
    return;
  }

  // Check capacity — tier-aware (D-06)
  const memberCount = await getTeamMemberCount(userId);
  const db = getDb();
  const [ownerRow] = await db.select({ planTier: users.planTier })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!ownerRow) {
    res.status(500).json({ error: 'Owner account not found' });
    return;
  }
  const rawTier = ownerRow.planTier;
  const tier: PlanTier = ['starter', 'pro', 'enterprise'].includes(rawTier)
    ? (rawTier as PlanTier)
    : 'starter';
  const limit = getMemberLimit(tier);
  if (memberCount >= limit) {
    res.status(409).json({ error: `Team is at capacity (${limit} members on your plan)` });
    return;
  }

  // Check pending invite (D-06)
  const pending = await getPendingInvite(userId);
  if (pending) {
    res.status(409).json({ error: 'An invite is already pending' });
    return;
  }

  const { email, role } = req.body as z.infer<typeof InviteSchema>;
  const { token } = await createInvite(userId, email, role);

  // Build invite URL
  const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  const inviteUrl = `${baseUrl}/accept-invite?token=${token}`;
  await sendInviteEmail(email, inviteUrl);

  res.status(201).json({ data: { message: 'Invite sent' } });
});

// DELETE /api/team/invite — owner revokes pending invite
router.delete('/invite', async (req, res) => {
  const userId = req.user!.userId;
  if (!(await isOwner(userId))) {
    res.status(403).json({ error: 'Owner access required' });
    return;
  }
  const revoked = await revokeInvite(userId);
  if (!revoked) {
    res.status(404).json({ error: 'No pending invite to revoke' });
    return;
  }
  res.json({ data: { message: 'Invite revoked' } });
});

// DELETE /api/team/members/:userId — owner removes member
router.delete('/members/:userId', async (req, res) => {
  const ownerId = req.user!.userId;
  const targetUserId = req.params.userId;
  if (!(await isOwner(ownerId))) {
    res.status(403).json({ error: 'Owner access required' });
    return;
  }
  if (targetUserId === ownerId) {
    res.status(400).json({ error: 'Cannot remove yourself' });
    return;
  }

  const db = getDb();
  const now = new Date().toISOString();

  // Set removed_at on ALL project_members rows for this user
  await db
    .update(projectMembers)
    .set({ removedAt: now })
    .where(
      and(
        eq(projectMembers.userId, targetUserId),
        isNull(projectMembers.removedAt),
      ),
    );

  res.json({ data: { message: 'Member removed' } });
});

const TransferSchema = z.object({ targetUserId: z.string().uuid() });

// POST /api/team/transfer — owner transfers ownership
router.post('/transfer', validate(TransferSchema), async (req, res) => {
  const ownerId = req.user!.userId;
  if (!(await isOwner(ownerId))) {
    res.status(403).json({ error: 'Owner access required' });
    return;
  }

  const { targetUserId } = req.body as z.infer<typeof TransferSchema>;
  if (targetUserId === ownerId) {
    res.status(400).json({ error: 'Already the owner' });
    return;
  }

  const db = getDb();

  // Get all projects where owner is 'owner'
  const ownerRows = await db
    .select({ projectId: projectMembers.projectId, id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.userId, ownerId),
        eq(projectMembers.role, 'owner'),
        isNull(projectMembers.removedAt),
      ),
    );

  // For each project, swap roles
  for (const row of ownerRows) {
    // Set current owner to member
    await db
      .update(projectMembers)
      .set({ role: 'member' })
      .where(eq(projectMembers.id, row.id));

    // Set target to owner
    await db
      .update(projectMembers)
      .set({ role: 'owner' })
      .where(
        and(
          eq(projectMembers.projectId, row.projectId),
          eq(projectMembers.userId, targetUserId),
          isNull(projectMembers.removedAt),
        ),
      );
  }

  res.json({ data: { message: 'Ownership transferred' } });
});

// ── POST /api/team/:projectId/transfer-ownership ─────────────────────────────
// Transfer project ownership to a current project member, with password confirmation.
// Body: { newOwnerId: string, confirmPassword: string }
// Rules:
//   1. Caller must be the current project owner
//   2. Password re-verified against stored hash
//   3. newOwnerId must be an active member of the project
//   4. Role swap: current owner → 'member', newOwnerId → 'owner'
//   5. Security event recorded

const TransferOwnershipSchema = z.object({
  newOwnerId: z.string().uuid(),
  confirmPassword: z.string().min(1),
});

router.post('/:projectId/transfer-ownership', validate(TransferOwnershipSchema), async (req, res) => {
  const userId = req.user!.userId;
  const { projectId } = req.params as { projectId: string };
  const { newOwnerId, confirmPassword } = req.body as z.infer<typeof TransferOwnershipSchema>;

  if (newOwnerId === userId) {
    res.status(400).json({ error: 'You are already the owner of this project' });
    return;
  }

  const db = getDb();

  // 1. Verify caller is the owner of this specific project
  const [ownerRow] = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId),
        eq(projectMembers.role, 'owner'),
        isNull(projectMembers.removedAt),
      ),
    )
    .limit(1);

  if (!ownerRow) {
    res.status(403).json({ error: 'Owner access required for this project' });
    return;
  }

  // 2. Verify password
  const [userRow] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!userRow) {
    res.status(500).json({ error: 'User account not found' });
    return;
  }

  const passwordOk = await verifyPassword(userRow.passwordHash, confirmPassword);
  if (!passwordOk) {
    res.status(401).json({ error: 'Incorrect password' });
    return;
  }

  // 3. Verify newOwnerId is an active member of this project
  const [targetMemberRow] = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, newOwnerId),
        isNull(projectMembers.removedAt),
      ),
    )
    .limit(1);

  if (!targetMemberRow) {
    res.status(400).json({ error: 'New owner must be an existing active member of this project' });
    return;
  }

  // 4. Swap roles
  await db
    .update(projectMembers)
    .set({ role: 'member' })
    .where(eq(projectMembers.id, ownerRow.id));

  await db
    .update(projectMembers)
    .set({ role: 'owner' })
    .where(eq(projectMembers.id, targetMemberRow.id));

  // 5. Record security event (fire-and-forget)
  void insertSecurityEvent({
    userId,
    eventType: 'ownership_transferred',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] as string | undefined,
    metadata: { projectId, newOwnerId },
  });

  res.json({ data: { message: 'Ownership transferred successfully' } });
});

export { router as teamRouter };
