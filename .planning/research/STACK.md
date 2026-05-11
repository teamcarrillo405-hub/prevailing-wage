# Stack Research — v9.0 Construction ERP Integrations

**Project:** HCC Prevailing Wage
**Milestone:** v9.0 — Procore, Sage 300 CRE, Viewpoint Vista bidirectional sync
**Researched:** 2026-05-11
**Confidence:** HIGH for Procore OAuth flow (official docs confirmed); MEDIUM for Sage 300 CRE (no public REST API — confirmed from community + official sources; file adapter only); MEDIUM for Vista AppXchange (REST API exists but gated by Trimble); HIGH for scheduler + credential vault patterns (multiple confirmed sources).

> This file covers NEW stack requirements for v9.0 only. Do not re-research what is already installed (Node.js/Express/TypeScript, React/Vite/TailwindCSS v4, SQLite/Drizzle, pdf-lib, node-cron, AES-256-GCM SSN encryption, pino, helmet, express-rate-limit).

---

## Executive Summary

| Feature Area | New Libraries Needed | Confidence |
|---|---|---|
| Procore OAuth2 PKCE | `openid-client ^6.8` (server-side PKCE code verifier/challenge) | HIGH |
| HTTP client for ERP API calls | `axios ^1.8` (already likely installed; verify) | HIGH |
| Credential vault storage | Drizzle schema + existing AES-256-GCM (no new lib) | HIGH |
| Background sync scheduler | `node-cron ^3.x` (already installed) | HIGH |
| Job queue persistence | Drizzle schema additions on existing SQLite (no new lib) | HIGH |
| Field mapping persistence | Drizzle JSON column (no new lib) | HIGH |
| Webhook/polling switch | Custom polling via `node-cron` (no new lib) | HIGH |
| Sage 300 CRE (cloud) | No public REST API — file adapter only (CSV/TXT import format) | HIGH |
| Sage 300 CRE (on-premise) | Watched directory pattern via `chokidar ^4` | MEDIUM |
| Vista API (cloud) | `axios` HTTP calls to Trimble AppXchange REST API | MEDIUM |
| Vista (on-premise fallback) | `chokidar ^4` watched directory + CSV parser | MEDIUM |
| Multipart CSV parsing | `csv-parse ^5.5` (confirm if not installed) | HIGH |

**Net new npm packages: 2** (`openid-client`, `chokidar`). Everything else is Drizzle schema work + custom logic on the existing stack. `csv-parse` may already be installed (check package.json before adding).

---

## Procore OAuth2 — Authorization Code + PKCE

### What the Procore API Actually Supports

**Official finding (HIGH confidence):** Procore uses standard OAuth 2.0 Authorization Code Grant flow for web server apps. Authorization endpoint is `https://login.procore.com/oauth/authorize`. Token endpoint is `https://login.procore.com/oauth/token`. Sandbox base: `https://login-sandbox-monthly.procore.com/oauth`.

**On PKCE:** Procore's official docs describe the server-side Authorization Code Grant using `client_id` + `client_secret`. The `client_secret` is the primary security mechanism for server-to-server apps. PKCE is documented in Procore's context for installed/desktop apps (where no secret can be safely stored), but a web server app already has a secret, making PKCE an additive defense layer rather than a requirement. The milestone spec calls for PKCE — implement it as defense-in-depth regardless.

**Token lifecycle:**
- Access tokens expire (exact duration not publicly documented — treat as short-lived, check expiry from token response `expires_in` field)
- Procore issues refresh tokens; use the token endpoint with `grant_type=refresh_token` to rotate
- Sandbox tokens are environment-specific — do not mix prod and sandbox credentials

**Key REST endpoints needed:**
- `GET /rest/v1.0/me` — current user ID and email (verify connection)
- `GET /rest/v1.0/companies/{company_id}/users` — employee directory (pull workers)
- `GET /rest/v1.0/projects/{project_id}/timesheets` — timesheet list
- `POST /rest/v1.0/projects/{project_id}/timesheets` — create/update timesheet
- Custom fields API for pushing WH-347 compliance status

### Recommendation: `openid-client ^6.8` for PKCE Helpers

