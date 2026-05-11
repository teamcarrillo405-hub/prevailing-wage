# Domain Pitfalls — v9.0 ERP Integrations

**Project:** HCC Prevailing Wage — v9.0 Construction ERP Integrations
**Researched:** 2026-05-11
**Stack context:** Node.js + Express + TypeScript, React + Vite + TailwindCSS v4, SQLite + Drizzle ORM
**Phases in scope:** 126 (Foundation), 127–129 (Procore), 130–131 (Sage 300), 132–133 (Vista), 134 (Dashboard)

This document covers pitfalls specific to adding bidirectional ERP sync to an existing compliance app. Generic integration advice is excluded; every entry below has direct consequences for this codebase.

---

## CRITICAL Pitfalls

Mistakes in this tier cause data corruption, compliance violations, or require full rewrites of the integration layer.

---

### CRITICAL-1: OAuth Token Expiry Goes Undetected Until a Nightly Sync Fails Silently

**What goes wrong:** Procore is reducing access token lifetime from 2 hours to 15 minutes to align with OAuth 2.0 security best practices (confirmed in Procore API documentation, 2025). When your nightly sync job starts, the access token acquired during the day-before OAuth flow is expired. The job issues a token refresh, gets a new access token, and continues — until the refresh token itself has expired (typically 30 days of inactivity) or has been administratively revoked (Procore admin resets credentials, user account deleted, app re-authorized). At that point, the refresh call returns `401 Unauthorized`. If there is no alerting on this path, the sync job silently exits with zero records processed. The contractor does not know for 3+ days.

**Why it happens:** Credential rot is invisible. The token is persisted in the credential vault table, appears valid, but the ERP has invalidated it server-side. There is no push notification from Procore when a refresh token is revoked.

**Consequences:** Timesheet records are not pulled for days. Compliance violations are not pushed to Procore. WH-347 compliance dashboard shows stale data. If the contractor submits a WH-347 based on incomplete pulled timesheets, the federal form contains errors.

**Prevention:**
- Store `access_token`, `refresh_token`, `token_expires_at`, `refresh_token_acquired_at` in the credential vault table.
- Before every sync run, proactively check `token_expires_at`. If expired or within 60 seconds of expiry, refresh first.
- Wrap the refresh call in its own try/catch. On `401` from the refresh endpoint, mark the integration `status = 'credential_expired'` in the DB and immediately write a `sync_events` row with `severity = 'error'`.
- Emit a UI toast / in-app banner on next dashboard load when any integration is in `credential_expired` state. Do not wait for the contractor to notice missing data.
- Re-auth flow must be reachable from the Integration Dashboard without re-entering all configuration.
- For Procore: store `refresh_token_acquired_at`. After 25 days, surface a proactive warning: "Procore credentials will expire in 5 days — re-authorize to prevent sync interruption."

**Detection warning signs:** Sync job logs show 0 records processed but exit code 0. `sync_events.duration_ms` is abnormally short. Last successful sync timestamp is more than 24 hours ago.

**Phase assignment:** Phase 126 (credential vault schema must support all these columns from day one), Phase 127 (implement token refresh logic for Procore).

---

### CRITICAL-2: SSN Data Written to ERP in Worker Sync Payload

**What goes wrong:** The Procore employee sync endpoint (`POST /rest/v1.0/workers`) accepts arbitrary metadata fields. When building the worker payload from this app's worker records, it is easy to accidentally include `ssnEncrypted` (even in its encrypted form) or derive and include `ssnLast4`. Even though the encrypted ciphertext is not a raw SSN, transmitting it outside the system boundary violates the data sovereignty rule and creates an audit trail in Procore's servers of a field that should never leave this app.

**Why it happens:** Payload construction often starts by spreading or serializing the worker row, then removing sensitive fields. Missing a field in the exclusion list is a single-line mistake. The code compiles and tests pass because the test fixtures use fake SSNs.

**Consequences:** SSN data (even partial or encrypted) now lives in Procore's cloud. This app's AES-256-GCM encryption is irrelevant once the data exits the system. GDPR, CCPA, and Davis-Bacon audit risk all increase. Contractors face liability if Procore suffers a breach.

