# Architecture: Bidirectional ERP Integration — v9.0 Milestone

**Project:** HCC Prevailing Wage — ERP Integrations (Phases 126–134)
**Researched:** 2026-05-11
**Confidence:** HIGH (codebase inspection + verified Procore docs + confirmed existing patterns)

---

## What Already Exists (Do Not Rebuild)

Before designing new components, these are confirmed already-shipped building blocks that v9.0 must extend, not replace:

| Component | File | What It Does |
|-----------|------|-------------|
| OAuth2 connect+callback+refresh | `routes/integrations.ts` (lines 609–727) | Procore OAuth2 Authorization Code flow — full working implementation with state param, token exchange, `/me` company fetch, encrypted save |
| Procore token CRUD | `services/procoreService.ts` | `saveProcoreTokens`, `getValidProcoreToken` (with auto-refresh), `deleteProcoreTokens`, `getProcoreConnection` |
| AES-256-GCM credential encryption | `services/cryptoService.ts` | `encryptSsn`/`decryptSsn` — versioned JSON envelope, reusable for any secret |
| `procore_tokens` DB table | `migrations/0056_procore_connections.sql` | `user_id`, `company_id`, `access_token_encrypted`, `refresh_token_encrypted`, both expiry timestamps |
| QBO token table + pattern | `migrations/0041_qbo_tokens.sql` | Identical shape to Procore tokens — field mapping pattern for Sage/Viewpoint |
| In-process cron scheduler | `index.ts` (lines 267–350) | `node-cron` already imported and running 5 scheduled jobs. Confirmed pattern: wrap in try/catch, never rethrow |
| Timesheet pull + worker upsert | `routes/integrations.ts` (GET `/procore/timesheet-entries`, POST `/procore/import`) | Procore timesheet fetch + group-by-worker-day + `upsertPayrollEntry` call |
| Worker dedup by name | `routes/integrations.ts` (lines 251–281) | Case-insensitive name match before `createWorker` — same pattern for Sage/Viewpoint |
| `insertSecurityEvent` audit trail | `db/auditHelpers.ts` | Called on every connect/disconnect — must be called for Sage/Viewpoint too |
| `assertProjectAccess` | `utils/assertProjectAccess.ts` | Called before any write — cross-tenant IDOR protection |
| `upsertPayrollEntry` | `services/payrollService.ts` | Idempotent write for payroll entries — safe to call from scheduler |

---

## What Is Missing (Phases 126–134 Must Build)

### New DB Tables Required

```
integration_connections     — Multi-ERP credential vault (replaces per-ERP token tables for new providers)
integration_field_mappings  — JSON field map per (userId, provider)
integration_sync_runs       — Sync history/log with status, counts, error detail
```

See schema definitions in the DB Schema section below.

### New Server Components

```
src/server/services/integrationVault.ts      — Unified encrypt/decrypt for multi-ERP credentials
src/server/services/erpAdapter.ts            — IErpAdapter interface (shared across all 3 ERPs)
src/server/services/procoreAdapter.ts        — Procore implementation of IErpAdapter
src/server/services/sageAdapter.ts           — Sage 300 implementation (REST + file modes)
src/server/services/viewpointAdapter.ts      — Viewpoint Vista implementation (REST + file modes)
src/server/services/syncOrchestrator.ts      — Runs pull/push cycle for one connection
src/server/jobs/erpSync.ts                   — Cron-scheduled nightly sync job
src/server/routes/integrationsV2.ts          — New routes for Sage/Viewpoint + sync triggers
```

### New Client Components

```
src/client/pages/IntegrationsPage.tsx        — Connection management hub (Phase 126)
src/client/pages/IntegrationDashboard.tsx    — Sync history + field mapping UI (Phase 134)
src/client/components/ConnectionCard.tsx     — Per-ERP status/connect/disconnect card
src/client/components/FieldMappingEditor.tsx — JSON field map builder
src/client/components/SyncHistoryTable.tsx   — Paginated sync run log
```

---

## OAuth2 Authorization Code Flow — Confirmed Pattern

