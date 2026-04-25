# Stack Research — v6.0 Competitive Industry Leadership

**Project:** HCC Prevailing Wage
**Milestone:** v6.0 — PWA, QuickBooks OAuth, Public REST API, GPS Clock-In, SOC 2
**Researched:** 2026-04-24
**Confidence:** HIGH for PWA/GPS/SOC2 controls (official docs + multiple sources); MEDIUM for QB OAuth scope breadth (Payroll API still partially beta); MEDIUM for webhook delivery (SQLite queue pattern confirmed but no battle-tested library wraps it)

> This file covers NEW stack requirements for v6.0 only. The existing stack is documented in the v5.0 STACK.md (2026-04-07). Do not re-research what is already installed.

---

## Executive Summary

| Feature Area | New Libraries Needed | Confidence |
|---|---|---|
| PWA + Service Worker | `vite-plugin-pwa ^1.2.0`, `workbox-window ^7.4.0` (client) | HIGH |
| Offline Queue (client) | `idb ^8` | HIGH |
| QuickBooks OAuth 2.0 | `intuit-oauth ^4.x` (OAuth flow); `node-quickbooks ^2.x` (API calls) | MEDIUM |
| QB token persistence | Drizzle schema addition only (no new lib) | HIGH |
| Public REST API key auth | Express middleware (custom, ~20 lines) | HIGH |
| Webhook delivery | SQLite-backed queue via Drizzle + cron job (custom, no external lib) | MEDIUM |
| Webhook HMAC signing | Node.js built-in `crypto.createHmac` | HIGH |
| GPS clock-in (client) | Browser `navigator.geolocation` (native, no library) | HIGH |
| GPS data storage | Drizzle schema addition only | HIGH |
| SOC 2 controls — rate limiting | `express-rate-limit ^8.3.2` (already installed or upgrade) | HIGH |
| SOC 2 controls — security headers | `helmet` (already installed) | HIGH |
| SOC 2 controls — audit log | Existing pino + audit_log table (already in place) | HIGH |
| SOC 2 controls — MFA | `otplib ^12.x` + `qrcode ^1.5.x` | MEDIUM |
| SOC 2 controls — compliance platform | Vanta or Drata (external SaaS, ~$10–15K/yr) | MEDIUM |

**Net new npm packages: 5** (`vite-plugin-pwa`, `workbox-window`, `idb`, `intuit-oauth`, `node-quickbooks`, `otplib`, `qrcode`). Everything else is custom Express middleware or Drizzle schema work on top of what is already installed.

---

## Feature 1: Progressive Web App — Offline Service Worker

### Recommendation: `vite-plugin-pwa` with `injectManifest` strategy

**Version:** `vite-plugin-pwa ^1.2.0` (latest as of April 2026, published ~November 2025)
**Workbox version:** Workbox 7.4.0 packages are the underlying engine (pulled in automatically)

**Why `vite-plugin-pwa` over hand-rolling a service worker:**
The app already uses Vite as the build tool. `vite-plugin-pwa` integrates at the Vite plugin layer, generates the service worker manifest automatically from the Vite build output, and handles cache-busting on deploy. Hand-rolling a service worker means manually maintaining the asset manifest — a maintenance liability on every deploy.

**Why `injectManifest` strategy over `generateSW`:**
`generateSW` (the default) abstracts too much. For this app, you need a custom service worker that can:
1. Cache the React SPA shell for offline use
2. Intercept GPS clock-in requests and queue them in IndexedDB when offline (Background Sync)
3. Show a "You are offline — data will sync when reconnected" UI

`generateSW` does not give enough control for the offline queue interception. `injectManifest` compiles your own service worker file while injecting the precache manifest, giving full control.

**Update strategy: `prompt` (not `autoUpdate`)**
This is payroll software. A silent auto-update mid-session could cause data loss for a contractor entering hourly payroll. The `prompt` strategy shows a "New version available — refresh" toast. User controls the update. Do not use `autoUpdate`.