**Prevention:**
- Build worker payloads for ERP sync using an **explicit inclusion list**, not an exclusion list. Enumerate exactly the fields to send: name, trade classification, union status, hire date. Never spread from the full worker record.
- Write a unit test that constructs every ERP payload type and asserts that neither `ssnEncrypted`, `ssnLast4`, nor any field matching `/ssn/i` appears anywhere in the serialized output.
- Add an integration-layer middleware that inspects all outbound request bodies for SSN patterns (`/\d{3}-\d{2}-\d{4}/`, `/\d{9}/`) before dispatching, throwing hard if found.
- Document in Phase 126 schema comments: "The `erp_workers` mapping table stores the ERP's external ID only. SSN columns from the workers table are never joined into sync payloads."

**Detection warning signs:** Any outbound HTTP log that contains a string of 9+ consecutive digits or matching SSN regex.

**Phase assignment:** Phase 126 (define outbound payload contracts with explicit inclusion lists), Phase 127 (worker sync — test suite must include SSN leakage assertions).

---

### CRITICAL-3: Duplicate Worker Creation on Re-Sync (Idempotency Failure)

**What goes wrong:** The nightly sync pulls workers from Procore and upserts them into the local `workers` table. On the first run, 45 workers are created. On the second run, the Procore API returns the same 45 workers. If the upsert key is wrong (e.g., matching on `name` alone instead of the stable Procore employee ID), 45 duplicate workers are created. Subsequent payroll entries are split across the original and duplicate records. WH-347 compliance computation counts hours incorrectly. The contractor sees duplicate worker cards.

**Why it happens:** Name-based matching is a common first-pass approach. It breaks immediately for workers who share a name, or when a name changes (marriage, data correction). The Procore employee object has a stable numeric `id` field that must be the join key.

**Consequences:** Payroll hours are orphaned on duplicate records. Compliance engine under-counts total hours worked. WH-347 includes some workers twice or omits hours.

**Prevention:**
- Add an `erp_external_id` column to the `workers` table in the Phase 126 migration. This is the foreign key into Procore's namespace.
- Upsert logic: `INSERT INTO workers (...) ON CONFLICT (erp_external_id, erp_source) DO UPDATE SET ...`. The conflict target is `(erp_external_id, erp_source)`, not name.
- Before creating a new worker row, always query `WHERE erp_external_id = ? AND erp_source = ?`. If found, update. Never insert without checking.
- Write a test: run the full worker sync twice with identical Procore response fixtures. Assert `workers` table count equals the number of unique Procore IDs, not 2x.
- For Sage 300 and Vista: use their equivalent stable employee number fields as the `erp_external_id`.

**Phase assignment:** Phase 126 (schema: add `erp_external_id`, `erp_source` columns with unique constraint), Phase 127 (Procore worker upsert), Phase 130 (Sage 300 worker upsert), Phase 132 (Vista worker upsert).

---

### CRITICAL-4: SQLite Write Lock During Nightly Sync Blocks User Payroll Entry

**What goes wrong:** A contractor is entering payroll data at 6:00 AM (early start on a job site). The nightly sync runs at 5:00 AM and is still processing a large timesheet batch. Both operations attempt write transactions on the same SQLite database. SQLite allows only one writer at a time. Without `WAL` mode and an adequate `busy_timeout`, the user's payroll write fails immediately with `SQLITE_BUSY`. With WAL mode but no `busy_timeout`, it still fails immediately. The contractor sees a 500 error mid-entry and loses unsaved data.

**Why it happens:** The app currently runs SQLite in default journal mode. Background sync jobs are added without considering that the DB already has concurrent read traffic from Express API routes. Once sync adds write traffic, the contention window widens significantly.

**Consequences:** Payroll entry fails with cryptic error. Data is lost if the form was not auto-saving. Contractor loses trust in the tool.

**Prevention:**
- Enable WAL mode at app startup: `PRAGMA journal_mode=WAL` applied once on DB open.
- Set `PRAGMA busy_timeout=5000` (5 seconds). In benchmarks, anything below 5 seconds shows occasional failures under concurrent write load.
- Use `BEGIN IMMEDIATE` for all write transactions in the sync job (not the default `BEGIN DEFERRED`). This acquires the write lock at transaction start, preventing mid-transaction upgrade failures.
- Keep sync batch transactions small: commit every 50–100 rows rather than wrapping the entire sync in one transaction. This releases the write lock more frequently.
- Schedule nightly sync at 2:00–3:00 AM when user activity is near zero. Make the schedule configurable from the Integration Dashboard.
- Add a circuit-breaker: if the sync job detects `SQLITE_BUSY` more than 3 times in a single batch, it pauses for 30 seconds and logs a warning before resuming.

