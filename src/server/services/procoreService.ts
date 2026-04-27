import { getDb } from '../db/index.js';
import { procoreTokens } from '../db/schema.js';
import { encryptSsn, decryptSsn } from './cryptoService.js';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';

export interface ProcoreConnectionStatus {
  connected: boolean;
  companyId?: string;
  accessTokenExpiresAt?: string;
  refreshTokenExpiresAt?: string;
  nearExpiry?: boolean;
}

export async function getProcoreConnection(userId: string): Promise<ProcoreConnectionStatus> {
  const db = getDb();
  const [token] = await db.select().from(procoreTokens).where(eq(procoreTokens.userId, userId)).limit(1);
  if (!token) return { connected: false };

  const refreshExpiry = new Date(token.refreshTokenExpiresAt);
  const daysUntilExpiry = (refreshExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24);

  return {
    connected: true,
    companyId: token.companyId,
    accessTokenExpiresAt: token.accessTokenExpiresAt,
    refreshTokenExpiresAt: token.refreshTokenExpiresAt,
    nearExpiry: daysUntilExpiry < 7,
  };
}

export async function saveProcoreTokens(userId: string, params: {
  companyId: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}): Promise<void> {
  const db = getDb();
  const [existing] = await db.select().from(procoreTokens).where(eq(procoreTokens.userId, userId)).limit(1);

  const encrypted = {
    accessTokenEncrypted: encryptSsn(params.accessToken),
    refreshTokenEncrypted: encryptSsn(params.refreshToken),
  };

  if (existing) {
    await db.update(procoreTokens).set({
      companyId: params.companyId,
      ...encrypted,
      accessTokenExpiresAt: params.accessTokenExpiresAt.toISOString(),
      refreshTokenExpiresAt: params.refreshTokenExpiresAt.toISOString(),
      updatedAt: new Date().toISOString(),
    }).where(eq(procoreTokens.userId, userId));
  } else {
    await db.insert(procoreTokens).values({
      id: randomUUID(),
      userId,
      companyId: params.companyId,
      ...encrypted,
      accessTokenExpiresAt: params.accessTokenExpiresAt.toISOString(),
      refreshTokenExpiresAt: params.refreshTokenExpiresAt.toISOString(),
      connectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
}

export async function deleteProcoreTokens(userId: string): Promise<void> {
  const db = getDb();
  await db.delete(procoreTokens).where(eq(procoreTokens.userId, userId));
}

export async function getDecryptedProcoreTokens(userId: string): Promise<{ accessToken: string; refreshToken: string; companyId: string } | null> {
  const db = getDb();
  const [token] = await db.select().from(procoreTokens).where(eq(procoreTokens.userId, userId)).limit(1);
  if (!token) return null;
  return {
    accessToken: decryptSsn(token.accessTokenEncrypted),
    refreshToken: decryptSsn(token.refreshTokenEncrypted),
    companyId: token.companyId,
  };
}

export async function getValidProcoreToken(userId: string): Promise<{ accessToken: string; companyId: string } | null> {
  const db = getDb();
  const [tokenRow] = await db.select().from(procoreTokens).where(eq(procoreTokens.userId, userId)).limit(1);
  if (!tokenRow) return null;

  const accessExpiry = new Date(tokenRow.accessTokenExpiresAt);
  const fiveMinutes = 5 * 60 * 1000;

  if (Date.now() < accessExpiry.getTime() - fiveMinutes) {
    return { accessToken: decryptSsn(tokenRow.accessTokenEncrypted), companyId: tokenRow.companyId };
  }

  // Refresh expired access token
  const refreshToken = decryptSsn(tokenRow.refreshTokenEncrypted);
  const clientId = process.env.PROCORE_CLIENT_ID;
  const clientSecret = process.env.PROCORE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const resp = await fetch('https://login.procore.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      redirect_uri: process.env.PROCORE_REDIRECT_URI ?? '',
    }),
  });

  if (!resp.ok) return null;

  const tokens = await resp.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    created_at?: number;
  };

  const now = Date.now();
  await saveProcoreTokens(userId, {
    companyId: tokenRow.companyId,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || refreshToken,
    accessTokenExpiresAt: new Date(now + tokens.expires_in * 1000),
    // Procore refresh tokens last 1 year
    refreshTokenExpiresAt: new Date(now + 365 * 24 * 60 * 60 * 1000),
  });

  return { accessToken: tokens.access_token, companyId: tokenRow.companyId };
}
