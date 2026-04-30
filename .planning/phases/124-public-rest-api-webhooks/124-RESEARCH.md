# Phase 124: Public REST API + Webhooks — Research

**Researched:** 2026-04-29
**Domain:** Express REST API, API key authentication, OpenAPI 3.1, webhook delivery queue
**Confidence:** HIGH — all findings from direct codebase inspection

---

## Summary

Phase 124 covers five requirements (API-01 through API-05) that collectively deliver API key management, a public read-only REST API at `/v1`, an OpenAPI 3.1 spec with Swagger UI, webhook registration with SSRF protection, and a delivery queue with retry logic.

The good news: roughly 80% of this feature already exists in the codebase. The `api_keys`, `webhooks`, and `webhook_deliveries` tables are present (migration 0043). The `/api/keys` management routes are wired. The `/v1` public API routes are mounted. The `webhookService.ts` handles HMAC signing and delivery. The Settings UI pages (`ApiKeysPage`, `WebhooksPage`) are built and routed. `deliverWebhook()` is called from `payroll.ts`, `compliance.ts`, `workers.ts`, and `subcontractors.ts`.

The remaining work is a set of well-defined gaps: (1) real per-key rate limiting using `express-rate-limit` (currently only headers are emitted, no actual enforcement), (2) audit logging of all `/v1` requests to `insertAuditLog`, (3) an `openapi.json` in the repo root with a Swagger UI endpoint at `/api/docs/html`, (4) SSRF protection in the webhook registration route, and (5) a `setInterval`-based delivery retry poller with exponential backoff and a `status = 'failed'` terminal state, plus a manual "Retry" button in `WebhooksPage.tsx`.

**Primary recommendation:** Three plans match the ROADMAP split exactly: Plan 01 = rate limiting + audit logging + Vitest tests; Plan 02 = OpenAPI 3.1 spec + swagger-ui-express; Plan 03 = SSRF protection + delivery poller + retry button.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| API-01 | API key management: `api_keys` table, CRUD routes (`POST/GET/DELETE /api/keys`), SHA-256 hash, key shown once, rate limit 100 req/min per key hash | Table + routes EXIST. Gap: per-key rate limiting is header-only; enforcement not wired |
| API-02 | Public REST API v1: 4 GET endpoints under `/v1/`, Bearer token auth, JSON responses, rate-limited, audit-logged, 4 Vitest tests | Routes EXIST at `/v1`. Gaps: audit logging absent from publicApi.ts; per-key rate limit not enforced; 0 Vitest tests exist for these routes |
| API-03 | OpenAPI 3.1 spec in `openapi.json`, served at `GET /api/docs` (JSON) and `GET /api/docs/html` (Swagger UI via swagger-ui-express) | Neither openapi.json nor swagger-ui-express present; `ApiDocsPage.tsx` is a static React page (not Swagger UI) |
| API-04 | Webhooks table, CRUD routes, SSRF protection (DNS pre-resolve + RFC 1918 block), HMAC-SHA-256 signing | Table + routes EXIST. Gap: SSRF protection absent from `/api/webhooks` POST handler |
| API-05 | `webhook_deliveries` table, `setInterval` 30s poller, exponential backoff, max 5 attempts, `status = failed`, manual "Retry" button | Table EXISTS. `webhookService.ts` handles single delivery. Gap: no poller, no exponential backoff, no `status` column, no retry endpoint, no Retry button in UI |
</phase_requirements>

---

## What Already Exists (Do Not Rebuild)