**Detection warning signs:** Express API error logs show `SQLITE_BUSY` or `database is locked`. `sync_events` table shows abnormally short durations coinciding with user activity.

**Phase assignment:** Phase 126 (WAL mode + busy_timeout set in DB init), Phase 127 (first sync job — enforce BEGIN IMMEDIATE + small batches).

---

## HIGH Pitfalls

These mistakes produce incorrect behavior that may not be caught until contractor or auditor review.

---

### HIGH-1: Procore Custom Field Write Is Silently Rejected

**What goes wrong:** Phase 129 pushes WH-347 compliance status and violation data back to Procore custom fields. Procore's configurable fieldsets have validation rules. If a required field in the fieldset is missing from the payload, Procore returns a `422 Unprocessable Entity` with a validation error body. However, if `run_configurable_validations` is absent from the request body, Procore silently ignores custom field validation — meaning the write appears to succeed (200 OK) but the custom field data is rejected. Alternatively, if the custom field ID has changed (e.g., Procore admin rebuilt the fieldset), the write silently drops the value.

**Why it happens:** Procore's API documentation notes that `run_configurable_validations: true` must be present in the body when fieldsets have required fields. This is easy to miss in initial implementation. Custom field IDs are integers assigned at fieldset creation — they change if the Procore admin deletes and recreates the field.

**Consequences:** Compliance violations appear to be pushed to Procore successfully, but the Procore project shows no compliance data. Contractor's Procore team cannot see violations. The integration appears functional.

**Prevention:**
- Always include `run_configurable_validations: true` in every PATCH/POST to Procore resources that use custom fields.
- After writing custom fields, immediately re-fetch the resource and assert the custom field value matches what was written. Log a warning if it does not.
- Store Procore custom field IDs in the `erp_field_mappings` table (Phase 126 schema). Include a `last_verified_at` column. On each sync run, verify field IDs still resolve. If a 404 or empty value comes back from the field definition endpoint, mark the mapping as `stale` and halt the compliance push with an error in `sync_events`.

**Phase assignment:** Phase 126 (field mapping table schema), Phase 129 (compliance push — must include re-fetch verification).

---

### HIGH-2: Field Mapping Drift When ERP Upgrades Between Versions

**What goes wrong:** Sage 300 CRE releases an update. The `employee_id` field in their export format changes from a 6-digit numeric code to an 8-digit alphanumeric code. The file adapter's column index mapping breaks silently. The sync job still runs, reads the wrong column, and either fails to match workers or creates new duplicate records under the wrong ID.

The same happens with Procore API versioning: Procore releases a new API version (`v1.1`), the old endpoint still works but a field is renamed or a new required field added. Your adapter targeting `v1.0` continues to work until Procore sunsets the version.

**Why it happens:** Hard-coded column positions or field names in adapter code. No version contract tracking. The ERP vendor does not notify integration partners when schema changes.

**Consequences:** Worker matching breaks. Duplicate workers created. Sync appears to succeed (no crash) but data is wrong.

**Prevention:**
- For Sage 300 file-based: map by column header name, not column index. Parse the CSV header row and build a column-to-index map at runtime. If an expected column is missing, fail loudly and write a `sync_events` error rather than falling back to a positional guess.
- Store the expected ERP API version in the integration config (`erp_api_version` column). When a sync run detects a version mismatch via the API response headers, set integration status to `version_mismatch` and halt.
- Write integration adapter smoke tests that use real-shaped ERP fixtures (not simplified mocks). When an ERP vendor publishes a changelog, check these fixtures against the new format before the sync adapter breaks in production.

**Phase assignment:** Phase 130 (Sage 300 file adapter — column-name-based parsing), Phase 126 (store `erp_api_version` in integration config table).

---

### HIGH-3: Conflict Resolution — ERP Has Wrong Worker Classification

