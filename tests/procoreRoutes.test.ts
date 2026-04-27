/**
 * Tests for Procore timesheet-entries and import routes in integrations.ts
 * Tests route handler logic via direct mock of dependencies + supertest.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

// ── All mocks must be declared BEFORE any imports that use them ─────────────

vi.mock('../src/server/db/index.js', () => ({
  getDb: vi.fn(),
}));

vi.mock('../src/server/services/cryptoService.js', () => ({
  encryptSsn: vi.fn((s: string) => `enc:${s}`),
  decryptSsn: vi.fn((s: string) => s.replace(/^enc:/, '')),
}));

vi.mock('../src/server/services/procoreService.js', () => ({
  getValidProcoreToken: vi.fn(),
  getProcoreConnection: vi.fn(),
  saveProcoreTokens: vi.fn(),
  deleteProcoreTokens: vi.fn(),
  getDecryptedProcoreTokens: vi.fn(),
}));

vi.mock('../src/server/services/payrollService.js', () => ({
  upsertPayrollEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/server/db/auditHelpers.js', () => ({
  insertSecurityEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/server/services/qboService.js', () => ({
  getQboConnection: vi.fn(),
  saveQboTokens: vi.fn(),
  deleteQboTokens: vi.fn(),
  getValidAccessToken: vi.fn(),
}));

vi.mock('../src/server/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Mock requireAuth to inject a test user without JWT validation
vi.mock('../src/server/middleware/auth.js', () => ({
  requireAuth: vi.fn((req: any, _res: any, next: any) => {
    req.user = { userId: 'user-123', email: 'test@example.com' };
    next();
  }),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────
import express from 'express';
import request from 'supertest';
import { getValidProcoreToken } from '../src/server/services/procoreService.js';
import { getDb } from '../src/server/db/index.js';
import { upsertPayrollEntry } from '../src/server/services/payrollService.js';
import { integrationsRouter } from '../src/server/routes/integrations.js';

// ── App setup ────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
// Inject user for all requests (bypasses real auth middleware)
app.use('/api/integrations', integrationsRouter);

// ── DB mock helper ────────────────────────────────────────────────────────────
function makePayrollWeekDb(week: unknown) {
  const chainable = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(week ? [week] : []),
  };
  return {
    select: vi.fn().mockReturnValue(chainable),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/integrations/procore/timesheet-entries', () => {
  it('returns 400 when projectId is missing', async () => {
    vi.mocked(getValidProcoreToken).mockResolvedValue({ accessToken: 'tok', companyId: 'c-1' });

    const resp = await request(app)
      .get('/api/integrations/procore/timesheet-entries')
      .query({ startDate: '2025-01-01', endDate: '2025-01-07' });

    expect(resp.status).toBe(400);
    expect(resp.body.error).toMatch(/required/);
  });

  it('returns 400 when startDate is missing', async () => {
    vi.mocked(getValidProcoreToken).mockResolvedValue({ accessToken: 'tok', companyId: 'c-1' });

    const resp = await request(app)
      .get('/api/integrations/procore/timesheet-entries')
      .query({ projectId: '1234', endDate: '2025-01-07' });

    expect(resp.status).toBe(400);
  });

  it('returns 401 when Procore not connected', async () => {
    vi.mocked(getValidProcoreToken).mockResolvedValue(null);

    const resp = await request(app)
      .get('/api/integrations/procore/timesheet-entries')
      .query({ projectId: '1234', startDate: '2025-01-01', endDate: '2025-01-07' });

    expect(resp.status).toBe(401);
    expect(resp.body.error).toMatch(/not connected/i);
  });

  it('maps Procore response to clean rows and returns 200', async () => {
    vi.mocked(getValidProcoreToken).mockResolvedValue({ accessToken: 'tok', companyId: 'c-1' });

    const procoreEntries = [
      {
        id: 999,
        worker: { name: 'Alice Smith', id: 42 },
        hours: '8.0',
        date: '2025-01-06',
        cost_code: { name: 'Concrete' },
        description: 'Foundation pour',
      },
    ];

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => procoreEntries,
      text: async () => '',
    }));

    const resp = await request(app)
      .get('/api/integrations/procore/timesheet-entries')
      .query({ projectId: '1234', startDate: '2025-01-01', endDate: '2025-01-07' });

    expect(resp.status).toBe(200);
    expect(resp.body.data.count).toBe(1);
    expect(resp.body.data.entries[0]).toMatchObject({
      procoreId: '999',
      workerName: 'Alice Smith',
      workerId: '42',
      date: '2025-01-06',
      hours: 8,
      costCode: 'Concrete',
    });

    vi.unstubAllGlobals();
  });
});

describe('POST /api/integrations/procore/import', () => {
  it('returns 400 when weekId is missing', async () => {
    vi.mocked(getValidProcoreToken).mockResolvedValue({ accessToken: 'tok', companyId: 'c-1' });

    const resp = await request(app)
      .post('/api/integrations/procore/import')
      .send({ entries: [{ workerId: 'w1', classificationId: 'c1', date: '2025-01-06', hours: 8 }] });

    expect(resp.status).toBe(400);
  });

  it('returns 400 when entries is empty', async () => {
    vi.mocked(getValidProcoreToken).mockResolvedValue({ accessToken: 'tok', companyId: 'c-1' });

    const resp = await request(app)
      .post('/api/integrations/procore/import')
      .send({ weekId: 'wk-1', entries: [] });

    expect(resp.status).toBe(400);
  });

  it('returns 401 when Procore not connected', async () => {
    vi.mocked(getValidProcoreToken).mockResolvedValue(null);

    const resp = await request(app)
      .post('/api/integrations/procore/import')
      .send({ weekId: 'wk-1', entries: [{ workerId: 'w1', classificationId: 'c1', date: '2025-01-06', hours: 8 }] });

    expect(resp.status).toBe(401);
  });

  it('returns 423 when payroll week is already submitted', async () => {
    vi.mocked(getValidProcoreToken).mockResolvedValue({ accessToken: 'tok', companyId: 'c-1' });
    const db = makePayrollWeekDb({ id: 'wk-1', submittedAt: '2025-01-10T00:00:00Z' });
    vi.mocked(getDb).mockReturnValue(db as any);

    const resp = await request(app)
      .post('/api/integrations/procore/import')
      .send({ weekId: 'wk-1', entries: [{ workerId: 'w1', classificationId: 'c1', date: '2025-01-06', hours: 8 }] });

    expect(resp.status).toBe(423);
    expect(resp.body.error).toMatch(/submitted/i);
  });

  it('calls upsertPayrollEntry and returns { committed, weekId }', async () => {
    vi.mocked(getValidProcoreToken).mockResolvedValue({ accessToken: 'tok', companyId: 'c-1' });
    const db = makePayrollWeekDb({ id: 'wk-1', submittedAt: null });
    vi.mocked(getDb).mockReturnValue(db as any);
    vi.mocked(upsertPayrollEntry).mockResolvedValue(undefined as any);

    const resp = await request(app)
      .post('/api/integrations/procore/import')
      .send({
        weekId: 'wk-1',
        entries: [
          { workerId: 'w1', classificationId: 'cl-1', date: '2025-01-06', hours: 8 },
          { workerId: 'w1', classificationId: 'cl-1', date: '2025-01-07', hours: 4 },
        ],
      });

    expect(resp.status).toBe(200);
    // Both entries share same worker+classification — grouped into 1 upsert call
    expect(upsertPayrollEntry).toHaveBeenCalledTimes(1);
    expect(resp.body.data.committed).toBe(1);
    expect(resp.body.data.weekId).toBe('wk-1');
  });
});