| Item | File(s) | Status |
|------|---------|--------|
| `api_keys` table | `schema.ts:673`, migration `0043_api_keys_webhooks.sql` | Complete — id, userId, keyHash, keyPrefix, scopes, lastUsedAt, expiresAt, createdAt, revokedAt |
| `webhooks` table | `schema.ts:686` | Complete — id, userId, url, secret (AES-256-GCM encrypted), events JSON, active, failureCount, lastDeliveredAt, createdAt |
| `webhook_deliveries` table | `schema.ts:698` | Complete — id, webhookId, event, payload, statusCode, responseBody, deliveredAt, failedAt, retryCount |
| `POST/GET/DELETE /api/keys` | `src/server/routes/apiKeys.ts` | Complete — SHA-256 hash, key shown once (`pw_live_` prefix), revoke via revokedAt soft-delete |
| `GET/POST/PATCH/DELETE /api/webhooks` | `src/server/routes/webhooks.ts` | Complete — HMAC secret generation + encryption, PATCH to update, test-ping endpoint, deliveries view |
| `/v1` public API routes | `src/server/routes/publicApi.ts` | Complete — GET /projects, GET /projects/batch, GET /projects/:id, GET /projects/:id/payroll-weeks, GET /projects/:id/compliance-summary, GET /projects/:id/workers, GET /reports/compliance-summary |
| Bearer token auth middleware | `publicApi.ts:28` `requireApiKey()` | Complete — SHA-256 hash lookup, expiry check, lastUsedAt update, scope propagation |
| Rate-limit headers | `publicApi.ts:92` `addRateLimitHeaders()` | Present — X-RateLimit-Limit/Remaining/Reset headers emitted on every response |
| Scope enforcement | `publicApi.ts:75` `requireScope()` | Complete — projects:read, payroll:read, workers:read enforced per route |
| HMAC signing on delivery | `webhookService.ts:69` | Complete — `X-PW-Signature: sha256=<hmac>` header, `X-PW-Event`, `X-PW-Delivery` |
| `deliverWebhook()` call sites | `payroll.ts:143, 452`, `compliance.ts:229`, `workers.ts:310`, `subcontractors.ts:397` | 4 events wired: `payroll.week.created`, `payroll.submitted`, `violation.detected`, `worker.added` |
| ApiKeysPage UI | `src/client/pages/ApiKeysPage.tsx` | Complete — create/list/revoke, one-time key display, copy to clipboard |
| WebhooksPage UI | `src/client/pages/WebhooksPage.tsx` | Complete — list/create/delete/test-ping/deliveries panel. Missing: manual Retry button |
| ApiDocsPage (React static) | `src/client/pages/ApiDocsPage.tsx` | Complete as developer reference. API-03 requires Swagger UI separately |
| Routes mounted in index.ts | `src/server/index.ts:206-214` | `/api/keys` and `/api/webhooks` and `/v1` all mounted |

---

## Gaps to Implement (All 3 Plans)

### Plan 01 Gaps (rate limiting + audit logging + Vitest)

**Gap 1: Per-key rate limiting not enforced**
Current state: `publicApi.ts` emits `X-RateLimit-*` headers but does NOT enforce the limit. The comment on line 125 acknowledges this: "Per-route handlers can override X-RateLimit-Remaining once we wire a real per-key counter."

`express-rate-limit` is already installed at `^8.4.1`. It is used in `auth.ts` (loginLimiter, registerLimiter) and `mfa.ts` (verifyLimiter). The existing pattern:

```typescript
// src/server/routes/auth.ts — existing pattern to copy
import rateLimit from 'express-rate-limit';
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.ip ?? 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
```

For `/v1` the requirement is 100 req/min per key hash (not per IP). This requires a custom `keyGenerator`:

```typescript
const publicApiLimiter = rateLimit({
  windowMs: 60 * 1000,           // 1 minute window
  max: 100,
  keyGenerator: (req) => {
    // req.apiKeyUserId is set by requireApiKey middleware upstream
    return req.apiKeyUserId ?? req.ip ?? 'unknown';
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded. Max 100 requests/minute per API key.' },
});
```

Apply after `requireApiKey` so `req.apiKeyUserId` is populated:
```typescript
router.use(requireApiKey);
router.use(publicApiLimiter);  // enforce AFTER auth
```

The existing `addRateLimitHeaders()` helper and the middleware that emits them should be removed once `express-rate-limit`'s `standardHeaders: true` takes over (it writes the same `RateLimit-*` headers).