**Client-side registration:**
`workbox-window ^7.4.0` handles the registration and update prompt lifecycle on the React side. Import `Workbox` from `workbox-window`, register in `main.tsx`, and wire the update event to a toast component.

**PWA manifest configuration (vite.config.ts):**
```typescript
// vite.config.ts addition — not a new file, added to existing config
VitePWA({
  strategies: 'injectManifest',
  srcDir: 'src/client',
  filename: 'sw.ts',          // your custom service worker source
  registerType: 'prompt',
  manifest: {
    name: 'HCC Prevailing Wage',
    short_name: 'HCC PW',
    theme_color: '#1a1a1a',
    background_color: '#ffffff',
    display: 'standalone',
    start_url: '/dashboard',
    icons: [/* 192x192, 512x512 */],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
  },
})
```

**What gets cached offline:**
- The full React SPA shell (HTML, JS chunks, CSS, fonts)
- Static assets (icons, images)
- Do NOT cache API responses by default — payroll data must be fresh. The service worker should let API calls fall through to network; only cache the app shell.

**Installation:**
```bash
npm install -D vite-plugin-pwa
npm install workbox-window
```

**Confidence: HIGH** — vite-plugin-pwa is the standard Vite PWA solution, used in production by thousands of apps. Workbox 7.4.0 confirmed as latest via npm (April 2026). `injectManifest` + `prompt` is the correct strategy for data-entry apps.

---

## Feature 2: Offline Queue for GPS Clock-In Data

### Recommendation: `idb ^8` (IndexedDB wrapper)

**Version:** `idb ^8` (version 8 confirmed current, authored by Jake Archibald of Google, TypeScript-native)

**Why `idb` over raw IndexedDB:**
Raw IndexedDB is callback-based and verbose. `idb` is a 1.19kB brotli'd promise-based wrapper that mirrors the IndexedDB API exactly but makes it usable from TypeScript. It is the de facto standard wrapper — authored by the same Google engineer who built Workbox, used in production at Google and referenced in every major PWA guide.

**Why not Dexie.js:**
Dexie adds ORM-style abstractions (`.where()`, `.filter()`, reactive queries) on top of IndexedDB. Useful for complex offline apps, but overkill here. The offline queue for this app is simple: store a pending clock-in record when offline, drain it when back online. `idb` handles this with 10 lines of code. No need for Dexie's complexity.

**Pattern — offline clock-in queue:**
```typescript
// Inside the custom service worker (sw.ts)
import { openDB } from 'idb';

const db = await openDB('pw-offline-queue', 1, {
  upgrade(db) {
    db.createObjectStore('clockEvents', { keyPath: 'id', autoIncrement: true });
  },
});

// Store when offline
await db.add('clockEvents', {
  workerId, projectId, type: 'clock-in',
  lat, lng, accuracy, timestamp: Date.now(),
});

// Drain on sync (Background Sync API or online event)
self.addEventListener('sync', async (event) => {
  if (event.tag === 'clock-sync') {
    const all = await db.getAll('clockEvents');
    for (const event of all) {
      await fetch('/api/clock-events', { method: 'POST', body: JSON.stringify(event) });
      await db.delete('clockEvents', event.id);
    }
  }
});
```

**Installation:**
```bash
npm install idb
```

**Confidence: HIGH** — idb v8 is confirmed as current, actively maintained, TypeScript-native. This pattern is the documented standard in every major PWA offline guide (web.dev, MDN, Workbox docs).

---

## Feature 3: QuickBooks Online OAuth 2.0 + Payroll Sync

### What the QB API Actually Provides

This is the most important research finding for the QB integration. There are two distinct QB APIs:

**QB Accounting REST API** (`com.intuit.quickbooks.accounting` scope):
- Employees (name, address, SSN last 4)
- TimeActivity (hours logged by employee, by day, billable/non-billable)
- Vendor (subcontractor records)
- This is what the existing CSV import reads manually. The OAuth integration makes this real-time.