**Why `openid-client` and not a hand-rolled PKCE implementation:**
PKCE requires generating a cryptographically random `code_verifier` (43–128 characters, base64url-encoded), deriving a `code_challenge` via SHA-256, and threading both values through the OAuth redirect and callback. `openid-client` v6 exposes `randomPKCECodeVerifier()` and `calculatePKCECodeChallenge()` as standalone utilities — you get correct PKCE primitives without pulling in the entire OIDC client flow.

```typescript
import { randomPKCECodeVerifier, calculatePKCECodeChallenge, buildAuthorizationUrl } from 'openid-client';

// In the connect route handler:
const codeVerifier = randomPKCECodeVerifier();
const codeChallenge = await calculatePKCECodeChallenge(codeVerifier);

// Store codeVerifier in server session (not client-side) keyed by state parameter
req.session.procoreOAuth = { codeVerifier, state: randomState };

const authUrl = `https://login.procore.com/oauth/authorize?` +
  `client_id=${CLIENT_ID}` +
  `&response_type=code` +
  `&redirect_uri=${REDIRECT_URI}` +
  `&code_challenge=${codeChallenge}` +
  `&code_challenge_method=S256` +
  `&state=${randomState}`;
```

**Version note:** `openid-client` v6.8.4 is the latest as of May 2026 (published ~9 days ago). v6 is a complete ESM rewrite with TypeScript-native types. It requires Node.js >= 20.x for the WebCrypto and Fetch globals it depends on. This app is on Node.js 20+ (Render.com confirmed); compatible.

**CJS compatibility in v6:** openid-client v6 is ESM-only, but Node.js 20.19+ supports `require(esm)`. If the existing server code is CommonJS (`"type": "module"` not set in package.json), use dynamic `import()` to load openid-client, or use a top-level async initializer. This is a known friction point — address at implementation time.

**OAuth flow pattern (Express):**
```
GET /api/integrations/procore/connect
  → generate codeVerifier + codeChallenge + state
  → store { codeVerifier, state } in session
  → redirect to Procore authorize URL

GET /api/integrations/procore/callback?code=...&state=...
  → verify state matches session
  → POST /oauth/token with code + codeVerifier + client_secret
  → store access_token + refresh_token encrypted in integration_connections table
  → redirect to /integrations with success banner

GET /api/integrations/procore/sync/:projectId
  → check token expiry, refresh if needed
  → fetch timesheets + workers from Procore REST API
  → upsert into existing workers + payroll tables

DELETE /api/integrations/procore/disconnect
  → revoke token (Procore has a /revoke endpoint)
  → delete connection row
