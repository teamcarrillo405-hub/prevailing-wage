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
  subcontractors,
  subcontractorCprWeeks,
  users,
  onboardingProfiles,
} from '../db/schema.js';
import { getBatchProjectCompliance } from '../services/complianceService.js';

export const dashboardRouter = Router();

type ContractorAction = {
  id: string;
  projectId: string;
  projectName: string;
  type: 'violation' | 'overdue_payroll' | 'due_payroll' | 'setup' | 'subcontractor_cpr';
  priority: 'critical' | 'high' | 'medium' | 'low';
  label: string;
  detail: string;
  to: string;
  dueDate: string | null;
};

function daysBetween(a: string, b: string): number {
  const aMs = new Date(`${a}T00:00:00.000Z`).getTime();
  const bMs = new Date(`${b}T00:00:00.000Z`).getTime();
  return Math.floor((aMs - bMs) / (24 * 60 * 60 * 1000));
}

function getCprQueueStatus(weekEndingDate: string, receivedDate: string | null, isCompliant: number | null) {
  if (receivedDate) return isCompliant === 1 ? 'received-compliant' : 'received-non-compliant';
  const today = new Date().toISOString().slice(0, 10);
  return daysBetween(today, weekEndingDate) > 7 ? 'overdue' : 'not-received';
}

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

