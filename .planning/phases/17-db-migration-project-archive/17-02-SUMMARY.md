---
phase: 17-db-migration-project-archive
plan: 02
subsystem: ui
tags: [react, tanstack-query, archive, restore, compliance-modal]

# Dependency graph
requires:
  - phase: 17-01
    provides: "GET /api/projects?status=all, DELETE /api/projects/:id, PATCH /api/projects/:id restore, GET /api/compliance/project/:id"
provides:
  - "Archived badge (neutral) on ProjectCard for closed projects with opacity-70"
  - "Show Archived toggle on DashboardPage switching query key and API endpoint"
  - "Archive/Restore buttons on ProjectDetailPage with archiveMutation and restoreMutation"
  - "Compliance advisory modal before archive when violations exist"
affects: [phase-18-dashboard, phase-19-submission-tracking]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useMutation + invalidateQueries for archive/restore with optimistic UI invalidation"
    - "queryClient.fetchQuery for pre-archive compliance check before showing modal"
    - "TanStack Query key includes showArchived state: ['projects', 'all'|'active']"

key-files:
  created: []
  modified:
    - src/client/components/projects/ProjectCard.tsx
    - src/client/pages/DashboardPage.tsx
    - src/client/pages/ProjectDetailPage.tsx

key-decisions:
  - "Compliance check uses fetchQuery (not useQuery) so it runs imperatively on button click"
  - "Archive never blocks — advisory is informational only (Archive Anyway remains available)"
  - "Query key includes showArchived toggle value to maintain separate TanStack cache buckets"

patterns-established:
  - "Pattern: Pre-action advisory — fetchQuery compliance data before showing confirmation modal"
  - "Pattern: Dual-bucket cache — include filter state in query key array for separate cache entries"

requirements-completed: [PRJ-01, PRJ-02, PRJ-03]

# Metrics
duration: 2min
completed: 2026-03-23
---

# Phase 17 Plan 02: Archive/Restore UI Summary

**React archive/restore UI: compliance advisory modal, Archived badge on ProjectCard, Show Archived toggle on DashboardPage, Archive/Restore buttons on ProjectDetailPage with TanStack Query invalidation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-23T17:53:36Z
- **Completed:** 2026-03-23T17:56:05Z
- **Tasks:** 2 auto + 1 checkpoint (awaiting browser verification)
- **Files modified:** 3

## Accomplishments
- ProjectCard shows neutral "Archived" badge and opacity-70 for closed projects
- DashboardPage has Show Archived checkbox that switches between /projects and /projects?status=all with separate query cache keys
- ProjectDetailPage has Archive button (active projects) and Restore button (closed projects) with archive confirmation modal
- Compliance advisory fetched imperatively via fetchQuery before showing modal — yellow warning if violations exist, "Archive Anyway" CTA

## Task Commits

Each task was committed atomically:

1. **Task 1: ProjectCard archived badge + DashboardPage show-archived toggle** - `ef2a505` (feat)
2. **Task 2: ProjectDetailPage archive/restore buttons with compliance advisory modal** - `3f947e4` (feat)

## Files Created/Modified
- `src/client/components/projects/ProjectCard.tsx` - Added Archived badge (neutral variant) and opacity-70 conditional class for closed projects
- `src/client/pages/DashboardPage.tsx` - Added showArchived state, updated query key to ['projects','all'|'active'], added Show Archived checkbox
- `src/client/pages/ProjectDetailPage.tsx` - Added useState/useNavigate/useMutation/useQueryClient, archiveMutation, restoreMutation, handleArchiveClick, compliance advisory modal

## Decisions Made
- Compliance check uses `queryClient.fetchQuery` (imperative) rather than a hook — fires only when Archive button is clicked, not on page load
- Advisory is non-blocking: "Archive Anyway" button always present when violations exist, per PRJ-03 requirement
- TanStack Query key includes filter state (`showArchived ? 'all' : 'active'`) to prevent stale active-only results showing when toggle is enabled

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Archive/restore client UI complete; all three PRJ requirements implemented
- Ready for Phase 18: Dashboard Search + Filter (DASH-03/04)
- 193 tests passing, no regressions

---
*Phase: 17-db-migration-project-archive*
*Completed: 2026-03-23*
