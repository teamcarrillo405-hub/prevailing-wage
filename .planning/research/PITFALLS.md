# Pitfalls Research

**Domain:** Prevailing wage compliance app — v3.0 Team & Integration milestone
**Researched:** 2026-03-27
**Confidence:** HIGH (system-specific analysis from direct source code review of routes, schema, and middleware) / MEDIUM (external integration patterns from official documentation and community sources)

> This file covers v3.0 pitfalls for: single-user-to-multi-tenant migration, invite token system,
> QuickBooks/ADP CSV import, AES-256 SSN encryption in SQLite, and ownership transfer.
> Previous v2.5 pitfall research is in git history.

---

## Critical Pitfalls

### Pitfall 1: IDOR Auth Bypass After Adding project_members — The Scattered Ownership Check Problem

**What goes wrong:**
Today every route independently checks `project.userId !== req.user!.userId`. When v3.0 adds a
`project_members` table (flat model — all members see all projects), this check must change from
a single equality test to a membership query. The failure mode is that some routes get the new
membership check while others keep the old `userId` equality check. A team member who is not the
project owner gets 403 from routes that were updated but 200 from routes that were missed, leaving
inconsistent access. The reverse error (inverting the logic) silently returns data to unauthorized
users without triggering any error.

**Why it happens:**
Ownership checks in this codebase are scattered across every route file independently:
`projects.ts`, `workers.ts`, `payroll.ts`, `compliance.ts`, `export.ts`, `reports.ts`,
`variance.ts`, `union.ts`, `gsa.ts`, `wages.ts`. Each performs `project.userId !== userId`
at multiple call sites — some routes check twice (load + verify, then update + verify). A
refactor that touches 9 files with multiple check sites per file will miss at least one.
The `grep` count confirms 19 occurrences of `project.userId !== userId` across 6 route files.

**How to avoid:**
Extract ownership resolution into a single shared service function:
`assertProjectAccess(projectId: string, userId: string, db: DrizzleDB): Promise<Project>`
This function encapsulates the membership query: load the project, check if the user is the
owner OR is in `project_members` for that project's account, throw an `HttpError(403)` if not,
return the project if yes. Every route calls this function and receives the project back on
success. After the refactor, no route file should contain `project.userId !== userId` directly.
Write a cross-tenant test suite before adding `project_members`: two users, two projects (one per
user), every protected endpoint asserts 403 for the wrong user. This test suite becomes the
regression gate.

**Warning signs:**
- Any route file still containing `.userId !== userId` or `.userId !== req.user` after the
  multi-user phase lands
- Any new route added without calling `assertProjectAccess`
- `GET /api/projects` list endpoint filtering only by `projects.userId` (not membership JOIN)

**Phase to address:**
Multi-user / team accounts phase — must be the first task. All other team features depend on
this being correct.

---

### Pitfall 2: Cross-Tenant Data Leak via Indirect Object References on Child Entity Routes

**What goes wrong:**
Routes like `GET /api/projects/:projectId/workers` verify project ownership correctly. But routes
that accept child entity IDs directly — worker endpoints, payroll entry upserts, classification
updates — query the child entity by ID without traversing the project ownership chain. In a
single-user system this is safe because all IDs belong to one user. In a multi-user team, user A
from Team 1 can observe worker UUIDs in network traffic and request
`GET /api/workers/<uuid-from-team-1>` while authenticated as a user from Team 2. If the worker
route only checks "does this worker exist" and not "does this worker's project belong to a team
this user is on," the response returns Team 1's data to Team 2.

**Why it happens:**
UUID opacity is not a security boundary. UUIDs are visible in every React Query cache, every
network response, every URL. The single-user assumption made them effectively private — that
assumption evaporates with multi-user.

**How to avoid:**
Every route accepting a child entity ID must traverse the parent chain to the project and call
`assertProjectAccess`. Pattern: load the child entity, read its `projectId`, call
`assertProjectAccess(projectId, req.user.userId, db)`. Do not rely on the child entity having
its own `userId` field — `workers`, `payrollEntries`, and `workerClassifications` have no
`userId` column; ownership is via `projectId → project.userId`.

**Warning signs:**
- Any route querying `workers`, `payrollEntries`, `workerClassifications`, `payrollWeeks`,
  `unionTradeConfigs`, `gsaRates`, `projectBudgets`, or `otThresholds` by primary key without
  loading the project and calling `assertProjectAccess`
- Tests that only assert 200/201 status but never assert 403 for cross-user access

**Phase to address:**
Multi-user / team accounts phase — simultaneous with Pitfall 1 (same `assertProjectAccess`
refactor).

---

### Pitfall 3: Invite Token Enumeration — Short or Predictable Tokens

**What goes wrong:**
A registration invite token that is short (8 hex chars, 6 alphanumeric digits) or derived from
any predictable input (timestamp, user email hash, sequential ID) can be brute-forced. An
attacker who discovers the invite URL pattern sends automated requests with incremented or
enumerated token values until a 200 response is returned, then uses that invite link to register
an account on the target team. Because the model is owner + 1 member, a successful enumeration
attack gives the attacker a team seat and full access to all projects.

**Why it happens:**
Invite tokens look like they just need to be "hard to guess" — an 8-character random string feels
secure to most developers. However, the attack surface for a single-account system is exactly one
valid token at any time. The attacker only needs to find that one value. At 1,000 requests per
second (trivially achievable against an unprotected endpoint), a 6-character alphanumeric token
(62^6 ≈ 56 billion) takes about 650 days — but a 6-hex-char token (16^6 ≈ 16 million) takes
16 seconds.

**How to avoid:**
Generate invite tokens using `crypto.randomBytes(32)` and encode as hex or base64url (64
hex chars, 43 base64url chars). This produces 256 bits of entropy — brute-force infeasible
even at 10 billion requests per second. The URL becomes
`/register?invite=<64-hex-token>`. Additionally: rate-limit the `/register` endpoint by IP
(5 attempts per minute); return HTTP 404 (not 403) for invalid tokens so attackers cannot
distinguish "wrong token" from "endpoint does not exist"; store the token hash (SHA-256) not
the raw token in the DB.

