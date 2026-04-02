# Phase 38: Audit Trail Wiring + Activity UI — Research

**Researched:** 2026-04-01
**Domain:** Express service-layer audit wiring, SQLite offset pagination, React TanStack Query + URL search params
**Confidence:** HIGH (all findings from direct source code inspection)

---

## Summary

Phase 37 produced `auditService.ts` with a working `insertAuditLog()` function and an `audit_logs` table. Phase 38 wires that function to every Tier-1 action and adds the API endpoint + React UI for viewing the feed.

The core challenge is **where the code currently lives**: all 15 Tier-1 actions are in route handlers that call raw Drizzle inserts or payrollService functions directly. There is no worker service layer or payroll-entry service layer — only `payrollService.ts` for week-level operations. The plan must decide, for each action, whether to add `insertAuditLog()` inline in the route handler (acceptable for export/submission events where there is no service layer to add it to) or introduce thin service wrappers (required for worker CRUD which is pure route-level Drizzle today).

The REQUIREMENTS explicitly state "called from service layer, not route handlers" for CRUD operations, but the research finding clarifies that export/download events are meta-only and have no equivalent service function to add to — calling `insertAuditLog()` inline in the export route is the right call for those.

**Primary recommendation:** Introduce `workerService.ts` for the three worker CRUD operations (create/update/delete), wrap `upsertPayrollEntry` and the new `deletePayrollEntry` function to emit audit logs from within the service, and add inline `insertAuditLog()` calls to the five export/submission/import route handlers where service wrapping would add complexity without benefit.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUDIT-03 | 15 Tier-1 actions wired to insertAuditLog() | Callsite map below; 6 in route handlers, 9 via service layer |
| AUDIT-04 | GET /api/audit/:projectId — paginated, 403 for non-members | assertProjectAccess pattern confirmed; offset pagination confirmed |
| AUDIT-05 | ProjectActivityPage at /projects/:id/activity — reverse-chron timeline, date-range filter, bookmarkable URL | TanStack Query + useSearchParams pattern confirmed from existing pages |
| NFR-03 | All new routes apply assertProjectAccess before any data access | Pattern confirmed from assertProjectAccess.ts |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

- **TailwindCSS v4 @theme tokens only** — never hardcode hex colors in JSX. Key tokens: `bg-nav-dark`, `border-brand-gold`, `bg-surface-card`, `bg-surface-page`
- **UI Primitives** — use `Card`, `Button`, `Badge`, `PageHeader`, `EmptyState` from `src/client/components/ui/`
- **TanStack Query key convention** — include all variable state in the key array
- **Blob URL download pattern** — `fetch()` → `.blob()` → `URL.createObjectURL()` → click → `setTimeout(URL.revokeObjectURL, 100)` (not needed for this phase but noted)
- **`useRef` for synchronous guards** — `useState` is async/batched
- **NEVER hard-delete payroll weeks or projects** — 29 CFR Part 3 records retention
- **Amendments create new rows** — never update in place
- **assertProjectAccess is the IDOR guard** — all new routes must call it

---

## Callsite Map — All 15 AUDIT-03 Actions

This is the primary deliverable. For each action: exact file, exact function/route, what context variables are available, and what `insertAuditLog()` input to pass.

### Group A: Worker CRUD (3 actions) — Need Service Wrappers

These are currently pure Drizzle in the route handler. The plan must introduce `src/server/services/workerService.ts` (or equivalent named wrappers) so `insertAuditLog()` is called from the service layer per AUDIT-02.

| # | Action | Current Location | Insert Point | Notes |
|---|--------|-----------------|--------------|-------|
| 1 | `worker.created` | `src/server/routes/workers.ts` — `router.post('/:projectId/workers', ...)` line 140 | New `createWorker()` in workerService.ts | `userId` from `req.user!.userId`; `userEmail` from `req.user!.email`; `ip` from `req.ip`; `snapshot` = full worker row (after insert); `meta` = `{ workerName: body.name }` |
| 2 | `worker.updated` | `src/server/routes/workers.ts` — `router.put('/:projectId/workers/:workerId', ...)` line 179 | New `updateWorker()` in workerService.ts | Fetch worker row before update; compute `diffObjects(before, after)`; `meta` = `{ workerName: updated.name }` |
| 3 | `worker.deleted` | `src/server/routes/workers.ts` — `router.delete('/:projectId/workers/:workerId', ...)` line 220 | New `deleteWorker()` in workerService.ts | Fetch worker row before delete; `snapshot` = full row; `meta` = `{ workerName: worker.name }` |

