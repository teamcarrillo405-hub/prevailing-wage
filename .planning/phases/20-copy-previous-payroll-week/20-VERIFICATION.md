---
phase: 20-copy-previous-payroll-week
verified: 2026-03-23T15:32:00Z
status: human_needed
score: 11/11 must-haves verified
re_verification: false
human_verification:
  - test: "With at least one payroll week on a project, click '+ New Week' and verify a modal appears with 'Start Fresh' and 'Copy Previous Week' options"
    expected: "Modal opens immediately with two clearly labeled choice buttons"
    why_human: "JSX rendering and modal open/close interaction can only be confirmed visually in the browser"
  - test: "Click 'Copy Previous Week', confirm source week selector shows, payroll number auto-increments to max+1, week ending date auto-populates to source +7 days"
    expected: "Configure step pre-populates all three fields correctly without user input"
    why_human: "Auto-population math and select rendering require live data to verify"
  - test: "Click 'Preview Copy' and inspect the preview step — verify copied-entry count is shown and skipped entries (if any) are listed with human-readable reasons in an amber warning box"
    expected: "Preview step renders copied count, amber warning list for any skipped entries with reasons such as 'Worker is no longer active'"
    why_human: "PAY-02 compliance output is a visual warning — cannot confirm rendering without browser"
  - test: "Click 'Confirm Copy' and verify navigation lands on the new week's detail page with pre-filled hours from the source week"
    expected: "Browser navigates to /projects/:projectId/payroll/:newWeekId with entries visible"
    why_human: "Navigation outcome and entry pre-fill require end-to-end browser execution"
  - test: "On a project with zero payroll weeks, click '+ New Week' — verify it navigates directly to /payroll/new with no modal"
    expected: "No modal appears; browser navigates directly to the new week form"
    why_human: "Conditional branch behavior (weeks.length === 0) must be confirmed at runtime"
---

# Phase 20: Copy Previous Payroll Week — Verification Report

**Phase Goal:** Contractors can pre-fill a new payroll week from the prior week's worker and hour data, with compliance-safe live rate re-fetch
**Verified:** 2026-03-23T15:32:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1 | POST /api/payroll/weeks/copy with preview=true returns copied[] and skipped[] without creating a DB row | VERIFIED | Test 1 passes: `weekId: null` returned, no week created |
| 2 | POST /api/payroll/weeks/copy with preview=false creates a new payroll week and inserts entries with fresh wage rates | VERIFIED | Tests 2 + 3 pass: weekId returned, fresh rates confirmed (55/22 not source 50/25) |
| 3 | Inactive workers appear in skipped[] with reason 'worker-inactive' | VERIFIED | Test 4 passes: `skipped[0].reason === 'worker-inactive'` |
| 4 | Entries whose tradeCode has no WD rate match appear in skipped[] with reason 'rate-lookup-failed' | VERIFIED | Test 5 passes: `skipped[0].reason === 'rate-lookup-failed'` |
| 5 | Copied entries have freshly fetched baseRateSnapshot/fringeRateSnapshot — never cloned from source | VERIFIED | Test 3 passes: rates come from WD cache, not source entry values |
| 6 | New week has null submittedAt, submittedTo, amendmentNumber, originalWeekId | VERIFIED | Test 6 passes: all four columns confirmed null |
| 7 | When weeks exist, clicking '+ New Week' opens a modal with 'Start Fresh' and 'Copy Previous Week' options | VERIFIED (code) / NEEDS HUMAN (visual) | JSX renders conditional modal at line 247; `handleNewWeekClick()` at line 96-105 sets `showModal=true` when `weeks.length > 0` |
| 8 | When no weeks exist, clicking '+ New Week' navigates directly to the new week form | VERIFIED (code) / NEEDS HUMAN (visual) | `if (weeks.length === 0) navigate(...)` at line 97-99 |
| 9 | 'Copy Previous Week' shows source week selector, pre-populates payrollNumber and weekEndingDate | VERIFIED (code) | `handleChooseCopy()` at line 107-113 sets `sourceWeekId=weeks[0].id`, `payrollNumber=max+1`, `weekEndingDate=source+7` |
| 10 | Preview step shows skipped entries with reasons before user confirms | VERIFIED (code) / NEEDS HUMAN (visual) | Amber warning block at lines 364-380 renders skipped with `formatSkipReason()` mapping |
| 11 | Confirming copy creates the week and navigates to the new week's detail page | VERIFIED (code) / NEEDS HUMAN (browser) | `handleConfirmCopy()` at lines 146-167 calls `preview:false` then `navigate(...)` |

**Score:** 11/11 truths verified (6 fully automated, 5 code-verified + human confirmation needed for browser behavior)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/server/services/payrollService.ts` | `copyPayrollWeek()` service function | VERIFIED | Exports `copyPayrollWeek`, `CopyWeekInput`, `CopyWeekResult`, `CopiedEntry`, `SkippedEntry` — lines 17-46, 285-411 |
| `src/server/routes/payroll.ts` | POST /api/payroll/weeks/copy route | VERIFIED | `router.post('/weeks/copy', ...)` at line 117, placed before `GET /weeks/:id` at line 142 |
| `tests/routes/payroll.test.ts` | Copy endpoint integration tests | VERIFIED | 9-test `describe('POST /api/payroll/weeks/copy — PAY-01 + PAY-02')` block; all 9 tests pass |
| `src/client/pages/PayrollListPage.tsx` | Copy modal UI with preview/confirm flow | VERIFIED | 418-line file with full three-step modal (choose/configure/preview), all state, handlers, and JSX present |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/server/routes/payroll.ts` | `src/server/services/payrollService.ts` | `import copyPayrollWeek` | WIRED | `copyPayrollWeek` imported at line 18, called at line 131 |
| `src/server/services/payrollService.ts` | `src/server/services/wageCache.ts` | `getCachedWd + getCachedClassifications` | WIRED | Imported at line 12, called at lines 301 and 306 |
| `src/server/services/payrollService.ts` | `src/server/services/wageLookup.ts` | `lookupWageDetermination` fallback | WIRED | Imported at line 13, used in nullish-coalescing at line 302 |
| `src/client/pages/PayrollListPage.tsx` | `/api/payroll/weeks/copy` | `api.post` with `preview:true` then `preview:false` | WIRED | `api.post('/payroll/weeks/copy', {..., preview: true})` at line 129; `api.post('/payroll/weeks/copy', {..., preview: false})` at line 152 |