**Warning signs:**
- `randomBytes` called with fewer than 16 bytes
- Token derived from `Date.now()`, `userId`, or `crypto.randomUUID()` alone
  (UUID has 122 bits of entropy — acceptable, but still not the floor for invite tokens)
- No rate limiting on the registration endpoint
- HTTP 403 (not 404) returned for invalid invite tokens (confirms endpoint exists)

**Phase to address:**
Multi-user / team accounts phase — invite token generation design before the invite flow is built.

---

### Pitfall 4: Invite Token Timing Attack — Non-Constant-Time Comparison

**What goes wrong:**
If the invite token acceptance endpoint compares the submitted token against the stored value
using a plain string equality check (`storedToken === submittedToken`), the comparison short-
circuits on the first mismatching character. An attacker who can measure response time can
reconstruct the token one character at a time by finding the prefix that takes slightly longer
to reject than others. This is a timing attack. Against a 64-hex token, a determined attacker
with low-latency network access can recover the token faster than brute force.

**Why it happens:**
String equality is the default. The timing vulnerability is non-obvious — the code is
functionally correct (correct tokens are accepted, wrong tokens are rejected). Only the timing
side-channel is wrong, and it is invisible in tests.

**How to avoid:**
Use `crypto.timingSafeEqual(Buffer.from(storedHash), Buffer.from(submittedHash))` for the final
comparison, where both sides are the SHA-256 hash of the respective tokens. Since hashes are
fixed-length (32 bytes), `timingSafeEqual` compares all 32 bytes regardless of where they
diverge. `timingSafeEqual` requires both buffers to be the same length — compute `sha256hex(raw)`
for both sides before calling it. Never compare the raw token against the DB value; always
compare hashes.

**Warning signs:**
- Token comparison using `===`, `.equals()`, or `.localeCompare()` on token strings
- No SHA-256 hashing step before the comparison
- Using a timing-safe library for password comparison (bcrypt) but plain equality for tokens
  (common oversight — developers apply timing safety only to passwords)

**Phase to address:**
Multi-user / team accounts phase — token validation handler design.

---

### Pitfall 5: Invite Token Reuse After Acceptance — Persistent Valid Link

**What goes wrong:**
After an invitee clicks the invite link and registers successfully, the token remains in the
database with status "accepted" but the token value is still valid. If the token is not deleted
or invalidated at acceptance time, or if a "used" token is not rejected at the route level, two
failure modes arise:
(1) The invitee can re-register again using the same link (if registration does not check for
existing account) — or a third party who discovers the link can use it.
(2) If the owner removes the member and later re-invites, the old unused tokens for the original
invitation also remain valid — the removed member could re-register using a link they saved.

**Why it happens:**
The natural implementation creates a token row, checks it on acceptance, and sets a status field.
But unless the route explicitly rejects `status = 'accepted'` tokens AND deletes the row after
use, the token stays exploitable.

**How to avoid:**
(1) Delete the invite token row from the DB immediately upon successful registration — do not
keep "accepted" tokens. (2) If retention is needed for audit, move to a separate
`invite_audit_log` table after deletion. (3) Before any registration that uses an invite token,
verify `invites.expiresAt > now()` AND `invites.acceptedAt IS NULL` — both conditions must pass.
(4) Wrap the token lookup, acceptance check, user creation, and token deletion in a single
Drizzle transaction so a crash between registration and deletion cannot leave a used token valid.

**Warning signs:**
- Invite token table has a `status` column but no deletion on acceptance
- Token lookup does not check `expiresAt`
- Token deletion is outside the user-creation transaction

**Phase to address:**
Multi-user / team accounts phase — invite acceptance handler, specifically the transaction design.

---

### Pitfall 6: Invite Token Without Expiry — Permanent Attack Window

**What goes wrong:**
An invite token created with no `expiresAt` column (or `expiresAt = NULL`) never expires. If
the invitee never accepts it, the link remains valid indefinitely. A contractor who leaves a
company but received an invite before leaving retains a valid registration link forever. Email
is not a secure delivery channel — if the invite email is forwarded, stored in a compromised
inbox, or intercepted, the attacker has indefinite time to use it.

**Why it happens:**
Expiry requires a background cleanup job or a check at acceptance time, both of which add code.
An MVP skips it.

**How to avoid:**
Set `expiresAt` to `now + 7 days` at token creation time. Enforce the check at the acceptance
route: if `now > expiresAt`, return HTTP 410 Gone with "Invite link has expired. Ask the owner
to resend." Allow re-sending a new invite (which generates a new token and invalidates all
previous tokens for that email address). Note: the invite table should enforce `UNIQUE(accountId)`
or `UNIQUE(email, accountId)` so re-sending replaces the existing row rather than accumulating
expired tokens.

**Warning signs:**
- `invites` table has no `expiresAt` column
- Registration handler does not compare `invites.expiresAt` against current time
- No UI affordance to re-send an expired invite

**Phase to address:**
Multi-user / team accounts phase — invite schema design (before the first migration is written).

---

### Pitfall 7: Ownership Transfer Race Condition — Two Concurrent Transfers

**What goes wrong:**
The ownership transfer flow is: (1) verify requester is owner, (2) update `users.role` for the
current owner to "member," (3) update `users.role` for the target member to "owner." If two
requests race through step 1 simultaneously (both see the requester as owner), both proceed to
steps 2 and 3. The result depends on execution order — both users could end up as "owner," or
both could end up as "member" (no owner), or the account could be left in an inconsistent state.
In the flat model with only 2 users, having no owner means neither can perform owner-only
actions (remove member, transfer ownership again).

**Why it happens:**
The check-then-act pattern is inherently racy when not wrapped in a transaction with appropriate
locking. SQLite's serialized write model protects against concurrent writers in some cases, but
the protection depends on using a single transaction that atomically checks and updates. Two
separate queries separated by async/await breaks the atomicity.

**How to avoid:**
Wrap the entire ownership transfer in a single Drizzle `.transaction()` call that performs a
conditional UPDATE: `UPDATE users SET role = 'owner' WHERE id = :targetId AND (SELECT role FROM
users WHERE id = :requesterId) = 'owner'`. Use SQLite's `changes()` count to verify exactly 1
row was updated. If 0 rows updated, the requester was no longer the owner — return 409 Conflict.
Never separate the "check if owner" query from the "update roles" write into two independent
async calls. Additionally: reject the transfer if `targetId` is not a current active team member
(not just any user ID), preventing transfer to an arbitrary user ID.