**Key finding:** `req.user!.email` is available — `UserPayload` interface (auth middleware line 6) exposes both `userId` and `email`. This satisfies `userEmail` in `InsertAuditLogInput`.

**Key finding:** `req.ip` is available directly in all route handlers. The research notes a Render.com proxy concern — `app.set('trust proxy', 1)` must be set in `src/server/index.ts` for `req.ip` to reflect the real client IP rather than the proxy IP. Current `index.ts` does NOT have this set — the plan must add it.

### Group B: Payroll Entry CRUD (3 actions) — Wrap Existing Service + Add Delete Route

`upsertPayrollEntry` in `payrollService.ts` is already a service function. It uses an `onConflictDoUpdate` pattern which means a single call either creates or updates a row. To distinguish `payroll_entry.created` from `payroll_entry.updated`, the service must check for an existing row before the upsert.

There is **no DELETE route for payroll entries** — this needs to be created as part of this phase.

| # | Action | Current Location | Insert Point | Notes |
|---|--------|-----------------|--------------|-------|
| 4 | `payroll_entry.created` | `src/server/services/payrollService.ts` — `upsertPayrollEntry()` line 132 | Inside `upsertPayrollEntry()`, after determining it's a create | Check: `SELECT id FROM payroll_entries WHERE payrollWeekId=? AND workerId=? AND classificationId=?` before upsert. If no row found → it's a create. `snapshot` = full values object; `meta` = `{ workerName: (must be passed in), payrollNumber: (from week lookup) }` |
| 5 | `payroll_entry.updated` | `src/server/services/payrollService.ts` — `upsertPayrollEntry()` line 132 | Inside `upsertPayrollEntry()`, after determining it's an update | Fetch existing row before upsert; compute `diffObjects(existing, newValues)`; `meta` = `{ workerName, payrollNumber }` |
| 6 | `payroll_entry.deleted` | **Does not exist yet** — route must be created | New `deletePayrollEntry()` in payrollService.ts + new route `DELETE /api/payroll/entries/:entryId` | Fetch entry before delete; `snapshot` = full row; `meta` = `{ workerName, payrollNumber }`. Route must guard: assertProjectAccess + assertWeekNotSubmitted |

**Implication for `upsertPayrollEntry`:** The input type `UpsertPayrollEntryInput` does not include `workerName` or `payrollNumber` — these are needed for the audit `meta`. The service will need to either (a) accept them as optional fields on the input type, or (b) look them up from the DB. Option (a) is simpler: the route handlers already have `week.payrollNumber` in scope; workerName requires a join. Option (b) adds a DB query. Recommendation: pass `workerName` and `payrollNumber` through the input type as optional audit fields.

### Group C: Payroll Week Submission (2 actions) — Inline in payrollService.ts

These call service functions (`updateWeekSubmission`, `clearWeekSubmission`) but the route handler has the user context, not the service. Since `payroll_week.submitted` and `payroll_week.unsubmitted` are meta-only events, the simplest approach is to call `insertAuditLog()` inline in the route handlers after the service call succeeds.

| # | Action | Current Location | Insert Point | Notes |
|---|--------|-----------------|--------------|-------|
| 7 | `payroll_week.submitted` | `src/server/routes/payroll.ts` — `router.patch('/weeks/:id/submit', ...)` line 294 | After `await updateWeekSubmission(...)` succeeds | `entityType: 'payroll_week'`; `entityId: weekId`; `meta` = `{ payrollNumber: week.payrollNumber, weekEnding: week.weekEndingDate, submittedTo: body.submittedTo }` |
| 8 | `payroll_week.unsubmitted` | `src/server/routes/payroll.ts` — `router.delete('/weeks/:id/submit', ...)` line 318 | After `await clearWeekSubmission(...)` succeeds | `meta` = `{ payrollNumber: week.payrollNumber, weekEnding: week.weekEndingDate }` |

