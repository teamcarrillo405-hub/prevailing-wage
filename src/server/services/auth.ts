import argon2 from 'argon2';
import { SignJWT, jwtVerify } from 'jose';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB — OWASP 2025
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export interface UserPayload {
  userId: string;
  email: string;
  /**
   * Phase 82 (Gap-2): Session version stamp. JWTs are rejected if this value
   * doesn't match the user's current `sessionVersion` column. Bump it via
   * POST /api/security/revoke-sessions to invalidate all outstanding tokens.
   */
  sv?: number;
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('Missing required env var: JWT_SECRET');
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: UserPayload): Promise<string> {
  // Always stamp the session-version claim (default 0) so the verify path can
  // strictly compare. If callers omit `sv`, we emit 0 to match the column
  // default — keeps backward-compatible tokens valid until first revoke.
  const claims: Record<string, unknown> = {
    userId: payload.userId,
    email: payload.email,
    sv: payload.sv ?? 0,
  };
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<UserPayload> {
  const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] });
  return payload as unknown as UserPayload;
}