**Warning signs:**
- Ownership check (`project.userId === userId`) is a separate query before the UPDATE
- No `.transaction()` wrapping the role swap
- No `changes()` verification after the UPDATE
- No check that the target user is an active member of the same account

**Phase to address:**
Multi-user / team accounts phase — specifically the ownership transfer endpoint.

---

### Pitfall 8: Ownership Transfer Privilege Escalation — Owner Removes Themselves First

**What goes wrong:**
If the transfer endpoint allows any user (not just the current owner) to initiate it, a regular
member can transfer ownership to themselves. Alternatively, if the owner initiates a transfer and
the system processes the "demote requester to member" step before confirming the target accepts,
the original owner is now a member with no owner in the system — a privilege orphan state. A
related attack: the owner calls the transfer endpoint then, before the target confirms, also
calls the remove-member endpoint to remove the target, leaving themselves as a member of an
ownerless account.

**Why it happens:**
The flat model has no concept of "pending transfer" — the transfer is assumed to be instantaneous
and mutual. In a 2-user model, the target is always known. But the absence of a confirmation step
means the state change is unilateral and immediate.

**How to avoid:**
In the flat 2-user model (MT-04), the transfer is direct: the owner clicks "Transfer ownership
to [member name]" and the swap is atomic. No confirmation flow is needed because the target is
always the only other active member. The key constraint: validate that the account has exactly 2
active users before processing the transfer. If the account has only 1 user (the owner alone),
reject the transfer — there is no valid target. After the transfer, emit a server-side log entry
with `{from: originalOwnerId, to: newOwnerId, timestamp, requestIp}` for audit purposes.

**Warning signs:**
- Transfer endpoint does not verify the requester is the current owner (not just any authenticated user)
- No check that the target user is an active member of the same account (not an arbitrary user ID)
- Transfer proceeds when account has only 1 user

**Phase to address:**
Multi-user / team accounts phase — ownership transfer endpoint, alongside Pitfall 7.

---

### Pitfall 9: Rate Snapshot Corruption During CSV Import — Silent Compliance Failure

**What goes wrong:**
QuickBooks and ADP CSV exports contain pay rate columns ("Regular Pay Rate," "Hourly Rate,"
"Base Pay," "Reg Pay Rate" — naming varies by version and locale). If the import logic maps this
column to `baseRateSnapshot` or `fringeRateSnapshot` in `payroll_entries`, the WH-347 shows the
wrong rate. The compliance engine (`under-wage` check) fires based on `baseRateSnapshot` vs. the
WD rate. If the snapshot is set to the imported payroll rate, the compliance engine may not fire
violations even when the worker was paid below prevailing wage.

This is the most serious data integrity failure possible in this system. The WH-347 is a legally
required certified document — corruption of the rate data is a compliance failure, not a software
bug.

**Why it happens:**
The natural approach to CSV import is to map CSV columns to database columns. An implementer sees
a "Rate" column and maps it to `rateSnapshot` by name. The fact that snapshots must come from the
wage determination cache (not from the payroll provider) is a compliance constraint invisible
from the schema alone.

**How to avoid:**
The import logic must never accept rate data from the CSV as the snapshot value. The import flow:
(1) parse CSV to extract worker name and hours only; (2) match each worker to existing `workers`
and `workerClassifications` records; (3) fetch `baseRateSnapshot` and `fringeRateSnapshot` from
the WD cache via `getCachedClassifications()` exactly as the manual payroll entry UI does;
(4) write entries with WD-sourced snapshots only. The CSV pay rate may be stored in a separate
`importedRate` column for audit trail purposes, but must never become the compliance snapshot.
Enforce this at the service layer: the import service function signature does not accept a
`baseRateSnapshot` parameter — it derives the value internally from the WD cache.

**Warning signs:**
- Import code that reads any rate column from the CSV
- `baseRateSnapshot` values in imported entries that differ from `getCachedClassifications()`
  output for the same trade code
- No compliance violations firing on imported payroll weeks when violations would be expected

**Phase to address:**
Payroll import phase — the snapshot sourcing rule must be the first design constraint, before
any CSV parsing logic is written.

---

### Pitfall 10: CSV Column Name Variation Crashes or Silently Skips Data

**What goes wrong:**
QuickBooks Online and QuickBooks Desktop produce different column names for the same field.
QBO uses "Employee Name," QBD uses "Name." QBO uses "Reg Hours," older QBD versions use
"Regular Hours." ADP exports vary by module: ADP Workforce Now produces "Reg Hours" and "O/T Hrs"
as separate columns; ADP Run produces a single "Hours" column with a "Pay Type" column
distinguishing regular from overtime. ADP exports by cost center, not by job — one file may span
multiple projects, and ADP separates regular hours, OT hours, and DT hours into different rows
per employee rather than different columns.

An import parser that hardcodes column indices or exact header strings will silently skip all
rows when the header does not match, producing a "0 rows imported" result with no error. Or it
will import partial data (hours but not worker names) when some columns match and others do not.

**Why it happens:**
Developers test the import feature using one export from their own QBO or ADP trial account.
That one file works. Real contractors use different QBO versions (QBO, QBD 2019, QBD 2024),
different ADP plans (Run, Workforce Now, TotalSource), and different locale settings (commas
as decimal separators in European locales). None of these variations are visible until the first
real user attempts an import.

**How to avoid:**
Never hardcode column indices or header strings. Build a column mapping UI: parse the CSV header
row, display the discovered column names to the user, ask the user to assign each required field
(worker name → which column?, ST hours → which column?, OT hours → which column?). Save the
mapping as a named profile so the user only maps once per payroll provider. For ADP's row-per-
pay-type format, the parser must first detect whether the file uses column-per-type or row-per-
type layout by inspecting the header and first data rows.

For encoding: normalize all CSV input to UTF-8 before parsing. Use `iconv-lite` to detect and
transcode from Windows-1252 (the default ADP export encoding on Windows) or UTF-16 (Excel on
macOS). QuickBooks Desktop exports are typically UTF-8 but may include a BOM (byte order mark)
at byte 0 — strip the BOM before splitting on commas. A file with a BOM parsed without stripping
produces `"\ufeffEmployee Name"` as the first column header, which matches no expected string.

