// src/server/routes/dashboard.ts
// Dashboard-specific server routes — economic impact metrics (TRUST-02, DASH-04).

import { Router } from 'express';
import { eq, and, isNull } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { getDb } from '../db/index.js';
import {
  projects,
  workers,
  payrollEntries,
  workerClassifications,
  projectMembers,
  payrollWeeks,
} from '../db/schema.js';
import { getBatchProjectCompliance } from '../services/complianceService.js';

export const dashboardRouter = Router();

// GET /api/dashboard/violations
// Lightweight real-time endpoint — returns projects with active violations.
// Active violation = payroll week that is past-due (weekEndingDate < today - 7 days) and not submitted.
// Polled every 30 seconds by DashboardPage.tsx.
dashboardRouter.get('/violations', requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const db = getDb();

  const memberRows = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(and(eq(projectMembers.userId, userId), isNull(projectMembers.removedAt)));

  const projectIds = memberRows.map((r: { projectId: string }) => r.projectId);

  if (projectIds.length === 0) {
    res.json({ projects: [] });
    return;
  }

  const projectSet = new Set(projectIds);

  const projectRows = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects);

  const userProjectMap = new Map<string, string>();
  for (const p of projectRows) {
    if (projectSet.has(p.id)) userProjectMap.set(p.id, p.name);
  }

  const weekRows = await db
    .select({
      projectId: payrollWeeks.projectId,
      weekEndingDate: payrollWeeks.weekEndingDate,
      submittedAt: payrollWeeks.submittedAt,
    })
    .from(payrollWeeks);

  // Threshold: past-due = weekEndingDate more than 7 days ago
  const now = new Date();
  const thresholdDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thresholdStr = thresholdDate.toISOString().slice(0, 10);

  const violationCountMap = new Map<string, number>();
  for (const week of weekRows) {
    if (!projectSet.has(week.projectId)) continue;
    if (!week.submittedAt && week.weekEndingDate < thresholdStr) {
      violationCountMap.set(week.projectId, (violationCountMap.get(week.projectId) ?? 0) + 1);
    }
  }

  const lastCheckedAt = now.toISOString();
  const result = Array.from(userProjectMap.entries())
    .filter(([id]) => (violationCountMap.get(id) ?? 0) > 0)
    .map(([id, name]) => ({
      id,
      name,
      activeViolations: violationCountMap.get(id) ?? 0,
      lastCheckedAt,
    }))
    .sort((a, b) => b.activeViolations - a.activeViolations);

  res.json({ projects: result });
});

// GET /api/dashboard/stats
// DASH-01 / DASH-02 — hero stat row data: { activeProjects, openViolations, weeksDueThisWeek }
// Reuses getBatchProjectCompliance to avoid duplicate violation computation (Pitfall 3 in RESEARCH.md).
dashboardRouter.get('/stats', requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const db = getDb();

  // Single call to the batch service — reuses the same data-set the existing
  // /api/compliance/projects/summary endpoint serves, so React Query caches collide
  // and total cost on dashboard load is one batch (not two).
  const summary = await getBatchProjectCompliance(db, userId);

  // Compute today and today+7 as ISO 'YYYY-MM-DD' strings (string-comparable to weekEndingDate)
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const limitStr = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  let activeProjects = 0;
  let openViolations = 0;
  let weeksDueThisWeek = 0;

  for (const item of summary.values()) {
    // status comes from getBatchProjectCompliance: 'archived' | 'violations' | 'compliant' | 'no-payroll'
    // Active = anything not archived (matches DashboardPage's existing client-side filter
    // `projects.filter(p => p.status === 'active')` in spirit — archived projects are 'closed' status).
    if (item.status !== 'archived') activeProjects++;

    openViolations += item.violationCount;

    const hasDueSoon = item.unsubmittedWeekEndingDates.some(
      (d) => d >= todayStr && d <= limitStr,
    );
    if (hasDueSoon) weeksDueThisWeek++;
  }

  res.json({ activeProjects, openViolations, weeksDueThisWeek });
});

