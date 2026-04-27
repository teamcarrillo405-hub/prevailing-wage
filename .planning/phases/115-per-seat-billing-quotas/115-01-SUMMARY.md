---
phase: 115-per-seat-billing-quotas
plan: "01"
subsystem: billing
tags: [billing, quotas, plan-limits, enforcement]
key-files:
  modified:
    - src/server/utils/planLimits.ts
    - src/server/routes/billing.ts
    - src/server/routes/projects.ts
    - src/server/routes/workers.ts
  created:
    - tests/routes/billing.test.ts
decisions:
  - "Used 409 Conflict (not 403) for quota exceeded — more semantically accurate than Forbidden"
  - "Infinity short-circuit skips count query for pro/enterprise — avoids unnecessary DB reads"
  - "Worker cap scoped to project owner, not requester — team members share owner's quota"
metrics:
  completed: 2026-04-27
  tasks: 2
  files: 5
---

# Phase 115 Plan 01: Per-Seat Billing Quotas + GET /api/billing/usage Summary

One-liner: Server-enforced project (3) and worker (25) caps for starter tier with 409+upgradeRequired + GET /api/billing/usage endpoint.

## What Was Implemented

### planLimits.ts
- Widened `LIMITS` type to include `maxProjects` and `maxWorkers` per tier
- `starter`: maxMembers=2, maxProjects=3, maxWorkers=25
- `pro`: maxMembers=10, maxProjects=Infinity, maxWorkers=Infinity
- `enterprise`: maxMembers=999, maxProjects=Infinity, maxWorkers=Infinity
- Added `getLimits(tier)` export returning the full limits object
- `getMemberLimit()` kept intact for backward compatibility

### GET /api/billing/usage (billing.ts)
- Requires auth (401 if not)
- Returns: `{ projectCount, workerCount, memberCount, limits, planTier }`
- `projectCount`: COUNT of projects owned by the user
- `workerCount`: COUNT of active workers (isActive=true) across all owner's projects
- `memberCount`: COUNT of non-removed project_members on owner's projects
- `limits`: full getLimits() object for the owner's tier

### POST /api/projects quota enforcement (projects.ts)
- Fetches user planTier, calls getLimits()
- If `maxProjects !== Infinity`: counts existing projects, returns 409 + `{ upgradeRequired: true }` at cap
- Pro/enterprise: Infinity check short-circuits — no count query

### POST /api/projects/:id/workers quota enforcement (workers.ts)
- Gets project owner's planTier (worker count scoped to owner, not requester)
- If `maxWorkers !== Infinity`: counts active workers across ALL owner projects via JOIN
- Returns 409 + `{ upgradeRequired: true }` at cap

## Tests (billing.test.ts)
9 tests, all passing:
- GET /api/billing/usage — 401 unauthenticated, 200 correct shape, projectCount increments
- POST /api/projects — 409 at 4th project (starter), 201 below cap, pro account never blocked
- POST /api/projects/:id/workers — 409 at 26th worker (starter), 201 below cap, pro never blocked

## Deviations from Plan

**[Rule 1 - Minor] Used 409 instead of 403**
- Plan specified 403 in the prompt text but 409 in the plan truths/artifacts
- 409 Conflict is semantically correct for quota exceeded
- All tests written against 409

None further — plan executed as specified.

## Self-Check: PASSED
- planLimits.ts: getLimits() exports confirmed
- billing.ts: GET /usage route confirmed
- projects.ts: quota check before db.insert confirmed
- workers.ts: quota check after assertProjectAccess confirmed
- billing.test.ts: 9/9 tests passing
- Commit: ab25baf