**What goes wrong:** Procore has a worker classified as "Laborer" but your app has them classified as "Carpenter" (the prevailing wage rate). During a sync pull, your adapter must decide which classification wins. If the ERP classification overwrites the compliance-app classification, the worker's `baseRateSnapshot` on future payroll entries is set to the Laborer rate, producing an under-wage violation on every subsequent week — but the violation flag is correct, the underlying data is now wrong.

**Why it happens:** Bidirectional sync without a defined source-of-truth policy defaults to "last write wins" or "ERP wins" because the ERP is the system initiating the sync. Neither is correct for a compliance app where classification has legal standing.

**Consequences:** WH-347 contains wrong wage rates. Contractor faces back-wage liability. DOL audit flags the entire project.

**Prevention:**
- Establish an explicit source-of-truth policy per field at Phase 126 design time:
  - **ERP is authoritative:** worker name, hire date, employee ID
  - **This app is authoritative:** trade classification, prevailing wage rates, compliance status
- Implement a `classification_source` column on `workers`: values `'erp'` | `'manual'` | `'compliance_app'`. Only overwrite classification from ERP pull if `classification_source = 'erp'`. If `classification_source = 'manual'` or `'compliance_app'`, log the conflict in `sync_events` as a warning and preserve the local value.
- Surface classification conflicts in the Integration Dashboard: "Procore shows this worker as Laborer, but your classification is Carpenter. [Keep local] [Accept ERP]"

**Phase assignment:** Phase 126 (conflict policy schema + `classification_source` column), Phase 127 (Procore worker pull — conflict detection), Phase 134 (conflict resolution UI in Integration Dashboard).

---

### HIGH-4: On-Premise Sage 300 File Adapter — File Path Injection and Stale File Detection

**What goes wrong:** The Sage 300 on-premise adapter reads export files from a contractor-configured directory path. If the path is user-controlled and not validated, a malicious or misconfigured path like `../../../../etc/passwd` or a Windows UNC path pointing to a network share outside the server can be accessed by the Node.js process. Separately, if the file watcher does not detect whether an export file is "new" (by comparing modification timestamp or a content hash), it will re-process the same file on every sync run, creating duplicate records.

**Why it happens:** File path input is treated as a string to concatenate into a `fs.readFile()` call. Stale file detection is skipped because "it works in testing" — the test uses a fresh file every time.

**Consequences:** Path injection: arbitrary file read from the server filesystem. Stale file: every sync produces duplicate workers and timesheet entries, triggering the idempotency failure described in CRITICAL-3.

**Prevention:**
- Validate the configured directory path against an allowlist of safe base directories (e.g., `process.env.ALLOWED_SYNC_BASE_DIRS`). Use `path.resolve()` and assert the resolved path still starts with an allowed prefix before any file I/O.
- Reject paths that contain `..`, null bytes, or UNC prefixes (`\\`).
- Track processed files in a `sync_file_log` table: `(integration_id, file_name, file_mtime, file_hash, processed_at)`. Before processing, check if `file_hash` already exists. Skip if it does. This makes the file adapter idempotent regardless of how many times the sync runs.
- Test: configure the adapter with a path containing `../` and assert it refuses to read the file, not that it reads it successfully.

**Phase assignment:** Phase 130 (Sage 300 on-premise file adapter implementation).

---

### HIGH-5: Procore Rate Limit Exhaustion Halts All Users on a Shared App Token

**What goes wrong:** Procore's default rate limit is 3,600 calls per hour. If this app uses a single OAuth app credential (one `client_id`/`client_secret`) shared across all contractor accounts (multi-tenant), one contractor with 200 workers and 5 active projects can exhaust the hourly limit during their sync, blocking all other tenants' syncs for the remainder of the hour. When the limit is exceeded, Procore returns `429 Too Many Requests` with an `X-Rate-Limit-Reset` timestamp.

**Why it happens:** Developers assume 3,600 requests/hour is "more than enough" for a single contractor. It is, but not for N contractors sharing one token. Multi-tenant rate limit pooling is rarely considered in MVP integration design.

**Consequences:** Other contractors cannot sync for up to 60 minutes. Sync jobs fail with 429 and, if not handled with backoff, they retry immediately and exhaust even more of the remaining limit.