**Warning signs:**
- Import parser uses `row[0]`, `row[1]` etc. (column index) rather than header-based lookup
- Column headers matched with `===` instead of case-insensitive trim comparison
- No encoding normalization step before parsing
- Import shows "0 rows imported" with no error message on a valid file

**Phase to address:**
Payroll import phase — column mapping UI must be a first-class feature of the import flow, not
an afterthought.

---

### Pitfall 11: Partial Import Leaving Inconsistent Payroll State

**What goes wrong:**
A CSV import for a 15-worker week is processed row by row. Rows 1–10 are written to
`payroll_entries` successfully. Row 11 fails (worker not matched, rate lookup fails, constraint
violation). Rows 12–15 are never attempted. The payroll week now has entries for 10 workers but
not the other 5. The compliance engine runs, sees 10 workers, reports clean. The WH-347 is
generated with 10 workers. Rows 12–15 are permanently missing from the certified payroll record.
This is a legal compliance failure — the WH-347 must account for all workers on the job.

**Why it happens:**
Row-by-row writes outside a transaction are the naive implementation. The error on row 11 is
caught and logged, but because earlier rows were already committed, they cannot be rolled back.

**Why it is specific to this system:**
The existing `payrollEntries` table has `UNIQUE(payroll_week_id, worker_id, classification_id)`.
A re-import after a partial import does not re-create the missing entries — it hits the unique
constraint on the 10 already-imported rows and either errors or skips them. The 5 missing rows
may still be missing after the re-import, depending on error handling.

**How to avoid:**
Wrap the entire import batch in a single Drizzle `.transaction()` call. If any row fails, the
transaction rolls back and zero rows are written. Show the user a clear error identifying which
rows failed and why. The user fixes the issue and re-imports. The database is either fully
updated or fully unchanged — never partially updated.

Important caveat for Drizzle + better-sqlite3: as of 2024, Drizzle's async transaction API has
known issues with synchronous SQLite drivers. Use the synchronous `db.transaction((tx) => { ... })`
callback form (not async/await) to guarantee rollback behavior. Do not use `await db.transaction`
with better-sqlite3 — the rollback may not fire.

**Warning signs:**
- Import loop iterating rows with `try/catch` per row and `continue` on error
- No `.transaction()` wrapping the entire batch write
- Re-import after partial failure succeeds on 0 rows without error (unique constraint silently
  swallows re-inserts of already-imported rows)

**Phase to address:**
Payroll import phase — transaction design before any insert logic is written.

---

### Pitfall 12: Duplicate payroll_entries on Re-Import — Silent Overwrite or Hard Crash

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
"updated" entries (e.g., `monSt: 8.0 → 9.5`); (4) require explicit user confirmation before
writing. For entries that already exist and the CSV has different hours, show the delta.
If the payroll week has `submittedAt` set, block import entirely — submitted weeks are immutable.

**Warning signs:**
- Import code using `INSERT OR IGNORE`, `INSERT OR REPLACE`, or `ON CONFLICT DO NOTHING`
- No preview step before writing import data
- Import logic not checking `payrollWeeks.submittedAt` before writing

**Phase to address:**
Payroll import phase — the preview-commit pattern must be designed before any CSV parsing.

---

### Pitfall 13: SSN Encryption Key Loss — Permanent and Unrecoverable Data Loss

**What goes wrong:**
The encrypted SSN column is added to `workers`. The AES-256 key is stored as a Render.com
environment variable (`ENCRYPTION_KEY`). An operator rotates the env var (treating it like an
API key), the service redeploys with the new key, and every SSN in the database is permanently
unreadable. CA eCPR and WA portal pre-fill break. If a compliance audit requests full SSNs,
the system cannot produce them. There is no recovery path — AES-256 ciphertext without the key
is irreversible.

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
decrypt with `ENCRYPTION_KEY_V1`, re-encrypt with `ENCRYPTION_KEY_V2`, write `v2` envelope.
(4) Add a startup assertion: if the current active key version is missing or fails to decrypt a
known test vector, throw and refuse to start. (5) Write the key rotation runbook in the
repository before shipping the encryption feature.

**Warning signs:**
- `ssnEncrypted` column stores only raw base64 ciphertext with no key version metadata
- Application starts normally when `ENCRYPTION_KEY` env var is missing
- No re-encryption script exists when a new key version is introduced

**Phase to address:**
SSN encryption phase — key versioning schema and rotation runbook must be designed before the
first migration is written.

---

### Pitfall 14: IV Reuse in AES-256-CBC — Structural Cryptographic Weakness

**What goes wrong:**
If the encryption implementation uses AES-256-CBC with a static IV (hardcoded, derived from
worker ID, or derived from a timestamp with second granularity), encrypting two workers with the
same SSN produces identical ciphertext. An attacker with read access to the database can
immediately identify workers who share SSNs. With enough known-plaintext pairs, CBC with a
static IV leaks the key. This is a PII standards compliance failure and a legal liability.

**Why it happens:**
The majority of AES-256-CBC code examples on the internet use a hardcoded IV for demonstration
clarity. Developers copy these examples. The mistake is invisible in testing because decryption
works correctly with a static IV — the failure is cryptographic, not functional.

**How to avoid:**
Use AES-256-GCM, not CBC. GCM is authenticated encryption: it provides confidentiality and
integrity. A corrupted or tampered ciphertext is detected at decrypt time (authentication tag
mismatch) rather than silently returning garbled data. Generate a fresh 12-byte random nonce
(IV) for every encryption call: `crypto.randomBytes(12)`. Store `{iv, authTag, ciphertext}` in
the JSON envelope (see Pitfall 13). Never derive the IV from any deterministic input.
Implementation: `crypto.createCipheriv('aes-256-gcm', keyBuffer, iv)` — use the 32-byte key
directly from `Buffer.from(process.env.ENCRYPTION_KEY_V1, 'hex')`. Key must be exactly 32 bytes.

**Warning signs:**
- Any use of `aes-256-cbc` in encryption code
- IV generated from `worker.id`, `Date.now()`, or any source other than `crypto.randomBytes(12)`
- Missing `authTag` in the stored envelope (GCM without the auth tag is not authenticated)