```

**Installation:**
```bash
npm install openid-client
```

**Confidence: HIGH** — PKCE primitives in openid-client v6 confirmed via official GitHub (panva/openid-client). Procore OAuth2 endpoints confirmed via procore.github.io/documentation/oauth-auth-grant-flow. Version 6.8.4 confirmed current as of May 2026.

---

## Credential Vault Storage

### Recommendation: Drizzle Schema + Existing AES-256-GCM (No New Library)

The existing SSN encryption pattern (AES-256-GCM versioned envelope, established v3.0 Phase 31) is the correct approach for OAuth tokens and API keys. Tokens are credentials — treat them identically.

**New table: `integration_connections`**

```sql
CREATE TABLE integration_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL REFERENCES teams(id),
  provider TEXT NOT NULL,              -- 'procore' | 'sage300cre' | 'vista'
  connection_type TEXT NOT NULL,       -- 'oauth' | 'api_key' | 'file'
  -- Encrypted fields (AES-256-GCM versioned envelope, same as ssnEncrypted)
  access_token_encrypted TEXT,         -- OAuth access token
  refresh_token_encrypted TEXT,        -- OAuth refresh token
  api_key_encrypted TEXT,              -- For API key auth (Sage, Vista)
  -- Non-sensitive metadata
  token_expires_at INTEGER,            -- Unix timestamp ms
  external_company_id TEXT,            -- e.g., Procore company_id
  external_account_id TEXT,            -- e.g., Vista account identifier
  status TEXT DEFAULT 'active',        -- 'active' | 'expired' | 'error' | 'disconnected'
  last_sync_at INTEGER,
  last_error TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(team_id, provider)
);
```

**Token refresh pattern (inline on every API call, no background refresher):**
```typescript
async function getValidToken(connectionId: number): Promise<string> {
  const conn = await db.select().from(integrationConnections)
    .where(eq(integrationConnections.id, connectionId)).get();
  
  const expiresAt = conn.tokenExpiresAt;
  const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000;
  
  if (expiresAt && expiresAt < fiveMinutesFromNow) {
    // Inline refresh — do not background this; you need the new token right now
    const refreshed = await refreshProcoreToken(decrypt(conn.refreshTokenEncrypted));
    await db.update(integrationConnections)
      .set({
        accessTokenEncrypted: encrypt(refreshed.access_token),
        tokenExpiresAt: Date.now() + refreshed.expires_in * 1000,
        updatedAt: unixepoch(),
      })
      .where(eq(integrationConnections.id, connectionId));
    return refreshed.access_token;
  }
  
  return decrypt(conn.accessTokenEncrypted);
}
```

**Why not a secrets manager (HashiCorp Vault, AWS KMS):**
This is a single-instance Render.com SQLite app. Introducing an external secrets service adds a network dependency, cost, and operational complexity that is not justified at this scale. The existing AES-256-GCM + env-var key pattern is the correct approach. If the app moves to multi-tenant SaaS at scale, revisit.

**Confidence: HIGH** — Pattern mirrors existing SSN encryption established in v3.0. No new library needed. Schema is additive to existing Drizzle migrations.

---

## Background Sync Scheduler

### Recommendation: `node-cron` (Already Installed) + SQLite Job Queue Table

**node-cron is already in the stack** (confirmed via v6.0 research — used for WD sync and webhook delivery). No new scheduler package is needed.

**Job queue pattern (SQLite-backed, no Redis):**
Rather than polling Procore on a fixed cron (which doesn't track job state), maintain an `integration_sync_jobs` table. The cron wakes up every minute, claims unclaimed pending jobs, executes them, and records results.

```sql
CREATE TABLE integration_sync_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  connection_id INTEGER NOT NULL REFERENCES integration_connections(id),
  job_type TEXT NOT NULL,    -- 'pull_workers' | 'pull_timesheets' | 'push_compliance' | 'pull_projects'
  status TEXT DEFAULT 'pending',  -- 'pending' | 'running' | 'done' | 'failed'
  scheduled_for INTEGER NOT NULL,  -- Unix timestamp — when to run
  started_at INTEGER,
  completed_at INTEGER,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error TEXT,
  result_summary TEXT,       -- JSON: { pulled: 12, skipped: 2, errors: 0 }
  created_at INTEGER DEFAULT (unixepoch())
);
```

**Cron wiring (existing node-cron, no new package):**
```typescript
// In server startup — add to existing cron initialization
cron.schedule('* * * * *', async () => {
  // Claim up to 5 pending jobs due now
  const jobs = await db.select().from(integrationSyncJobs)
    .where(
      and(
        eq(integrationSyncJobs.status, 'pending'),
        lte(integrationSyncJobs.scheduledFor, Math.floor(Date.now() / 1000))
      )
    )
    .limit(5)
    .all();

  for (const job of jobs) {
    // Mark as running (optimistic lock — SQLite single-writer, safe)
    await db.update(integrationSyncJobs)
      .set({ status: 'running', startedAt: Math.floor(Date.now() / 1000) })
      .where(eq(integrationSyncJobs.id, job.id));
    
    try {
      const summary = await runJob(job);
      await db.update(integrationSyncJobs)
        .set({ status: 'done', completedAt: Math.floor(Date.now() / 1000), resultSummary: JSON.stringify(summary) })
        .where(eq(integrationSyncJobs.id, job.id));
    } catch (err) {
      const nextAttempt = job.attempts + 1 >= job.maxAttempts ? null : 
        Math.floor(Date.now() / 1000) + Math.pow(2, job.attempts) * 60;
      await db.update(integrationSyncJobs)
        .set({
          status: job.attempts + 1 >= job.maxAttempts ? 'failed' : 'pending',
          attempts: job.attempts + 1,
          scheduledFor: nextAttempt ?? job.scheduledFor,
          error: String(err),
        })
        .where(eq(integrationSyncJobs.id, job.id));
    }
  }
});
```

**Why SQLite advisory locks are not needed here:**
SQLite is single-writer by design. On Render.com (single instance), there will never be two cron processes competing for the same job row. The `status: 'running'` update serves as an in-process lock. If the app ever scales to multiple instances, graduate to a proper queue (pg-boss for Postgres, or BullMQ for Redis) — for now, SQLite single-writer is the correct constraint.

**Nightly sync scheduling pattern:**
Register nightly jobs on startup and after each successful sync:
```typescript
// Schedule a nightly pull for each active connection
await db.insert(integrationSyncJobs).values({
  connectionId: conn.id,
  jobType: 'pull_timesheets',
  scheduledFor: nextMidnightUtc(),
});
```

**Confidence: HIGH** — node-cron already installed. SQLite single-writer advisory lock pattern is correct for single-instance Render.com deployment. Pattern derived from v6.0 webhook queue research (same architecture).

---

## Field Mapping Persistence

### Recommendation: JSON Column on `integration_connections` (No New Library)

Field mapping (e.g., "Procore cost_code_id 1234 → HCC trade classification Carpenter") is configuration data that belongs to each connection. Store it as a JSON blob in the connection row — no separate table needed for v9.0.

```sql
ALTER TABLE integration_connections ADD COLUMN field_mappings TEXT;
-- Stores JSON: { "costCodes": { "1234": "carpenter" }, "projectIds": { "abc": 42 } }
```

**Drizzle schema type:**
```typescript
fieldMappings: text('field_mappings', { mode: 'json' })
  .$type<{
    costCodes?: Record<string, string>;  // externalId → HCC trade classification
    projectIds?: Record<number, number>; // externalProjectId → HCC projectId
    employeeIds?: Record<string, number>; // externalEmployeeId → HCC workerId
  }>(),
