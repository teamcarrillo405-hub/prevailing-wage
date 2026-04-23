import { randomBytes, randomUUID } from 'crypto';
import { and, eq, isNull, gt } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { teamInvites, projectMembers, users } from '../db/schema.js';

// Resend SDK — lazy init, null if no API key
let resendInstance: any = null;
async function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendInstance) {
    const { Resend } = await import('resend');
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'team@hccprevailingwage.com';

export async function sendInviteEmail(to: string, inviteUrl: string): Promise<void> {
  const resend = await getResend();
  if (!resend) {
    console.log(`[invite] RESEND_API_KEY not set. Invite URL: ${inviteUrl}`);
    return;
  }
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: [to],
    subject: 'You have been invited to join HCC Prevailing Wage',
    html: `<p>You've been invited to join a team on HCC Prevailing Wage.</p><p>Click the link below to create your account:</p><p><a href="${inviteUrl}">${inviteUrl}</a></p><p>This link expires in 72 hours.</p>`,
  });
  if (error) {
    console.error('[invite] Resend error:', error);
    // Non-fatal per D-02 — invite row is created; email failure doesn't block
  }
}

export async function createInvite(inviterUserId: string, inviteeEmail: string, inviteeRole: 'member' | 'auditor' = 'member'): Promise<{ id: string; token: string }> {
  const db = getDb();
  const now = new Date().toISOString();
  const id = randomUUID();
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

  await db.insert(teamInvites).values({
    id,
    inviterUserId,
    inviteeEmail: inviteeEmail.toLowerCase(),
    inviteeRole,
    token,
    expiresAt,
    createdAt: now,
  });

  return { id, token };
}

export async function validateToken(token: string): Promise<{
  status: 'valid' | 'not_found' | 'expired' | 'used' | 'revoked';
  invite?: typeof teamInvites.$inferSelect;
  inviterEmail?: string;
}> {
  const db = getDb();
  const [row] = await db
    .select({ invite: teamInvites, inviterEmail: users.email })
    .from(teamInvites)
    .innerJoin(users, eq(teamInvites.inviterUserId, users.id))
    .where(eq(teamInvites.token, token))
    .limit(1);

  if (!row) return { status: 'not_found' };
  if (row.invite.acceptedAt) return { status: 'used' };
  if (row.invite.revokedAt) return { status: 'revoked' };
  if (new Date(row.invite.expiresAt) <= new Date()) return { status: 'expired' };

  return { status: 'valid', invite: row.invite, inviterEmail: row.inviterEmail };
}

export async function getPendingInvite(inviterUserId: string) {
  const db = getDb();
  const now = new Date().toISOString();
  const [row] = await db
    .select()
    .from(teamInvites)
    .where(
      and(
        eq(teamInvites.inviterUserId, inviterUserId),
        isNull(teamInvites.acceptedAt),
        isNull(teamInvites.revokedAt),
        gt(teamInvites.expiresAt, now),
      ),
    )
    .limit(1);
  return row || null;
}

export async function revokeInvite(inviterUserId: string): Promise<boolean> {
  const db = getDb();
  const pending = await getPendingInvite(inviterUserId);
  if (!pending) return false;
  await db
    .update(teamInvites)
    .set({ revokedAt: new Date().toISOString() })
    .where(eq(teamInvites.id, pending.id));
  return true;
}

export async function getTeamMemberCount(userId: string): Promise<number> {
  const db = getDb();
  // Find all projects where userId is owner, then count distinct users across those projects
  const ownerProjects = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.userId, userId),
        eq(projectMembers.role, 'owner'),
        isNull(projectMembers.removedAt),
      ),
    );

  if (ownerProjects.length === 0) return 1;

  // Count distinct active members across owner's projects
  const members = await db
    .selectDistinct({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, ownerProjects[0].projectId),
        isNull(projectMembers.removedAt),
      ),
    );

  return members.length;
}
