---
phase: 38-audit-trail-wiring-activity-ui
verified: 2026-04-01T07:46:00Z
status: passed
score: 17/17 must-haves verified
re_verification: false
---

# Phase 38: Audit Trail Wiring + Activity UI Verification Report

**Phase Goal:** All Tier-1 compliance actions (worker CRUD, payroll entry CRUD, submissions, downloads, imports) are wired to `insertAuditLog()` in the service layer, and project members can view a reverse-chronological activity feed with date-range filtering.

**Verified:** 2026-04-01T07:46:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Creating a worker via POST produces audit row with action='worker.created' and snapshot | VERIFIED | `workerService.ts:85` — action: 'worker.created', snapshot built from inserted row; test confirms row created |
| 2  | Updating a worker via PUT produces audit row with action='worker.updated' and diff payload | VERIFIED | `workerService.ts:137` — action: 'worker.updated', diff via diffObjects(); test confirms diff.before/after |
| 3  | Deleting a worker via DELETE produces audit row with action='worker.deleted' and snapshot | VERIFIED | `workerService.ts:169` — action: 'worker.deleted', snapshot of row before deletion; test passes |
| 4  | Upserting a new payroll entry produces action='payroll_entry.created'; upserting existing produces action='payroll_entry.updated' | VERIFIED | `payrollService.ts:144-296` — pre-query SELECT detects create vs update; both branches confirmed by test |
| 5  | Deleting a payroll entry produces action='payroll_entry.deleted' with snapshot | VERIFIED | `payrollService.ts:347` — deletePayrollEntry() logs snapshot; test passes |
| 6  | Submitting a week produces action='payroll_week.submitted'; unsubmitting produces action='payroll_week.unsubmitted' | VERIFIED | `payroll.ts:388,427` — both actions wired after their respective service calls |
| 7  | Downloading WH-347 PDF produces action='wh347.downloaded' | VERIFIED | `export.ts:241` — insertAuditLog called after PDF buffer generated |
| 8  | Downloading CA eCPR XML produces action='ecpr_xml.downloaded' | VERIFIED | `export.ts:698` — insertAuditLog called after XML generation |
| 9  | Downloading WA PWIA XML produces action='wa_pwia_xml.downloaded' | VERIFIED | `export.ts:874` — insertAuditLog called after WA CPR XML generation |
| 10 | Marking CA/WA submission (submitted=true) produces action='agency_submission.created' with meta.agency | VERIFIED | `payroll.ts:471,516` — CA_DIR and WA_LNI both wired, guarded by `if (req.body.submitted)` |
| 11 | Committing a payroll import produces action='payroll_import.committed' | VERIFIED | `import.ts:227` — insertAuditLog called after payrollImports row insert |
| 12 | req.ip returns real client IP because trust proxy is set | VERIFIED | `index.ts:33` — `app.set('trust proxy', 1)` on line 33, immediately after app creation |
| 13 | GET /api/audit/:projectId returns paginated audit logs (25/page) in reverse-chronological order | VERIFIED | `audit.ts:28,47-48` — limit=25, .orderBy(desc(auditLogs.createdAt)); tests: 25 items page 1, reverse-chron pass |
| 14 | GET /api/audit/:projectId returns 403 for non-members (NFR-03) | VERIFIED | `audit.ts:20` — assertProjectAccess called before any db.select; 403 test passes |
| 15 | GET /api/audit/:projectId supports date-range (from/to) and entityType filtering | VERIFIED | `audit.ts:32-38` — conditions array with gte/lte/eq; date range and entityType filter tests pass |
| 16 | User can navigate to /projects/:id/activity and see a reverse-chronological timeline | VERIFIED | `ProjectActivityPage.tsx` exported, route registered `App.tsx:63`, api.get('/audit/${projectId}?...') wired |
| 17 | Activity link is visible in ProjectDetailPage nav | VERIFIED | `ProjectDetailPage.tsx:283` — Link with to=`/projects/${project.id}/activity` present |