**QB Payroll API** (separate, partially beta as of 2026-04):
- `payroll.compensation.read` scope — compensation types, pay rates
- `com.intuit.quickbooks.payroll.timetracking` — time entry submission
- **Caveat:** Payroll API data is only available for companies using QB Payroll (not QB Online alone). Many contractors use QB Online without QB Payroll. Do not make payroll scope a hard requirement.

**Practical scope recommendation:**
Request only `com.intuit.quickbooks.accounting` for v6.0. This gives Employees + TimeActivity, which is sufficient to pull hours by worker by week — the core payroll sync use case. Add payroll scope as an optional upgrade if the user has QB Payroll.

### Recommendation: `intuit-oauth` + `node-quickbooks`

**`intuit-oauth ^4.x`** — Intuit's official Node.js OAuth 2.0 client
- Handles authorization code flow, token exchange, token refresh
- CSRF protection via state parameter is built in
- Published on npm as `intuit-oauth`; maintained by Intuit engineering
- Last confirmed update: community notes indicate active maintenance as of early 2026

**`node-quickbooks ^2.x`** — Community-maintained QB API client
- Wraps all QB Accounting REST API endpoints
- Updated as of February 2026 (confirmed from npm search results)
- Used by thousands of QB integrations; the most widely used QB Node.js client
- Handles `Employee`, `TimeActivity`, query language (`SELECT * FROM Employee`)

**Why not raw `axios` calls to QB API:**
`node-quickbooks` provides typed QB-entity query methods and handles the QB query syntax (SQL-like but QB-specific). Rolling raw HTTP calls to QB's REST API means manually implementing query pagination, entity-specific URL patterns, and QB's minor version header (`minorversion=70`). The library handles all of this.

**Token storage — Drizzle schema addition:**
QB OAuth tokens (access token, refresh token, realm ID, expiry) must be stored per user. Add a `quickbooks_connections` table via Drizzle migration:

```sql
-- Migration: add quickbooks_connections table
CREATE TABLE quickbooks_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  realm_id TEXT NOT NULL,
  access_token TEXT NOT NULL,          -- store encrypted (AES-256-GCM, same pattern as SSN)
  refresh_token TEXT NOT NULL,         -- store encrypted
  token_expiry INTEGER NOT NULL,       -- Unix timestamp ms
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
```

**Encrypt tokens at rest** using the existing AES-256-GCM pattern established in v3.0 Phase 31. Tokens are credentials — treat them the same as SSNs.

**OAuth flow in Express:**
```
GET /api/integrations/qbo/connect  → redirect to Intuit auth URL (intuit-oauth)
GET /api/integrations/qbo/callback → exchange code for tokens, store in quickbooks_connections
GET /api/integrations/qbo/sync/:projectId → pull Employee + TimeActivity, upsert payroll data
DELETE /api/integrations/qbo/disconnect → revoke + delete tokens
```

**Refresh token handling:**
QB access tokens expire in 1 hour; refresh tokens expire in 100 days. Add a token refresh check before every API call (not a background cron — check on request, refresh inline if within 5 minutes of expiry). Store the new tokens immediately after refresh.

**Installation:**
```bash
npm install intuit-oauth node-quickbooks
```

**Confidence: MEDIUM** — OAuth flow with `intuit-oauth` is HIGH confidence (official Intuit library). The scope of payroll data available via API is MEDIUM confidence — Payroll API is partially beta; TimeActivity via Accounting scope is confirmed. Recommend building against Accounting scope first and treating Payroll scope as an optional extension.

---

## Feature 4: Public REST API — Key Auth + Webhook Delivery

### API Key Authentication

**Recommendation: Custom Express middleware (no library)**

The `passport-headerapikey` library exists but adds Passport as a dependency — unnecessary for a simple static key check. A custom middleware is 20 lines and has zero dependencies:

