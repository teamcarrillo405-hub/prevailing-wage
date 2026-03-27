# Pitfalls Research

**Domain:** Prevailing wage compliance app — v3.0 Team & Integration milestone
**Researched:** 2026-03-27
**Confidence:** HIGH (system-specific analysis from source code review of routes, schema, middleware) / MEDIUM (external integration patterns from official docs and community sources)

> Note: The previous version of this file covered v2.5 CA eCPR / WA PWIA pitfalls. That content is
> preserved in git history. This file covers v3.0 Team & Integration pitfalls specifically.

---

## Critical Pitfalls

### Pitfall 1: IDOR Auth Bypass After Adding project_members — The Scattered Ownership Check Problem

**What goes wrong:**
Today every route independently checks `project.userId !== req.user!.userId`. When v3.0 adds a
`project_members` table (flat model — all members see all projects), this check must change from
a single equality test to a membership query. The failure mode is that some routes get the new
membership check while others keep the old `userId` equality check. A team member who is not the
project owner gets 403 from routes that were updated but 200 from routes that were missed —
leaving inconsistent access. The reverse error (inverting the logic) silently returns data to
unauthorized users without triggering any error.

**Why it happens:**
Ownership checks in this codebase are scattered across every route file independently:
`projects.ts`, `workers.ts`, `payroll.ts`, `compliance.ts`, `export.ts`, `reports.ts`,
`variance.ts`, `union.ts`, `gsa.ts`, `wages.ts`. Each performs `project.userId !== userId`
at multiple call sites — some routes check twice (load + verify, then update + verify). A
refactor that touches 9 files with multiple check sites per file will miss at least one.

**How to avoid:**
Extract ownership resolution into a single shared service function —
`assertProjectAccess(projectId, userId, db): Promise<Project>` — that encapsulates the
membership check. Every route calls this function and receives the project back if access is
granted, or throws a 403 HttpError if not. After the refactor, no route file should contain
`project.userId !== userId` directly. Write a cross-tenant test suite before adding `project_members`:
two users, two projects (one per user), every protected endpoint asserts 403 when accessed by the
wrong user. This test suite becomes the regression gate.

**Warning signs:**
- Any route file still containing `.userId !== userId` or `.userId !== req.user` after the multi-user phase
- Any new route added without calling `assertProjectAccess`
- `GET /api/projects` list endpoint not filtering by team membership (returns all projects in the DB)

**Phase to address:**
Multi-user / team accounts phase — must be the first task in that phase. All other team features
(invite, member list, member removal) depend on this being correct.

---

### Pitfall 2: Cross-Tenant Data Leak via Indirect Object References on Child Entity Routes

**What goes wrong:**
Routes like `GET /api/projects/:projectId/workers` verify project ownership correctly. But routes
that accept child entity IDs directly — `GET /api/workers/:workerId`, `PATCH /api/workers/:workerId`,
payroll entry upserts, classification updates — query the child entity by ID without traversing the
project ownership chain. In a single-user system this is safe because all IDs belong to one user.
In a multi-user team, user A from Team 1 can observe worker UUIDs in their network traffic and
request `GET /api/workers/<uuid-from-team-1>` while authenticated as a user from Team 2. If the
worker route only checks "does this worker exist" and not "does this worker's project belong to a
team this user is on," the response returns Team 1's data to Team 2.

**Why it happens:**
UUID opacity is not a security boundary. UUIDs are visible in every React Query cache, every
network response, every URL. The single-user assumption made them effectively private — that
assumption evaporates with multi-user.

**How to avoid:**
Every route accepting a child entity ID must traverse the parent chain to the project and call
`assertProjectAccess`. Pattern: load the child entity, read its `projectId`, call
`assertProjectAccess(projectId, req.user.userId, db)`. Do not rely on the child entity's own
userId field (workers and entries have no userId — ownership is via projectId → project.userId).

**Warning signs:**
- Any route querying `workers`, `payrollEntries`, `workerClassifications`, `payrollWeeks`,
  `unionTradeConfigs`, `gsaRates`, `projectBudgets`, or `otThresholds` by primary key without
  also loading the project and calling `assertProjectAccess`