### Group D: Export Downloads (4 actions) — Inline in export route

These are GET handlers that stream PDFs/XMLs. They are the canonical export route. Calling `insertAuditLog()` inline here is correct — there is no separate service layer for export generation.

| # | Action | Current Location | Insert Point | Notes |
|---|--------|-----------------|--------------|-------|
| 9 | `wh347.downloaded` | `src/server/routes/export.ts` — `router.get('/wh347/:weekId', ...)` line 119 | After PDF generation succeeds, before `res.end()` | `entityType: 'payroll_week'`; `meta` = `{ payrollNumber: week.payrollNumber, weekEnding: week.weekEndingDate, format: 'pdf' }` |
| 10 | `ecpr_xml.downloaded` | `src/server/routes/export.ts` — `router.get('/ecpr-xml/:weekId', ...)` line 513 | After XML generation succeeds | `meta` = `{ payrollNumber: week.payrollNumber, weekEnding: week.weekEndingDate, format: 'xml' }` |
| 11 | `wa_pwia_xml.downloaded` | `src/server/routes/export.ts` — `router.get('/wa-cpr-xml/:weekId', ...)` line 679 | After XML generation succeeds | `meta` = `{ payrollNumber: week.payrollNumber, weekEnding: week.weekEndingDate, format: 'xml' }` |
| 12 | `ny_mpwr_xml.downloaded` | **Does not exist yet** — Phase 41 | Not in scope for Phase 38 | AUDIT-03 lists this but the NY export route does not exist until Phase 41. The planner must note this as a callsite stub to add in Phase 41. |
| 13 | `il_pdf.downloaded` | **Does not exist yet** — Phase 43 | Not in scope for Phase 38 | Same — IL PDF export does not exist until Phase 43. |

**Finding:** The 15 actions in AUDIT-03 include `ny_mpwr_xml.downloaded` and `il_pdf.downloaded` which have no callsites yet. Phase 38 can only wire the 13 actions that have existing callsites. The planner should note the remaining 2 as TODOs for Phases 41 and 43.

### Group E: Agency Submissions (2 actions) — Inline in payroll route

