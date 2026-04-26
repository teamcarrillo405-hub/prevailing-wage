import { Router } from 'express';
import { eq, and, gte, lte, desc, count } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { auditLogs, securityEvents } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { assertProjectAccess } from '../utils/assertProjectAccess.js';
import { verifyAuditChain } from '../services/auditService.js';

const router = Router();
router.use(requireAuth);

// ── Phase 79: GET /api/audit/integrity-check ──────────────────────────────
// Walks the audit_logs hash chain and reports the first row that fails to
// match its recomputed entryHash (or to reference the prior row's hash).
// Optional ?projectId scopes the walk; ?limit caps rows scanned (default 100).
router.get('/integrity-check', async (req, res) => {
  const userId = req.user!.userId;
  const db = getDb();
  const projectId = (req.query.projectId as string | undefined) ?? null;
  const rawLimit = parseInt(String(req.query.limit ?? '100'), 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 5000) : 100;

  // Project-scoped checks require project access. Cross-project walks are
  // only intended for ops/admins — for now we restrict callers without a
  // project filter to authenticated users only (any logged-in user can audit
  // their own data; the walk only returns metadata, not row contents).
  if (projectId) {
    try {
      await assertProjectAccess(db, projectId, userId);
    } catch (err: any) {
      res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
      return;
    }
  }

  const result = await verifyAuditChain(projectId, limit);
  res.json({ data: result });
});

// ── Phase 82 (Gap-2): GET /api/audit/export-security-events ──────────────
// SOC 2 SEC-04: lets users self-serve evidence by exporting their access log.
// Query: ?format=csv|json (default csv) &days=N (default 30, max 365).
router.get('/export-security-events', async (req, res) => {
  const userId = req.user!.userId;
  const userEmail = req.user!.email;
  const db = getDb();

  const format = (req.query.format as string | undefined)?.toLowerCase() === 'json' ? 'json' : 'csv';
  const rawDays = parseInt(String(req.query.days ?? '30'), 10);
  const days = Number.isFinite(rawDays) && rawDays > 0 ? Math.min(rawDays, 365) : 30;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const rows = await db
    .select()
    .from(securityEvents)
    .where(and(eq(securityEvents.userId, userId), gte(securityEvents.createdAt, cutoff)))
    .orderBy(desc(securityEvents.createdAt));

  type EventRow = typeof rows[number];

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="security-events-${userId}-${days}d.json"`);
    res.json({
      exportedAt: new Date().toISOString(),
      userId,
      userEmail,
      windowDays: days,
      count: rows.length,
      events: rows,
    });
    return;
  }

  // CSV — Excel-friendly with formula-injection guard
  function sanitize(value: string): string {
    if (/^[=+\-@]/.test(value)) return `'${value}`;
    return value;
  }

  function csvRow(cells: (string | number | null | undefined)[]): string {
    return cells
      .map(cell => `"${sanitize(String(cell ?? '')).replace(/"/g, '""')}"`)
      .join(',');
  }

  const header = csvRow(['Timestamp', 'Event Type', 'IP Address', 'User Agent', 'Metadata']);
  const lines = rows.map((r: EventRow) => csvRow([
    r.createdAt,
    r.eventType,
    r.ipAddress,
    r.userAgent,
    r.metadata,
  ]));

  const csvText = [header, ...lines].join('\r\n');
  const bom = Buffer.from([0xef, 0xbb, 0xbf]);
  const csvBuffer = Buffer.concat([bom, Buffer.from(csvText, 'utf8')]);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="security-events-${userId}-${days}d.csv"`);
  res.send(csvBuffer);
});

// GET /api/audit/:projectId/csv — full audit log as CSV download (AUDIT-05)
router.get('/:projectId/csv', async (req, res) => {
  const projectId = req.params.projectId as string;
  const userId = req.user!.userId;
  const db = getDb();

  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;

  const conditions: ReturnType<typeof eq>[] = [eq(auditLogs.projectId, projectId)];
  if (from) conditions.push(gte(auditLogs.createdAt, from));
  if (to) conditions.push(lte(auditLogs.createdAt, to + 'T23:59:59.999Z'));

  const rows = await db.select()
    .from(auditLogs)
    .where(and(...conditions))
    .orderBy(desc(auditLogs.createdAt));

  function sanitize(value: string): string {
    if (/^[=+\-@]/.test(value)) return `'${value}`;
    return value;
  }

  function toDetails(meta: string | null): string {
    if (!meta) return '';
    try {
      const obj = JSON.parse(meta) as Record<string, unknown>;
      return Object.entries(obj)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join('; ');
    } catch {
      return meta;
    }
  }

  function csvRow(cells: string[]): string {
    return cells.map(c => `"${c.replace(/"/g, '""')}"`).join(',');
  }

  const header = csvRow(['Date', 'User', 'Entity Type', 'Entity ID', 'Action', 'Details']);
  const lines = rows.map((row: typeof auditLogs.$inferSelect) => csvRow([
    sanitize(row.createdAt),
    sanitize(row.userEmail ?? ''),
    sanitize(row.entityType),
    sanitize(row.entityId),
    sanitize(row.action),
    sanitize(toDetails(row.meta)),
  ]));

  const csvText = [header, ...lines].join('\r\n');
  // Prepend UTF-8 BOM (EF BB BF) as raw bytes so Excel auto-detects UTF-8
  const bom = Buffer.from([0xef, 0xbb, 0xbf]);
  const csvBuffer = Buffer.concat([bom, Buffer.from(csvText, 'utf8')]);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="project-audit-${projectId}.csv"`);
  res.send(csvBuffer);
});

// GET /api/audit/:projectId — paginated audit log (AUDIT-04)
// NFR-03: assertProjectAccess called before any data access
router.get('/:projectId', async (req, res) => {
  const projectId = req.params.projectId as string;
  const userId = req.user!.userId;
  const db = getDb();

  // NFR-03: assertProjectAccess before any data access
  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  // Parse query params
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = 25;
  const offset = (page - 1) * limit;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const entityType = req.query.entityType as string | undefined;

  // Build WHERE conditions
  const conditions: ReturnType<typeof eq>[] = [eq(auditLogs.projectId, projectId)];
  if (from) conditions.push(gte(auditLogs.createdAt, from));
  if (to) conditions.push(lte(auditLogs.createdAt, to + 'T23:59:59.999Z'));
  if (entityType) conditions.push(eq(auditLogs.entityType, entityType));

  const whereClause = and(...conditions);

  // Fetch items + total count in parallel
  const [items, [{ value: total }]] = await Promise.all([
    db.select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() })
      .from(auditLogs)
      .where(whereClause),
  ]);

  // Parse JSON text columns for client consumption
  const parsed = items.map((row: typeof auditLogs.$inferSelect) => ({
    ...row,
    diff: row.diff ? JSON.parse(row.diff) : null,
    snapshot: row.snapshot ? JSON.parse(row.snapshot) : null,
    meta: row.meta ? JSON.parse(row.meta) : null,
  }));

  res.json({
    items: parsed,
    total: Number(total),
    page,
    limit,
    totalPages: Math.ceil(Number(total) / limit),
  });
});

export { router as auditRouter };