// GET /api/dashboard/compliance-trend
// DASH-03 — 12-week violation trend, oldest-first.
// Bucket logic mirrors the legacy DashboardPage trendData useMemo so visual parity is preserved
// when Plan 02 swaps the client-side computation for this endpoint.
dashboardRouter.get('/compliance-trend', requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const db = getDb();

  const summary = await getBatchProjectCompliance(db, userId);

  // Build 12 buckets, oldest-first (index 0 = 11 weeks ago, index 11 = today)
  const now = new Date();
  const weeks: { weekLabel: string; weekEnd: string; violationCount: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const weekEnd = d.toISOString().slice(0, 10);
    const weekLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    weeks.push({ weekLabel, weekEnd, violationCount: 0 });
  }

  // Attribute each project's violationCount to its latest unsubmitted week within window
  const windowStart = weeks[0]?.weekEnd ?? '';
  for (const item of summary.values()) {
    if (item.violationCount === 0) continue;
    const relevant = item.unsubmittedWeekEndingDates.filter((d) => d >= windowStart);
    if (relevant.length === 0) continue;
    const latestDate = relevant.sort().pop()!;

    // Find closest bucket by absolute time delta
    let bestIdx = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < weeks.length; i++) {
      const diff = Math.abs(
        new Date(latestDate).getTime() - new Date(weeks[i].weekEnd).getTime(),
      );
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }
    weeks[bestIdx].violationCount += item.violationCount;
  }

  // Strip the internal weekEnd field — public shape is { weekLabel, violationCount }
  res.json({
    weeks: weeks.map(({ weekLabel, violationCount }) => ({ weekLabel, violationCount })),
  });
});

// GET /api/dashboard/at-risk
// DASH-04 (panel) — top 5 projects with open violations older than 7 days.
// "Older than 7 days" = at least one unsubmitted payroll week whose weekEndingDate < today-7d.
// Matches the existing /violations route definition exactly (RESEARCH.md Pitfall 2 ambiguity resolved).
dashboardRouter.get('/at-risk', requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const db = getDb();

  // Get user's project IDs + names — same membership pattern as /violations route
  const memberRows = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(and(eq(projectMembers.userId, userId), isNull(projectMembers.removedAt)));

  const projectIds = new Set(memberRows.map((r: { projectId: string }) => r.projectId));
  if (projectIds.size === 0) {
    res.json({ projects: [] });
    return;
  }

  const projectRows = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects);
  const nameMap = new Map<string, string>();
  for (const p of projectRows) {
    if (projectIds.has(p.id)) nameMap.set(p.id, p.name);
  }

  // Pull all payroll weeks once and bucket per project
  const weekRows = await db
    .select({
      projectId: payrollWeeks.projectId,
      weekEndingDate: payrollWeeks.weekEndingDate,
      submittedAt: payrollWeeks.submittedAt,
    })
    .from(payrollWeeks);

  const now = new Date();
  const thresholdMs = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const thresholdStr = new Date(thresholdMs).toISOString().slice(0, 10);

  // For each project: count past-due unsubmitted weeks + track oldest weekEndingDate
  const perProject = new Map<string, { count: number; oldest: string }>();
  for (const week of weekRows) {
    if (!projectIds.has(week.projectId)) continue;
    if (week.submittedAt) continue;
    if (week.weekEndingDate >= thresholdStr) continue;

    const entry = perProject.get(week.projectId);
    if (!entry) {
      perProject.set(week.projectId, { count: 1, oldest: week.weekEndingDate });
    } else {
      entry.count += 1;
      if (week.weekEndingDate < entry.oldest) entry.oldest = week.weekEndingDate;
    }
  }

  const result = Array.from(perProject.entries())
    .map(([id, { count, oldest }]) => {
      const oldestMs = new Date(oldest).getTime();
      const oldestViolationDays = Math.max(
        0,
        Math.floor((now.getTime() - oldestMs) / (24 * 60 * 60 * 1000)),
      );
      return {
        id,
        name: nameMap.get(id) ?? '(unknown)',
        openViolationCount: count,
        oldestViolationDays,
      };
    })
    .sort((a, b) => b.openViolationCount - a.openViolationCount)
    .slice(0, 5);

  res.json({ projects: result });
});

