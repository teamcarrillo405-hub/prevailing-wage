import { describe, it, expect, beforeAll } from 'vitest';
import * as OTPAuth from 'otpauth';

// Set env vars before any module with startup assertions
beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
  process.env.SSN_ENCRYPTION_KEYS ||= JSON.stringify([
    { id: 'k1', key: Buffer.alloc(32, 1).toString('base64'), active: true },
  ]);
});

// Dynamic imports AFTER env setup to avoid cryptoService process.exit
const { generateTotpSecret, verifyTotpToken, generateBackupCodes, consumeBackupCode } =
  await import('../../src/server/services/mfaService.js');

describe('mfaService.generateTotpSecret', () => {
  it('Test 1: returns qrDataUrl as a PNG data URL', async () => {
    const result = await generateTotpSecret('test@example.com');
    expect(result.qrDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('Test 2: returns non-empty base32 secret and otpauth:// qrUri', async () => {
    const result = await generateTotpSecret('user@example.com');
    expect(result.secret).toMatch(/^[A-Z2-7]+$/);
    expect(result.qrUri).toMatch(/^otpauth:\/\//);
    expect(result.encryptedSecret).toBeTruthy();
  });
});

describe('mfaService.verifyTotpToken', () => {
  it('Test 3: accepts a freshly generated TOTP for the same secret', async () => {
    const result = await generateTotpSecret('happy@example.com');
    // Build TOTP from returned base32 to compute current code
    const totp = new OTPAuth.TOTP({
      issuer: 'HCC Prevailing Wage',
      label: 'happy@example.com',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(result.secret),
    });
    const code = totp.generate();
    expect(verifyTotpToken(result.encryptedSecret, code)).toBe(true);
  });

  it('Test 4: returns false for empty args and bad token', () => {
    expect(verifyTotpToken('', '')).toBe(false);
    // An encrypted envelope exists but token is clearly wrong
    expect(verifyTotpToken('someenvelope', 'abcdef')).toBe(false);
  });
});

describe('mfaService.generateBackupCodes', () => {
  it('Test 5: generates 5 codes matching /^[a-f0-9]{8}$/ and valid encrypted JSON', () => {
    const result = generateBackupCodes(5);
    expect(result.plaintext).toHaveLength(5);
    for (const code of result.plaintext) {
      expect(code).toMatch(/^[a-f0-9]{8}$/);
    }
    const parsed = JSON.parse(result.encrypted);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(5);
  });
});

describe('mfaService.consumeBackupCode', () => {
  it('Test 6: valid code returns valid:true with n-1 remaining; second use returns valid:false', () => {
    const { plaintext, encrypted } = generateBackupCodes(3);
    const validCode = plaintext[1];

    // First use — should succeed
    const first = consumeBackupCode(encrypted, validCode);
    expect(first.valid).toBe(true);
    expect(first.remaining).not.toBeNull();
    const remaining = JSON.parse(first.remaining!) as string[];
    expect(remaining).toHaveLength(2);

    // Second use of same code on the returned remaining list — should fail
    const second = consumeBackupCode(first.remaining, validCode);
    expect(second.valid).toBe(false);
  });
});