**Phase to address:**
SSN encryption phase — must be reviewed before the first encrypted value is written to any
environment.

---

### Pitfall 15: Encrypting the ssnLast4 Field — Breaking Existing Compliance Logic

**What goes wrong:**
v3.0 adds a new `ssnEncrypted` column for full SSN storage. The existing `ssnLast4` column is
used by the compliance history engine (`getWorkerComplianceHistory`) to match the same worker
across projects via `(name, ssnLast4)` identity. If the migration encrypts `ssnLast4` in-place
(replacing its plaintext value with a ciphertext blob), the compliance history cross-project
matching breaks immediately — ciphertext cannot be compared across rows unless the same
deterministic encryption scheme is used, and deterministic encryption is weaker than randomized
IV encryption. Additionally, `ssnLast4` appears in the WH-347 PDF as `XXX-XX-1234` — feeding
ciphertext to `fillWh347()` produces garbage on the PDF.

**Why it happens:**
SEC-01 says "existing `ssn_last4` plain-text values are encrypted in the migration" — this can
be misread as "encrypt the existing `ssnLast4` column." The correct interpretation is that the
migration adds a new `ssnEncrypted` column for full SSN, and `ssnLast4` continues as-is (or is
derived from the decrypted full SSN going forward).

**How to avoid:**
Keep `workers.ssnLast4` as plaintext — last 4 digits are not considered sensitive PII under
most standards (they are used publicly on WH-347 forms filed with federal agencies). Add a
separate `workers.ssnEncrypted` column for the full 9-digit SSN using the JSON envelope format.
Do not modify `ssnLast4` in any migration. When a full SSN is provided by the user, derive
`ssnLast4` from it server-side and store both. The SEC-01 migration adds the `ssnEncrypted`
column; it does not touch `ssnLast4`.

**Warning signs:**
- Migration that modifies the `ssnLast4` column or changes its data type
- Any encryption function called on a 4-character string
- Compliance history query returning no cross-project matches after the encryption migration

**Phase to address:**
SSN encryption phase — migration design, specifically the column addition vs. column replacement
distinction.

---

### Pitfall 16: Agency Portal Auto-Submit Sets submittedAt Before Portal Confirms

**What goes wrong:**
CA DIR eCPR and WA PWIA portal submissions involve multiple steps: authenticate, build request,
POST data, receive confirmation. If `payrollWeeks.submittedAt` is set optimistically (before the
portal returns a confirmed success), and the POST then fails (session expired, network timeout,
portal validation error), the local record shows the week as submitted while the portal has no
record of it. The app's existing edit lock (`assertWeekNotSubmitted`) will then block all further
edits to that week. The week is stuck: locally "submitted," remotely missing.

Additionally: CA DIR eCPR portal has a documented pattern of accepting uploads and then silently
marking them as "drafts" rather than processing them. The upload POST returns HTTP 200 but the
submission is not actually finalized.

**Why it happens:**
Setting `submittedAt` optimistically before waiting for a confirmed response is a natural
simplification — it avoids a two-step async flow. The CA DIR portal's "returns 200 but marks as
draft" behavior is undocumented and would only be discovered by a developer who monitored the
portal after upload.

**How to avoid:**
(1) Never set `submittedAt` until the portal returns a confirmed non-draft success. (2) Add a
`portal_submission_attempts` table: `id`, `payrollWeekId`, `portal` (ca-dir | wa-lni), `status`
(pending | success | failed | draft-stuck), `startedAt`, `completedAt`, `errorMessage`,
`portalResponse` (text). (3) Only set `payrollWeeks.submittedAt` after writing a `success` record.
(4) For CA DIR: after upload, poll the portal's project history endpoint to confirm the week
appears as "submitted" (not "draft"). (5) For session expiry: detect 401 or redirect responses
mid-submission and re-authenticate before retrying.

**Warning signs:**
- Any code path that calls `updateWeekSubmission()` before receiving portal confirmation
- No `portal_submission_attempts` table or equivalent status tracking
- No re-authentication logic in the portal submission service