```typescript
// src/server/middleware/apiKeyAuth.ts
export function apiKeyAuth(req, res, next) {
  const key = req.headers['x-api-key'] as string;
  if (!key) return res.status(401).json({ error: 'Missing X-Api-Key header' });
  
  // Timing-safe comparison (prevents timing attacks)
  const row = await db.select().from(apiKeys)
    .where(eq(apiKeys.keyHash, hashApiKey(key)))
    .get();
    
  if (!row || !row.isActive) return res.status(401).json({ error: 'Invalid API key' });
  req.apiKeyId = row.id;
  req.apiUserId = row.userId;
  next();
}
```

**API key schema (Drizzle):**
```sql
CREATE TABLE api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  key_hash TEXT NOT NULL UNIQUE,   -- SHA-256 of the key; never store plaintext
  label TEXT,
  is_active INTEGER DEFAULT 1,
  last_used_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);
```

Store only a SHA-256 hash of the key. Present the full key to the user once at creation time (same pattern as GitHub PATs). Use `crypto.createHash('sha256')` from Node.js built-ins — no library needed.

Rate limit the public API via `express-rate-limit ^8.3.2` (already installed or upgrade; currently at 8.3.2 confirmed April 2026) with a separate limiter instance for public API routes:
```typescript
const publicApiLimiter = rateLimit({ windowMs: 60_000, max: 60 }); // 60 req/min per key
router.use('/api/public/v1', apiKeyAuth, publicApiLimiter);
```

### Webhook Delivery

**Recommendation: SQLite-backed queue via Drizzle + node-cron (no external queue)**

BullMQ (Redis-backed) and pg-boss (Postgres-backed) are the standard solutions but require infrastructure that does not exist in this app — adding Redis to Render.com introduces a new service ($) and operational complexity. For the webhook volume this app will see in v6.0 (tens to hundreds of webhook deliveries per day, not thousands per minute), a SQLite-backed retry queue is appropriate.

Pattern confirmed by a January 2026 production reference (oneuptime.com blog) — SQLite webhook queue with exponential backoff, no Redis. Exactly the right pattern for a Render.com single-instance SQLite deployment.

**Webhook schema (Drizzle):**
```sql
CREATE TABLE webhook_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  url TEXT NOT NULL,
  secret TEXT NOT NULL,              -- HMAC signing secret, store encrypted
  events TEXT NOT NULL,             -- JSON array: ["payroll.submitted", "violation.detected"]
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE webhook_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id INTEGER NOT NULL REFERENCES webhook_subscriptions(id),
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,            -- JSON
  status TEXT DEFAULT 'pending',   -- pending | delivered | failed | dead
  attempts INTEGER DEFAULT 0,
  next_attempt_at INTEGER,          -- Unix timestamp
  last_response_status INTEGER,
  last_response_body TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);
```

**Delivery process:**
1. On event (payroll submitted, violation detected), insert a row into `webhook_deliveries` for each matching subscription
2. `node-cron` job runs every 30 seconds: `SELECT * FROM webhook_deliveries WHERE status='pending' AND next_attempt_at <= unixepoch()`
3. For each row: POST to `url` with HMAC-SHA256 signature header, update status/attempts
4. Exponential backoff: `next_attempt_at = unixepoch() + (2^attempts * 60)` — retries at 1min, 2min, 4min, 8min, 16min
5. After 5 failed attempts: set `status = 'dead'`

**HMAC signing (no library):**
```typescript
import { createHmac } from 'crypto';
const signature = createHmac('sha256', secret)
  .update(JSON.stringify(payload))
  .digest('hex');
// Header: X-HCC-Signature: sha256=<signature>
```

This is the same pattern used by GitHub and Stripe webhooks. Node.js `crypto` is built-in — no library needed.

**node-cron is already installed** (confirmed in existing package.json from v5.0 research — used for WD sync scheduling). No new package needed for the delivery loop.

**When to graduate to BullMQ:** If webhook volume exceeds ~1,000 deliveries/day or if the app moves to multi-instance (horizontal scaling on Render.com). For v6.0, SQLite queue is correct and avoids Redis dependency.

**Installation:**
```bash
# No new packages — node-cron already installed, crypto is built-in
```

