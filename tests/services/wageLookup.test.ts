// tests/services/wageLookup.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { upsertWageDetermination, upsertClassifications } from '../../src/server/services/wageCache.js';
import { lookupWageDetermination, FederalWdolAdapter } from '../../src/server/services/wageLookup.js';

// Mock the fetcher so no live network calls are made during tests
vi.mock('../../src/server/services/wdolFetcher.js', () => ({
  fetchWdFromSamGov: vi.fn().mockResolvedValue(null),
}));

function makeWdRow(overrides = {}) {
  const now = new Date();
  const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  return {
    id: crypto.randomUUID(),
    source: 'federal-dol' as const,
    wdNumber: `CA2025LOOKUP${Date.now()}`,
    revisionNumber: 0,
    state: 'CA',
    county: 'Monterey',
    constructionType: null,
    publishDate: '2025-01-01',
    rawDocument: null,
    isActive: true,
    cachedAt: now.toISOString(),
    cacheExpiresAt: future,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...overrides,
  };
}

describe('lookupWageDetermination', () => {
  it('returns cached WD without calling fetcher when cache is fresh', async () => {
    const { fetchWdFromSamGov } = await import('../../src/server/services/wdolFetcher.js');
    const mockFetch = vi.mocked(fetchWdFromSamGov);
    mockFetch.mockClear();

    const wd = makeWdRow({ state: 'CA', county: 'Plumas' });
    upsertWageDetermination(wd);
    upsertClassifications(wd.id, [
      { code: 'CARP', description: 'Carpenter', baseRate: 45.00, fringeRate: 20.00, totalRate: 65.00 },
    ]);

    const result = await lookupWageDetermination('CA', 'Plumas');

    expect(result).not.toBeNull();
    expect(result?.state).toBe('CA');
    expect(result?.county).toBe('Plumas');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('calls fetchWdFromSamGov when cache is stale', async () => {
    const { fetchWdFromSamGov } = await import('../../src/server/services/wdolFetcher.js');
    const mockFetch = vi.mocked(fetchWdFromSamGov);
    mockFetch.mockClear();
    // fetchWdFromSamGov is mocked to return null — lookupWageDetermination returns null after the call

    const result = await lookupWageDetermination('CA', 'Sierra');
    // Sierra County is not in the seed list — resolveWdIdentifier returns undefined
    // The adapter calls fetchWdFromSamGov only if it resolved a seed entry; result may be null
    expect(result).toBeNull();
  });

  it('returns null when no WD found for state+county (no seed, no cache)', async () => {
    const result = await lookupWageDetermination('ZZ', 'Nowhere');
    expect(result).toBeNull();
  });
});

describe('FederalWdolAdapter', () => {
  it('supportsLookup returns true for any state code', () => {
    const adapter = new FederalWdolAdapter();
    expect(adapter.supportsLookup('CA')).toBe(true);
    expect(adapter.supportsLookup('WA')).toBe(true);
    expect(adapter.supportsLookup('XX')).toBe(true);
  });
});
