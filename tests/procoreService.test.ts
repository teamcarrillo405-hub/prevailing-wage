/**
 * Tests for procoreService.ts
 * Uses vitest with mocked DB and crypto dependencies.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────
vi.mock('../src/server/db/index.js', () => ({
  getDb: vi.fn(),
}));

vi.mock('../src/server/services/cryptoService.js', () => ({
  encryptSsn: vi.fn((s: string) => `enc:${s}`),
  decryptSsn: vi.fn((s: string) => s.replace(/^enc:/, '')),
}));

import { getDb } from '../src/server/db/index.js';
import {
  getProcoreConnection,
  saveProcoreTokens,
  deleteProcoreTokens,
  getValidProcoreToken,
} from '../src/server/services/procoreService.js';

// ── Helpers ─────────────────────────────────────────────────────────────────
const FAR_FUTURE = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
const NEAR_EXPIRY = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days
const FAR_ACCESS = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h from now
const EXPIRED_ACCESS = new Date(Date.now() - 60 * 1000).toISOString(); // 1 min ago

function makeDbMock(selectResult: unknown[] = []) {
  const chainable = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(selectResult),
    set: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
  };
  return {
    select: vi.fn().mockReturnValue(chainable),
    update: vi.fn().mockReturnValue(chainable),
    insert: vi.fn().mockReturnValue(chainable),
    delete: vi.fn().mockReturnValue(chainable),
    _chain: chainable,
  };
}

describe('getProcoreConnection', () => {
  it('returns { connected: false } when no row exists', async () => {
    const db = makeDbMock([]);
    vi.mocked(getDb).mockReturnValue(db as any);

    const result = await getProcoreConnection('user-1');
    expect(result.connected).toBe(false);
  });

  it('returns { connected: true, nearExpiry: false } when refresh token far in future', async () => {
    const row = {
      companyId: 'c-123',
      accessTokenExpiresAt: FAR_ACCESS,
      refreshTokenExpiresAt: FAR_FUTURE,
      accessTokenEncrypted: 'enc:tok',
      refreshTokenEncrypted: 'enc:ref',
    };
    const db = makeDbMock([row]);
    vi.mocked(getDb).mockReturnValue(db as any);

    const result = await getProcoreConnection('user-1');
    expect(result.connected).toBe(true);
    expect(result.companyId).toBe('c-123');
    expect(result.nearExpiry).toBe(false);
  });

  it('returns nearExpiry: true when refreshTokenExpiresAt is within 7 days', async () => {
    const row = {
      companyId: 'c-123',
      accessTokenExpiresAt: FAR_ACCESS,
      refreshTokenExpiresAt: NEAR_EXPIRY,
      accessTokenEncrypted: 'enc:tok',
      refreshTokenEncrypted: 'enc:ref',
    };
    const db = makeDbMock([row]);
    vi.mocked(getDb).mockReturnValue(db as any);

    const result = await getProcoreConnection('user-1');
    expect(result.nearExpiry).toBe(true);
  });
});

describe('saveProcoreTokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts a new row when none exists', async () => {
    const chainable = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]), // no existing row
      set: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue(undefined),
    };
    const db = {
      select: vi.fn().mockReturnValue(chainable),
      update: vi.fn().mockReturnValue(chainable),
      insert: vi.fn().mockReturnValue(chainable),
      delete: vi.fn().mockReturnValue(chainable),
    };
    vi.mocked(getDb).mockReturnValue(db as any);

    await saveProcoreTokens('user-1', {
      companyId: 'c-123',
      accessToken: 'at',
      refreshToken: 'rt',
      accessTokenExpiresAt: new Date(FAR_ACCESS),
      refreshTokenExpiresAt: new Date(FAR_FUTURE),
    });

    expect(db.insert).toHaveBeenCalled();
    expect(chainable.values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        companyId: 'c-123',
        accessTokenEncrypted: 'enc:at',
        refreshTokenEncrypted: 'enc:rt',
      }),
    );
  });

  it('updates existing row on second call (upsert pattern)', async () => {
    const existingRow = { id: 'existing-id', userId: 'user-1' };
    const chainable = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([existingRow]),
      set: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue(undefined),
    };
    const db = {
      select: vi.fn().mockReturnValue(chainable),
      update: vi.fn().mockReturnValue(chainable),
      insert: vi.fn().mockReturnValue(chainable),
      delete: vi.fn().mockReturnValue(chainable),
    };
    vi.mocked(getDb).mockReturnValue(db as any);

    await saveProcoreTokens('user-1', {
      companyId: 'c-new',
      accessToken: 'new-at',
      refreshToken: 'new-rt',
      accessTokenExpiresAt: new Date(FAR_ACCESS),
      refreshTokenExpiresAt: new Date(FAR_FUTURE),
    });

    expect(db.update).toHaveBeenCalled();
    expect(chainable.set).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'c-new',
        accessTokenEncrypted: 'enc:new-at',
        refreshTokenEncrypted: 'enc:new-rt',
      }),
    );
  });

  it('encrypts accessToken and refreshToken using encryptSsn', async () => {
    const { encryptSsn } = await import('../src/server/services/cryptoService.js');
    const chainable = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      set: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue(undefined),
    };
    const db = {
      select: vi.fn().mockReturnValue(chainable),
      update: vi.fn().mockReturnValue(chainable),
      insert: vi.fn().mockReturnValue(chainable),
      delete: vi.fn().mockReturnValue(chainable),
    };
    vi.mocked(getDb).mockReturnValue(db as any);

    await saveProcoreTokens('user-1', {
      companyId: 'c-x',
      accessToken: 'secret-at',
      refreshToken: 'secret-rt',
      accessTokenExpiresAt: new Date(FAR_ACCESS),
      refreshTokenExpiresAt: new Date(FAR_FUTURE),
    });

    expect(encryptSsn).toHaveBeenCalledWith('secret-at');
    expect(encryptSsn).toHaveBeenCalledWith('secret-rt');
  });
});

describe('deleteProcoreTokens', () => {
  it('removes the row for userId', async () => {
    const chainable = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
      limit: vi.fn().mockResolvedValue([]),
    };
    const db = {
      select: vi.fn().mockReturnValue(chainable),
      delete: vi.fn().mockReturnValue(chainable),
    };
    vi.mocked(getDb).mockReturnValue(db as any);

    await deleteProcoreTokens('user-1');
    expect(db.delete).toHaveBeenCalled();
  });
});

describe('getValidProcoreToken', () => {
  it('returns null when no connection exists', async () => {
    const db = makeDbMock([]);
    vi.mocked(getDb).mockReturnValue(db as any);

    const result = await getValidProcoreToken('user-1');
    expect(result).toBeNull();
  });

  it('returns { accessToken, companyId } when token not near expiry', async () => {
    const row = {
      companyId: 'c-123',
      accessTokenExpiresAt: FAR_ACCESS,
      refreshTokenExpiresAt: FAR_FUTURE,
      accessTokenEncrypted: 'enc:valid-token',
      refreshTokenEncrypted: 'enc:ref',
    };
    const db = makeDbMock([row]);
    vi.mocked(getDb).mockReturnValue(db as any);

    const result = await getValidProcoreToken('user-1');
    expect(result).not.toBeNull();
    expect(result?.accessToken).toBe('valid-token');
    expect(result?.companyId).toBe('c-123');
  });

  it('returns null when token is expired and PROCORE_CLIENT_ID is missing', async () => {
    delete process.env.PROCORE_CLIENT_ID;
    delete process.env.PROCORE_CLIENT_SECRET;

    const row = {
      companyId: 'c-123',
      accessTokenExpiresAt: EXPIRED_ACCESS,
      refreshTokenExpiresAt: FAR_FUTURE,
      accessTokenEncrypted: 'enc:expired-token',
      refreshTokenEncrypted: 'enc:ref',
    };
    const db = makeDbMock([row]);
    vi.mocked(getDb).mockReturnValue(db as any);

    const result = await getValidProcoreToken('user-1');
    expect(result).toBeNull();
  });

  it('calls Procore refresh endpoint and updates DB when token expired', async () => {
    process.env.PROCORE_CLIENT_ID = 'test-client-id';
    process.env.PROCORE_CLIENT_SECRET = 'test-client-secret';
    process.env.PROCORE_REDIRECT_URI = 'http://localhost:4099/callback';

    const row = {
      companyId: 'c-123',
      accessTokenExpiresAt: EXPIRED_ACCESS,
      refreshTokenExpiresAt: FAR_FUTURE,
      accessTokenEncrypted: 'enc:expired-token',
      refreshTokenEncrypted: 'enc:my-refresh',
    };

    // First call returns expired row; subsequent calls for save return []
    let selectCallCount = 0;
    const chainable = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() => {
        selectCallCount++;
        return Promise.resolve(selectCallCount === 1 ? [row] : []);
      }),
      set: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue(undefined),
    };
    const db = {
      select: vi.fn().mockReturnValue(chainable),
      update: vi.fn().mockReturnValue(chainable),
      insert: vi.fn().mockReturnValue(chainable),
      delete: vi.fn().mockReturnValue(chainable),
    };
    vi.mocked(getDb).mockReturnValue(db as any);

    // Mock global fetch for the refresh call
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 7200,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await getValidProcoreToken('user-1');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://login.procore.com/oauth/token',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result?.accessToken).toBe('new-access-token');
    expect(result?.companyId).toBe('c-123');

    vi.unstubAllGlobals();
  });
});
