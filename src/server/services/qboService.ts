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