**Phase to address:**
Agency portal auto-submit phase — submission state machine must be designed before any portal
HTTP client code is written.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep `project.userId !== req.user.userId` checks inline, add membership check "later" | Faster to ship team invite without refactoring all routes | Every missed route is a live IDOR vulnerability | Never — must be centralized before any multi-user data is live |
| Store IV and ciphertext as separate columns rather than JSON envelope | Slightly simpler initial schema | Cannot add key version without another migration; rotation runbook becomes complex | Never for new encryption — envelope from day one |
| Import CSV pay rates directly into snapshot columns | Faster import implementation | WH-347 and compliance checks silently use wrong rates; undetectable until DOL audit | Never for certified payroll data |
| Set `submittedAt` optimistically before portal confirms | Simpler single-step code path | Week becomes permanently locked while portal has no record; requires direct DB edit to recover | Never |
| Skip import preview step | Less UI to build | Silent overwrites; user cannot catch mapping errors before data is corrupted | Never for payroll data |
| Use a single `ENCRYPTION_KEY` env var with no versioning | Simple initial implementation | Key rotation destroys all existing encrypted data — unrecoverable | Never if key rotation is anticipated |
| Embed team membership list in JWT payload | Avoids DB query on each request | Stale membership: removed user retains access until token expiry | Never — membership must be DB-resolved per request |
| Hardcode CSV column names in the import parser | Fast to build | Breaks on QBO vs QBD vs ADP format differences; user gets silent 0-row import | Never — use mapping UI |
| Plain string comparison for invite token | One line of code vs. three | Timing attack enables token recovery by measuring response times | Never for any secret comparison |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| QuickBooks Online CSV | Column headers differ from QBD: "Employee Name" vs. "Name," "Reg Hours" vs. "Regular Hours" | Build a column mapping UI; discover headers dynamically; never hardcode expected strings |
| QuickBooks Desktop | Exports include BOM (byte order mark) at byte 0, producing `\ufeffEmployee Name` as first header | Strip UTF-8 BOM before splitting on commas: `content.replace(/^\uFEFF/, '')` |
| ADP Workforce Now | Exports by cost center, not by project — one file spans multiple projects | Add a project filter step in the import UI; warn when workers do not match any existing project worker |
| ADP (all versions) | Separates regular, OT, and DT hours into different rows per employee (not columns) | Parser must group rows by employee name/ID and map row `Pay Type` to the correct hour bucket |
| ADP (Windows export) | Default encoding is Windows-1252, not UTF-8 — accented characters in worker names render as garbage | Use `iconv-lite` to detect and transcode; always normalize to UTF-8 before parsing |
| CA DIR eCPR portal | Treating HTTP 200 upload response as confirmed submission | CA DIR portal returns 200 but marks as "draft" — poll portal history to confirm "submitted" status |
| WA L&I PWIA | Conflating weekly CPR XML submission with Affidavit of Wages Paid | Affidavit is a separate post-project filing; do not mark project complete after weekly submissions |
| Render.com env vars | Changing `ENCRYPTION_KEY` in Render dashboard and assuming it takes effect on running instance | Env var changes require a redeploy; verify decryption works in staging before touching production |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `GET /api/projects` changes from `WHERE userId=X` to membership JOIN with no index on `project_members(user_id)` | Dashboard load latency increases; SQLite serializes all requests | Add `CREATE INDEX idx_project_members_user_id ON project_members(user_id)` in the migration that creates the table | With 3+ concurrent team members loading the dashboard |
| CSV import parsed and written row-by-row outside a transaction | Import POST times out at Render's 30-second HTTP timeout; partial data remains | Wrap entire batch in a single `.transaction()` call (synchronous form for better-sqlite3); parse all rows in memory first | Any import with more than ~50 rows |
| Compliance batch endpoint re-queries membership per project after `project_members` is added | N+1 membership query resurfaces for team members who see more projects | Membership query must be a single JOIN, not a per-project loop | With 10+ projects visible to a team member |
| SQLite write serialization under concurrent team use | Import + manual payroll entry + SSN update queue behind the same write lock | Enable WAL mode: `PRAGMA journal_mode=WAL` in `getDb()` — allows reads to proceed concurrently with writes | With 2+ concurrent write operations |
| Re-encrypting all SSNs during key rotation in the same process as the running server | Server unavailable during migration; if killed mid-migration, some rows use new key, others old key | Run key rotation as a standalone script outside the server process; the JSON envelope `v` field allows mixed-version rows to coexist safely | Any rotation on a database with more than ~200 workers |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing key version, IV, and ciphertext as separate columns | Schema leaks crypto structure; increases attack surface | Store as single JSON blob: `{"v":"1","iv":"<hex>","tag":"<hex>","ct":"<hex>"}` |
| Logging decrypted SSN values in Express request/response logs | Full SSNs appear in Render.com log stream | Ensure no SSN field reaches the logger; log `"ssn":"[REDACTED]"` in any request body middleware |
| Returning full decrypted SSN over the API to the React client for display | Full SSN exposed in browser memory, React Query cache, and DevTools network tab | Return only `ssnMasked: "***-**-1234"` for display; decrypt full SSN server-side at XML export time only |
| Embedding team membership in JWT payload to avoid DB lookup | Membership changes (user removed) not reflected until JWT expiry | Resolve membership from DB on every request using only the `userId` from the JWT |
| Storing invite tokens as plaintext in the DB | Anyone with DB read access can generate valid invite links | Hash tokens with SHA-256 before storing; compare hashes at acceptance time; expire after 7 days |
| CSV import staging table persists full SSNs from the CSV | Full SSNs sit unencrypted in a staging table long after import completes | Treat CSV SSN as ephemeral: read → encrypt immediately → write envelope → discard plaintext; never log |
| Plain `===` comparison for invite tokens in the acceptance route | Timing attack enables token enumeration | Use `crypto.timingSafeEqual(sha256(stored), sha256(submitted))` — hashes must match in constant time |
| Invite token with no rate limiting on the acceptance endpoint | Brute-force attack against short tokens | Rate-limit `/api/invites/:token/accept` to 5 attempts per IP per hour; return HTTP 404 (not 403) for invalid tokens |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| CSV import maps columns automatically and writes data without a preview | User discovers corrupt rate snapshots after printing WH-347 for an auditor | Show a preview table with column mapping annotations and hours total; require explicit confirmation before writing |
| Team invite is the only recovery path if the invite email is lost | Admin cannot re-invite without invalidating the original token | Allow re-sending an invite; generate a new token, invalidate all previous tokens for that email address |
| No indication of which team member entered or modified a payroll entry | Audit trail is anonymous; GC cannot identify who entered erroneous data during a DOL audit | Add `createdByUserId` and `updatedByUserId` to `payroll_entries` from the start of v3.0; retrofitting leaves null on existing rows |
| Portal auto-submit status not visible on the payroll week detail page | User re-submits manually after auto-submit already completed, creating duplicate portal records | Add a `submissionAttempt` status badge alongside the `submittedAt` indicator |
| Import silently skips workers that could not be matched to existing records | Payroll week appears complete but is missing workers | Show an "unmatched workers" list in the import preview; block import completion until the user resolves each unmatched row |
| Ownership transfer happens without any confirmation step | Owner accidentally transfers ownership; no undo path | Require the owner to type the target user's email to confirm the transfer |

---

## "Looks Done But Isn't" Checklist

- [ ] **Multi-user ownership:** `project.userId !== req.user.userId` still exists in route files
  after adding `project_members` — verify: `grep -r "\.userId !== " src/server/routes/`
- [ ] **Multi-user list endpoint:** `GET /api/projects` still filters by `projects.userId` alone
  rather than by membership — verify the query returns only team-visible projects for each user
- [ ] **Invite token entropy:** Token generated with fewer than 16 random bytes — verify that
  `crypto.randomBytes(32)` is used and the stored value is the SHA-256 hash, not the raw token
- [ ] **Invite token timing safety:** Token comparison uses `===` not `crypto.timingSafeEqual` —
  verify the acceptance handler compares SHA-256 hashes using `timingSafeEqual`
- [ ] **Invite expiry enforced:** Acceptance handler does not check `expiresAt` — verify expired
  tokens return HTTP 410, not HTTP 200 or HTTP 404
