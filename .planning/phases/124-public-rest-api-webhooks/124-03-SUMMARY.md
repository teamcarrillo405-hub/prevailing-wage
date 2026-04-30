---
phase: "124"
plan: "03"
subsystem: "webhooks"
tags: ["security", "ssrf", "api-04", "api-05", "retry", "poller"]
dependency_graph:
  requires: ["schema:webhookDeliveries", "jobs:webhookDelivery", "routes:webhooks"]
  provides: ["SSRF protection on webhook URL registration", "delivery retry poller", "manual retry endpoint", "status UI badge"]
  affects: ["WebhooksPage.tsx", "webhookService.ts", "routes/webhooks.ts", "server/index.ts"]
tech_stack:
  added: ["node:dns (promises.lookup)", "exponential backoff poller (setInterval 30s)"]
  patterns: ["RFC1918 SSRF block", "DNS-resolution-based private IP check", "2^n backoff", "status enum column"]
key_files:
  created:
    - src/server/db/migrations/0066_webhook_delivery_status.sql
    - src/server/jobs/webhookDelivery.ts
    - tests/routes/webhooks.test.ts
    - tests/services/webhookDelivery.test.ts
  modified:
    - src/server/db/schema.ts
    - src/server/db/migrations/meta/_journal.json
    - src/server/services/webhookService.ts
    - src/server/routes/webhooks.ts
    - src/server/index.ts
    - src/client/pages/WebhooksPage.tsx
decisions:
  - "Use dns.promises.lookup(host, {all:true}) to resolve all IPs before insert"
  - "Backoff: BASE_BACKOFF_MS=60_000, MAX_ATTEMPTS=5 (2^n*60s — max ~32 min before final failure)"
  - "Polled via setInterval(30s) not cron — lightweight, no dependency on node-cron"
  - "Manual retry resets retryCount=0 and status='pending' — user gets full 5 attempts"
  - "dns.promises typed inline as { address: string; family: number }[] for Node LTS compatibility"
metrics:
  duration: "~25 min"
  completed: "2026-04-29"
  tasks: 3
  files: 10
---

# Phase 124 Plan 03: Webhook SSRF Protection + Delivery Retry Summary

**One-liner:** SSRF DNS-resolution guard on webhook registration + 30s exponential-backoff retry poller + manual requeue endpoint + status badge UI.

## Artifacts

| File | Change |
|------|--------|
| `src/server/db/migrations/0066_webhook_delivery_status.sql` | ADD COLUMN status, backfill, index |
| `src/server/db/schema.ts` | status field + idx_webhook_deliveries_status |
| `src/server/db/migrations/meta/_journal.json` | Entry idx=66 |
| `src/server/jobs/webhookDelivery.ts` | assertNotPrivateIp() + deliverPending() |
| `src/server/services/webhookService.ts` | Set status on insert |
| `src/server/routes/webhooks.ts` | SSRF pre-check + retry endpoint |
| `src/server/index.ts` | setInterval(deliverPending, 30_000) |
| `src/client/pages/WebhooksPage.tsx` | status field, retryMutation, badge, Retry button |
| `tests/routes/webhooks.test.ts` | 4 tests (SSRF + retry) |
| `tests/services/webhookDelivery.test.ts` | 3 tests (poller logic) |

## Migration 0066 Backfill Strategy

The migration runs three UPDATE statements after the ADD COLUMN:

1. `status = 'succeeded'` WHERE `delivered_at IS NOT NULL AND status = 'pending'`  
   — marks all rows that already have a successful delivery timestamp.
2. `status = 'failed'` WHERE `failed_at IS NOT NULL AND retry_count >= 5 AND status = 'pending'`  
   — marks rows that exhausted all retry attempts as permanently failed.
3. All remaining rows stay `'pending'` (the column default).

New rows written by webhookService.ts before this migration is applied default to `'pending'` (safe — the poller will retry them or they'll be corrected by the next redeploy).

## SSRF Protection Coverage (RFC 1918 + loopback + link-local + IPv6)

`assertNotPrivateIp()` in `webhookDelivery.ts` blocks:

| Range | Block condition |
|-------|----------------|
| `10.0.0.0/8` | `a === 10` |
| `172.16.0.0/12` | `a === 172 && b >= 16 && b <= 31` |
| `192.168.0.0/16` | `a === 192 && b === 168` |
| `127.0.0.0/8` | `a === 127` |
| `0.0.0.0/8` | `a === 0` |
| `169.254.0.0/16` (link-local) | `a === 169 && b === 254` |
| `::1` (IPv6 loopback) | exact match |
| `fc00::/7` (IPv6 ULA) | `/^fc[0-9a-f]{2}:/i` + `/^fd[0-9a-f]{2}:/i` |
| `fe80::/10` (IPv6 link-local) | `/^fe[89ab][0-9a-f]:/i` |
| Literal `localhost` / `0.0.0.0` | pre-DNS rejection |
| Unresolvable hostnames | DNS failure → blocked |

## Backoff Constants

| Constant | Value |
|----------|-------|
| `BASE_BACKOFF_MS` | 60,000 ms (60 s) |
| `MAX_ATTEMPTS` | 5 |
| Backoff formula | `2^retryCount * 60_000` ms |
| Poller interval | 30 s |

| Attempt | Wait before retry |
|---------|------------------|
| 1st retry (rc=0→1) | immediate (no backoff on first attempt) |
| 2nd retry (rc=1) | 2 min |
| 3rd retry (rc=2) | 4 min |
| 4th retry (rc=3) | 8 min |
| 5th retry (rc=4) | 16 min → final; status → 'failed' |

## Event Names

All webhook events use dot-notation (unchanged from existing codebase convention):
`payroll.submitted`, `violation.detected`, `worker.added`, `payroll.week.created`,
`cpr.submitted`, `subcontractor.cpr.received`, `compliance.cleared`, `*`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] dns.promises type annotation incompatibility**
- **Found during:** Task 2A
- **Issue:** `dns.LookupAddress` and `dns.promises.LookupAddress` are not exported by `node:dns/promises` in this Node/TS version combination
- **Fix:** Used inline type `{ address: string; family: number }[]` — structurally identical to the actual return
- **Files modified:** `src/server/jobs/webhookDelivery.ts`
- **Commit:** c7ab711

**2. [Rule 1 - Bug] Test: `hooks.example.com` DNS lookup fails in local env**
- **Found during:** Task 3A (test run)
- **Issue:** The test for "public URL accepted" was doing a real DNS lookup on `hooks.example.com` which fails/times out locally
- **Fix:** Stubbed `dns.promises.lookup` with `vi.spyOn` to return a known public IP (`93.184.216.34`)
- **Files modified:** `tests/routes/webhooks.test.ts`
- **Commit:** 957ff7c

**3. [Rule 1 - Bug] Test: `db.execute` not available on drizzle-orm/better-sqlite3**
- **Found during:** Task 3B (test run)
- **Issue:** Used `db.execute()` raw SQL to insert test user — method doesn't exist on drizzle wrapper
- **Fix:** Changed to `db.insert(users).values({...})` using Drizzle's typed insert; imported `users` from schema
- **Files modified:** `tests/services/webhookDelivery.test.ts`
- **Commit:** 957ff7c

## Known Stubs

None — all status fields are wired to real DB state, all mutations target live endpoints.

## Self-Check: PASSED