```

**Why not a separate `field_mapping_rules` table:**
A normalized table adds JOIN complexity for what is read-once-per-sync config. JSON blob in the connection row is correct for v9.0 volume. If field mapping becomes multi-user editable or versioned, normalize in a future milestone.

**Confidence: HIGH** — Drizzle supports `text('col', { mode: 'json' })` natively. No new library.

---

## Sage 300 CRE Integration

### Critical Finding: No Public REST API

**Confirmed (HIGH confidence):** Sage 300 CRE (Construction and Real Estate) does **not** have a public REST API. This was confirmed by:
1. Sage Community Hub post (communityhub.sage.com) — official community confirmation that CRE uses ODBC drivers, not a web API
2. Sage 300 standard ERP does have a Web API (SData/OData-based), but CRE is a distinct product line that uses the Pervasive database with ODBC-only external access

**What Sage 300 CRE does provide:**
- ODBC driver for direct database reads (requires on-premise installation, VPN access — not viable for a cloud app)
- CSV/TXT file-based import via the Payroll module `Tools > Import Time` menu
- SQL Replicator (replicates Pervasive DB to SQL Server — requires on-premise middleware)
- Procore has a documented Sage 300 CRE Payroll Export that produces a `.txt` file in a specific format accepted by Sage's import function

**Integration pattern: file-based adapter for both cloud and on-premise**

Cloud path (contractor downloads from app, imports manually):
1. Generate a Sage 300 CRE-compatible TXT/CSV file from HCC payroll data
2. User downloads it from the Integrations page
3. User imports via Sage 300 CRE `Tools > Import Time`
4. Push path (compliance data back to CRE): not feasible without ODBC/SQL access — document this limitation

On-premise path (for contractors with local Sage instance accessible via network share):
1. HCC app watches a network-accessible directory for export files from Sage (CSV exports from Crystal Reports)
2. Parse incoming files → upsert workers/timesheets
3. Write compliance export files to a watched output directory → Sage auto-import

**Sage 300 CRE payroll import file format (confirmed from Procore and Sage documentation):**
- Format: comma-delimited TXT (not CSV — must be `.txt` extension)
- Fields: `employee_id, date, hours, pay_type, job_number, cost_code, equipment_code`
- No extra blank spaces — CRE rejects files with extra spaces between commas
- Blank fields: `field1,,field3` (no space between commas)

**Recommendation: `chokidar ^4` for file watching (on-premise adapter)**

`chokidar` is the standard Node.js file watcher — the underlying library used by Webpack, Vite, and every major build tool. It handles cross-platform file watching with proper event debouncing.

```typescript
import chokidar from 'chokidar';

