import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { randomUUID } from 'crypto';
import * as OTPAuth from 'otpauth';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
  process.env.SSN_ENCRYPTION_KEYS ||= JSON.stringify([
    { id: 'k1', key: Buffer.alloc(32, 1).toString('base64'), active: true },
  ]);
});

// Dynamic imports after env setup
const { app } = await import('../../src/server/index.js');
const { hashPassword } = await import('../../src/server/services/auth.js');
const { generateTotpSecret } = await import('../../src/server/services/mfaService.js');
const { getDb } = await import('../../src/server/db/index.js');
const { users, projectMembers } = await import('../../src/server/db/schema.js');
const { eq } = await import('drizzle-orm');

// Helper: register a user and return cookie + userId
async function registerUser(email: string, password = 'SecurePass99!') {
  const res = await supertest(app).post('/api/auth/register').send({ email, password });
  expect(res.status).toBe(201);
  const cookies = res.headers['set-cookie'] as string[] | string;
  const cookie = Array.isArray(cookies) ? cookies.join('; ') : cookies;
  return { cookie, userId: res.body.data?.user?.id as string };
}

// Helper: create a project and return projectId
async function createProject(cookie: string) {
  const res = await supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({
      name: 'MFA Test Project',
      state: 'CA',
      county: 'Los Angeles',
      contractType: 'federal-davis-bacon',
      awardDate: '2025-09-01',
      fundingType: 'federal',
    });
  expect(res.status).toBe(201);
  return res.body.data?.project?.id as string;
}

// Helper: compute current TOTP code from base32 secret
function getTotpCode(base32: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: 'HCC Prevailing Wage',
    label: 'test',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(base32),
  });
  return totp.generate();
}

// ── /api/mfa route tests ───────────────────────────────────────────────────

