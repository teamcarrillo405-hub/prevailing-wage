---
phase: 33-team-invite-flow-team-ui
plan: 03
subsystem: ui
tags: [react, tanstack-query, react-router, team-management, invite-flow]

# Dependency graph
requires:
  - phase: 33-02
    provides: Team API routes (GET /api/team, POST /api/team/invite, DELETE /api/team/invite, DELETE /api/team/members/:userId, POST /api/team/transfer, GET /api/team/invite/:token, POST /api/auth/accept-invite)
  - phase: 33-01
    provides: project_members and team_invites DB tables, Drizzle schema
provides:
  - TeamPage at /team — members list with role badges, invite form, revoke/remove/transfer actions
  - AcceptInvitePage at /accept-invite — token validation, locked email, password creation, account join
  - Protected /team route in App.tsx
  - Public /accept-invite route in App.tsx
  - Team nav link in Layout header
affects: [phase-34, phase-35, phase-36, any-phase-touching-Layout-or-App]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useQuery + useMutation (TanStack Query v5) for team data with queryClient.invalidateQueries on mutation success"
    - "Inline confirm row pattern — confirmAction state swaps normal member row for confirm UI without modal"
    - "Token-validated public page — useEffect fetches token status on mount, renders distinct state per HTTP status code"
    - "/accept-invite as fully public route (no PublicRoute wrapper) per D-09 decision"

key-files:
  created:
    - src/client/pages/TeamPage.tsx
    - src/client/pages/AcceptInvitePage.tsx
  modified:
    - src/client/App.tsx
    - src/client/components/shared/Layout.tsx

key-decisions:
  - "/accept-invite is a fully public route (not wrapped in PublicRoute) — already-authenticated users see the form; API returns 410 if token already used"
  - "Inline confirm row replaces member row in-place (no modal) for remove and transfer ownership actions"
  - "atCapacity derived client-side from data?.members.length >= 2 — consistent with 2-user max business rule"

patterns-established:
  - "Inline confirm row: confirmAction state { type, userId, email } toggles between normal row and confirm row for destructive actions"
  - "Token-state machine: 'loading' | 'valid' | 'expired' | 'invalid' | 'error' — each maps to distinct UI rendering"

requirements-completed: [MT-01, MT-02, MT-04, MT-05]

# Metrics
duration: ~30min (2 auto tasks + human verify)
completed: 2026-03-29
---

# Phase 33 Plan 03: Team UI Summary

**TeamPage with members list, invite/revoke/remove/transfer actions, and AcceptInvitePage with token-state machine, wired into App routes and Layout nav**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-03-29
- **Completed:** 2026-03-29
- **Tasks:** 3 (2 auto + 1 human-verify)
- **Files modified:** 4

## Accomplishments

- TeamPage renders members with Owner/Member role badges, pending invite row with Revoke, and Send Invite form with capacity and pending-invite guard states
- Inline confirm rows (no modal) for Remove Member and Transfer Ownership with correct confirmation text and loading states
- AcceptInvitePage validates token via GET /api/team/invite/:token and maps HTTP 200/404/410 to distinct UI states (valid form / Invite Not Found / Link Expired)
- /team protected route and /accept-invite public route added to App.tsx; Team nav link added to Layout header
- Human browser verification passed — full end-to-end invite flow confirmed (send invite, copy console URL, accept in incognito, 2-user cap enforcement, inline confirm UX)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create TeamPage + AcceptInvitePage** - `50a5d7c` (feat)
2. **Task 2: Wire routes in App.tsx + add Team nav link in Layout.tsx** - `6f6d04a` (feat)
3. **Task 3: Verify full team flow in browser** - human-verify (no code commit — user approved)

## Files Created/Modified

- `src/client/pages/TeamPage.tsx` - Team management page: members card with role badges and owner-only action buttons, invite form with capacity guards, inline confirm rows for remove/transfer
- `src/client/pages/AcceptInvitePage.tsx` - Accept invite page: useEffect token validation, state machine for loading/valid/expired/invalid/error, locked email input, password creation form
- `src/client/App.tsx` - Added /team (protected) and /accept-invite (public) routes
- `src/client/components/shared/Layout.tsx` - Added "Team" nav link before Wage Lookup

## Decisions Made

- /accept-invite is fully public (no PublicRoute wrapper) per D-09 — authenticated user visiting an already-used token sees 410 from API
- Inline confirm row pattern chosen over modal for remove/transfer destructive actions — keeps UX inline without overlay complexity
- atCapacity derived from members.length >= 2 client-side — matches the 2-user max business rule established in planning

## Deviations from Plan

None — plan executed exactly as written. Both auto tasks completed without deviation; human verify approved on first pass.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 33 complete — full team invite flow (DB schema, API routes, integration tests, UI pages) is production-ready
- Phase 34 (Submission tracking) can proceed independently — no dependencies on team UI
- Phase 35/36 (Import server/UI) can proceed — team membership model in place

---
*Phase: 33-team-invite-flow-team-ui*
*Completed: 2026-03-29*
