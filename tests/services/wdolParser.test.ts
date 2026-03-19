// tests/services/wdolParser.test.ts
// Wave 0 stubs — all todo until Wave 3 implements them
import { describe, it, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const CA_FIXTURE = readFileSync(
  join(process.cwd(), 'tests/fixtures/wds/CA20250001.txt'),
  'utf-8'
);

function loadTxFixture(): string {
  // Try numbered variants since the actual TX WD id may differ
  for (const id of ['TX20250001', 'TX20220001', 'TX20230001']) {
    try {
      return readFileSync(join(process.cwd(), `tests/fixtures/wds/${id}.txt`), 'utf-8');
    } catch { /* try next */ }
  }
  // Fall through to the always-present TX20250001.txt
  return readFileSync(join(process.cwd(), 'tests/fixtures/wds/TX20250001.txt'), 'utf-8');
}
const TX_FIXTURE = loadTxFixture();

describe('parseWdDocument', () => {
  it.todo('returns an array of ParsedClassification objects from the CA fixture');
  it.todo('each item has numeric baseRate and fringeRate — not strings');
  it.todo('totalRate === baseRate + fringeRate for every item');
  it.todo('code field is uppercase slug, max 20 chars, no spaces or dollar signs');
  it.todo('returns at least 5 classifications from the CA fixture');
  it.todo('returns at least 3 classifications from the TX fixture');
  it.todo('deduplicates identical code:baseRate:fringeRate triples');
  it.todo('returns empty array for empty string input');
  it.todo('calling parseWdDocument twice on the same text returns the same count (no regex lastIndex bleed)');
});