**Prevention:**
- Each contractor who connects Procore must go through the OAuth flow with their own Procore account, resulting in per-tenant refresh tokens. The app token (client_id/secret) is shared, but Procore rate limits per company — each company has its own 3,600/hour bucket when using OAuth authorization code flow.
- Implement exponential backoff with jitter on 429 responses: `baseDelay * 2^attempt + random(0, 1000ms)`.
- Read `X-Rate-Limit-Reset` from the 429 response. Wait until that timestamp, not a fixed delay.
- Implement a sync queue: if a 429 is received, re-enqueue the remaining batch items with a delay derived from `X-Rate-Limit-Reset`. Do not retry in-process.
- Log all 429 events to `sync_events` with the reset timestamp. Surface in Integration Dashboard as "Rate limited — resuming at [time]."
- For large accounts, contact Procore to request elevated limits (up to 14,400/hour with spike limit at 100/10s).

**Phase assignment:** Phase 127 (Procore OAuth — per-tenant token model), Phase 128 (timesheet sync — exponential backoff + queue).

---

### HIGH-6: Viewpoint Vista Action Queue Latency Causes False "Success" on Writes

**What goes wrong:** The Vista API does not write synchronously. When you POST a compliance status update or worker record to Vista, the API immediately returns `202 Accepted` with a queue ID and `status: "queued"`. The actual write to the Vista database happens 30–40 seconds later, executed by the Xchange Agent service. If your sync job treats the `202` as a success and moves on, it has no confirmation that the write actually committed. If the Vista write fails (validation error, duplicate key, locked record), the failure is only discoverable by polling the queue ID — which most first-pass implementations skip.

**Why it happens:** `202 Accepted` feels like a success response. The polling step requires a second API call and a wait, which is inconvenient and easy to omit.

**Consequences:** Compliance push appears successful in your sync logs. Vista shows no updated data. The contractor's Vista team reports missing compliance flags 30 minutes after the sync completes.

**Prevention:**
- For every POST to Vista that returns `202 Accepted`, store the `queue_id` in a `vista_pending_actions` table with the original payload and a `due_after` timestamp (now + 40 seconds).
- Run a follow-up polling job that checks all pending actions past their `due_after` time, calls `GET /actions/{queue_id}`, and reads the final status.
- On confirmed success: mark `sync_events` row as `completed`. On failure: mark as `failed`, store the error from the action result, and surface in Integration Dashboard.
- Never report a Vista write as successful until the polling step confirms it.

**Phase assignment:** Phase 132 (Vista foundation — implement polling harness), Phase 133 (Vista compliance push — must use pending actions table).

---

### HIGH-7: Sync Failure Is Invisible to the Contractor for Days

**What goes wrong:** The nightly sync fails at 2:00 AM due to a network timeout. The `sync_events` table records the failure, but the contractor has no way to see it unless they actively navigate to the Integration Dashboard. Three days later, the GC asks why the WH-347 shows missing timesheet hours for the week. The answer is that three nightly syncs failed.

**Why it happens:** Sync is a background process. Background failures require proactive surfacing; developers assume the contractor will "check the dashboard." They do not check the dashboard unless something is obviously broken.

**Consequences:** Compliance data is stale for days without contractor awareness. WH-347 generated during the silent failure window may be incomplete.

**Prevention:**
- Write a `sync_health` summary per integration: `last_successful_at`, `consecutive_failure_count`, `last_error_message`.
- On the main Dashboard page, show a persistent banner when any integration has `consecutive_failure_count >= 2`. The banner should name which integration failed and show the last error.
- On the Integration Dashboard, prominently show the last sync timestamp with a warning badge if it is more than 26 hours old (nightly sync should have run within 24h).
- Send an email notification (using the existing nodemailer pipeline) after the second consecutive sync failure. Subject: "Procore sync failed — action may be required." Include the integration name, last successful sync time, and link to the dashboard.
- Phase 134 (Integration Dashboard) is not optional polish — it is the mechanism by which contractors detect silent failures. Treat it as a compliance-critical feature.

**Phase assignment:** Phase 126 (sync_health schema + Dashboard banner), Phase 134 (Integration Dashboard with failure visibility), any phase that adds a new sync job (must write to sync_events on every exit path).

---