The Procore OAuth2 callback implementation in `routes/integrations.ts` is already production-grade. It is the canonical pattern for Sage 300 cloud and Viewpoint REST adapters. Do not introduce PKCE for server-side flows — PKCE is for public clients (SPAs, mobile apps). This is a confidential client (Express with client secret). The existing pattern is correct per RFC 6749 and the Procore documentation.

**Flow steps (existing code, confirmed working):**

```
1. GET /api/integrations/{provider}/connect
   - requireAuth middleware gates this — userId is available
   - Generate state = base64url(JSON.stringify({ userId, nonce: crypto.randomBytes(16).toString('hex') }))
     NOTE: Upgrade nonce from Math.random() to crypto.randomBytes(16) — Math.random() is not CSPRNG
   - Build authUrl with client_id, response_type=code, redirect_uri, state
   - res.redirect(authUrl)

2. Provider redirects to GET /api/integrations/{provider}/callback?code=&state=
   - No requireAuth — this is the OAuth redirect (no cookie context)
   - Decode state → validate userId exists and is a real user (currently not validated — add DB check)
   - POST to provider token endpoint with code + redirect_uri (Basic auth with clientId:clientSecret)
   - GET /me or equivalent to resolve company/tenant ID
   - integrationVault.save(userId, provider, { accessToken, refreshToken, companyId, expiresAt })
   - insertSecurityEvent({ userId, eventType: 'connect_{provider}' })
   - res.redirect('/settings/integrations?{provider}=connected')

3. Token refresh (inline, on demand)
   - getValidToken(userId, provider) checks expiry with 5-min buffer
   - If expired: POST refresh_token grant → save updated tokens → return new access token
   - Called at start of every adapter method — caller never sees expired token
```

**State Parameter Security Gap (existing code):** The current QBO and Procore connect handlers use `Math.random().toString(36)` as the nonce. Phase 126 must upgrade to `crypto.randomBytes(16).toString('hex')` when building the new integration vault. The decoded userId is not verified against the DB before use — add a `users` table lookup in the callback before saving tokens.

---

## Adapter Interface — IErpAdapter

The adapter interface is the critical shared boundary. All three ERP adapters implement it. The `syncOrchestrator.ts` calls only interface methods — it never calls Procore/Sage/Viewpoint APIs directly.

```typescript
// src/server/services/erpAdapter.ts

export interface ErpWorker {
  externalId: string;         // ERP's native ID
  name: string;               // "Last, First" or "First Last"
  tradeClassification?: string; // ERP cost code or craft code
  email?: string;
  ssnLast4?: string;
  address?: { street?: string; city?: string; state?: string; zip?: string };
}

export interface ErpTimeEntry {
  externalId: string;         // ERP timesheet entry ID
  workerId: string;           // maps to ErpWorker.externalId
  projectExternalId: string;  // ERP project/job ID
  date: string;               // YYYY-MM-DD
  regularHours: number;
  overtimeHours: number;
  doubleTimeHours: number;
  costCode?: string;
}

export interface ErpProject {
  externalId: string;
  name: string;
  jobNumber?: string;
}

export interface CompliancePushPayload {
  projectExternalId: string;
  weekEndingDate: string;
  status: 'compliant' | 'violation' | 'pending';
  violations: Array<{ workerId: string; type: string; detail: string }>;
  wh347Url?: string;          // signed URL or attachment reference
}

export interface SyncResult {
  workersUpserted: number;
  timesheetEntriesImported: number;
  compliancePushed: number;
  errors: Array<{ externalId?: string; message: string }>;
  ranAt: string;              // ISO timestamp
}

export interface IErpAdapter {
  readonly provider: 'procore' | 'sage300' | 'viewpoint';

  // Pull operations
  listProjects(): Promise<ErpProject[]>;
  listWorkers(projectExternalId: string): Promise<ErpWorker[]>;
  listTimeEntries(projectExternalId: string, weekEndingDate: string): Promise<ErpTimeEntry[]>;

  // Push operations
  pushComplianceStatus(payload: CompliancePushPayload): Promise<void>;

  // Health check — returns true if credentials are valid and API is reachable
  healthCheck(): Promise<boolean>;
}
```

**Why this shape:** The pull/push split mirrors the data flow: ERP is authoritative on workers and time, this app is authoritative on compliance status. The adapter owns all credential retrieval internally — the orchestrator receives a userId and provider, calls `getAdapter(userId, provider)`, and gets back a ready-to-use IErpAdapter with tokens already resolved.