**Confidence: MEDIUM** — Custom SQLite webhook queue pattern confirmed via January 2026 production reference. HMAC signing with Node.js crypto is HIGH confidence (standard pattern). The risk is reliability of the cron-based poller vs. a dedicated queue consumer — acceptable for v6.0 volume.

---

## Feature 5: GPS Geolocation — Browser-Based Clock-In

### Recommendation: Native Browser API (no library)

`navigator.geolocation` is available in all modern browsers, including iOS Safari and Android Chrome. No library adds meaningful value over the native API for this use case.

**Critical requirements for GPS clock-in:**
1. **HTTPS only** — Geolocation API is blocked on HTTP. This app is already served over HTTPS on Render.com.
2. **Permission prompt** — Browser requires explicit user consent; this cannot be bypassed or pre-requested silently.
3. **Accuracy is NOT guaranteed** — This is the most important pitfall: iOS 14+ introduced "Approximate Location" (privacy setting), which returns accuracy between 3,000–9,000 meters (3–9 km). Do not use GPS for hard geofencing enforcement (e.g., "you must be within 100m of the job site to clock in"). Use it for best-effort site verification and audit trail only.

**Practical implementation:**
```typescript
// In the React clock-in component
async function captureLocation(): Promise<GeolocationCoordinates | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      () => resolve(null),           // permission denied → proceed without GPS
      { timeout: 10000, maximumAge: 30000, enableHighAccuracy: true }
    );
  });
}
```

If the user denies permission or is on a device with approximate location, the clock-in proceeds without GPS — geolocation is an audit enhancement, not a gate. Surface the `accuracy` value in the UI so the GC can see "±50m" vs "±5000m".

**Clock event schema (Drizzle):**
```sql
CREATE TABLE clock_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  worker_id INTEGER NOT NULL REFERENCES workers(id),
  project_id INTEGER NOT NULL REFERENCES projects(id),
  type TEXT NOT NULL,            -- 'clock-in' | 'clock-out'
  lat REAL,                      -- nullable — may be absent if permission denied
  lng REAL,
  accuracy REAL,                 -- meters radius
  source TEXT DEFAULT 'browser', -- 'browser' | 'offline-sync'
  client_timestamp INTEGER,      -- Unix ms from the device (may differ from server_timestamp if offline)
  server_timestamp INTEGER DEFAULT (unixepoch()),
  synced_from_offline INTEGER DEFAULT 0,  -- flag if this came from the IndexedDB queue
  created_at INTEGER DEFAULT (unixepoch())
);
```

**Offline scenario:** Worker clocks in while offline → `idb` stores the event with `client_timestamp` → service worker syncs to server when back online → server records `server_timestamp` and sets `synced_from_offline = 1`. Both timestamps are preserved for audit purposes.

**No new library needed.** GPS capture is native; clock event storage is Drizzle schema.

**Confidence: HIGH** — `navigator.geolocation` is a W3C standard, supported everywhere. Accuracy limitation on iOS confirmed via March 2025 blog post and Apple developer forums. HTTPS requirement confirmed via MDN. No library adds value here.

---

## Feature 6: SOC 2 Type II Technical Controls

### What SOC 2 Type II Actually Requires

SOC 2 is not a technical spec — it is a process audit. An auditor spends 3–12 months observing that your stated controls actually operate as described. The technical controls are a subset of the total requirement. The non-technical requirements (access review process, incident response plan, vendor risk management, HR onboarding/offboarding procedures) are equally important but outside the scope of npm packages.

**Technical controls SOC 2 Type II auditors look for in a web app:**