const watcher = chokidar.watch(watchDir, {
  persistent: true,
  ignoreInitial: false,
  awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 100 },
});

watcher.on('add', (filePath) => {
  if (filePath.endsWith('.txt') || filePath.endsWith('.csv')) {
    parseSageExportFile(filePath, connectionId);
  }
});
```

`awaitWriteFinish` prevents reading a file while Sage is still writing it — critical for large exports.

**Version:** `chokidar ^4.0.3` (confirmed current as of mid-2026; v4 dropped CommonJS in favor of pure ESM; verify your server module format compatibility — may need dynamic import or `"type": "module"` in package.json).

**Installation:**
```bash
npm install chokidar
```

**Cloud vs on-premise adapter pattern:**
```typescript
// integration_connections.connection_type determines which adapter runs
type SageAdapter = 'file_download' | 'watched_directory';

// 'file_download': generate export file, serve via GET /api/integrations/sage/export
// 'watched_directory': chokidar watches configured path, parses on file add
```

**Confidence: HIGH for the no-REST-API finding.** MEDIUM for file format details (Sage import format confirmed via Procore support docs and Sage KB, but exact field order should be validated against a test import before shipping). MEDIUM for chokidar v4 ESM compatibility (chokidar v4 is ESM-only — same issue as openid-client v6, needs dynamic import if server is CJS).

---

## Viewpoint Vista Integration

### What the Vista API Actually Provides

**Confirmed (MEDIUM confidence):** Viewpoint Vista (now Trimble) supports REST APIs via two paths:

**AppXchange (preferred, cloud-hosted Vista only):**
- Bidirectional REST API via `https://direct-api.xchange.trimble.com`
- 17 modules including HR, Payroll, Project Management
- Rate limit: 2,000 requests/minute
- Historical data limited to 12 months on most GET endpoints
- Authentication: API key or OAuth (details require Trimble developer registration)
- Must select which endpoints to enable during setup — not all endpoints are on by default

**Legacy Viewpoint API (on-premise only, deprecated):**
- Swagger: `https://integrations-qa.centralus.cloudapp.azure.com/swagger/index.html`
- No longer actively developed
- Still functional, but Trimble recommends AppXchange for new integrations

**On-premise fallback (no API access):**
- ODBC via VPN/TLS endpoint
- CSV and Excel file imports with automated scanning
- Same `chokidar` file-watcher pattern as Sage 300 CRE

**Critical limitation:** AppXchange requires registering as a Trimble developer and a contracting relationship to get API credentials. This is NOT a self-service API — there is a sales/onboarding step. Do not promise "one-click Vista connect" in the UI without confirming customer has AppXchange access.

**Integration pattern recommendation:**
- Phase 132 (Foundation): implement file-based adapter first (chokidar + CSV) — works for all Vista customers regardless of hosting
- Phase 133 (API): add AppXchange REST adapter behind a feature flag; expose only when customer provides AppXchange credentials
- The `integration_connections.connection_type` field distinguishes `'api'` vs `'file'`

**HTTP calls to AppXchange (using axios):**
```typescript
import axios from 'axios';

const vistaClient = axios.create({
  baseURL: 'https://direct-api.xchange.trimble.com',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  timeout: 30_000,
});

// Add response interceptor for 401 → auto-refresh
vistaClient.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      const newToken = await refreshVistaToken(connectionId);
      err.config.headers['Authorization'] = `Bearer ${newToken}`;
      return vistaClient.request(err.config);
    }
    throw err;
  }
);
```

**Confidence: MEDIUM** — AppXchange REST API existence confirmed via Trimble official FAQ. Specific endpoints for employees/timesheets not documented publicly — requires Trimble developer account to access full API reference. File-based adapter is HIGH confidence (standard pattern, no API gating).

---

## HTTP Client for ERP API Calls

### Recommendation: `axios ^1.8` (Likely Already Installed — Verify)

Check `package.json` — if `axios` is already installed (it often is in Express apps of this vintage), no new package is needed.

**Why axios over native fetch for ERP calls:**
- Axios interceptors handle token refresh transparently (attach once, all requests benefit)
- Automatic JSON serialization/deserialization
- Built-in timeout configuration (`timeout: 30_000` — ERP APIs can be slow)
- Error objects include `error.response.data` for ERP API error bodies (native fetch requires manual `.json()` on the error response)
- TypeScript types built-in

