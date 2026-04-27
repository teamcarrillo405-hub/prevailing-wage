// src/server/routes/apprenticeship.ts
// GET /api/apprenticeship/:projectId/apprenticeship-dashboard
// Returns per-trade apprenticeship ratio data, IRA/IIJA compliance flag,
// and 12-week weekly trend. Protected by requireAuth + assertProjectAccess (IDOR).

import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { getDb } from '../db/index.js';
import { projects } from '../db/schema.js';
import { assertProjectAccess } from '../utils/assertProjectAccess.js';
import { logger } from '../logger.js';

export const apprenticeshipRouter = Router();

// ── Raw SQL query — GROUP BY across 3 joins is cleaner in raw SQLite ─────────

const TRADE_SQL = `
SELECT
  wc.trade_code                                            AS trade_code,
  wc.labor_type                                            AS labor_type,
  COUNT(DISTINCT CASE WHEN wc.labor_type = 'apprentice' THEN pe.worker_id END) AS apprentice_count,
  COUNT(DISTINCT CASE WHEN wc.labor_type IN ('journeyworker','foreman') THEN pe.worker_id END) AS journey_count,
  ROUND(SUM(CASE WHEN wc.labor_type = 'apprentice' THEN
    COALESCE(pe.mon_st,0)+COALESCE(pe.tue_st,0)+COALESCE(pe.wed_st,0)+
    COALESCE(pe.thu_st,0)+COALESCE(pe.fri_st,0)+COALESCE(pe.sat_st,0)+COALESCE(pe.sun_st,0)+
    COALESCE(pe.mon_ot,0)+COALESCE(pe.tue_ot,0)+COALESCE(pe.wed_ot,0)+
    COALESCE(pe.thu_ot,0)+COALESCE(pe.fri_ot,0)+COALESCE(pe.sat_ot,0)+COALESCE(pe.sun_ot,0)
  ELSE 0 END), 2)                                          AS apprentice_hours,
  ROUND(SUM(CASE WHEN wc.labor_type IN ('journeyworker','foreman') THEN
    COALESCE(pe.mon_st,0)+COALESCE(pe.tue_st,0)+COALESCE(pe.wed_st,0)+
    COALESCE(pe.thu_st,0)+COALESCE(pe.fri_st,0)+COALESCE(pe.sat_st,0)+COALESCE(pe.sun_st,0)+
    COALESCE(pe.mon_ot,0)+COALESCE(pe.tue_ot,0)+COALESCE(pe.wed_ot,0)+
    COALESCE(pe.thu_ot,0)+COALESCE(pe.fri_ot,0)+COALESCE(pe.sat_ot,0)+COALESCE(pe.sun_ot,0)
  ELSE 0 END), 2)                                          AS journey_hours
FROM payroll_entries pe
JOIN payroll_weeks pw ON pw.id = pe.payroll_week_id
JOIN worker_classifications wc ON wc.id = pe.classification_id
WHERE pw.project_id = ?
GROUP BY wc.trade_code
ORDER BY wc.trade_code ASC
`.trim();

const WEEKLY_SQL = `
SELECT
  pw.week_ending_date                                      AS week_end,
  ROUND(SUM(CASE WHEN wc.labor_type = 'apprentice' THEN
    COALESCE(pe.mon_st,0)+COALESCE(pe.tue_st,0)+COALESCE(pe.wed_st,0)+
    COALESCE(pe.thu_st,0)+COALESCE(pe.fri_st,0)+COALESCE(pe.sat_st,0)+COALESCE(pe.sun_st,0)+
    COALESCE(pe.mon_ot,0)+COALESCE(pe.tue_ot,0)+COALESCE(pe.wed_ot,0)+
    COALESCE(pe.thu_ot,0)+COALESCE(pe.fri_ot,0)+COALESCE(pe.sat_ot,0)+COALESCE(pe.sun_ot,0)
  ELSE 0 END), 2)                                          AS apprentice_hours,
  ROUND(SUM(
    COALESCE(pe.mon_st,0)+COALESCE(pe.tue_st,0)+COALESCE(pe.wed_st,0)+
    COALESCE(pe.thu_st,0)+COALESCE(pe.fri_st,0)+COALESCE(pe.sat_st,0)+COALESCE(pe.sun_st,0)+
    COALESCE(pe.mon_ot,0)+COALESCE(pe.tue_ot,0)+COALESCE(pe.wed_ot,0)+
    COALESCE(pe.thu_ot,0)+COALESCE(pe.fri_ot,0)+COALESCE(pe.sat_ot,0)+COALESCE(pe.sun_ot,0)
  ), 2)                                                    AS total_hours
FROM payroll_entries pe
JOIN payroll_weeks pw ON pw.id = pe.payroll_week_id
JOIN worker_classifications wc ON wc.id = pe.classification_id
WHERE pw.project_id = ?
GROUP BY pw.week_ending_date
ORDER BY pw.week_ending_date DESC
LIMIT 12
`.trim();

// ── Ratio helpers ─────────────────────────────────────────────────────────────

/** Parse "1:3" → 3.0 (max apprentices per journey); returns null if not set. */
function parseMaxRatio(ratioStr: string | null | undefined): number | null {
  if (!ratioStr) return null;
  const parts = ratioStr.split(':');
  if (parts.length !== 2) return null;
  const apprenticePart = parseFloat(parts[0]);
  const journeyPart = parseFloat(parts[1]);
  if (isNaN(apprenticePart) || isNaN(journeyPart) || journeyPart === 0) return null;
  return apprenticePart / journeyPart; // e.g. "1:2" → 0.5 (1 apprentice per 2 journey)
}