**Gap 2: No audit logging in publicApi.ts**
The requirement states "all requests audit-logged." The existing audit pattern across `export.ts`, `payroll.ts` etc. uses dynamic import:

```typescript
// Pattern: dynamic import to avoid circular deps (Phase 38 decision)
const { insertAuditLog } = await import('../services/auditService.js');
await insertAuditLog({
  userId:     req.apiKeyUserId!,
  userEmail:  null,                    // API key caller — no email in scope
  ipAddress:  req.ip ?? null,
  projectId:  null,                    // populate if route has :id
  entityType: 'api_request',
  entityId:   req.apiKeyUserId!,
  action:     'api.v1.read',
  meta:       { path: req.path, method: req.method, keyPrefix: req.apiKeyScopes?.join(',') },
});
```

A per-route middleware approach is cleaner than repeating this in each handler. Add a router-level middleware after `requireApiKey` that logs every request. Non-blocking (fire and forget with `.catch()` to avoid crashing on audit failure).

**Gap 3: No Vitest tests for /v1 routes**
Zero test files exist for `publicApi.ts` or `apiKeys.ts`. The requirement mandates "at least 4 Vitest tests (auth, shape, pagination)."

Test helper pattern (from `tests/helpers/db.ts`): in-memory SQLite via `(globalThis as any).__testDb`, with `migrate()` run in `beforeAll`. All existing route tests use `supertest` against the `app` export from `index.ts`.

Minimum 4 tests for `tests/routes/publicApi.test.ts`:
1. `401` when no `Authorization` header
2. `401` when invalid key
3. `GET /v1/projects` returns `{ data: [], meta: { page, limit, total, hasNext } }` shape
4. `GET /v1/projects?limit=2&page=1` paginates correctly

### Plan 02 Gaps (OpenAPI 3.1 spec + Swagger UI)

**Gap 1: No openapi.json exists**
The requirement specifies `openapi.json` in the repo root, auto-generated from route definitions. The project has no `swagger-ui-express`, `@asteasolutions/zod-to-openapi`, or `openapi3-ts` packages installed.

Two approaches:
- **Hand-authored JSON** (simpler, no new deps): Write `openapi.json` directly covering the 7 v1 endpoints. Serve at `GET /api/docs` (raw JSON) and render via `swagger-ui-express` at `GET /api/docs/html`.
- **Code-generated**: Would require `@asteasolutions/zod-to-openapi` + decorator pattern. Adds complexity and new deps.

**Recommendation:** Hand-author `openapi.json` (one JSON file, ~200 lines). The v1 API is read-only, stable, 7 endpoints — there is no value in code generation at this size. New dependencies needed: `swagger-ui-express` + `@types/swagger-ui-express`.

Current npm versions to use:
- `swagger-ui-express`: latest stable (5.x series as of 2026). Verify: `npm view swagger-ui-express version`
- `@types/swagger-ui-express`: matching types package

Mounting pattern in `index.ts`:
```typescript
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'node:fs';
const openapiSpec = JSON.parse(readFileSync('./openapi.json', 'utf-8'));

app.get('/api/docs', (_req, res) => res.json(openapiSpec));
app.use('/api/docs/html', swaggerUi.serve, swaggerUi.setup(openapiSpec));
```

Helmet CSP gotcha: `swagger-ui-express` injects inline scripts. The current Helmet config has `scriptSrc: ["'self'"]` which blocks Swagger UI's inline scripts. Need to add `"'unsafe-inline'"` to `scriptSrc` ONLY for the `/api/docs/html` path, or use a nonce. Simplest fix: conditionally relax CSP for that path.

**Gap 2: ApiDocsPage.tsx is a React static page, not Swagger UI**
The existing `/api-docs` React page is a hand-crafted HTML reference page. It is NOT the OpenAPI Swagger UI required by API-03. The spec requires `GET /api/docs/html` (server-rendered Swagger UI). These can coexist — the React page at `/api-docs` stays, Swagger UI lives at server route `/api/docs/html`.

### Plan 03 Gaps (SSRF + delivery poller + retry)

