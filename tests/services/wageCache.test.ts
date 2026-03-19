// tests/services/wageCache.test.ts
// Wave 0 stubs — all todo until Wave 3 implements them
import { describe, it } from 'vitest';

describe('upsertWageDetermination', () => {
  it.todo('inserts a new row when no row exists for (wdNumber, revisionNumber)');
  it.todo('updates rawDocument, cachedAt, cacheExpiresAt when (wdNumber, revisionNumber) already exists — no duplicate row');
  it.todo('inserted row has cacheExpiresAt 30 days after cachedAt');
});

describe('getCachedWd', () => {
  it.todo('returns the WD row when cacheExpiresAt is in the future');
  it.todo('returns undefined when cacheExpiresAt is in the past');
  it.todo('returns undefined when no row exists for that state + county combination');
  it.todo('returns the most recently published WD when multiple rows match state + county');
});

describe('getCachedClassifications', () => {
  it.todo('returns all classification rows for a given wageDeterminationId');
  it.todo('returns an empty array when no classifications exist for that wageDeterminationId');
});
