---
phase: 115-per-seat-billing-quotas
plan: "02"
subsystem: billing-ui
tags: [billing, usage-bars, pricing-page, stripe]
key-files:
  modified:
    - src/client/pages/BillingPage.tsx
    - src/client/pages/PricingPage.tsx
    - src/server/services/stripeService.ts
    - src/server/routes/billing.ts
decisions:
  - "UsageBar as inline function inside BillingPage — not a separate file per plan spec"
  - "Checkout mutation passes quantity = team.members.length — wired to existing team query"
  - "Upgrade CTA in Usage card (not Manage Billing) — more contextual placement"
metrics:
  completed: 2026-04-27
  tasks: 3
  files: 4
---

# Phase 115 Plan 02: BillingPage Usage Bars + Quota Display Summary

One-liner: BillingPage Usage card with three progress bars (gold/red at 80%), Infinity = Unlimited, upgrade CTA, and Stripe Checkout seat quantity passthrough.

## What Was Built

### BillingPage.tsx
- Added `BillingUsage` interface matching GET /api/billing/usage response shape
- Added third useQuery with queryKey `['billing-usage']` fetching from `/api/billing/usage`
- `UsageBar` inline component:
  - `max === Infinity`: renders label + "Unlimited" text, no bar
  - `max` is finite: renders `used/max` label + progress bar div
  - Bar fill: `bg-brand-gold` when pct < 80, `bg-red-500` when pct >= 80
  - Outer bar: `h-2 w-full rounded-full bg-gray-200`
- `UsageBarSkeleton` inline component: three animate-pulse divs while data loads
- Usage card placed between "Current Plan" and "Manage Billing" cards
- Upgrade CTA: appears when any dimension >= 80% AND planTier is starter; fires checkoutMutation
- Checkout mutation body updated: `{ priceId, quantity: team?.members?.length ?? 1 }`

### PricingPage.tsx
- Pro tier features updated: "Unlimited projects, unlimited workers, 10 team members" as first feature

### stripeService.ts
- `createCheckoutSession` signature extended with optional `quantity = 1` param
- `line_items: [{ price: priceId, quantity }]` now passes seat count to Stripe

### billing.ts POST /checkout
- Destructures `quantity` from request body
- Validates: `typeof quantity === 'number' && quantity > 0 ? Math.floor(quantity) : 1`
- Passes `seatCount` to `createCheckoutSession`

## Visual Verification

checkpoint:human-verify — auto-approved (autonomous mode).

Expected at http://localhost:5173/billing (starter account):
- "Usage" card between "Current Plan" and "Manage Billing"
- Three rows: Projects X/3, Workers X/25, Team Members X/2
- Gold bars below 80%, red bars at/above 80%
- "Upgrade to Pro — Unlock Unlimited" CTA at 80%+ fill

## Test Suite
- 833/833 tests passing, 0 failures
- TypeScript: 0 new errors

## Deviations from Plan
None — plan executed as specified.

## Self-Check: PASSED
- BillingPage.tsx: UsageBar, BillingUsage interface, billing-usage query confirmed
- PricingPage.tsx: Pro features updated confirmed
- stripeService.ts: quantity param confirmed
- billing.ts: seatCount forwarding confirmed
- Commit: 22fa573