- Tests that only assert 200/201 status but not 403 for cross-user access

**Phase to address:**
Multi-user / team accounts phase — simultaneous with Pitfall 1. Both are part of the same
`assertProjectAccess` refactor.

---

### Pitfall 3: Rate Snapshot Corruption During CSV Import — Silent Compliance Failure

**What goes wrong:**
QuickBooks and ADP CSV exports contain a pay rate column ("Regular Pay Rate," "Hourly Rate,"
"Base Pay" — naming varies by version). If the import logic maps this column to
`baseRateSnapshot` or `fringeRateSnapshot` in `payroll_entries`, the WH-347 will show the wrong
rate. The compliance engine (`under-wage` check) fires based on `baseRateSnapshot` vs. the WD
rate. If the snapshot is set to the imported payroll rate (which may coincidentally equal or
exceed the WD rate), the compliance engine will not fire violations even when the worker was
actually paid below prevailing wage.

This is the most serious data integrity failure possible in this system. The WH-347 is a legally
required certified document — any corruption of the rate data is a compliance failure, not just
a software bug.

**Why it happens:**
The natural approach to CSV import is to map CSV columns to database columns. An implementer sees
a "Rate" column and maps it to the `rateSnapshot` columns by name. The fact that snapshots must
come from the wage determination cache (not from the payroll provider) is a compliance constraint
that is not visible from the schema alone.

**How to avoid:**
The import logic must never accept rate data from the CSV as the snapshot value. The import flow
must: (1) parse CSV to extract worker name, hours, and pay period; (2) match each worker to
existing `workers` and `workerClassifications` records; (3) fetch `baseRateSnapshot` and
`fringeRateSnapshot` from the WD cache exactly as the manual payroll entry UI does (via
`getCachedClassifications`); (4) write entries with WD-sourced snapshots. The CSV pay rate may be
stored as a separate `importedRate` field for audit trail purposes, but must never become the
compliance snapshot. Enforce this at the service layer: if `baseRateSnapshot` is not sourced from
the WD cache lookup, throw before writing.

**Warning signs:**
- Import code that reads any rate column from the CSV
- `baseRateSnapshot` values in imported entries that differ from `getCachedClassifications` output
  for the same trade code
- No compliance violations firing on imported payroll weeks when violations would be expected

**Phase to address:**
Payroll import phase — the snapshot sourcing rule must be implemented in the import service before
any CSV parsing logic is written.

---

### Pitfall 4: Duplicate payroll_entries on Re-Import — Silent Overwrite or Hard Crash

**What goes wrong:**
`payroll_entries` has `UNIQUE(payroll_week_id, worker_id, classification_id)`. A re-import
(user re-uploads the same CSV after a correction) hits this constraint and either:
- Crashes the entire batch if using plain INSERT (constraint violation error, partial data remains)
- Silently ignores the new data if using `INSERT OR IGNORE` (first import "wins" permanently)
- Deletes-then-inserts if using `INSERT OR REPLACE`, resetting `createdAt` and breaking the
  audit trail (amendment logic depends on `createdAt` ordering)

None of these are correct for a certified payroll audit trail.

**Why it happens:**
SQLite upsert shorthand is seductive. `INSERT OR REPLACE` looks like "upsert" but it is
delete-then-insert with a new primary key. `INSERT OR IGNORE` looks safe but silently swallows
corrections. Neither option preserves audit semantics.

**How to avoid:**
Use the preview-then-commit pattern already established in `copyPayrollWeek()`. Import flow:
(1) parse CSV fully in memory; (2) detect existing entries by the unique key; (3) return a
preview response showing `{new: N, updated: N, skipped: N}` with a diff of changed hours for
"updated" entries; (4) require explicit user confirmation before writing. For entries that already
exist and the CSV has different hours, show the delta (`monSt: 8.0 → 9.5`). If the payroll week
has `submittedAt` set, block import entirely with a clear error — submitted weeks are immutable.