---

## Adapter Implementations — Cloud REST vs On-Premise File

### Procore Adapter (REST-only, cloud)

Procore is cloud-only. All calls go to `https://api.procore.com/rest/v1.0/`. The existing code in `routes/integrations.ts` lines 732–868 is essentially the prototype of this adapter. The adapter wraps those patterns into the `IErpAdapter` interface.

**Key Procore endpoints:**
- `GET /rest/v1.0/companies/{company_id}/projects` — `listProjects()`
- `GET /rest/v1.0/projects/{project_id}/workers` or `/manpower_logs` — `listWorkers()`
- `GET /rest/v1.0/projects/{project_id}/timesheet_entries?filters[start_datetime]=...` — `listTimeEntries()`
- `PATCH /rest/v1.0/projects/{project_id}/custom_fields/{field_id}` — `pushComplianceStatus()`

**Required header:** `Procore-Company-Id: {companyId}` on every request — already present in existing route code.

**Classification authority rule:** Procore is authoritative on `tradeClassification` (cost code). When a worker exists in both systems and Procore has a cost code, the adapter must emit that cost code in `ErpWorker.tradeClassification`. The sync orchestrator must not override a Procore-sourced classification with a blank value.

### Sage 300 CRE Adapter (REST + file modes)

Sage 300 CRE supports both cloud REST (Sage 300 Web API / OData endpoint) and on-premise file-based integration (CSV export from Sage 300 drop directories).

**Mode detection:** The `integration_connections` table stores a `mode` column: `'rest' | 'file'`. The adapter constructor reads this and selects the transport.

**REST mode** (Sage 300 cloud, Sage Intacct Construction):
- Base URL: customer-specific (stored in connection metadata)
- Auth: OAuth2 (same pattern as Procore) or Basic HTTP depending on Sage 300 version
- Endpoints: `/HR/Employees`, `/PR/Timecards`, `/JC/Jobs`

**File mode** (on-premise Sage 300 CRE):
- Sage 300 writes CSV exports to a shared pickup directory
- The adapter reads from a configured SFTP path or a local directory mounted via Render persistent disk
- Format: Sage 300 Aatrix-style employee/timecard CSV
- The existing `sage300Mapper.ts` service already parses Sage 300 CSV rows — the file-mode adapter wraps that mapper
- File mode cannot push compliance status back (read-only) — `pushComplianceStatus()` returns a structured stub response with `mode: 'file'` noting that manual entry is required

**Implementation note:** `sage300Mapper.ts` already exists and handles the CSV parsing. The file-mode adapter is a thin wrapper: read CSV from SFTP/path, call mapper, return `ErpWorker[]` and `ErpTimeEntry[]`.

### Viewpoint Vista Adapter (REST + file modes)

Viewpoint Vista (Trimble) has two distinct API tiers:
1. **AppXchange REST API** — cloud-hosted Vista customers only. Bidirectional. Requires purchase of the Vista API module from Trimble marketplace. Authentication is OAuth2 via AppXchange.
2. **Legacy Viewpoint API** — "a small, defined data set" of workflow items, no longer actively developed. Not suitable for employee/timesheet data.
3. **File-based (CSV/XML export)** — universal fallback, works for both on-premise and cloud.

**Implementation strategy:** Default to file mode for Phase 132 (broad compatibility). REST mode is optional and gated by a `mode: 'rest'` flag in the connection. Do not assume AppXchange API access — most mid-market Vista customers will use file-based exports initially.

**File mode data:** Vista exports are tab-delimited or CSV. Common formats: PR Timecard Export, Employee Master Export. These do not have a pre-existing mapper in the codebase — `viewpointAdapter.ts` must implement its own parser alongside the adapter.

---

## In-Process Scheduler — node-cron (Confirmed Existing Pattern)

`node-cron` is already installed and running 5 jobs in `index.ts`. Adding ERP sync follows the exact same pattern.