**Why not `got`:**
`got` v14 is ESM-only, excellent for pure-ESM projects, but adds ESM migration friction on a CJS server. Axios works in both module systems. Use axios.

**Axios client factory pattern (one instance per integration):**
```typescript
function createErpClient(baseURL: string, getToken: () => Promise<string>) {
  const client = axios.create({ baseURL, timeout: 30_000 });
  
  // Attach token before every request
  client.interceptors.request.use(async (config) => {
    config.headers['Authorization'] = `Bearer ${await getToken()}`;
    return config;
  });
  
  return client;
}

const procoreClient = createErpClient('https://api.procore.com', () => getValidToken(procoreConnectionId));
const vistaClient = createEprClient('https://direct-api.xchange.trimble.com', () => getValidToken(vistaConnectionId));
```

**Confidence: HIGH** — Axios is the dominant Node.js HTTP client, TypeScript-native, actively maintained. Pattern confirmed across multiple sources.

---

## CSV Parsing for File Adapters

### Recommendation: `csv-parse ^5.5` (Verify If Already Installed)

The existing payroll import stack (QuickBooks, ADP, Gusto, Paychex, Sage 300 CSV) uses a CSV parser. Check if `csv-parse` is already installed. If not, install it — it is the right choice for streaming large Sage/Vista export files.

**Why `csv-parse` over manual split:**
Large ERP exports (thousands of timecard rows) should be streamed, not buffered. `csv-parse` supports streaming mode, handles quoted fields, BOM stripping, and encoding conversion.

```typescript
import { parse } from 'csv-parse';
import { createReadStream } from 'fs';

async function parseSageExport(filePath: string) {
  const parser = createReadStream(filePath).pipe(
    parse({
      delimiter: ',',
      trim: true,
      skip_empty_lines: true,
      bom: true,
    })
  );
  
  for await (const row of parser) {
    await upsertTimecardRow(row);
  }
}
```

**Confidence: HIGH** — csv-parse is the most-used CSV library in the Node.js ecosystem; v5 is the current stable with streaming support.

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `bullmq` (Redis-backed queue) | Requires Redis — new infrastructure, new Render.com service, cost. Volume is tens to hundreds of syncs/day, not thousands. | SQLite `integration_sync_jobs` table + existing `node-cron` |
| `passport` + `passport-oauth2` | Adds framework abstraction for what is 3 Express routes and `openid-client` PKCE primitives. Passport couples authentication into middleware chains that complicate the stateless sync-job flow. | Custom Express routes + `openid-client` PKCE utilities |
| `@procore/js-sdk` | Procore's official JS SDK exists but is browser-targeted and wraps `fetch`. On a Node.js server, direct `axios` calls with proper typing are simpler and more debuggable. | `axios` + typed request/response interfaces |
| `node-sage-api` / community Sage libs | None have active maintenance or significant adoption. Sage 300 CRE has no REST API to wrap anyway. | Custom file adapter (generate/parse TXT) |
| `agenda` (MongoDB job queue) | Requires MongoDB — a different DB than the SQLite/Drizzle stack. Switching to MongoDB for job scheduling only is wrong. | SQLite job queue table |
| HashiCorp Vault / AWS KMS | External secret stores add network dependency, operational complexity, and cost. Not justified for single-instance Render.com app. | Existing AES-256-GCM with env-var key |
| `dotenv-vault` / `infisical` | Same rationale — external secret management is over-engineering for this deployment model. | Existing `.env` + Render.com environment variables |
| `p-queue` (concurrency limiter) | Useful for rate-limiting concurrent API calls, but Procore's 2,000 req/min and Vista's 2,000 req/min limits are generous for nightly sync volumes. Add only if rate-limit errors appear in production. | Implement simple delay (`await new Promise(r => setTimeout(r, 500))`) between batches if needed |
| Separate microservice for integrations | This is a monolith. A separate sync service adds deployment complexity, cross-service auth, and network calls for what is a background cron task in the same process. | Cron-driven job runner in the existing Express server |

---

## Integration Points with Existing Stack

