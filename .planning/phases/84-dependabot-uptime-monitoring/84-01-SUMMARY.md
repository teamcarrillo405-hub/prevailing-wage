---
phase: 84-dependabot-uptime-monitoring
plan: 01
subsystem: infra
tags: [dependabot, github-actions, security, ci, readme, soc2]

# Dependency graph
requires: []
provides:
  - Dependabot v2 YAML config for weekly grouped npm and github-actions updates
  - README.md with CI and Security Audit workflow badges
affects: [dependabot, sec-09, soc2-observability]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Dependabot groups pattern (npm-all with patterns:[*]) to avoid PR flood
    - GitHub Actions native badge URL pattern for workflow status

key-files:
  created:
    - .github/dependabot.yml
    - README.md
  modified: []

key-decisions:
  - "Dependabot npm-all group with patterns:[*] consolidates all 68 npm packages into a single weekly PR — without this, 68 individual PRs would open every Monday"
  - "open-pull-requests-limit:5 as safety valve cap on concurrent npm PRs"
  - "target-branch intentionally omitted — Dependabot defaults to repo default branch (main)"
  - "github-actions ecosystem monitors uses: lines in .github/workflows/*.yml — currently two actions pinned: actions/checkout@v4 and actions/setup-node@v4"
  - "dependencies label must be created manually in GitHub repo Settings -> Labels before first Dependabot run"

patterns-established:
  - "Dependabot group pattern: use groups.npm-all.patterns:[*] not per-package groups"

requirements-completed: [SEC-09]

# Metrics
duration: 8min
completed: 2026-04-26
---

# Phase 84 Plan 01: Dependabot + README Summary

**Dependabot v2 config with grouped weekly npm/github-actions PRs (SEC-09) and README with CI+Security Audit GitHub Actions badges**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-26T20:53:00Z
- **Completed:** 2026-04-26T21:01:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `.github/dependabot.yml` created with Dependabot v2 schema — weekly npm updates grouped into single PR (npm-all pattern), weekly github-actions ecosystem updates, both labeled `dependencies`
- `README.md` created at project root with CI badge (ci.yml) and Security Audit badge (security.yml) using native GitHub Actions badge URL format
- All 724 existing Vitest tests continue to pass (no regressions from purely additive files)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create .github/dependabot.yml** - `ba6dbfe` (chore)
2. **Task 2: Create README.md with CI badges** - `4d26862` (docs)

**Plan metadata:** (committed with SUMMARY below)

## Files Created/Modified

- `.github/dependabot.yml` - Dependabot v2 config: weekly npm (grouped) + weekly github-actions, both labeled dependencies
- `README.md` - Project readme with CI and Security Audit GitHub Actions badges, tech stack, setup instructions, link to SECURITY_POLICY.md

## Decisions Made

- `groups.npm-all` with `patterns: ["*"]` selected over per-package groups — without grouping, 68 individual npm PRs would open every Monday (guaranteed to be ignored)
- `open-pull-requests-limit: 5` added as safety valve
- `target-branch` intentionally omitted — Dependabot defaults to repo default branch (main)
- Badge URLs use `teamcarrillo405-hub/prevailing-wage` confirmed from `git remote get-url origin`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

Before the first Dependabot run on Monday, a human must create the `dependencies` label in GitHub repo Settings → Labels:
- **Label name:** `dependencies`
- **Color:** `#0075ca`
- **URL:** https://github.com/teamcarrillo405-hub/prevailing-wage/labels

Without this label, Dependabot will error when it tries to apply it to the first PR.

## Next Phase Readiness

- SEC-09 compliance satisfied: automated weekly dependency update PRs are configured
- Dependabot will open its first grouped npm PR next Monday (03:00 America/Chicago) and update github-actions pinned versions if newer major versions are available
- README CI/Security Audit badges will show live status once next push to main triggers the CI workflow

---
*Phase: 84-dependabot-uptime-monitoring*
*Completed: 2026-04-26*