**Warning signs:**
- Import code using `INSERT OR IGNORE`, `INSERT OR REPLACE`, or `ON CONFLICT DO NOTHING`
- No preview step before writing import data
- Import logic not checking `payrollWeeks.submittedAt` before writing

**Phase to address:**
Payroll import phase — the preview-commit pattern must be designed before any CSV parsing.

---

### Pitfall 5: SSN Encryption Key Loss — Permanent and Unrecoverable Data Loss

**What goes wrong:**
The encrypted SSN column is added to `workers`. The AES-256 key is stored as a Render.com
environment variable (`ENCRYPTION_KEY`). An operator rotates the env var (treating it like an
API key), the service redeploys with the new key, and every SSN in the database is permanently
unreadable. CA eCPR and WA portal pre-fill break. If a compliance audit requests full SSNs, the
system cannot produce them. There is no recovery path — AES-256 ciphertext without the key is
irreversible.

**Why it happens:**
Render.com environment variables can be changed at any time through the dashboard. There is no
built-in key versioning or rotation history. Operators who manage API keys and secrets routinely
use "rotate = delete old, generate new." That mental model is catastrophically wrong for
encryption keys tied to stored data.

**How to avoid:**
(1) Store the key version alongside every encrypted value. The `ssnEncrypted` column must hold a
JSON envelope: `{"v":"1","iv":"<hex12>","tag":"<hex16>","ct":"<hex>"}`. The `v` field identifies
which key was used. (2) Never delete old key versions. Use versioned env vars:
`ENCRYPTION_KEY_V1`, `ENCRYPTION_KEY_V2`. Keep all versions active until a re-encryption
migration has run. (3) Build a re-encryption migration script: load all rows encrypted with `v1`,
decrypt with `ENCRYPTION_KEY_V1`, re-encrypt with `ENCRYPTION_KEY_V2`, write `v2` envelope. (4)
Add a startup assertion: if `ENCRYPTION_KEY_V1` (or the current active version) is missing or
fails to decrypt a known test vector, throw and refuse to start. (5) Write the key rotation
runbook in the repository before shipping the encryption feature.

**Warning signs:**
- `ssnEncrypted` column stores only raw base64 ciphertext with no key version metadata
- Application starts normally when `ENCRYPTION_KEY` env var is missing
- No re-encryption script exists when a new key version is introduced

**Phase to address:**
SSN encryption phase — key versioning schema and rotation runbook must be designed before the
first migration is written.

---

### Pitfall 6: IV Reuse in AES-256-CBC Mode — Structural Cryptographic Weakness

**What goes wrong:**
If the encryption implementation uses AES-256-CBC with a static IV (hardcoded, derived from
worker ID, or derived from a timestamp with second granularity), encrypting two workers with the
same SSN produces identical ciphertext. An attacker with read access to the database can
immediately identify workers who share SSNs. With enough known-plaintext pairs, CBC with a
static IV leaks the key. This is a compliance failure against PII standards and a legal liability.

**Why it happens:**
The majority of AES-256-CBC code examples on the internet use a hardcoded IV for demonstration
clarity. Developers copy these examples. The mistake is invisible in testing because decryption
works correctly with a static IV — the failure is cryptographic, not functional.

**How to avoid:**
Use AES-256-GCM, not CBC. GCM is authenticated encryption: it provides confidentiality and
integrity. A corrupted or tampered ciphertext is detected at decrypt time (authentication tag
mismatch) rather than silently returning garbled data. Generate a fresh 12-byte random nonce
(IV) for every encryption call: `crypto.randomBytes(12)`. Store `{iv, authTag, ciphertext}` in
the JSON envelope (see Pitfall 5). Never derive the IV from any deterministic input.
Implementation: `crypto.createCipheriv('aes-256-gcm', keyBuffer, iv)` — use the 32-byte key
directly, do not hash or derive unless using a dedicated KDF.