## MODERATE Pitfalls

These are real problems but have cleaner recovery paths.

---

### MOD-1: OAuth PKCE Code Verifier Mismatch in Procore's Installed App Flow

**What goes wrong:** Procore supports PKCE for installed applications. If `code_verifier` is generated once and cached (e.g., stored in session), then the session expires between the redirect and the token exchange, the `code_verifier` is gone. The token exchange call succeeds in constructing the request but sends a blank or mismatched verifier, causing Procore to return `400 Bad Request: "The provided authorization grant is invalid."` This error message is identical to the one returned for other grant failures, making it hard to diagnose.

**Prevention:**
- Store `code_verifier` with the `state` parameter in the integration config row in the DB (not in session). Both `state` and `code_verifier` have a `created_at` timestamp. Expire them after 10 minutes.
- On OAuth callback, retrieve `code_verifier` by matching the `state` parameter from the DB row, not from session.
- Log the exact error body from Procore's token endpoint on any `400` or `401`. This is the only way to distinguish a PKCE failure from a credential rotation.

**Phase assignment:** Phase 127 (Procore OAuth implementation).

---

### MOD-2: Sage 300 On-Premise Connector Must Stay Running — Service Interruption Halts Sync

**What goes wrong:** The Sage 300 CRE on-premise connector (whether Agave-based or custom Windows service) must remain open and running to serve API requests. If the contractor's server reboots, the connector is not configured to auto-start, or the Sage 300 application is closed, API requests to Sage fail immediately. Unlike a cloud API, there is no redundancy.

**Prevention:**
- Document clearly in the Phase 130 setup guide that the connector service must be configured as a Windows Task Scheduler task or Windows Service set to auto-restart on failure.
- The sync job should test connectivity before attempting a full sync. If the test call fails, immediately write a `sync_events` error and trigger the sync failure visibility path from HIGH-7 rather than attempting 500 records against a dead connector.
- Surface connector health (last successful ping) in the Integration Dashboard per integration instance.

**Phase assignment:** Phase 130 (connector setup documentation and health check).

---

### MOD-3: Multi-Company Procore Accounts — Wrong `company_id` Scope

**What goes wrong:** Large GC firms manage multiple Procore companies under one Procore login. When the OAuth token is used to call `GET /rest/v1.0/companies`, it returns all companies the user can access. The first integration implementation often hardcodes using the first company in the list. If the user's primary company is index 1 but their active projects live in company index 0, all sync operations target the wrong company. Workers pulled are from the wrong company. Compliance pushes go to the wrong project.

**Prevention:**
- During the Procore OAuth connect flow, present the user with a dropdown of all companies returned by the `/companies` endpoint. Store the chosen `company_id` in the integration config. Never default to the first company.
- Assert `company_id` is present in the integration config before every sync run.

**Phase assignment:** Phase 127 (Procore OAuth connect flow — company selection step).

---

### MOD-4: Timesheet Pull Timezone Mismatch Doubles or Drops Hours

**What goes wrong:** Procore stores timesheet entries with ISO 8601 timestamps in UTC. This app stores payroll week start/end dates as plain date strings (no timezone). A worker in a Central time zone clocking out at 11:30 PM Monday CST appears in Procore as 5:30 AM Tuesday UTC. When grouping by week, the Tuesday UTC entry is counted in the wrong payroll week.

**Prevention:**
- At sync time, always convert Procore timestamps using the project's timezone (store `project_timezone` on the project or integration config).
- Test edge cases: clocking out at 11:00 PM local time on Sunday (the last day of the payroll week) must land in the current week, not the next.
- Use a library like `date-fns-tz` (already common in this stack) for all timezone conversions.

**Phase assignment:** Phase 128 (Procore timesheet pull — timezone handling required from day one, not deferred).

---

### MOD-5: Vista's 1-Hour Cache Lag Produces Stale Pull Data

**What goes wrong:** The Vista Data Xchange API serves data from a cache that is refreshed on a scheduled basis, typically every hour. If you trigger a timesheet sync immediately after a worker clocks out in Vista, the sync may miss the last hour of entries. Worse, if you then generate a WH-347 from the just-synced data, it is missing those hours. The worker's actual hours are correct in Vista but missing from your app.

