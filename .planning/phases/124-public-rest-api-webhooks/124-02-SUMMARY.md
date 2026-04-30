---
phase: 124
plan: "02"
subsystem: public-api-docs
tags: [openapi, swagger, docs, api-v1]
dependency_graph:
  requires: [124-01]
  provides: [API-03]
  affects: [src/server/index.ts, openapi.json]
tech_stack:
  added: [swagger-ui-express@5.0.1, "@types/swagger-ui-express"]
  patterns: [OpenAPI 3.1.0, per-route CSP override, startup JSON load]
key_files:
  created: [openapi.json]
  modified: [src/server/index.ts, src/server/routes/publicApi.ts, package.json, package-lock.json]
decisions:
  - "Load openapiSpec via readFileSync at startup (not dynamic require) for predictable behavior under module caching"
  - "Per-route CSP override for /api/docs/html rather than global Helmet mutation — preserves strict CSP for all other routes"
  - "Mount docs routes immediately before production SPA catch-all, after all /api/* and /v1 routes — clean ordering"
metrics:
  duration: "~12 minutes"
  completed: "2026-04-29"
  tasks_completed: 2
  files_changed: 5
---

# Phase 124 Plan 02: OpenAPI Docs (API-03) Summary

**One-liner:** swagger-ui-express@5.0.1 mounted at /api/docs (JSON) and /api/docs/html (Swagger UI) backed by hand-authored openapi.json covering all 7 /v1 endpoints in OpenAPI 3.1.0.

## What Was Built

- **openapi.json** (605 lines, OpenAPI 3.1.0) at repo root covering:
  - `GET /v1/projects` — paginated project list (scope: projects:read)
  - `GET /v1/projects/batch` — batch fetch up to 20 projects by IDs (scope: projects:read)
  - `GET /v1/projects/{id}` — single project (scope: projects:read)
  - `GET /v1/projects/{id}/payroll-weeks` — paginated payroll weeks (scope: payroll:read)
  - `GET /v1/projects/{id}/compliance-summary` — compliance status (scope: projects:read)
  - `GET /v1/projects/{id}/workers` — paginated workers (scope: workers:read)
  - `GET /v1/reports/compliance-summary` — aggregate compliance roll-up (scope: projects:read)
  - Full schema components: Project, PayrollWeek, Worker, ProjectComplianceSummary, ReportsComplianceSummary, Meta, PaginatedMeta, Error
  - Reusable `$ref` parameters: PageParam, LimitParam, ProjectIdParam
  - Reusable `$ref` responses: Unauthorized (401), Forbidden (403), TooManyRequests (429)
  - BearerAuth security scheme; global security applied to all paths

- **GET /api/docs** — returns openapiSpec JSON directly
- **GET /api/docs/html** — Swagger UI with customSiteTitle and persistAuthorization

## Mount Ordering Decision

Docs routes are mounted at the bottom of the `/api/*` block, after all business routes and the `/v1` public API router, but **before** the production SPA catch-all block. This ensures:
1. Express matches `/api/docs` and `/api/docs/html` correctly before the wildcard `app.get('*', ...)` can intercept
2. No interference with existing cookie-auth `/api/*` routes
3. Clean separation: swagger-ui-express static assets load under `/api/docs/html/*`

## CSP-Relaxation Approach

The global Helmet config enforces strict CSP (no `unsafe-eval`, `nonce`-less scripts blocked). Swagger UI requires `unsafe-inline` for both `script-src` and `style-src`. Rather than relaxing the global policy:

- Added a **per-route inline middleware** on `/api/docs/html` that calls `res.setHeader('Content-Security-Policy', ...)` with a narrower override
- This runs after Helmet sets the default header, overwriting it only for Swagger UI responses
- All other routes retain the strict Helmet CSP

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed orphaned `addRateLimitHeaders(res, RATE_LIMIT)` call in reports handler**
- **Found during:** Task 2 — TypeScript check revealed 3 errors in publicApi.ts
- **Issue:** A prior session refactored rate limiting to use `express-rate-limit` middleware, removed the `RATE_LIMIT` constant and `addRateLimitHeaders()` helper, but missed one call site at the end of the `GET /v1/reports/compliance-summary` handler (line 492)
- **Fix:** Removed the single orphaned call — rate limit headers are now emitted by the `publicApiLimiter` middleware applied to all /v1 routes
- **Files modified:** `src/server/routes/publicApi.ts`
- **Commit:** 2f94035 (included in same commit)

## Verification

- `node -e "JSON.parse(...)"` → JSON valid
- `node -e "...paths.length >= 7"` → `openapi.json OK (7 paths)`
- `npx tsc -p tsconfig.server.json --noEmit` → 0 errors
- `npx vitest run` → 914 tests pass, 78 test files pass, 7 skipped

## Known Stubs

None. The spec is authoritative and fully wired.

## Self-Check: PASSED

- `openapi.json` exists at `C:/Users/glcar/prevailing-wage/openapi.json` — FOUND
- `src/server/index.ts` modified with swagger imports + openapiSpec load + route mounts — FOUND
- Commit `2f94035` exists — FOUND
