// Phase 75 — GPS Clock-In / Clock-Out routes (MOB-07)
import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { eq, and, desc, gte, lte, isNull } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { timePunches, workers, payrollWeeks } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { assertProjectAccess } from '../utils/assertProjectAccess.js';

const router = Router();
router.use(requireAuth);

const CreatePunchSchema = z.object({
  projectId: z.string().min(1),
  workerId: z.string().min(1),
  punchType: z.enum(['in', 'out']),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  accuracyMeters: z.number().optional(),
});

// POST /api/time-punches
router.post('/', async (req, res) => {
  const parsed = CreatePunchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    return;
  }

  const { projectId, workerId, punchType, latitude, longitude, accuracyMeters } = parsed.data;
  const userId = req.user!.userId;
  const db = getDb();

  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  // Verify worker belongs to this project
  const [worker] = await db
    .select({ id: workers.id })
    .from(workers)
    .where(and(eq(workers.id, workerId), eq(workers.projectId, projectId)))
    .limit(1);

  if (!worker) {
    res.status(404).json({ error: 'Worker not found in this project' });
    return;
  }

  const now = new Date().toISOString();
  const id = randomUUID();

  await db.insert(timePunches).values({
    id,
    projectId,
    workerId,
    punchType,
    punchedAt: now,
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    accuracyMeters: accuracyMeters ?? null,
    createdBy: userId,
    createdAt: now,
  });

  const [punch] = await db
    .select()
    .from(timePunches)
    .where(eq(timePunches.id, id))
    .limit(1);

  res.status(201).json({ data: { punch } });
});

// GET /api/time-punches?projectId=&workerId=&weekStart=&weekEnd=
router.get('/', async (req, res) => {
  const projectId = req.query.projectId as string | undefined;
  const workerId = req.query.workerId as string | undefined;
  const weekStart = req.query.weekStart as string | undefined;
  const weekEnd = req.query.weekEnd as string | undefined;
  const userId = req.user!.userId;
  const db = getDb();

  if (!projectId) {
    res.status(400).json({ error: 'projectId is required' });
    return;
  }

  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  const conditions = [eq(timePunches.projectId, projectId)];
  if (workerId) conditions.push(eq(timePunches.workerId, workerId));
  if (weekStart) conditions.push(gte(timePunches.punchedAt, weekStart));
  if (weekEnd) conditions.push(lte(timePunches.punchedAt, weekEnd + 'T23:59:59.999Z'));

  const punches = await db
    .select()
    .from(timePunches)
    .where(and(...conditions))
    .orderBy(desc(timePunches.punchedAt));

  res.json({ data: { punches } });
});

// GET /api/time-punches/open?projectId=&workerId=
// Returns the most recent 'in' punch that has no matching 'out' punch
router.get('/open', async (req, res) => {
  const projectId = req.query.projectId as string | undefined;
  const workerId = req.query.workerId as string | undefined;
  const userId = req.user!.userId;
  const db = getDb();

  if (!projectId || !workerId) {
    res.status(400).json({ error: 'projectId and workerId are required' });
    return;
  }

  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  // Get all punches for this worker/project ordered by time, find open clock-in
  const allPunches = await db
    .select()
    .from(timePunches)
    .where(
      and(
        eq(timePunches.projectId, projectId),
        eq(timePunches.workerId, workerId),
      ),
    )
    .orderBy(desc(timePunches.punchedAt));

  // The most recent punch determines state. If it's 'in', the worker is clocked in.
  const mostRecent = allPunches[0] ?? null;
  const openPunch = mostRecent?.punchType === 'in' ? mostRecent : null;

  res.json({ data: { openPunch } });
});

