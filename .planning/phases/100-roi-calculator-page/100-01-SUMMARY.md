---
phase: 100-roi-calculator-page
plan: 01
subsystem: marketing-ui
tags: [roi, calculator, public-page, lead-capture, TRUST-04]
dependency_graph:
  requires: [99-phase-c-watchdog-gate]
  provides: [/roi-public-page, calcRoi-formula, roi-leads-cta]
  affects: [src/client/App.tsx]
tech_stack:
  added: []
  patterns: [React-lazy-routing, useSearchParams-seeding, TDD-component]
key_files:
  created:
    - src/client/pages/RoiCalculatorPage.tsx
    - src/client/pages/RoiCalculatorPage.test.tsx
  modified:
    - src/client/App.tsx
decisions:
  - calcRoi formula is pure (exported) for deterministic unit testing separate from React rendering
  - useSearchParams for URL param seeding — makes /roi?projects=10&workers=50 shareable links
  - jsdom vitest-environment docblock used (per-file override) rather than changing global vitest.config.ts
  - import @testing-library/jest-dom in test file (not global setup) — keeps server test setup clean
metrics:
  duration: 12m
  completed: 2026-04-27
  tasks_completed: 2
  files_changed: 3
---

# Phase 100 Plan 01: ROI Calculator Page Summary

## One-liner

Public /roi page with live project/worker sliders, real-time savings formula (hours x $45/hr), URL param pre-fill, and email capture CTA — 15 vitest tests all pass.

## What Was Built

- `RoiCalculatorPage.tsx`: Navy gradient hero, sliders for projectCount (1-50) and workerCount (1-200), live annualHours + annualSavings display, URL param seeding via useSearchParams, email form POSTing to /api/roi-leads
- `RoiCalculatorPage.test.tsx`: 5 calcRoi unit tests + 10 component interaction tests (sliders, URL params, form submit, success/error states)
- App.tsx: `/roi` route added in public pages block after `/government` — no auth wrapper

## Formula

```
annualHours = workers × 2.5 × 52
annualSavings = annualHours × 45
```

Example: 20 workers → 2,600 hours/yr → $117,000 savings

## Tests

15 vitest tests all passing:
- calcRoi() unit: 5 tests (boundary values, project-count independence)
- Component: 10 tests (render, defaults, slider update, URL params, clamp, disabled button, enable, success, error, POST payload)

## Deviations from Plan

1. [Rule 2 - Missing setup] Added `@testing-library/jest-dom` import to test file — not in global setup, required for `toBeInTheDocument()` and `toBeDisabled()` matchers.
2. [Rule 2 - Missing env] Added `@vitest-environment jsdom` docblock to test file — global vitest.config.ts uses `node` environment; React rendering tests require jsdom.

Both deviations are file-scoped and do not affect any other test files.

## Self-Check: PASSED

- RoiCalculatorPage.tsx exists at correct path
- RoiCalculatorPage.test.tsx exists with 15 tests passing
- App.tsx contains `path="/roi"` (verified with grep)
- commit 3ed6f8c: feat(100-01): ROI calculator page — sliders, formula, email CTA