**Warning signs:**
- Any use of `aes-256-cbc` in encryption code
- IV generated from `worker.id`, `Date.now()`, or any non-`crypto.randomBytes` source
- Missing `authTag` in the stored envelope (GCM without the auth tag is not authenticated)

**Phase to address:**
SSN encryption phase — must be reviewed before the first encrypted value is written to any
environment.

---

### Pitfall 7: Agency Portal Auto-Submit Sets submittedAt Before Portal Confirms — Permanent State Mismatch

**What goes wrong:**
CA DIR eCPR and WA PWIA portal submissions involve multiple steps: authenticate, build request,
POST data, receive confirmation. If `payrollWeeks.submittedAt` is set optimistically (before the
portal returns a confirmed success), and the POST then fails (session expired, network timeout,
portal validation error), the local record shows the week as submitted while the portal has no
record of it. The app's existing edit lock (`assertWeekNotSubmitted`) will then block all further
edits to that week. The week is stuck: locally "submitted," remotely missing.

Additionally: CA DIR eCPR portal has a documented pattern of accepting uploads and then silently
marking them as "drafts" rather than processing them (confirmed from the June 2024 portal launch
failure series). The upload POST returns HTTP 200 but the submission is not actually finalized.

**Why it happens:**
Setting `submittedAt` optimistically before waiting for a confirmed response is a natural
simplification — it avoids a two-step async flow. The CA DIR portal's "returns 200 but marks as
draft" behavior is undocumented and would only be discovered by a developer who monitored the
portal after upload.

**How to avoid:**
(1) Never set `submittedAt` until the portal returns a confirmed non-draft success. (2) Add a
`portal_submission_attempts` table with columns: `id`, `payrollWeekId`, `portal` (ca-dir | wa-lni),
`status` (pending | success | failed | draft-stuck), `startedAt`, `completedAt`, `errorMessage`,
`portalResponse` (text). (3) Only set `payrollWeeks.submittedAt` after writing a `success` record.
(4) For CA DIR: after upload, poll the portal's project history endpoint to confirm the week
appears as "submitted" (not "draft") before marking success. (5) For session expiry: detect 401
or redirect responses mid-submission, re-authenticate, and retry from the failed step. Do not
retry from the beginning — already-received records may create duplicates.

**Warning signs:**
- Any code path that calls `updateWeekSubmission()` before receiving portal confirmation
- No `portal_submission_attempts` table or equivalent status tracking
- No re-authentication logic in the portal submission service

**Phase to address:**
Agency portal auto-submit phase — the submission state machine must be designed before any portal
HTTP client code is written.

---

### Pitfall 8: Portal Session Expiry Mid-Submission Leaves Partial State at the Portal

**What goes wrong:**
CA DIR eCPR and WA PWIA portals use session-based authentication (cookie or short-lived token).
Government portal sessions typically expire in 15-30 minutes. A submission for a project with
20+ workers can take longer than the session lifetime, particularly if the submission involves
per-worker POSTs rather than a single XML batch upload. When the session expires mid-submission,
the portal receives partial data. On retry, re-submitting all workers creates duplicates at the
portal side.

**Why it happens:**
Developers implementing the submission flow test with a 3-worker project. The session never
expires. The flow goes to production with a 25-worker project and the session expires at worker 18.

**How to avoid:**
Strongly prefer XML batch upload over per-worker POSTs. A single atomic XML POST is: authenticate
once, POST one file, receive one response. Session expiry during a single HTTP POST is effectively
impossible. For portals that only support per-worker submission: (1) implement session keepalive
by making a low-cost authenticated request every 5 minutes; (2) on 401/redirect, re-authenticate
and resume from the last successful worker (tracked in `portal_submission_attempts`); (3) before
re-submitting a worker, check if the portal already has that worker's record for the week.

**Warning signs:**
- Portal submission code that iterates over workers in a loop without session refresh logic
- No test with a simulated session expiry after the N-th worker
- Submission that starts from the beginning on retry without checking what was already received

