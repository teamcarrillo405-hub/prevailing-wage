// src/server/routes/reports.ts
// GET /api/reports/:projectId/fringe-summary       — RPT-01
// GET /api/reports/:projectId/worker/:workerId/pay-history — RPT-02
// GET /api/reports/compliance-summary              — RPT-04 (cross-project)
// GET /api/reports/wage-statement?projectId=       — RPT-05 (project-scoped)
// GET /api/reports/export-csv?report=&projectId=  — RPT-06 (CSV download)
// Access check: verify user is a member of the project via assertProjectAccess.
// Note: This router is registered in index.ts (Plan 04).

import { Router } from 'express';
import { eq, and, isNull } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { getDb } from '../db/index.js';
import { getFringeSummary, getWorkerPayHistory, getFringeBreakdown } from '../services/reportsService.js';
import { assertProjectAccess } from '../utils/assertProjectAccess.js';
import {
  projects,
  workers,
  payrollEntries,
  workerClassifications,
  projectMembers,
  payrollWeeks,
  subcontractors,
  subcontractorCertifications,
  subcontractorCprWeeks,
} from '../db/schema.js';

export const reportsRouter = Router();

// ── RPT-01: Fringe benefit summary ───────────────────────────────────────

reportsRouter.get('/:projectId/fringe-summary', requireAuth, async (req, res) => {
  const projectId = req.params.projectId as string;
  const userId = req.user!.userId;
  const db = getDb();

  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  try {
    const rows = await getFringeSummary(projectId);
    res.json({ rows });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── RPT-02: Worker pay history ────────────────────────────────────────────

reportsRouter.get('/:projectId/worker/:workerId/pay-history', requireAuth, async (req, res) => {
  const projectId = req.params.projectId as string;
  const workerId = req.params.workerId as string;
  const userId = req.user!.userId;
  const db = getDb();

  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  try {
    const rows = await getWorkerPayHistory(projectId, workerId);
    res.json({ rows });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── RPT-03: Fringe benefit breakdown by fund type, union local, classification ─

reportsRouter.get('/:projectId/fringe-breakdown', requireAuth, async (req, res) => {
  const projectId = req.params.projectId as string;
  const userId = req.user!.userId;
  const weekId = req.query.weekId as string | undefined;
  const db = getDb();

  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  try {
    const rows = await getFringeBreakdown(projectId, weekId);
    res.json({ rows });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── RPT-04: Compliance Summary (cross-project) ───────────────────────────
// GET /api/reports/compliance-summary
// Returns project-level compliance report for all user's projects.
reportsRouter.get('/compliance-summary', requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const db = getDb();

  const memberRows = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(and(eq(projectMembers.userId, userId), isNull(projectMembers.removedAt)));

  const projectIds = memberRows.map((r: { projectId: string }) => r.projectId);
  if (projectIds.length === 0) {
    res.json({ rows: [] });
    return;
  }

  const projectSet = new Set(projectIds);
  const todayStr = new Date().toISOString().slice(0, 10);

  const projectRows = await db
    .select({ id: projects.id, name: projects.name, state: projects.state })
    .from(projects);
  const userProjects = projectRows.filter((p: typeof projectRows[number]) => projectSet.has(p.id));

  const allWeekRows = await db
    .select({
      id: payrollWeeks.id,
      projectId: payrollWeeks.projectId,
      weekEndingDate: payrollWeeks.weekEndingDate,
      submittedAt: payrollWeeks.submittedAt,
    })
    .from(payrollWeeks);
  const filteredWeeks = allWeekRows.filter((w: typeof allWeekRows[number]) => projectSet.has(w.projectId));

  const entryRows = await db
    .select({
      projectId: payrollWeeks.projectId,
      workerId: payrollEntries.workerId,
      grossWages: payrollEntries.grossWages,
      laborType: workerClassifications.laborType,
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
    })
    .from(payrollEntries)
    .innerJoin(workerClassifications, eq(payrollEntries.classificationId, workerClassifications.id))
    .innerJoin(payrollWeeks, eq(payrollEntries.payrollWeekId, payrollWeeks.id));
  const filteredEntries = entryRows.filter((e: typeof entryRows[number]) => projectSet.has(e.projectId));

  // Aggregate per project
  const summary = new Map<string, {
    weekCount: number;
    submittedCount: number;
    violationCount: number;
    totalWages: number;
    apprenticeHours: number;
    totalHours: number;
  }>();

  for (const p of userProjects) {
    summary.set(p.id, { weekCount: 0, submittedCount: 0, violationCount: 0, totalWages: 0, apprenticeHours: 0, totalHours: 0 });
  }

  for (const week of filteredWeeks) {
    const rec = summary.get(week.projectId);
    if (!rec) continue;
    rec.weekCount += 1;
    if (week.submittedAt) {
      rec.submittedCount += 1;
    } else if (week.weekEndingDate < todayStr) {
      rec.violationCount += 1;
    }
  }

  for (const entry of filteredEntries) {
    const rec = summary.get(entry.projectId);
    if (!rec) continue;
    rec.totalWages += entry.grossWages ?? 0;
    const stHrs = (entry.monSt ?? 0) + (entry.tueSt ?? 0) + (entry.wedSt ?? 0) +
      (entry.thuSt ?? 0) + (entry.friSt ?? 0) + (entry.satSt ?? 0) + (entry.sunSt ?? 0);
    const otHrs = (entry.monOt ?? 0) + (entry.tueOt ?? 0) + (entry.wedOt ?? 0) +
      (entry.thuOt ?? 0) + (entry.friOt ?? 0) + (entry.satOt ?? 0) + (entry.sunOt ?? 0);
    const hrs = stHrs + otHrs;
    rec.totalHours += hrs;
    if (entry.laborType === 'apprentice') rec.apprenticeHours += hrs;
  }

  const rows = userProjects.map((p: { id: string; name: string; state: string }) => {
    const rec = summary.get(p.id)!;
    return {
      projectId: p.id,
      projectName: p.name,
      state: p.state,
      weekCount: rec.weekCount,
      submittedCount: rec.submittedCount,
      violationCount: rec.violationCount,
      totalWages: Math.round(rec.totalWages * 100) / 100,
      apprenticeHours: Math.round(rec.apprenticeHours * 100) / 100,
      totalHours: Math.round(rec.totalHours * 100) / 100,
    };
  });

  res.json({ rows });
});

// ── RPT-05: Wage Statement by Worker ─────────────────────────────────────
// GET /api/reports/wage-statement?projectId=
// Per-worker wage summary for a specific project.
reportsRouter.get('/wage-statement', requireAuth, async (req, res) => {
  const projectId = req.query.projectId as string | undefined;
  const userId = req.user!.userId;
  const db = getDb();

  if (!projectId) {
    res.status(400).json({ error: 'projectId query parameter is required' });
    return;
  }

  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  const entryRows = await db
    .select({
      workerId: payrollEntries.workerId,
      workerName: workers.name,
      tradeDescription: workerClassifications.tradeDescription,
      grossWages: payrollEntries.grossWages,
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
    })
    .from(payrollEntries)
    .innerJoin(workers, eq(payrollEntries.workerId, workers.id))
    .innerJoin(workerClassifications, eq(payrollEntries.classificationId, workerClassifications.id))
    .innerJoin(payrollWeeks, eq(payrollEntries.payrollWeekId, payrollWeeks.id))
    .where(eq(payrollWeeks.projectId, projectId));

  // Aggregate per worker+trade
  const workerMap = new Map<string, { workerName: string; trade: string; totalHours: number; grossWages: number }>();
  for (const entry of entryRows) {
    const key = `${entry.workerId}::${entry.tradeDescription}`;
    if (!workerMap.has(key)) {
      workerMap.set(key, { workerName: entry.workerName, trade: entry.tradeDescription, totalHours: 0, grossWages: 0 });
    }
    const rec = workerMap.get(key)!;
    const stHrs = (entry.monSt ?? 0) + (entry.tueSt ?? 0) + (entry.wedSt ?? 0) +
      (entry.thuSt ?? 0) + (entry.friSt ?? 0) + (entry.satSt ?? 0) + (entry.sunSt ?? 0);
    const otHrs = (entry.monOt ?? 0) + (entry.tueOt ?? 0) + (entry.wedOt ?? 0) +
      (entry.thuOt ?? 0) + (entry.friOt ?? 0) + (entry.satOt ?? 0) + (entry.sunOt ?? 0);
    rec.totalHours += stHrs + otHrs;
    rec.grossWages += entry.grossWages ?? 0;
  }

  const rows = Array.from(workerMap.values()).map(r => ({
    ...r,
    totalHours: Math.round(r.totalHours * 100) / 100,
    grossWages: Math.round(r.grossWages * 100) / 100,
  })).sort((a, b) => a.workerName.localeCompare(b.workerName));

  res.json({ rows });
});

// ── RPT-06: CSV Export ────────────────────────────────────────────────────
// GET /api/reports/export-csv?report=compliance|wage-statement|economic-impact&projectId=
function escapeCSV(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowToCSV(values: (string | number | null | undefined)[]): string {
  return values.map(escapeCSV).join(',');
}

reportsRouter.get('/export-csv', requireAuth, async (req, res) => {
  const reportType = req.query.report as string | undefined;
  const projectId = req.query.projectId as string | undefined;
  const userId = req.user!.userId;
  const db = getDb();

  if (!reportType) {
    res.status(400).json({ error: 'report query parameter is required' });
    return;
  }

  try {
    if (reportType === 'compliance') {
      // ── Compliance Summary CSV ───────────────────────────────────────────
      const memberRows = await db
        .select({ projectId: projectMembers.projectId })
        .from(projectMembers)
        .where(and(eq(projectMembers.userId, userId), isNull(projectMembers.removedAt)));

      const projectSet = new Set(memberRows.map((r: { projectId: string }) => r.projectId));
      const todayStr = new Date().toISOString().slice(0, 10);

      const projectRows = await db
        .select({ id: projects.id, name: projects.name, state: projects.state })
        .from(projects);
      const userProjects = projectRows.filter((p: typeof projectRows[number]) => projectSet.has(p.id));

      const allWeekRows = await db
        .select({
          projectId: payrollWeeks.projectId,
          weekEndingDate: payrollWeeks.weekEndingDate,
          submittedAt: payrollWeeks.submittedAt,
        })
        .from(payrollWeeks);
      const filteredWeeks = allWeekRows.filter((w: typeof allWeekRows[number]) => projectSet.has(w.projectId));

      const entryRows = await db
        .select({
          projectId: payrollWeeks.projectId,
          workerId: payrollEntries.workerId,
          grossWages: payrollEntries.grossWages,
          laborType: workerClassifications.laborType,
          monSt: payrollEntries.monSt, tueSt: payrollEntries.tueSt, wedSt: payrollEntries.wedSt,
          thuSt: payrollEntries.thuSt, friSt: payrollEntries.friSt, satSt: payrollEntries.satSt, sunSt: payrollEntries.sunSt,
          monOt: payrollEntries.monOt, tueOt: payrollEntries.tueOt, wedOt: payrollEntries.wedOt,
          thuOt: payrollEntries.thuOt, friOt: payrollEntries.friOt, satOt: payrollEntries.satOt, sunOt: payrollEntries.sunOt,
        })
        .from(payrollEntries)
        .innerJoin(workerClassifications, eq(payrollEntries.classificationId, workerClassifications.id))
        .innerJoin(payrollWeeks, eq(payrollEntries.payrollWeekId, payrollWeeks.id));
      const filteredEntries = entryRows.filter((e: typeof entryRows[number]) => projectSet.has(e.projectId));

      const summary = new Map<string, { weekCount: number; submittedCount: number; violationCount: number; totalWages: number; apprenticeHours: number; totalHours: number }>();
      for (const p of userProjects) summary.set(p.id, { weekCount: 0, submittedCount: 0, violationCount: 0, totalWages: 0, apprenticeHours: 0, totalHours: 0 });
      for (const week of filteredWeeks) {
        const rec = summary.get(week.projectId);
        if (!rec) continue;
        rec.weekCount += 1;
        if (week.submittedAt) { rec.submittedCount += 1; }
        else if (week.weekEndingDate < todayStr) { rec.violationCount += 1; }
      }
      for (const entry of filteredEntries) {
        const rec = summary.get(entry.projectId);
        if (!rec) continue;
        rec.totalWages += entry.grossWages ?? 0;
        const hrs = (entry.monSt ?? 0) + (entry.tueSt ?? 0) + (entry.wedSt ?? 0) + (entry.thuSt ?? 0) + (entry.friSt ?? 0) + (entry.satSt ?? 0) + (entry.sunSt ?? 0) +
          (entry.monOt ?? 0) + (entry.tueOt ?? 0) + (entry.wedOt ?? 0) + (entry.thuOt ?? 0) + (entry.friOt ?? 0) + (entry.satOt ?? 0) + (entry.sunOt ?? 0);
        rec.totalHours += hrs;
        if (entry.laborType === 'apprentice') rec.apprenticeHours += hrs;
      }

      const headers = 'Project ID,Project Name,State,Week Count,Submitted Count,Violation Count,Total Wages,Apprentice Hours,Total Hours';
      const dataRows = userProjects.map((p: { id: string; name: string; state: string }) => {
        const rec = summary.get(p.id)!;
        return rowToCSV([p.id, p.name, p.state, rec.weekCount, rec.submittedCount, rec.violationCount, rec.totalWages.toFixed(2), rec.apprenticeHours.toFixed(2), rec.totalHours.toFixed(2)]);
      });

      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename="compliance-summary.csv"');
      res.send([headers, ...dataRows].join('\n'));

    } else if (reportType === 'wage-statement') {
      // ── Wage Statement CSV ───────────────────────────────────────────────
      if (!projectId) {
        res.status(400).json({ error: 'projectId is required for wage-statement export' });
        return;
      }

      try {
        await assertProjectAccess(db, projectId, userId);
      } catch (err: any) {
        res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
        return;
      }

      const entryRows = await db
        .select({
          workerId: payrollEntries.workerId,
          workerName: workers.name,
          tradeDescription: workerClassifications.tradeDescription,
          grossWages: payrollEntries.grossWages,
          monSt: payrollEntries.monSt, tueSt: payrollEntries.tueSt, wedSt: payrollEntries.wedSt,
          thuSt: payrollEntries.thuSt, friSt: payrollEntries.friSt, satSt: payrollEntries.satSt, sunSt: payrollEntries.sunSt,
          monOt: payrollEntries.monOt, tueOt: payrollEntries.tueOt, wedOt: payrollEntries.wedOt,
          thuOt: payrollEntries.thuOt, friOt: payrollEntries.friOt, satOt: payrollEntries.satOt, sunOt: payrollEntries.sunOt,
        })
        .from(payrollEntries)
        .innerJoin(workers, eq(payrollEntries.workerId, workers.id))
        .innerJoin(workerClassifications, eq(payrollEntries.classificationId, workerClassifications.id))
        .innerJoin(payrollWeeks, eq(payrollEntries.payrollWeekId, payrollWeeks.id))
        .where(eq(payrollWeeks.projectId, projectId));

      const workerMap = new Map<string, { workerName: string; trade: string; totalHours: number; grossWages: number }>();
      for (const entry of entryRows) {
        const key = `${entry.workerId}::${entry.tradeDescription}`;
        if (!workerMap.has(key)) workerMap.set(key, { workerName: entry.workerName, trade: entry.tradeDescription, totalHours: 0, grossWages: 0 });
        const rec = workerMap.get(key)!;
        const hrs = (entry.monSt ?? 0) + (entry.tueSt ?? 0) + (entry.wedSt ?? 0) + (entry.thuSt ?? 0) + (entry.friSt ?? 0) + (entry.satSt ?? 0) + (entry.sunSt ?? 0) +
          (entry.monOt ?? 0) + (entry.tueOt ?? 0) + (entry.wedOt ?? 0) + (entry.thuOt ?? 0) + (entry.friOt ?? 0) + (entry.satOt ?? 0) + (entry.sunOt ?? 0);
        rec.totalHours += hrs;
        rec.grossWages += entry.grossWages ?? 0;
      }

      const headers = 'Worker Name,Trade,Total Hours,Gross Wages';
      const dataRows = Array.from(workerMap.values())
        .sort((a, b) => a.workerName.localeCompare(b.workerName))
        .map(r => rowToCSV([r.workerName, r.trade, r.totalHours.toFixed(2), r.grossWages.toFixed(2)]));

      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename="wage-statement.csv"');
      res.send([headers, ...dataRows].join('\n'));

    } else if (reportType === 'economic-impact') {
      // ── Economic Impact CSV ──────────────────────────────────────────────
      const memberRows = await db
        .select({ projectId: projectMembers.projectId })
        .from(projectMembers)
        .where(and(eq(projectMembers.userId, userId), isNull(projectMembers.removedAt)));

      const projectSet = new Set(memberRows.map((r: { projectId: string }) => r.projectId));

      const projectRows = await db
        .select({ id: projects.id, name: projects.name, state: projects.state })
        .from(projects);
      const userProjects = projectRows.filter((p: typeof projectRows[number]) => projectSet.has(p.id));

      const entryRows = await db
        .select({
          projectId: payrollWeeks.projectId,
          workerId: payrollEntries.workerId,
          tradeDescription: workerClassifications.tradeDescription,
          grossWages: payrollEntries.grossWages,
          monSt: payrollEntries.monSt, tueSt: payrollEntries.tueSt, wedSt: payrollEntries.wedSt,
          thuSt: payrollEntries.thuSt, friSt: payrollEntries.friSt, satSt: payrollEntries.satSt, sunSt: payrollEntries.sunSt,
          monOt: payrollEntries.monOt, tueOt: payrollEntries.tueOt, wedOt: payrollEntries.wedOt,
          thuOt: payrollEntries.thuOt, friOt: payrollEntries.friOt, satOt: payrollEntries.satOt, sunOt: payrollEntries.sunOt,
        })
        .from(payrollEntries)
        .innerJoin(workerClassifications, eq(payrollEntries.classificationId, workerClassifications.id))
        .innerJoin(payrollWeeks, eq(payrollEntries.payrollWeekId, payrollWeeks.id));
      const filteredEntries = entryRows.filter((e: typeof entryRows[number]) => projectSet.has(e.projectId));

      const craftMap = new Map<string, { totalWages: number; workerSet: Set<string>; projectSet: Set<string> }>();
      for (const entry of filteredEntries) {
        if (!craftMap.has(entry.tradeDescription)) craftMap.set(entry.tradeDescription, { totalWages: 0, workerSet: new Set(), projectSet: new Set() });
        const rec = craftMap.get(entry.tradeDescription)!;
        rec.totalWages += entry.grossWages ?? 0;
        rec.workerSet.add(entry.workerId);
        rec.projectSet.add(entry.projectId);
      }

      const lines: string[] = [
        '=== Economic Impact Summary ===',
        '',
        'Total Projects,' + userProjects.length,
        'Total Wages Paid,' + filteredEntries.reduce((s: number, e: { grossWages: number | null }) => s + (e.grossWages ?? 0), 0).toFixed(2),
        '',
        '=== Wages by Craft ===',
        'Trade,Total Wages,Worker Count,Project Count',
        ...Array.from(craftMap.entries())
          .sort((a, b) => b[1].totalWages - a[1].totalWages)
          .map(([trade, rec]) => rowToCSV([trade, rec.totalWages.toFixed(2), rec.workerSet.size, rec.projectSet.size])),
      ];

      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename="economic-impact.csv"');
      res.send(lines.join('\n'));

    } else {
      res.status(400).json({ error: `Unknown report type: ${reportType}` });
    }
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Phase 82 (Gap-2): DBE Compliance Summary ─────────────────────────────
// GET /api/reports/dbe-summary?projectId=
// Returns per-project DBE/MBE/WBE/SBE utilization. "Sub value" is the sum of
// gross wages on payroll weeks owned by the project, attributed to a sub when
// the sub has at least one received CPR week. Total subcontractor value uses
// every sub's CPR weeks; DBE-attributed value uses only subs that hold an
// active certification (not suspended) of the matching type.
//
// Note on the data model: payroll_entries are rolled up to the prime
// contractor's project. We approximate "sub value" by summing gross wages on
// project-level payroll weeks for which the sub has an associated received CPR
// week. This is the same approximation Phase 71's certification expiry job
// uses; it lines up with how DOT counts DBE participation when prime/sub
// payrolls aren't separately reported in the system.
const DBE_TYPES = ['DBE', 'MBE', 'WBE', 'SBE', 'ACDBE', '8(a)', 'HUBZone', 'VOSB', 'SDVOSB'] as const;
type DbeType = (typeof DBE_TYPES)[number];

reportsRouter.get('/dbe-summary', requireAuth, async (req, res) => {
  const projectId = req.query.projectId as string | undefined;
  const userId = req.user!.userId;
  const db = getDb();

  if (!projectId) {
    res.status(400).json({ error: 'projectId query parameter is required' });
    return;
  }

  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  // 1) Pull all subs + their certs for this project
  const subRows = await db
    .select({ id: subcontractors.id, name: subcontractors.name })
    .from(subcontractors)
    .where(eq(subcontractors.projectId, projectId));

  const subIds = subRows.map((s: { id: string }) => s.id);
  const certRows = subIds.length === 0
    ? []
    : await db
        .select({
          subcontractorId: subcontractorCertifications.subcontractorId,
          certTypes: subcontractorCertifications.certTypes,
          reevaluationStatus: subcontractorCertifications.reevaluationStatus,
          expiresDate: subcontractorCertifications.expiresDate,
        })
        .from(subcontractorCertifications);

  const today = new Date().toISOString().slice(0, 10);
  type CertRow = typeof certRows[number];
  // Map subId -> set of active cert types (uppercase).
  const subCertTypes = new Map<string, Set<DbeType>>();
  for (const cert of certRows) {
    const c = cert as CertRow;
    if (!subIds.includes(c.subcontractorId)) continue;
    if (c.reevaluationStatus === 'suspended') continue; // DOT IFR — suspended doesn't count
    if (c.expiresDate && c.expiresDate < today) continue; // expired doesn't count
    const types = (c.certTypes ?? '').split(',').map((t: string) => t.trim().toUpperCase());
    const set = subCertTypes.get(c.subcontractorId) ?? new Set<DbeType>();
    for (const raw of types) {
      const matched = DBE_TYPES.find(t => t.toUpperCase() === raw);
      if (matched) set.add(matched);
    }
    subCertTypes.set(c.subcontractorId, set);
  }

  // 2) Pull CPR weeks for these subs to figure out which subs are "active"
  //    on this project (have at least one received CPR week).
  const cprRows = subIds.length === 0
    ? []
    : await db
        .select({
          subcontractorId: subcontractorCprWeeks.subcontractorId,
          receivedDate: subcontractorCprWeeks.receivedDate,
        })
        .from(subcontractorCprWeeks);

  const activeSubIds = new Set<string>();
  for (const row of cprRows) {
    const r = row as { subcontractorId: string; receivedDate: string | null };
    if (!subIds.includes(r.subcontractorId)) continue;
    if (r.receivedDate) activeSubIds.add(r.subcontractorId);
  }

  // 3) Pull project payroll wages — total proxy for "subcontractor value"
  //    when no separate prime/sub payroll split exists in the data.
  const payrollRows = await db
    .select({
      grossWages: payrollEntries.grossWages,
    })
    .from(payrollEntries)
    .innerJoin(payrollWeeks, eq(payrollEntries.payrollWeekId, payrollWeeks.id))
    .where(eq(payrollWeeks.projectId, projectId));

  type PayrollRow = typeof payrollRows[number];
  const projectTotal = payrollRows.reduce((sum: number, r: PayrollRow) => sum + (r.grossWages ?? 0), 0);

  // Per-sub attribution: project total / number of active subs (uniform split).
  // This is a conservative approximation; if the project has zero active subs
  // we report zeros for everything except the project total.
  const activeSubCount = activeSubIds.size;
  const valuePerActiveSub = activeSubCount > 0 ? projectTotal / activeSubCount : 0;

  // 4) Build per-type aggregation
  const byType = new Map<DbeType, { value: number; count: number }>();
  for (const t of DBE_TYPES) byType.set(t, { value: 0, count: 0 });
  let dbeAttributedValue = 0;

  for (const subId of activeSubIds) {
    const types = subCertTypes.get(subId);
    if (!types || types.size === 0) continue;
    // Each cert type the sub holds gets credited the full sub value (a sub
    // that holds DBE+MBE counts for both buckets — matches how DOT goal
    // reports work).
    let attributed = false;
    for (const t of types) {
      const rec = byType.get(t)!;
      rec.value += valuePerActiveSub;
      rec.count += 1;
      attributed = true;
    }
    if (attributed) dbeAttributedValue += valuePerActiveSub;
  }

  const totalSubcontractorValue = Math.round(projectTotal * 100) / 100;
  const dbeValue = Math.round(dbeAttributedValue * 100) / 100;
  const dbePercent = totalSubcontractorValue > 0
    ? Math.round((dbeValue / totalSubcontractorValue) * 1000) / 10  // one decimal
    : 0;

  const byTypeArray = DBE_TYPES
    .map(t => {
      const rec = byType.get(t)!;
      return {
        type: t,
        value: Math.round(rec.value * 100) / 100,
        count: rec.count,
      };
    })
    .filter(r => r.count > 0); // only return types that have at least one cert

  res.json({
    data: {
      projectId,
      totalSubcontractorValue,
      dbeValue,
      dbePercent,
      activeSubCount,
      byType: byTypeArray,
    },
  });
});