| New Capability | Integrates With | Integration Pattern |
|---|---|---|
| Procore OAuth PKCE | Express auth routes | New `/api/integrations/procore/connect` + `/callback` routes; session for state/verifier |
| Token storage | Drizzle migrations | New `integration_connections` table; AES-256-GCM encrypt same as SSNs |
| Sync job queue | Drizzle migrations | New `integration_sync_jobs` table; existing `node-cron` polls every minute |
| Field mappings | `integration_connections.field_mappings` | JSON column — read at sync start, write from UI configuration |
| Worker upsert (pull) | Existing `workers` table | Match by `externalId` → update, or create new worker with `source: 'procore'` column |
| Timecard upsert (pull) | Existing `payrollEntries` table | Match by `(workerId, weekId, dayIndex)` — conflict detection same as existing CSV import |
| Compliance push (to Procore) | Existing compliance engine | Read computed violations → PATCH Procore custom fields |
| Sage file export | Existing payroll data | Generate TXT from `payrollEntries` in Sage import format |
| Sage file import (chokidar) | New `chokidar` watcher + existing DB | Watched dir → parse → upsert workers/timecards |
| Vista API calls | `axios` client factory | Per-connection axios instance with token interceptor |
| Audit trail | Existing `audit_log` table | Log all sync events (provider, type, rows affected, errors) |

---

## DB Schema Summary (New Tables/Columns for v9.0)

All via Drizzle add-only migrations:

```sql
-- New table: one row per ERP connection per team
CREATE TABLE integration_connections (
  id, team_id, provider, connection_type,
  access_token_encrypted, refresh_token_encrypted, api_key_encrypted,
  token_expires_at, external_company_id, external_account_id,
  field_mappings TEXT,   -- JSON: { costCodes, projectIds, employeeIds }
  status, last_sync_at, last_error, created_at, updated_at,
  UNIQUE(team_id, provider)
);

-- New table: persistent job queue (no Redis)
CREATE TABLE integration_sync_jobs (
  id, connection_id, job_type, status,
  scheduled_for, started_at, completed_at,
  attempts, max_attempts, error, result_summary, created_at
);

-- New column on workers (track ERP source)
ALTER TABLE workers ADD COLUMN external_source TEXT;          -- 'procore' | 'sage300cre' | 'vista' | null
ALTER TABLE workers ADD COLUMN external_id TEXT;              -- ERP-side employee ID
ALTER TABLE workers ADD COLUMN external_updated_at INTEGER;   -- last sync timestamp from ERP

-- New column on projects (track ERP project mapping)
ALTER TABLE projects ADD COLUMN external_source TEXT;
ALTER TABLE projects ADD COLUMN external_id TEXT;
```

---

## Installation Summary

```bash
# New packages
npm install openid-client          # v6.8.4 — PKCE primitives for Procore OAuth
npm install chokidar               # v4.x — file watcher for Sage/Vista on-premise adapter

# Verify these are already installed (check package.json before running)
npm install axios                  # HTTP client for ERP API calls
npm install csv-parse              # CSV/TXT parser for file adapters

# No new packages — already in stack:
# node-cron (job scheduler — existing)
# crypto (Node.js built-in — HMAC, AES-256-GCM)
# drizzle-orm (schema additions only)
# pino (audit logging for sync events)
```

---

## ESM Compatibility Warning

Both `openid-client ^6` and `chokidar ^4` are **ESM-only** packages. If the server currently runs as CommonJS (no `"type": "module"` in `package.json`), you must either:

1. **Use dynamic import()** for both packages at initialization time (simplest, no migration needed):
```typescript
// At server startup
const { randomPKCECodeVerifier, calculatePKCECodeChallenge } = await import('openid-client');
const { watch } = await import('chokidar');
```

2. **Migrate server to ESM** — change `"type": "module"` in package.json, update all `require()` to `import`, update `__dirname` references to `import.meta.dirname`. This is a larger change — worth considering for a future milestone if the ESM migration pays off elsewhere.

Check the existing codebase for `require()` calls before deciding. If the project already uses `"type": "module"`, both packages work directly with no workaround.

---

## Version Compatibility Table