**Phase to address:**
Agency portal auto-submit phase — concurrent with Pitfall 7.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep `project.userId !== req.user.userId` checks inline in route files, add membership check "later" | Faster to ship team invite without refactoring all routes | Every missed route is a live IDOR vulnerability; cross-tenant data leak | Never — the check must be centralized before any multi-user data is live |
| Store IV and ciphertext as separate columns rather than a JSON envelope | Slightly simpler initial schema | Cannot add key version without another migration; rotation runbook becomes complex | Never for new encryption — envelope from day one |
| Import CSV pay rates directly into snapshot columns | Faster import implementation | WH-347 and compliance checks silently use wrong rates; audit failure; cannot be caught until a DOL audit | Never for certified payroll data |
| Set `submittedAt` optimistically before portal confirms | Simpler single-step code path | Week becomes permanently locked in the app while portal has no record; unrecoverable without direct DB edit | Never — submission tracking is legally significant |
| Skip import preview step | Less UI to build | Silent overwrites; user cannot catch mapping errors before data is corrupted | Never for payroll data |
| Use a single `ENCRYPTION_KEY` env var with no versioning | Simple initial implementation | Key rotation destroys all existing encrypted data — unrecoverable | Never if key rotation is anticipated |
| Embed team membership list in JWT payload | Avoids DB query on each request | Stale membership: removed user retains access until token expiry; cannot revoke without invalidating all tokens | Never — membership must be DB-resolved per request |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| QuickBooks CSV export | Column headers vary by QBO vs QBD version and locale: "Regular Pay Rate" / "Hourly Rate" / "Base Pay" | Build a column mapping UI showing parsed headers; ask the user to confirm the hours columns; never hardcode column indices or names |
| ADP CSV export | ADP exports by cost center, not by project — one file may span multiple projects or include workers not on this project | Add a project filter step in the import UI; warn when imported workers do not match any existing worker record on the target project |
| ADP CSV export | ADP separates regular hours, OT hours, and DT hours into different rows per employee, not columns | The import parser must group rows by employee and map row-type to the correct hour bucket (monSt/monOt/monDt) |
| CA DIR eCPR portal | Treating HTTP 200 upload response as confirmed submission | CA DIR portal returns 200 but marks submissions as "draft" — poll the portal's project history to confirm "submitted" status |
| WA L&I PWIA | Conflating weekly CPR XML submission with the Affidavit of Wages Paid | Affidavit is a separate post-project filing; the auto-submit flow must distinguish between these two and not mark a project complete after weekly submissions |
| Render.com env vars | Changing `ENCRYPTION_KEY` in Render dashboard and assuming it takes effect on the running instance | Env var changes require a deploy; but operators may change the value and then deploy an unrelated change — always verify decryption works in staging before touching production |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `GET /api/projects` changes from `WHERE userId=X` to a membership JOIN with no index on `project_members(user_id)` | Dashboard load latency increases; SQLite serializes all requests so all users wait | Add `CREATE INDEX idx_project_members_user_id ON project_members(user_id)` in the migration that creates the table | With 3+ concurrent team members loading the dashboard |
| CSV import parsed and written in one synchronous transaction with 50+ rows | Import POST times out at Render's 30-second HTTP timeout; partial transaction state | Stream rows in batches of 10 using Drizzle's `.transaction()` per batch; timeout leaves clean batch boundaries | Any import with more than ~20 workers × 5 weeks = 100+ rows |
| Compliance batch endpoint re-queries membership per project after project_members is added | N+1 membership query resurfaces for team members who see more projects than single-user owner | The membership query must be a single JOIN, not a per-project loop; existing `staleTime:60_000` on ProjectCard helps client-side, but server batch must use a single SQL | With 10+ projects visible to a team member |
| SQLite write serialization under concurrent team use | Import + manual payroll entry + SSN update queue behind the same write lock; one request blocks others | Explicitly enable WAL mode in `getDb()` via `PRAGMA journal_mode=WAL`; WAL allows reads to proceed concurrently with writes | With 3+ concurrent write operations |
| Re-encrypting all SSNs during key rotation in the same process as the running server | Server is unavailable during migration; if process is killed mid-migration, some rows have new key, others old key | Key rotation must be a standalone script that runs outside the server process; the JSON envelope's `v` field allows mixed-version rows to coexist safely during migration | Any rotation on a database with more than ~500 workers |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing key version, IV, and ciphertext as separate columns | Schema leaks the relationship between key version and ciphertext; reduces brute-force search space | Store as a single JSON blob: `{"v":"1","iv":"<hex>","tag":"<hex>","ct":"<hex>"}` — the DB schema alone does not reveal crypto structure |
| Logging decrypted SSN values in Express request/response logs | Full SSNs appear in Render.com log stream (accessible to anyone with dashboard access) | Ensure no SSN field reaches the logger; log `"ssn":"[REDACTED]"` in any request/response body logging middleware |
| Returning full decrypted SSN over the API to the React client for display | Full SSN exposed in browser memory, React Query cache, and network traffic | The API returns `ssnMasked: "***-**-1234"` for display; the full SSN is only decrypted server-side in XML export handlers |
| Embedding team membership in JWT payload to avoid a DB lookup | Membership changes (user removed) are not reflected until JWT expiry; removed user retains access | Resolve membership from DB on every request using the `userId` from the JWT; the DB lookup cost is negligible vs. the security risk |
| Storing invite tokens as plaintext in the DB | Anyone with DB read access can generate valid invite links | Hash invite tokens (SHA-256) before storing; compare the hash at acceptance time; expire tokens after 7 days |
| CSV import staging table persists full SSNs from the CSV | Full SSNs sit in plaintext in a staging table long after import completes | Treat any full SSN from CSV as ephemeral: decrypt from CSV → encrypt immediately → discard plaintext → never log; drop staging rows after commit |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| CSV import maps columns automatically and writes data without a preview | User discovers corrupt rate snapshots after printing WH-347 for an auditor | Show a preview table of the first 3 rows with column mapping annotations and an hours total; require explicit confirmation before writing |
| Team invite is the only recovery path if the invite email is lost | Admin cannot re-invite without invalidating the original token; friction for the inviting user | Allow re-sending an invite; generate a new token, invalidate the previous one |
| No indication of which team member entered or modified a payroll entry | Audit trail is anonymous; GC cannot determine who entered erroneous data during a DOL audit | Add `createdByUserId` and `updatedByUserId` to `payroll_entries` from the start of v3.0; retrofitting after the fact leaves null on all existing rows, indistinguishable from manually entered |
| Portal auto-submit status not visible on the payroll week detail page | User re-submits manually after auto-submit already completed, creating duplicate portal records | Add a `submissionAttempt` status badge alongside the existing `submittedAt` indicator on the payroll week detail view |
| Import silently skips workers that could not be matched to existing worker records | Payroll week appears complete but is missing workers who were not in the system at import time | Show an "unmatched workers" list in the import preview; block import completion until the user resolves each unmatched worker |

