---
phase: 51-nj-schema-routes
verified: 2026-04-13T00:55:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
human_verification:
  - test: "Create an NJ project in the browser and confirm njPwcNumber and njContractId fields appear; change state to CA or MA and confirm they disappear"
    expected: "Fields visible only when state = NJ; indigo-themed block (border-indigo-200, bg-indigo-50)"
    why_human: "Conditional rendering with react-hook-form stateValue watcher requires a live browser to confirm field show/hide behavior"
  - test: "Open any NJ project's Workers page, edit a worker, confirm NJ EEO — Sex select (M/F/N/Not reported) is visible; open a non-NJ project's Workers page and confirm select is absent"
    expected: "isNJ-gated select visible on NJ workers only"
    why_human: "UI gate depends on project state fetched via API; requires browser with logged-in session"
  - test: "Navigate to any payroll week on an NJ project, confirm 'Download NJ MW-562' button appears; click it and confirm a 501 error response (toast or console)"
    expected: "Button present on NJ payroll weeks; absent on non-NJ weeks; button returns HTTP 501"
    why_human: "STATE_FORMS registry drives conditional button rendering; click behavior requires live server"
---

# Phase 51: NJ Schema + Routes Verification Report

**Phase Goal:** New Jersey is a selectable project state with database columns for njPwcNumber, njContractId, and workerSex; NJ-specific UI fields surface on NJ projects; STATE_FORMS registry has NJ entry; export route stub ready for Phase 52 generator.
**Verified:** 2026-04-13T00:55:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | workers table has nullable worker_sex TEXT column after migration | VERIFIED | `0030_nj_schema.sql` line 1: `ALTER TABLE workers ADD COLUMN worker_sex TEXT;`; schema.ts line 117: `workerSex: text('worker_sex')` with Phase 51 comment |
| 2  | projects table has nullable nj_pwc_number and nj_contract_id TEXT columns | VERIFIED | `0030_nj_schema.sql` lines 3-5; schema.ts lines 56-57: `njPwcNumber: text('nj_pwc_number')`, `njContractId: text('nj_contract_id')` |
| 3  | POST /api/projects accepts and stores njPwcNumber and njContractId | VERIFIED | projects.ts CreateProjectSchema (lines 42-43), UpdateProjectSchema (lines 69-70), INSERT (lines 104-105), PATCH (lines 224-225); 2 integration tests green |
| 4  | GET /api/export/nj-mw562/:weekId stub: 404 unknown week, 403 cross-tenant, 400 non-NJ, 501 valid NJ | VERIFIED | export.ts lines 1314-1343: correct order (load week → assertProjectAccess → state gate → 501); 4 integration tests green |
| 5  | POST /api/workers and PUT /api/workers/:id accept and store workerSex (M/F/N/null) | VERIFIED | workers.ts CreateWorkerSchema line 46 `z.enum(['M','F','N']).optional()`, UpdateWorkerSchema line 75 `.optional().nullable()`; INSERT line 224, UPDATE line 271; 4 integration tests green |
| 6  | NJ project shows njPwcNumber and njContractId input fields; non-NJ does not | VERIFIED (automated portion) | ProjectForm.tsx: isNJ declared line 71; `{isNJ && (...)}` block starts line 359; both inputs registered via `register('njPwcNumber')` and `register('njContractId')` |
| 7  | WorkersPage edit form for NJ project shows workerSex select; non-NJ does not | VERIFIED (automated portion) | WorkersPage.tsx: isNJ line 191; isNJ-gated select lines 606-620; M/F/N/Not reported options present; workerSex in editForm state line 150 |
| 8  | PayrollWeekDetailPage STATE_FORMS registry has NJ entry routing to nj-mw562 | VERIFIED | PayrollWeekDetailPage.tsx line 483: `NJ: { downloadLabel: 'Download NJ MW-562', route: 'nj-mw562' }` |
| 9  | Export route stub wired to assertProjectAccess before state gate | VERIFIED | export.ts lines 1328-1338: assertProjectAccess called at line 1329 before state check at line 1336 |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/server/db/migrations/0030_nj_schema.sql` | 3 ALTER TABLE statements, 2 `-->` breakpoints | VERIFIED | Exact format: worker_sex, nj_pwc_number, nj_contract_id; arrow separators confirmed |
| `src/server/db/migrations/meta/_journal.json` | idx 26 entry tag "0030_nj_schema" | VERIFIED | Entry at lines 187-193: idx 26, version "7", when 1744243200000, tag "0030_nj_schema", breakpoints true |
| `src/server/db/schema.ts` | workerSex on workers, njPwcNumber + njContractId on projects | VERIFIED | Lines 56-57 (projects), line 117 (workers); all nullable (no .notNull()); Phase 51 comments present |
| `src/server/routes/export.ts` | GET /api/export/nj-mw562/:weekId stub returning 501 | VERIFIED | Lines 1314-1343; correct flow order; 501 response on valid NJ project |
| `src/server/routes/projects.ts` | CreateProjectSchema and UpdateProjectSchema with NJ fields | VERIFIED | Lines 42-43, 69-70 (Zod); lines 104-105, 224-225 (DB writes) |
| `src/server/routes/workers.ts` | workerSex Zod enum, INSERT and UPDATE writes | VERIFIED | Lines 46, 75 (Zod); lines 224, 271 (DB writes) |
| `src/client/components/projects/ProjectForm.tsx` | isNJ + NJ field block with indigo styling | VERIFIED | isNJ line 71; `{isNJ && ...}` block line 359; njPwcNumber/njContractId registered; indigo classes present |
| `src/client/pages/WorkersPage.tsx` | workerSex in editForm; isNJ-gated select; mutation sends workerSex only when isNJ | VERIFIED | editForm state line 150; select lines 606-620; mutation isNJ branch line 269 |
| `src/client/pages/PayrollWeekDetailPage.tsx` | STATE_FORMS NJ entry with route 'nj-mw562' | VERIFIED | Line 483 confirmed |
| `tests/routes/export.test.ts` | 4 NJ tests (404, 400, 501, 403) | VERIFIED | describe block at line 528; all 4 tests present and passing |
| `tests/routes/projects.test.ts` | 2 NJ field round-trip tests | VERIFIED | describe block at line 547; create and PATCH tests passing |
| `tests/routes/workers.test.ts` | 4 workerSex tests | VERIFIED | describe block at line 383; create, round-trip, invalid-rejection, default-null — all passing |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `_journal.json` | `0030_nj_schema.sql` | idx 26 tag entry | WIRED | journal idx 26 tag "0030_nj_schema" matches filename exactly |
| `export.ts` nj-mw562 route | `assertProjectAccess` | called before state gate | WIRED | assertProjectAccess at line 1329; state check at line 1336 — correct order confirmed |
| `PayrollWeekDetailPage.tsx` | `/api/export/nj-mw562/:weekId` | STATE_FORMS NJ route key 'nj-mw562' | WIRED | STATE_FORMS line 483 `route: 'nj-mw562'`; route registered in export.ts line 1314 `/nj-mw562/:weekId` — exact match |
| `WorkersPage.tsx` | `PUT /api/workers/:id` | workerSex sent in isNJ branch of updateWorker mutation | WIRED | Line 269: `...(isNJ ? { workerSex: data.workerSex } : {})` — NJ-only; not sent for other states |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `ProjectForm.tsx` | njPwcNumber, njContractId | react-hook-form `register()` → POST /api/projects → DB INSERT | Yes — projects.ts lines 104-105 write to DB | FLOWING |
| `WorkersPage.tsx` | workerSex | editForm.workerSex → PUT /api/workers/:id → DB UPDATE | Yes — workers.ts line 271 writes to DB; initial value populated from `w.workerSex ?? null` line 136 | FLOWING |
| `PayrollWeekDetailPage.tsx` | STATE_FORMS['NJ'] | Constant registry — drives UI button label and route | N/A (registry entry, not fetched data) | WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| NJ integration tests pass (10 tests) | `npx vitest run tests/routes/workers.test.ts tests/routes/export.test.ts tests/routes/projects.test.ts` | 656 passing, 9 failing (all pre-existing RED stubs — CA project field stubs and a1131 worktree conflicts, none from Phase 51) | PASS |
| Migration file has correct format | Read `0030_nj_schema.sql` | 3 ALTER TABLE statements, 2 `--> statement-breakpoint` separators, arrow format confirmed | PASS |
| Journal entry registered at idx 26 | Read `_journal.json` | idx 26, tag "0030_nj_schema", breakpoints true | PASS |
| Export route assertProjectAccess before state gate | Read export.ts lines 1328-1338 | assertProjectAccess line 1329, state check line 1336 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| NJ-01 | 51-01, 51-02 | NJ worker fields — workerSex (M/F/N) stored and surfaced | SATISFIED | workers.ts Zod enum + DB write; WorkersPage.tsx isNJ-gated select; 4 workers.test.ts tests green |
| NJ-02 | 51-01, 51-02 | NJ project fields and export route — njPwcNumber, njContractId, MW-562 stub | SATISFIED | projects.ts Zod + DB; ProjectForm.tsx isNJ block; export.ts nj-mw562 stub; STATE_FORMS NJ entry; 6 tests green |
| NFR-01 | 51-01 | Migration uses `-->` statement-breakpoint format (not `--`) | SATISFIED | `0030_nj_schema.sql` uses exact `-->` arrow format; 2 separators for 3 statements |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/server/routes/export.ts` | 1342 | `res.status(501)` — intentional stub | Info | By design; Phase 52 fills in the PDF generator; documented in SUMMARY and PLAN |