// GET /api/dashboard/economic-impact
// Computes all economic-impact metrics for all projects accessible by the user.
dashboardRouter.get('/economic-impact', requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const db = getDb();

  // Get all project IDs accessible to this user
  const memberRows = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(and(eq(projectMembers.userId, userId), isNull(projectMembers.removedAt)));

  const projectIds = memberRows.map((r: { projectId: string }) => r.projectId);

  const emptyResponse = {
    totalWagesByCraft: [],
    localHirePercent: 0,
    apprenticePercent: 0,
    stateBreakdown: [],
    totalWagesPaid: 0,
    complianceTrend: [],
    topViolatingProjects: [],
    wageVarianceByTrade: [],
    overtimeExposure: [],
    apprenticeshipProgress: [],
    submissionPunctuality: { onTime: 0, late: 0, missing: 0, percentOnTime: 0 },
    weeklyWageBurn: [],
    fringeVsBaseWage: { fringe: 0, base: 0, fringePercent: 0 },
    projectRankings: [],
  };

  if (projectIds.length === 0) {
    res.json({ data: emptyResponse });
    return;
  }

  const projectSet = new Set(projectIds);

  // ── Pull all project rows ────────────────────────────────────────────────
  const projectRows = await db
    .select({ id: projects.id, name: projects.name, state: projects.state, apprenticeshipRequirements: projects.apprenticeshipRequirements })
    .from(projects);

  const userProjects = projectRows.filter((p: typeof projectRows[number]) => projectSet.has(p.id));
  const projectStateMap = new Map<string, string>();
  const projectNameMap = new Map<string, string>();
  for (const p of projectRows) {
    projectStateMap.set(p.id, p.state);
    projectNameMap.set(p.id, p.name);
  }

  // ── Pull all payroll entries for user's projects ─────────────────────────
  const entryRows = await db
    .select({
      tradeDescription: workerClassifications.tradeDescription,
      laborType: workerClassifications.laborType,
      grossWages: payrollEntries.grossWages,
      baseRateSnapshot: payrollEntries.baseRateSnapshot,
      fringeRateSnapshot: payrollEntries.fringeRateSnapshot,
      fringeHealthWelfare: payrollEntries.fringeHealthWelfare,
      fringePension: payrollEntries.fringePension,
      fringeVacation: payrollEntries.fringeVacation,
      fringeTraining: payrollEntries.fringeTraining,
      monSt: payrollEntries.monSt,
      tueSt: payrollEntries.tueSt,
      wedSt: payrollEntries.wedSt,
      thuSt: payrollEntries.thuSt,
      friSt: payrollEntries.friSt,
      satSt: payrollEntries.satSt,
      sunSt: payrollEntries.sunSt,
      monOt: payrollEntries.monOt,
      tueOt: payrollEntries.tueOt,
      wedOt: payrollEntries.wedOt,
      thuOt: payrollEntries.thuOt,
      friOt: payrollEntries.friOt,
      satOt: payrollEntries.satOt,
      sunOt: payrollEntries.sunOt,
      monDt: payrollEntries.monDt,
      tueDt: payrollEntries.tueDt,
      wedDt: payrollEntries.wedDt,
      thuDt: payrollEntries.thuDt,
      friDt: payrollEntries.friDt,
      satDt: payrollEntries.satDt,
      sunDt: payrollEntries.sunDt,
      projectId: payrollWeeks.projectId,
      weekEndingDate: payrollWeeks.weekEndingDate,
      submittedAt: payrollWeeks.submittedAt,
      workerId: payrollEntries.workerId,
    })
    .from(payrollEntries)
    .innerJoin(workerClassifications, eq(payrollEntries.classificationId, workerClassifications.id))
    .innerJoin(payrollWeeks, eq(payrollEntries.payrollWeekId, payrollWeeks.id));

  const filteredEntries = entryRows.filter((r: typeof entryRows[number]) => projectSet.has(r.projectId));

  // ── Pull all payroll weeks for user's projects ───────────────────────────
  const allWeekRows = await db
    .select({
      id: payrollWeeks.id,
      projectId: payrollWeeks.projectId,
      weekEndingDate: payrollWeeks.weekEndingDate,
      submittedAt: payrollWeeks.submittedAt,
    })
    .from(payrollWeeks);

  const filteredWeeks = allWeekRows.filter((w: typeof allWeekRows[number]) => projectSet.has(w.projectId));

  // ── Pull all workers for user's projects ─────────────────────────────────
  const workerRows = await db
    .select({ projectId: workers.projectId, addressState: workers.addressState })
    .from(workers);

  const userWorkers = workerRows.filter((w: typeof workerRows[number]) => projectSet.has(w.projectId));

  // ────────────────────────────────────────────────────────────────────────
  // 1. EXISTING: totalWagesByCraft + workerCount + projectCount
  // ────────────────────────────────────────────────────────────────────────
  const craftWageMap = new Map<string, number>();
  const craftWorkerMap = new Map<string, Set<string>>();
  const craftProjectMap = new Map<string, Set<string>>();
  let totalWagesPaid = 0;
  let apprenticeWages = 0;
  let totalBaseWages = 0;
  let totalFringeWages = 0;

  for (const entry of filteredEntries) {
    const wages = entry.grossWages ?? 0;
    const trade = entry.tradeDescription;
    craftWageMap.set(trade, (craftWageMap.get(trade) ?? 0) + wages);
    if (!craftWorkerMap.has(trade)) craftWorkerMap.set(trade, new Set());
    craftWorkerMap.get(trade)!.add(entry.workerId);
    if (!craftProjectMap.has(trade)) craftProjectMap.set(trade, new Set());
    craftProjectMap.get(trade)!.add(entry.projectId);
    totalWagesPaid += wages;
    if (entry.laborType === 'apprentice') apprenticeWages += wages;

    // Fringe vs base
    const stHours = (entry.monSt ?? 0) + (entry.tueSt ?? 0) + (entry.wedSt ?? 0) +
      (entry.thuSt ?? 0) + (entry.friSt ?? 0) + (entry.satSt ?? 0) + (entry.sunSt ?? 0);
    const otHours = (entry.monOt ?? 0) + (entry.tueOt ?? 0) + (entry.wedOt ?? 0) +
      (entry.thuOt ?? 0) + (entry.friOt ?? 0) + (entry.satOt ?? 0) + (entry.sunOt ?? 0);
    const totalHrs = stHours + otHours;
    totalBaseWages += totalHrs * (entry.baseRateSnapshot ?? 0);
    // Fringe: prefer CA disaggregated, fall back to fringeRateSnapshot * hours
    const fringeDisagg = (entry.fringeHealthWelfare ?? 0) + (entry.fringePension ?? 0) +
      (entry.fringeVacation ?? 0) + (entry.fringeTraining ?? 0);
    if (fringeDisagg > 0) {
      totalFringeWages += fringeDisagg;
    } else {
      totalFringeWages += totalHrs * (entry.fringeRateSnapshot ?? 0);
    }
  }

  const totalWagesByCraft = Array.from(craftWageMap.entries())
    .map(([trade, totalWages]) => ({
      trade,
      totalWages: Math.round(totalWages * 100) / 100,
      workerCount: craftWorkerMap.get(trade)?.size ?? 0,
      projectCount: craftProjectMap.get(trade)?.size ?? 0,
    }))
    .sort((a, b) => b.totalWages - a.totalWages);

  const apprenticePercent = totalWagesPaid > 0
    ? Math.round((apprenticeWages / totalWagesPaid) * 100) : 0;

  // ────────────────────────────────────────────────────────────────────────
  // 2. EXISTING: localHirePercent
  // ────────────────────────────────────────────────────────────────────────
  let localCount = 0;
  for (const w of userWorkers) {
    const projectState = projectStateMap.get(w.projectId);
    if (w.addressState && projectState && w.addressState.toLowerCase() === projectState.toLowerCase()) {
      localCount++;
    }
  }
  const localHirePercent = userWorkers.length > 0
    ? Math.round((localCount / userWorkers.length) * 100) : 0;

  // ────────────────────────────────────────────────────────────────────────
  // 3. EXISTING: stateBreakdown
  // ────────────────────────────────────────────────────────────────────────
  const stateProjectMap = new Map<string, number>();
  for (const p of userProjects) {
    stateProjectMap.set(p.state, (stateProjectMap.get(p.state) ?? 0) + 1);
  }
  const stateWorkerMap = new Map<string, number>();
  const stateWageMap = new Map<string, number>();
  for (const w of userWorkers) {
    const state = projectStateMap.get(w.projectId);
    if (!state) continue;
    stateWorkerMap.set(state, (stateWorkerMap.get(state) ?? 0) + 1);
  }
  for (const entry of filteredEntries) {
    const state = projectStateMap.get(entry.projectId);
    if (!state) continue;
    stateWageMap.set(state, (stateWageMap.get(state) ?? 0) + (entry.grossWages ?? 0));
  }

  const stateBreakdown = Array.from(stateProjectMap.entries()).map(([state, projectCount]) => ({
    state,
    projectCount,
    workerCount: stateWorkerMap.get(state) ?? 0,
    totalWages: Math.round((stateWageMap.get(state) ?? 0) * 100) / 100,
  })).sort((a, b) => b.projectCount - a.projectCount);

  // ────────────────────────────────────────────────────────────────────────
  // 4. NEW: complianceTrend — last 12 weeks
  // Compliance = week has been submitted; violation = week is past-due + not submitted
  // ────────────────────────────────────────────────────────────────────────
  const now = new Date();
  const weekBuckets: { weekLabel: string; weekEnd: string; violations: number; compliant: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const weekEnd = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    weekBuckets.push({ weekLabel: label, weekEnd, violations: 0, compliant: 0 });
  }
  const window12Start = weekBuckets[0].weekEnd;
  const todayStr = now.toISOString().slice(0, 10);

  for (const week of filteredWeeks) {
    if (week.weekEndingDate < window12Start) continue;
    // Find closest bucket
    let bestIdx = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < weekBuckets.length; i++) {
      const diff = Math.abs(
        new Date(week.weekEndingDate).getTime() - new Date(weekBuckets[i].weekEnd).getTime()
      );
      if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
    }
    if (week.submittedAt) {
      weekBuckets[bestIdx].compliant += 1;
    } else if (week.weekEndingDate < todayStr) {
      // Past-due and not submitted = violation
      weekBuckets[bestIdx].violations += 1;
    }
  }

  const complianceTrend = weekBuckets.map(({ weekLabel, violations, compliant }) => ({
    weekLabel,
    violations,
    compliant,
  }));

  // ────────────────────────────────────────────────────────────────────────
  // 5. NEW: topViolatingProjects — top 5 by past-due unsubmitted weeks
  // ────────────────────────────────────────────────────────────────────────
  const projectViolationMap = new Map<string, { count: number; lastDate: string }>();
  for (const week of filteredWeeks) {
    if (!week.submittedAt && week.weekEndingDate < todayStr) {
      const existing = projectViolationMap.get(week.projectId);
      if (!existing) {
        projectViolationMap.set(week.projectId, { count: 1, lastDate: week.weekEndingDate });
      } else {
        existing.count += 1;
        if (week.weekEndingDate > existing.lastDate) existing.lastDate = week.weekEndingDate;
      }
    }
  }

  const topViolatingProjects = Array.from(projectViolationMap.entries())
    .map(([projectId, { count, lastDate }]) => ({
      projectId,
      projectName: projectNameMap.get(projectId) ?? projectId,
      violations: count,
      lastViolation: lastDate,
    }))
    .sort((a, b) => b.violations - a.violations)
    .slice(0, 5);

  // ────────────────────────────────────────────────────────────────────────
  // 6. NEW: wageVarianceByTrade — per-trade min/max/avg/deviation
  // ────────────────────────────────────────────────────────────────────────
  const tradeRateMap = new Map<string, number[]>();
  for (const entry of filteredEntries) {
    const rate = entry.baseRateSnapshot ?? 0;
    if (rate === 0) continue;
    if (!tradeRateMap.has(entry.tradeDescription)) tradeRateMap.set(entry.tradeDescription, []);
    tradeRateMap.get(entry.tradeDescription)!.push(rate);
  }

  const wageVarianceByTrade = Array.from(tradeRateMap.entries()).map(([trade, rates]) => {
    const avg = rates.reduce((s, r) => s + r, 0) / rates.length;
    const min = Math.min(...rates);
    const max = Math.max(...rates);
    const variance = rates.reduce((s, r) => s + Math.pow(r - avg, 2), 0) / rates.length;
    const deviation = Math.sqrt(variance);
    return {
      trade,
      avgRate: Math.round(avg * 100) / 100,
      minRate: Math.round(min * 100) / 100,
      maxRate: Math.round(max * 100) / 100,
      deviation: Math.round(deviation * 100) / 100,
    };
  }).sort((a, b) => b.deviation - a.deviation);

  // ────────────────────────────────────────────────────────────────────────
  // 7. NEW: overtimeExposure — DT/OT premium cost per project
  // ────────────────────────────────────────────────────────────────────────
  const projectOtMap = new Map<string, { dtHours: number; otHours: number; premiumCost: number }>();
  for (const entry of filteredEntries) {
    const projectId = entry.projectId;
    if (!projectOtMap.has(projectId)) projectOtMap.set(projectId, { dtHours: 0, otHours: 0, premiumCost: 0 });
    const rec = projectOtMap.get(projectId)!;
    const otHrs = (entry.monOt ?? 0) + (entry.tueOt ?? 0) + (entry.wedOt ?? 0) +
      (entry.thuOt ?? 0) + (entry.friOt ?? 0) + (entry.satOt ?? 0) + (entry.sunOt ?? 0);
    const dtHrs = (entry.monDt ?? 0) + (entry.tueDt ?? 0) + (entry.wedDt ?? 0) +
      (entry.thuDt ?? 0) + (entry.friDt ?? 0) + (entry.satDt ?? 0) + (entry.sunDt ?? 0);
    const base = entry.baseRateSnapshot ?? 0;
    // OT premium = 0.5x base, DT premium = 1x base (above ST)
    rec.otHours += otHrs;
    rec.dtHours += dtHrs;
    rec.premiumCost += (otHrs * base * 0.5) + (dtHrs * base * 1.0);
  }

  const overtimeExposure = Array.from(projectOtMap.entries())
    .filter(([, rec]) => rec.otHours > 0 || rec.dtHours > 0)
    .map(([projectId, rec]) => ({
      projectId,
      projectName: projectNameMap.get(projectId) ?? projectId,
      dtHours: Math.round(rec.dtHours * 100) / 100,
      otHours: Math.round(rec.otHours * 100) / 100,
      estimatedPremium: Math.round(rec.premiumCost * 100) / 100,
    }))
    .sort((a, b) => b.estimatedPremium - a.estimatedPremium)
    .slice(0, 10);

  // ────────────────────────────────────────────────────────────────────────
  // 8. NEW: apprenticeshipProgress — per-trade actual % vs required ratio
  // Required ratio comes from project.apprenticeshipRequirements JSON
  // Format: { "Electrician": { "maxRatio": "1:2" } } meaning 1 apprentice per 2 journeyworkers
  // ────────────────────────────────────────────────────────────────────────
  // Collect required ratios across all user projects
  const tradeRequiredPct = new Map<string, number>(); // trade -> required apprentice %
  for (const p of userProjects) {
    if (!p.apprenticeshipRequirements) continue;
    try {
      const reqs = JSON.parse(p.apprenticeshipRequirements) as Record<string, { maxRatio: string }>;
      for (const [trade, req] of Object.entries(reqs)) {
        if (!req?.maxRatio) continue;
        const [num, denom] = req.maxRatio.split(':').map(Number);
        if (!isNaN(num) && !isNaN(denom) && denom > 0) {
          const pct = (num / (num + denom)) * 100;
          tradeRequiredPct.set(trade, Math.max(tradeRequiredPct.get(trade) ?? 0, pct));
        }
      }
    } catch {
      // ignore JSON parse errors
    }
  }

  // Compute actual apprentice hours per trade
  const tradeApprenticeHours = new Map<string, number>();
  const tradeTotalHours = new Map<string, number>();
  for (const entry of filteredEntries) {
    const stHours = (entry.monSt ?? 0) + (entry.tueSt ?? 0) + (entry.wedSt ?? 0) +
      (entry.thuSt ?? 0) + (entry.friSt ?? 0) + (entry.satSt ?? 0) + (entry.sunSt ?? 0);
    const otHours = (entry.monOt ?? 0) + (entry.tueOt ?? 0) + (entry.wedOt ?? 0) +
      (entry.thuOt ?? 0) + (entry.friOt ?? 0) + (entry.satOt ?? 0) + (entry.sunOt ?? 0);
    const hrs = stHours + otHours;
    tradeTotalHours.set(entry.tradeDescription, (tradeTotalHours.get(entry.tradeDescription) ?? 0) + hrs);
    if (entry.laborType === 'apprentice') {
      tradeApprenticeHours.set(entry.tradeDescription, (tradeApprenticeHours.get(entry.tradeDescription) ?? 0) + hrs);
    }
  }

  // Use required pct from project config, or fall back to DOL default 25%
  const apprenticeshipProgress = Array.from(tradeTotalHours.entries()).map(([trade, totalHrs]) => {
    const appHrs = tradeApprenticeHours.get(trade) ?? 0;
    const required = tradeRequiredPct.get(trade) ?? 25; // DOL IRA/IIJA default
    const actual = totalHrs > 0 ? Math.round((appHrs / totalHrs) * 100) : 0;
    return {
      trade,
      required: Math.round(required),
      actual,
      gap: Math.max(0, Math.round(required) - actual),
    };
  }).sort((a, b) => b.gap - a.gap);

  // ────────────────────────────────────────────────────────────────────────
  // 9. NEW: submissionPunctuality — CPR on-time %
  // On-time = submitted within 7 days of weekEndingDate
  // Late = submitted but > 7 days after weekEndingDate
  // Missing = not submitted and weekEndingDate is in the past
  // ────────────────────────────────────────────────────────────────────────
  let onTime = 0;
  let late = 0;
  let missing = 0;
  for (const week of filteredWeeks) {
    if (week.weekEndingDate >= todayStr) continue; // not yet due
    if (!week.submittedAt) {
      missing += 1;
    } else {
      const daysLate = (new Date(week.submittedAt).getTime() - new Date(week.weekEndingDate).getTime()) / (1000 * 60 * 60 * 24);
      if (daysLate <= 7) {
        onTime += 1;
      } else {
        late += 1;
      }
    }
  }
  const totalSubmissions = onTime + late + missing;
  const percentOnTime = totalSubmissions > 0 ? Math.round((onTime / totalSubmissions) * 100) : 0;

  const submissionPunctuality = { onTime, late, missing, percentOnTime };

  // ────────────────────────────────────────────────────────────────────────
  // 10. NEW: weeklyWageBurn — last 12 weeks
  // ────────────────────────────────────────────────────────────────────────
  const wageBurnBuckets: { weekLabel: string; weekEnd: string; wages: number; workers: Set<string> }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const weekEnd = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    wageBurnBuckets.push({ weekLabel: label, weekEnd, wages: 0, workers: new Set() });
  }

  for (const entry of filteredEntries) {
    if (entry.weekEndingDate < window12Start) continue;
    let bestIdx = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < wageBurnBuckets.length; i++) {
      const diff = Math.abs(
        new Date(entry.weekEndingDate).getTime() - new Date(wageBurnBuckets[i].weekEnd).getTime()
      );
      if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
    }
    wageBurnBuckets[bestIdx].wages += entry.grossWages ?? 0;
    wageBurnBuckets[bestIdx].workers.add(entry.workerId);
  }

  const weeklyWageBurn = wageBurnBuckets.map(({ weekLabel, wages, workers }) => ({
    weekLabel,
    wages: Math.round(wages * 100) / 100,
    workers: workers.size,
  }));

  // ────────────────────────────────────────────────────────────────────────
  // 11. NEW: fringeVsBaseWage — aggregate fringe benefit ratio
  // ────────────────────────────────────────────────────────────────────────
  const fringePercent = (totalBaseWages + totalFringeWages) > 0
    ? Math.round((totalFringeWages / (totalBaseWages + totalFringeWages)) * 100) : 0;

  const fringeVsBaseWage = {
    fringe: Math.round(totalFringeWages * 100) / 100,
    base: Math.round(totalBaseWages * 100) / 100,
    fringePercent,
  };

  // ────────────────────────────────────────────────────────────────────────
  // 12. NEW: projectRankings — top 10 by total wages, with compliance score
  // Compliance score = % of weeks submitted (0–100)
  // ────────────────────────────────────────────────────────────────────────
  const projectWagesMap = new Map<string, number>();
  const projectWorkersMap = new Map<string, Set<string>>();
  for (const entry of filteredEntries) {
    projectWagesMap.set(entry.projectId, (projectWagesMap.get(entry.projectId) ?? 0) + (entry.grossWages ?? 0));
    if (!projectWorkersMap.has(entry.projectId)) projectWorkersMap.set(entry.projectId, new Set());
    projectWorkersMap.get(entry.projectId)!.add(entry.workerId);
  }

  const projectWeekCountMap = new Map<string, number>();
  const projectSubmittedCountMap = new Map<string, number>();
  for (const week of filteredWeeks) {
    projectWeekCountMap.set(week.projectId, (projectWeekCountMap.get(week.projectId) ?? 0) + 1);
    if (week.submittedAt) {
      projectSubmittedCountMap.set(week.projectId, (projectSubmittedCountMap.get(week.projectId) ?? 0) + 1);
    }
  }

  const projectRankings = Array.from(projectWagesMap.entries())
    .map(([projectId, totalWages]) => {
      const weekCount = projectWeekCountMap.get(projectId) ?? 0;
      const submittedCount = projectSubmittedCountMap.get(projectId) ?? 0;
      const compliance = weekCount > 0 ? Math.round((submittedCount / weekCount) * 100) : 100;
      return {
        projectId,
        projectName: projectNameMap.get(projectId) ?? projectId,
        totalWages: Math.round(totalWages * 100) / 100,
        workers: projectWorkersMap.get(projectId)?.size ?? 0,
        compliance,
      };
    })
    .sort((a, b) => b.totalWages - a.totalWages)
    .slice(0, 10);

  res.json({
    data: {
      totalWagesByCraft,
      localHirePercent,
      apprenticePercent,
      stateBreakdown,
      totalWagesPaid: Math.round(totalWagesPaid * 100) / 100,
      complianceTrend,
      topViolatingProjects,
      wageVarianceByTrade,
      overtimeExposure,
      apprenticeshipProgress,
      submissionPunctuality,
      weeklyWageBurn,
      fringeVsBaseWage,
      projectRankings,
    },
  });
});