// GET /api/dashboard/contractor-actions
// Contractor-first queue: the dashboard should answer "what do I need to do next?"
// without making users inspect trends, grids, and compliance badges manually.
dashboardRouter.get('/contractor-actions', requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const db = getDb();

  const memberRows = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(and(eq(projectMembers.userId, userId), isNull(projectMembers.removedAt)));
  const projectIds = new Set(memberRows.map((r: { projectId: string }) => r.projectId));

  if (projectIds.size === 0) {
    res.json({ actions: [] });
    return;
  }

  const [projectRows, workerRows, weekRows, subRows, cprRows] = await Promise.all([
    db.select({ id: projects.id, name: projects.name, status: projects.status }).from(projects),
    db.select({ projectId: workers.projectId }).from(workers),
    db.select({
      id: payrollWeeks.id,
      projectId: payrollWeeks.projectId,
      payrollNumber: payrollWeeks.payrollNumber,
      weekEndingDate: payrollWeeks.weekEndingDate,
      submittedAt: payrollWeeks.submittedAt,
    }).from(payrollWeeks),
    db.select({ id: subcontractors.id, projectId: subcontractors.projectId, name: subcontractors.name }).from(subcontractors),
    db.select({
      id: subcontractorCprWeeks.id,
      subcontractorId: subcontractorCprWeeks.subcontractorId,
      weekEndingDate: subcontractorCprWeeks.weekEndingDate,
      receivedDate: subcontractorCprWeeks.receivedDate,
      isCompliant: subcontractorCprWeeks.isCompliant,
    }).from(subcontractorCprWeeks),
  ]);
  type ActionProjectRow = { id: string; name: string; status: string };
  type ActionWeekRow = { id: string; projectId: string; payrollNumber: number; weekEndingDate: string; submittedAt: string | null };
  type ActionSubRow = { id: string; projectId: string; name: string };
  type ActionCprRow = { id: string; subcontractorId: string; weekEndingDate: string; receivedDate: string | null; isCompliant: number | null };
  const typedProjectRows = projectRows as ActionProjectRow[];
  const typedWorkerRows = workerRows as Array<{ projectId: string }>;
  const typedWeekRows = weekRows as ActionWeekRow[];
  const typedSubRows = subRows as ActionSubRow[];
  const typedCprRows = cprRows as ActionCprRow[];

  const projectMap = new Map<string, ActionProjectRow>(
    typedProjectRows
      .filter((p) => projectIds.has(p.id) && p.status !== 'archived')
      .map((p) => [p.id, p]),
  );
  const workerCount = new Map<string, number>();
  for (const row of typedWorkerRows) {
    if (!projectMap.has(row.projectId)) continue;
    workerCount.set(row.projectId, (workerCount.get(row.projectId) ?? 0) + 1);
  }

  const weeksByProject = new Map<string, ActionWeekRow[]>();
  for (const week of typedWeekRows) {
    if (!projectMap.has(week.projectId)) continue;
    const arr = weeksByProject.get(week.projectId) ?? [];
    arr.push(week);
    weeksByProject.set(week.projectId, arr);
  }

  const subProjectMap = new Map<string, { projectId: string; name: string }>();
  for (const sub of typedSubRows) {
    if (projectMap.has(sub.projectId)) subProjectMap.set(sub.id, { projectId: sub.projectId, name: sub.name });
  }

  const today = new Date().toISOString().slice(0, 10);
  const weekLimit = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const compliance = await getBatchProjectCompliance(db, userId);
  const actions: ContractorAction[] = [];

  for (const [projectId, project] of projectMap) {
    const summary = compliance.get(projectId);
    if ((summary?.violationCount ?? 0) > 0) {
      actions.push({
        id: `${projectId}:violations`,
        projectId,
        projectName: project.name,
        type: 'violation',
        priority: 'critical',
        label: `Resolve ${summary!.violationCount} compliance violation${summary!.violationCount === 1 ? '' : 's'}`,
        detail: 'Fix wages, overtime, deductions, or apprenticeship issues before this CPR is certified.',
        to: `/projects/${projectId}/payroll`,
        dueDate: null,
      });
    }

    const projectWeeks = (weeksByProject.get(projectId) ?? []).slice().sort((a, b) => a.weekEndingDate.localeCompare(b.weekEndingDate));
    const openWeeks = projectWeeks.filter((w) => !w.submittedAt);
    const overdue = openWeeks.filter((w) => daysBetween(today, w.weekEndingDate) > 7);
    const dueSoon = openWeeks.filter((w) => w.weekEndingDate >= today && w.weekEndingDate <= weekLimit);
    const targetOverdue = overdue[0];
    if (targetOverdue) {
      actions.push({
        id: `${projectId}:overdue:${targetOverdue.id}`,
        projectId,
        projectName: project.name,
        type: 'overdue_payroll',
        priority: 'high',
        label: `Submit Payroll Week ${targetOverdue.payrollNumber}`,
        detail: `Week ending ${targetOverdue.weekEndingDate} is past the 7-day certified payroll window.`,
        to: `/projects/${projectId}/payroll/${targetOverdue.id}`,
        dueDate: targetOverdue.weekEndingDate,
      });
    } else if (dueSoon[0]) {
      actions.push({
        id: `${projectId}:due:${dueSoon[0].id}`,
        projectId,
        projectName: project.name,
        type: 'due_payroll',
        priority: 'medium',
        label: `Finish Payroll Week ${dueSoon[0].payrollNumber}`,
        detail: `Week ending ${dueSoon[0].weekEndingDate} is coming due.`,
        to: `/projects/${projectId}/payroll/${dueSoon[0].id}`,
        dueDate: dueSoon[0].weekEndingDate,
      });
    }

    if ((workerCount.get(projectId) ?? 0) === 0) {
      actions.push({
        id: `${projectId}:workers`,
        projectId,
        projectName: project.name,
        type: 'setup',
        priority: 'medium',
        label: 'Add workers and classifications',
        detail: 'Payroll cannot be certified until workers and trade classifications exist.',
        to: `/projects/${projectId}/workers`,
        dueDate: null,
      });
    } else if (projectWeeks.length === 0) {
      actions.push({
        id: `${projectId}:weeks`,
        projectId,
        projectName: project.name,
        type: 'setup',
        priority: 'medium',
        label: 'Create the first payroll week',
        detail: 'Set up weekly CPR tracking for this project.',
        to: `/projects/${projectId}/payroll`,
        dueDate: null,
      });
    }
  }

  for (const cpr of typedCprRows) {
    const sub = subProjectMap.get(cpr.subcontractorId);
    if (!sub) continue;
    const status = getCprQueueStatus(cpr.weekEndingDate, cpr.receivedDate, cpr.isCompliant);
    if (status !== 'overdue' && status !== 'received-non-compliant') continue;
    const project = projectMap.get(sub.projectId);
    if (!project) continue;
    actions.push({
      id: `${sub.projectId}:sub-cpr:${cpr.id}`,
      projectId: sub.projectId,
      projectName: project.name,
      type: 'subcontractor_cpr',
      priority: status === 'overdue' ? 'high' : 'medium',
      label: status === 'overdue' ? `Collect CPR from ${sub.name}` : `Review non-compliant CPR from ${sub.name}`,
      detail: `Subcontractor week ending ${cpr.weekEndingDate} needs contractor follow-up.`,
      to: `/projects/${sub.projectId}`,
      dueDate: cpr.weekEndingDate,
    });
  }

  const priorityRank: Record<ContractorAction['priority'], number> = { critical: 0, high: 1, medium: 2, low: 3 };
  actions.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || (a.dueDate ?? '9999-99-99').localeCompare(b.dueDate ?? '9999-99-99'));

  res.json({ actions: actions.slice(0, 12) });
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dashboard
// Unified dashboard endpoint — runs all sub-queries in parallel and returns a
// single combined payload so the client only needs one network round-trip.
// Any failing sub-call resolves to a safe empty default via Promise.allSettled.
// ─────────────────────────────────────────────────────────────────────────────
dashboardRouter.get('/', requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const db = getDb();
  const statusFilter = (req.query.status as string | undefined) ?? 'active';

  // ── Sub-query helpers ────────────────────────────────────────────────────

  async function getMfaStatus() {
    const [user] = await db
      .select({ enabled: users.totpEnabled, backupCodes: users.totpBackupCodes })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) return { enabled: false, backupCodesRemaining: 0 };
    let remaining = 0;
    if (user.backupCodes) {
      try {
        const list = JSON.parse(user.backupCodes) as unknown[];
        if (Array.isArray(list)) remaining = list.length;
      } catch { /* ignore */ }
    }
    return { enabled: user.enabled === true, backupCodesRemaining: remaining };
  }

  async function getTeam() {
    const [row] = await db
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .where(and(eq(projectMembers.userId, userId), eq(projectMembers.role, 'owner'), isNull(projectMembers.removedAt)))
      .limit(1);
    return { isOwner: !!row };
  }

  async function getProjects() {
    const statusCondition = (!statusFilter || statusFilter === 'active')
      ? eq(projects.status, 'active')
      : undefined;
    const rows = await db
      .select({ project: projects })
      .from(projects)
      .innerJoin(
        projectMembers,
        and(
          eq(projectMembers.projectId, projects.id),
          eq(projectMembers.userId, userId),
          isNull(projectMembers.removedAt),
        ),
      )
      .where(statusCondition);
    return rows.map((r: { project: typeof projects.$inferSelect }) => r.project);
  }

  async function getComplianceSummary() {
    const summaryMap = await getBatchProjectCompliance(db, userId);
    return Array.from(summaryMap.entries()).map(([id, summary]) => ({
      id,
      status: summary.status,
      violationCount: summary.violationCount,
      unsubmittedWeekEndingDates: summary.unsubmittedWeekEndingDates,
    }));
  }

  async function getStats(complianceSummary: Awaited<ReturnType<typeof getComplianceSummary>>) {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const limitStr = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    let activeProjects = 0;
    let openViolations = 0;
    let weeksDueThisWeek = 0;
    for (const item of complianceSummary) {
      if (item.status !== 'archived') activeProjects++;
      openViolations += item.violationCount;
      if (item.unsubmittedWeekEndingDates.some((d) => d >= todayStr && d <= limitStr)) weeksDueThisWeek++;
    }
    return { activeProjects, openViolations, weeksDueThisWeek };
  }

  async function getContractorActions() {
    const memberRows = await db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(and(eq(projectMembers.userId, userId), isNull(projectMembers.removedAt)));
    const projectIds = new Set(memberRows.map((r: { projectId: string }) => r.projectId));
    if (projectIds.size === 0) return [];

    const [projectRows, workerRows, weekRows, subRows, cprRows] = await Promise.all([
      db.select({ id: projects.id, name: projects.name, status: projects.status }).from(projects),
      db.select({ projectId: workers.projectId }).from(workers),
      db.select({ id: payrollWeeks.id, projectId: payrollWeeks.projectId, payrollNumber: payrollWeeks.payrollNumber, weekEndingDate: payrollWeeks.weekEndingDate, submittedAt: payrollWeeks.submittedAt }).from(payrollWeeks),
      db.select({ id: subcontractors.id, projectId: subcontractors.projectId, name: subcontractors.name }).from(subcontractors),
      db.select({ id: subcontractorCprWeeks.id, subcontractorId: subcontractorCprWeeks.subcontractorId, weekEndingDate: subcontractorCprWeeks.weekEndingDate, receivedDate: subcontractorCprWeeks.receivedDate, isCompliant: subcontractorCprWeeks.isCompliant }).from(subcontractorCprWeeks),
    ]);

    type ActionProjectRow = { id: string; name: string; status: string };
    type ActionWeekRow = { id: string; projectId: string; payrollNumber: number; weekEndingDate: string; submittedAt: string | null };
    type ActionSubRow = { id: string; projectId: string; name: string };
    type ActionCprRow = { id: string; subcontractorId: string; weekEndingDate: string; receivedDate: string | null; isCompliant: number | null };

    const typedProjectRows = projectRows as ActionProjectRow[];
    const typedWorkerRows = workerRows as Array<{ projectId: string }>;
    const typedWeekRows = weekRows as ActionWeekRow[];
    const typedSubRows = subRows as ActionSubRow[];
    const typedCprRows = cprRows as ActionCprRow[];

    const projectMap = new Map<string, ActionProjectRow>(
      typedProjectRows.filter((p) => projectIds.has(p.id) && p.status !== 'archived').map((p) => [p.id, p]),
    );
    const workerCount = new Map<string, number>();
    for (const row of typedWorkerRows) {
      if (!projectMap.has(row.projectId)) continue;
      workerCount.set(row.projectId, (workerCount.get(row.projectId) ?? 0) + 1);
    }

    const weeksByProject = new Map<string, ActionWeekRow[]>();
    for (const week of typedWeekRows) {
      if (!projectMap.has(week.projectId)) continue;
      const arr = weeksByProject.get(week.projectId) ?? [];
      arr.push(week);
      weeksByProject.set(week.projectId, arr);
    }

    const subProjectMap = new Map<string, { projectId: string; name: string }>();
    for (const sub of typedSubRows) {
      if (projectMap.has(sub.projectId)) subProjectMap.set(sub.id, { projectId: sub.projectId, name: sub.name });
    }

    const today = new Date().toISOString().slice(0, 10);
    const weekLimit = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const compliance = await getBatchProjectCompliance(db, userId);
    const actions: ContractorAction[] = [];

    for (const [projectId, project] of projectMap) {
      const summary = compliance.get(projectId);
      if ((summary?.violationCount ?? 0) > 0) {
        actions.push({ id: `${projectId}:violations`, projectId, projectName: project.name, type: 'violation', priority: 'critical', label: `Resolve ${summary!.violationCount} compliance violation${summary!.violationCount === 1 ? '' : 's'}`, detail: 'Fix wages, overtime, deductions, or apprenticeship issues before this CPR is certified.', to: `/projects/${projectId}/payroll`, dueDate: null });
      }
      const projectWeeks = (weeksByProject.get(projectId) ?? []).slice().sort((a, b) => a.weekEndingDate.localeCompare(b.weekEndingDate));
      const openWeeks = projectWeeks.filter((w) => !w.submittedAt);
      const overdue = openWeeks.filter((w) => daysBetween(today, w.weekEndingDate) > 7);
      const dueSoon = openWeeks.filter((w) => w.weekEndingDate >= today && w.weekEndingDate <= weekLimit);
      const targetOverdue = overdue[0];
      if (targetOverdue) {
        actions.push({ id: `${projectId}:overdue:${targetOverdue.id}`, projectId, projectName: project.name, type: 'overdue_payroll', priority: 'high', label: `Submit Payroll Week ${targetOverdue.payrollNumber}`, detail: `Week ending ${targetOverdue.weekEndingDate} is past the 7-day certified payroll window.`, to: `/projects/${projectId}/payroll/${targetOverdue.id}`, dueDate: targetOverdue.weekEndingDate });
      } else if (dueSoon[0]) {
        actions.push({ id: `${projectId}:due:${dueSoon[0].id}`, projectId, projectName: project.name, type: 'due_payroll', priority: 'medium', label: `Finish Payroll Week ${dueSoon[0].payrollNumber}`, detail: `Week ending ${dueSoon[0].weekEndingDate} is coming due.`, to: `/projects/${projectId}/payroll/${dueSoon[0].id}`, dueDate: dueSoon[0].weekEndingDate });
      }
      if ((workerCount.get(projectId) ?? 0) === 0) {
        actions.push({ id: `${projectId}:workers`, projectId, projectName: project.name, type: 'setup', priority: 'medium', label: 'Add workers and classifications', detail: 'Payroll cannot be certified until workers and trade classifications exist.', to: `/projects/${projectId}/workers`, dueDate: null });
      } else if (projectWeeks.length === 0) {
        actions.push({ id: `${projectId}:weeks`, projectId, projectName: project.name, type: 'setup', priority: 'medium', label: 'Create the first payroll week', detail: 'Set up weekly CPR tracking for this project.', to: `/projects/${projectId}/payroll`, dueDate: null });
      }
    }

    for (const cpr of typedCprRows) {
      const sub = subProjectMap.get(cpr.subcontractorId);
      if (!sub) continue;
      const cprStatus = getCprQueueStatus(cpr.weekEndingDate, cpr.receivedDate, cpr.isCompliant);
      if (cprStatus !== 'overdue' && cprStatus !== 'received-non-compliant') continue;
      const project = projectMap.get(sub.projectId);
      if (!project) continue;
      actions.push({ id: `${sub.projectId}:sub-cpr:${cpr.id}`, projectId: sub.projectId, projectName: project.name, type: 'subcontractor_cpr', priority: cprStatus === 'overdue' ? 'high' : 'medium', label: cprStatus === 'overdue' ? `Collect CPR from ${sub.name}` : `Review non-compliant CPR from ${sub.name}`, detail: `Subcontractor week ending ${cpr.weekEndingDate} needs contractor follow-up.`, to: `/projects/${sub.projectId}`, dueDate: cpr.weekEndingDate });
    }

    const priorityRank: Record<ContractorAction['priority'], number> = { critical: 0, high: 1, medium: 2, low: 3 };
    actions.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || (a.dueDate ?? '9999-99-99').localeCompare(b.dueDate ?? '9999-99-99'));
    return actions.slice(0, 12);
  }

  async function getOnboarding() {
    const [user] = await db
      .select({ hccMembershipNumber: users.hccMembershipNumber, companyName: users.companyName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const [profile] = await db
      .select()
      .from(onboardingProfiles)
      .where(eq(onboardingProfiles.userId, userId))
      .limit(1);
    return {
      data: {
        user: { companyName: user?.companyName ?? null, hccMembershipNumber: user?.hccMembershipNumber ?? null },
        profile: profile
          ? { ...profile, primaryStates: JSON.parse(profile.primaryStates) as string[], workTypes: JSON.parse(profile.workTypes) as string[], onboardingAnswers: JSON.parse(profile.onboardingAnswers) as Record<string, unknown>, recommendedNextSteps: JSON.parse(profile.recommendedNextSteps) as string[] }
          : null,
      },
    };
  }

  async function getComplianceTrend() {
    const summary = await getBatchProjectCompliance(db, userId);
    const now = new Date();
    const weeks: { weekLabel: string; weekEnd: string; violationCount: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      weeks.push({ weekLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), weekEnd: d.toISOString().slice(0, 10), violationCount: 0 });
    }
    const windowStart = weeks[0]?.weekEnd ?? '';
    for (const item of summary.values()) {
      if (item.violationCount === 0) continue;
      const relevant = item.unsubmittedWeekEndingDates.filter((d) => d >= windowStart);
      if (relevant.length === 0) continue;
      const latestDate = relevant.sort().pop()!;
      let bestIdx = 0;
      let bestDiff = Infinity;
      for (let i = 0; i < weeks.length; i++) {
        const diff = Math.abs(new Date(latestDate).getTime() - new Date(weeks[i].weekEnd).getTime());
        if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
      }
      weeks[bestIdx].violationCount += item.violationCount;
    }
    return weeks.map(({ weekLabel, violationCount }) => ({ weekLabel, violationCount }));
  }

  async function getAtRisk() {
    const memberRows = await db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(and(eq(projectMembers.userId, userId), isNull(projectMembers.removedAt)));
    const projectIds = new Set(memberRows.map((r: { projectId: string }) => r.projectId));
    if (projectIds.size === 0) return [];

    const projectRows = await db.select({ id: projects.id, name: projects.name }).from(projects);
    const nameMap = new Map<string, string>();
    for (const p of projectRows) { if (projectIds.has(p.id)) nameMap.set(p.id, p.name); }

    const weekRows = await db.select({ projectId: payrollWeeks.projectId, weekEndingDate: payrollWeeks.weekEndingDate, submittedAt: payrollWeeks.submittedAt }).from(payrollWeeks);
    const now = new Date();
    const thresholdStr = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const perProject = new Map<string, { count: number; oldest: string }>();
    for (const week of weekRows) {
      if (!projectIds.has(week.projectId) || week.submittedAt || week.weekEndingDate >= thresholdStr) continue;
      const entry = perProject.get(week.projectId);
      if (!entry) { perProject.set(week.projectId, { count: 1, oldest: week.weekEndingDate }); }
      else { entry.count += 1; if (week.weekEndingDate < entry.oldest) entry.oldest = week.weekEndingDate; }
    }

    return Array.from(perProject.entries())
      .map(([id, { count, oldest }]) => ({ id, name: nameMap.get(id) ?? '(unknown)', openViolationCount: count, oldestViolationDays: Math.max(0, Math.floor((now.getTime() - new Date(oldest).getTime()) / (24 * 60 * 60 * 1000))) }))
      .sort((a, b) => b.openViolationCount - a.openViolationCount)
      .slice(0, 5);
  }

  async function getEconomicImpact() {
    const emptyResponse = { totalWagesByCraft: [], localHirePercent: 0, apprenticePercent: 0, stateBreakdown: [], totalWagesPaid: 0, complianceTrend: [], topViolatingProjects: [], wageVarianceByTrade: [], overtimeExposure: [], apprenticeshipProgress: [], submissionPunctuality: { onTime: 0, late: 0, missing: 0, percentOnTime: 0 }, weeklyWageBurn: [], fringeVsBaseWage: { fringe: 0, base: 0, fringePercent: 0 }, projectRankings: [] };
    const memberRows2 = await db.select({ projectId: projectMembers.projectId }).from(projectMembers).where(and(eq(projectMembers.userId, userId), isNull(projectMembers.removedAt)));
    const projectIds2 = memberRows2.map((r: { projectId: string }) => r.projectId);
    if (projectIds2.length === 0) return emptyResponse;
    const projectSet2 = new Set(projectIds2);

    const projectRows2 = await db.select({ id: projects.id, name: projects.name, state: projects.state, apprenticeshipRequirements: projects.apprenticeshipRequirements }).from(projects);
    const userProjects2 = projectRows2.filter((p: typeof projectRows2[number]) => projectSet2.has(p.id));
    const projectStateMap2 = new Map<string, string>();
    const projectNameMap2 = new Map<string, string>();
    for (const p of projectRows2) { projectStateMap2.set(p.id, p.state); projectNameMap2.set(p.id, p.name); }

    const entryRows2 = await db.select({ tradeDescription: workerClassifications.tradeDescription, laborType: workerClassifications.laborType, grossWages: payrollEntries.grossWages, baseRateSnapshot: payrollEntries.baseRateSnapshot, fringeRateSnapshot: payrollEntries.fringeRateSnapshot, fringeHealthWelfare: payrollEntries.fringeHealthWelfare, fringePension: payrollEntries.fringePension, fringeVacation: payrollEntries.fringeVacation, fringeTraining: payrollEntries.fringeTraining, monSt: payrollEntries.monSt, tueSt: payrollEntries.tueSt, wedSt: payrollEntries.wedSt, thuSt: payrollEntries.thuSt, friSt: payrollEntries.friSt, satSt: payrollEntries.satSt, sunSt: payrollEntries.sunSt, monOt: payrollEntries.monOt, tueOt: payrollEntries.tueOt, wedOt: payrollEntries.wedOt, thuOt: payrollEntries.thuOt, friOt: payrollEntries.friOt, satOt: payrollEntries.satOt, sunOt: payrollEntries.sunOt, monDt: payrollEntries.monDt, tueDt: payrollEntries.tueDt, wedDt: payrollEntries.wedDt, thuDt: payrollEntries.thuDt, friDt: payrollEntries.friDt, satDt: payrollEntries.satDt, sunDt: payrollEntries.sunDt, projectId: payrollWeeks.projectId, weekEndingDate: payrollWeeks.weekEndingDate, submittedAt: payrollWeeks.submittedAt, workerId: payrollEntries.workerId }).from(payrollEntries).innerJoin(workerClassifications, eq(payrollEntries.classificationId, workerClassifications.id)).innerJoin(payrollWeeks, eq(payrollEntries.payrollWeekId, payrollWeeks.id));
    const filteredEntries2 = entryRows2.filter((r: typeof entryRows2[number]) => projectSet2.has(r.projectId));

    const allWeekRows2 = await db.select({ id: payrollWeeks.id, projectId: payrollWeeks.projectId, weekEndingDate: payrollWeeks.weekEndingDate, submittedAt: payrollWeeks.submittedAt }).from(payrollWeeks);
    const filteredWeeks2 = allWeekRows2.filter((w: typeof allWeekRows2[number]) => projectSet2.has(w.projectId));

    const workerRows2 = await db.select({ projectId: workers.projectId, addressState: workers.addressState }).from(workers);
    const userWorkers2 = workerRows2.filter((w: typeof workerRows2[number]) => projectSet2.has(w.projectId));

    const craftWageMap2 = new Map<string, number>();
    const craftWorkerMap2 = new Map<string, Set<string>>();
    const craftProjectMap2 = new Map<string, Set<string>>();
    let totalWagesPaid2 = 0; let apprenticeWages2 = 0; let totalBaseWages2 = 0; let totalFringeWages2 = 0;
    for (const entry of filteredEntries2) {
      const wages = entry.grossWages ?? 0; const trade = entry.tradeDescription;
      craftWageMap2.set(trade, (craftWageMap2.get(trade) ?? 0) + wages);
      if (!craftWorkerMap2.has(trade)) craftWorkerMap2.set(trade, new Set());
      craftWorkerMap2.get(trade)!.add(entry.workerId);
      if (!craftProjectMap2.has(trade)) craftProjectMap2.set(trade, new Set());
      craftProjectMap2.get(trade)!.add(entry.projectId);
      totalWagesPaid2 += wages;
      if (entry.laborType === 'apprentice') apprenticeWages2 += wages;
      const stHours = (entry.monSt ?? 0) + (entry.tueSt ?? 0) + (entry.wedSt ?? 0) + (entry.thuSt ?? 0) + (entry.friSt ?? 0) + (entry.satSt ?? 0) + (entry.sunSt ?? 0);
      const otHours = (entry.monOt ?? 0) + (entry.tueOt ?? 0) + (entry.wedOt ?? 0) + (entry.thuOt ?? 0) + (entry.friOt ?? 0) + (entry.satOt ?? 0) + (entry.sunOt ?? 0);
      const totalHrs = stHours + otHours;
      totalBaseWages2 += totalHrs * (entry.baseRateSnapshot ?? 0);
      const fringeDisagg = (entry.fringeHealthWelfare ?? 0) + (entry.fringePension ?? 0) + (entry.fringeVacation ?? 0) + (entry.fringeTraining ?? 0);
      totalFringeWages2 += fringeDisagg > 0 ? fringeDisagg : totalHrs * (entry.fringeRateSnapshot ?? 0);
    }
    const totalWagesByCraft2 = Array.from(craftWageMap2.entries()).map(([trade, totalWages]) => ({ trade, totalWages: Math.round(totalWages * 100) / 100, workerCount: craftWorkerMap2.get(trade)?.size ?? 0, projectCount: craftProjectMap2.get(trade)?.size ?? 0 })).sort((a, b) => b.totalWages - a.totalWages);
    const apprenticePercent2 = totalWagesPaid2 > 0 ? Math.round((apprenticeWages2 / totalWagesPaid2) * 100) : 0;

    let localCount2 = 0;
    for (const w of userWorkers2) { if (w.addressState && projectStateMap2.get(w.projectId) && w.addressState.toLowerCase() === projectStateMap2.get(w.projectId)!.toLowerCase()) localCount2++; }
    const localHirePercent2 = userWorkers2.length > 0 ? Math.round((localCount2 / userWorkers2.length) * 100) : 0;

    const stateProjectMap2 = new Map<string, number>();
    for (const p of userProjects2) stateProjectMap2.set(p.state, (stateProjectMap2.get(p.state) ?? 0) + 1);
    const stateWorkerMap2 = new Map<string, number>(); const stateWageMap2 = new Map<string, number>();
    for (const w of userWorkers2) { const s = projectStateMap2.get(w.projectId); if (s) stateWorkerMap2.set(s, (stateWorkerMap2.get(s) ?? 0) + 1); }
    for (const entry of filteredEntries2) { const s = projectStateMap2.get(entry.projectId); if (s) stateWageMap2.set(s, (stateWageMap2.get(s) ?? 0) + (entry.grossWages ?? 0)); }
    const stateBreakdown2 = Array.from(stateProjectMap2.entries()).map(([state, projectCount]) => ({ state, projectCount, workerCount: stateWorkerMap2.get(state) ?? 0, totalWages: Math.round((stateWageMap2.get(state) ?? 0) * 100) / 100 })).sort((a, b) => b.projectCount - a.projectCount);

    const now2 = new Date(); const todayStr2 = now2.toISOString().slice(0, 10);
    const weekBuckets2: { weekLabel: string; weekEnd: string; violations: number; compliant: number }[] = [];
    for (let i = 11; i >= 0; i--) { const d = new Date(now2); d.setDate(d.getDate() - i * 7); weekBuckets2.push({ weekLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), weekEnd: d.toISOString().slice(0, 10), violations: 0, compliant: 0 }); }
    const window12Start2 = weekBuckets2[0].weekEnd;
    for (const week of filteredWeeks2) {
      if (week.weekEndingDate < window12Start2) continue;
      let bestIdx = 0; let bestDiff = Infinity;
      for (let i = 0; i < weekBuckets2.length; i++) { const diff = Math.abs(new Date(week.weekEndingDate).getTime() - new Date(weekBuckets2[i].weekEnd).getTime()); if (diff < bestDiff) { bestDiff = diff; bestIdx = i; } }
      if (week.submittedAt) { weekBuckets2[bestIdx].compliant += 1; } else if (week.weekEndingDate < todayStr2) { weekBuckets2[bestIdx].violations += 1; }
    }
    const complianceTrend2 = weekBuckets2.map(({ weekLabel, violations, compliant }) => ({ weekLabel, violations, compliant }));

    const projectViolationMap2 = new Map<string, { count: number; lastDate: string }>();
    for (const week of filteredWeeks2) { if (!week.submittedAt && week.weekEndingDate < todayStr2) { const ex = projectViolationMap2.get(week.projectId); if (!ex) { projectViolationMap2.set(week.projectId, { count: 1, lastDate: week.weekEndingDate }); } else { ex.count += 1; if (week.weekEndingDate > ex.lastDate) ex.lastDate = week.weekEndingDate; } } }
    const topViolatingProjects2 = Array.from(projectViolationMap2.entries()).map(([projectId, { count, lastDate }]) => ({ projectId, projectName: projectNameMap2.get(projectId) ?? projectId, violations: count, lastViolation: lastDate })).sort((a, b) => b.violations - a.violations).slice(0, 5);

    const tradeRateMap2 = new Map<string, number[]>();
    for (const entry of filteredEntries2) { const rate = entry.baseRateSnapshot ?? 0; if (rate === 0) continue; if (!tradeRateMap2.has(entry.tradeDescription)) tradeRateMap2.set(entry.tradeDescription, []); tradeRateMap2.get(entry.tradeDescription)!.push(rate); }
    const wageVarianceByTrade2 = Array.from(tradeRateMap2.entries()).map(([trade, rates]) => { const avg = rates.reduce((s, r) => s + r, 0) / rates.length; const min = Math.min(...rates); const max = Math.max(...rates); const dev = Math.sqrt(rates.reduce((s, r) => s + Math.pow(r - avg, 2), 0) / rates.length); return { trade, avgRate: Math.round(avg * 100) / 100, minRate: Math.round(min * 100) / 100, maxRate: Math.round(max * 100) / 100, deviation: Math.round(dev * 100) / 100 }; }).sort((a, b) => b.deviation - a.deviation);

    const projectOtMap2 = new Map<string, { dtHours: number; otHours: number; premiumCost: number }>();
    for (const entry of filteredEntries2) { if (!projectOtMap2.has(entry.projectId)) projectOtMap2.set(entry.projectId, { dtHours: 0, otHours: 0, premiumCost: 0 }); const rec = projectOtMap2.get(entry.projectId)!; const otHrs = (entry.monOt ?? 0) + (entry.tueOt ?? 0) + (entry.wedOt ?? 0) + (entry.thuOt ?? 0) + (entry.friOt ?? 0) + (entry.satOt ?? 0) + (entry.sunOt ?? 0); const dtHrs = (entry.monDt ?? 0) + (entry.tueDt ?? 0) + (entry.wedDt ?? 0) + (entry.thuDt ?? 0) + (entry.friDt ?? 0) + (entry.satDt ?? 0) + (entry.sunDt ?? 0); const base = entry.baseRateSnapshot ?? 0; rec.otHours += otHrs; rec.dtHours += dtHrs; rec.premiumCost += (otHrs * base * 0.5) + (dtHrs * base * 1.0); }
    const overtimeExposure2 = Array.from(projectOtMap2.entries()).filter(([, rec]) => rec.otHours > 0 || rec.dtHours > 0).map(([projectId, rec]) => ({ projectId, projectName: projectNameMap2.get(projectId) ?? projectId, dtHours: Math.round(rec.dtHours * 100) / 100, otHours: Math.round(rec.otHours * 100) / 100, estimatedPremium: Math.round(rec.premiumCost * 100) / 100 })).sort((a, b) => b.estimatedPremium - a.estimatedPremium).slice(0, 10);

    const tradeRequiredPct2 = new Map<string, number>();
    for (const p of userProjects2) { if (!p.apprenticeshipRequirements) continue; try { const reqs = JSON.parse(p.apprenticeshipRequirements) as Record<string, { maxRatio: string }>; for (const [trade, req] of Object.entries(reqs)) { if (!req?.maxRatio) continue; const [num, denom] = req.maxRatio.split(':').map(Number); if (!isNaN(num) && !isNaN(denom) && denom > 0) tradeRequiredPct2.set(trade, Math.max(tradeRequiredPct2.get(trade) ?? 0, (num / (num + denom)) * 100)); } } catch { /* ignore */ } }
    const tradeApprenticeHours2 = new Map<string, number>(); const tradeTotalHours2 = new Map<string, number>();
    for (const entry of filteredEntries2) { const stH = (entry.monSt ?? 0) + (entry.tueSt ?? 0) + (entry.wedSt ?? 0) + (entry.thuSt ?? 0) + (entry.friSt ?? 0) + (entry.satSt ?? 0) + (entry.sunSt ?? 0); const otH = (entry.monOt ?? 0) + (entry.tueOt ?? 0) + (entry.wedOt ?? 0) + (entry.thuOt ?? 0) + (entry.friOt ?? 0) + (entry.satOt ?? 0) + (entry.sunOt ?? 0); const hrs = stH + otH; tradeTotalHours2.set(entry.tradeDescription, (tradeTotalHours2.get(entry.tradeDescription) ?? 0) + hrs); if (entry.laborType === 'apprentice') tradeApprenticeHours2.set(entry.tradeDescription, (tradeApprenticeHours2.get(entry.tradeDescription) ?? 0) + hrs); }
    const apprenticeshipProgress2 = Array.from(tradeTotalHours2.entries()).map(([trade, totalHrs]) => { const appHrs = tradeApprenticeHours2.get(trade) ?? 0; const required = tradeRequiredPct2.get(trade) ?? 25; const actual = totalHrs > 0 ? Math.round((appHrs / totalHrs) * 100) : 0; return { trade, required: Math.round(required), actual, gap: Math.max(0, Math.round(required) - actual) }; }).sort((a, b) => b.gap - a.gap);

    let onTime2 = 0; let late2 = 0; let missing2 = 0;
    for (const week of filteredWeeks2) { if (week.weekEndingDate >= todayStr2) continue; if (!week.submittedAt) { missing2 += 1; } else { const dL = (new Date(week.submittedAt).getTime() - new Date(week.weekEndingDate).getTime()) / (1000 * 60 * 60 * 24); if (dL <= 7) { onTime2 += 1; } else { late2 += 1; } } }
    const totalSub2 = onTime2 + late2 + missing2;
    const submissionPunctuality2 = { onTime: onTime2, late: late2, missing: missing2, percentOnTime: totalSub2 > 0 ? Math.round((onTime2 / totalSub2) * 100) : 0 };

    const wageBurnBuckets2: { weekLabel: string; weekEnd: string; wages: number; workerSet: Set<string> }[] = [];
    for (let i = 11; i >= 0; i--) { const d = new Date(now2); d.setDate(d.getDate() - i * 7); wageBurnBuckets2.push({ weekLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), weekEnd: d.toISOString().slice(0, 10), wages: 0, workerSet: new Set() }); }
    for (const entry of filteredEntries2) { if (entry.weekEndingDate < window12Start2) continue; let bestIdx = 0; let bestDiff = Infinity; for (let i = 0; i < wageBurnBuckets2.length; i++) { const diff = Math.abs(new Date(entry.weekEndingDate).getTime() - new Date(wageBurnBuckets2[i].weekEnd).getTime()); if (diff < bestDiff) { bestDiff = diff; bestIdx = i; } } wageBurnBuckets2[bestIdx].wages += entry.grossWages ?? 0; wageBurnBuckets2[bestIdx].workerSet.add(entry.workerId); }
    const weeklyWageBurn2 = wageBurnBuckets2.map(({ weekLabel, wages, workerSet }) => ({ weekLabel, wages: Math.round(wages * 100) / 100, workers: workerSet.size }));

    const fringePercent2 = (totalBaseWages2 + totalFringeWages2) > 0 ? Math.round((totalFringeWages2 / (totalBaseWages2 + totalFringeWages2)) * 100) : 0;
    const fringeVsBaseWage2 = { fringe: Math.round(totalFringeWages2 * 100) / 100, base: Math.round(totalBaseWages2 * 100) / 100, fringePercent: fringePercent2 };

    const projectWagesMap2 = new Map<string, number>(); const projectWorkersMap2 = new Map<string, Set<string>>();
    for (const entry of filteredEntries2) { projectWagesMap2.set(entry.projectId, (projectWagesMap2.get(entry.projectId) ?? 0) + (entry.grossWages ?? 0)); if (!projectWorkersMap2.has(entry.projectId)) projectWorkersMap2.set(entry.projectId, new Set()); projectWorkersMap2.get(entry.projectId)!.add(entry.workerId); }
    const projectWeekCountMap2 = new Map<string, number>(); const projectSubmittedCountMap2 = new Map<string, number>();
    for (const week of filteredWeeks2) { projectWeekCountMap2.set(week.projectId, (projectWeekCountMap2.get(week.projectId) ?? 0) + 1); if (week.submittedAt) projectSubmittedCountMap2.set(week.projectId, (projectSubmittedCountMap2.get(week.projectId) ?? 0) + 1); }
    const projectRankings2 = Array.from(projectWagesMap2.entries()).map(([projectId, totalWages]) => { const wc = projectWeekCountMap2.get(projectId) ?? 0; const sc = projectSubmittedCountMap2.get(projectId) ?? 0; return { projectId, projectName: projectNameMap2.get(projectId) ?? projectId, totalWages: Math.round(totalWages * 100) / 100, workers: projectWorkersMap2.get(projectId)?.size ?? 0, compliance: wc > 0 ? Math.round((sc / wc) * 100) : 100 }; }).sort((a, b) => b.totalWages - a.totalWages).slice(0, 10);

    return { totalWagesByCraft: totalWagesByCraft2, localHirePercent: localHirePercent2, apprenticePercent: apprenticePercent2, stateBreakdown: stateBreakdown2, totalWagesPaid: Math.round(totalWagesPaid2 * 100) / 100, complianceTrend: complianceTrend2, topViolatingProjects: topViolatingProjects2, wageVarianceByTrade: wageVarianceByTrade2, overtimeExposure: overtimeExposure2, apprenticeshipProgress: apprenticeshipProgress2, submissionPunctuality: submissionPunctuality2, weeklyWageBurn: weeklyWageBurn2, fringeVsBaseWage: fringeVsBaseWage2, projectRankings: projectRankings2 };
  }

  // Run all independent sub-queries in parallel; failing ones fall back to safe defaults
  const complianceSummaryResult = await Promise.allSettled([getComplianceSummary()]);
  const complianceSummary = complianceSummaryResult[0].status === 'fulfilled' ? complianceSummaryResult[0].value : [];

  const [
    mfaResult,
    teamResult,
    projectsResult,
    statsResult,
    actionsResult,
    onboardingResult,
    trendResult,
    atRiskResult,
    economicResult,
  ] = await Promise.allSettled([
    getMfaStatus(),
    getTeam(),
    getProjects(),
    getStats(complianceSummary),
    getContractorActions(),
    getOnboarding(),
    getComplianceTrend(),
    getAtRisk(),
    getEconomicImpact(),
  ]);

  res.json({
    mfaStatus: mfaResult.status === 'fulfilled' ? mfaResult.value : { enabled: false, backupCodesRemaining: 0 },
    team: teamResult.status === 'fulfilled' ? teamResult.value : { isOwner: false },
    projects: projectsResult.status === 'fulfilled' ? projectsResult.value : [],
    complianceSummary: complianceSummary,
    stats: statsResult.status === 'fulfilled' ? statsResult.value : { activeProjects: 0, openViolations: 0, weeksDueThisWeek: 0 },
    contractorActions: actionsResult.status === 'fulfilled' ? actionsResult.value : [],
    onboarding: onboardingResult.status === 'fulfilled' ? onboardingResult.value : { data: { user: { companyName: null, hccMembershipNumber: null }, profile: null } },
    complianceTrend: trendResult.status === 'fulfilled' ? trendResult.value : [],
    atRisk: atRiskResult.status === 'fulfilled' ? atRiskResult.value : [],
    economicImpact: economicResult.status === 'fulfilled' ? { data: economicResult.value } : { data: null },
  });
});