**Gap 1: SSRF protection absent from webhook registration**
The requirement specifies: "before saving URL, DNS pre-resolve and block RFC 1918 ranges (10.x, 172.16–31.x, 192.168.x)." The `POST /api/webhooks` handler in `webhooks.ts` has only client-side URL format validation (Zod `z.string().url()`). No DNS pre-resolve, no RFC 1918 check.

Node.js built-in DNS approach:
```typescript
import { promises as dns } from 'node:dns';

async function isSSRFSafe(url: string): Promise<boolean> {
  try {
    const { hostname } = new URL(url);
    const addresses = await dns.lookup(hostname, { all: true });
    for (const { address } of addresses) {
      if (isRFC1918(address)) return false;
    }
    return true;
  } catch {
    return false; // DNS failure = block
  }
}

function isRFC1918(ip: string): boolean {
  // IPv4 RFC 1918: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
  // Also block loopback: 127.0.0.0/8, 0.0.0.0, ::1
  const PRIVATE = [
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^127\./,
    /^0\.0\.0\.0$/,
    /^::1$/,
    /^fc00:/,   // IPv6 ULA
    /^fe80:/,   // IPv6 link-local
  ];
  return PRIVATE.some(re => re.test(ip));
}
```

Note: `dns.lookup` respects the host OS resolver, which is correct for SSRF prevention.

**Gap 2: No delivery retry poller**
The `webhook_deliveries` table has `retryCount` column and `failedAt` timestamp, but:
- No `status` column exists (`pending | delivering | succeeded | failed`)
- `webhookService.ts` delivers synchronously at event time — no queue or retry
- No `setInterval` poller exists in `index.ts`
- The `incrementFailureCount()` function deactivates the webhook after >5 failures (webhooks.failureCount) but does not retry individual deliveries

The requirement: `setInterval` polling (30s), exponential backoff, max 5 attempts, then `status = 'failed'`. This requires:

1. **DB migration** adding `status TEXT NOT NULL DEFAULT 'pending'` to `webhook_deliveries`
2. **Poller function** `src/server/jobs/webhookDeliveryPoller.ts`:
   - Queries `webhook_deliveries WHERE status = 'pending' AND retryCount < 5`
   - Uses exponential backoff: delay before retry = `Math.pow(2, retryCount) * 30_000` ms
   - On delivery success: sets `status = 'succeeded'`, `deliveredAt`
   - On failure: increments `retryCount`; if `retryCount >= 5` sets `status = 'failed'`
3. **Registration in `index.ts`**:
   ```typescript
   setInterval(runWebhookDeliveryPoller, 30_000);
   ```
4. **Manual retry endpoint**: `POST /api/webhooks/deliveries/:deliveryId/retry` — resets `status = 'pending'`, `retryCount = 0`
5. **Retry button in `WebhooksPage.tsx`**: per delivery row in the expanded delivery log

**Gap 3: Event name alignment**
The REQUIREMENTS.md API-04 specifies events: `payroll_week.created`, `payroll_week.submitted`, `compliance.violation_detected` (underscore-separated). The existing `webhookService.ts` uses: `payroll.week.created`, `payroll.submitted`, `violation.detected` (dot-separated). The `VALID_EVENTS` array in `webhooks.ts` has `payroll.submitted` and `violation.detected`. The UI in `WebhooksPage.tsx` lists 8 events including `payroll.week.created`.

**Decision for planner:** The existing event names use dot notation and are already wired in 4 call sites. Do NOT rename them to the REQUIREMENTS.md underscore form — that would break all existing webhook subscriptions. The requirement text is aspirational naming; the implementation uses dot notation throughout. Document this as an intentional deviation from REQUIREMENTS.md wording (implementation is functionally equivalent). No migration needed.

---

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `express-rate-limit` | ^8.4.1 | Per-key rate limiting for `/v1` | Installed, not yet wired to `/v1` |
| `better-sqlite3` + `drizzle-orm` | installed | DB for delivery queue | In use |
| `node:crypto` | built-in | HMAC-SHA-256 signing, key hashing | In use |
| `node:dns` | built-in | SSRF DNS pre-resolve | Available, not yet used |

