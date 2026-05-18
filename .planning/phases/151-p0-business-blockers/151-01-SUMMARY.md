---
phase: 151-p0-business-blockers
plan: "01"
subsystem: billing, auth
tags: [stripe, registration, env-vars, p0-blocker]
dependency_graph:
  requires: []
  provides: [stripe-checkout-configured, hcc-optional-registration]
  affects: [BillingPage, RegisterForm, billing-route, auth-route]
tech_stack:
  added: []
  patterns: [env-var-config-guard, 503-not-configured, optional-zod-field]
key_files:
  created: []
  modified:
    - src/server/routes/billing.ts
    - src/server/services/stripeService.ts
    - src/client/pages/BillingPage.tsx
    - src/client/components/auth/RegisterForm.tsx
    - .env.example
    - tests/routes/billing.test.ts
    - tests/routes/auth.test.ts
decisions:
  - "billing.ts owns price ID resolution from env vars — client sends planTier, not price ID"
  - "503 STRIPE_NOT_CONFIGURED returned when env var is empty — clear ops signal"
  - "hccMembershipNumber already optional on server; client Zod schema was the blocker"
metrics:
  duration_minutes: 8
  completed_date: "2026-05-18"
  tasks_completed: 3
  files_modified: 7
---

# Phase 151 Plan 01: Stripe Price IDs + HCC# Optional Registration Summary

**One-liner:** Server-side Stripe price ID resolution from env vars with 503 guard + HCC membership field made optional to unblock non-HCC contractor registration.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Wire Stripe price IDs from env vars | 107b346 | billing.ts, stripeService.ts, BillingPage.tsx, .env.example |
| 2 | Make HCC# optional in registration | a282bf0 | RegisterForm.tsx |
| 3 | Write/update tests | f420fba | billing.test.ts, auth.test.ts |

## What Was Built

### Task 1: Stripe Price ID Resolution

- Added `PRICE_IDS` map in `billing.ts` reading from `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_ENTERPRISE` env vars
- `POST /api/billing/checkout` now accepts `planTier` (e.g., `'pro'`) and resolves the Stripe price ID server-side
- Returns `503 STRIPE_NOT_CONFIGURED` with clear message when the price ID env var is empty
- `BillingPage.tsx` updated to send `planTier: 'pro'` instead of hardcoded `price_pro_placeholder`
- Removed `price_pro_placeholder` and `price_enterprise_placeholder` fallback strings from `stripeService.ts`
- Added `STRIPE_PRICE_STARTER` to `.env.example`

### Task 2: HCC# Optional

- Client-side `RegisterSchema` in `RegisterForm.tsx`: changed `hccMembershipNumber` from `z.string().min(3)` to `z.string().optional()`
- Label updated from "HCC membership number" to "HCC Member # (optional)"
- Helper text updated: "Leave blank if not an HCC member — you can link your membership later in Settings."
- `hccMembershipNumber` sent as `undefined` (not empty string) when blank
- Server-side `auth.ts` already had `.optional()` — no server change needed

### Task 3: Tests

- `billing.test.ts`: 2 new tests — 503 guard when `STRIPE_PRICE_PRO=''`, 401 when unauthenticated
- `auth.test.ts`: 2 new tests — registration succeeds without `hccMembershipNumber`, succeeds with it
- All 26 tests pass (11 billing + 15 auth)

## Deviations from Plan

**1. [Rule 1 - Bug] BillingPage sends planTier not priceId to checkout**
- Found during: Task 1
- Issue: Plan said to add PRICE_IDS in billing.ts and remove hardcoded strings. The cleanest architectural fix is for the client to send a plan tier name, not a Stripe price ID — prevents client-side exposure of price IDs.
- Fix: Changed billing.ts `/checkout` to accept `planTier` body param (not `priceId`), BillingPage sends `planTier: 'pro'`
- Files modified: billing.ts, BillingPage.tsx
- Commit: 107b346

## Known Stubs

None — Stripe checkout will return 503 until `STRIPE_PRICE_PRO` env var is configured in production, which is the correct behavior.

## Self-Check: PASSED

- src/server/routes/billing.ts: FOUND
- src/server/services/stripeService.ts: FOUND
- src/client/pages/BillingPage.tsx: FOUND
- src/client/components/auth/RegisterForm.tsx: FOUND
- tests/routes/billing.test.ts: FOUND
- tests/routes/auth.test.ts: FOUND
- Commits 107b346, a282bf0, f420fba: all verified in git log
- 26 tests passing: verified
