---
phase: 34-agency-submission-status-tracking
verified: 2026-03-30T00:00:00Z
status: passed
score: 11/11 must-haves verified
re_verification: false
---

# Phase 34: Agency Submission Status Tracking — Verification Report

**Phase Goal:** Add CA eCPR and WA L&I submission status tracking to payroll weeks, with modal submit buttons and independent per-agency badge rows.
**Verified:** 2026-03-30
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                           | Status     | Evidence                                                                                  |
|----|-----------------------------------------------------------------------------------------------------------------|------------|-------------------------------------------------------------------------------------------|
| 1  | PATCH /weeks/:id/ca-submit with {submitted:true} sets ca_ecpr_submitted_at to current ISO timestamp            | VERIFIED   | Route at line 341 calls `setCaEcprSubmitted(weekId)` which writes `new Date().toISOString()` |
| 2  | PATCH /weeks/:id/wa-submit with {submitted:true} sets wa_lni_submitted_at to current ISO timestamp             | VERIFIED   | Route at line 368 calls `setWaLniSubmitted(weekId)` which writes `new Date().toISOString()` |
| 3  | Both routes accept {submitted:false} to clear the respective timestamp back to null                            | VERIFIED   | Ternary in each route: `submitted ? set... : clear...`; clear functions set null            |
| 4  | Neither route enforces WH-347 edit lock (submittedAt guard not applied)                                        | VERIFIED   | No `assertWeekNotSubmitted` call in either route; comment explicitly notes D-05 decision   |
| 5  | Both routes require auth and assertProjectAccess                                                               | VERIFIED   | `req.user!.userId` + `assertProjectAccess(db, week.projectId, userId)` in both routes      |
| 6  | After CA eCPR XML download, modal step 2 shows "Mark as Submitted to CA DIR" button                           | VERIFIED   | Line 1305: `'Mark as Submitted to CA DIR'`; wired to `caSubmitMutation`                   |
| 7  | After WA CPR XML download, new step 2 shows "Mark as Submitted to WA L&I" button                              | VERIFIED   | `waCprStep` state at line 160; `setWaCprStep(2)` at line 408 after download; step 2 JSX at line 1362+ |
| 8  | Payroll Week Detail shows CA DIR submission badge (amber) only when project.state === 'CA'                     | VERIFIED   | `{isCA && ( ... <Badge variant="warning">CA DIR Submitted</Badge> ... )}` at line 785     |
| 9  | Payroll Week Detail shows WA L&I submission badge (gray) only when project.state === 'WA'                      | VERIFIED   | `{isWA && ( ... <Badge variant="neutral">WA L&amp;I Submitted</Badge> ... )}` at line 814 |
| 10 | Un-submit on any agency badge clears that agency only, no confirmation modal                                   | VERIFIED   | Direct `onClick={() => caUnsubmitMutation.mutate()}` / `waUnsubmitMutation.mutate()` with no confirm dialog |
| 11 | WH-347 submission badge (green) is unaffected by CA/WA submission state                                       | VERIFIED   | CA/WA badge rows added below WH-347 section; separate mutations; no cross-mutation calls  |

**Score:** 11/11 truths verified

---

### Required Artifacts