### New Dependencies Required
| Library | Purpose | Install |
|---------|---------|---------|
| `swagger-ui-express` | Serve OpenAPI spec as interactive UI at `/api/docs/html` | `npm install swagger-ui-express` |
| `@types/swagger-ui-express` | TypeScript types | `npm install -D @types/swagger-ui-express` |

No other new dependencies needed. All other gaps can be implemented with existing packages.

**Installation:**
```bash
npm install swagger-ui-express
npm install -D @types/swagger-ui-express
```

**Version verification:**
```bash
npm view swagger-ui-express version
npm view @types/swagger-ui-express version
```

---

## Architecture Patterns

### Recommended Project Structure (new files only)
```
openapi.json                               # repo root — API-03 spec (hand-authored)
src/server/
├── jobs/
│   └── webhookDeliveryPoller.ts           # API-05 — setInterval delivery queue
├── routes/
│   ├── publicApi.ts                       # MODIFY: add rate limit + audit log middleware
│   └── webhooks.ts                        # MODIFY: add SSRF check in POST handler
├── db/
│   └── migrations/
│       └── 0066_webhook_delivery_status.sql  # API-05 — add status column
tests/routes/
└── publicApi.test.ts                      # API-02 — 4+ Vitest tests (new)
```

### Pattern 1: Per-Key Rate Limiting with express-rate-limit

Apply `rateLimit` AFTER `requireApiKey` so `req.apiKeyUserId` is available for `keyGenerator`:

```typescript
// src/server/routes/publicApi.ts
import rateLimit from 'express-rate-limit';

const publicApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req) => req.apiKeyUserId ?? req.ip ?? 'unknown',
  standardHeaders: 'draft-7',  // RateLimit-* headers (RFC 9110 draft)
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded. 100 requests/minute per API key.' },
  skip: () => false,
});

router.use(requireApiKey);
router.use(publicApiLimiter);
// ... routes
```

Remove the manual `addRateLimitHeaders()` calls from each route handler once `standardHeaders: 'draft-7'` is enabled — they would duplicate the headers.

### Pattern 2: Audit Logging Middleware for /v1

```typescript
// Add AFTER rate limiter, fires on all /v1 requests
router.use(async (req, _res, next) => {
  // Fire-and-forget — never block the request
  (async () => {
    try {
      const { insertAuditLog } = await import('../services/auditService.js');
      await insertAuditLog({
        userId:     req.apiKeyUserId ?? null,
        userEmail:  null,
        ipAddress:  req.ip ?? null,
        projectId:  (req.params['id'] as string) ?? null,
        entityType: 'api_v1_request',
        entityId:   req.apiKeyUserId ?? 'unknown',
        action:     'api.v1.read',
        meta:       { path: req.path, method: req.method },
      });
    } catch { /* non-fatal */ }
  })();
  next();
});
```

### Pattern 3: SSRF Pre-Check in Webhook Registration

```typescript
// In POST /api/webhooks handler, before db.insert()
const safe = await isSSRFSafe(body.url);
if (!safe) {
  res.status(422).json({ error: 'URL resolves to a private or loopback address (SSRF protection)' });
  return;
}
```

### Pattern 4: Webhook Delivery Poller

```typescript
// src/server/jobs/webhookDeliveryPoller.ts
export async function runWebhookDeliveryPoller(): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();

  // Find pending deliveries whose retry delay has elapsed
  const pending = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.status, 'pending'))
    .limit(50);

  for (const delivery of pending) {
    const backoffMs = Math.pow(2, delivery.retryCount ?? 0) * 30_000;
    const createdAt = delivery.failedAt ?? delivery.deliveredAt ?? now;
    if (Date.now() - new Date(createdAt).getTime() < backoffMs) continue;

    // attempt delivery ... (same HTTP POST pattern as webhookService.ts)
  }
}
```

