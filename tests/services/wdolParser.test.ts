// tests/services/wdolParser.test.ts — full implementation
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseWdDocument } from '../../src/server/services/wdolParser.js';
import type { ParsedClassification } from '../../src/server/services/wdolParser.js';

const CA_FIXTURE = readFileSync(
  join(process.cwd(), 'tests/fixtures/wds/CA20250001.txt'),
  'utf-8'
);

function loadTxFixture(): string {
  for (const id of ['TX20250001', 'TX20220001', 'TX20230001']) {
    try { return readFileSync(join(process.cwd(), `tests/fixtures/wds/${id}.txt`), 'utf-8'); }
    catch { /* try next */ }
  }
  return readFileSync(join(process.cwd(), 'tests/fixtures/wds/TX20250001.txt'), 'utf-8');
}
const TX_FIXTURE = loadTxFixture();

describe('parseWdDocument', () => {
  let caResults: ParsedClassification[];
  let txResults: ParsedClassification[];

  beforeAll(() => {
    caResults = parseWdDocument(CA_FIXTURE);
    txResults = parseWdDocument(TX_FIXTURE);
  });

  it('returns an array of ParsedClassification objects from the CA fixture', () => {
    expect(Array.isArray(caResults)).toBe(true);
    caResults.forEach((c) => {
      expect(c).toHaveProperty('code');
      expect(c).toHaveProperty('description');
      expect(c).toHaveProperty('baseRate');
      expect(c).toHaveProperty('fringeRate');
      expect(c).toHaveProperty('totalRate');
    });
  });

  it('each item has numeric baseRate and fringeRate — not strings', () => {
    caResults.forEach((c) => {
      expect(typeof c.baseRate).toBe('number');
      expect(typeof c.fringeRate).toBe('number');
      expect(typeof c.totalRate).toBe('number');
      expect(Number.isNaN(c.baseRate)).toBe(false);
    });
  });

  it('totalRate === baseRate + fringeRate for every item', () => {
    caResults.forEach((c) => {
      expect(c.totalRate).toBeCloseTo(c.baseRate + c.fringeRate, 2);
    });
  });

  it('code field is uppercase slug, max 20 chars, no spaces or dollar signs', () => {
    caResults.forEach((c) => {
      expect(c.code).toMatch(/^[A-Z0-9_]{1,20}$/);
    });
  });

  it('returns at least 5 classifications from the CA fixture', () => {
    expect(caResults.length).toBeGreaterThanOrEqual(5);
  });

  it('returns at least 3 classifications from the TX fixture', () => {
    expect(txResults.length).toBeGreaterThanOrEqual(3);
  });

  it('deduplicates identical code:baseRate:fringeRate triples', () => {
    const keys = caResults.map((c) => `${c.code}:${c.baseRate}:${c.fringeRate}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('returns empty array for empty string input', () => {
    expect(parseWdDocument('')).toEqual([]);
  });

  it('calling parseWdDocument twice on the same text returns the same count (no regex lastIndex bleed)', () => {
    const first = parseWdDocument(CA_FIXTURE);
    const second = parseWdDocument(CA_FIXTURE);
    expect(first.length).toBe(second.length);
  });
});
