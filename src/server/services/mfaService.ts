import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { encryptSsn, decryptSsn } from './cryptoService.js';

/**
 * Phase 78 — TOTP MFA service (SOC 2 SEC-01..03).
 *
 * Uses `otpauth` (pure JS, no native deps — works on Windows).
 * All persisted secrets/backup codes are AES-256-GCM encrypted via
 * cryptoService (encryptSsn/decryptSsn). Plaintext values are returned
 * to the client only at generation time; afterwards only ciphertext exists.
 */

const ISSUER = 'HCC Prevailing Wage';
const ALGORITHM = 'SHA1' as const; // RFC 6238 standard — required for Google Authenticator compatibility
const DIGITS = 6;
const PERIOD = 30; // seconds
const WINDOW = 1; // accept codes from prev/current/next 30s window

export interface GeneratedTotp {
  secret: string;            // base32 plaintext — for QR display only, never persisted
  qrUri: string;             // otpauth:// URI suitable for QR rendering
  qrDataUrl: string;         // data:image/png;base64,... PNG QR code for <img src> — never persisted
  encryptedSecret: string;   // AES-256-GCM envelope to persist on users.totpSecret
}

/**
 * Generate a fresh TOTP secret + otpauth:// URI + PNG QR data URL.
 * Caller persists encryptedSecret; secret/qrUri/qrDataUrl are returned to the
 * client once for QR display and forgotten. qrDataUrl is never persisted.
 */
export async function generateTotpSecret(label: string): Promise<GeneratedTotp> {
  const secret = new OTPAuth.Secret({ size: 20 }); // 160-bit per RFC 4226
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label,
    algorithm: ALGORITHM,
    digits: DIGITS,
    period: PERIOD,
    secret,
  });
  const qrUri = totp.toString();
  const qrDataUrl = await QRCode.toDataURL(qrUri, { width: 200, margin: 1 });
  return {
    secret: secret.base32,
    qrUri,
    qrDataUrl,
    encryptedSecret: encryptSsn(secret.base32),
  };
}

/**
 * Verify a 6-digit token against an encrypted TOTP secret envelope.
 * Returns true if the token matches within the configured time window.
 * All errors (decrypt failure, malformed token) return false — never throw.
 */
export function verifyTotpToken(encryptedSecret: string, token: string): boolean {
  if (!encryptedSecret || !token) return false;
  // Strip whitespace and normalize — users often paste with spaces
  const cleaned = token.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleaned)) return false;
  try {
    const base32 = decryptSsn(encryptedSecret);
    const totp = new OTPAuth.TOTP({
      issuer: ISSUER,
      label: 'verify',
      algorithm: ALGORITHM,
      digits: DIGITS,
      period: PERIOD,
      secret: OTPAuth.Secret.fromBase32(base32),
    });
    const delta = totp.validate({ token: cleaned, window: WINDOW });
    return delta !== null;
  } catch {
    return false;
  }
}

// ── Backup codes ─────────────────────────────────────────────────────────

/**
 * Generate N cryptographically random backup codes (8-char hex each).
 * Returns plaintext array for one-time client display, plus the JSON-encoded
 * encrypted array suitable for persistence on users.totpBackupCodes.
 */
export function generateBackupCodes(count = 10): { plaintext: string[]; encrypted: string } {
  const plaintext: string[] = [];
  for (let i = 0; i < count; i++) {
    plaintext.push(randomBytes(4).toString('hex')); // 8 hex chars = 32 bits
  }
  const encryptedList = plaintext.map((code) => encryptSsn(code));
  return { plaintext, encrypted: JSON.stringify(encryptedList) };
}

/**
 * Verify a candidate backup code against the persisted encrypted JSON list.
 * On success returns { valid: true, remaining } where `remaining` is the
 * updated JSON-encoded encrypted list (the matched code is removed — backup
 * codes are one-time use). On failure returns { valid: false }.
 *
 * Uses constant-time comparison to avoid timing attacks that would leak which
 * codes are still valid.
 */
export function consumeBackupCode(
  encryptedJson: string | null,
  candidate: string,
): { valid: boolean; remaining: string | null } {
  if (!encryptedJson || !candidate) return { valid: false, remaining: encryptedJson };
  const cleaned = candidate.replace(/\s+/g, '').toLowerCase();
  if (!/^[a-f0-9]{8}$/.test(cleaned)) return { valid: false, remaining: encryptedJson };

  let envelopes: string[];
  try {
    envelopes = JSON.parse(encryptedJson) as string[];
  } catch {
    return { valid: false, remaining: encryptedJson };
  }
  if (!Array.isArray(envelopes)) return { valid: false, remaining: encryptedJson };

  const candidateBuf = Buffer.from(cleaned, 'utf8');
  let matchedIdx = -1;
  for (let i = 0; i < envelopes.length; i++) {
    try {
      const plain = decryptSsn(envelopes[i]);
      const plainBuf = Buffer.from(plain, 'utf8');
      if (
        plainBuf.length === candidateBuf.length &&
        timingSafeEqual(plainBuf, candidateBuf)
      ) {
        matchedIdx = i;
        // Do NOT break early — walk the full list so timing is independent of
        // match position.
      }
    } catch {
      // skip un-decryptable entries (key rotation, corruption)
    }
  }

  if (matchedIdx === -1) return { valid: false, remaining: encryptedJson };

  const next = envelopes.filter((_, i) => i !== matchedIdx);
  return { valid: true, remaining: JSON.stringify(next) };
}