- [ ] **Invite deleted after acceptance:** Token row remains in the DB after successful registration
  — verify the DB row is deleted (or moved to audit log) within the same transaction as user creation
- [ ] **Ownership transfer atomic:** Transfer implementation separates "check if owner" from "update
  roles" into two async calls — verify a single `.transaction()` wraps both role updates
- [ ] **SSN encryption health check:** Application starts and returns 200 when `ENCRYPTION_KEY_V1`
  env var is missing — verify startup asserts key presence and fails fast
- [ ] **Rate snapshot integrity on import:** Imported `payroll_entries` have `baseRateSnapshot`
  values sourced from the CSV rather than from `getCachedClassifications()` — verify by
  comparing a sample imported entry against WD cache output for the same trade code
- [ ] **Submitted week protection on import:** Import flow does not check `payrollWeeks.submittedAt`
  — verify that importing into a submitted week returns 400, not a silent overwrite
- [ ] **Import transaction rollback:** A simulated row-11 failure leaves 10 entries in the DB —
  verify the entire batch rolls back cleanly using the synchronous `.transaction()` form
- [ ] **IV uniqueness per encryption call:** Encrypt the same SSN 100 times and assert all 100 IV
  values are unique and all 100 ciphertexts differ
- [ ] **Key version in stored envelope:** The `ssnEncrypted` column value parses to a JSON object
  with a `v` field — verify by inspecting a raw DB row after encryption
- [ ] **ssnLast4 unchanged after migration:** The migration adds `ssnEncrypted` but does not
  modify `ssnLast4` — verify compliance history cross-project matching still works post-migration
- [ ] **submittedAt not set until portal confirms:** Simulate a portal timeout mid-submission and
  assert `payrollWeeks.submittedAt` is still null afterward
- [ ] **Audit trail columns present:** `payroll_entries` has `createdByUserId` NOT NULL in the
  v3.0 migration — verify the column exists with a default for existing rows

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Cross-tenant data leak discovered post-launch | HIGH | Audit access logs for cross-tenant requests; notify affected users; patch ownership checks; invalidate all JWTs to force re-login |
| Rate snapshot corruption from CSV import | HIGH | Identify affected entries using an `importBatchId` column (add before shipping import); delete corrupt entries; re-run import with correct snapshot logic; regenerate all WH-347 forms for affected weeks |
| SSN encryption key lost with no backup | CRITICAL / UNRECOVERABLE | If no old key version exists anywhere, encrypted SSNs cannot be recovered; users must re-enter full SSNs manually; add key backup and rotation runbook before this happens |
| Portal partial submission (session expired mid-submission) | MEDIUM | Query portal for which workers were received; submit only missing workers; do not re-submit already-received records |
| `submittedAt` set optimistically, portal has no record | MEDIUM | Requires direct DB update to clear `submittedAt` (no UI path since edit lock fires); add an admin "un-submit" endpoint; then re-submit correctly |
| Invite token enumeration attack | MEDIUM | Rotate all active invite tokens; add rate limiting and 404 responses immediately; audit for any accounts created via enumerated tokens |
| Ownership transfer left account ownerless | LOW | Requires direct DB update to set a `role = 'owner'` on one user; add an admin recovery endpoint before shipping ownership transfer |
| Partial import inconsistent state | LOW | If `importBatchId` exists, delete the partial batch; if not, manually identify and delete the partial entries; re-run import with transaction wrapping |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| IDOR auth bypass after project_members | Multi-user (first task) | Cross-tenant test suite: two users, two projects, all protected endpoints assert 403 for wrong user |
| Indirect object reference on child entities | Multi-user (simultaneous with IDOR fix) | Grep: no direct child entity query without `assertProjectAccess`; integration test |
| Invite token enumeration | Multi-user (token generation design) | Unit test: 1000 tokens generated, all unique, all ≥ 64 hex chars; rate limit integration test |
| Invite token timing attack | Multi-user (token validation handler) | Code review: no `===` on token strings; `timingSafeEqual` present and tested |
| Invite token reuse after acceptance | Multi-user (acceptance handler transaction) | Test: re-submit accepted token; assert 404 or 410; DB row must not exist post-acceptance |
| Invite token no expiry | Multi-user (schema design) | Functional test: create token, advance clock 8 days, attempt acceptance, assert 410 |
| Ownership transfer race condition | Multi-user (transfer endpoint) | Concurrent request test: two simultaneous transfer requests; assert exactly one succeeds, roles are consistent, no ownerless state |
| Ownership transfer privilege escalation | Multi-user (transfer endpoint) | Test: regular member calls transfer endpoint; assert 403; owner with no member calls transfer; assert 400 |
| Rate snapshot corruption on import | Payroll import (first design constraint) | Automated test: import CSV, compare all `baseRateSnapshot` values against `getCachedClassifications`; assert no CSV rate column was used |
| CSV column name variation | Payroll import (mapping UI) | Test with QBO, QBD, and ADP Workforce Now exports; all produce correct row counts |
| CSV encoding (Windows-1252, BOM) | Payroll import (parser) | Test with BOM-prefixed file and Windows-1252 file; assert no garbled characters in worker names |
| Partial import inconsistent state | Payroll import (transaction design) | Inject failure at row 11 of 15; assert DB has 0 new entries (full rollback) |
| Duplicate entries on re-import | Payroll import | Test: import same CSV twice; second import shows preview with "already exists" for all rows; DB has no duplicates |
| SSN encryption key loss | SSN encryption (key versioning schema before migration) | Key rotation drill in staging: generate new key, run re-encryption script, verify all SSNs decrypt with new key |
| IV reuse / CBC mode | SSN encryption (implementation review before any data written) | Unit test: encrypt same SSN 100 times; all 100 IVs unique; all 100 ciphertexts unique; auth tags present |
| ssnLast4 encrypted in-place | SSN encryption (migration design) | After migration: compliance history cross-project matching returns same results as pre-migration |
| Portal submittedAt set before confirm | Agency portal auto-submit (state machine design) | Integration test with mocked portal that times out; assert `submittedAt` is null; `submissionAttempt` shows `failed` |
| createdByUserId missing from audit trail | Multi-user (migration design) | Schema check: `payroll_entries` migration adds `createdByUserId` NOT NULL with DEFAULT |

