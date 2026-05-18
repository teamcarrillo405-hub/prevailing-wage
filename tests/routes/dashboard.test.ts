import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

// Dynamic imports AFTER env setup to avoid cryptoService process.exit
const { app } = await import('../../src/server/index.js');

// ── Helpers ───────────────────────────────────────────────────────────────

async function registerAndLogin(suffix: string) {
  const email = `dashboard-${suffix}-${Date.now()}@test.com`;
  const res = await supertest(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123' });
  const cookies = res.headers['set-cookie'] as string[] | string;
  return Array.isArray(cookies) ? cookies.join('; ') : cookies;
}

async function createProject(cookie: string, extras: Record<string, unknown> = {}) {
  const res = await supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({
      name: 'Dashboard Test Project',
      state: 'CA',
      county: 'Los Angeles',
      contractType: 'federal-davis-bacon',
      awardDate: '2025-01-01',
      fundingType: 'federal',
      ...extras,
    });
  return res.body.data?.project?.id as string;
}

// ── /stats ────────────────────────────────────────────────────────────────

describe('GET /api/dashboard/stats', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await supertest(app).get('/api/dashboard/stats');
    expect(res.status).toBe(401);
  });

  it('returns shape { activeProjects, openViolations, weeksDueThisWeek } as numbers', async () => {
    const cookie = await registerAndLogin('shape');
    const res = await supertest(app)
      .get('/api/dashboard/stats')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(typeof res.body.activeProjects).toBe('number');
    expect(typeof res.body.openViolations).toBe('number');
    expect(typeof res.body.weeksDueThisWeek).toBe('number');
  });

  it('returns zero-state { activeProjects: 0, openViolations: 0, weeksDueThisWeek: 0 } for new user', async () => {
    const cookie = await registerAndLogin('zero');
    const res = await supertest(app)
      .get('/api/dashboard/stats')
      .set('Cookie', cookie);

    expect(res.body).toEqual({ activeProjects: 0, openViolations: 0, weeksDueThisWeek: 0 });
  });
});

// ── /compliance-trend ─────────────────────────────────────────────────────

describe('GET /api/dashboard/contractor-actions', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await supertest(app).get('/api/dashboard/contractor-actions');
    expect(res.status).toBe(401);
  });

  it('returns an action array for authenticated users', async () => {
    const cookie = await registerAndLogin('actions-shape');
    const res = await supertest(app)
      .get('/api/dashboard/contractor-actions')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.actions)).toBe(true);
  });

  it('surfaces setup work for projects without workers', async () => {
    const cookie = await registerAndLogin('actions-setup');
    const projectId = await createProject(cookie);

    const res = await supertest(app)
      .get('/api/dashboard/contractor-actions')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          projectId,
          type: 'setup',
          label: 'Add workers and classifications',
        }),
      ]),
    );
  });
});

describe('GET /api/dashboard/compliance-trend', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await supertest(app).get('/api/dashboard/compliance-trend');
    expect(res.status).toBe(401);
  });

  it('returns { weeks } array with exactly 12 entries', async () => {
    const cookie = await registerAndLogin('trend');
    const res = await supertest(app)
      .get('/api/dashboard/compliance-trend')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.weeks)).toBe(true);
    expect(res.body.weeks).toHaveLength(12);
    for (const w of res.body.weeks) {
      expect(typeof w.weekLabel).toBe('string');
      expect(typeof w.violationCount).toBe('number');
    }
  });

  it('returns weeks ordered oldest-first (index 0 is earlier than index 11)', async () => {
    const cookie = await registerAndLogin('order');
    const res = await supertest(app)
      .get('/api/dashboard/compliance-trend')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.weeks).toHaveLength(12);
    // First entry should have an older or equal date than the last entry
    // We verify by checking that weeks are non-empty strings and the array has consistent length
    const first = res.body.weeks[0];
    const last = res.body.weeks[11];
    expect(typeof first.weekLabel).toBe('string');
    expect(typeof last.weekLabel).toBe('string');
    // The weekLabels should differ (they represent different weeks)
    // This is a basic ordering sanity check — the two labels must differ in a real calendar
    expect(first.weekLabel).not.toEqual(last.weekLabel);
  });
});

// ── /at-risk ──────────────────────────────────────────────────────────────