| Artifact                                              | Expected                                                         | Status    | Details                                                                                          |
|-------------------------------------------------------|------------------------------------------------------------------|-----------|--------------------------------------------------------------------------------------------------|
| `src/server/db/migrations/0019_agency_submission.sql` | Two ALTER TABLE ADD COLUMN statements                            | VERIFIED  | Exists; contains both `ca_ecpr_submitted_at` and `wa_lni_submitted_at` ALTER statements         |
| `src/server/db/migrations/meta/_journal.json`         | Entry at idx 15 with tag "0019_agency_submission"               | VERIFIED  | Entry present at idx 15, `"tag": "0019_agency_submission"`, `"breakpoints": true`               |
| `src/server/db/schema.ts`                             | caEcprSubmittedAt and waLniSubmittedAt on payrollWeeks           | VERIFIED  | Lines 164-165 in `payrollWeeks` table definition                                                 |
| `src/server/services/payrollService.ts`               | setCaEcprSubmitted, clearCaEcprSubmitted, setWaLniSubmitted, clearWaLniSubmitted | VERIFIED  | All four functions exported at lines 342, 354, 367, 379                                    |
| `src/server/routes/payroll.ts`                        | PATCH /weeks/:id/ca-submit and /weeks/:id/wa-submit routes       | VERIFIED  | Routes at lines 340 and 367; AgencySubmitSchema at line 98; service imports at lines 21-24      |
| `src/client/pages/PayrollWeekDetailPage.tsx`          | waCprStep, caSubmitMutation, waSubmitMutation, CA/WA badge rows  | VERIFIED  | All present: waCprStep (160), caSubmitMutation (188), waSubmitMutation (198), badge rows (785, 814) |

---

### Key Link Verification

| From                              | To                                          | Via                                   | Status   | Details                                                                                                     |
|-----------------------------------|---------------------------------------------|---------------------------------------|----------|-------------------------------------------------------------------------------------------------------------|
| `src/server/routes/payroll.ts`    | `src/server/services/payrollService.ts`     | setCaEcprSubmitted / clearCaEcprSubmitted / setWaLniSubmitted / clearWaLniSubmitted | WIRED | Imported at lines 21-24; called in route handlers at lines 362-363 and 389-390 |
| `src/server/db/schema.ts`         | `src/server/db/migrations/0019_agency_submission.sql` | schema columns match migration | WIRED | `caEcprSubmittedAt: text('ca_ecpr_submitted_at')` and `waLniSubmittedAt: text('wa_lni_submitted_at')` match SQL column names exactly |
| `PayrollWeekDetailPage.tsx`       | `/api/payroll/weeks/:id/ca-submit`          | useMutation calling api.patch         | WIRED    | Line 189: `api.patch(\`/payroll/weeks/${weekId}/ca-submit\`, { submitted: true })`                          |
| `PayrollWeekDetailPage.tsx`       | `/api/payroll/weeks/:id/wa-submit`          | useMutation calling api.patch         | WIRED    | Line 199: `api.patch(\`/payroll/weeks/${weekId}/wa-submit\`, { submitted: true })`                          |

---

### Data-Flow Trace (Level 4)

| Artifact                        | Data Variable       | Source                                              | Produces Real Data | Status   |
|---------------------------------|---------------------|-----------------------------------------------------|--------------------|----------|
| `PayrollWeekDetailPage.tsx`     | `week.caEcprSubmittedAt` | GET /weeks/:id → `getPayrollWeek` → `db.select().from(payrollWeeks)` | Yes — Drizzle `select()` returns all columns including new schema fields | FLOWING |
| `PayrollWeekDetailPage.tsx`     | `week.waLniSubmittedAt`  | Same GET endpoint via `queryClient.invalidateQueries` after mutation | Yes — mutation invalidates cache, re-fetches from DB | FLOWING |

Note: `getPayrollWeek` uses `db.select()` (select all columns), so the new `caEcprSubmittedAt`/`waLniSubmittedAt` schema fields are automatically included in the query response. The frontend `Week` interface at lines 30-31 declares both fields as `string | null`.

---

### Behavioral Spot-Checks