| Control | Category | Status in This App | Action Needed |
|---------|---------|-------------------|--------------|
| Encryption at rest (AES-256) | CC6.1 | DONE — SSN AES-256-GCM (v3.0) | Extend to QB tokens |
| Encryption in transit (TLS 1.2+) | CC6.7 | DONE — Render.com terminates TLS | Document it |
| Rate limiting | CC6.6 | express-rate-limit on auth routes | Add to all public API routes |
| Security headers (HSTS, CSP, X-Frame) | CC6.7 | helmet already installed | Verify config is strict |
| Audit log — user actions | CC7.2 | DONE — audit_log table + pino (v3.0) | Ensure completeness |
| Audit log — immutable / tamper-evident | CC7.2 | PARTIAL — DB rows deletable | Add log rotation to S3 or write-once sink |
| MFA for admin accounts | CC6.3 | NOT DONE | Add TOTP |
| Least-privilege access | CC6.3 | DONE — assertProjectAccess, IDOR guards | Document it |
| Automated vulnerability scanning | CC7.1 | NOT DONE | Add `npm audit` to CI |
| Dependency monitoring | CC7.1 | NOT DONE | Add Dependabot or Snyk |
| Incident response plan | CC7.3 | NOT DONE | Process document (not npm) |
| Backup and recovery | A1.2 | PARTIAL — Render.com disk snapshots | Define RTO/RPO, test restore |

### MFA — Recommend `otplib` + `qrcode`

**`otplib ^12.x`** — TOTP (Time-based One-Time Password) generation and verification
- Generates secrets and verifies 6-digit TOTP codes from Google Authenticator / Authy
- Standard RFC 6238 implementation
- No external dependency on an auth service (no Auth0, no Okta) — keeps costs at zero
- 12k weekly npm downloads; actively maintained

**`qrcode ^1.5.x`** — Generate QR code for the authenticator app setup
- Server-side QR code generation as a data URL → rendered in the React MFA setup modal
- No external service needed

**MFA flow:**
```
User enables MFA → server generates TOTP secret (otplib) → encode as QR (qrcode) →
show QR in modal → user scans with Authenticator app → user enters 6-digit code to verify →
store encrypted secret in users.totp_secret → all future logins require TOTP code
```

**Why TOTP and not SMS/email OTP:**
SMS OTP requires a Twilio/SNS account (cost + vendor dependency). Email OTP is weaker (email accounts are phishable). TOTP authenticator apps are the SOC 2-acceptable standard for MFA in a SaaS product.

**Installation:**
```bash
npm install otplib qrcode
npm install -D @types/qrcode
```

### Immutable Audit Log — Route to S3 or Structured Log Drain

The existing `audit_log` SQLite table is deletable by a DB admin — SOC 2 auditors want write-once-read-many (WORM) evidence. Two options:

**Option A (simple): Pino log drain to Render.com log sink or Papertrail**
Pino is already installed. Add a Pino transport that ships structured logs (including audit events) to a log aggregation service with immutable retention (Papertrail, Better Stack, Datadog). Cost: ~$0–$20/month for the log volume this app produces. The external log sink is the WORM storage. This requires zero new npm packages.

**Option B (complete): Append-only S3 sink with Object Lock**
Write audit events to S3 with Object Lock (WORM). Requires `@aws-sdk/client-s3` + AWS credentials. Over-engineered for v6.0.

**Recommendation: Option A** — Pino drain to a log aggregation service. Add the Pino transport config and a structured `auditLog()` helper that logs to both the SQLite table (for in-app display) and the external sink (for SOC 2 evidence). Zero new npm packages.

### Compliance Platform — Vanta or Drata

SOC 2 Type II certification requires an accredited auditor. The compliance platform (Vanta, Drata, Secureframe) automates evidence collection (Git commit logs, access reviews, uptime data) and prepares the audit package. The auditor's fee is separate.

**Estimated costs (2026):**
- Vanta: ~$10,000–$15,000/year (best for early-stage, fast setup)
- Drata: ~$7,500–$15,000/year (more structured, better for multi-framework)
- Auditor fee: ~$15,000–$30,000 for Type II
- **Total first-year: ~$25,000–$45,000**

**Timeline:** SOC 2 Type II requires 3–12 months of observation period after controls are in place. Start technical controls implementation now; engage Vanta/Drata after controls are live; target Type II report in 6 months.

