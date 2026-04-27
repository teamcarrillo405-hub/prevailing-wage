// Phase 105: Admin Growth Dashboard (OPS-01)
// GET /api/admin/growth — admin-only growth + KPI metrics
// Guard: ADMIN_EMAILS env var (comma-separated list of admin email addresses)

import { Router } from 'express';
import { count, gt, eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { users, projects, payrollWeeks } from '../db/schema.js';

export const growthRouter = Router();
growthRouter.use(requireAuth);

// Admin guard — email allowlist from ADMIN_EMAILS env var
function requireAdmin(req: any, res: any, next: any) {
  const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e: string) => e.trim())
    .filter(Boolean);
  const userEmail: string = req.user?.email ?? '';
  if (!ADMIN_EMAILS.includes(userEmail)) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

growthRouter.get('/growth', requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Total users
    const [totalUsersRow] = await db.select({ count: count() }).from(users);
    const totalUsers = totalUsersRow.count;

    // New users in last 30 days
    const [newUsersRow] = await db
      .select({ count: count() })
      .from(users)
      .where(gt(users.createdAt, thirtyDaysAgo));
    const newUsersLast30d = newUsersRow.count;

    // Total projects + active projects
    const [totalProjectsRow] = await db.select({ count: count() }).from(projects);
    const [activeProjectsRow] = await db
      .select({ count: count() })
      .from(projects)
      .where(eq(projects.status, 'active'));
    const totalProjects = totalProjectsRow.count;
    const activeProjects = activeProjectsRow.count;

    // Payroll week metrics — raw SQL for submitted_at IS NOT NULL
    const rawClient = (db as any).$client as {
      prepare: (sql: string) => {
        get: (...args: unknown[]) => unknown;
        all: (...args: unknown[]) => unknown[];
      };
    };

    const [totalWeeksRow] = await db.select({ count: count() }).from(payrollWeeks);
    const totalPayrollWeeks = totalWeeksRow.count;

    const submittedCount = rawClient
      .prepare(`SELECT COUNT(*) as c FROM payroll_weeks WHERE submitted_at IS NOT NULL`)
      .get() as { c: number };
    const submittedWeeks = submittedCount.c;
    const submissionRate = totalPayrollWeeks > 0 ? submittedWeeks / totalPayrollWeeks : 0;

    // Compliance score — heuristic: submission rate as proxy (true compliance requires expensive compute)
    const avgComplianceScore = submissionRate;

    // Total violations: payroll_entries where effective hourly < base_rate_snapshot * 0.95
    const violationCount = rawClient
      .prepare(
        `SELECT COUNT(*) as c FROM payroll_entries
         WHERE gross_wages IS NOT NULL
         AND base_rate_snapshot > 0
         AND (gross_wages / NULLIF(
           mon_st + tue_st + wed_st + thu_st + fri_st + sat_st + sun_st +
           mon_ot + tue_ot + wed_ot + thu_ot + fri_ot + sat_ot + sun_ot, 0)
         ) < base_rate_snapshot * 0.95`
      )
      .get() as { c: number };
    const totalViolations = violationCount.c;

    // Active users in last 30 days (user has a payroll_week created recently)
    const activeUsersCount = rawClient
      .prepare(
        `SELECT COUNT(DISTINCT p.user_id) as c
         FROM payroll_weeks pw
         JOIN projects p ON p.id = pw.project_id
         WHERE pw.created_at > ?`
      )
      .get(thirtyDaysAgo) as { c: number };
    const activeUsersLast30d = activeUsersCount.c;

    // MRR estimate from plan_tier
    const tierCounts = rawClient
      .prepare(`SELECT plan_tier, COUNT(*) as c FROM users GROUP BY plan_tier`)
      .all() as Array<{ plan_tier: string; c: number }>;
    const TIER_PRICE: Record<string, number> = { starter: 0, pro: 49, enterprise: 149 };
    const mrrEstimate = tierCounts.reduce(
      (sum, row) => sum + (TIER_PRICE[row.plan_tier] ?? 0) * row.c,
      0
    );

    // Weekly new users (last 12 weeks)
    const weeklyNewUsers = rawClient
      .prepare(
        `SELECT strftime('%Y-W%W', created_at) as week, COUNT(*) as count
         FROM users
         WHERE created_at > datetime('now', '-84 days')
         GROUP BY week ORDER BY week ASC`
      )
      .all() as Array<{ week: string; count: number }>;

    // Weekly submissions (last 12 weeks)
    const weeklySubmissions = rawClient
      .prepare(
        `SELECT strftime('%Y-W%W', submitted_at) as week, COUNT(*) as count
         FROM payroll_weeks
         WHERE submitted_at IS NOT NULL
         AND submitted_at > datetime('now', '-84 days')
         GROUP BY week ORDER BY week ASC`
      )
      .all() as Array<{ week: string; count: number }>;

    res.json({
      totalUsers,
      activeUsersLast30d,
      newUsersLast30d,
      totalPayrollWeeks,
      submittedWeeks,
      submissionRate: Math.round(submissionRate * 100) / 100,
      avgComplianceScore: Math.round(avgComplianceScore * 100) / 100,
      totalViolations,
      totalProjects,
      activeProjects,
      mrrEstimate,
      weeklyNewUsers,
      weeklySubmissions,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[growth] error:', msg);
    res.status(500).json({ error: 'Failed to compute growth metrics' });
  }
});
