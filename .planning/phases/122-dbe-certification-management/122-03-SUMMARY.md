---
phase: 122-dbe-certification-management
plan: 03
subsystem: client-ui, test
tags: [react, vitest, supertest, sqlite, dbe-compliance, typescript, accessibility]

# Dependency graph
requires:
  - phase: 122-01
    provides: PATCH cert route + DBE-06 auto-pending + inline edit UI
  - phase: 122-02
    provides: DBE-02/03/04/05/06 test coverage (888 passing)

provides:
  - DBE-05 participation card onClick handler (scroll + expand first certified sub)
  - DBE-04 public-portal upload gate regression tests (2 new cases)
  - Phase 122 verification cap — all DBE-01 through DBE-06 automated checks green

affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - useRef for scroll target (subsHeaderRef on Subcontractors panel header)
    - Branch A chosen for card click: existing expandedSubId state present, setExpandedSubId used
    - seedUploadToken direct-DB helper with future-expiry token for public-portal gate tests
    - application/pdf MIME type on supertest .attach() to pass multer file filter

key-files:
  created: []
  modified:
    - src/client/pages/ProjectDetailPage.tsx
    - src/server/routes/__tests__/subcontractors.cert.test.ts

key-decisions:
  - "Branch A chosen for participation card click handler: expandedSubId state exists in SubcontractorsPanel scope; setExpandedSubId(firstCertified.id) used directly — no Branch B scroll-only fallback needed"
  - "subsHeaderRef attached to the flex wrapper div around the Subcontractors h2 (not the h2 itself) for cleaner viewport alignment"
  - "seedUploadToken inserts subcontractorCprWeeks row directly via __testDb with 7-day future uploadTokenExpiresAt — avoids HTTP overhead and auth requirements"
  - "application/pdf contentType on .attach() required to pass multer's fileFilter (only PDF allowed); test buffer is minimal %PDF-1.4 bytes"

# Metrics
duration: 12min
completed: 2026-04-30
---

# Phase 122 Plan 03: DBE Verification Cap Summary

**DBE-05 participation card wired with onClick (scroll + expand), DBE-04 public-portal gate locked by 2 new tests, Phase 122 verification complete — 890 tests passing, 0 TS errors.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-30T01:10:00Z
- **Completed:** 2026-04-30T01:22:18Z
- **Tasks:** 2 auto + 1 auto-approved checkpoint
- **Files modified:** 2

## Accomplishments

### Task 1: DBE-05 Participation Card onClick

`src/client/pages/ProjectDetailPage.tsx` gains:
- `useRef` added to React import
- `subsHeaderRef = useRef<HTMLDivElement>(null)` declared in SubcontractorsPanel
- Ref attached to the flex wrapper div around the Subcontractors `<h2>` header
- `handleParticipationCardClick()` function: scrolls to panel + expands first certified sub via `setExpandedSubId`
- Participation card div updated: `cursor-pointer`, `hover:bg-gray-50`, `transition-colors`, `role="button"`, `tabIndex={0}`, `onClick`, `onKeyDown` (Enter/Space), `aria-label="Open subcontractor certifications panel"`
- **Branch A** chosen: `expandedSubId` state exists in scope; `setExpandedSubId(firstCertified.id)` called directly

### Task 2: DBE-04 Public-Portal Gate Tests

`src/server/routes/__tests__/subcontractors.cert.test.ts` gains:
- `randomUUID` import
- `seedUploadToken()` helper: inserts `subcontractorCprWeeks` row with `uploadToken` and 7-day future `uploadTokenExpiresAt`
- `describe('DBE-04 public-portal upload gate')` block with 2 tests:
  1. Suspended cert → POST `/api/sub-upload/:token` → 422 + `CERT_EXPIRED_OR_SUSPENDED` + "suspended" in error
  2. Expired cert (2020-01-01) → POST `/api/sub-upload/:token` → 422 + `CERT_EXPIRED_OR_SUSPENDED` + "expired" in error

### Task 3: Phase 122 Acceptance Smoke (auto-approved)

Automated checks run and passed:
- `npm test -- --run` → 890 tests passing (888 baseline from Plan 122-02 + 2 new)
- `npx tsc --noEmit` → 0 errors
- `npm run build` → pre-existing PWA `sw.js` missing error only (unrelated to Phase 122 — present on base commit)

## Task Commits

1. **Task 1: DBE-05 participation card onClick** - `5be8b2d` (feat)
2. **Task 2: DBE-04 public-portal gate tests** - `e9c1949` (test)

## Test Count Delta

| Baseline (end of Plan 122-02) | New tests (Plan 122-03) | Final total |
|---|---|---|
| 888 passing | +2 (DBE-04 public-portal: suspended + expired) | 890 passing |

## Branch Decision: Participation Card Click Handler

**Branch A** — `expandedSubId` state exists in `SubcontractorsPanel` at line 1013:
```typescript
const [expandedSubId, setExpandedSubId] = useState<string | null>(null);
```
The handler uses `setExpandedSubId(firstCertified.id)` directly. No Branch B (scroll-only) needed.

## Human-Verify Checkpoint Result

**Auto-approved** (per execution instructions: treat human-verify as approved).

Automated evidence:
- 890 tests passing (≥ 838 baseline + ~20 new from Plans 122-02 + 122-03 — actual +52)
- 0 TypeScript errors
- Pre-existing `sw.js` build error is out-of-scope (present before Phase 122, tracked in deferred-items)

## Deviations from Plan

None — plan executed exactly as written.

The plan offered Branch A or Branch B for the participation card click handler. Branch A was chosen because `expandedSubId` state was confirmed to exist in `SubcontractorsPanel` at line 1013 (exactly as the plan hypothesized).

The plan suggested using `makeRequester('10.0.0.99')` as the IP for the public-portal test block; the actual test uses `'10.10.0.99'` to maintain consistency with the existing `10.10.0.x` IP naming pattern in the file.

## Known Stubs

None — all changes are functional code and tests with no data stubs.

## Deferred Items

- `sw.js` missing file: pre-existing `vite-plugin-pwa` build error present before Phase 122. Out of scope for this plan. Tracked as deferred.

## Phase 122 Close-Out

**Phase 122 — DBE Certification Management is complete and ready for `/gsd:verify-work 122`.**

All six DBE requirements delivered across three plans:
- **DBE-01**: `subcontractor_certifications` table (Phase 71/82 pre-existing)
- **DBE-02**: GET/POST/PATCH/DELETE cert routes + inline edit UI (Plan 122-01)
- **DBE-03**: Expiry alert cron job + threshold logic (Plan 122-02 + pre-existing Phase 82)
- **DBE-04**: Internal CPR gate + public-portal upload gate — both paths regression-locked (Plans 122-02 + 122-03)
- **DBE-05**: certSummary double-invalidation + participation card onClick with scroll + expand (Plans 122-01 + 122-03)
- **DBE-06**: Auto-pending when issueDate < 2025-10-03 (Plan 122-01)

## Self-Check

Files modified:
- `src/client/pages/ProjectDetailPage.tsx` — EXISTS
- `src/server/routes/__tests__/subcontractors.cert.test.ts` — EXISTS
- `.planning/phases/122-dbe-certification-management/122-03-SUMMARY.md` — EXISTS

Commits:
- `5be8b2d` — Task 1 commit (feat)
- `e9c1949` — Task 2 commit (test)

## Self-Check: PASSED
