---
phase: 169-pwa-hardening
plan: 01
subsystem: pwa
tags: [pwa, service-worker, manifest, offline]
requires: []
provides: [PWA-01, PWA-02, PWA-03]
affects: [vite.config.ts, src/client/sw.ts, src/client/main.tsx]
tech-stack:
  added: []
  patterns: [cache-first-shell, network-first-api, background-sync, injectManifest]
key-files:
  modified:
    - vite.config.ts
    - src/client/sw.ts
    - src/client/main.tsx
decisions:
  - VitePWA injectManifest strategy already in use — manifest updated in vite.config.ts rather than public/manifest.json
  - Existing sw.ts (Workbox) retained and extended with flush-clock-queue handler rather than replaced with plain sw.js
  - vite/client triple-slash reference added to main.tsx to satisfy import.meta.env typing without altering tsconfig
metrics:
  duration: 8m
  completed: 2026-05-18
  tasks: 5
  files: 3
---

# Phase 169 Plan 01: Mobile PWA Hardening Summary

**One-liner:** Extended VitePWA manifest with correct brand colors, shortcuts, and description; added flush-clock-queue background sync handler; registered SW on prod load with Vite type fix.

## Tasks Completed

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | Check existing PWA setup | Done — assessed all existing files | n/a |
| 2 | Web App Manifest | Done — updated vite.config.ts manifest object | 302832c |
| 3 | Service Worker | Done — added flush-clock-queue handler to existing sw.ts | 3ae7dc0 |
| 4 | Register SW in main.tsx | Done — added PROD-guarded registration block | 94ced32 |
| 5 | TypeScript check | Done — fixed import.meta.env type error | 2e8c6b8 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] import.meta.env TS error in main.tsx**
- **Found during:** Task 5
- **Issue:** `import.meta.env.PROD` caused TS2339 — Property 'env' does not exist on type 'ImportMeta' — because tsconfig lacks `"types": ["vite/client"]`
- **Fix:** Added `/// <reference types="vite/client" />` triple-slash directive at top of main.tsx
- **Files modified:** src/client/main.tsx
- **Commit:** 2e8c6b8

### Architectural Adjustments (not deviations — correct approach)

**Manifest in vite.config.ts, not public/manifest.json**
The project uses VitePWA's `injectManifest` strategy which generates the manifest from the `manifest` object in `vite.config.ts`. Writing `public/manifest.json` directly would be ignored by VitePWA. Updated `vite.config.ts` instead.

**sw.ts (Workbox), not sw.js (vanilla)**
An existing comprehensive `src/client/sw.ts` using Workbox precaching, NetworkFirst/CacheFirst strategies, and full payroll background sync was already present. It was extended with the `flush-clock-queue` handler rather than replaced with the simpler vanilla sw.js from the plan.

## Known Stubs

None.

## Self-Check: PASSED

- vite.config.ts: manifest updated with correct brand tokens, shortcuts, description, orientation, categories
- src/client/sw.ts: flush-clock-queue sync handler added
- src/client/main.tsx: SW registration block added with PROD guard and vite/client types
- All 4 commits verified in git log
