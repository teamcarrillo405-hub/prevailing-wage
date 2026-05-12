import { describe, it, expect } from 'vitest';
import { encryptCredential, decryptCredential } from '../../src/server/integrations/integrationVault.js';
import { encryptSsn, decryptSsn } from '../../src/server/services/cryptoService.js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Phase 126 — integrationVault (INTG-05, SEC-02)', () => {
  it('round-trips plaintext credentials through AES-256-GCM', () => {
    const plaintext = 'oauth-token-abc-123';
    const ciphertext = encryptCredential(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(ciphertext.length).toBeGreaterThan(0);
    expect(decryptCredential(ciphertext)).toBe(plaintext);
  });

  it('is a pure re-export — same function reference as cryptoService (Pitfall 4)', () => {
    expect(encryptCredential).toBe(encryptSsn);
    expect(decryptCredential).toBe(decryptSsn);
  });

  it('integrationVault.ts imports zero crypto primitives directly', () => {
    const src = readFileSync(resolve(__dirname, '../../src/server/integrations/integrationVault.ts'), 'utf-8');
    expect(src).not.toMatch(/from ['"]node:crypto['"]/);
    expect(src).not.toMatch(/from ['"]crypto['"]/);
    expect(src).not.toMatch(/createCipheriv|createDecipheriv|randomBytes/);
  });
});
