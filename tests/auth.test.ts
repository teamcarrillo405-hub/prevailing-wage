import { describe, it, expect, beforeAll } from 'vitest';
import { hashPassword, verifyPassword, createSessionToken } from '../src/server/services/auth.js';
import { decodeJwt } from 'jose';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
});

describe('password hashing', () => {
  it('hashPassword produces a valid Argon2id hash', async () => {
    const hash = await hashPassword('testpassword');
    expect(hash).toMatch(/^\$argon2id\$/);
  });
  it('hashPassword produces different hashes for same input (salt uniqueness)', async () => {
    const [h1, h2] = await Promise.all([hashPassword('same'), hashPassword('same')]);
    expect(h1).not.toBe(h2);
  });
  it('verifyPassword returns true for correct password', async () => {
    const hash = await hashPassword('correct');
    expect(await verifyPassword(hash, 'correct')).toBe(true);
  });
  it('verifyPassword returns false for wrong password', async () => {
    const hash = await hashPassword('correct');
    expect(await verifyPassword(hash, 'wrong')).toBe(false);
  });
});

describe('createSessionToken', () => {
  it('returns a signed JWT string', async () => {
    const token = await createSessionToken({ userId: 'u1', email: 'a@b.com' });
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);
  });
  it('JWT payload contains userId and email', async () => {
    const token = await createSessionToken({ userId: 'u1', email: 'a@b.com' });
    const payload = decodeJwt(token);
    expect(payload.userId).toBe('u1');
    expect(payload.email).toBe('a@b.com');
  });
  it('JWT expires in approximately 7 days', async () => {
    const token = await createSessionToken({ userId: 'u1', email: 'a@b.com' });
    const payload = decodeJwt(token);
    const sevenDays = 7 * 24 * 60 * 60;
    expect(payload.exp! - payload.iat!).toBeCloseTo(sevenDays, -2);
  });
});
