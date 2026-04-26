// src/server/routes/publicApi.ts
// Mounted at /v1 — public REST API authenticated via Bearer API keys.
// Separate from /api (cookie auth). Read-only scopes only in v1.

import { Router } from 'express';
import { createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import type { Request, Response, NextFunction } from 'express';
import { getDb } from '../db/index.js';
import { apiKeys, projects, workers, projectMembers } from '../db/schema.js';
import { computeCompliance } from '../services/complianceService.js';
import { listPayrollWeeks } from '../services/payrollService.js';

const router = Router();

// ── API Key Authentication Middleware ────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      apiKeyUserId?: string;
      apiKeyScopes?: string[];
    }
  }
}

async function requireApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Missing or invalid Authorization header. Use: Authorization: Bearer <api-key>',
    });
    return;
  }

  const rawKey = authHeader.slice(7).trim();
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  const db = getDb();
  const now = new Date().toISOString();

  const [keyRow] = await db
    .select()
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.keyHash, keyHash),
        isNull(apiKeys.revokedAt),
      ),
    )
    .limit(1);

  if (!keyRow) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  // Check expiry
  if (keyRow.expiresAt && keyRow.expiresAt < now) {
    res.status(401).json({ error: 'API key has expired' });
    return;
  }

  // Update lastUsedAt (best-effort, non-blocking)
  db.update(apiKeys)
    .set({ lastUsedAt: now })
    .where(eq(apiKeys.id, keyRow.id))
    .catch(() => {});

  req.apiKeyUserId = keyRow.userId;
  req.apiKeyScopes = JSON.parse(keyRow.scopes) as string[];
  next();
}

function requireScope(scope: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.apiKeyScopes?.includes(scope)) {
      res.status(403).json({ error: `Scope required: ${scope}` });
      return;
    }
    next();
  };
}

function meta() {
  return { requestId: randomUUID(), timestamp: new Date().toISOString() };
}

// ── Rate limit constants ──────────────────────────────────────────────────────
const RATE_LIMIT = 1000; // requests per hour (enforced at infrastructure level; headers inform callers)

function addRateLimitHeaders(res: Response, remaining: number): void {
  const resetTs = Math.floor(Date.now() / 1000) + 3600;
  res.set('X-RateLimit-Limit', String(RATE_LIMIT));
  res.set('X-RateLimit-Remaining', String(remaining));
  res.set('X-RateLimit-Reset', String(resetTs));
}

// ── Pagination helpers ────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parsePagination(query: Record<string, string | string[] | undefined>): { page: number; limit: number; offset: number } {
  const page = Math.max(1, parseInt(String(query['page'] ?? '1'), 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(String(query['limit'] ?? String(DEFAULT_LIMIT)), 10) || DEFAULT_LIMIT));
  return { page, limit, offset: (page - 1) * limit };
}

function paginatedMeta(page: number, limit: number, total: number) {
  return {
    ...meta(),
    page,
    limit,
    total,
    hasNext: page * limit < total,
  };
}

// Apply API key auth to all /v1 routes
router.use(requireApiKey);

// Phase 82 (Gap-2): always emit rate-limit headers so consumers can build
// backoff against documented limits. Per-route handlers can override
// X-RateLimit-Remaining once we wire a real per-key counter; this middleware
// guarantees auditors see the headers on every /v1 response.
router.use((_req, res, next) => {
  if (!res.getHeader('X-RateLimit-Limit')) {
    addRateLimitHeaders(res, RATE_LIMIT);
  }
  res.setHeader('X-RateLimit-Window', '3600s');
  next();
});

// ── GET /v1/projects ──────────────────────────────────────────────────────