---

## Integration Pitfalls Between Features

These pitfalls arise from combining two or more v3.0 features. Neither feature alone causes them.

### Import + Multi-user: Imported Entries Have No Author

When a team member imports a CSV, the resulting `payroll_entries` have no `createdByUserId` if
that column does not exist yet. In a DOL audit, the GC may need to identify who entered which
payroll records and when. If audit columns are retrofitted after import is shipped, all existing
imported entries have null `createdByUserId` — indistinguishable from manually entered entries.
Design `createdByUserId` and `updatedByUserId` into `payroll_entries` and `payrollWeeks` from
the start of v3.0, not as a follow-up migration.

### Encryption + WH-347 Export: Full SSN Must Never Reach the PDF Generator

WH-347 currently uses `workers.ssnLast4`. v3.0 adds `workers.ssnEncrypted`. The WH-347 PDF
generator (`fillWh347()`) must continue using only the last 4 digits — DOL format shows only
`XXX-XX-1234`. If a developer passes the full decrypted SSN through `fillWh347()` "for
convenience" (because it is now available), the full SSN appears on every downloaded WH-347,
which is a PII exposure on a document filed publicly with federal agencies.

Prevention: `fillWh347()` function signature accepts only `ssnLast4: string`. The SSN decryption
path exists only in `caEcprExport` and `waPwiaExport`. Add a test that asserts WH-347 PDF bytes
do not contain any sequence matching `\d{9}` (a 9-digit SSN).

### Import + Encryption: CSV Full SSN Is Ephemeral — Never Stage It

QuickBooks and ADP exports sometimes include full SSNs in the worker row. If the import stores
this in a plaintext staging table or logs it during processing, the full SSN sits unencrypted in
the database or log stream. The import pipeline must treat any full SSN from CSV as ephemeral:
read from CSV → pass directly to the encrypt function → write the envelope → discard the
plaintext string. The raw SSN string must never be assigned to a variable that outlives the
encryption call, logged, or written to any column other than `ssnEncrypted`.

### Multi-user + Compliance History: Cross-Project Identity Becomes Ambiguous

The current per-worker compliance history uses `(name, ssnLast4)` identity to aggregate
violations across projects. In a team account, two team members may independently add the same
physical worker on different projects, creating two `workers` records. The compliance history page
shows separate violation histories for the same physical person — misleading GCs who believe a
worker has a clean history when they actually have violations on a different project record.
The v3.0 migration to full encrypted SSN enables proper deduplication. Plan the cross-project
identity query to use decrypted SSN matching when the user requests it, with an explicit privacy
notice in the UI. Do not enable automatic deduplication by default — the user must opt in.

---

## Sources

- Source code analysis: `src/server/routes/projects.ts` (ownership pattern — `project.userId !== userId` at 19 call sites across 6 route files), `src/server/routes/workers.ts` (indirect reference pattern — workers queried by ID without parent chain traversal), `src/server/db/schema.ts` (data model — no `project_members` table, no `ssnEncrypted` column, no `createdByUserId`, no `invites` table), `src/server/middleware/auth.ts` (JWT payload contains only `userId` and `email`)
- SQLite WAL mode and write concurrency: [SQLite Write-Ahead Logging documentation](https://www.sqlite.org/wal.html)
- AES-256-GCM nonce requirements and GCM vs CBC: [Node.js crypto documentation](https://nodejs.org/api/crypto.html)
- Timing attacks in Node.js and `crypto.timingSafeEqual`: [Timing Attacks in Node.js — DEV Community](https://dev.to/silentwatcher_95/timing-attacks-in-nodejs-4pmb)
- Secure random tokens with `crypto.randomBytes`: [Node.js crypto.randomBytes() — TheLinuxCode](https://thelinuxcode.com/nodejs-cryptorandombytes-secure-random-tokens-salts-and-key-material-in-real-projects/)
- Invite token best practices: [Node.js Auth Security Best Practices 2026 — Authgear](https://www.authgear.com/post/nodejs-security-best-practices)
- OWASP Node.js authentication and cryptography practices: [OWASP Node.js Security Practices](https://www.nodejs-security.com/blog/owasp-nodejs-authentication-authorization-cryptography-practices)
- Privilege escalation via ownership transfer pattern: [AVideo CVE-2026-33650 — GitLab Advisory Database](https://advisories.gitlab.com/pkg/composer/wwbn/avideo/CVE-2026-33650/)
- Race conditions and auth bypass patterns: [Auth Bypasses: Logic Flaws, Race Conditions, and Deserialization — Medium](https://medium.com/@Tenebris_Venator/auth-bypasses-logic-flaws-race-conditions-and-deserialization-what-you-need-to-know-d1efddc16eb5)
- Drizzle ORM SQLite transactions and rollback issues: [Drizzle ORM Transactions documentation](https://orm.drizzle.team/docs/transactions); [Async transactions bug — Issue #2275](https://github.com/drizzle-team/drizzle-orm/issues/2275)
- QuickBooks CSV column naming and encoding: [How to Export Payroll Data from QuickBooks Online — DancingNumbers](https://www.dancingnumbers.com/export-payroll-data-from-quickbooks-online/); [QBO CSV import errors — EasyBankConvert](https://www.easybankconvert.com/guides/quickbooks-import-errors-fix)
- ADP Workforce Now export format: [ADP Workforce Now Payroll Export — 7shifts KB](https://kb.7shifts.com/hc/en-us/articles/4417520074387-ADP-Workforce-Now-US-Payroll-Export)
- CA DIR eCPR portal reliability issues: [DIR Update on Public Works Website Issues](https://thewpcca.com/dir-update-on-public-works-website-issues/)
- WA L&I PWIA system overview: [L&I PWIA Step-by-Step Instructions](https://lni.wa.gov/licensing-permits/_docs/pwia-step-by-step-instructions.pdf)
- Multi-tenant cross-tenant leak prevention: [Preventing Cross-Tenant Data Leakage in Multi-Tenant SaaS — AgNite Studio](https://agnitestudio.com/blog/preventing-cross-tenant-leakage/)

---
*Pitfalls research for: HCC Prevailing Wage v3.0 — Team & Integration milestone*
*Researched: 2026-03-27*
