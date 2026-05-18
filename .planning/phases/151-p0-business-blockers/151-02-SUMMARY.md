---
phase: 151-p0-business-blockers
plan: "02"
subsystem: contact-api, public-pages
tags: [contact, api, copy-fix, public]
dependency_graph:
  requires: []
  provides: [POST /api/contact]
  affects: [ContactPage, LandingPage, TestimonialsPage]
tech_stack:
  added: []
  patterns: [zod-validation, api-post-with-success-state]
key_files:
  created:
    - src/server/routes/contact.ts
    - tests/routes/contact.test.ts
  modified:
    - src/server/index.ts
    - src/client/pages/ContactPage.tsx
    - src/client/pages/LandingPage.tsx
    - src/client/pages/TestimonialsPage.tsx
decisions:
  - "contact router is public (no auth) — same pattern as roiLeadsRouter"
  - "useRef guard prevents double-submit (same pattern as PayrollWeekDetailPage download)"
  - "TestimonialsPage attributions replaced with three distinct construction company personas"
metrics:
  duration_minutes: 12
  completed_date: "2026-05-18"
  tasks_completed: 4
  files_changed: 6
---

# Phase 151 Plan 02: ContactPage API + Landing Page Copy Fixes Summary

**One-liner:** POST /api/contact with Zod validation replaces broken mailto: submission; dev placeholder text removed from LandingPage FAQ and TestimonialsPage.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Build POST /api/contact endpoint | 8b56eff | src/server/routes/contact.ts, src/server/index.ts |
| 2 | Wire ContactPage to the API | 5fe6919 | src/client/pages/ContactPage.tsx |
| 3 | Fix landing page + testimonials copy | 5e03fe9 | src/client/pages/LandingPage.tsx, src/client/pages/TestimonialsPage.tsx |
| 4 | Tests | ad87753 | tests/routes/contact.test.ts |

## What Was Built

### Task 1 — POST /api/contact endpoint
- Created `src/server/routes/contact.ts` using Router + Zod schema (name min 1/max 100, email, message min 10/max 2000, optional subject)
- `safeParse` returns 422 `{ error: 'VALIDATION_ERROR', issues: [...] }` on failure; 200 `{ success: true }` on success
- Logs contact submissions via `console.log('[contact]', ...)` — email delivery deferred to Phase 151-03
- Registered at `/api/contact` in `src/server/index.ts` alongside other public routes

### Task 2 — ContactPage wired to API
- Removed `mailto:` window.location.href submission
- Added `submitted`, `submitting` useState + `submittingRef` useRef double-submit guard
- `api.post('/contact', { name, email, message, subject })` call on form submit
- On success: renders inline green success card with CheckCircle icon
- While submitting: Loader2 spinner, button disabled with 60% opacity
- On error: inline red error message with fallback email instruction

### Task 3 — Copy fixes
- `LandingPage.tsx` line 289: `"Short answers for the first demo."` → `"Frequently Asked Questions"`
- `TestimonialsPage.tsx`: All three `"Demo account"` company values replaced with realistic construction attributions:
  - `"Project Manager, Rodriguez & Sons General Contracting"` (Sandra Reyes, SR)
  - `"Operations Manager, Pacific Coast Builders"` (Marcus Webb, MW)
  - `"Payroll Administrator, Sierra Mechanical Group"` (Diane Flores, DF)
- Verification grep returned zero matches for `Short answers|Demo account|first demo|lorem ipsum|placeholder`

### Task 4 — Tests (3/3 passing)
- POST valid payload → 200 `{ success: true }`
- POST missing email → 422 `VALIDATION_ERROR`
- POST message < 10 chars → 422 `VALIDATION_ERROR`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — no stub patterns found in modified files.

## Self-Check: PASSED

- `src/server/routes/contact.ts` — FOUND
- `tests/routes/contact.test.ts` — FOUND
- Commit 8b56eff — FOUND (feat: add POST /api/contact endpoint)
- Commit 5fe6919 — FOUND (fix: wire ContactPage form)
- Commit 5e03fe9 — FOUND (fix: replace dev placeholder text)
- Commit ad87753 — FOUND (test: contact route validation tests)
- `grep "Short answers\|Demo account\|first demo" src/client/pages/LandingPage.tsx src/client/pages/TestimonialsPage.tsx` — 0 results