| Behavior                                          | Command                                                                                 | Result  | Status |
|---------------------------------------------------|-----------------------------------------------------------------------------------------|---------|--------|
| TypeScript compiles (payroll files)               | `npx tsc --noEmit` — grep for payroll/schema errors                                    | 0 errors in phase files | PASS |
| TypeScript overall                                | `npx tsc --noEmit`                                                                      | 1 pre-existing error in `projects.ts` (line 110, unrelated parameter `r`) — not introduced by this phase | PASS (no regressions) |
| Migration file has correct SQL                    | File read                                                                               | Both ALTER TABLE statements present with correct column names | PASS |
| Journal entry registered at idx 15               | File read                                                                               | idx 15, tag "0019_agency_submission" confirmed | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description                                                                                                      | Status    | Evidence                                                                                                   |
|-------------|-------------|------------------------------------------------------------------------------------------------------------------|-----------|------------------------------------------------------------------------------------------------------------|
| AS-01       | Plan 01, 02 | After downloading CA eCPR XML, user can mark submission as submitted; `caEcprSubmittedAt` timestamp recorded; badge shown | SATISFIED | Migration adds `ca_ecpr_submitted_at`; schema has `caEcprSubmittedAt`; PATCH route sets timestamp; CA modal step 2 has button; detail page badge shown when `isCA` |
| AS-02       | Plan 01, 02 | After downloading WA L&I CPR XML, user can mark submission as submitted; `waLniSubmittedAt` timestamp recorded; badge shown | SATISFIED | Migration adds `wa_lni_submitted_at`; schema has `waLniSubmittedAt`; PATCH route sets timestamp; WA modal has new step 2 with button; detail page badge shown when `isWA` |

No orphaned requirements — both AS-01 and AS-02 are the only IDs mapped to Phase 34 in REQUIREMENTS.md traceability table.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found | — | — |

No TODOs, FIXMEs, placeholder returns, or empty implementations found in any phase-modified files.

---

### Human Verification Required

#### 1. CA eCPR Modal Step 2 "Mark as Submitted" Flow

**Test:** On a CA project, open a payroll week, click "Generate CA eCPR XML" to download the file. Confirm modal advances to step 2. Click "Mark as Submitted to CA DIR". Verify the button changes to submitted state and the badge updates in the Submission Status panel.
**Expected:** Button shows "Saving...", then modal shows "CA DIR Submitted" badge with date and Un-submit link. Submission Status panel shows amber "CA DIR Submitted" badge.
**Why human:** Requires running app, triggering file download event, and observing UI state transitions.

#### 2. WA CPR Modal Step 2 "Mark as Submitted" Flow

**Test:** On a WA project, open a payroll week, complete the WA CPR XML export (provide intentId). Confirm modal advances to step 2 with upload instructions. Click "Mark as Submitted to WA L&I". Verify submitted state.
**Expected:** Button shows "Saving...", then modal shows gray "WA L&I Submitted" badge with date. Submission Status panel shows gray "WA L&I Submitted" badge.
**Why human:** Requires running app and completing the two-step WA modal flow.

#### 3. Un-submit clears only the target agency

**Test:** Mark both CA DIR and WA L&I as submitted on a dual-state test (or verify independently). Click "Un-submit" on CA badge. Verify WA badge is unchanged and WH-347 badge is unchanged.
**Expected:** Only CA badge reverts to "Not Submitted to CA DIR". WA and WH-347 badges retain their state.
**Why human:** Requires running app and observing cross-badge independence.

---

## Gaps Summary

None. All automated checks passed. Phase 34 fully achieves its goal.

- Database migration adds both agency timestamp columns with correct SQL syntax.
- Drizzle schema registers both fields on `payrollWeeks`.
- Migration journal registers the migration at the correct idx (15).
- Four service functions (set/clear for CA and WA) are substantive and correct.
- Both PATCH routes are wired, auth-guarded, access-checked, and explicitly skip the WH-347 edit lock per the design decision.
- The GET endpoint returns the new fields automatically via `db.select()`.
- `PayrollWeekDetailPage.tsx` has the `Week` interface extended, all four mutations defined, `waCprStep` state managing the WA two-step modal, "Mark as Submitted" buttons in both modals, and per-agency badge rows correctly state-gated by `isCA`/`isWA`.

---

_Verified: 2026-03-30_
_Verifier: Claude (gsd-verifier)_
