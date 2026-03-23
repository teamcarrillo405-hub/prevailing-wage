---
phase: 13-landing-page-routing
plan: 01
subsystem: ui
tags: [react-router, auth, routing, public-route, register]

# Dependency graph
requires:
  - phase: 12-app-shell-global-layout
    provides: AuthContext, useAuth, ProtectedRoute, Card, Button primitives
provides:
  - PublicRoute guard component (redirects authenticated users to /dashboard)
  - RegisterPage at /register route
  - LandingPage placeholder at / route
  - Auth-aware WildcardRedirect for unknown URLs
  - Updated App.tsx route tree with public + protected + wildcard segments
affects: [13-landing-page-routing, 14-login-page-polish]

# Tech tracking
tech-stack:
  added: [lucide-react@^0.577.0]
  patterns:
    - PublicRoute mirrors ProtectedRoute — same hook shape, inverted logic
    - WildcardRedirect as inline App.tsx function using useAuth for auth-aware redirect
    - RegisterPage as thin wrapper around existing RegisterForm with centered card shell

key-files:
  created:
    - src/client/components/shared/PublicRoute.tsx
    - src/client/pages/RegisterPage.tsx
    - src/client/pages/LandingPage.tsx
  modified:
    - src/client/App.tsx
    - package.json
    - package-lock.json

key-decisions:
  - "PublicRoute returns null (not LoadingSpinner) during isLoading — brief enough that spinner adds visual noise"
  - "WildcardRedirect defined as inline function in App.tsx, not a separate file — single-use component"
  - "/login left unwrapped from PublicRoute — Phase 14 concern, avoids redirect loop risk"
  - "LandingPage.tsx is a placeholder div — full content built in Plan 02"

patterns-established:
  - "PublicRoute pattern: useAuth() -> null if loading -> Navigate /dashboard if authenticated -> Outlet"
  - "WildcardRedirect pattern: useAuth() -> null if loading -> Navigate /dashboard or / based on auth"

requirements-completed: [LANDING-07]

# Metrics
duration: 3min
completed: 2026-03-20
---

# Phase 13 Plan 01: Routing Infrastructure Summary

**PublicRoute guard + RegisterPage + auth-aware App.tsx route tree enabling '/' and '/register' as guarded public routes with WildcardRedirect for unknown URLs**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-20T22:20:45Z
- **Completed:** 2026-03-20T22:23:27Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Installed lucide-react@^0.577.0 (required for Phase 13 landing page icons, confirmed absent before this plan)
- Created PublicRoute.tsx — mirrors ProtectedRoute pattern exactly but inverted; redirects authenticated users to /dashboard
- Created RegisterPage.tsx — thin wrapper around existing RegisterForm with identical card/layout shell to LoginPage
- Created LandingPage.tsx placeholder at src/client/pages (replaced in Plan 02)
- Restructured App.tsx: '/' and '/register' inside PublicRoute, '/login' unwrapped, all 11 protected routes unchanged inside ProtectedRoute, '*' uses new WildcardRedirect
- All 181 existing server tests remain green

## Task Commits

Each task was committed atomically:

1. **Task 1: Install lucide-react and create PublicRoute + RegisterPage** - `dd26fe5` (feat)
2. **Task 2: Restructure App.tsx with public routes and auth-aware wildcard** - `eccbf10` (feat)

## Files Created/Modified

- `src/client/components/shared/PublicRoute.tsx` — Auth-aware guard; null on loading, Navigate /dashboard if authenticated, Outlet for guests
- `src/client/pages/RegisterPage.tsx` — Thin wrapper around RegisterForm with centered card shell
- `src/client/pages/LandingPage.tsx` — Placeholder div; replaced with full marketing page in Plan 02
- `src/client/App.tsx` — Route tree restructured with PublicRoute group, WildcardRedirect, all prior routes preserved
- `package.json` — lucide-react@^0.577.0 added to dependencies
- `package-lock.json` — updated lockfile

## Decisions Made

- PublicRoute returns `null` during `isLoading` rather than `<LoadingSpinner />` — the auth check is fast enough that a spinner would flash unnecessarily on most connections. ProtectedRoute uses LoadingSpinner but that's for protected pages where a flash is less jarring.
- WildcardRedirect defined inline in App.tsx as a module-level function component — it's a single-use component that doesn't belong in a separate file.
- `/login` remains unwrapped — wrapping it in PublicRoute creates session edge-case risk with no UX upside. Phase 14 can revisit.
- LandingPage placeholder used so TypeScript compiles without the full page content; Plan 02 replaces it.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Routing infrastructure complete — '/', '/register', and auth-aware wildcard all in place
- Plan 02 (LandingPage content) can proceed immediately; LandingPage.tsx placeholder is ready to replace
- All 181 tests green; no regressions from routing changes

---
*Phase: 13-landing-page-routing*
*Completed: 2026-03-20*

## Self-Check: PASSED

- FOUND: src/client/components/shared/PublicRoute.tsx
- FOUND: src/client/pages/RegisterPage.tsx
- FOUND: src/client/pages/LandingPage.tsx
- FOUND commit: dd26fe5 (feat(13-01): install lucide-react, create PublicRoute and RegisterPage)
- FOUND commit: eccbf10 (feat(13-01): restructure App.tsx with public routes and auth-aware wildcard)
- 181 tests green after both tasks