describe('POST /api/mfa/setup', () => {
  it('Test 1: unauthenticated returns 401', async () => {
    const res = await supertest(app).post('/api/mfa/setup').send({});
    expect(res.status).toBe(401);
  });

  it('Test 2: authenticated returns 200 with qrUri, qrDataUrl, secret, backupCodes[10]; second call returns 409', async () => {
    const { cookie } = await registerUser(`mfa-setup-${Date.now()}@test.com`);

    const res = await supertest(app)
      .post('/api/mfa/setup')
      .set('Cookie', cookie)
      .send({});

    expect(res.status).toBe(200);
    const { qrUri, qrDataUrl, secret, backupCodes } = res.body.data;
    expect(typeof qrUri).toBe('string');
    expect(qrUri).toMatch(/^otpauth:\/\//);
    expect(qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(typeof secret).toBe('string');
    expect(Array.isArray(backupCodes)).toBe(true);
    expect(backupCodes).toHaveLength(10);

    // Second call returns 409 (already enrolled or mid-enrollment)
    const res2 = await supertest(app)
      .post('/api/mfa/setup')
      .set('Cookie', cookie)
      .send({});
    expect(res2.status).toBe(409);
  });
});

describe('POST /api/mfa/verify-setup', () => {
  it('Test 3: valid TOTP code returns 200 and sets totpEnabled=true in DB', async () => {
    const email = `mfa-verify-${Date.now()}@test.com`;
    const { cookie, userId } = await registerUser(email);

    const setupRes = await supertest(app)
      .post('/api/mfa/setup')
      .set('Cookie', cookie)
      .send({});
    expect(setupRes.status).toBe(200);
    const { secret } = setupRes.body.data;

    const code = getTotpCode(secret);

    const verifyRes = await supertest(app)
      .post('/api/mfa/verify-setup')
      .set('Cookie', cookie)
      .send({ token: code });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data?.enabled).toBe(true);

    // Verify DB flag flipped
    const db = getDb();
    const [row] = await db.select({ totpEnabled: users.totpEnabled }).from(users).where(eq(users.id, userId)).limit(1);
    expect(row?.totpEnabled).toBe(true);
  });

  it('Test 4: wrong token returns 400 with error', async () => {
    const { cookie } = await registerUser(`mfa-verify-bad-${Date.now()}@test.com`);

    await supertest(app).post('/api/mfa/setup').set('Cookie', cookie).send({});

    const res = await supertest(app)
      .post('/api/mfa/verify-setup')
      .set('Cookie', cookie)
      .send({ token: '000000' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid verification code');
  });
});

// ── transfer-ownership MFA gate ────────────────────────────────────────────

describe('POST /api/team/:projectId/transfer-ownership — MFA gate', () => {
  it('Test 5: caller with MFA enabled, no totpToken → 401 with MFA error', async () => {
    const email = `owner-mfa-gate-${Date.now()}@test.com`;
    const password = 'SecurePass99!';
    const { cookie: ownerCookie, userId: ownerId } = await registerUser(email, password);
    const projectId = await createProject(ownerCookie);

    // Add a member to be the new owner target
    const { userId: memberId } = await registerUser(`member-mfa-gate-${Date.now()}@test.com`);
    const db = getDb();
    await db.insert(projectMembers).values({
      id: randomUUID(),
      projectId,
      userId: memberId,
      role: 'member',
      joinedAt: new Date().toISOString(),
    });

    // Enroll owner in MFA
    const setupRes = await supertest(app).post('/api/mfa/setup').set('Cookie', ownerCookie).send({});
    expect(setupRes.status).toBe(200);
    const { secret } = setupRes.body.data;
    const verifyCode = getTotpCode(secret);
    const verifyRes = await supertest(app).post('/api/mfa/verify-setup').set('Cookie', ownerCookie).send({ token: verifyCode });
    expect(verifyRes.status).toBe(200);

    // Transfer without TOTP → 401
    const res = await supertest(app)
      .post(`/api/team/${projectId}/transfer-ownership`)
      .set('Cookie', ownerCookie)
      .send({ newOwnerId: memberId, confirmPassword: password });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/MFA verification required/i);
  });

  it('Test 6: caller with MFA enabled, valid totpToken → 200', async () => {
    const email = `owner-mfa-ok-${Date.now()}@test.com`;
    const password = 'SecurePass99!';
    const { cookie: ownerCookie, userId: ownerId } = await registerUser(email, password);
    const projectId = await createProject(ownerCookie);

    const { userId: memberId } = await registerUser(`member-mfa-ok-${Date.now()}@test.com`);
    const db = getDb();
    await db.insert(projectMembers).values({
      id: randomUUID(),
      projectId,
      userId: memberId,
      role: 'member',
      joinedAt: new Date().toISOString(),
    });

    // Enroll owner in MFA
    const setupRes = await supertest(app).post('/api/mfa/setup').set('Cookie', ownerCookie).send({});
    const { secret } = setupRes.body.data;
    const code1 = getTotpCode(secret);
    await supertest(app).post('/api/mfa/verify-setup').set('Cookie', ownerCookie).send({ token: code1 });

    // Transfer WITH TOTP → 200
    const code2 = getTotpCode(secret);
    const res = await supertest(app)
      .post(`/api/team/${projectId}/transfer-ownership`)
      .set('Cookie', ownerCookie)
      .send({ newOwnerId: memberId, confirmPassword: password, totpToken: code2 });

    expect(res.status).toBe(200);
    expect(res.body.data?.message).toBe('Ownership transferred successfully');
  });
});

// ── invite revocation MFA gate ──────────────────────────────────────────────

describe('DELETE /api/team/invite — MFA gate', () => {
  it('Test 7: caller with MFA enabled, no totpToken → 401 with MFA error', async () => {
    const email = `owner-revoke-mfa-${Date.now()}@test.com`;
    const { cookie: ownerCookie } = await registerUser(email);
    await createProject(ownerCookie);

    // Create pending invite first
    const inviteRes = await supertest(app)
      .post('/api/team/invite')
      .set('Cookie', ownerCookie)
      .send({ email: `invitee-revoke-mfa-${Date.now()}@test.com` });
    expect(inviteRes.status).toBe(201);

    // Enroll in MFA
    const setupRes = await supertest(app).post('/api/mfa/setup').set('Cookie', ownerCookie).send({});
    const { secret } = setupRes.body.data;
    const code1 = getTotpCode(secret);
    await supertest(app).post('/api/mfa/verify-setup').set('Cookie', ownerCookie).send({ token: code1 });

    // Delete invite without TOTP → 401
    const res = await supertest(app)
      .delete('/api/team/invite')
      .set('Cookie', ownerCookie)
      .send({});

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/MFA verification required/i);
  });
});

// ── login MFA gate regression (Test 8) ─────────────────────────────────────

describe('POST /api/auth/login — MFA gate regression (SEC-01)', () => {
  it('Test 8: enrolled user receives requiresMfa:true and NO JWT cookie', async () => {
    const email = `enrolled-owner-${Date.now()}@test.com`;
    const password = 'CorrectHorseBattery9!';
    const passwordHash = await hashPassword(password);
    const userId = randomUUID();

    // Generate a real TOTP secret so the encrypted envelope is valid
    const { encryptedSecret } = await generateTotpSecret(email);

    const db = getDb();
    const now = new Date().toISOString();
    await db.insert(users).values({
      id: userId,
      email,
      passwordHash,
      totpEnabled: true,
      totpSecret: encryptedSecret,
      createdAt: now,
      updatedAt: now,
    });

    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ email, password });

    expect(res.status).toBe(200);
    expect(res.body.data.requiresMfa).toBe(true);
    expect(res.body.data.userId).toBe(userId);

    // No token field in body
    expect(res.body.data.token).toBeUndefined();

    // No auth cookie issued
    const setCookie = res.headers['set-cookie'] ?? [];
    const cookieStr = Array.isArray(setCookie) ? setCookie.join(';') : String(setCookie);
    // pw_session is the cookie name per auth.ts COOKIE_NAME
    expect(cookieStr).not.toMatch(/pw_session=/);
  });
});