---

## "Looks Done But Isn't" Checklist

- [ ] **Multi-user ownership:** `project.userId !== req.user.userId` still exists in route files after
  adding `project_members` — verify with: `grep -r "\.userId !== " src/server/routes/`
- [ ] **Multi-user list endpoint:** `GET /api/projects` still filters by `projects.userId` alone
  rather than by membership — verify query returns only team-visible projects for each user
- [ ] **SSN encryption health check:** Application starts and returns 200 on the health route
  even when `ENCRYPTION_KEY_V1` env var is missing — verify startup asserts key presence and
  fails fast if the test vector does not decrypt
- [ ] **Rate snapshot integrity on import:** Imported `payroll_entries` have `baseRateSnapshot`
  and `fringeRateSnapshot` that match the WD cache output for the same trade code — verify by
  comparing a sample imported entry against `getCachedClassifications` for the same worker
- [ ] **Submitted week protection:** Import flow checks `payrollWeeks.submittedAt` before writing
  — verify that attempting to import into a submitted week returns a 400 error, not a silent overwrite
- [ ] **IV uniqueness per encryption call:** Verify by encrypting the same SSN 100 times and
  asserting all 100 IV values are unique and all 100 ciphertexts differ
- [ ] **Key version in stored envelope:** The `ssnEncrypted` column value parses to a JSON object
  with a `v` field — verify by inspecting a raw DB row after encryption