**Existing pattern (canonical — copy exactly):**
```typescript
cron.schedule('0 2 * * *', async () => {
  logger.info('erp-sync: starting nightly sync');
  try {
    await runNightlyErpSync();
  } catch (err) {
    logger.error({ err }, 'erp-sync: failed');
    // Never rethrow — cron failures must not crash Express
  }
}, { timezone: 'UTC' });
```

**When to add:** In `index.ts` inside the `app.listen()` callback, after the existing cron registrations.

**Nightly sync job design (`jobs/erpSync.ts`):**
```typescript
export async function runNightlyErpSync(): Promise<void> {
  const db = getDb();
  // Query all active integration_connections
  const connections = await db.select().from(integrationConnections)
    .where(eq(integrationConnections.status, 'active'));

  // Process sequentially — SQLite single-writer constraint means parallel writes
  // would produce SQLITE_BUSY errors. Sequential processing is the correct pattern.
  for (const conn of connections) {
    try {
      const result = await syncOrchestrator.run(conn.userId, conn.provider);
      await db.insert(integrationSyncRuns).values({
        id: randomUUID(),
        connectionId: conn.id,
        ranAt: new Date().toISOString(),
        status: 'success',
        workersUpserted: result.workersUpserted,
        timesheetEntriesImported: result.timesheetEntriesImported,
        compliancePushed: result.compliancePushed,
        errors: JSON.stringify(result.errors),
      });
    } catch (err) {
      logger.error({ err, connectionId: conn.id }, '[erp-sync] connection failed');
      await db.insert(integrationSyncRuns).values({
        id: randomUUID(),
        connectionId: conn.id,
        ranAt: new Date().toISOString(),
        status: 'error',
        errors: JSON.stringify([{ message: String(err) }]),
      });
      // Continue to next connection — never throw
    }
  }
}
```

**Manual trigger route:** `POST /api/integrations/{provider}/sync-now` calls `syncOrchestrator.run(userId, provider)` directly with `requireAuth`. Returns the `SyncResult` object. This is Phase 126's "Test connection" capability and Phase 134's dashboard trigger.

---

## SQLite Single-Writer Constraint

SQLite in WAL mode allows concurrent readers but serializes all writers. The existing app already runs correctly under this constraint because all write paths are single-process. The ERP sync adds write pressure but does not change the constraint.

**Rules for sync writes:**
1. The nightly sync job runs sequentially across connections (for loop, not Promise.all) — this is intentional, not a bug.
2. The sync orchestrator must not use `Promise.all` for payroll entry writes — use a sequential for loop.
3. `upsertPayrollEntry` in `payrollService.ts` is already safe to call from the scheduler — it does not check session/auth context.
4. All sync writes must go through Drizzle ORM's `db` instance from `getDb()` — never open a second SQLite connection.
5. If a sync run is long (many timesheets), there is no blocking concern for HTTP handlers because SQLite reads do not block during a write transaction, and writes are fast (sub-millisecond for individual rows).

**SQLITE_BUSY risk is LOW** for this use case: the sync runs at 02:00 UTC, concurrent user writes at that hour are near zero for a single-tenant tool. No retry loop needed for MVP.

---

## Field Mapping Config Store

Field mappings are stored as JSON documents in the `integration_field_mappings` table, one row per `(userId, provider)`. The JSON document maps ERP field paths to our internal field names.

**Schema of the JSON config doc:**
```json
{
  "worker": {
    "name": "$.EmployeeName",
    "ssnLast4": "$.SSN_Last4",
    "tradeClassification": "$.CostCode.Description",
    "email": "$.PrimaryEmail"
  },
  "timeEntry": {
    "regularHours": "$.RegularHours",
    "overtimeHours": "$.OvertimeHours",
    "date": "$.WorkDate"
  },
  "classificationOverrides": {
    "procore_authoritative": true
  }
}
```

**Storage:** Stored as `TEXT` in SQLite (JSON string). Read by the adapter at sync time. Default mappings are hardcoded in each adapter and used when no custom mapping exists for the user. The `FieldMappingEditor` UI in Phase 134 reads and writes this row.

**Do not build a general-purpose JSONPath engine.** The adapters know their ERP's schema. The field mapping config only controls which ERP field maps to which internal field for edge cases (e.g., a customer using a custom Procore cost code field instead of the standard one). The default mapping covers 90% of customers.

---

## DB Schema — New Tables

