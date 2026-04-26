---
phase: 83-external-log-drain-security-policy
plan: "01"
subsystem: logging
tags: [soc2, sec-07, logtail, better-stack, pino, observability]
dependency_graph:
  requires: []
  provides: [external-log-drain-sec07]
  affects: [src/server/logger.ts, src/server/index.ts]
tech_stack:
  added: ["@logtail/pino@0.5.8"]
  patterns: [three-branch-transport-selection, NODE_ENV-test-guard, non-fatal-startup-warning]
key_files:
  created: []
  modified:
    - src/server/logger.ts
    - src/server/index.ts
    - .env.example
    - package.json
    - package-lock.json
decisions:
  - "@logtail/pino installed with --legacy-peer-deps due to pre-existing vite8/vite-plugin-pwa peer conflict (not introduced by this plan)"
  - "Three-branch transport: test=none, token-present=@logtail/pino drain, dev-no-token=pino-pretty"
  - "Transport passed as second arg to pino() to avoid ThreadStream/LoggerOptions TypeScript error"
  - "Startup warning placed after pinoHttp registration to ensure transport is fully constructed before logging"
metrics:
  duration_minutes: 8
  completed_date: "2026-04-26"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 5
---

# Phase 83 Plan 01: External Log Drain (Better Stack / Logtail) Summary

**One-liner:** Pino structured logs wired to Better Stack via @logtail/pino 0.5.8 with NODE_ENV-gated and LOGTAIL_TOKEN-gated transport selection closing SOC 2 CC7/CC9 SEC-07.

## What Was Built

Implemented three-branch Pino transport selection for external log drain:

1. **`test` env** — no transport instantiated; prevents CI hangs and external network calls
2. **`LOGTAIL_TOKEN` present** — @logtail/pino HTTPS drain to Better Stack (works in both dev and prod)
3. **Dev, no token** — pino-pretty colorized console (preserves existing dev experience)
4. **Prod, no token** — raw JSON to stdout (Render.com captures it)

A non-fatal startup warning fires when `NODE_ENV !== 'test'` and `LOGTAIL_TOKEN` is unset, mirroring the RESEND_API_KEY/SENTRY_DSN pattern already in the codebase.

## Final @logtail/pino Version Installed

`@logtail/pino@0.5.8` — peerDep `pino ^7 || ^8 || ^9 || ^10` resolves cleanly against installed `pino@10.3.1`.

## Exact Lines Changed

### src/server/logger.ts (full replacement: 13 lines → 37 lines)

- Removed: inline `...(isDev && { transport: ... })` spread into pino options object
- Added: `isTest` and `token` constants; `buildTransport()` function with three branches; `pino(options, transport)` two-argument call pattern

### src/server/index.ts (+6 lines after pinoHttp block)

```typescript
// Phase 83 SEC-07 — non-fatal startup warning if external log drain not configured.
if (process.env.NODE_ENV !== 'test' && !process.env.LOGTAIL_TOKEN) {
  logger.warn('LOGTAIL_TOKEN not set — logs will not be sent to external drain (Better Stack). App will continue with stdout logging.');
}
```

### .env.example (+10 lines after SENTRY_DSN block)

Added "Logging (Better Stack / Logtail)" section with `LOGTAIL_TOKEN=` and Optional comment.

## Test Count Before/After

- Before: 724 passing, 42 todo
- After: 724 passing, 42 todo
- Delta: 0 (no regression)

## Deviations from Plan

### Auto-applied: --legacy-peer-deps for npm install

**Found during:** Task 1 — `npm install @logtail/pino` without flags produced ERESOLVE due to `vite-plugin-pwa@1.2.0` requiring `vite@^3-7` while `vite@8.0.10` is installed. This is a pre-existing conflict in the project (not introduced by this plan).

**Fix:** Used `--legacy-peer-deps` flag. The @logtail/pino peerDep resolution (`pino@10.3.1`) itself is clean — confirmed by `npm ls pino`.

**Files modified:** package.json, package-lock.json (updated by npm)

**Impact:** No behavioral difference — the flag only affects how npm resolves the pre-existing vite conflict.

## Note for SEC-08 Plan (Plan 02)

`SECURITY_POLICY.md` is still missing at repo root. Plan 02 handles this — no action needed here.

## Known Stubs

None — all functionality is fully wired. Transport selection is real (not stubbed). LOGTAIL_TOKEN must be set in Render.com env for production drain to activate (manual post-deploy step documented in plan).