**Score:** 17/17 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/server/services/workerService.ts` | createWorker, updateWorker, deleteWorker with audit logging | VERIFIED | 178 lines; all 3 functions exported; 4 insertAuditLog calls |
| `src/server/routes/audit.ts` | GET /:projectId paginated audit endpoint | VERIFIED | 72 lines; exports auditRouter; assertProjectAccess, orderBy desc, limit/offset all present |
| `src/client/pages/ProjectActivityPage.tsx` | Activity feed with timeline, date filter, pagination | VERIFIED | 279 lines (>100 min); ACTION_LABELS with 14 entries, useSearchParams, handlePageChange |
| `src/client/App.tsx` | Route for /projects/:id/activity | VERIFIED | ProjectActivityPage imported line 22; route registered line 63 |
| `src/client/pages/ProjectDetailPage.tsx` | Activity nav link | VERIFIED | Link to activity at line 283 |
| `tests/services/workerService.test.ts` | Integration tests for worker CRUD audit | VERIFIED | 169 lines; 4 tests all pass |
| `tests/services/payrollService.audit.test.ts` | Integration tests for payroll entry audit | VERIFIED | 209 lines; 3 tests all pass |
| `tests/routes/audit.test.ts` | Route tests: 403, pagination, filters | VERIFIED | 227 lines; 9 tests all pass |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/server/routes/workers.ts` | `src/server/services/workerService.ts` | `import { createWorker, updateWorker, deleteWorker }` | WIRED | Line 13 in workers.ts; all 3 service functions called in route handlers at lines 155, 184, 215 |
| `src/server/services/workerService.ts` | `src/server/services/auditService.ts` | `insertAuditLog()` call in each function | WIRED | Static import; 3 call sites confirmed at lines 85, 137, 169 |
| `src/server/services/payrollService.ts` | `src/server/services/auditService.ts` | `insertAuditLog()` inside upsertPayrollEntry and deletePayrollEntry | WIRED | Static import; 4 call sites confirmed |
| `src/server/routes/audit.ts` | `src/server/utils/assertProjectAccess.ts` | `assertProjectAccess(db, projectId, userId)` before data access | WIRED | Line 6 import, line 20 call — before any auditLogs SELECT |
| `src/server/index.ts` | `src/server/routes/audit.ts` | `app.use('/api/audit', auditRouter)` | WIRED | Lines 23 (import) and 54 (registration) confirmed |
| `src/client/pages/ProjectActivityPage.tsx` | `/api/audit/:projectId` | `useQuery` with `api.get` | WIRED | Line 108 — `api.get<AuditLogResponse>(\`/audit/${projectId}?${params.toString()}\`)` |
| `src/client/pages/ProjectActivityPage.tsx` | `react-router-dom` | `useSearchParams` for bookmarkable filter state | WIRED | Line 3 import, line 95 usage |
| `src/client/App.tsx` | `src/client/pages/ProjectActivityPage.tsx` | `Route element={<ProjectActivityPage />}` | WIRED | Lines 22 (import) and 63 (route) |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `ProjectActivityPage.tsx` | `data` (AuditLogResponse) | `api.get('/audit/${projectId}?...')` → `GET /api/audit/:projectId` → `db.select().from(auditLogs).where(...).orderBy(desc).limit(25)` | Yes — Drizzle ORM query against auditLogs table; count() query for total | FLOWING |
| `src/server/routes/audit.ts` | `items`, `total` | `Promise.all([db.select().from(auditLogs)..., db.select({value: count()}).from(auditLogs)...])` | Yes — real DB queries; rows populated by 14 wired insertAuditLog() callsites | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| workerService.test.ts — all 4 tests | `npx vitest run tests/services/workerService.test.ts` | 4/4 pass | PASS |
| payrollService.audit.test.ts — all 3 tests | `npx vitest run tests/services/payrollService.audit.test.ts` | 3/3 pass | PASS |
| audit.test.ts — all 9 tests | `npx vitest run tests/routes/audit.test.ts` | 9/9 pass | PASS |
| Full test suite — no regressions | `npx vitest run --exclude ".claude/**"` | 412/412 pass, 34 test files | PASS |
| 14 insertAuditLog callsites wired | grep count across 5 files | 14 confirmed action strings across workerService, payrollService, payroll, export, import | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AUDIT-03 | 38-01 | Tier-1 logged actions: worker.created/updated/deleted, payroll_entry.created/updated/deleted, payroll_week.submitted/unsubmitted, wh347/ecpr/wa_pwia downloads, payroll_import.committed, agency_submission.created | SATISFIED | All 13 of 15 actions wired (ny_mpwr, il_pdf deferred to Phases 41/43 per plan scope); 14 action strings confirmed in code |
| AUDIT-04 | 38-02 | GET /api/audit/:projectId — paginated (25/page), entityType filter, actor/action/timestamp in response | SATISFIED | audit.ts confirmed: limit=25, desc order, entityType filter, {items,total,page,limit,totalPages} envelope; 9 passing tests |
| AUDIT-05 | 38-03 | ProjectActivityPage at /projects/:id/activity — reverse-chron timeline, date-range filter, link from ProjectDetailPage | SATISFIED | ProjectActivityPage.tsx (279 lines) with useSearchParams, ACTION_LABELS, pagination; route in App.tsx; nav link in ProjectDetailPage |
| NFR-03 | 38-01, 38-02 | All new routes apply assertProjectAccess before any data access | SATISFIED | audit.ts calls assertProjectAccess before db.select (line 20); deletePayrollEntry route calls assertProjectAccess before delete (plan notes confirm ordering); confirmed by 403 test |

---

### Anti-Patterns Found

None detected. Scanned `workerService.ts`, `audit.ts`, `ProjectActivityPage.tsx` for TODO/FIXME/placeholder comments, `return null`/empty return stubs, and hardcoded empty data — all clean.

Workers.ts no longer contains inline `db.insert(workers).values` or `db.update(workers).set` — all raw DB operations moved to workerService as intended.

---

### Human Verification Required

#### 1. Visual Activity Feed UI

**Test:** Start dev server (`npm run dev`), log in, navigate to a project, click "Activity" in the nav row.
**Expected:** Reverse-chronological timeline with day-group headers (Today/Yesterday/date), actor email, human-readable action label, timestamp; date-range inputs at top update URL on change; pagination controls appear when >25 events exist.
**Why human:** Visual layout, Tailwind token rendering, and interactive URL-update behavior cannot be verified programmatically. Task 3 in Plan 03 was a blocking human-verify checkpoint — SUMMARY records it was approved (`efbb698` chore commit).

---

### Gaps Summary

No gaps. All 17 observable truths verified. All 8 artifacts exist, are substantive, and are wired. All 14 audit action callsites confirmed in actual code. Full test suite (412 tests) passes with zero regressions. Requirements AUDIT-03, AUDIT-04, AUDIT-05, and NFR-03 are all satisfied.

The two deferred actions (`ny_mpwr_xml.downloaded`, `il_pdf.downloaded`) are intentionally out of scope for Phase 38 — they are blocked on Phases 41/43 creating those routes.

---

_Verified: 2026-04-01T07:46:00Z_
_Verifier: Claude (gsd-verifier)_