All four key links: WIRED.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PAY-01 | 20-01-PLAN.md, 20-02-PLAN.md | User can copy a previous payroll week to pre-fill a new week with worker/hour data and live rate re-fetch per classification | SATISFIED | Service function `copyPayrollWeek()` fetches live WD rates and preserves source daily hours; UI modal completes the end-to-end flow; 9 integration tests pass |
| PAY-02 | 20-01-PLAN.md, 20-02-PLAN.md | System shows which entries were skipped during copy (worker no longer active, rate lookup failed) before confirming | SATISFIED | `skipped[]` array with `reason` enum returned by API; preview step in UI renders amber warning box per skipped entry with `formatSkipReason()` human-readable mapping |

No orphaned requirements — both PAY-01 and PAY-02 are fully accounted for.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/server/routes/workers.ts` | 109, 116 | Implicit `any` parameters | Info | Pre-existing known issue documented in CLAUDE.md — not introduced by phase 20, non-fatal |

No anti-patterns found in any phase-20-modified files (`payrollService.ts`, `payroll.ts`, `PayrollListPage.tsx`, `payroll.test.ts`).

**Compliance rules verified (from CLAUDE.md):**
- `baseRateSnapshot`/`fringeRateSnapshot` are never copied from source — always re-fetched from WD cache (line 402-403 of payrollService.ts)
- `createPayrollWeek()` is called without submittedAt/submittedTo/amendmentNumber/originalWeekId — they remain null by schema default
- Rate 0 is never used as a fallback when `rateMap.get(tradeCode)` returns undefined — entry is skipped instead (lines 347-350)
- `useRef` (not `useState`) used as synchronous double-click guard in the UI (line 75, lines 124-125, 147-148)

---

### Human Verification Required

The server-side behavior (all 9 copy tests) is fully verified. The following items require a browser session:

#### 1. Modal opens on "+ New Week" click (when weeks exist)

**Test:** Navigate to a project with at least 1 payroll week. Click the "+ New Week" button.
**Expected:** A modal appears with two options — "Start Fresh" and "Copy Previous Week".
**Why human:** Modal rendering and button click response cannot be confirmed without a live browser.

#### 2. Configure step auto-populates correctly

**Test:** In the modal, click "Copy Previous Week". Inspect the configure step fields.
**Expected:** Source week selector defaults to the most recent week. Payroll number shows max existing + 1. Week ending date shows source week date + 7 days.
**Why human:** The auto-population math runs client-side with live data — must be confirmed with real week records.

#### 3. Preview step renders skipped-entry warnings (PAY-02)

**Test:** On a project where at least one worker is inactive or has an unresolvable trade code, run Preview Copy.
**Expected:** Amber warning box appears listing each skipped worker by name, trade description, and a human-readable reason string ("Worker is no longer active" / "Wage rate not found in current determination").
**Why human:** The compliance warning display is the core of PAY-02 — user must confirm the amber box renders and reasons are readable.

#### 4. Confirm Copy navigates to the new week

**Test:** After preview, click "Confirm Copy".
**Expected:** Modal closes and browser navigates to `/projects/:projectId/payroll/:newWeekId`. New week detail page shows pre-filled entries with hours from the source week.
**Why human:** Navigation outcome and entry pre-fill require end-to-end browser execution with a real database write.

#### 5. Direct navigation when no weeks exist

**Test:** On a project with zero payroll weeks, click "+ New Week".
**Expected:** No modal appears. Browser navigates directly to `/projects/:projectId/payroll/new`.
**Why human:** The `weeks.length === 0` branch must be confirmed with a real project state.

---

### Gaps Summary

No gaps found. All automated checks pass:

- Service function `copyPayrollWeek()` is fully implemented (not a stub) with live rate re-fetch, worker-active check, and trade-code rate map lookup.
- Route `POST /api/payroll/weeks/copy` is registered correctly (before the `GET /weeks/:id` wildcard) with Zod validation, 404/403 guards, and 200/201 status differentiation.
- All 9 integration tests pass verifying all 6 truths from Plan 01: preview mode, commit mode, fresh rates, inactive-worker skip, rate-lookup-failed skip, and null submission flags.
- `PayrollListPage.tsx` implements the full three-step modal (choose/configure/preview), `useRef` double-click guard, and both API calls (`preview:true` and `preview:false`).
- TypeScript errors in workers.ts (lines 109/116) are pre-existing, documented in CLAUDE.md, and not introduced by this phase.

Status is `human_needed` because the UI flow (modal rendering, form pre-population, amber warning display, post-confirm navigation) requires browser confirmation that code-level inspection cannot substitute for.

---

_Verified: 2026-03-23T15:32:00Z_
_Verifier: Claude (gsd-verifier)_