- [ ] **submittedAt not set until portal confirms:** Simulate a portal timeout mid-submission and
  assert that `payrollWeeks.submittedAt` is still null afterward
- [ ] **Audit trail columns present:** `payroll_entries` has `createdByUserId` NOT NULL in the
  migration — verify the column exists with a default for existing rows

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Cross-tenant data leak discovered post-launch | HIGH | Audit access logs to identify which cross-tenant requests succeeded; notify affected users; patch ownership checks; invalidate all JWTs to force re-login |
| Rate snapshot corruption from import | HIGH | Identify all entries from the import batch using an `importBatchId` column (add this before shipping import); delete the corrupt entries; re-run import with corrected snapshot logic; regenerate all WH-347 forms for affected weeks |
| SSN encryption key lost with no backup | CRITICAL / UNRECOVERABLE | If no old key version exists anywhere, encrypted SSNs cannot be recovered; users must re-enter full SSNs manually; add key backup and rotation runbook before this happens |
| Portal partial submission (session expired mid-submission) | MEDIUM | Query the portal for which workers were received; submit only the missing workers; do not re-submit already-received records; mark `portal_submission_attempts` as `partially-recovered` |
| Duplicate payroll entries from re-import | MEDIUM | Use `importBatchId` to identify the duplicate batch; delete the second batch; verify the unique constraint is satisfied; re-run with the preview mode enabled |
| `submittedAt` set optimistically, portal has no record | MEDIUM | Requires direct DB update to clear `submittedAt` (no UI path since edit lock fires); add an admin "un-submit" endpoint; then re-submit correctly |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| IDOR auth bypass after project_members | Multi-user / team accounts (first task) | Cross-tenant test suite: two users, two projects, all protected endpoints assert 403 for wrong user |
| Indirect object reference on child entities | Multi-user / team accounts (simultaneous with IDOR fix) | Grep: no direct child entity query without `assertProjectAccess`; integration test suite |
| Rate snapshot corruption on import | Payroll import phase (first design constraint) | Automated test: import a CSV, compare all `baseRateSnapshot` values against `getCachedClassifications`; assert no CSV rate column was used |
| Duplicate entries on re-import | Payroll import phase | Test: import same CSV twice; second import shows preview with "already exists" for all rows; DB has no duplicates |
| SSN encryption key loss | SSN encryption phase (key versioning schema designed before migration) | Key rotation drill in staging: generate new key, run re-encryption script, verify all SSNs decrypt with new key; old key decrypts old rows |
| IV reuse / CBC mode | SSN encryption phase (implementation review before any data written) | Unit test: encrypt same SSN 100 times; all 100 IVs unique; all 100 ciphertexts unique; auth tags present |
| Portal submittedAt set before confirm | Agency portal auto-submit phase (state machine design first) | Integration test with mocked portal that times out after worker N; assert `submittedAt` is null; `submissionAttempt` shows `failed` |
| Portal session expiry mid-submission | Agency portal auto-submit phase | Simulated session expiry after worker 5 of 20; assert partial state is tracked; retry resumes from worker 6 |
| `createdByUserId` missing from audit trail | Multi-user / team accounts (migration design step) | Schema review: `payroll_entries` migration adds `createdByUserId` NOT NULL with DEFAULT to owner userId for existing rows |

---

## Integration Pitfalls Between Features

These pitfalls arise from combining two v3.0 features. Neither feature alone causes them.

### Import + Multi-user: Imported Entries Have No Author

When a team member imports a CSV, the resulting `payroll_entries` have no `createdByUserId` in
the current schema. In a DOL audit, the GC may need to identify who entered which payroll records
and when. If audit columns are retrofitted after import is shipped, all existing imported entries
have null `createdByUserId` — indistinguishable from manually entered entries. Design
`createdByUserId` (and `updatedByUserId`) into `payroll_entries` and `payrollWeeks` from the
start of v3.0, not as a follow-up migration.