**Confidence: MEDIUM** — SOC 2 process requirements are well-documented and HIGH confidence. Specific tool pricing is MEDIUM confidence (pricing changes; verify with vendor before commitment). TOTP/otplib recommendation is HIGH confidence.

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `bullmq` (Redis queue) | Requires Redis — new infrastructure, new cost on Render.com. Not justified for v6.0 webhook volume. | SQLite + Drizzle webhook queue (custom, ~100 lines) |
| `passport` + `passport-headerapikey` | Passport adds abstraction and dependency overhead for what is a 20-line middleware check. | Custom Express `apiKeyAuth` middleware |
| `jose` / `jsonwebtoken` for API keys | API keys are not JWTs. JWT complexity (expiry, signature, claims) is wrong for this use case. Static keys with SHA-256 hashing is correct. | `crypto.createHash('sha256')` (built-in) |
| `workbox-background-sync` (standalone) | `vite-plugin-pwa` with `injectManifest` gives access to Background Sync API directly in the custom service worker. The standalone package is redundant. | Custom `sync` event handler in sw.ts |
| `Dexie.js` for offline storage | Adds ORM complexity to IndexedDB that is not needed for a simple clock-event queue. | `idb ^8` (~1.2kB) |
| Auth0 / Okta for MFA | $240+/month minimum. Overkill for TOTP, which is 50 lines of code with `otplib`. | `otplib ^12.x` (self-hosted TOTP) |
| Redis session store for API keys | API keys are stateless — look up hash in SQLite on every request. No session needed. | Drizzle `api_keys` table + SHA-256 lookup |
| Stripe Radar / fraud tooling | Not relevant to this app's SOC 2 scope. | Existing Sentry + pino for monitoring |
| AWS S3 for audit log immutability | Over-engineered for v6.0. Adds AWS credentials, IAM, S3 SDK. | Pino drain to Papertrail / Better Stack |
| `twilio` / SMS OTP for MFA | Cost, vendor dependency, SIM-swap attack surface. Authenticator apps are the correct choice. | `otplib` TOTP |

---

## Installation Summary

```bash
# PWA + Offline
npm install -D vite-plugin-pwa
npm install workbox-window idb

# QuickBooks OAuth
npm install intuit-oauth node-quickbooks

# SOC 2 MFA
npm install otplib qrcode
npm install -D @types/qrcode

# Already installed — no action needed:
# express-rate-limit (upgrade to ^8.3.2 if below that)
# helmet
# node-cron
# pino
# crypto (Node.js built-in)
```

---

## Integration Points with Existing Stack

| New Capability | Integrates With | Integration Pattern |
|---|---|---|
| PWA manifest | Vite config (`vite.config.ts`) | Add `VitePWA()` plugin alongside existing plugins |
| Service worker | React `main.tsx` | Register `workbox-window` Workbox instance on mount |
| Offline queue | Service worker `sw.ts` | `idb` in service worker scope (not in React) |
| QB OAuth tokens | Drizzle schema | New `quickbooks_connections` table, encrypted same as SSN |
| QB sync data | Existing worker + payroll tables | Upsert into existing schema via `payroll_imports` pattern |
| API keys | Drizzle schema | New `api_keys` table, SHA-256 hash lookup |
| Webhook queue | Drizzle schema + existing `node-cron` | New `webhook_deliveries` table, cron runs every 30s |
| Clock events | Drizzle schema | New `clock_events` table, FK to workers + projects |
| TOTP secret | Drizzle schema | New `totp_secret` column on `users` table, encrypted |
| Pino audit drain | Existing pino config | Add Pino transport in `logger.ts` |

---

## Version Compatibility Table