Register in `index.ts` inside the `server.listen()` callback:
```typescript
setInterval(() => {
  runWebhookDeliveryPoller().catch(err => logger.error({ err }, 'webhook-poller: error'));
}, 30_000);
```

### Pattern 5: openapi.json Structure

Minimal OpenAPI 3.1 document covering all 7 v1 endpoints. Mount two Express routes:

```typescript
// src/server/index.ts additions
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'node:fs';

const openapiSpec = JSON.parse(
  readFileSync(new URL('../../openapi.json', import.meta.url).pathname, 'utf-8')
);

app.get('/api/docs', (_req, res) => res.json(openapiSpec));
// Helmet CSP relaxation for Swagger UI (inline scripts required)
app.use('/api/docs/html',
  (_req, res, next) => {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:"
    );
    next();
  },
  swaggerUi.serve,
  swaggerUi.setup(openapiSpec)
);
```

### Anti-Patterns to Avoid

- **Attaching raw API key to req.user**: Never merge `apiKeyUserId` into `req.user` — that is the session auth object and mixing them breaks the `requireAuth` guard. Use `req.apiKeyUserId` (already declared in the global namespace augmentation in `publicApi.ts`).
- **Rate-limiting before auth**: A per-key limiter applied before `requireApiKey` would fall back to IP-based keying, defeating the per-key requirement.
- **Synchronous DNS in SSRF check**: `dns.lookup` is async; always `await` it. Never use the callback form.
- **Blocking poller**: The delivery poller must catch all errors and never rethrow — same pattern as all other cron jobs in `index.ts`.
- **Storing raw webhook secrets**: The existing code correctly uses `encryptSsn()` to encrypt the HMAC secret at rest. Do not change this.
- **Removing existing `ApiDocsPage.tsx`**: The React page at `/api-docs` is a developer reference and is separate from the Swagger UI at `/api/docs/html`. Keep both.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-key rate limiting | Custom in-memory counter | `express-rate-limit` (already installed) | Handles distributed reset, headers, window math |
| SSRF IP blocking | Regex on raw URL string | `node:dns` lookup + RFC 1918 check | URL can resolve to a different IP than the hostname suggests |
| Swagger UI rendering | Custom HTML with Redoc CDN | `swagger-ui-express` | CDN dependencies violate CSP; npm package works with existing Helmet setup |
| Delivery backoff math | `setTimeout` trees | Simple `Math.pow(2, retryCount) * 30_000` formula + `setInterval` | SQLite-backed queue doesn't need a full job framework |

---

## Common Pitfalls

### Pitfall 1: Helmet CSP blocks Swagger UI
**What goes wrong:** `swagger-ui-express` injects inline `<script>` tags. The current Helmet config has `scriptSrc: ["'self'"]` which blocks all inline scripts. Swagger UI renders blank.
**Why it happens:** Helmet's CSP is set globally. `swagger-ui-express` doesn't support nonce-based CSP by default.
**How to avoid:** Apply a relaxed CSP header for `/api/docs/html` only via route-level middleware BEFORE `swaggerUi.serve`. Do NOT change the global Helmet config.
**Warning signs:** Browser console shows `Content Security Policy: The page's settings blocked the loading of a resource`.

### Pitfall 2: keyGenerator runs before requireApiKey populates req.apiKeyUserId
**What goes wrong:** If `publicApiLimiter` is placed before `requireApiKey`, `req.apiKeyUserId` is undefined. The limiter falls back to IP keying (or undefined), breaking per-key enforcement.
**Why it happens:** Express middleware runs in declaration order. Rate limiter's `keyGenerator` reads from `req` at execution time.
**How to avoid:** Always declare `router.use(requireApiKey)` before `router.use(publicApiLimiter)`.

### Pitfall 3: File path for openapi.json at runtime
**What goes wrong:** `readFileSync('./openapi.json')` resolves relative to `process.cwd()` which depends on how the server is started. In production on Render, cwd is the repo root. In tests, it may be different.
**Why it happens:** Node.js `__dirname` doesn't exist in ESM modules.
**How to avoid:** Use `new URL('../../openapi.json', import.meta.url).pathname` to get a path relative to the source file, or use `process.cwd()` + `path.join()` consistently. Both approaches work; pick one and document it.

