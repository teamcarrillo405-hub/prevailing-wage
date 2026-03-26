---
phase: 25
plan: 02
subsystem: ui
tags: [washington, f700, pdf-export, ui, prevailing-wage]
dependency_graph:
  requires: [25-01]
  provides: [WAL-01, WAL-02]
  affects: [PayrollWeekDetailPage, WorkersPage, ProjectForm]
tech_stack:
  added: []
  patterns: [state-gated-ui, blob-url-download, pwia-disclosure-modal, wa-trade-codes-select]
key_files:
  created: []
  modified:
    - src/client/components/projects/ProjectForm.tsx
    - src/client/pages/WorkersPage.tsx
    - src/client/pages/PayrollWeekDetailPage.tsx
decisions:
  - PWIA disclosure modal always fires on WA download — not conditional on violations (regulatory, not compliance gate)
  - waGeneratingRef is a new independent ref — must not reuse generatingRef or caGeneratingRef (synchronous guard isolation)
  - WA manual rate (waManualRate) stored per classification because SAM.gov wage data does not cover Washington
  - WA trade code select uses 16 static 4-letter L&I codes from WA_TRADE_CODES constant in f700Generator
metrics:
  duration: ~45 min
  completed: "2026-03-26T00:01:07Z"
  tasks_completed: 5
  files_modified: 3
---

# Phase 25 Plan 02: Washington F700-065-000 UI Integration Summary

WA L&I F700-065-000 UI wired end-to-end: project form collects WA credentials (UBI, L&I cert, WC account), workers page collects waManualRate and waTradeCode per classification, and PayrollWeekDetailPage adds state-gated download button with PWIA disclosure modal on every click.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 25-02-01 | f700Generator service (Wave 2 — done in Plan 01) | e3696ad |
| 25-02-02 | Export route GET /api/export/f700/:weekId (Wave 2 — done in Plan 01) | f90990c |
| 25-02-03 | ProjectForm WA conditional fields (ubiNumber, lniCertificate, wcAccount) | 127fd0a |
| 25-02-04 | WorkersPage WA manual rate and trade code inputs | 6572f64 |
| 25-02-05 | PayrollWeekDetailPage WA download button + PWIA disclosure modal | aed50c3 |

## Implementation Details

### Task 25-02-03 — ProjectForm
- Added `ubiNumber`, `lniCertificate`, `wcAccount` to Zod schema (all optional)
- Added `isWA = stateValue?.toUpperCase() === 'WA'` state gate
- WA fields rendered in blue bordered section (border-blue-200 bg-blue-50) after existing CA amber block
- Mirrors CA CSLB/WC pattern with matching label/input structure

### Task 25-02-04 — WorkersPage
- Added `ProjectInfo` interface and project query using `['project', projectId]` query key
- Added `waManualRate: ''` and `waTradeCode: ''` to `blankWorkerForm()` and `extraClass` initial state
- WA Prevailing Wage section (blue box) appears when `isWA === true` with rate input and 16-option trade code select
- Section added to both: primary Add Worker form and Add Another Trade extra classification form
- `addWorker` and `addClassification` mutations pass WA fields when `isWA` is true
- All form reset paths updated to include new fields (TypeScript guard)

### Task 25-02-05 — PayrollWeekDetailPage
- `ProjectData` interface extended with `ubiNumber`, `lniCertificate`, `wcAccount` (all `string | null`)
- `showWaDisclosure` useState + `waGeneratingRef` useRef added (isolated from WH-347 and CA refs)
- `handleWaDownloadClick()`: unconditionally calls `setShowWaDisclosure(true)` — no violation check
- `handleWaConfirmedDownload()`: waGeneratingRef guard → fetch `/api/export/f700/${weekId}` → blob → createObjectURL → click → setTimeout(revokeObjectURL)
- WA button placed in header button group after CA button, gated by `isWA && weekId`
- PWIA modal: L&I portal link, missing-field warning (ubiNumber/lniCertificate/wcAccount), Cancel + Download PDF buttons

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree branch out of sync with Plan 01 commits**
- **Found during:** Task 25-02-03 (pre-execution)
- **Issue:** This worktree (agent-a9d5961e) was at commit dc23dde (research phase). Plan 01 commits (e3696ad, f90990c, d0aca9c) were on master but not in this branch. `git merge master` reported "already up to date" from worktree's perspective.
- **Fix:** Used `git merge d0aca9c --no-edit` to fast-forward by commit hash directly
- **Files modified:** All Plan 01 files (f700Generator.ts, export.ts, schema.ts, migrations)
- **Commit:** Resolved via merge (no separate commit)

**2. [Rule 1 - Bug] WorkersPage TypeScript TS2345 on extraClass reset**
- **Found during:** Task 25-02-04
- **Issue:** The "+ Trade" button reset extraClass to an object missing the new `waManualRate` and `waTradeCode` fields, causing TS2345 type error
- **Fix:** Updated all reset paths in the Add Another Trade form to include `waManualRate: ''` and `waTradeCode: ''`
- **Files modified:** `src/client/pages/WorkersPage.tsx`
- **Commit:** Included in 6572f64

## Test Results

All 275 tests passing, 42 todo, 0 failures.

Relevant passing test suites:
- `tests/services/f700.test.ts` — 14 tests (PDF validity, multi-page, WA_TRADE_CODES)
- `tests/routes/export.test.ts` — 10 tests (5 f700 + 5 a1131, state gate)
- `tests/routes/projects.test.ts` — 32 tests (3 WA project fields)
- `tests/routes/workers.test.ts` — 5 tests (3 waManualRate)

## Self-Check: PASSED

- PayrollWeekDetailPage.tsx: FOUND
- WorkersPage.tsx: FOUND
- ProjectForm.tsx: FOUND
- Commit aed50c3: FOUND
- Commit 6572f64: FOUND
- Commit 127fd0a: FOUND
