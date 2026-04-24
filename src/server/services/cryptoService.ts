import { logger } from '../logger.js';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const KEY_HEX = process.env.ENCRYPTION_KEY_V1;
if (!KEY_HEX || KEY_HEX.length !== 64) {
  logger.error('[startup] ENCRYPTION_KEY_V1 missing or invalid (must be 64-char hex)');
  process.exit(1);
}
const KEY = Buffer.from(KEY_HEX, 'hex');

export function encryptSsn(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    v: '1',
    len: plaintext.length,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ct: ct.toString('base64'),
  });
}

export function decryptSsn(envelope: string): string {
  const { v, iv: ivB64, tag: tagB64, ct: ctB64 } = JSON.parse(envelope) as {
    v: string; len?: number; iv: string; tag: string; ct: string;
  };
  if (v !== '1') throw new Error(`Unknown SSN envelope version: ${v}`);
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ct = Buffer.from(ctB64, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

// Self-test: encrypt known plaintext, decrypt, verify round-trip (per D-05)
try {
  const testCt = encryptSsn('123456789');
  const testPt = decryptSsn(testCt);
  if (testPt !== '123456789') throw new Error('round-trip mismatch');
} catch (err) {
  logger.error({ err: err }, '[startup] Encryption self-test failed:');
  process.exit(1);
}
