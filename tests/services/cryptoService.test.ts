import { describe, it, expect, beforeAll } from 'vitest';
import { createHash } from 'node:crypto';

// Must set ENCRYPTION_KEY_V1 before importing cryptoService (module-level assertion runs on import)
const TEST_KEY = createHash('sha256').update('test-key-for-crypto-service').digest('hex'); // 64-char hex
process.env.ENCRYPTION_KEY_V1 = TEST_KEY;

// Dynamic import so env var is set before module loads
const { encryptSsn, decryptSsn } = await import('../../src/server/services/cryptoService.js');

describe('cryptoService', () => {
  it('Test 1: encryptSsn returns JSON envelope with required keys and v=1', () => {
    const envelope = encryptSsn('123456789');
    const parsed = JSON.parse(envelope);
    expect(parsed).toHaveProperty('v', '1');
    expect(parsed).toHaveProperty('iv');
    expect(parsed).toHaveProperty('tag');
    expect(parsed).toHaveProperty('ct');
  });

  it('Test 2: decryptSsn round-trips encryptSsn output back to original plaintext', () => {
    const plaintext = '123456789';
    const envelope = encryptSsn(plaintext);
    const decrypted = decryptSsn(envelope);
    expect(decrypted).toBe(plaintext);
  });

  it('Test 3: Two calls to encryptSsn produce different iv values (random IV per call)', () => {
    const envelope1 = JSON.parse(encryptSsn('123456789'));
    const envelope2 = JSON.parse(encryptSsn('123456789'));
    expect(envelope1.iv).not.toBe(envelope2.iv);
  });

  it('Test 4: Tampered ciphertext (flip a byte in ct) throws on decryptSsn', () => {
    const envelope = JSON.parse(encryptSsn('123456789'));
    // Flip first byte of ct by base64-decoding, modifying, re-encoding
    const ctBytes = Buffer.from(envelope.ct, 'base64');
    ctBytes[0] = ctBytes[0] ^ 0xff;
    envelope.ct = ctBytes.toString('base64');
    expect(() => decryptSsn(JSON.stringify(envelope))).toThrow();
  });

  it('Test 5: Envelope with v:"2" throws "Unknown SSN envelope version: 2"', () => {
    const envelope = JSON.parse(encryptSsn('123456789'));
    envelope.v = '2';
    expect(() => decryptSsn(JSON.stringify(envelope))).toThrow('Unknown SSN envelope version: 2');
  });

  it('Test 6: encryptSsn("1234") round-trips correctly (4-digit partial SSN for backfill)', () => {
    const plaintext = '1234';
    const envelope = encryptSsn(plaintext);
    const decrypted = decryptSsn(envelope);
    expect(decrypted).toBe(plaintext);
  });
});