### `integration_connections`

Replaces the per-ERP token tables (`qbo_tokens`, `procore_tokens`) for Sage and Viewpoint. Procore and QBO keep their existing tables for backward compatibility.

```sql
CREATE TABLE integration_connections (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,         -- 'sage300' | 'viewpoint'
  mode TEXT NOT NULL DEFAULT 'rest', -- 'rest' | 'file'
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'disconnected' | 'error'
  credentials_encrypted TEXT NOT NULL,  -- AES-256-GCM envelope (JSON with access_token, refresh_token, api_key etc.)
  metadata TEXT,                  -- JSON: company_id, base_url, sftp_path, etc.
  connected_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_integration_connections_user ON integration_connections(user_id);
CREATE UNIQUE INDEX idx_integration_connections_user_provider
  ON integration_connections(user_id, provider);
```

### `integration_field_mappings`

```sql
CREATE TABLE integration_field_mappings (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,         -- 'procore' | 'sage300' | 'viewpoint'
  mapping_json TEXT NOT NULL,     -- JSON config doc as described above
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_field_mappings_user_provider
  ON integration_field_mappings(user_id, provider);
```

### `integration_sync_runs`

```sql
CREATE TABLE integration_sync_runs (
  id TEXT PRIMARY KEY NOT NULL,
  connection_id TEXT NOT NULL,    -- FK to integration_connections OR 'procore'/'qbo' (legacy)
  provider TEXT NOT NULL,         -- denormalized for query convenience
  ran_at TEXT NOT NULL,
  trigger TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled' | 'manual'
  status TEXT NOT NULL,           -- 'success' | 'error' | 'partial'
  workers_upserted INTEGER NOT NULL DEFAULT 0,
  timesheet_entries_imported INTEGER NOT NULL DEFAULT 0,
  compliance_pushed INTEGER NOT NULL DEFAULT 0,
  errors TEXT,                    -- JSON array of { externalId?, message }
  duration_ms INTEGER             -- wall-clock duration
);
CREATE INDEX idx_sync_runs_connection ON integration_sync_runs(connection_id);
CREATE INDEX idx_sync_runs_ran_at ON integration_sync_runs(ran_at DESC);
```

**Note on FK flexibility:** `connection_id` is not a hard FK because Procore sync runs reference `procore_tokens.userId` (different table). Store the userId or a synthetic key for Procore runs. A soft reference is preferable to a hard FK that would require migrating Procore to the new table.

---

## Integration Points with Existing Tables and Services

| Existing Component | How ERP Sync Touches It | Required Change |
|-------------------|------------------------|-----------------|
| `workers` table | `listWorkers()` result deduped by case-insensitive name match. `createWorker()` called for new workers. Same logic as QBO import (integrations.ts lines 230–281). | No schema change needed for MVP. Optional: add `erp_external_id TEXT` column per worker for reliable dedup |
| `payroll_entries` table | `listTimeEntries()` → `upsertPayrollEntry()`. Rate snapshots fetched from `wage_determinations`, never from ERP. | No schema change |
| `payroll_weeks` table | Time entries bucketed by week-ending date. Sync creates `payroll_weeks` row if none exists. Must check `submittedAt` — never write to submitted weeks. | No schema change |
| `projects` table | `listProjects()` pulls ERP projects for mapping UI. Matched by name. | Optional: add `erp_external_id TEXT` column via additive migration |
| `audit_log` table | Each sync run writes one audit event via `insertSecurityEvent`. Use `eventType: 'erp_sync_procore'` etc. | No schema change |
| `procore_tokens` table | Used by Procore adapter. Not replaced. `procoreService.getValidProcoreToken()` is called by procoreAdapter. | No change |
| `complianceService.ts` | `computeCompliance(projectId, weekId)` called by sync orchestrator to build `CompliancePushPayload`. Already returns `violations[]` and `weekViolations[]`. | No change |
| `payrollService.upsertPayrollEntry` | Called by sync orchestrator for timesheet import. Already idempotent. | No change |
| `workerService.createWorker` | Called by sync orchestrator for new worker import. Handles SSN encryption, audit trail. | No change |
| `classificationRates.getRate()` | Must be called by orchestrator to resolve `baseRateSnapshot` — ERP rates are never used. | Verify this function exists and is callable without HTTP context |

