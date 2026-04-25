import { getDb } from '../db/index.js';
import { qboTokens } from '../db/schema.js';
import { encryptSsn, decryptSsn } from './cryptoService.js';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';

export interface QboConnectionStatus {
  connected: boolean;
  realmId?: string;
  accessTokenExpiresAt?: string;
  refreshTokenExpiresAt?: string;
  nearExpiry?: boolean; // true if refresh token expires in < 7 days
}

export async function getQboConnection(userId: string): Promise<QboConnectionStatus> {
  const db = getDb();
  const [token] = await db.select().from(qboTokens).where(eq(qboTokens.userId, userId)).limit(1);
  if (!token) return { connected: false };

  const refreshExpiry = new Date(token.refreshTokenExpiresAt);
  const daysUntilExpiry = (refreshExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24);

  return {
    connected: true,
    realmId: token.realmId,
    accessTokenExpiresAt: token.accessTokenExpiresAt,
    refreshTokenExpiresAt: token.refreshTokenExpiresAt,
    nearExpiry: daysUntilExpiry < 7,
  };
}

export async function saveQboTokens(userId: string, params: {
  realmId: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}): Promise<void> {
  const db = getDb();
  const [existing] = await db.select().from(qboTokens).where(eq(qboTokens.userId, userId)).limit(1);

  const encrypted = {
    accessTokenEncrypted: encryptSsn(params.accessToken),
    refreshTokenEncrypted: encryptSsn(params.refreshToken),
  };

  if (existing) {
    await db.update(qboTokens).set({
      realmId: params.realmId,
      ...encrypted,
      accessTokenExpiresAt: params.accessTokenExpiresAt.toISOString(),
      refreshTokenExpiresAt: params.refreshTokenExpiresAt.toISOString(),
      updatedAt: new Date().toISOString(),
    }).where(eq(qboTokens.userId, userId));
  } else {
    await db.insert(qboTokens).values({
      id: randomUUID(),
      userId,
      realmId: params.realmId,
      ...encrypted,
      accessTokenExpiresAt: params.accessTokenExpiresAt.toISOString(),
      refreshTokenExpiresAt: params.refreshTokenExpiresAt.toISOString(),
      connectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
}

export async function deleteQboTokens(userId: string): Promise<void> {
  const db = getDb();
  await db.delete(qboTokens).where(eq(qboTokens.userId, userId));
}

export async function getDecryptedTokens(userId: string): Promise<{ accessToken: string; refreshToken: string; realmId: string } | null> {
  const db = getDb();
  const [token] = await db.select().from(qboTokens).where(eq(qboTokens.userId, userId)).limit(1);
  if (!token) return null;
  return {
    accessToken: decryptSsn(token.accessTokenEncrypted),
    refreshToken: decryptSsn(token.refreshTokenEncrypted),
    realmId: token.realmId,
  };
}

/**
 * Returns a valid (non-expired) access token for the user, refreshing it
 * transparently if it has expired or will expire in the next 5 minutes.
 * Returns null if the user has no QB connection or the refresh fails.
 */
export async function getValidAccessToken(userId: string): Promise<{ accessToken: string; realmId: string } | null> {
  const db = getDb();
  const [tokenRow] = await db.select().from(qboTokens).where(eq(qboTokens.userId, userId)).limit(1);
  if (!tokenRow) return null;

  const accessExpiry = new Date(tokenRow.accessTokenExpiresAt);
  const fiveMinutes = 5 * 60 * 1000;

  if (Date.now() < accessExpiry.getTime() - fiveMinutes) {
    // Token still valid — return it directly
    return { accessToken: decryptSsn(tokenRow.accessTokenEncrypted), realmId: tokenRow.realmId };
  }

  // Access token expired (or near expiry) — attempt refresh
  const refreshToken = decryptSsn(tokenRow.refreshTokenEncrypted);
  const clientId = process.env.QBO_CLIENT_ID;
  const clientSecret = process.env.QBO_CLIENT_SECRET;

  if (!clientId || !clientSecret) return null;

  const resp = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  });

  if (!resp.ok) return null;

  const tokens = await resp.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    x_refresh_token_expires_in?: number;
  };

  const now = Date.now();

  await saveQboTokens(userId, {
    realmId: tokenRow.realmId,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || refreshToken,
    accessTokenExpiresAt: new Date(now + tokens.expires_in * 1000),
    refreshTokenExpiresAt: new Date(now + (tokens.x_refresh_token_expires_in ?? 8640000) * 1000),
  });

  return { accessToken: tokens.access_token, realmId: tokenRow.realmId };
}
