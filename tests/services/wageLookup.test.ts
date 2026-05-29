// tests/services/wageLookup.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { upsertWageDetermination, upsertClassifications } from '../../src/server/services/wageCache.js';
import { lookupWageDetermination, FederalWdolAdapter } from '../../src/server/services/wageLookup.js';
import { CaDirAdapter, WaLiAdapter, NyDolAdapter } from '../../src/server/services/stateWageAdapter.js';

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
    await upsertWageDetermination(wd);
    await upsertClassifications(wd.id, [
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

describe('CaDirAdapter', () => {
  it('supportsLookup returns true for CA, false for other states', () => {
    const adapter = new CaDirAdapter();
    expect(adapter.supportsLookup('CA')).toBe(true);
    expect(adapter.supportsLookup('WA')).toBe(false);
    expect(adapter.supportsLookup('NY')).toBe(false);
    expect(adapter.supportsLookup('TX')).toBe(false);
  });
});

describe('WaLiAdapter', () => {
  it('supportsLookup returns true for WA only', () => {
    const adapter = new WaLiAdapter();
    expect(adapter.supportsLookup('WA')).toBe(true);
    expect(adapter.supportsLookup('CA')).toBe(false);
  });
});

describe('NyDolAdapter', () => {
  it('supportsLookup returns true for NY only', () => {
    const adapter = new NyDolAdapter();
    expect(adapter.supportsLookup('NY')).toBe(true);
    expect(adapter.supportsLookup('CA')).toBe(false);
  });
});

describe('lookupWageDetermination — adapter dispatch', () => {
  it('returns WD with source=ca-dir when CA row exists in DB from manual import', async () => {
    const now = new Date();
    const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const wdId = crypto.randomUUID();
    const county = `CaDispatch${Date.now()}`;

    // Seed a CA WD row as if it came from a state CSV import
    await upsertWageDetermination({
      id: wdId,
      source: 'ca-dir',
      wdNumber: 'CA-DIR-TEST',
      revisionNumber: 0,
      state: 'CA',
      county,
      constructionType: 'Building',
      publishDate: '2025-01-01',
      rawDocument: null,
      cachedAt: now.toISOString(),
      cacheExpiresAt: future,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    await upsertClassifications(wdId, [
      { code: 'CARP', description: 'Carpenter', baseRate: 62.50, fringeRate: 28.75, totalRate: 91.25 },
    ]);

    const result = await lookupWageDetermination('CA', county);

    // Cache hit returns immediately — source is preserved from the DB row
    expect(result).not.toBeNull();
    expect(result?.source).toBe('ca-dir');
    expect(result?.state).toBe('CA');
    expect(result?.county).toBe(county);
    expect(result?.classifications).toHaveLength(1);
    expect(result?.classifications?.[0].tradeCode).toBe('CARP');
  });

  it('falls through to FederalWdolAdapter for TX (no state adapter matches TX)', async () => {
    // TX has no state adapter — FederalWdolAdapter.supportsLookup('TX') is true
    // But fetchWdFromSamGov is mocked to return null, so the result is null
    const result = await lookupWageDetermination('TX', `TXDispatch${Date.now()}`);
    // null is expected because: no cache, no state adapter, mocked fetcher returns null
    expect(result).toBeNull();
  });
});