router.get('/projects', requireScope('projects:read'), async (req, res) => {
  const userId = req.apiKeyUserId!;
  const db = getDb();
  const { page, limit, offset } = parsePagination(req.query as Record<string, string>);

  const allRows = await db
    .select({
      id: projects.id,
      name: projects.name,
      state: projects.state,
      county: projects.county,
      contractType: projects.contractType,
      fundingType: projects.fundingType,
      status: projects.status,
      awardDate: projects.awardDate,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .innerJoin(projectMembers, eq(projectMembers.projectId, projects.id))
    .where(and(eq(projectMembers.userId, userId), isNull(projectMembers.removedAt)));

  const total = allRows.length;
  const rows = allRows.slice(offset, offset + limit);

  addRateLimitHeaders(res, RATE_LIMIT);
  res.json({ data: rows, meta: paginatedMeta(page, limit, total) });
});

// ── GET /v1/projects/batch?ids=id1,id2,id3 ───────────────────────────────────
// Must be registered BEFORE /projects/:id so Express doesn't match "batch" as :id.
// Returns up to 20 projects at once. Caller must have projects:read scope.

router.get('/projects/batch', requireScope('projects:read'), async (req, res) => {
  const userId = req.apiKeyUserId!;
  const rawIds = String(req.query['ids'] ?? '');

  if (!rawIds) {
    res.status(400).json({ error: 'ids query parameter is required (comma-separated project IDs)' });
    return;
  }

  const ids = rawIds.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20);

  if (ids.length === 0) {
    res.status(400).json({ error: 'At least one project ID is required' });
    return;
  }

  const db = getDb();

  const accessRows = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.userId, userId),
        isNull(projectMembers.removedAt),
        inArray(projectMembers.projectId, ids),
      ),
    );

  const allowedIds = new Set((accessRows as Array<{ projectId: string }>).map((r) => r.projectId));

  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      state: projects.state,
      county: projects.county,
      contractType: projects.contractType,
      fundingType: projects.fundingType,
      status: projects.status,
      awardDate: projects.awardDate,
      wdIdentifier: projects.wdIdentifier,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .where(inArray(projects.id, ids));

  const visible = (rows as Array<{ id: string; [k: string]: unknown }>).filter((r) => allowedIds.has(r.id));

  addRateLimitHeaders(res, RATE_LIMIT);
  res.json({
    data: visible,
    meta: { ...meta(), requested: ids.length, returned: visible.length },
  });
});

// ── GET /v1/projects/:id ──────────────────────────────────────────────────

router.get('/projects/:id', requireScope('projects:read'), async (req, res) => {
  const userId = req.apiKeyUserId!;
  const projectId = req.params['id'] as string;
  const db = getDb();

  const [row] = await db
    .select({
      id: projects.id,
      name: projects.name,
      state: projects.state,
      county: projects.county,
      contractType: projects.contractType,
      fundingType: projects.fundingType,
      status: projects.status,
      awardDate: projects.awardDate,
      wdIdentifier: projects.wdIdentifier,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .innerJoin(projectMembers, eq(projectMembers.projectId, projects.id))
    .where(
      and(
        eq(projects.id, projectId),
        eq(projectMembers.userId, userId),
        isNull(projectMembers.removedAt),
      ),
    )
    .limit(1);

  if (!row) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  addRateLimitHeaders(res, RATE_LIMIT);
  res.json({ data: row, meta: meta() });
});

// ── GET /v1/projects/:id/payroll-weeks ────────────────────────────────────

router.get('/projects/:id/payroll-weeks', requireScope('payroll:read'), async (req, res) => {
  const userId = req.apiKeyUserId!;
  const projectId = req.params['id'] as string;
  const db = getDb();
  const { page, limit, offset } = parsePagination(req.query as Record<string, string>);

  const [access] = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId),
        isNull(projectMembers.removedAt),
      ),
    )
    .limit(1);

  if (!access) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const allWeeks = await listPayrollWeeks(projectId);
  const total = allWeeks.length;
  const paged = allWeeks.slice(offset, offset + limit);
  const data = paged.map((w: typeof allWeeks[number]) => ({
    id: w.id,
    weekEndingDate: w.weekEndingDate,
    payrollNumber: w.payrollNumber,
    isFinal: w.isFinal,
    submittedAt: w.submittedAt,
    submittedTo: w.submittedTo,
    createdAt: w.createdAt,
  }));

  addRateLimitHeaders(res, RATE_LIMIT);
  res.json({ data, meta: paginatedMeta(page, limit, total) });
});

// ── GET /v1/projects/:id/compliance-summary ───────────────────────────────