No stubs, placeholders, or TODO comments found in the Phase 51 modified files. The 501 in export.ts is the explicitly required stub behavior per the phase goal.

### Human Verification Required

#### 1. NJ Project Form Fields Gate

**Test:** Start dev server (`npm run dev`). Create a new project with state = NJ. Confirm the indigo-bordered "New Jersey Project Fields" block with "NJ Public Works Contractor Registration Number" and "NJ Contract ID" inputs appears. Change state to CA, MA, or any other state — confirm the NJ block disappears.
**Expected:** Fields appear only when state = NJ; indigo color scheme (border-indigo-200, bg-indigo-50, text-indigo-800) visually distinct from MA's teal block.
**Why human:** react-hook-form `watch('state')` drives isNJ; conditional rendering requires live browser with session.

#### 2. WorkersPage workerSex Select Gate

**Test:** Navigate to an NJ project's Workers tab. Edit any worker. Confirm "NJ EEO — Sex" select with options "Not reported", "M — Male", "F — Female", "N — Non-binary / Decline to state" is visible. Open a non-NJ project's Workers tab, edit a worker — confirm the select is absent.
**Expected:** Select visible only for NJ project workers; absent for CA, MA, WA, etc.
**Why human:** isNJ depends on project.state fetched from API; requires authenticated browser session.

#### 3. Download NJ MW-562 Button and 501 Response

**Test:** Navigate to any payroll week on an NJ project. Confirm a "Download NJ MW-562" button appears. Click it — confirm a 501 error response (error toast or browser network tab showing HTTP 501). Navigate to a payroll week on a non-NJ project — confirm the NJ button is absent.
**Expected:** Button present for NJ only; click returns 501 until Phase 52 ships the PDF generator.
**Why human:** Button rendering depends on STATE_FORMS lookup driven by live project.state; click behavior needs live server.

### Gaps Summary

No gaps found. All 9 must-have truths are verified at all levels (exists, substantive, wired, data-flowing). The 3 human verification items are routine UI gate confirmations that cannot be tested programmatically — they are expected for any client-rendering phase.

The 9 pre-existing test failures are RED stubs from an earlier phase (CA project fields — 3 `expect(true).toBe(false)` stubs) and a1131 worktree conflicts. None are from Phase 51 work.

---

_Verified: 2026-04-13T00:55:00Z_
_Verifier: Claude (gsd-verifier)_