// DELETE /api/time-punches/:id
router.delete('/:id', async (req, res) => {
  const punchId = req.params.id;
  const userId = req.user!.userId;
  const db = getDb();

  const [punch] = await db
    .select()
    .from(timePunches)
    .where(eq(timePunches.id, punchId))
    .limit(1);

  if (!punch) {
    res.status(404).json({ error: 'Punch not found' });
    return;
  }

  try {
    await assertProjectAccess(db, punch.projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  await db.delete(timePunches).where(eq(timePunches.id, punchId));

  res.json({ data: { message: 'Punch deleted' } });
});

export default router;

// ── Phase 76: Fill-from-Punches route ─────────────────────────────────────
// Mounted separately at /api/projects in index.ts
// POST /api/projects/:projectId/weeks/:weekId/fill-from-punches
// Returns suggested payroll hours derived from clock-in/out punch pairs.
// Does NOT write to the database — caller confirms before committing.
export const fillFromPunchesRouter = Router();
fillFromPunchesRouter.use(requireAuth);

const DAY_KEYS = ['monSt', 'tueSt', 'wedSt', 'thuSt', 'friSt', 'satSt', 'sunSt'] as const;

fillFromPunchesRouter.post('/:projectId/weeks/:weekId/fill-from-punches', async (req, res) => {
  const { projectId, weekId } = req.params as { projectId: string; weekId: string };
  const userId = req.user!.userId;
  const db = getDb();

  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  // Fetch the week to get its date range (week ending date → derive Monday)
  const [week] = await db
    .select()
    .from(payrollWeeks)
    .where(and(eq(payrollWeeks.id, weekId), eq(payrollWeeks.projectId, projectId)))
    .limit(1);

  if (!week) {
    res.status(404).json({ error: 'Payroll week not found' });
    return;
  }

  // Week ending date is Sunday; derive Monday (weekStart = weekEnd - 6 days)
  const weekEndDate = new Date(week.weekEndingDate + 'T00:00:00Z');
  const weekStartDate = new Date(weekEndDate);
  weekStartDate.setUTCDate(weekStartDate.getUTCDate() - 6);
  const weekStart = weekStartDate.toISOString().slice(0, 10);
  const weekEnd = week.weekEndingDate;

  // Pull all punches for this project in the week window
  const punches = await db
    .select()
    .from(timePunches)
    .where(
      and(
        eq(timePunches.projectId, projectId),
        gte(timePunches.punchedAt, weekStart),
        lte(timePunches.punchedAt, weekEnd + 'T23:59:59.999Z'),
      ),
    )
    .orderBy(timePunches.workerId, timePunches.punchedAt);

  // Build a map of workerId → name from all workers in project
  const allWorkers = await db
    .select({ id: workers.id, name: workers.name })
    .from(workers)
    .where(eq(workers.projectId, projectId));

  const workerMap = new Map<string, string>();
  for (const w of allWorkers) {
    workerMap.set(w.id, w.name);
  }

  // Group punches by workerId
  const punchesByWorker = new Map<string, typeof punches>();
  for (const p of punches) {
    if (!punchesByWorker.has(p.workerId)) punchesByWorker.set(p.workerId, []);
    punchesByWorker.get(p.workerId)!.push(p);
  }

  interface SuggestedEntry {
    date: string;
    dayKey: typeof DAY_KEYS[number];
    regularHours: number;
  }

  interface WorkerSuggestion {
    workerId: string;
    workerName: string;
    entries: SuggestedEntry[];
    totalHours: number;
    punchPairs: number;
  }

  const suggestions: WorkerSuggestion[] = [];
  let totalPunchPairs = 0;

  for (const [workerId, workerPunches] of punchesByWorker) {
    // Sort chronologically
    const sorted = [...workerPunches].sort(
      (a, b) => new Date(a.punchedAt).getTime() - new Date(b.punchedAt).getTime(),
    );

    // Pair in/out punches and accumulate hours per calendar date
    const hoursByDate = new Map<string, number>();
    let pairCount = 0;
    let i = 0;
    while (i < sorted.length) {
      const punch = sorted[i];
      if (punch.punchType === 'in') {
        // Find the next 'out' punch after this 'in'
        let outIdx = -1;
        for (let j = i + 1; j < sorted.length; j++) {
          if (sorted[j].punchType === 'out') { outIdx = j; break; }
        }
        if (outIdx !== -1) {
          const outPunch = sorted[outIdx];
          const inTime = new Date(punch.punchedAt).getTime();
          const outTime = new Date(outPunch.punchedAt).getTime();
          const hours = Math.max(0, (outTime - inTime) / 3_600_000);
          const dateKey = punch.punchedAt.slice(0, 10); // YYYY-MM-DD of clock-in
          hoursByDate.set(dateKey, (hoursByDate.get(dateKey) ?? 0) + hours);
          pairCount++;
          totalPunchPairs++;
          i = outIdx + 1;
          continue;
        }
      }
      i++;
    }

    if (pairCount === 0) continue; // no complete pairs — skip worker

    const entries: SuggestedEntry[] = [];
    let totalHours = 0;

    for (const [dateStr, hrs] of hoursByDate) {
      const d = new Date(dateStr + 'T00:00:00Z');
      const dayOffset = Math.round(
        (d.getTime() - weekStartDate.getTime()) / 86_400_000,
      );
      if (dayOffset < 0 || dayOffset > 6) continue; // outside week window — skip
      const dayKey = DAY_KEYS[dayOffset];
      const roundedHours = Math.round(hrs * 4) / 4; // round to nearest 0.25 h
      entries.push({ date: dateStr, dayKey, regularHours: roundedHours });
      totalHours += roundedHours;
    }

    if (entries.length === 0) continue;

    suggestions.push({
      workerId,
      workerName: workerMap.get(workerId) ?? workerId,
      entries,
      totalHours: Math.round(totalHours * 100) / 100,
      punchPairs: pairCount,
    });
  }

  res.json({
    data: {
      weekId,
      weekStart,
      weekEnd,
      suggestions,
      workerCount: suggestions.length,
      totalPunchPairs,
    },
  });
});