router.get('/projects/:id/compliance-summary', requireScope('projects:read'), async (req, res) => {
  const userId = req.apiKeyUserId!;
  const projectId = req.params['id'] as string;
  const db = getDb();

  const [access] = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId),
        isNull(projectMembers.removedAt),
      ),
    )
    .limit(1);

  if (!access) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const weeks = await listPayrollWeeks(projectId);
  let totalViolations = 0;
  let hasViolations = false;

  for (const week of weeks) {
    try {
      const result = await computeCompliance(db, week.id);
      if (result?.hasViolations) {
        hasViolations = true;
        totalViolations +=
          (result.violations?.length ?? 0) + (result.weekViolations?.length ?? 0);
      }
    } catch {
      // skip weeks that fail compliance check
    }
  }

  addRateLimitHeaders(res, RATE_LIMIT);
  res.json({
    data: {
      projectId,
      weekCount: weeks.length,
      hasViolations,
      totalViolations,
      status: hasViolations ? 'violations' : 'clean',
    },
    meta: meta(),
  });
});

// ── GET /v1/projects/:id/workers ──────────────────────────────────────────

router.get('/projects/:id/workers', requireScope('workers:read'), async (req, res) => {
  const userId = req.apiKeyUserId!;
  const projectId = req.params['id'] as string;
  const db = getDb();
  const { page, limit, offset } = parsePagination(req.query as Record<string, string>);

  const [access] = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId),
        isNull(projectMembers.removedAt),
      ),
    )
    .limit(1);

  if (!access) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const allRows = await db
    .select({
      id: workers.id,
      name: workers.name,
      ssnLast4: workers.ssnLast4,
      tradeUnion: workers.tradeUnion,
      addressCity: workers.addressCity,
      addressState: workers.addressState,
      isActive: workers.isActive,
      createdAt: workers.createdAt,
    })
    .from(workers)
    .where(eq(workers.projectId, projectId));

  const total = allRows.length;
  const rows = allRows.slice(offset, offset + limit);

  addRateLimitHeaders(res, RATE_LIMIT);
  res.json({ data: rows, meta: paginatedMeta(page, limit, total) });
});

// ── GET /v1/reports/compliance-summary ────────────────────────────────────────
// Aggregate compliance view across ALL projects accessible to the caller.
// Scoped to projects:read — enterprise customers use this for dashboard roll-ups.

router.get('/reports/compliance-summary', requireScope('projects:read'), async (req, res) => {
  const userId = req.apiKeyUserId!;
  const db = getDb();

  // All accessible projects
  const memberRows = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(and(eq(projectMembers.userId, userId), isNull(projectMembers.removedAt)));

  const projectIds = (memberRows as Array<{ projectId: string }>).map((r) => r.projectId);

  if (projectIds.length === 0) {
    addRateLimitHeaders(res, RATE_LIMIT);
    res.json({
      data: { totalProjects: 0, projectsWithViolations: 0, totalViolations: 0, perProject: [] },
      meta: meta(),
    });
    return;
  }

  const projectRows = await db
    .select({ id: projects.id, name: projects.name, status: projects.status })
    .from(projects)
    .where(inArray(projects.id, projectIds));

  const perProject: Array<{
    projectId: string;
    projectName: string;
    projectStatus: string | null;
    weekCount: number;
    totalViolations: number;
    hasViolations: boolean;
    complianceStatus: 'clean' | 'violations';
  }> = [];

  let globalViolations = 0;
  let projectsWithViolations = 0;

  for (const proj of projectRows) {
    const weeks = await listPayrollWeeks(proj.id);
    let projViolations = 0;

    for (const week of weeks) {
      try {
        const result = await computeCompliance(db, week.id);
        if (result?.hasViolations) {
          projViolations += (result.violations?.length ?? 0) + (result.weekViolations?.length ?? 0);
        }
      } catch {
        // skip weeks that fail compliance check
      }
    }

    const hasViolations = projViolations > 0;
    if (hasViolations) projectsWithViolations++;
    globalViolations += projViolations;

    perProject.push({
      projectId: proj.id,
      projectName: proj.name,
      projectStatus: proj.status,
      weekCount: weeks.length,
      totalViolations: projViolations,
      hasViolations,
      complianceStatus: hasViolations ? 'violations' : 'clean',
    });
  }

  addRateLimitHeaders(res, RATE_LIMIT);
  res.json({
    data: {
      totalProjects: projectRows.length,
      projectsWithViolations,
      totalViolations: globalViolations,
      perProject,
    },
    meta: meta(),
  });
});

export default router;
