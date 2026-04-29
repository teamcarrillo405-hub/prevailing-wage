---
phase: 119-dashboard-intelligence
plan: "02"
subsystem: client/pages
tags: [dashboard, ui, react, tanstack-query, recharts]
dependency_graph:
  requires: [GET /api/dashboard/stats, GET /api/dashboard/compliance-trend, GET /api/dashboard/at-risk]
  provides: [DashboardPage wired to 3 server endpoints]
  affects: [src/client/pages/DashboardPage.tsx]
tech_stack:
  added: []
  patterns: [useQuery staleTime 60_000, api.get<T> typed calls, server-authoritative dashboard data]
key_files:
  created: []
  modified:
    - src/client/pages/DashboardPage.tsx
decisions:
  - "Three new useQuery hooks replace five client-side useMemo derivations — DashboardPage is now a thin presentation layer"
  - "useRef removed from import after tickerRef eliminated; useMemo retained for summaryItemMap/summaryMap/sortedRankings/filteredProjects"
  - "Trend chart section always renders (section visible at all times); placeholder 'No violation data yet' shown when empty instead of hiding section"
  - "DASH-04 ProjectCard badge verified present from Phase 89 — no code modification made in this plan"
metrics:
  duration_seconds: 240
  completed_date: "2026-04-29"
  tasks_completed: 2
  files_changed: 1
---

# Phase 119 Plan 02: Dashboard UI Wire-up Summary

**One-liner:** DashboardPage refactored from five client-side useMemo derivations to three server-authoritative useQuery hooks consuming /dashboard/stats, /compliance-trend, and /at-risk.

## What Was Built

### DashboardPage.tsx Refactor

**Line count:** 1,062 lines before → 973 lines after (89 lines net removed)

**Hooks added (3):**
- `useQuery` for `/dashboard/stats` — queryKey `['dashboard-stats']`, staleTime 60_000
- `useQuery` for `/dashboard/compliance-trend` — queryKey `['dashboard-compliance-trend']`, staleTime 60_000
- `useQuery` for `/dashboard/at-risk` — queryKey `['dashboard-at-risk']`, staleTime 60_000

**useMemos removed (5):**
- `activeProjectCount` useMemo → replaced by `statsData?.activeProjects ?? 0`
- `totalViolations` useMemo → replaced by `statsData?.openViolations ?? 0`
- `dueSoonCount` useMemo → replaced by `statsData?.weeksDueThisWeek ?? 0`
- `trendData` useMemo (12-week bucket approximation) → replaced by `trendResp?.weeks ?? []`
- `atRiskProjects` useMemo → replaced by `atRiskResp?.projects ?? []`

**Removed entirely:**
- Legacy `/api/dashboard/violations` polling query (refetchInterval: 30_000)
- `secondsSinceUpdate` useState + `tickerRef` useRef + ticker useEffect
- `realtimeViolationMap` useMemo
- `ViolationRealtimeItem` interface
- "Updated Xs ago" UI span

**Chart dataKey alignment:**
- `<XAxis dataKey="week">` → `<XAxis dataKey="weekLabel">`
- `<Line dataKey="violations">` → `<Line dataKey="violationCount">`

**Trend chart empty state:**
- Changed from conditional section render to always-visible section with `ResponsiveContainer` or `<p>No violation data yet</p>` fallback

**At-risk panel field rename:**
- `project.violationCount` → `project.openViolationCount` (matches new endpoint shape)

### DASH-04 Acceptance Check (ProjectCard — no modifications)

```
src/client/components/projects/ProjectCard.tsx
  line 104: <Badge variant="violation">
  line 103: violationCount > 0 ? (
  line 105: {violationCount} violation{violationCount !== 1 ? 's' : ''}
```

All three acceptance criteria confirmed present. File is UNCHANGED in this plan (git diff shows 0 lines modified for ProjectCard.tsx in these commits).

## Test Results

**Full Vitest suite: 849 tests passing** (71 test files passed, 7 skipped)
- Baseline from Plan 01: 849 tests
- Net new tests this plan: 0 (UI-only changes; server routes tested in Plan 01)
- No regressions introduced

**TypeScript:** `npx tsc --noEmit` exits 0.

## Commits

| Hash | Message |
|------|---------|
| 290f051 | feat(119-02): wire hero stats and compliance trend chart to server endpoints |
| b446a9e | feat(119-02): wire at-risk panel to /dashboard/at-risk; verify DASH-04 badge |

## Phase 119 Milestone Completion

All four DASH requirements satisfied:

| Req | Description | Status |
|-----|-------------|--------|
| DASH-01 | Hero stat row reads from /api/dashboard/stats | Done (Plan 02) |
| DASH-02 | Compliance trend chart reads from /api/dashboard/compliance-trend with correct dataKeys | Done (Plan 02) |
| DASH-03 | At-risk panel reads from /api/dashboard/at-risk; hidden when empty | Done (Plan 02) |
| DASH-04 | ProjectCard violation count badge renders when violationCount > 0 | Verified (Phase 89, not modified) |

Phase 119 is fully complete. All server endpoints (Plan 01) and UI wiring (Plan 02) are committed to master.

## Deviations from Plan

### Implementation Adjustments

**1. [Rule 2 - Enhancement] Trend chart always rendered (not conditionally mounted)**
- **Found during:** Task 1
- **Issue:** Plan spec said to change conditional section render to always show section with inner conditional. Implemented as specified.
- **Fix:** Section wraps both `ResponsiveContainer` (when data present) and `<p>No violation data yet</p>` placeholder (when empty). Section heading "Compliance Trend" always visible.
- **Files modified:** src/client/pages/DashboardPage.tsx
- **Commit:** 290f051

### Auto-fixed Issues

None beyond the plan spec.

## Known Stubs

None — all three useQuery hooks wire to live server endpoints implemented in Plan 01.

## Self-Check: PASSED