**Prevention:**
- Sync jobs pulling from Vista should be scheduled with at least a 1-hour lag after the end of the work day (e.g., sync at 2:00 AM for work that ended at 5:00 PM). This ensures the cache has been refreshed at least once after the last timesheet entry.
- Document the 1-hour cache lag prominently in the Integration Dashboard tooltip for Vista connections. Contractors expecting real-time sync from Vista will be confused without this explanation.
- For the compliance push path (writing to Vista): always poll the action queue (see HIGH-6). The cache update after a write takes 30–40 seconds; reads immediately after write will return stale data.

**Phase assignment:** Phase 132 (Vista foundation), Phase 133 (Vista timesheet pull).

---

## MINOR Pitfalls

Real issues but limited in blast radius.

---

### MIN-1: Integration Config Stores Credentials in Plain Text

**What goes wrong:** During Phase 126, the `integrations` table stores `client_secret`, `access_token`, and `refresh_token` as plain text VARCHAR columns. If the SQLite file is ever accessed by someone with file-system access (developer debugging, backup restore, support request), all integration credentials are exposed.

**Prevention:**
- Encrypt `client_secret`, `access_token`, and `refresh_token` at rest using the same AES-256-GCM envelope already implemented for SSN storage (`ssnEncrypted` pattern). Reuse `encryptValue()` / `decryptValue()` utilities.
- Never log token values, even at DEBUG level. Log token length or first-4 chars only.

**Phase assignment:** Phase 126 (credential vault must use AES-256-GCM from day one).

---

### MIN-2: Sync Job Has No Timeout — Hangs Indefinitely on Network Issues

**What goes wrong:** A network partition causes the Procore API call to hang waiting for a response. The sync job has no request timeout set. The job never completes. The next nightly sync is blocked because the previous run is still "in progress."

**Prevention:**
- Set `AbortController` + `signal` with a 30-second timeout on every outbound HTTP request to ERP APIs.
- Set an overall sync job timeout: if a full sync run exceeds 20 minutes, abort it, write a `sync_events` error, and release any held DB transactions.
- Use a `sync_runs` table with a `started_at` and `completed_at` column. Before starting a new run, check for in-progress runs older than 30 minutes and mark them as `timed_out`.

**Phase assignment:** Phase 127 (first sync job must include timeouts — establish pattern for all subsequent phases).

---

### MIN-3: Compliance Push to Procore Triggers an Infinite Re-Sync Loop

**What goes wrong:** This app writes compliance status to a Procore custom field. Procore webhooks fire an event when that field changes. If this app is subscribed to Procore webhooks for employee/project changes, the compliance write triggers an inbound webhook, which triggers a data pull, which triggers another compliance evaluation, which triggers another write.

**Prevention:**
- Filter webhook events by `source_application_id`. When the Procore webhook payload's `source_application_id` matches your app's Procore client ID, skip the sync — this event was caused by your own write.
- Alternatively, use a write-lock flag: set `sync_in_progress = true` on the integration config row during a push, and skip any inbound webhook processing while the flag is set.

**Phase assignment:** Phase 129 (compliance push, if webhooks are used), Phase 134 (integration dashboard — document the loop risk).

---

### MIN-4: ERP Worker Count Exceeds Expectation — Sync Imports Entire Company Roster

**What goes wrong:** The Procore company has 800 employees across all projects. The worker sync pulls all 800 into this app, creating 800 worker records even though the current project only has 12 relevant workers. The workers table is now polluted with irrelevant workers. WH-347 worker selection becomes unwieldy.

**Prevention:**
- Scope the Procore worker pull to the specific project: `GET /rest/v1.0/projects/{project_id}/workers` rather than the company-level endpoint.
- Present a worker selection step in the Integration Dashboard after the first sync: "Procore returned 800 employees. Select which ones to import into project [X]." Bulk-select with search filter.

**Phase assignment:** Phase 127 (Procore worker sync — project-scoped endpoint from the start).

---

## Phase-Specific Warning Summary