| Package | Version | Purpose | Install Status |
|---------|---------|---------|---------------|
| `openid-client` | ^6.8.4 | PKCE code_verifier/challenge generation for Procore OAuth | NEW — server runtime |
| `chokidar` | ^4.0.3 | File watcher for Sage 300 CRE / Vista on-premise file adapter | NEW — server runtime |
| `axios` | ^1.8.x | HTTP client for Procore and Vista REST API calls | VERIFY — likely installed |
| `csv-parse` | ^5.5.x | Streaming CSV/TXT parser for file-based adapters | VERIFY — likely installed |
| `node-cron` | already installed | Sync job scheduler (poll `integration_sync_jobs` every minute) | ALREADY INSTALLED |
| `crypto` | Node.js built-in | AES-256-GCM token encryption; HMAC for webhook signing | BUILT-IN |
| `drizzle-orm` | already installed | Schema additions for integration_connections + sync_jobs | ALREADY INSTALLED |
| `pino` | already installed | Audit logging for sync events | ALREADY INSTALLED |

---

## Sources

- [Procore OAuth Authorization Code Grant Flow](https://procore.github.io/documentation/oauth-auth-grant-flow) — Authorization URL `login.procore.com/oauth/authorize`, token endpoint `login.procore.com/oauth/token`, standard code grant flow confirmed (HIGH confidence — official Procore developer docs)
- [Procore OAuth Endpoints](https://procore.github.io/documentation/oauth-endpoints) — environment-specific base URLs for sandbox vs production (HIGH confidence)
- [Procore REST API — Timesheets](https://developers.procore.com/reference/rest/timesheets) — `GET/POST /rest/v1.0/projects/{project_id}/timesheets` confirmed (HIGH confidence — official API reference)
- [Procore REST API — Users](https://www.stitchflow.com/user-management/procore/api) — `GET /rest/v1.0/companies/{company_id}/users` confirmed (MEDIUM confidence — third-party guide cross-referenced with Procore docs)
- [openid-client npm](https://www.npmjs.com/package/openid-client) — version 6.8.4 current as of May 2026; ESM-only; Node.js >= 20.x required; `randomPKCECodeVerifier()` and `calculatePKCECodeChallenge()` confirmed (HIGH confidence — official npm page)
- [panva/openid-client GitHub](https://github.com/panva/openid-client) — TypeScript-native, actively maintained, Web Crypto + Fetch globals required (HIGH confidence)
- [Sage 300 CRE Community Hub — API question](https://communityhub.sage.com/us/sage_construction_and_real_estate/f/sage-300-construction-and-real-estate/194254/sage-300-cre-integration-does-this-software-include-a-web-api) — confirmed no public REST API; ODBC + SQL Replicator are the only programmatic access methods (HIGH confidence — official Sage community)
- [Sage 300 CRE Payroll Import — Workyard docs](https://help.workyard.com/en/articles/7282899-how-to-set-up-download-payroll-file-for-sage-300-cre) — TXT format, comma-delimited, no extra spaces, blank fields as `,,` (MEDIUM confidence — third-party guide)
- [Procore — Set Up Payroll Export for Sage 300 CRE](https://support.procore.com/products/online/user-guide/company-level/timesheets/tutorials/set-up-your-payroll-export-for-use-with-sage-300-cre) — confirms file-based integration pattern between Procore and Sage 300 CRE (HIGH confidence — official Procore support)
- [Vista API — Trimble official FAQ](https://sites.google.com/trimble.com/vista-cloud-faq/home/integration-technology/vista-apis) — AppXchange REST API confirmed; 5 integration methods documented; legacy API no longer developed (HIGH confidence — official Trimble page)
- [Vista AppXchange API overview](https://direct-api.xchange.trimble.com/docs/vista-api-overview) — bidirectional REST, 17 modules, 2,000 req/min rate limit, 12-month historical data limit (MEDIUM confidence — official docs, but requires Trimble account for full reference)
- [chokidar npm](https://www.npmjs.com/package/chokidar) — v4.x current, ESM-only, standard file watcher used by Vite/Webpack (HIGH confidence)
- [node-cron npm](https://www.npmjs.com/package/node-cron) — v3 current, TypeScript support, no Redis required (HIGH confidence — already in stack)
- [SQLite job queue pattern](https://jasongorman.uk/writing/sqlite-background-job-system/) — SQLite-backed job queue without Redis confirmed as production-viable pattern (MEDIUM confidence — single source, but consistent with v6.0 webhook queue research)

---

*Stack research for: HCC Prevailing Wage v9.0 — Construction ERP Integrations*
*Researched: 2026-05-11*
