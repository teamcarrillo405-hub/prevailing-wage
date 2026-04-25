# Architecture Patterns — v6.0 Integration Analysis

**Project:** HCC Prevailing Wage
**Researched:** 2026-04-24
**Scope:** How PWA service worker, QuickBooks OAuth, public REST API, GPS field tools, DBE/MBE tracking, and SOC 2 controls integrate with the existing Express 5 / React 19 / SQLite / Drizzle monolith.

---

## Existing Architecture Baseline (Do Not Re-Research)

- Express 5 monolith, `/api/*` route files per domain, `requireAuth` + `assertProjectAccess` middleware pattern
- React 19 SPA, Vite, React Router, TanStack Query
- SQLite WAL mode, Drizzle ORM, add-only migrations, 18 tables
- AES-256-GCM SSN encryption, session auth via HTTP-only cookie (7-day)
- Single process on Render.com with persistent disk at `/var/data`
- 25 pages, 80+ endpoints, `auditLogs` table already exists with `diff`, `snapshot`, `meta` JSONB columns

---

## 1. PWA Service Worker — Vite + Workbox Integration

### Integration Pattern

Use `vite-plugin-pwa` (wraps Workbox's `generateSW` mode). Install:

```bash
npm install -D vite-plugin-pwa
```

Add to `vite.config.ts`:

```typescript
import { VitePWA } from 'vite-plugin-pwa';

VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: 'HCC Prevailing Wage',
    short_name: 'HCC PW',
    theme_color: '#1a1a1a',
    display: 'standalone',
  },
  workbox: {
    // Cache static assets — app shell
    globPatterns: ['**/*.{js,css,html,ico,png,woff2}'],
    navigateFallback: '/index.html',
    navigateFallbackDenylist: [/^\/api\//],   // never intercept API routes with nav fallback

    runtimeCaching: [
      // Wage determination cache — long TTL, stale-while-revalidate
      {
        urlPattern: /^\/api\/wage-determinations\/.*/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'wd-cache',
          expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
      // Offline write queue — GPS clock events and field payroll entries
      {
        urlPattern: /^\/api\/clock-events$/i,
        method: 'POST',
        handler: 'NetworkOnly',
        options: {
          backgroundSync: {
            name: 'clockEventQueue',
            options: { maxRetentionTime: 24 * 60 },  // 24 hours in minutes
          },
        },
      },
      {
        urlPattern: /^\/api\/payroll-entries$/i,
        method: 'POST',
        handler: 'NetworkOnly',
        options: {
          backgroundSync: {
            name: 'payrollEntryQueue',
            options: { maxRetentionTime: 7 * 24 * 60 },  // 7 days
          },
        },
      },
    ],
  },
})
```

### Offline Queue Sync Behavior

**How reconnect works:** `BackgroundSyncPlugin` hooks into `fetchDidFail` — it only queues requests that fail due to a real network exception, NOT 4xx/5xx HTTP errors. On reconnect, the browser (Chrome, Edge, Samsung Internet) fires a native `sync` event to the service worker, which replays queued requests. Firefox and Safari fall back to replaying when the SW next starts up (i.e., user opens the app tab).

**Critical limitation:** Requests are stored in IndexedDB under `workbox-background-sync` keyed by queue name. Requests older than `maxRetentionTime` are silently discarded. For payroll entries use 7-day retention. For clock events use 24-hour retention.

**Auth cookies:** HTTP-only session cookies are automatically included in replayed requests — no special handling needed because `NetworkOnly` passes the original request headers through.

**Conflict detection on Express side:** When a queued POST arrives on reconnect, the server must handle idempotency. Add a client-generated `idempotencyKey` (UUID v4 created at form submission) to GPS clock and payroll entry bodies. Express checks the key in DB before inserting:

```typescript
// Pseudocode — add to clock-events route
const existing = await db.select().from(clockEvents)
  .where(eq(clockEvents.idempotencyKey, body.idempotencyKey)).limit(1);
if (existing.length) { res.json({ data: existing[0] }); return; }
```

### New Files Needed

- `vite.config.ts` — add `VitePWA()` plugin
- `src/client/hooks/useOfflineStatus.ts` — wrapper around `navigator.onLine` + `online`/`offline` events
- `src/client/components/OfflineBanner.tsx` — visible indicator when offline
- No server changes for SW itself; only endpoint-level idempotency keys

**Confidence: HIGH** — `vite-plugin-pwa` generateSW mode is the documented pattern; Workbox `BackgroundSyncPlugin` behavior verified against Chrome for Developers docs.

---

## 2. QuickBooks Online OAuth 2.0

### Token Lifecycle (Verified)

| Token | Lifetime | Notes |
|-------|----------|-------|
| Access token | 3,600 seconds (1 hour) | Use for QBO API calls |
| Refresh token | 101 days | **Rotates on every refresh call** — always persist the new one |

The refresh token changes on each use. If you don't persist the new value, the connection breaks and the user must re-authorize. This is the single most common QBO integration failure.

### Token Storage — New DB Table

Add to `schema.ts`:

```typescript
export const qboConnections = sqliteTable('qbo_connections', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  realmId: text('realm_id').notNull(),            // QBO company ID
  accessToken: text('access_token').notNull(),     // AES-256-GCM encrypted (same key as SSN)
  refreshToken: text('refresh_token').notNull(),   // AES-256-GCM encrypted
  accessTokenExpiresAt: text('access_token_expires_at').notNull(),
  refreshTokenExpiresAt: text('refresh_token_expires_at').notNull(),
  environment: text('environment').notNull().$type<'sandbox' | 'production'>(),
  connectedAt: text('connected_at').notNull(),
  lastRefreshedAt: text('last_refreshed_at'),
  disconnectedAt: text('disconnected_at'),         // soft-delete; null = active
}, (table) => ({
  qboUserUnique: uniqueIndex('qbo_user_unique').on(table.userId, table.realmId),
}));
```

**Encrypt both tokens at rest** using the existing `encryptSsn` / `decryptSsn` utility (or a renamed peer) — same AES-256-GCM envelope pattern already established in Phase 31.

### OAuth Flow Architecture

```
Browser → GET /api/qbo/connect
  → Server builds Intuit auth URL (client_id, redirect_uri, scope=com.intuit.quickbooks.accounting, state=CSRF token)
  → Browser redirects to Intuit

Intuit → GET /api/qbo/callback?code=...&realmId=...&state=...
  → Server validates CSRF state
  → Server POST to https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer
  → Encrypt and upsert into qbo_connections
  → Redirect to /settings?qbo=connected
```

Library recommendation: `intuit-oauth` (Intuit's official JS client). Avoids manual token exchange.

```bash
npm install intuit-oauth
```

### Token Refresh Strategy

Do NOT use a background cron on Render (single-process, no reliable scheduler). Use a **lazy refresh** — check expiry on every QBO API call:

```typescript
async function getValidQboToken(userId: string) {
  const conn = await db.select().from(qboConnections)
    .where(and(eq(qboConnections.userId, userId), isNull(qboConnections.disconnectedAt)))
    .limit(1);
  if (!conn.length) throw new Error('QBO not connected');

  const expiresAt = new Date(conn[0].accessTokenExpiresAt).getTime();
  if (Date.now() > expiresAt - 300_000) {  // refresh 5 min before expiry
    const newTokens = await oauthClient.refresh();
    await db.update(qboConnections).set({
      accessToken: encrypt(newTokens.access_token),
      refreshToken: encrypt(newTokens.refresh_token),
      accessTokenExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
      refreshTokenExpiresAt: new Date(Date.now() + 101 * 86400_000).toISOString(),
      lastRefreshedAt: new Date().toISOString(),
    }).where(eq(qboConnections.userId, userId));
  }
  return decrypt(conn[0].accessToken);
}
```

### Sandbox vs Production

- `environment: 'sandbox'` uses `https://sandbox-quickbooks.api.intuit.com`
- `environment: 'production'` uses `https://quickbooks.api.intuit.com`
- Store per-connection; allow users to switch. Never hard-code the base URL.

### Webhook Subscription (Payroll Changes)

QBO webhooks notify on entity changes. Register via Intuit Developer Portal (one URL per app, not per company). Your Express endpoint:

```
POST /api/qbo/webhook
```

Verification:
```typescript
import crypto from 'crypto';
const sig = req.headers['intuit-signature'] as string;
const body = req.rawBody;  // need express raw body for webhook route
const hash = crypto.createHmac('sha256', process.env.QBO_WEBHOOK_VERIFIER_TOKEN!)
  .update(body).digest('base64');
if (hash !== sig) { res.status(401).end(); return; }
```

**Important:** QBO webhooks deliver change notifications, not full payloads. The payload contains `{ eventNotifications: [{ realmId, dataChangeEvent: { entities: [{ name, id, operation, lastUpdated }] } }] }`. You must then call the QBO API to fetch the changed entity.

Relevant entity types for payroll sync: `Employee`, `TimeActivity`, `JournalEntry`.

**New route files needed:**
- `src/server/routes/qbo.ts` — `/connect`, `/callback`, `/disconnect`, `/webhook`, `/sync`

**Confidence: HIGH** — Token lifetime and rotation confirmed via Intuit developer docs. HMAC verification pattern confirmed via multiple sources.

---

## 3. Public REST API — Design on Top of Existing Routes

### API Key Table Schema

```typescript
export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  keyHash: text('key_hash').notNull().unique(),   // SHA-256 of raw key — never store raw
  keyPrefix: text('key_prefix').notNull(),        // first 8 chars for display (e.g. "hccpw_ab")
  name: text('name').notNull(),                   // user-given label
  scopes: text('scopes').notNull(),               // JSON array: ["projects:read","payroll:read"]
  rateLimitTier: text('rate_limit_tier').notNull().default('standard')
    .$type<'standard' | 'premium' | 'internal'>(),
  lastUsedAt: text('last_used_at'),
  expiresAt: text('expires_at'),                  // null = never
  revokedAt: text('revoked_at'),                  // null = active
  createdAt: text('created_at').notNull(),
}, (table) => ({
  idxApiKeyHash: index('idx_api_key_hash').on(table.keyHash),
}));
```

Key generation: `hccpw_` prefix + 32 random bytes as hex. Show raw key once at creation; store only the SHA-256 hash.

### Rate Limiting Per Key

Use `express-rate-limit` with a custom `keyGenerator` based on the API key hash rather than IP:

```bash
npm install express-rate-limit
```

```typescript
import rateLimit from 'express-rate-limit';

const apiKeyLimiter = rateLimit({
  windowMs: 60_000,
  max: (req) => {
    const tier = (req as any).apiKeyTier;
    return tier === 'premium' ? 600 : tier === 'internal' ? 10_000 : 100;
  },
  keyGenerator: (req) => (req as any).apiKeyHash ?? req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded' },
});
```

Apply to `/api/v1/*` routes only. Session-authed routes remain on existing `/api/*` paths.

### Versioning Strategy

Mount public API under `/api/v1/` as a separate Express Router. Do not version existing session-based routes — those are internal UI routes, not public contract.

```typescript
// src/server/routes/publicApi.ts
const v1Router = Router();
v1Router.use(authenticateApiKey);   // middleware that hashes key, looks up apiKeys table
v1Router.use(apiKeyLimiter);
v1Router.get('/projects', ...);
v1Router.get('/projects/:id/payroll-weeks', ...);
// Reuse existing service functions, not route handlers
app.use('/api/v1', v1Router);
```

This avoids duplicating business logic — public API calls the same Drizzle queries already backing the UI routes but with API key auth instead of session auth.

### Webhook Delivery Queue (SQLite-Based)

External queue services (SQS, Redis) are overkill for this deployment tier. Use SQLite with a polling loop:

```typescript
export const webhookSubscriptions = sqliteTable('webhook_subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  events: text('events').notNull(),               // JSON array: ["payroll.week.submitted","project.created"]
  signingSecret: text('signing_secret').notNull(), // random 32-byte hex for HMAC
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
});

export const webhookDeliveries = sqliteTable('webhook_deliveries', {
  id: text('id').primaryKey(),
  subscriptionId: text('subscription_id').notNull().references(() => webhookSubscriptions.id),
  event: text('event').notNull(),
  payload: text('payload').notNull(),             // JSON
  status: text('status').notNull().default('pending').$type<'pending' | 'delivered' | 'failed'>(),
  attemptCount: integer('attempt_count').notNull().default(0),
  nextAttemptAt: text('next_attempt_at').notNull(),
  lastAttemptAt: text('last_attempt_at'),
  lastResponseCode: integer('last_response_code'),
  lastErrorMessage: text('last_error_message'),
  deliveredAt: text('delivered_at'),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  idxDeliveryStatus: index('idx_delivery_status').on(table.status, table.nextAttemptAt),
}));
```

Delivery worker: `setInterval` every 30 seconds in the Express process (acceptable for Render single-process). Use exponential backoff: attempt 1 = now, attempt 2 = +1 min, attempt 3 = +5 min, attempt 4 = +30 min, attempt 5 = fail permanently. Maximum 5 attempts.

**Confidence: HIGH** for schema design. MEDIUM for SQLite polling approach — works correctly at this scale, but creates a ceiling around ~500 active webhook subscriptions before query latency becomes noticeable. Acceptable for Phase D scope.

---

## 4. GPS Geolocation — Browser PWA to Server Audit

### Accuracy Reality

| Method | Typical Accuracy | Notes |
|--------|-----------------|-------|
| GPS (mobile outdoors) | 3–10 meters | Best; requires `enableHighAccuracy: true` |
| Wi-Fi triangulation | 20–100 meters | Indoor buildings |
| Cellular | 100–1000 meters | Fallback only |

For job-site clock-in, `enableHighAccuracy: true` is appropriate. Expect 5–15 second warm-up on cold GPS. Accuracy property on `GeolocationCoordinates` represents 95% confidence radius in meters.

### Browser API Pattern

```typescript
// src/client/hooks/useGeolocation.ts
export function getHighAccuracyPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 0,
    });
  });
}
```

Return `coords.latitude`, `coords.longitude`, `coords.accuracy` (meters), and `timestamp` to the server.

### Server-Side Storage and Verification

New table:

```typescript
export const clockEvents = sqliteTable('clock_events', {
  id: text('id').primaryKey(),
  workerId: text('worker_id').notNull().references(() => workers.id),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull().$type<'clock_in' | 'clock_out'>(),
  // GPS data from client
  latitude: real('latitude'),
  longitude: real('longitude'),
  accuracyMeters: real('accuracy_meters'),
  clientTimestamp: text('client_timestamp').notNull(),    // ISO 8601 from device
  serverTimestamp: text('server_timestamp').notNull(),    // server time — authoritative
  idempotencyKey: text('idempotency_key').notNull().unique(),
  // Verification fields
  geofenceResult: text('geofence_result').$type<'inside' | 'outside' | 'low_accuracy' | 'no_gps'>(),
  geofenceRadiusMeters: real('geofence_radius_meters'),
  capturedByUserId: text('captured_by_user_id').references(() => users.id),
  offlineSynced: integer('offline_synced', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  idxClockProject: index('idx_clock_project').on(table.projectId, table.clientTimestamp),
  idxClockWorker: index('idx_clock_worker').on(table.workerId, table.clientTimestamp),
}));
```

### Server-Side Geofence Check

Projects store a `siteLatitude`, `siteLongitude`, `siteRadiusMeters` (add to `projects` table). On clock-in POST, compute Haversine distance server-side:

```typescript
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

Accept the event regardless (audit trail matters more than gate-keeping), but set `geofenceResult` accordingly. Flag `outside` events on the compliance dashboard.

**Battery Impact:** `getCurrentPosition` (one-shot) has negligible battery impact. Avoid `watchPosition` (continuous polling) for clock-in use cases — just call once at tap.

**Confidence: MEDIUM** — Geolocation API behavior verified via MDN and Chrome docs. Accuracy values are real-world estimates from multiple sources.

---

## 5. DBE/MBE/WBE Certification Tracking

### Regulatory Context (2025)

An Intuit Interim Final Rule (October 2025) changed federal DBE certification to require individualized demonstrations — no longer race/sex presumption-based. Annual renewal required. This means expiration tracking is now more operationally critical than before.

### Table Schema

Attach to existing `subcontractors` table (project-scoped). The subcontractor entity already exists — add a companion `subcontractorCertifications` table rather than cramming columns into the wide `subcontractors` row:

```typescript
export const subcontractorCertifications = sqliteTable('subcontractor_certifications', {
  id: text('id').primaryKey(),
  subcontractorId: text('subcontractor_id').notNull()
    .references(() => subcontractors.id, { onDelete: 'cascade' }),
  certType: text('cert_type').notNull()
    .$type<'DBE' | 'MBE' | 'WBE' | 'ACDBE' | 'SBE' | 'DVBE' | 'HUBZone' | 'other'>(),
  certNumber: text('cert_number'),
  certifyingAgency: text('certifying_agency').notNull(),   // e.g. "CA CUCP", "USDOT", "NYC SBS"
  issuedDate: text('issued_date'),
  expiresDate: text('expires_date'),                       // null = perpetual (rare)
  verificationUrl: text('verification_url'),               // link to public registry
  verifiedAt: text('verified_at'),                         // when we last confirmed via registry
  verifiedByUserId: text('verified_by_user_id').references(() => users.id),
  status: text('status').notNull().default('active')
    .$type<'active' | 'expired' | 'suspended' | 'revoked' | 'pending_renewal'>(),
  documentPath: text('document_path'),                     // uploaded certificate file path
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  idxCertSub: index('idx_cert_sub').on(table.subcontractorId, table.certType),
  idxCertExpiry: index('idx_cert_expiry').on(table.expiresDate, table.status),
}));
```

### Expiration Warning Workflow

- `idxCertExpiry` index enables efficient query: `WHERE expires_date BETWEEN today AND today+30 AND status='active'`
- Dashboard badge: "3 certifications expiring within 30 days" — reuse existing `Badge` primitive
- Email notification via existing nodemailer infrastructure: trigger on nightly check (or lazy on page load if Render cron not available)
- `status` field transitions: `active` → `pending_renewal` (at 30-day warning) → `expired` (past `expiresDate`) — update via server-side check, not trigger

### Integration with Existing subcontractors Table

`subcontractors` is already project-scoped. `subcontractorCertifications` references `subcontractors.id` — no schema change to `subcontractors` needed. The sub detail page gains a "Certifications" tab.

**Confidence: HIGH** for schema design. MEDIUM for regulatory context (federal rule confirmed via search, specific state variations require additional research per state).

---

## 6. SOC 2 Type II Controls Architecture

### Gap Analysis Against Existing `auditLogs` Table

The existing table is structurally good (`userId`, `userEmail`, `ipAddress`, `entityType`, `action`, `diff`, `snapshot`, `meta`). SOC 2 Type II requires:

1. **Tamper-evidence** — existing rows can be updated or deleted by anyone with DB access
2. **Authentication events** — login, logout, failed login must be logged (check if currently written)
3. **Access control changes** — team member add/remove, role change (check coverage)
4. **Data export events** — every WH-347 PDF, CSV, XML export must be logged
5. **Retention policy** — logs must be retained for minimum 1 year (SOC 2 standard)
6. **Monitoring** — anomaly detection on `failed_login` frequency

### Additional Tables Needed

**Security events table** (separate from `auditLogs` to avoid schema pollution):

```typescript
export const securityEvents = sqliteTable('security_events', {
  id: text('id').primaryKey(),
  eventType: text('event_type').notNull()
    .$type<
      | 'login_success' | 'login_failure' | 'logout'
      | 'password_change' | 'invite_sent' | 'invite_accepted'
      | 'member_removed' | 'role_changed' | 'ownership_transferred'
      | 'api_key_created' | 'api_key_revoked'
      | 'qbo_connected' | 'qbo_disconnected'
      | 'export_wh347' | 'export_csv' | 'export_xml'
      | 'ssn_decrypted'                              // each time full SSN accessed server-side
    >(),
  userId: text('user_id').references(() => users.id),
  userEmail: text('user_email'),
  ipAddress: text('ip_address').notNull(),
  userAgent: text('user_agent'),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'set null' }),
  entityType: text('entity_type'),
  entityId: text('entity_id'),
  outcome: text('outcome').notNull().$type<'success' | 'failure' | 'blocked'>(),
  meta: text('meta'),                                // JSON — additional context
  createdAt: text('created_at').notNull(),
}, (table) => ({
  idxSecEventType: index('idx_sec_event_type').on(table.eventType, table.createdAt),
  idxSecUser: index('idx_sec_user').on(table.userId, table.createdAt),
  idxSecIp: index('idx_sec_ip').on(table.ipAddress, table.createdAt),
}));
```

**Tamper-evidence via hash chain** (append to `auditLogs`):

Add two columns to `auditLogs` via migration:

```sql
ALTER TABLE audit_logs ADD COLUMN prev_hash TEXT;
ALTER TABLE audit_logs ADD COLUMN row_hash TEXT;
```

On insert, compute:
```
row_hash = SHA-256(id + created_at + entity_type + entity_id + action + prev_hash_of_last_row)
```

This makes deletion or modification detectable. Store `prev_hash` of the last-inserted row. A periodic integrity check job can walk the chain.

**Rate limit / brute force table** (for SOC 2 CC6.1 — logical access):

```typescript
export const loginAttempts = sqliteTable('login_attempts', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  ipAddress: text('ip_address').notNull(),
  success: integer('success', { mode: 'boolean' }).notNull(),
  attemptedAt: text('attempted_at').notNull(),
}, (table) => ({
  idxAttemptIp: index('idx_attempt_ip').on(table.ipAddress, table.attemptedAt),
  idxAttemptEmail: index('idx_attempt_email').on(table.email, table.attemptedAt),
}));
```

Gate login: if 5+ failures from same IP in 15 minutes, return 429 before checking password.

### Controls Coverage Map

| SOC 2 Criterion | Control | Implementation |
|----------------|---------|---------------|
| CC6.1 Logical access | Password hash (bcrypt), HTTP-only session cookie | Already done |
| CC6.1 Brute force | `loginAttempts` table + 429 gate | New — `loginAttempts` table |
| CC6.2 Access provisioning | Team invite flow with token | Already done |
| CC6.3 Access removal | `removedAt` on `projectMembers` | Already done |
| CC7.2 Anomaly monitoring | `securityEvents` query for failed_login spikes | New — `securityEvents` table |
| CC8.1 Change management | Drizzle migrations in version control | Already done |
| A1.2 Data retention | Explicit 1-year retention policy on `audit_logs` | New — scheduled purge after 1 year |
| C1.1 Confidentiality | AES-256-GCM SSN encryption | Already done |
| C1.1 API token confidentiality | SHA-256 hash of API keys, encrypted QBO tokens | New — `apiKeys` + `qboConnections` tables |
| PI1.4 Completeness | Export events in `securityEvents` | New |

### Log What Is Currently Missing

Based on the existing route code pattern, these events likely need explicit `auditLogs` / `securityEvents` writes added:

- Every `POST /api/auth/login` (success + failure)
- Every `POST /api/auth/logout`
- Every PDF/CSV/XML generation endpoint
- Every SSN decryption (already flagged above as `ssn_decrypted`)
- Every team invite send, accept, revoke

**Confidence: MEDIUM** — SOC 2 control requirements verified across multiple authoritative sources (AICPA Trust Services Criteria). Hash-chain tamper-evidence pattern verified via SQLite forum and security engineering sources. Specific auditor interpretation may vary.

---

## New DB Tables Summary

| Table | Phase | Purpose |
|-------|-------|---------|
| `qbo_connections` | B | QBO OAuth token storage (encrypted) |
| `clock_events` | C | GPS clock-in/out with geofence results |
| `subcontractor_certifications` | B | DBE/MBE/WBE cert tracking with expiry |
| `api_keys` | D | Public API key auth |
| `webhook_subscriptions` | D | Webhook endpoint registrations |
| `webhook_deliveries` | D | Webhook delivery queue and retry log |
| `security_events` | D | SOC 2 security event audit trail |
| `login_attempts` | D | Brute-force rate limiting log |

**Columns to add to existing tables:**

| Table | New Columns | Phase |
|-------|-------------|-------|
| `projects` | `siteLatitude`, `siteLongitude`, `siteRadiusMeters` | C |
| `audit_logs` | `prev_hash`, `row_hash` | D |

---

## New Route Files Summary

| File | Routes | Phase |
|------|--------|-------|
| `src/server/routes/qbo.ts` | `/connect`, `/callback`, `/disconnect`, `/webhook`, `/sync` | B |
| `src/server/routes/clock-events.ts` | `POST /`, `GET /?workerId=` | C |
| `src/server/routes/subcontractor-certifications.ts` | CRUD on certs, expiry query | B |
| `src/server/routes/api-keys.ts` | Create, list, revoke | D |
| `src/server/routes/webhook-subscriptions.ts` | CRUD + delivery log | D |
| `src/server/routes/public-api.ts` | V1 public router | D |

---

## Build Order Recommendation (Phases A–D)

**Phase A — UI Polish:** No new tables or routes. Pure React + CSS work.

**Phase B — Power Features:**
1. `subcontractor_certifications` table + route (no external dependency — safe to ship first)
2. `qbo_connections` table + QBO OAuth routes (requires Intuit Developer app registration)
3. Apprenticeship ratio enforcement extends existing `payrollEntries` compliance engine

**Phase C — Mobile/Field PWA:**
1. Add `vite-plugin-pwa` + manifest (isolated to `vite.config.ts` — zero server risk)
2. `OfflineBanner` component + `useOfflineStatus` hook
3. `clock_events` table + route + GPS hook
4. Wire offline queue (Workbox backgroundSync config)

**Phase D — Market Credibility:**
1. `login_attempts` + brute-force gate (security prerequisite for SOC 2)
2. `security_events` table + instrument existing auth routes
3. Hash chain on `audit_logs`
4. `api_keys` table + public API router
5. `webhook_subscriptions` + `webhook_deliveries` + delivery worker

---

## Critical Integration Constraints

1. **No new auth model** — API key auth is a new middleware path (`authenticateApiKey`) parallel to session auth (`requireAuth`), not a replacement.
2. **Encrypt QBO tokens** — Use the same AES-256-GCM encrypt/decrypt utility from Phase 31. Never store plaintext OAuth tokens.
3. **Refresh token rotation** — On every QBO API call, check `accessTokenExpiresAt`; if within 5 minutes of expiry, refresh and persist the new refresh token immediately. Failure to do this causes irreversible disconnection after 101 days.
4. **Idempotency on offline sync** — GPS clock events and any payroll entry submitted via offline queue must include client-generated `idempotencyKey` (UUID v4). Express checks before inserting.
5. **BackgroundSync only queues network failures** — 4xx/5xx responses are NOT retried. Server validation errors must be surfaced before offline queue submission (validate client-side first).
6. **SQLite single-writer constraint** — Webhook delivery worker runs in the same process. Use `setInterval` not a spawned child process. WAL mode already mitigates reader/writer contention.
7. **Render.com single-process** — No background cron available. Token refresh is lazy (per-request). Webhook delivery loop is `setInterval`. This is the correct pattern for this hosting tier.

---

## Sources

- [Workbox BackgroundSyncPlugin — Chrome for Developers](https://developer.chrome.com/docs/workbox/modules/workbox-background-sync)
- [vite-plugin-pwa generateSW docs](https://vite-pwa-org.netlify.app/workbox/generate-sw)
- [QBO OAuth 2.0 token expiration handling — Intuit Help](https://help.developer.intuit.com/s/article/Handling-OAuth-token-expiration)
- [QBO OAuth 2.0 FAQ — Intuit Developer](https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/faq)
- [QuickBooks Webhooks — Coefficient](https://coefficient.io/quickbooks-api/quickbooks-webhooks)
- [express-rate-limit npm](https://www.npmjs.com/package/express-rate-limit)
- [GeolocationCoordinates.accuracy — MDN](https://developer.mozilla.org/en-US/docs/Web/API/GeolocationCoordinates/accuracy)
- [Immutability for SOC 2 — hoop.dev](https://hoop.dev/blog/immutability-for-soc-2-how-to-protect-evidence-logs-and-records-permanently/)
- [SOC 2 Compliance for Database Security — Liquibase](https://www.liquibase.com/resources/guides/soc-2-compliance-for-database-security-trust-services-criteria-best-practices)
- [DBE Federal Rule Oct 2025 — BidFinds](https://bidfinds.com/blog/small-business-dbe-mbe-certification-guide)
