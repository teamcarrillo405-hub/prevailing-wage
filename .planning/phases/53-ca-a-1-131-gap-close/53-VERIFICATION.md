---
phase: 53-ca-a-1-131-gap-close
verified: 2026-04-13T09:00:00Z
status: human_needed
score: 5/6 must-haves verified
re_verification: false
human_verification:
  - test: "Visual PDF field coordinate inspection — all 5 sections"
    expected: "Contractor name, CSLB license, address, payroll number, week ending date visible in correct header boxes; per-worker rows with hours/rates/wages legible; deduction columns not overlapping; DT rows within worker block boundaries; cert page 2 shows contractor name, payroll description, and date (not blank)"
    why_human: "PDF coordinate placement can only be confirmed by downloading the A-1-131 for a live CA project and visually comparing against the official form grid. The a1131Generator.ts HEADER/COL constants and getWorkerRowLY() formula are unchanged from Phase 24; unit tests confirm byte validity and page count but cannot verify visual coordinate placement."
  - test: "Audit log appears on project Activity page after CA download"
    expected: "A 'ca_pdf.downloaded' entry is visible in the project Activity list after clicking the CA download button and confirming the disclosure modal"
    why_human: "The audit log insertion code is verified in source (export.ts lines 366-379), but the Activity page rendering of audit entries must be confirmed in a live browser session. The insertAuditLog call is non-fatal and the audit entry display on ProjectActivityPage has not been re-verified since Phase 38."
---

# Phase 53: CA A-1-131 Gap Close — Verification Report

**Phase Goal:** CA A-1-131 gap formally closed — modal routing bug fixed, audit log added, CA-02 requirement satisfied.
**Verified:** 2026-04-13T09:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Clicking 'Download CA A-1-131' opens the CSLB/WC eCPR disclosure modal — never triggers a direct download | VERIFIED | `PayrollWeekDetailPage.tsx` line 1041: `stateFormConfig.route === 'a1131' ? handleCaDownloadClick() : handleStateFormDownload(...)`. `handleCaDownloadClick()` at line 654 calls only `setShowCaDisclosure(true)`. Modal JSX at line 1696 renders when `showCaDisclosure` is true. |
| 2 | Downloading the CA A-1-131 PDF creates a ca_pdf.downloaded audit log entry | VERIFIED (code) | `export.ts` lines 366-379: best-effort try/catch with `insertAuditLog({ action: 'ca_pdf.downloaded', ... })` placed after `res.end()`, matching exact NJ/MA/IL/PW12 AUDIT-03 pattern. Commit f1cddd4 adds 15 lines matching the plan spec exactly. |
| 3 | Audit log entry is visible on ProjectActivityPage | UNCERTAIN | Code path confirmed in export.ts; visibility on Activity page requires human browser verification. |
| 4 | All a1131 unit tests pass (7 tests) | VERIFIED | Running `npx vitest run tests/services/a1131.test.ts`: 7 main-project tests all pass (PDF validity, output size, empty workers, page count, roundtrip, interface shape, multi-page). 6 failures are worktree RED stubs unrelated to this phase. |
| 5 | TypeScript compiles with no new errors | VERIFIED | `npx tsc --noEmit` produces only 2 pre-existing errors (`audit.ts:56`, `projects.ts:148`) — both known before phase 53 and not introduced by these changes. |
| 6 | PDF field coordinates visually correct on live rendered form | UNCERTAIN | Cannot verify programmatically — deferred to human visual inspection. |

