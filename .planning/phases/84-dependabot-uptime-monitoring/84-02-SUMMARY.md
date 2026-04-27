---
phase: 84-dependabot-uptime-monitoring
plan: "02"
subsystem: ui
tags: [react, better-stack, uptime, status-page, soc2, footer]

# Dependency graph
requires:
  - phase: 84-01
    provides: Dependabot config and CI badges already in place; uptime monitoring footwork
provides:
  - STATUS_PAGE_URL constant in LandingPage.tsx with placeholder and TODO comment
  - "System Status" anchor in LandingFooter nav links row (external link, target=_blank)
  - Better Stack iframe badge between nav row and copyright line
affects: [phase-85-full-text-search, landing-page-ui, soc2-sec10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "STATUS_PAGE_URL constant at module level — single source of truth for external status page URL; TODO comment marks the placeholder for post-account-setup replacement"
    - "Better Stack iframe badge using frameBorder (camelCase) and style={{colorScheme:'none'}} to prevent Tailwind dark-mode bleed"

key-files:
  created: []
  modified:
    - src/client/pages/LandingPage.tsx

key-decisions:
  - "STATUS_PAGE_URL placeholder committed with YOUR-SUBDOMAIN as a deliberate stub — Better Stack account setup is a deferred manual follow-up (cannot be automated)"
  - "System Status uses <a> not <Link> because it targets an external URL, not an internal React Router route"
  - "Task 2 (human checkpoint) treated as deferred-approved: code ships with placeholder; human completes Better Stack account and replaces URL at their convenience"

patterns-established:
  - "External service badge pattern: isoate URL in a const with TODO, use template literal for badge src, frameBorder camelCase, colorScheme:none override"

requirements-completed: [SEC-10]

# Metrics
duration: ~20min (Task 1 automated; Task 2 deferred)
completed: 2026-04-26
---

# Phase 84 Plan 02: Dependabot + Uptime Monitoring (Better Stack Footer Badge) Summary

**LandingPage footer gains STATUS_PAGE_URL constant, "System Status" external link, and Better Stack iframe badge for SOC 2 SEC-10 availability evidence — Better Stack account setup deferred as manual follow-up**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-04-26
- **Completed:** 2026-04-26
- **Tasks:** 1 of 2 automated (Task 2 deferred — human action required)
- **Files modified:** 1

## Accomplishments

- `STATUS_PAGE_URL` constant added to `LandingPage.tsx` with `YOUR-SUBDOMAIN` placeholder and TODO comment directing developer to replace after Better Stack account setup
- "System Status" `<a>` anchor added to LandingFooter nav links row with `target="_blank" rel="noopener noreferrer"`
- Better Stack iframe badge `<div>` inserted between the nav links row and the copyright line, using `frameBorder="0"` and `style={{colorScheme:'none'}}` for correct dark-mode rendering
- 724 Vitest tests passing; TypeScript compiles clean with zero errors

## Task Commits

1. **Task 1: Add STATUS_PAGE_URL constant, System Status link, and Better Stack badge to LandingFooter** - `2c5ea8a` (feat)
2. **Task 2: Human verification — Better Stack setup and badge visual confirm** - DEFERRED (see below)

**Plan metadata:** (committed with SUMMARY and state updates)

## Files Created/Modified

- `src/client/pages/LandingPage.tsx` — Added `STATUS_PAGE_URL` const, "System Status" `<a>` link, and Better Stack iframe badge in `LandingFooter`

## Decisions Made

- `STATUS_PAGE_URL` uses `YOUR-SUBDOMAIN` placeholder deliberately so the code can ship before the Better Stack account exists; a TODO comment in the file marks the exact line for replacement
- Task 2 (human checkpoint requiring Better Stack account, monitor setup, and real subdomain URL) was deferred at user request — it is not a code blocker, only a configuration step
- The `<a>` anchor (not React Router `<Link>`) is correct for an external URL

## Deviations from Plan

Task 2 checkpoint treated as deferred-approved rather than blocking:

- **What happened:** User could not complete Better Stack account setup at time of execution
- **Decision:** Task 1 code is complete and correct; the STATUS_PAGE_URL placeholder is a known stub that the developer will replace when convenient
- **Impact:** SEC-10 code artifact is shipped; the live uptime monitoring evidence requires the manual follow-up below

None - Task 1 executed exactly as written.

## Known Stubs

| File | Location | Stub | Reason |
|------|----------|------|--------|
| `src/client/pages/LandingPage.tsx` | `STATUS_PAGE_URL` constant | `'https://YOUR-SUBDOMAIN.betteruptime.com'` | Better Stack account not yet created; TODO comment marks for replacement |

The "System Status" footer link and iframe badge will show an invalid URL in the browser until this placeholder is replaced. This does not break any other functionality.

## User Setup Required (Deferred Follow-up)

The following steps must be completed manually after Better Stack account creation:

1. **Create Better Stack account** at https://betterstack.com/uptime (free tier)
2. **Create monitor** — URL: `https://prevailingwage.app/api/health`, interval: 3 min, keyword check: `"ok"`
3. **Create public status page** — associate the `/api/health` monitor, choose a subdomain (e.g., `prevwage`)
4. **Copy the public URL** (format: `https://YOUR-SUBDOMAIN.betteruptime.com`)
5. **Update the constant** in `src/client/pages/LandingPage.tsx`:
   ```tsx
   // Find this line:
   const STATUS_PAGE_URL = 'https://YOUR-SUBDOMAIN.betteruptime.com';
   // Replace YOUR-SUBDOMAIN with the actual subdomain
   ```
6. **Create GitHub `dependencies` label** — repo Settings → Labels → New label → Name: `dependencies`, Color: `#0075ca`
7. **Visual verify** — run dev server, scroll to footer, confirm badge renders and "System Status" link opens status page in new tab

## Issues Encountered

None for Task 1. Task 2 deferred by user decision.

## Next Phase Readiness

- Phase 85 (Full-Text Search) can begin immediately — it has no dependency on the Better Stack URL being live
- Better Stack account setup is a standalone follow-up that can be completed at any time without code changes (beyond replacing the single constant value)
- SEC-10 code artifact is in place; full SOC 2 evidence requires the live monitor to be running

---
*Phase: 84-dependabot-uptime-monitoring*
*Completed: 2026-04-26*