### Pitfall 4: webhook_deliveries status column migration
**What goes wrong:** Adding `status TEXT NOT NULL DEFAULT 'pending'` to an existing table works in SQLite for new rows but all existing rows get `status = 'pending'`. The poller will attempt to re-deliver old completed deliveries.
**Why it happens:** SQLite `ALTER TABLE ADD COLUMN` with a DEFAULT applies to all existing rows.
**How to avoid:** After the migration, run a one-time `UPDATE webhook_deliveries SET status = 'succeeded' WHERE delivered_at IS NOT NULL` and `UPDATE webhook_deliveries SET status = 'failed' WHERE failed_at IS NOT NULL AND retry_count >= 5`. Include these in the migration SQL file.

### Pitfall 5: SSRF bypass via DNS rebinding
**What goes wrong:** DNS pre-resolve at registration time may return a public IP, but by delivery time the DNS entry has been changed to a private IP (DNS rebinding attack).
**Why it happens:** DNS TTL expires between registration and delivery.
**How to avoid:** The requirement only mandates DNS check at registration time (before saving URL). This is the standard approach — document that deliveries are not re-checked. If deeper protection were needed, we'd need to use a custom fetch with IP-level SSRF check at delivery time, which is out of scope for v1.

### Pitfall 6: Double-counting rate limit headers
**What goes wrong:** Both the manual `addRateLimitHeaders()` middleware (lines 127-133 of publicApi.ts) and `express-rate-limit`'s `standardHeaders: true` emit `RateLimit-*` headers. Some clients may see duplicate headers.
**Why it happens:** The existing manual header code was a placeholder pending real enforcement.
**How to avoid:** Remove the manual `router.use()` middleware that calls `addRateLimitHeaders()` when adding `express-rate-limit`.

---

## Code Examples

### Existing audit log call pattern (from export.ts)
```typescript
// Pattern: dynamic import, async, non-blocking
const { insertAuditLog } = await import('../services/auditService.js');
await insertAuditLog({
  userId:     userId,
  userEmail:  null,
  ipAddress:  req.ip ?? null,
  projectId:  projectId ?? null,
  entityType: 'export',
  entityId:   projectId ?? '',
  action:     'export.wh347',
  meta:       { weekId },
});
```

### Existing rateLimit pattern (from auth.ts)
```typescript
import rateLimit from 'express-rate-limit';
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.ip ?? 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
router.post('/login', loginLimiter, async (req, res) => { ... });
```

### Existing test pattern (from tests/routes/projects.test.ts — representative)
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import supertest from 'supertest';
import { app } from '../../src/server/index.js';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../src/server/db/schema.js';

const db = (globalThis as any).__testDb as BetterSQLite3Database<typeof schema>;
const request = supertest(app);
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| IP-based rate limiting only | Per-key rate limiting with `keyGenerator` (express-rate-limit ≥7) | Required by API-01: 100 req/min per key hash |
| Static HTML docs page | OpenAPI 3.1 + swagger-ui-express | Enables Procore partnership pathway; Swagger UI is the enterprise standard |

---

## Environment Availability

Step 2.6: All dependencies are either already installed or available in npm. No external services required.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `express-rate-limit` | API-01, API-02 | Yes | ^8.4.1 (installed) | — |
| `node:dns` | API-04 SSRF | Yes | built-in | — |
| `swagger-ui-express` | API-03 | No — not installed | TBD | Hand-write static HTML (weaker) |
| `@types/swagger-ui-express` | API-03 (TS) | No — not installed | TBD | — |
| `better-sqlite3` (for poller) | API-05 | Yes | installed | — |