The `ca-submit` and `wa-submit` PATCH routes call `setCaEcprSubmitted` and `setWaLniSubmitted` in payrollService. These update a timestamp column on `payroll_weeks` (not a separate `agency_submissions` table). `payroll_week.submitted` (action #7) covers the WH-347 submission; the agency-submission actions are distinct.

**Note:** AUDIT-03 lists `agency_submission.created` as a single action constant. Looking at the implementation, there are actually two agency submission types (CA eCPR and WA L&I). The plan must decide: use one generic `agency_submission.created` action with `meta.agency` distinguishing them, or use two separate action constants (`ecpr_submission.created`, `wa_lni_submission.created`). Recommendation: use a single `agency_submission.created` with `meta: { agency: 'CA_DIR' | 'WA_LNI', payrollNumber, weekEnding }` — consistent with AUDIT-03 naming and simpler for the UI label map.

| # | Action | Current Location | Insert Point | Notes |
|---|--------|-----------------|--------------|-------|
| 14 | `agency_submission.created` (CA) | `src/server/routes/payroll.ts` — `router.patch('/weeks/:id/ca-submit', ...)` line 341, when `submitted === true` | After `setCaEcprSubmitted(weekId)` succeeds | `meta` = `{ agency: 'CA_DIR', payrollNumber: week.payrollNumber, weekEnding: week.weekEndingDate }` |
| 14b | `agency_submission.created` (WA) | `src/server/routes/payroll.ts` — `router.patch('/weeks/:id/wa-submit', ...)` line 368, when `submitted === true` | After `setWaLniSubmitted(weekId)` succeeds | `meta` = `{ agency: 'WA_LNI', payrollNumber: week.payrollNumber, weekEnding: week.weekEndingDate }` |

### Group F: Payroll Import (1 action) — Inline in import route

| # | Action | Current Location | Insert Point | Notes |
|---|--------|-----------------|--------------|-------|
| 15 | `payroll_import.committed` | `src/server/routes/import.ts` — `importRouter.post('/commit', ...)` line 103 | After `payrollImports` row is inserted (line 205), before `res.json()` | `entityType: 'payroll_import'`; `entityId: randomUUID()` (the new payrollImports row id); `meta` = `{ provider: body.provider, committedCount: body.matched.length, unmatchedCount: body.unmatchedCount ?? 0, sourceFilename: body.sourceFilename ?? null, weekEnding: week.weekEndingDate }` |

---

## InsertAuditLogInput Interface (from auditService.ts)

```typescript
export interface InsertAuditLogInput {
  userId:     string | null;     // req.user!.userId
  userEmail:  string | null;     // req.user!.email  (from UserPayload)
  ipAddress:  string | null;     // req.ip  (needs trust proxy setting)
  projectId:  string | null;     // from week.projectId or route param
  entityType: string;            // 'worker' | 'payroll_entry' | 'payroll_week' | 'payroll_import'
  entityId:   string;            // the row's UUID
  action:     string;            // e.g. 'worker.created'
  diff?:      Record<string, unknown> | null;      // update events
  snapshot?:  Record<string, unknown> | null;      // create/delete events
  meta?:      Record<string, unknown> | null;      // export/submission events
}
```

`insertAuditLog()` is best-effort: it should NOT throw to the caller. Wrap in `try/catch` and log failures to console — a failed audit log must not 500 a payroll save.

---

## User and IP Context Flow

**Finding (HIGH confidence):** `req.user` is available in all route handlers because `router.use(requireAuth)` is called at the top of every router file. The JWT payload type `UserPayload` exposes both `userId` (string) and `email` (string).

**Pattern for routes:**
```typescript
const userId    = req.user!.userId;
const userEmail = req.user!.email;
const ipAddress = req.ip ?? null;
```

**For service functions** that currently accept only domain inputs (e.g., `upsertPayrollEntry`), the caller context must be threaded through the input type. The existing `UpsertPayrollEntryInput` already has `userId?: string` — add `userEmail?: string` and `ipAddress?: string` as optional fields for audit log enrichment.

**Trust proxy:** `src/server/index.ts` does not currently call `app.set('trust proxy', 1)`. Without this, `req.ip` returns the Render.com load balancer IP. The Plan 01 must add this line.

---

## GET /api/audit/:projectId Route Pattern

AUDIT-04 specifies `GET /api/audit/:projectId`. Looking at existing routes in index.ts, there is no `/api/audit` prefix registered. The new route will need:

1. A new file `src/server/routes/audit.ts`
2. Registration in `src/server/index.ts` as `app.use('/api/audit', auditRouter)`

**assertProjectAccess pattern** (from `assertProjectAccess.ts`):
- Takes `(db, projectId, userId)` — returns the project row on success
- Throws `{ status: 403, message: 'Access denied' }` for non-members
- Throws `{ status: 404, message: 'Project not found' }` if project doesn't exist
- All existing routes use the try/catch pattern:

```typescript
try {
  await assertProjectAccess(db, projectId, userId);
} catch (err: any) {
  res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
  return;
}
```

**Route shape for AUDIT-04:**
```
GET /api/audit/:projectId
  ?from=2026-01-01     (ISO date, optional)
  ?to=2026-03-31       (ISO date, optional)
  ?page=1              (default 1)
  ?entityType=worker   (optional)

Response: { items: AuditLogRow[], total: number, page: number, limit: number, totalPages: number }
```

**Drizzle query pattern** (offset pagination with existing index `idx_audit_project_time`):
```typescript
const limit  = 25;
const offset = (page - 1) * limit;

const items = await db
  .select()
  .from(auditLogs)
  .where(and(
    eq(auditLogs.projectId, projectId),
    from ? gte(auditLogs.createdAt, from) : undefined,
    to   ? lte(auditLogs.createdAt, to + 'T23:59:59.999Z') : undefined,
    entityType ? eq(auditLogs.entityType, entityType) : undefined,
  ))
  .orderBy(desc(auditLogs.createdAt))
  .limit(limit)
  .offset(offset);
```

For `total` count, run a separate `db.select({ count: count() }).from(auditLogs).where(...)` with the same filters.

---

## Pagination Pattern — Existing Code

There are **no existing paginated API endpoints** in this codebase. All list endpoints return full result sets. This phase introduces the first pagination. Use offset+limit as confirmed by the domain research (suitable for project-scoped log sizes).

**Recommended approach:**
- `limit` = 25 (hardcoded per AUDIT-04 spec)
- `offset` = `(page - 1) * 25`
- Response envelope: `{ items, total, page, limit, totalPages }`
- `totalPages` = `Math.ceil(total / limit)`

---

## React Patterns — TanStack Query + URL Search Params

**From PayrollListPage.tsx and WorkersPage.tsx:**

All existing list pages use this TanStack Query pattern:
```typescript
const { data, isLoading, isError } = useQuery({
  queryKey: ['auditLogs', projectId, filters],  // include all variable state
  queryFn: () => api.get<AuditLogResponse>(`/audit/${projectId}?${params}`),
  enabled: !!projectId,
});
```

**No existing page uses `useSearchParams`** (React Router's URL search params hook) — all filter state is `useState`. For AUDIT-05's bookmarkable URL requirement, this page will be the first to use `useSearchParams`. The pattern from the domain research:

```typescript
import { useSearchParams } from 'react-router-dom';

const [searchParams, setSearchParams] = useSearchParams();
const from        = searchParams.get('from') ?? '';
const to          = searchParams.get('to')   ?? '';
const page        = parseInt(searchParams.get('page') ?? '1', 10);

// On filter change:
setSearchParams({ from, to, page: '1' });  // reset page on filter change
```

**Query key** must include all filter params so cache invalidates on filter change:
```typescript
queryKey: ['auditLogs', projectId, { from, to, page, entityType }]
```

---

## Route Registration — New Route

Add to `src/server/index.ts`:
```typescript
import { auditRouter } from './routes/audit.js';
// ...
app.use('/api/audit', auditRouter);
```

Add to `src/client/App.tsx`:
```tsx
import { ProjectActivityPage } from './pages/ProjectActivityPage';
// inside ProtectedRoute:
<Route path="/projects/:id/activity" element={<ProjectActivityPage />} />
```

---

## Human-Readable Action Labels (for AUDIT-05 UI)

The `meta` column carries display-ready fields. Client-side map (TypeScript):

```typescript
type AuditLog = {
  action: string;
  meta: Record<string, unknown> | null;
  entityType: string;
  entityId: string;
};

const ACTION_LABELS: Record<string, (log: AuditLog) => string> = {
  'worker.created':              (l) => `Added worker ${l.meta?.workerName ?? 'unknown'}`,
  'worker.updated':              (l) => `Updated worker ${l.meta?.workerName ?? 'unknown'}`,
  'worker.deleted':              (l) => `Removed worker ${l.meta?.workerName ?? 'unknown'}`,
  'payroll_entry.created':       (l) => `Added payroll entry for ${l.meta?.workerName ?? 'unknown'} (Week ${l.meta?.payrollNumber ?? '?'})`,
  'payroll_entry.updated':       (l) => `Edited payroll entry for ${l.meta?.workerName ?? 'unknown'} (Week ${l.meta?.payrollNumber ?? '?'})`,
  'payroll_entry.deleted':       (l) => `Deleted payroll entry for ${l.meta?.workerName ?? 'unknown'} (Week ${l.meta?.payrollNumber ?? '?'})`,
  'payroll_week.submitted':      (l) => `Certified payroll Week ${l.meta?.payrollNumber ?? '?'} as submitted to ${l.meta?.submittedTo ?? 'agency'}`,
  'payroll_week.unsubmitted':    (l) => `Cleared submission status for Week ${l.meta?.payrollNumber ?? '?'}`,
  'wh347.downloaded':            (l) => `Downloaded WH-347 PDF for Week ${l.meta?.payrollNumber ?? '?'}`,
  'ecpr_xml.downloaded':         (l) => `Downloaded CA eCPR XML for Week ${l.meta?.payrollNumber ?? '?'}`,
  'wa_pwia_xml.downloaded':      (l) => `Downloaded WA PWIA XML for Week ${l.meta?.payrollNumber ?? '?'}`,
  'ny_mpwr_xml.downloaded':      (l) => `Downloaded NY MPWR XML for Week ${l.meta?.payrollNumber ?? '?'}`,
  'il_pdf.downloaded':           (l) => `Downloaded IL Certified Payroll PDF for Week ${l.meta?.payrollNumber ?? '?'}`,
  'payroll_import.committed':    (l) => `Imported ${l.meta?.committedCount ?? '?'} entries via ${l.meta?.provider ?? 'unknown provider'}`,
  'agency_submission.created':   (l) => `Marked Week ${l.meta?.payrollNumber ?? '?'} as submitted to ${l.meta?.agency === 'CA_DIR' ? 'CA DIR eCPR' : l.meta?.agency === 'WA_LNI' ? 'WA L&I PWIA' : String(l.meta?.agency ?? 'agency')}`,
};

function getActionLabel(log: AuditLog): string {
  const fn = ACTION_LABELS[log.action];
  return fn ? fn(log) : log.action;  // fallback: raw action string
}
```

---

## Recommended Plan Structure (3 Plans)

**Plan 01 — Service Wiring** (server-side only, no UI)
- Add `app.set('trust proxy', 1)` to `src/server/index.ts`
- Create `src/server/services/workerService.ts` with `createWorker()`, `updateWorker()`, `deleteWorker()` — each refactoring the existing route handler DB logic into the service and calling `insertAuditLog()`
- Update `src/server/routes/workers.ts` to call the new service functions instead of raw Drizzle
- Extend `UpsertPayrollEntryInput` with optional `userEmail?`, `ipAddress?`, `workerName?`, `payrollNumber?`
- Update `upsertPayrollEntry()` in `payrollService.ts` to detect create vs. update and call `insertAuditLog()`
- Add `deletePayrollEntry()` to `payrollService.ts` + new route `DELETE /api/payroll/entries/:entryId` in `payroll.ts`
- Add inline `insertAuditLog()` calls in payroll route handlers for `payroll_week.submitted`, `payroll_week.unsubmitted`, `agency_submission.created` (CA and WA)
- Add inline `insertAuditLog()` calls in export route handlers for `wh347.downloaded`, `ecpr_xml.downloaded`, `wa_pwia_xml.downloaded`
- Add inline `insertAuditLog()` call in import route handler for `payroll_import.committed`
- Tests: vitest integration tests verifying each of the 13 wired actions produces an `audit_logs` row

**Plan 02 — API Route** (new Express route + index.ts registration)
- Create `src/server/routes/audit.ts` with `GET /:projectId`
- assertProjectAccess gate (NFR-03)
- Offset pagination (25/page), optional `from`/`to`/`entityType` filters
- Register in `src/server/index.ts`
- Tests: 403 for non-members, pagination shape, filter behavior

**Plan 03 — React UI** (new page + App.tsx route)
- Create `src/client/pages/ProjectActivityPage.tsx`
- `useSearchParams` for `from`, `to`, `page` state (bookmarkable URLs — AUDIT-05)
- `useQuery` with all filter params in key
- Reverse-chronological timeline with day grouping
- Date range inputs that update URL params and reset page to 1
- Pagination controls (prev/next, page N of M)
- Action label rendering via `ACTION_LABELS` map
- Add route to `App.tsx`: `/projects/:id/activity`
- Add nav link from `ProjectDetailPage`

---

## Architecture Patterns

### Service Layer Pattern (from existing code)

`payrollService.ts` is the reference implementation for service functions in this project. Each exported function:
1. Calls `getDb()` internally
2. Performs DB operations
3. Returns a typed result

For audit logging, add `insertAuditLog()` as a best-effort fire-and-forget after the main DB operation:

```typescript
// Best-effort audit — must not throw to caller
try {
  await insertAuditLog({ ... });
} catch (auditErr) {
  console.error('[audit] insertAuditLog failed:', auditErr);
}
```

### Create vs. Update Detection in upsertPayrollEntry

Since `upsertPayrollEntry` uses `onConflictDoUpdate`, it cannot tell from the SQL result alone whether it created or updated. Detect by fetching the existing row first:

```typescript
const existing = await db
  .select()
  .from(payrollEntries)
  .where(and(
    eq(payrollEntries.payrollWeekId, input.payrollWeekId),
    eq(payrollEntries.workerId, input.workerId),
    eq(payrollEntries.classificationId, input.classificationId),
  ))
  .limit(1);

const isCreate = existing.length === 0;
// ... perform upsert ...
// then call insertAuditLog with either snapshot (create) or diff (update)
```

### Anti-Patterns to Avoid

- **Do not add `insertAuditLog()` calls inside `onConflictDoUpdate` SQL** — SQLite does not support that. Detect create vs. update at the application layer.
- **Do not throw if `insertAuditLog()` fails** — audit logging is best-effort; a failed audit must not 500 a payroll save.
- **Do not join to source tables at render time in the activity feed** — worker names and payroll numbers must come from the `meta` JSON column, not from a live join (source rows may have changed or been deleted).
- **Do not filter by `meta` JSON content in SQL** — `meta` is stored as JSON text. All filtering is by first-class indexed columns (`projectId`, `entityType`, `createdAt`).

---

## Common Pitfalls

### Pitfall 1: upsertPayrollEntry creates + updates look identical at the SQL level

**What goes wrong:** `onConflictDoUpdate` returns the same Drizzle result whether it inserted a new row or updated an existing one. Logging `payroll_entry.created` for every upsert is wrong.

**Prevention:** SELECT for existing row before the upsert. If row exists → update audit; if no row → create audit.

### Pitfall 2: workerName not available in payrollService.ts

**What goes wrong:** `upsertPayrollEntry` receives workerId but not workerName. The audit meta needs a human-readable name. Looking up the worker inside payrollService adds a DB call.

**Prevention:** Thread `workerName` through `UpsertPayrollEntryInput` as an optional field. Route handlers already have it available via the workers endpoint or can fetch it cheaply. This avoids a service-internal join.

### Pitfall 3: `req.ip` returns proxy IP without trust proxy setting

**What goes wrong:** On Render.com (behind a load balancer), `req.ip` returns the internal proxy IP. All audit log `ipAddress` entries show the same internal IP.

**Prevention:** Add `app.set('trust proxy', 1)` to `src/server/index.ts`. This makes Express use the `X-Forwarded-For` header. Note: this does not affect local development (no proxy present).

### Pitfall 4: Agency submission toggle fires audit on both SET and CLEAR

**What goes wrong:** `PATCH /weeks/:id/ca-submit` and `PATCH /weeks/:id/wa-submit` accept `{ submitted: boolean }`. The audit event `agency_submission.created` should only fire when `submitted === true`. When `submitted === false`, no audit row should be created (clearing a submission is tracked by the absence of further events, not a new row).

**Prevention:** Wrap the `insertAuditLog()` call in `if (submitted) { ... }`.

### Pitfall 5: NY and IL export routes don't exist yet

**What goes wrong:** AUDIT-03 lists `ny_mpwr_xml.downloaded` and `il_pdf.downloaded` but those export routes are Phase 41 and Phase 43 work.

**Prevention:** Phase 38 wires 13 of 15 actions. Document the 2 missing callsites as stubs. When Phase 41/43 create the export routes, they add the `insertAuditLog()` call at that time. Do not attempt to pre-wire non-existent routes.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run tests/services/auditService.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUDIT-03 | worker.created produces audit row | integration | `npx vitest run tests/services/workerService.test.ts` | No — Wave 0 |
| AUDIT-03 | payroll_entry.created/updated produces audit row | integration | `npx vitest run tests/services/payrollService.test.ts` | No — Wave 0 |
| AUDIT-03 | wh347.downloaded produces audit row | route test | `npx vitest run tests/routes/export.test.ts` | Yes (extend) |
| AUDIT-03 | payroll_import.committed produces audit row | route test | `npx vitest run tests/routes/import.test.ts` | Yes (extend) |
| AUDIT-04 | GET /api/audit/:projectId returns 403 for non-members | route test | `npx vitest run tests/routes/audit.test.ts` | No — Wave 0 |
| AUDIT-04 | GET /api/audit/:projectId paginates at 25 rows | route test | `npx vitest run tests/routes/audit.test.ts` | No — Wave 0 |
| NFR-03 | All new routes call assertProjectAccess | route test | `npx vitest run tests/routes/audit.test.ts` | No — Wave 0 |

### Wave 0 Gaps
- [ ] `tests/services/workerService.test.ts` — covers AUDIT-03 worker CRUD actions
- [ ] `tests/services/payrollService.audit.test.ts` — covers AUDIT-03 entry create/update/delete actions
- [ ] `tests/routes/audit.test.ts` — covers AUDIT-04 403, pagination, filter behavior

### Sampling Rate
- **Per task commit:** `npx vitest run tests/services/auditService.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

---

## Environment Availability

Step 2.6: SKIPPED — phase is pure code changes, no new external dependencies. All tools (Node.js, SQLite, Vitest) are already confirmed operational from Phase 37 (396 tests passing).

---

## Standard Stack

No new libraries needed. All required tools are already installed:

| Library | Purpose | Already in package.json |
|---------|---------|------------------------|
| drizzle-orm | DB queries for audit log reads | Yes |
| react-router-dom | `useSearchParams` for filter URL state | Yes |
| @tanstack/react-query | `useQuery` for activity feed | Yes |
| vitest + supertest | Tests | Yes |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No audit logging anywhere | Phase 37 added audit_logs table + auditService.ts | 2026-04-01 | Phase 38 wires callsites |
| No paginated endpoints in codebase | Phase 38 introduces first offset-paginated endpoint | Phase 38 | Establishes pagination pattern for future phases |

---

## Open Questions

1. **workerName in upsertPayrollEntry**
   - What we know: The input type has `workerId` but not `workerName`; audit meta needs a display name
   - What's unclear: Whether to thread it through the input type (simple) or look it up inside the service (adds DB call but keeps input clean)
   - Recommendation: Thread through input type as `workerName?: string` — callers have it available; lookup inside service is an extra round-trip for a display field

2. **payroll_entry.deleted route placement**
   - What we know: No DELETE /entries/:id route exists; this needs to be created
   - What's unclear: Whether to add it to `payroll.ts` or create it inline with the `deletePayrollEntry` service function
   - Recommendation: Add `DELETE /api/payroll/entries/:entryId` to `payroll.ts` following the same guard pattern as other payroll entry operations (assertProjectAccess + assertWeekNotSubmitted)

3. **`agency_submission.created` action name for clear events**
   - What we know: The toggle routes fire on both set and clear; we should only audit the create
   - Recommendation: Confirmed — only log when `submitted === true`; no audit on `submitted === false`

---

## Sources

### PRIMARY (HIGH confidence — direct source code inspection)

All findings are from direct inspection of the following files:
- `src/server/services/auditService.ts` — InsertAuditLogInput interface, diffObjects export
- `src/server/routes/workers.ts` — worker CRUD callsites (lines 140, 179, 220)
- `src/server/routes/payroll.ts` — submission + entry callsites (lines 221, 249, 294, 318, 341, 368)
- `src/server/routes/export.ts` — export download callsites (lines 119, 513, 679)
- `src/server/routes/import.ts` — import commit callsite (line 103)
- `src/server/services/payrollService.ts` — upsertPayrollEntry (line 132), submission functions
- `src/server/middleware/auth.ts` — UserPayload interface (userId + email confirmed)
- `src/server/utils/assertProjectAccess.ts` — 403/404 pattern confirmed
- `src/server/index.ts` — route registration pattern; trust proxy gap confirmed
- `src/client/App.tsx` — existing route registration pattern
- `src/client/pages/PayrollListPage.tsx` — TanStack Query pattern
- `src/client/pages/WorkersPage.tsx` — useMutation + useQuery pattern
- `.planning/REQUIREMENTS.md` — AUDIT-03/04/05/NFR-03 requirements
- `.planning/research/audit-trail-research.md` — domain research, pagination recommendation

### SECONDARY (MEDIUM confidence — planning documents)
- `.planning/STATE.md` — confirmed Phase 37 complete, 396 tests passing
- `CLAUDE.md` — project constraints and UI primitive rules