---

## Data Flow — Pull vs Push

### Pull (ERP → This App)

```
node-cron (02:00 UTC nightly)
  → erpSync.runNightlyErpSync()
    → for each active connection (sequential):
      → syncOrchestrator.run(userId, provider)
        → adapter.listProjects() → match to local projects table by name
        → for each matched project:
          → adapter.listWorkers(projectExternalId)
            → dedup by name against workers table
            → createWorker() for new workers (sets ssnLast4 if available)
          → adapter.listTimeEntries(projectExternalId, weekEndingDate)
            → resolve local workerId by name match
            → look up baseRateSnapshot from wage_determinations for project
            → upsertPayrollEntry() — idempotent, safe to call repeatedly
        → write integration_sync_runs row (status=success, counts)
```

**Rate snapshot policy:** The ERP never provides the prevailing wage rate. The sync orchestrator must call `classificationRates.getRate(projectId, classificationId)` to fetch the current rate from `wage_determinations`. This is the same rate resolution logic used in the payroll entry wizard.

### Push (This App → ERP)

```
POST /api/integrations/{provider}/sync-now (manual trigger)
OR node-cron (after pull phase completes for same connection)
  → syncOrchestrator.push(userId, provider, projectId, weekId)
    → complianceService.computeCompliance(projectId, weekId)
    → build CompliancePushPayload from violations[]
    → adapter.pushComplianceStatus(payload)
      → Procore: PATCH custom fields on project
      → Sage300 REST: PATCH compliance note field
      → Sage300 file: write compliance-report.csv to SFTP drop directory
      → Viewpoint REST: PATCH via AppXchange API
      → Viewpoint file: write compliance-export.csv
```

**Procore Classification Authority:** When pulling workers from Procore, the `tradeClassification` field from Procore's cost code is written to `workers.tradeClassification`. If the worker already exists in this app with a different classification, Procore wins. This is the "Procore authoritative on classification" rule. The field mapping config has `classificationOverrides.procore_authoritative: true` by default. Other ERPs do not override classification — they only set classification on new workers.

---

## Recommended Build Order (Phase Sequencing)

The adapter interface must exist before any ERP-specific phase. Procore's existing inline route code must be refactored into the adapter pattern before adding Sage/Viewpoint. This creates a hard dependency chain.

```
Phase 126 — Integration Foundation
  NEW: integration_connections table (migration 0070)
  NEW: integration_field_mappings table (migration 0070)
  NEW: integration_sync_runs table (migration 0070)
  NEW: IErpAdapter interface in erpAdapter.ts
  NEW: integrationVault.ts (wraps cryptoService for multi-provider credential storage)
  NEW: IntegrationsPage.tsx (connection management UI with per-ERP ConnectionCard)
  MODIFY: integrations.ts — add Sage/Viewpoint connect/callback/disconnect stubs
  DEPENDS ON: cryptoService.ts (existing), procoreService.ts (existing)

Phase 127 — Procore Project/Employee Sync
  NEW: procoreAdapter.ts (wraps existing procoreService + integrations.ts patterns into IErpAdapter)
  NEW: syncOrchestrator.ts (pull phase only, Procore)
  NEW: erpSync.ts (nightly cron job — exports runNightlyErpSync())
  MODIFY: index.ts — register nightly ERP sync cron at 02:00 UTC
  MODIFY: integrations.ts — add POST /procore/sync-now manual trigger
  DEPENDS ON: Phase 126 (IErpAdapter, integration_sync_runs table must exist)

Phase 128 — Procore Timesheet Pull
  MODIFY: procoreAdapter.ts — implement listTimeEntries()
    (prototype already in integrations.ts lines 732–789 — extract and formalize)
  MODIFY: syncOrchestrator.ts — add timesheet pull + upsertPayrollEntry sequential loop
  DEPENDS ON: Phase 127 (procoreAdapter skeleton)

Phase 129 — Procore Compliance Push
  MODIFY: procoreAdapter.ts — implement pushComplianceStatus() (Procore custom fields)
  MODIFY: syncOrchestrator.ts — add push phase after pull completes
  DEPENDS ON: Phase 127, Phase 128

Phase 130 — Sage 300 CRE Adapter Foundation
  NEW: sageAdapter.ts (implements IErpAdapter, REST + file modes)
  MODIFY: integrations.ts — complete Sage connect/callback/apikey routes
  DEPENDS ON: Phase 126 (IErpAdapter must exist)
  NOTE: sage300Mapper.ts already exists — file-mode adapter wraps it

Phase 131 — Sage 300 Payroll Sync + Compliance Push
  MODIFY: sageAdapter.ts — implement listTimeEntries(), pushComplianceStatus()
  MODIFY: syncOrchestrator.ts — register Sage provider
  DEPENDS ON: Phase 130

Phase 132 — Viewpoint Vista Foundation
  NEW: viewpointAdapter.ts (implements IErpAdapter, file-mode first)
  MODIFY: integrations.ts — complete Viewpoint connect/callback/apikey routes
  DEPENDS ON: Phase 126 (IErpAdapter)
  NOTE: No existing parser for Viewpoint CSV — adapter implements its own parser

Phase 133 — Viewpoint Timesheet + Compliance Push
  MODIFY: viewpointAdapter.ts — implement listTimeEntries(), pushComplianceStatus()
  MODIFY: syncOrchestrator.ts — register Viewpoint provider
  DEPENDS ON: Phase 132

Phase 134 — Integration Dashboard
  NEW: IntegrationDashboard.tsx
  NEW: SyncHistoryTable.tsx (reads integration_sync_runs)
  NEW: FieldMappingEditor.tsx (reads/writes integration_field_mappings)
  NEW: GET /api/integrations/sync-runs route
  NEW: PUT /api/integrations/{provider}/field-mapping route
  DEPENDS ON: All prior phases (needs data to display)
```

