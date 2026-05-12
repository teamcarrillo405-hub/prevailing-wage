import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Phase 126 — OAuth nonce hardening (Pitfall 3)', () => {
  const src = readFileSync(resolve(__dirname, '../../src/server/routes/integrations.ts'), 'utf-8');

  it('contains zero Math.random calls', () => {
    expect(src).not.toMatch(/Math\.random/);
  });

  it('uses randomBytes(16).toString("hex") for both OAuth state nonces', () => {
    const matches = src.match(/randomBytes\(16\)\.toString\(['"]hex['"]\)/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('imports randomBytes from node:crypto', () => {
    expect(src).toMatch(/import\s*\{[^}]*randomBytes[^}]*\}\s*from\s*['"]node:crypto['"]/);
  });
});
