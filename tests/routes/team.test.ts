import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { randomUUID } from 'crypto';
import { app } from '../../src/server/index.js';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

// Helper: register a user and return cookie header + userId
async function registerUser(email: string, password = 'password123') {
  const res = await supertest(app)
    .post('/api/auth/register')
    .send({ email, password });
  expect(res.status).toBe(201);
  const cookies = res.headers['set-cookie'] as string[] | string;
  const cookieHeader = Array.isArray(cookies) ? cookies.join('; ') : cookies;
  return { cookie: cookieHeader, userId: res.body.data?.user?.id as string };
}

// Helper: create a project and return the project id
async function createProject(cookie: string) {
  const res = await supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({
      name: 'Team Test Project',
      state: 'CA',
      county: 'Los Angeles',
      contractType: 'federal-davis-bacon',
      awardDate: '2025-09-01',
      fundingType: 'federal',
    });
  expect(res.status).toBe(201);
  return res.body.data?.project?.id as string;
}

// Helper: extract the pw_session cookie value from a response
function extractCookie(res: supertest.Response): string {
  const cookies = res.headers['set-cookie'] as string[] | string;
  const cookieArr = Array.isArray(cookies) ? cookies : [cookies];
  return cookieArr.join('; ');
}

// Helper: insert a team_invites row directly in the test DB (for expired/used/revoked scenarios)
function getTestDb() {
  return (globalThis as any).__testDb;
}

