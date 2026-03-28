import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';

// Must set ENCRYPTION_KEY_V1 before importing cryptoService (module-level assertion runs on import)
const TEST_KEY = createHash('sha256').update('test-key-for-ecpr-ssn').digest('hex'); // 64-char hex
process.env.ENCRYPTION_KEY_V1 = TEST_KEY;

// Dynamic import so env var is set before module loads
const { encryptSsn } = await import('../../src/server/services/cryptoService.js');
const { resolveEcprSsn } = await import('../../src/server/routes/export.js');

describe('resolveEcprSsn', () => {
  it('Test 1: returns full 9-digit SSN when workerSsnEncrypted holds a 9-digit encrypted value', () => {
    const encrypted = encryptSsn('123456789');
    const result = resolveEcprSsn(encrypted, '6789');
    expect(result).toBe('123456789');
  });

  it('Test 2: falls back to 000000+last4 when workerSsnEncrypted is null', () => {
    const result = resolveEcprSsn(null, '6789');
    expect(result).toBe('0000006789');
  });

  it('Test 3: falls back to 000000+last4 when workerSsnEncrypted holds a 4-digit encrypted value', () => {
    const encrypted = encryptSsn('6789'); // 4-digit partial SSN
    const result = resolveEcprSsn(encrypted, '6789');
    expect(result).toBe('0000006789');
  });

  it('Test 4: uses 0000000000 when both ssnEncrypted and ssnLast4 are null', () => {
    const result = resolveEcprSsn(null, null);
    expect(result).toBe('0000000000');
  });
});