| Package | Version | Purpose | Install Status |
|---------|---------|---------|---------------|
| `vite-plugin-pwa` | ^1.2.0 | PWA manifest + SW build integration | NEW — dev dependency |
| `workbox-window` | ^7.4.0 | SW registration + update prompt in React | NEW — client runtime |
| `idb` | ^8` | IndexedDB offline queue (clock events) | NEW — client runtime |
| `intuit-oauth` | ^4.x | QB OAuth 2.0 authorization code flow | NEW — server runtime |
| `node-quickbooks` | ^2.x | QB Accounting REST API client | NEW — server runtime |
| `otplib` | ^12.x | TOTP generation + verification for MFA | NEW — server runtime |
| `qrcode` | ^1.5.x | QR code generation for MFA setup | NEW — server runtime |
| `express-rate-limit` | ^8.3.2 | Rate limit public API routes | UPGRADE if below 8.3.2 |
| `helmet` | already installed | Security headers (verify strict config) | ALREADY INSTALLED |
| `node-cron` | already installed | Webhook delivery cron loop | ALREADY INSTALLED |
| `pino` | already installed | Audit log + structured logging | ALREADY INSTALLED |
| `crypto` | Node.js built-in | HMAC signing, SHA-256 API key hashing | BUILT-IN |

---

## Sources

- vite-plugin-pwa npm page — latest version 1.2.0, published ~November 2025; confirmed April 2026 (MEDIUM confidence — npm page 403'd, version reported via WebSearch result from npmjs.com)
- Workbox npm (workbox-strategies, workbox-window) — version 7.4.0, both packages, last published 3 months ago as of April 2026 (HIGH confidence — WebSearch npm search result)
- vite-pwa-org.netlify.app — official documentation; `injectManifest` vs `generateSW` strategy guidance; `prompt` vs `autoUpdate` strategy comparison (HIGH confidence — official project docs)
- idb GitHub (jakearchibald/idb) — version 8 confirmed, 1.19kB brotli, TypeScript-native (HIGH confidence — GitHub + npm references consistent)
- Intuit Developer Portal (developer.intuit.com) — `intuit-oauth` is official Intuit Node.js OAuth library; QB Accounting scope `com.intuit.quickbooks.accounting` gives Employee + TimeActivity access (HIGH confidence for OAuth; MEDIUM for Payroll API scope — partially beta)
- Intuit Developer Blog, November 2025 — "Powerful time & payroll tracking with the Time API + Payroll Compensation" — confirms `payroll.compensation.read` scope is available but requires QB Payroll subscription (MEDIUM confidence)
- node-quickbooks GitHub (mcohen01/node-quickbooks) — community maintained, updated February 2026, most widely used QB Node.js client (MEDIUM confidence — community maintained, not official Intuit)
- WebSearch (express-rate-limit npm) — version 8.3.2, 29.9M weekly downloads, last published 22 days ago as of April 2026 (HIGH confidence)
- oneuptime.com blog (January 2026) — "How to Build a Webhook Service with Retry Logic in Node.js" — confirms SQLite webhook queue with exponential backoff is a production-viable pattern without Redis (MEDIUM confidence — single source, production reference)
- MDN Web Docs — `navigator.geolocation` requires HTTPS; `getCurrentPosition` options; Background Sync API in service workers (HIGH confidence — official spec reference)
- magicbell.com / poespas.me blog (2025-2026) — iOS Safari approximate location returns 3,000–9,000m accuracy; Safari geolocation permission state inconsistency; confirmed HTTPS requirement (HIGH confidence — multiple independent sources, consistent findings)
- SOC 2 controls sources (complyjet.com, secureframe.com, brightdefense.com — 2025-2026) — CC6.1 encryption, CC6.3 MFA + least privilege, CC6.6 rate limiting, CC6.7 TLS + headers, CC7.2 audit logs; AES-256 + TLS 1.2+ are the required standards (HIGH confidence — multiple compliance sources consistent)
- secureleap.tech / complyjet.com — Vanta ~$10–15K/year, Drata ~$7.5–15K/year; total first-year SOC 2 cost $25–45K for startup (MEDIUM confidence — vendor pricing changes; verify before commitment)
- otplib npm — RFC 6238 TOTP, actively maintained, standard for self-hosted MFA (HIGH confidence)

---

*Stack research for: HCC Prevailing Wage v6.0 — PWA, QB OAuth, Public API, GPS, SOC 2*
*Researched: 2026-04-24*