describe('POST /api/team/invite', () => {
  it('returns 201 and creates invite when owner posts valid email', async () => {
    const { cookie } = await registerUser(`owner-invite-${Date.now()}@test.com`);
    await createProject(cookie);

    const res = await supertest(app)
      .post('/api/team/invite')
      .set('Cookie', cookie)
      .send({ email: `invitee-${Date.now()}@test.com` });

    expect(res.status).toBe(201);
    expect(res.body.data?.message).toBe('Invite sent');
  });

  it('returns 403 for non-owner user', async () => {
    // Create owner with project
    const { cookie: ownerCookie } = await registerUser(`owner-perm-${Date.now()}@test.com`);
    const projectId = await createProject(ownerCookie);

    // Create a member user by inserting project_members directly
    const { cookie: memberCookie, userId: memberId } = await registerUser(`member-perm-${Date.now()}@test.com`);
    const db = getTestDb();
    const { projectMembers } = await import('../../src/server/db/schema.js');
    await db.insert(projectMembers).values({
      id: randomUUID(),
      projectId,
      userId: memberId,
      role: 'member',
      joinedAt: new Date().toISOString(),
    });

    const res = await supertest(app)
      .post('/api/team/invite')
      .set('Cookie', memberCookie)
      .send({ email: `another-${Date.now()}@test.com` });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Owner access required');
  });

  it('returns 409 "Team is at capacity" when 2 members already exist', async () => {
    const { cookie: ownerCookie, userId: ownerId } = await registerUser(`owner-cap-${Date.now()}@test.com`);
    const projectId = await createProject(ownerCookie);

    // Add a member to bring count to 2 (owner + member)
    const { userId: memberId } = await registerUser(`member-cap-${Date.now()}@test.com`);
    const db = getTestDb();
    const { projectMembers } = await import('../../src/server/db/schema.js');
    await db.insert(projectMembers).values({
      id: randomUUID(),
      projectId,
      userId: memberId,
      role: 'member',
      joinedAt: new Date().toISOString(),
    });

    const res = await supertest(app)
      .post('/api/team/invite')
      .set('Cookie', ownerCookie)
      .send({ email: `toomany-${Date.now()}@test.com` });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Team is at capacity (2 members)');
  });

  it('returns 409 "An invite is already pending" when pending invite exists', async () => {
    const { cookie } = await registerUser(`owner-pending-${Date.now()}@test.com`);
    await createProject(cookie);

    // Send first invite
    const firstInviteRes = await supertest(app)
      .post('/api/team/invite')
      .set('Cookie', cookie)
      .send({ email: `first-${Date.now()}@test.com` });
    expect(firstInviteRes.status).toBe(201);

    // Try to send second invite
    const res = await supertest(app)
      .post('/api/team/invite')
      .set('Cookie', cookie)
      .send({ email: `second-${Date.now()}@test.com` });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('An invite is already pending');
  });

  it('returns 400 for invalid email', async () => {
    const { cookie } = await registerUser(`owner-invalidemail-${Date.now()}@test.com`);
    await createProject(cookie);

    const res = await supertest(app)
      .post('/api/team/invite')
      .set('Cookie', cookie)
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    const res = await supertest(app)
      .post('/api/team/invite')
      .send({ email: 'test@test.com' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/team/invite/:token', () => {
  it('returns 200 with email and inviterEmail for valid token', async () => {
    const inviterEmail = `inviter-tok-${Date.now()}@test.com`;
    const inviteeEmail = `invitee-tok-${Date.now()}@test.com`;
    const { cookie } = await registerUser(inviterEmail);
    await createProject(cookie);

    const inviteRes = await supertest(app)
      .post('/api/team/invite')
      .set('Cookie', cookie)
      .send({ email: inviteeEmail });
    expect(inviteRes.status).toBe(201);

    // Get the token from the DB
    const db = getTestDb();
    const { teamInvites } = await import('../../src/server/db/schema.js');
    const { eq } = await import('drizzle-orm');
    const [invite] = await db
      .select()
      .from(teamInvites)
      .where(eq(teamInvites.inviteeEmail, inviteeEmail.toLowerCase()))
      .limit(1);
    expect(invite).toBeDefined();

    const res = await supertest(app)
      .get(`/api/team/invite/${invite.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data?.email).toBe(inviteeEmail.toLowerCase());
    expect(res.body.data?.inviterEmail).toBe(inviterEmail);
  });

  it('returns 404 for nonexistent token', async () => {
    const res = await supertest(app)
      .get('/api/team/invite/nonexistent-token-abc123');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Invite not found');
  });

  it('returns 410 for expired token', async () => {
    // Directly insert an expired invite row
    const db = getTestDb();
    const { teamInvites, users: usersTable } = await import('../../src/server/db/schema.js');

    // Get any existing user to act as inviter
    const inviterEmail = `inviter-expired-${Date.now()}@test.com`;
    const { userId: inviterId } = await registerUser(inviterEmail);

    const expiredToken = `expired-token-${randomUUID()}`;
    await db.insert(teamInvites).values({
      id: randomUUID(),
      inviterUserId: inviterId,
      inviteeEmail: `expired-invitee-${Date.now()}@test.com`,
      token: expiredToken,
      expiresAt: new Date(Date.now() - 1000).toISOString(), // 1 second in the past
      createdAt: new Date().toISOString(),
    });

    const res = await supertest(app)
      .get(`/api/team/invite/${expiredToken}`);

    expect(res.status).toBe(410);
    expect(res.body.error).toBe('Invite link has expired or has already been used');
  });

  it('returns 410 for used (accepted) token', async () => {
    const db = getTestDb();
    const { teamInvites } = await import('../../src/server/db/schema.js');

    const inviterEmail = `inviter-used-${Date.now()}@test.com`;
    const { userId: inviterId } = await registerUser(inviterEmail);

    const usedToken = `used-token-${randomUUID()}`;
    const now = new Date().toISOString();
    await db.insert(teamInvites).values({
      id: randomUUID(),
      inviterUserId: inviterId,
      inviteeEmail: `used-invitee-${Date.now()}@test.com`,
      token: usedToken,
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      acceptedAt: now,
      createdAt: now,
    });

    const res = await supertest(app)
      .get(`/api/team/invite/${usedToken}`);

    expect(res.status).toBe(410);
    expect(res.body.error).toBe('Invite link has expired or has already been used');
  });
});

describe('POST /api/auth/accept-invite', () => {
  it('creates user, inserts project_members for all inviter projects, returns 201 with session cookie', async () => {
    const inviterEmail = `inviter-accept-${Date.now()}@test.com`;
    const inviteeEmail = `invitee-accept-${Date.now()}@test.com`;
    const { cookie, userId: inviterId } = await registerUser(inviterEmail);

    // Create TWO projects for the inviter
    await createProject(cookie);
    await createProject(cookie);

    const inviteRes = await supertest(app)
      .post('/api/team/invite')
      .set('Cookie', cookie)
      .send({ email: inviteeEmail });
    expect(inviteRes.status).toBe(201);

    // Get the token
    const db = getTestDb();
    const { teamInvites, projectMembers } = await import('../../src/server/db/schema.js');
    const { eq } = await import('drizzle-orm');
    const [invite] = await db
      .select()
      .from(teamInvites)
      .where(eq(teamInvites.inviteeEmail, inviteeEmail.toLowerCase()))
      .limit(1);
    expect(invite).toBeDefined();

    const res = await supertest(app)
      .post('/api/auth/accept-invite')
      .send({ token: invite.token, password: 'newpassword123' });

    expect(res.status).toBe(201);
    expect(res.body.data?.user?.email).toBe(inviteeEmail.toLowerCase());
    expect(res.body.data?.user?.id).toBeDefined();

    // Verify session cookie set
    const cookies = res.headers['set-cookie'] as string[] | string;
    const cookieArr = Array.isArray(cookies) ? cookies : [cookies];
    expect(cookieArr.some((c: string) => c.startsWith('pw_session='))).toBe(true);

    // Verify new user was added to project_members for both projects
    const { and, isNull } = await import('drizzle-orm');
    const newUserId = res.body.data?.user?.id;
    const memberRows = await db
      .select()
      .from(projectMembers)
      .where(and(eq(projectMembers.userId, newUserId), isNull(projectMembers.removedAt)));

    expect(memberRows.length).toBe(2); // both projects
    expect(memberRows.every((r: any) => r.role === 'member')).toBe(true);

    // Verify invite is marked as accepted
    const [updatedInvite] = await db
      .select()
      .from(teamInvites)
      .where(eq(teamInvites.id, invite.id))
      .limit(1);
    expect(updatedInvite.acceptedAt).not.toBeNull();
  });

  it('returns 410 for already-used token', async () => {
    const inviterEmail = `inviter-used2-${Date.now()}@test.com`;
    const inviteeEmail = `invitee-used2-${Date.now()}@test.com`;
    const { cookie } = await registerUser(inviterEmail);
    await createProject(cookie);

    const inviteRes = await supertest(app)
      .post('/api/team/invite')
      .set('Cookie', cookie)
      .send({ email: inviteeEmail });
    expect(inviteRes.status).toBe(201);

    const db = getTestDb();
    const { teamInvites } = await import('../../src/server/db/schema.js');
    const { eq } = await import('drizzle-orm');
    const [invite] = await db
      .select()
      .from(teamInvites)
      .where(eq(teamInvites.inviteeEmail, inviteeEmail.toLowerCase()))
      .limit(1);

    // Accept once
    const firstAccept = await supertest(app)
      .post('/api/auth/accept-invite')
      .send({ token: invite.token, password: 'newpassword123' });
    expect(firstAccept.status).toBe(201);

    // Accept again — should fail with 409 (email already registered) or 410 (token used)
    const secondAccept = await supertest(app)
      .post('/api/auth/accept-invite')
      .send({ token: invite.token, password: 'newpassword123' });
    // Either 410 (token used) or 409 (email already registered)
    expect([409, 410]).toContain(secondAccept.status);
  });

  it('returns 400 when password too short', async () => {
    const inviterEmail = `inviter-shortpw-${Date.now()}@test.com`;
    const inviteeEmail = `invitee-shortpw-${Date.now()}@test.com`;
    const { cookie } = await registerUser(inviterEmail);
    await createProject(cookie);

    const inviteRes = await supertest(app)
      .post('/api/team/invite')
      .set('Cookie', cookie)
      .send({ email: inviteeEmail });
    expect(inviteRes.status).toBe(201);

    const db = getTestDb();
    const { teamInvites } = await import('../../src/server/db/schema.js');
    const { eq } = await import('drizzle-orm');
    const [invite] = await db
      .select()
      .from(teamInvites)
      .where(eq(teamInvites.inviteeEmail, inviteeEmail.toLowerCase()))
      .limit(1);

    const res = await supertest(app)
      .post('/api/auth/accept-invite')
      .send({ token: invite.token, password: 'short' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/team', () => {
  it('returns members array with correct roles and pending invite for owner', async () => {
    const ownerEmail = `owner-list-${Date.now()}@test.com`;
    const { cookie, userId: ownerId } = await registerUser(ownerEmail);
    const projectId = await createProject(cookie);

    // Add a member
    const { userId: memberId } = await registerUser(`member-list-${Date.now()}@test.com`);
    const db = getTestDb();
    const { projectMembers } = await import('../../src/server/db/schema.js');
    await db.insert(projectMembers).values({
      id: randomUUID(),
      projectId,
      userId: memberId,
      role: 'member',
      joinedAt: new Date().toISOString(),
    });

    const res = await supertest(app)
      .get('/api/team')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.members).toBeDefined();
    expect(data.members.length).toBe(2); // owner + member
    expect(data.isOwner).toBe(true);

    const ownerMember = data.members.find((m: any) => m.id === ownerId);
    const regularMember = data.members.find((m: any) => m.id === memberId);
    expect(ownerMember?.role).toBe('owner');
    expect(regularMember?.role).toBe('member');
  });

  it('returns 401 when not authenticated', async () => {
    const res = await supertest(app).get('/api/team');
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/team/invite', () => {
  it('revokes pending invite (owner only)', async () => {
    const { cookie } = await registerUser(`owner-revoke-${Date.now()}@test.com`);
    await createProject(cookie);

    // Create a pending invite
    const inviteRes = await supertest(app)
      .post('/api/team/invite')
      .set('Cookie', cookie)
      .send({ email: `to-revoke-${Date.now()}@test.com` });
    expect(inviteRes.status).toBe(201);

    // Revoke it
    const revokeRes = await supertest(app)
      .delete('/api/team/invite')
      .set('Cookie', cookie);

    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.data?.message).toBe('Invite revoked');
  });

  it('returns 404 when no pending invite to revoke', async () => {
    const { cookie } = await registerUser(`owner-norevoke-${Date.now()}@test.com`);
    await createProject(cookie);

    const res = await supertest(app)
      .delete('/api/team/invite')
      .set('Cookie', cookie);

    expect(res.status).toBe(404);
  });

  it('returns 403 for non-owner', async () => {
    const { cookie: ownerCookie } = await registerUser(`owner-rev-perm-${Date.now()}@test.com`);
    const projectId = await createProject(ownerCookie);

    const { cookie: memberCookie, userId: memberId } = await registerUser(`member-rev-perm-${Date.now()}@test.com`);
    const db = getTestDb();
    const { projectMembers } = await import('../../src/server/db/schema.js');
    await db.insert(projectMembers).values({
      id: randomUUID(),
      projectId,
      userId: memberId,
      role: 'member',
      joinedAt: new Date().toISOString(),
    });

    const res = await supertest(app)
      .delete('/api/team/invite')
      .set('Cookie', memberCookie);
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/team/members/:userId', () => {
  it('sets removed_at on all project_members rows and member loses team access', async () => {
    const { cookie: ownerCookie, userId: ownerId } = await registerUser(`owner-remove-${Date.now()}@test.com`);
    const projectId = await createProject(ownerCookie);

    // Add member
    const { userId: memberId } = await registerUser(`member-remove-${Date.now()}@test.com`);
    const db = getTestDb();
    const { projectMembers } = await import('../../src/server/db/schema.js');
    await db.insert(projectMembers).values({
      id: randomUUID(),
      projectId,
      userId: memberId,
      role: 'member',
      joinedAt: new Date().toISOString(),
    });

    const res = await supertest(app)
      .delete(`/api/team/members/${memberId}`)
      .set('Cookie', ownerCookie);

    expect(res.status).toBe(200);
    expect(res.body.data?.message).toBe('Member removed');

    // Verify removed_at is set
    const { and, eq, isNull } = await import('drizzle-orm');
    const activeRows = await db
      .select()
      .from(projectMembers)
      .where(and(eq(projectMembers.userId, memberId), isNull(projectMembers.removedAt)));
    expect(activeRows.length).toBe(0);
  });

  it('returns 400 when owner tries to remove themselves', async () => {
    const { cookie, userId } = await registerUser(`owner-selfremove-${Date.now()}@test.com`);
    await createProject(cookie);

    const res = await supertest(app)
      .delete(`/api/team/members/${userId}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Cannot remove yourself');
  });

  it('returns 403 for non-owner', async () => {
    const { cookie: ownerCookie } = await registerUser(`owner-rm-perm-${Date.now()}@test.com`);
    const projectId = await createProject(ownerCookie);

    const { cookie: memberCookie, userId: memberId } = await registerUser(`member-rm-perm-${Date.now()}@test.com`);
    const db = getTestDb();
    const { projectMembers } = await import('../../src/server/db/schema.js');
    await db.insert(projectMembers).values({
      id: randomUUID(),
      projectId,
      userId: memberId,
      role: 'member',
      joinedAt: new Date().toISOString(),
    });

    const res = await supertest(app)
      .delete(`/api/team/members/${memberId}`)
      .set('Cookie', memberCookie);
    expect(res.status).toBe(403);
  });
});

describe('POST /api/team/transfer', () => {
  it('swaps owner/member roles across all shared projects', async () => {
    const { cookie: ownerCookie, userId: ownerId } = await registerUser(`owner-transfer-${Date.now()}@test.com`);
    const projectId1 = await createProject(ownerCookie);
    const projectId2 = await createProject(ownerCookie);

    // Add member to both projects
    const { userId: memberId } = await registerUser(`member-transfer-${Date.now()}@test.com`);
    const db = getTestDb();
    const { projectMembers } = await import('../../src/server/db/schema.js');
    const now = new Date().toISOString();
    await db.insert(projectMembers).values([
      { id: randomUUID(), projectId: projectId1, userId: memberId, role: 'member', joinedAt: now },
      { id: randomUUID(), projectId: projectId2, userId: memberId, role: 'member', joinedAt: now },
    ]);

    const res = await supertest(app)
      .post('/api/team/transfer')
      .set('Cookie', ownerCookie)
      .send({ targetUserId: memberId });

    expect(res.status).toBe(200);
    expect(res.body.data?.message).toBe('Ownership transferred');

    // Verify roles swapped on both projects
    const { and, eq, isNull } = await import('drizzle-orm');

    const ownerNewRows = await db
      .select()
      .from(projectMembers)
      .where(and(eq(projectMembers.userId, ownerId), isNull(projectMembers.removedAt)));
    expect(ownerNewRows.every((r: any) => r.role === 'member')).toBe(true);

    const memberNewRows = await db
      .select()
      .from(projectMembers)
      .where(and(eq(projectMembers.userId, memberId), isNull(projectMembers.removedAt)));
    expect(memberNewRows.every((r: any) => r.role === 'owner')).toBe(true);
  });

  it('returns 400 when targeting yourself', async () => {
    const { cookie, userId } = await registerUser(`owner-self-transfer-${Date.now()}@test.com`);
    await createProject(cookie);

    const res = await supertest(app)
      .post('/api/team/transfer')
      .set('Cookie', cookie)
      .send({ targetUserId: userId });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Already the owner');
  });

  it('returns 403 for non-owner', async () => {
    const { cookie: ownerCookie } = await registerUser(`owner-xfr-perm-${Date.now()}@test.com`);
    const projectId = await createProject(ownerCookie);

    const { cookie: memberCookie, userId: memberId } = await registerUser(`member-xfr-perm-${Date.now()}@test.com`);
    const db = getTestDb();
    const { projectMembers } = await import('../../src/server/db/schema.js');
    await db.insert(projectMembers).values({
      id: randomUUID(),
      projectId,
      userId: memberId,
      role: 'member',
      joinedAt: new Date().toISOString(),
    });

    // Create another user to transfer to
    const { userId: targetId } = await registerUser(`target-xfr-perm-${Date.now()}@test.com`);

    const res = await supertest(app)
      .post('/api/team/transfer')
      .set('Cookie', memberCookie)
      .send({ targetUserId: targetId });
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid UUID in targetUserId', async () => {
    const { cookie } = await registerUser(`owner-uuid-${Date.now()}@test.com`);
    await createProject(cookie);

    const res = await supertest(app)
      .post('/api/team/transfer')
      .set('Cookie', cookie)
      .send({ targetUserId: 'not-a-uuid' });

    expect(res.status).toBe(400);
  });
});