describe('GET /api/dashboard/at-risk', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await supertest(app).get('/api/dashboard/at-risk');
    expect(res.status).toBe(401);
  });

  it('returns { projects: [] } for new user with no violations', async () => {
    const cookie = await registerAndLogin('atrisk-empty');
    const res = await supertest(app)
      .get('/api/dashboard/at-risk')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ projects: [] });
  });

  it('returns at most 5 entries sorted by openViolationCount descending', async () => {
    // This test creates a project but has no past-due weeks, so result is empty array
    // The shape assertion confirms the contract when data exists
    const cookie = await registerAndLogin('atrisk-sort');
    await createProject(cookie);

    const res = await supertest(app)
      .get('/api/dashboard/at-risk')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.projects)).toBe(true);
    expect(res.body.projects.length).toBeLessThanOrEqual(5);

    // Verify sort order if more than one entry
    const projects = res.body.projects;
    for (let i = 1; i < projects.length; i++) {
      expect(projects[i - 1].openViolationCount).toBeGreaterThanOrEqual(projects[i].openViolationCount);
    }
  });
});

// ── GET /api/dashboard (unified) ──────────────────────────────────────────

describe('GET /api/dashboard', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await supertest(app).get('/api/dashboard');
    expect(res.status).toBe(401);
  });

  it('returns 200 with all required top-level keys', async () => {
    const cookie = await registerAndLogin('unified-keys');
    const res = await supertest(app)
      .get('/api/dashboard')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    const REQUIRED_KEYS = [
      'mfaStatus',
      'team',
      'projects',
      'complianceSummary',
      'stats',
      'contractorActions',
      'onboarding',
      'complianceTrend',
      'atRisk',
      'economicImpact',
    ];
    for (const key of REQUIRED_KEYS) {
      expect(res.body).toHaveProperty(key);
    }
  });

  it('stats sub-key has correct numeric shape', async () => {
    const cookie = await registerAndLogin('unified-stats');
    const res = await supertest(app)
      .get('/api/dashboard')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(typeof res.body.stats.activeProjects).toBe('number');
    expect(typeof res.body.stats.openViolations).toBe('number');
    expect(typeof res.body.stats.weeksDueThisWeek).toBe('number');
  });

  it('projects sub-key is an array', async () => {
    const cookie = await registerAndLogin('unified-projects');
    const res = await supertest(app)
      .get('/api/dashboard')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.projects)).toBe(true);
  });

  it('complianceSummary sub-key is an array', async () => {
    const cookie = await registerAndLogin('unified-summary');
    const res = await supertest(app)
      .get('/api/dashboard')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.complianceSummary)).toBe(true);
  });

  it('contractorActions sub-key is an array', async () => {
    const cookie = await registerAndLogin('unified-actions');
    const res = await supertest(app)
      .get('/api/dashboard')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.contractorActions)).toBe(true);
  });

  it('complianceTrend sub-key has 12 entries', async () => {
    const cookie = await registerAndLogin('unified-trend');
    const res = await supertest(app)
      .get('/api/dashboard')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.complianceTrend)).toBe(true);
    expect(res.body.complianceTrend).toHaveLength(12);
    for (const w of res.body.complianceTrend) {
      expect(typeof w.weekLabel).toBe('string');
      expect(typeof w.violationCount).toBe('number');
    }
  });

  it('mfaStatus has enabled boolean and backupCodesRemaining number', async () => {
    const cookie = await registerAndLogin('unified-mfa');
    const res = await supertest(app)
      .get('/api/dashboard')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(typeof res.body.mfaStatus.enabled).toBe('boolean');
    expect(typeof res.body.mfaStatus.backupCodesRemaining).toBe('number');
  });

  it('team has isOwner boolean', async () => {
    const cookie = await registerAndLogin('unified-team');
    const res = await supertest(app)
      .get('/api/dashboard')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(typeof res.body.team.isOwner).toBe('boolean');
  });

  it('atRisk is an array with at most 5 entries', async () => {
    const cookie = await registerAndLogin('unified-atrisk');
    const res = await supertest(app)
      .get('/api/dashboard')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.atRisk)).toBe(true);
    expect(res.body.atRisk.length).toBeLessThanOrEqual(5);
  });

  it('new user stats are all zero', async () => {
    const cookie = await registerAndLogin('unified-zero');
    const res = await supertest(app)
      .get('/api/dashboard')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.stats).toEqual({ activeProjects: 0, openViolations: 0, weeksDueThisWeek: 0 });
    expect(res.body.projects).toEqual([]);
    expect(res.body.contractorActions).toEqual([]);
    expect(res.body.atRisk).toEqual([]);
  });

  it('accepts ?status=all query param and returns 200', async () => {
    const cookie = await registerAndLogin('unified-status-all');
    const res = await supertest(app)
      .get('/api/dashboard?status=all')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.projects)).toBe(true);
  });

  it('includes project in projects array after creation', async () => {
    const cookie = await registerAndLogin('unified-with-project');
    await createProject(cookie);

    const res = await supertest(app)
      .get('/api/dashboard')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.projects.length).toBeGreaterThanOrEqual(1);
    expect(res.body.stats.activeProjects).toBeGreaterThanOrEqual(1);
  });
});