### Encryption + WH-347 Export: Full SSN Must Never Reach the PDF Generator

WH-347 currently uses `workers.ssnLast4`. v3.0 adds `workers.ssnEncrypted`. The WH-347 PDF
generator (`fillWh347()`) must continue using only the last 4 digits — DOL format is
`XXX-XX-XXXX` with only the last 4 shown. If a developer passes the full decrypted SSN through
`fillWh347()` "for convenience" (because it is now available), the full SSN appears on every
downloaded WH-347, which is a PII exposure on a document that may be filed publicly with federal
agencies.

Prevention: the `fillWh347()` function signature accepts only `ssnLast4: string`. The SSN
decryption path exists only in `caEcprExport` and `waPwiaExport`. Write a test that asserts the
WH-347 PDF bytes do not contain any sequence matching `\d{9}` (a 9-digit SSN).

### Import + Encryption: CSV Full SSN Is Ephemeral — Never Stage It

QuickBooks and ADP exports sometimes include full SSNs in the worker row. If the import stores
this in a plaintext staging table or logs it during processing, the full SSN sits unencrypted in
the database or log stream. The import pipeline must treat any full SSN from CSV as ephemeral:
read from CSV → pass directly to the encrypt function → write the envelope → discard the
plaintext string. The raw SSN string must never be assigned to a variable that outlives the
encryption call, logged, or written to any column other than `ssnEncrypted`.

### Multi-user + Compliance History: Cross-Project Identity Becomes Ambiguous Under Team Accounts

The current per-worker compliance history uses `(name, ssnLast4)` identity to aggregate
violations across projects. In a team account, two team members may add the same physical worker
independently on different projects, creating two `workers` records. The compliance history page
shows separate violation histories for the same physical person. This is not data corruption but
it misleads GCs who believe a worker has a clean history when they actually have violations on a
different project record. The v3.0 migration to full SSN (encrypted) enables proper
deduplication — plan the cross-project identity query to use decrypted SSN matching when the
user requests it, with an explicit privacy notice in the UI.

---

## Sources

- Source code analysis: `src/server/routes/projects.ts` (ownership pattern — `project.userId !== userId` at lines 113, 150, 184), `src/server/routes/workers.ts` (indirect reference pattern), `src/server/db/schema.ts` (data model — no `project_members` table, no `ssnEncrypted` column, no `createdByUserId`)
- SQLite WAL mode and write concurrency: [SQLite Write-Ahead Logging documentation](https://www.sqlite.org/wal.html)
- AES-256-GCM nonce requirements: [Node.js crypto documentation](https://nodejs.org/api/crypto.html)
- AES-256 mode pitfalls: [AES-256 Encryption Types — Modes, Uses & Pitfalls](https://terrazone.io/aes-256-encryption-types/)
- Multi-tenant cross-tenant leak prevention: [Preventing Cross-Tenant Data Leakage in Multi-Tenant SaaS](https://agnitestudio.com/blog/preventing-cross-tenant-leakage/)
- CA DIR eCPR portal reliability issues: [DIR Update on Public Works Website Issues](https://thewpcca.com/dir-update-on-public-works-website-issues/)
- WA L&I PWIA system overview: [L&I PWIA Step-by-Step Instructions](https://lni.wa.gov/licensing-permits/_docs/pwia-step-by-step-instructions.pdf)
- Certified payroll software integration patterns: [Certified Payroll Software Integration Guide](https://www.certifiedpayrollreporting.com/blog/certified-payroll-software-integration-guide)
- Multi-tenant API in Node.js: [Guide to building Multi-Tenant Architecture in Nodejs](https://dev.to/rampa2510/guide-to-building-multi-tenant-architecture-in-nodejs-40og)

---
*Pitfalls research for: HCC Prevailing Wage v3.0 — Team & Integration milestone*
*Researched: 2026-03-27*