**Missing dependencies with no fallback:**
- `swagger-ui-express` and `@types/swagger-ui-express` — install in Plan 02 Wave 0

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.ts` (repo root) |
| Quick run command | `npx vitest run tests/routes/publicApi.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| API-01 | POST /api/keys creates key (shown once, hash stored) | unit | `npx vitest run tests/routes/publicApi.test.ts` | No — Wave 0 |
| API-01 | GET /api/keys lists prefix + metadata, not hash | unit | same | No — Wave 0 |
| API-01 | DELETE /api/keys/:id soft-revokes | unit | same | No — Wave 0 |
| API-02 | 401 without Bearer token | unit | same | No — Wave 0 |
| API-02 | 401 with invalid Bearer token | unit | same | No — Wave 0 |
| API-02 | GET /v1/projects returns {data, meta} shape | unit | same | No — Wave 0 |
| API-02 | Pagination (page, limit, total, hasNext) | unit | same | No — Wave 0 |
| API-04 | POST /api/webhooks blocks RFC 1918 URL | unit | `npx vitest run tests/routes/webhooks.test.ts` | No — Wave 0 |
| API-05 | Delivery poller sets status=failed after 5 attempts | unit | `npx vitest run tests/services/webhookPoller.test.ts` | No — Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/routes/publicApi.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green (currently 914 passing) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/routes/publicApi.test.ts` — covers API-01 and API-02 (auth, shape, pagination, scope enforcement)
- [ ] `tests/routes/webhooks.test.ts` — covers API-04 SSRF check
- [ ] `tests/services/webhookPoller.test.ts` — covers API-05 retry logic

*(No framework install needed — Vitest already configured)*

---

## Open Questions

1. **`express-rate-limit` in-memory store across Render deploys**
   - What we know: The current Render deployment is a single instance. `express-rate-limit` defaults to in-memory store.
   - What's unclear: If Render scales to multiple instances, in-memory rate limiting per-instance would allow 2x the limit.
   - Recommendation: Use in-memory store for now (single Render instance). Document the limitation. Redis-backed store is a future upgrade.

2. **Swagger UI path `/api/docs/html` conflicts with SPA catch-all**
   - What we know: `app.get('*', ...)` in production serves `index.html` as SPA catch-all. `swagger-ui-express` routes must be mounted BEFORE the SPA catch-all.
   - What's unclear: Whether the current ordering in `index.ts` already handles this correctly.
   - Recommendation: Mount `/api/docs` and `/api/docs/html` before the `if (process.env.NODE_ENV === 'production')` static block.

3. **openapi.json read path in production vs. development**
   - What we know: `import.meta.url`-relative path is the safest approach in ESM.
   - Recommendation: Use `new URL('../../openapi.json', import.meta.url)` in `index.ts`. Add `openapi.json` to the build/deploy manifest so it is present in the `dist/` folder or served from repo root.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `src/server/routes/publicApi.ts`, `apiKeys.ts`, `webhooks.ts`, `index.ts`
- Direct codebase inspection: `src/server/services/webhookService.ts`
- Direct codebase inspection: `src/server/db/schema.ts` lines 672-708
- Direct codebase inspection: `src/server/db/migrations/0043_api_keys_webhooks.sql`
- Direct codebase inspection: `src/client/pages/ApiKeysPage.tsx`, `WebhooksPage.tsx`, `ApiDocsPage.tsx`
- Direct codebase inspection: `package.json` (confirmed packages installed/missing)
- Direct codebase inspection: `vitest.config.ts`, `tests/helpers/db.ts`

### Secondary (MEDIUM confidence)
- express-rate-limit README pattern for `keyGenerator` — consistent with auth.ts usage in project
- swagger-ui-express CSP behavior — documented community issue, consistent with Helmet's default config

---

## Metadata

**Confidence breakdown:**
- Existing feature inventory: HIGH — direct file reads
- Gap identification: HIGH — confirmed by absence of code
- Standard stack: HIGH — packages verified in package.json
- Architecture patterns: HIGH — follows established project patterns
- Pitfalls: MEDIUM — Helmet/Swagger CSP is a known ecosystem issue

**Research date:** 2026-04-29
**Valid until:** 2026-05-29 (stable stack, 30 days)