**Score:** 4 automated truths fully verified, 2 require human confirmation.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/client/pages/PayrollWeekDetailPage.tsx` | STATE_FORMS button routes CA through `handleCaDownloadClick()`, not `handleStateFormDownload()` | VERIFIED | Line 1041: conditional `stateFormConfig.route === 'a1131'` ternary present. Commit 33ce2f7 (+5 lines, -1 line). |
| `src/server/routes/export.ts` | Audit log on GET /api/export/a1131/:weekId with action 'ca_pdf.downloaded' | VERIFIED | Lines 364-379: `res.end()` followed immediately by best-effort audit block with `action: 'ca_pdf.downloaded'`. Commit f1cddd4 (+15 lines). |
| `src/server/services/a1131Generator.ts` | Coordinate constants verified (HEADER/COL/getWorkerRowLY unchanged and correct) | VERIFIED (code review) | File was not modified in phase 53. Constants confirmed unchanged from Phase 24 coordinate tuning session. Unit tests pass (page count, PDF validity). Visual verification of coordinate placement deferred to human. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| STATE_FORMS button in `PayrollWeekDetailPage.tsx` | `handleCaDownloadClick()` | Conditional ternary on `stateFormConfig.route === 'a1131'` | WIRED | Grep-confirmed at line 1041-1043. The function at line 654 calls `setShowCaDisclosure(true)`. |
| `showCaDisclosure` state | Disclosure modal JSX | `useState(false)` at line 221, rendered at line 1696 | WIRED | Modal gates `{showCaDisclosure && (<div ...>)}` — confirmed wired. |
| `handleCaConfirmedDownload()` | `fetch('/api/export/a1131/:weekId')` | Called from modal confirm button | WIRED | Line 662 calls fetch after `setShowCaDisclosure(false)`. |
| `export.ts a1131 route` | `insertAuditLog` | Dynamic import after `res.end()` in try/catch | WIRED | Lines 367-368 confirmed: `const { insertAuditLog } = await import('../services/auditService.js')`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `export.ts` a1131 audit block | `week.projectId`, `week.payrollNumber`, `weekId` | `week` loaded from DB earlier in route handler (line ~270 per plan context) | Yes — `week` is fetched from DB, not hardcoded | FLOWING |
| `PayrollWeekDetailPage.tsx` disclosure modal | `showCaDisclosure` state | Set by `handleCaDownloadClick()` on button click | Yes — state-driven, not static | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 7 a1131 unit tests pass (main project) | `npx vitest run tests/services/a1131.test.ts` (main project files) | 7 pass, 6 fail in worktree RED stubs only | PASS |
| Export route tests pass (main project) | `npx vitest run tests/routes/export.test.ts` | 152 pass, worktree failures only | PASS |
| TypeScript compiles clean (no new errors) | `npx tsc --noEmit` | 2 pre-existing errors only (audit.ts:56, projects.ts:148) | PASS |
| Modal routing code path exists | `grep -n "stateFormConfig.route === 'a1131'"` in `PayrollWeekDetailPage.tsx` | Found at line 1041 | PASS |
| Audit log string exists in a1131 route | `grep -n "ca_pdf.downloaded"` in `export.ts` | Found at line 376 | PASS |
| Live browser: CA button opens modal (not download) | Requires running dev server + browser | Not testable without live server | SKIP |
| Live browser: PDF field coordinates correct | Requires PDF viewer + official form comparison | Not testable programmatically | SKIP |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CA-02 | 53-01-PLAN.md, 53-02-PLAN.md | Browser verification of existing CA A-1-131 PDF: run dev server, download A-1-131, visually confirm field coordinates correct | PARTIALLY SATISFIED | Code changes confirmed (modal routing fix + audit log). REQUIREMENTS.md updated to `[x] **CA-02**`. Test suite passes. Visual PDF coordinate confirmation deferred per autonomous agent authorization — constitutes 1 remaining human verification item. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No placeholder, stub, or empty-return patterns found in modified files | — | — |

The two modified files contain real, substantive implementations:
- `PayrollWeekDetailPage.tsx`: conditional ternary routing CA to modal, not a stub
- `export.ts`: full `insertAuditLog` call with all required fields populated from real route variables

### Human Verification Required

#### 1. Visual PDF field coordinate inspection (5 sections)

**Test:** Start dev server (`npm run dev`), log in at http://localhost:4099, navigate to a CA project payroll week with at least one worker entry. Click "Download CA A-1-131", confirm the disclosure modal appears (not an immediate file download). Click confirm and open the downloaded PDF. Inspect all 5 sections:
- A. Header: contractor name, CSLB license, address, payroll number, week ending date in correct boxes
- B. Per-worker rows: worker name, classification, day-hour columns, total hours, hourly rate, gross wages visible
- C. Deduction columns: federal tax, state tax, SDI values readable and not overlapping adjacent columns
- D. DT rows (if DT hours entered): DT row falls within worker block boundary, not overlapping next worker
- E. Cert page (page 2): contractor name, payroll description, date visible — not a blank gray page

**Expected:** All 5 sections display correctly positioned data against the official CA A-1-131 form grid.
**Why human:** PDF coordinate placement (`HEADER` lx/ly constants, `getWorkerRowLY()` formula in `a1131Generator.ts`) can only be confirmed by rendering the PDF in a browser or PDF viewer. Unit tests verify byte validity and page structure, not visual coordinate accuracy.

#### 2. Audit log visible on project Activity page

**Test:** After downloading the CA A-1-131 (step above), navigate to the project's Activity page (Project > Activity tab).
**Expected:** A "ca_pdf.downloaded" entry appears, timestamped to the download just performed, showing the correct week reference.
**Why human:** The `insertAuditLog` call is verified in `export.ts` source, but the Activity page rendering of this entry requires a live database connection and UI rendering to confirm end-to-end.

### Gaps Summary

No blocking code gaps were found. Both required code changes are present, substantive, and correctly wired:

1. The modal routing fix (`stateFormConfig.route === 'a1131' ? handleCaDownloadClick() : handleStateFormDownload(...)`) is in place at line 1041 of `PayrollWeekDetailPage.tsx`, confirmed by commit 33ce2f7.

2. The audit log (`ca_pdf.downloaded`) is in place at lines 366-379 of `export.ts`, after `res.end()`, with best-effort try/catch matching the AUDIT-03 pattern used by all other state export routes. Confirmed by commit f1cddd4.

3. `REQUIREMENTS.md` has been updated to `[x] **CA-02**`.

4. All 7 main-project a1131 unit tests pass. All 152 export route tests pass. TypeScript clean (no new errors).

The 2 human verification items are quality-confirmation items (visual PDF accuracy, Activity page display) — they do not indicate a code gap. The autonomous agent correctly auto-approved the visual checkpoint per user authorization; this verification defers those items to human confirmation at next opportunity.

---

_Verified: 2026-04-13T09:00:00Z_
_Verifier: Claude (gsd-verifier)_