---

## New Routes to Add

```
GET  /api/integrations/sage300/connect            — initiate OAuth or show API key form
GET  /api/integrations/sage300/callback           — OAuth callback (REST mode)
POST /api/integrations/sage300/connect-apikey     — save API key (file/basic auth mode)
DELETE /api/integrations/sage300                  — disconnect
GET  /api/integrations/sage300/status             — connection status

GET  /api/integrations/viewpoint/connect          — same pattern
GET  /api/integrations/viewpoint/callback
POST /api/integrations/viewpoint/connect-apikey
DELETE /api/integrations/viewpoint
GET  /api/integrations/viewpoint/status

POST /api/integrations/procore/sync-now           — manual trigger (returns SyncResult)
POST /api/integrations/sage300/sync-now
POST /api/integrations/viewpoint/sync-now

GET  /api/integrations/sync-runs                  — paginated history (Phase 134)
PUT  /api/integrations/:provider/field-mapping    — save mapping JSON (Phase 134)
GET  /api/integrations/:provider/field-mapping    — read mapping JSON (Phase 134)
```

---

## Helmet CSP Impact

The existing Helmet config in `index.ts` (lines 93–113) has `connectSrc: ["'self'"]`. Procore/Sage/Viewpoint API calls are made server-side — they originate from the Express process, not the browser. No CSP change needed for REST adapter calls. OAuth redirects are full-page navigations (`res.redirect()`), not XHR, so `connectSrc` is also not relevant.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Per-ERP credential tables for Sage and Viewpoint
**What:** Creating a `sage_tokens` table and a `viewpoint_tokens` table (as was done for QBO and Procore).
**Why bad:** The existing `qbo_tokens` and `procore_tokens` tables are a debt pattern. Adding two more creates four disconnected credential stores with no unified management UI or revocation path.
**Instead:** Use `integration_connections` for Sage and Viewpoint. Leave `qbo_tokens` and `procore_tokens` as-is for backward compatibility.