/** Format actualRatio as "1:X" string from raw hours. */
function formatActualRatio(apprenticeHours: number, journeyHours: number): string {
  if (journeyHours === 0 && apprenticeHours === 0) return '—';
  if (journeyHours === 0) return `${apprenticeHours}:0`;
  const ratio = journeyHours / apprenticeHours;
  return `1:${ratio.toFixed(1)}`;
}

/** Returns true if ratio is compliant given "1:N" required string. */
function isRatioCompliant(
  apprenticeHours: number,
  journeyHours: number,
  requiredRatio: string | null,
): boolean {
  if (!requiredRatio) return true; // no requirement set → compliant by default
  const maxFraction = parseMaxRatio(requiredRatio); // e.g. "1:2" → 0.5
  if (maxFraction === null) return true;
  const totalHours = apprenticeHours + journeyHours;
  if (totalHours === 0) return true;
  const actualFraction = apprenticeHours / totalHours;
  // compliant when actual apprentice fraction does not exceed the max
  return actualFraction <= maxFraction;
}

// ── GET /api/apprenticeship/:projectId/apprenticeship-dashboard ───────────────

apprenticeshipRouter.get('/:projectId/apprenticeship-dashboard', requireAuth, async (req, res) => {
  const projectId = req.params.projectId as string;
  const userId = req.user!.userId;
  const db = getDb();

  // IDOR guard
  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Access denied' });
    return;
  }

  try {
    // Fetch project for IRA flag + apprenticeshipRequirements
    const [project] = await db
      .select({
        isIraIijaProject: projects.isIraIijaProject,
        apprenticeshipRequirements: projects.apprenticeshipRequirements,
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const isIraIijaProject = project.isIraIijaProject ?? false;
    let reqMap: Record<string, { maxRatio: string }> = {};
    if (project.apprenticeshipRequirements) {
      try {
        reqMap = JSON.parse(project.apprenticeshipRequirements);
      } catch {
        // malformed JSON — treat as empty
      }
    }

    // Raw SQLite client for GROUP BY queries
    const rawClient = (db as any).$client as {
      prepare: (sql: string) => { all: (arg: string) => unknown[] };
    };

    // ── Per-trade aggregation ──────────────────────────────────────────────
    const tradeRaw = rawClient.prepare(TRADE_SQL).all(projectId) as Array<{
      trade_code: string;
      labor_type: string;
      apprentice_count: number | null;
      journey_count: number | null;
      apprentice_hours: number | null;
      journey_hours: number | null;
    }>;

    // Merge rows by trade_code (SQL groups by trade_code so one row per trade)
    const tradeMap = new Map<string, {
      journeyHours: number;
      apprenticeHours: number;
      apprenticeCount: number;
      journeyCount: number;
    }>();

    for (const row of tradeRaw) {
      const existing = tradeMap.get(row.trade_code) ?? {
        journeyHours: 0, apprenticeHours: 0, apprenticeCount: 0, journeyCount: 0,
      };
      existing.apprenticeHours += row.apprentice_hours ?? 0;
      existing.journeyHours += row.journey_hours ?? 0;
      existing.apprenticeCount += row.apprentice_count ?? 0;
      existing.journeyCount += row.journey_count ?? 0;
      tradeMap.set(row.trade_code, existing);
    }

    const byTrade = Array.from(tradeMap.entries()).map(([trade, data]) => {
      const requiredRatio = reqMap[trade]?.maxRatio ?? null;
      const compliant = isRatioCompliant(data.apprenticeHours, data.journeyHours, requiredRatio);
      return {
        trade,
        journeyHours: data.journeyHours,
        apprenticeHours: data.apprenticeHours,
        apprenticeCount: data.apprenticeCount,
        journeyCount: data.journeyCount,
        requiredRatio,
        actualRatio: formatActualRatio(data.apprenticeHours, data.journeyHours),
        compliant,
      };
    });

    // ── Overall totals ─────────────────────────────────────────────────────
    const totalApprenticeHours = byTrade.reduce((s, t) => s + t.apprenticeHours, 0);
    const totalJourneyHours = byTrade.reduce((s, t) => s + t.journeyHours, 0);
    const totalHours = totalApprenticeHours + totalJourneyHours;
    const apprenticePct = totalHours > 0
      ? Math.round((totalApprenticeHours / totalHours) * 10000) / 100  // 2 decimal places
      : 0;
    const iraCompliant = isIraIijaProject ? apprenticePct >= 15 : false;

    const overall = {
      totalHours: Math.round(totalHours * 100) / 100,
      apprenticeHours: Math.round(totalApprenticeHours * 100) / 100,
      apprenticePct,
      iraCompliant,
    };

    // ── Weekly trend (last 12 weeks) ───────────────────────────────────────
    const weeklyRaw = rawClient.prepare(WEEKLY_SQL).all(projectId) as Array<{
      week_end: string;
      apprentice_hours: number | null;
      total_hours: number | null;
    }>;

    // Reverse so oldest → newest
    const weeklyTrend = weeklyRaw.slice().reverse().map((row) => {
      const wTotal = row.total_hours ?? 0;
      const wApp = row.apprentice_hours ?? 0;
      const wPct = wTotal > 0 ? Math.round((wApp / wTotal) * 10000) / 100 : 0;
      return {
        weekStartDate: row.week_end,
        apprenticePct: wPct,
        iraCompliant: isIraIijaProject ? wPct >= 15 : false,
      };
    });

    res.json({
      projectId,
      isIraIijaProject,
      iraTarget: 0.15,
      overall,
      byTrade,
      weeklyTrend,
    });
  } catch (err) {
    logger.error({ err, projectId }, '[apprenticeship-dashboard] query failed');
    res.status(500).json({ error: 'Failed to compute apprenticeship dashboard' });
  }
});
