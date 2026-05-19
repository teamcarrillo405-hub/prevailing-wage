---
phase: 157-fieldclock-ux
plan: 01
subsystem: field-clock
tags: [field-clock, gps, mobile, ux]
key-files:
  modified:
    - src/client/pages/FieldClockPage.tsx
    - src/client/components/field/GpsClockIn.tsx
decisions:
  - Used details/summary HTML element for worker accordion (no JS state needed per-card)
  - gpsAccuracy ring only shows on primary idle clock-in button (not on confirm button which already shows GPS status panel)
  - brand-navy tokens in both files replaced with nav-dark as a Rule 2 auto-fix
metrics:
  duration: ~15min
  completed: 2026-05-18
  tasks: 4
  files: 2
---

# Phase 157 Plan 01: FieldClockPage Crew Status + Back Button + GPS Accuracy Summary

One-liner: Crew status dot banner, worker-grouped accordion punch list, navigate(-1) back button, and GPS accuracy color ring on clock-in button.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 2 | Fix back button to use navigate(-1) | b88ed71 |
| 3 | Crew status banner with dot indicators | e8812dd |
| 4 | Group clock entries by worker, clocked-in first | 86d067b |
| 5 | GPS accuracy ring on clock-in button | b94313b |

## What Was Built

**Back button:** Replaced `<Link to={/projects/${projectId}}>` with `<button onClick={() => navigate(-1)}>` using the `useNavigate` hook. Users return to wherever they came from (project detail, dashboard, etc.) instead of always going to `/`.

**Crew status banner:** Appears above the grid when workers exist. Shows one dot per active worker (green = clocked in, gray = not), plus a text count "N of M workers clocked in". `clockedInIds` is derived via `useMemo` by counting in/out punches per worker.

**Grouped punch list:** Replaced flat chronological `<ul>` with `<details>/<summary>` accordion cards, one per worker. Workers currently clocked in are listed first (sorted via `useMemo`). Each card shows the worker name, IN/OUT badge, and punch count in the summary row, with individual punch entries inside. The source filter still applies within each worker's entries.

**GPS accuracy ring:** Added `gpsAccuracy` state to GpsClockIn. When `acquireGps()` resolves, `setGpsAccuracy(position.accuracyMeters)` is called. A colored border div wraps the idle clock-in button:
- < 10m: `border-green-500`
- 10–50m: `border-amber-500`
- > 50m: `border-red-500`
- No reading yet: `border-transparent`

## Deviations from Plan

**Auto-fixed Issues**

**1. [Rule 2 - Token] Fixed brand-navy token usage in both files**
- Found during: Task 2 (reading source files)
- Issue: `text-brand-navy`, `bg-brand-navy`, `border-brand-navy` used in FieldClockPage.tsx and GpsClockIn.tsx — token doesn't exist in @theme, causing invisible/broken styles
- Fix: Replaced with `text-nav-dark`, `bg-nav-dark`, `border-nav-dark` throughout both files
- Files modified: both

**2. [Rule 3 - Import] Added useMemo to imports**
- Found during: Task 3
- Issue: useMemo needed for clockedInIds and groupedByWorker derivations but wasn't imported
- Fix: Added to React import destructure

## Known Stubs

None.