### Anti-Pattern 2: Inline API calls in route handlers for scheduled sync
**What:** Putting the nightly Procore/Sage fetch logic directly in an Express route handler.
**Why bad:** Route handlers can time out (Render's 30s HTTP timeout). Nightly sync may take minutes for large datasets.
**Instead:** The nightly cron job calls `runNightlyErpSync()` — no HTTP request involved. For manual "sync now," the route awaits `syncOrchestrator.run()` directly (< 30 seconds for typical datasets) and returns the `SyncResult` synchronously.

### Anti-Pattern 3: Parallel writes during sync
**What:** `await Promise.all(timeEntries.map(entry => upsertPayrollEntry(entry)))`
**Why bad:** SQLite serializes writes internally but issuing many concurrent write transactions causes SQLITE_BUSY errors.
**Instead:** Sequential for loop for all DB writes in sync paths.

### Anti-Pattern 4: Trusting ERP wage rates
**What:** Using the pay rate from a Procore/Sage timesheet entry as the `baseRateSnapshot`.
**Why bad:** ERP pay rates are what the contractor paid, which may differ from the prevailing wage. Compliance requires the Davis-Bacon rate, not the contractor's rate.
**Instead:** Always resolve `baseRateSnapshot` and `fringeRateSnapshot` from `wage_determinations` via `classificationRates.getRate()`. The ERP's rate is ignored.

### Anti-Pattern 5: PKCE for the server-side OAuth flow
**What:** Adding code_verifier/code_challenge to the Procore/Sage/Viewpoint authorization URL.
**Why bad:** PKCE protects public clients (browser SPAs, native apps) that cannot keep a client secret. This is a confidential client — the Express server holds the client secret. PKCE adds no security benefit here and Procore does not require it for server-side flows.
**Instead:** Use the existing state parameter pattern (upgraded to `crypto.randomBytes(16)` nonce). The client secret provides sufficient protection.

### Anti-Pattern 6: Writing to submitted payroll weeks
**What:** ERP sync upserts time entries into a week that has `submittedAt IS NOT NULL`.
**Why bad:** Federal requirement (29 CFR Part 3) prohibits modifying submitted certified payroll. Violates audit trail integrity.
**Instead:** Sync orchestrator must check `payrollWeeks.submittedAt` before writing entries. Log skipped entries in `SyncResult.errors` with a descriptive message.

---

## Confidence Assessment

| Area | Confidence | Source |
|------|------------|--------|
| Procore OAuth2 flow | HIGH | Existing working code in integrations.ts + Procore developer docs |
| Procore timesheet endpoints | HIGH | Existing code (lines 732–868) confirmed working |
| node-cron scheduling pattern | HIGH | Already running 5 jobs in index.ts — confirmed import and pattern |
| SQLite single-writer constraint | HIGH | Official SQLite WAL docs + existing sequential patterns in codebase |
| AES-256-GCM credential vault | HIGH | cryptoService.ts already in production for SSN + OAuth tokens |
| IErpAdapter interface design | MEDIUM | Derived from existing QBO/Procore patterns + standard adapter pattern |
| Sage 300 REST endpoints | MEDIUM | Sage developer portal docs + Greytrix integration guide |
| Sage 300 file-mode CSV format | MEDIUM | sage300Mapper.ts exists — confirms format is known and parseable |
| Viewpoint Vista REST (AppXchange) | LOW | API requires purchased module; exact endpoints not publicly documented |
| Viewpoint Vista file-mode format | LOW | No existing parser; Vista CSV exports are documented but not locally verified |

---

## Sources

- Procore OAuth2 Implementation: https://developers.procore.com/documentation/oauth-auth-grant-flow
- Procore Timesheet API: https://developers.procore.com/reference/rest/timesheets?version=latest
- Procore Custom Fields: https://developers.procore.com/reference/rest/custom-fields?version=latest
- Vista API Documentation: https://help.trimble.com/en/vista/vista/vista-api-documentation/vista-api-documentation-resources
- Vista API (AppXchange): https://marketplace.trimble.com/integrations/viewpoint-vista/api
- Vista Cloud/On-Premise FAQ: https://sites.google.com/trimble.com/vista-cloud-faq/home/integration-technology/vista-apis
- Sage 300 Integration Guide: https://satvasolutions.com/blog/sage-300-integration-guide
- Sage 300 Developer Portal: https://developer.sage.com/300
- node-cron: https://github.com/node-cron/node-cron
- SQLite WAL mode: https://sqlite.org/wal.html
- OAuth2 State Parameter: https://auth0.com/docs/secure/attack-protection/state-parameters
- Adapter Pattern in TypeScript: https://refactoring.guru/design-patterns/adapter/typescript/example