| Phase | Topic | Primary Pitfall Risk | Mitigation |
|-------|-------|----------------------|------------|
| 126 | Integration Foundation | Credential vault stores plain text tokens | AES-256-GCM encryption from day one (reuse SSN pattern) |
| 126 | Integration Foundation | Schema misses columns needed later | Include: `erp_external_id`, `erp_source`, `erp_api_version`, `token_expires_at`, `refresh_token_acquired_at`, `consecutive_failure_count`, `last_successful_at` |
| 126 | Integration Foundation | SQLite write contention | Enable WAL mode + busy_timeout=5000 in DB init |
| 127 | Procore OAuth | PKCE verifier stored in session (expires) | Store `code_verifier` in DB with `state`, expire after 10 min |
| 127 | Procore Worker Sync | Duplicate workers on re-sync | `ON CONFLICT (erp_external_id, erp_source) DO UPDATE` |
| 127 | Procore OAuth | Shared app token rate-limited across tenants | Per-tenant OAuth flow; each contractor has own refresh token |
| 127 | Procore Multi-Company | Wrong company_id defaulted | Company selection UI in connect flow |
| 128 | Procore Timesheet Pull | Timezone mismatch assigns hours to wrong week | Convert using project timezone; test Sunday 11 PM edge case |
| 128 | Procore Rate Limits | 429 retried immediately, exhausts limit faster | Exponential backoff + read `X-Rate-Limit-Reset` |
| 129 | Procore Compliance Push | Custom field write silently rejected | Include `run_configurable_validations: true`; re-fetch to verify |
| 129 | Procore Webhooks | Compliance push triggers re-sync loop | Filter by `source_application_id` |
| 130 | Sage 300 File Adapter | File path injection | Allowlist validation + `path.resolve()` prefix check |
| 130 | Sage 300 File Adapter | Stale file re-processed | `sync_file_log` table with file hash deduplication |
| 130 | Sage 300 On-Premise | Connector not running, sync fails silently | Health check ping before sync; surface in Dashboard |
| 130 | Sage 300 Field Mapping | Column index breaks on Sage upgrade | Parse by column header name, not index |
| 131 | Sage 300 Payroll Sync | Worker classification overwritten from ERP | `classification_source` column; policy: this app is authoritative for classification |
| 132 | Vista Foundation | `202 Accepted` treated as success | Implement action queue polling via `vista_pending_actions` table |
| 132 | Vista Foundation | 1-hour cache lag misses recent entries | Schedule sync with lag; document in Dashboard |
| 133 | Vista Timesheet Pull | Cache stale after pull, write reads stale | Always poll action queue; document expected latency |
| 134 | Integration Dashboard | Silent failures invisible for days | `sync_health` summary; Dashboard banner; email on 2nd consecutive failure |

---

## Sources

- [Procore Rate Limiting Documentation](https://procore.github.io/documentation/rate-limiting) — HIGH confidence (official docs)
- [Procore OAuth Access Tokens](https://procore.github.io/documentation/oauth-access-tokens) — HIGH confidence (official docs)
- [Trimble Vista API Concepts](https://direct-api.xchange.trimble.com/docs/vista-api-concepts) — HIGH confidence (official Trimble docs)
- [Sage 300 CRE Agave Connector](https://docs.agaveapi.com/source-systems/sage-300-cre) — MEDIUM confidence (third-party integration partner docs, consistent with Sage official)
- [HingePoint ProConnector Throttle Limits](https://proconnector.hingepoint.com/support/throttle-limits/) — MEDIUM confidence (Procore integration partner, consistent with official rate limit headers)
- [SQLite WAL Mode Concurrency](https://sqlite.org/wal.html) — HIGH confidence (official SQLite documentation)
- [SQLite Concurrent Writes and Database Locked Errors](https://tenthousandmeters.com/blog/sqlite-concurrent-writes-and-database-is-locked-errors/) — MEDIUM confidence (verified against official SQLite docs)
- [RFC 9700 OAuth 2.0 Best Current Practice](https://datatracker.ietf.org/doc/rfc9700/) — HIGH confidence (IETF standard, January 2025)
- [Procore Ruby SDK Token Refresh Issue](https://github.com/procore-oss/ruby-sdk/issues/36) — MEDIUM confidence (real-world issue report from official Procore OSS repo)
- [Enterprise Integration Patterns — Idempotent Receiver](https://www.enterpriseintegrationpatterns.com/patterns/messaging/IdempotentReceiver.html) — HIGH confidence (foundational reference)
