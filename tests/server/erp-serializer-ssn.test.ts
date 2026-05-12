import { describe, it, expect } from 'vitest';
import { serializeWorkerForErp } from '../../src/server/integrations/erpSerializer.js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Phase 126 — ERP serializer (SEC-01)', () => {
  it('produces no SSN field and no 9-digit pattern even when input has both', () => {
    const payload = serializeWorkerForErp({
      id: 'w1',
      name: 'Jane Doe',
      ssnEncrypted: 'enc:abc123def456',
      ssnLast4: '1234',
      tradeClassification: 'Carpenter',
      baseRateSnapshot: '45.00',
      phone: '555123456789',  // contains a 9-digit sequence "555123456" if naively spread
    });
    const json = JSON.stringify(payload);
    expect(json).not.toMatch(/ssn/i);
    expect(json).not.toMatch(/\b\d{9}\b/);
    expect(json).not.toContain('555123456789');
  });

  it('source file uses no spread operator on worker input (SEC-01 enforcement)', () => {
    const src = readFileSync(resolve(__dirname, '../../src/server/integrations/erpSerializer.ts'), 'utf-8');
    // No spread of a `worker` or similar identifier into the output payload.
    expect(src).not.toMatch(/\.\.\.\s*worker/);
    expect(src).not.toMatch(/Object\.assign\(\s*\{\s*\}\s*,\s*worker/);
  });

  it('preserves all non-sensitive fields', () => {
    const payload = serializeWorkerForErp({
      id: 'w2', name: 'Bob', tradeClassification: 'Electrician', baseRateSnapshot: '60.00',
    });
    expect(payload).toEqual({ id: 'w2', name: 'Bob', tradeClassification: 'Electrician', baseRateSnapshot: '60.00' });
  });
});
