# Architecture Research

**Domain:** Multi-user team + payroll import + SSN encryption + agency auto-submit, integrated into existing SQLite/Express/React prevailing-wage app
**Researched:** 2026-03-27
**Confidence:** HIGH (decisions grounded in existing schema + confirmed agency portal constraints)

---

## Existing Architecture Baseline

The current system structure (v2.5):

```
React SPA (Vite + TailwindCSS v4)
  └── React Query (server state)
  └── Protected/Public routing

Express REST API (TypeScript)
  └── JWT httpOnly cookie auth
  └── Route guards: userId match on every resource
  └── Service layer (pdf-lib, xmlbuilder2, compliance engine)

SQLite (Drizzle ORM)
  └── Persistent disk on Render.com (/var/data)
  └── Add-only migrations (never drop columns)
  └── Single owner model: projects.userId = the one user
```

Every project is owned by exactly one `userId`. All routes guard via
`WHERE projects.user_id = :authUserId`. This is the central invariant
that v3.0 must extend without breaking.

---

## Feature 1: Multi-User Team Accounts

### Decision: `project_members` Join Table (NOT `organizations`)

**Recommendation: `project_members` join table.**

Rationale: The requirement is explicitly "flat model — all members see
all projects." There is no concept of an organization as a separate
entity with its own lifecycle, billing, settings, or sub-grouping.
An `organizations` table would introduce:

- A new top-level entity requiring its own CRUD, invite flows, settings
  pages, and owner-transfer logic
- A 3-table join on every project query (users -> organizations -> projects)
- Future migration complexity if org-level settings are ever added

`project_members` is simpler, fits the flat requirement exactly, and
maps cleanly onto the existing schema.

### New Table: `project_members`

```
project_members
  id           TEXT PK
  project_id   TEXT NOT NULL  -> projects.id  (no cascade -- explicit delete only)
  user_id      TEXT NOT NULL  -> users.id
  role         TEXT NOT NULL   ('owner' | 'member')
  invited_by   TEXT            -> users.id (nullable -- null for original owner)
  invited_at   TEXT NOT NULL
  accepted_at  TEXT            (null = pending invite)
  created_at   TEXT NOT NULL
  UNIQUE (project_id, user_id)
  INDEX on (project_id, user_id)  -- required for auth guard performance
```

**SQLite FK note:** SQLite does not enforce foreign keys by default.
Add `PRAGMA foreign_keys = ON` to the DB init if not already present.
Do NOT rely on `onDelete: 'cascade'` here; soft-delete semantics are
safer for audit trails on prevailing-wage data.

### New Columns on `users`

```
users
  invite_token      TEXT  (nullable; SHA-256 hashed; cleared after first use)
  invite_token_exp  TEXT  (nullable; ISO 8601 expiry -- 72 hours recommended)
```

Invite flow: owner triggers invite -> server generates token ->
email contains `/accept-invite?token=<raw>` -> server hashes and
compares -> creates `project_members` row + clears token.

### Authorization Change: From `userId` to Member Check

**Current guard pattern (every route):**

```typescript
const project = await db.query.projects.findFirst({
  where: eq(projects.userId, authUserId)
});
```

**New guard pattern:**

```typescript
// projects.userId still tracks the original creator (do not remove -- audit trail)
// Authorization now checks project_members
const membership = await db.query.projectMembers.findFirst({
  where: and(
    eq(projectMembers.projectId, projectId),
    eq(projectMembers.userId, authUserId),
    isNotNull(projectMembers.acceptedAt)
  )
});
if (!membership) throw new ForbiddenError();
```

This is a targeted change to authorization middleware only. The
`projects.userId` column stays as the original-owner record and is
never used for auth decisions in v3.0+.

### New vs Modified Components

| Component | Type | Change |
|-----------|------|--------|
| `project_members` table | New | Join table for flat team membership |
| `users.invite_token` + `users.invite_token_exp` | New columns | Support invite-by-email flow |
| authMiddleware / project route guards | Modified | Replace `userId` check with `projectMembers` lookup |
| `POST /projects/:id/invite` | New route | Owner sends email invite |
| `POST /invites/accept` | New route | Token exchange -> member row |
| `GET /projects/:id/members` | New route | List team for owner management |
| `DELETE /projects/:id/members/:userId` | New route | Owner removes member |
| `TeamSettingsPanel` (React) | New component | Invite form + member list on Project Detail |
| `InviteAcceptPage` (React) | New component | `/accept-invite` route handler |

---

## Feature 2: Payroll Provider Import (QuickBooks + ADP)

### Decision: Server-Side CSV Parsing

**Recommendation: Parse CSV on the server.**

Rationale:
- The mapping logic (CSV columns -> `payrollEntries` schema) is business
  logic -- it belongs in the service layer, not the browser
- Server-side parsing means the mapping rules are tested, versioned,
  and auditable
- Rate snapshots must be fetched at import time (same rule as
  `copyPayrollWeek`) -- this requires DB access, which only the server has
- The preview-then-commit pattern (already used by `copyPayrollWeek`)
  applies cleanly to imports

**Client responsibility:** File picker UI, preview of parsed rows
before commit (same UX pattern as copy-week modal).

### CSV Format Reality

Neither QuickBooks nor ADP has a single canonical export format.

**QuickBooks Desktop / QB Online:** Payroll Summary Report export.
Typical columns: Employee Name, SSN (sometimes masked), Pay Period
dates, Regular Hours, Overtime Hours, Gross Pay, deductions. Column
names vary by QB version and report type.

**ADP Workforce Now:** `PRcccEPI.csv` format. Columns include:
`Co Code`, `Batch ID`, `File #` (employee ID), `Reg Hours`, `O/T Hours`,
additional `Hours N Code` + `Hours N Amount` pairs for custom earning
codes. No daily breakdown -- weekly totals only.

**Implication:** The import cannot assume a fixed schema. The
architecture must be a two-step mapping pipeline:

```
Step 1: Auto-detect provider (column signature match)
Step 2: Map detected columns -> payrollEntry fields
        (unmappable columns flagged for manual review in preview)
```

### Mapping Gap: No Daily Breakdown

ADP and QuickBooks export weekly totals (Reg Hours, OT Hours) -- not
Mon/Tue/Wed/Thu/Fri/Sat/Sun breakdowns. The `payrollEntries` schema
stores daily ST/OT per the existing column layout.

**Resolution:** When importing, distribute weekly totals across
weekdays proportionally (default: equal split Mon-Fri for regular hours,
Fri bias for OT if total > 8). Flag in the preview UI that daily
distribution is estimated. User adjusts before committing. The audit
trail shows the user confirmed the import.

### New vs Modified Components

| Component | Type | Change |
|-----------|------|--------|
| `POST /projects/:id/payroll-weeks/:weekId/import` | New route | Accepts multipart CSV, returns preview |
| `POST /projects/:id/payroll-weeks/:weekId/import/commit` | New route | Commits previewed import to DB |
| `importService.ts` | New service | Provider detection, column mapping, preview generation |
| `qbMapper.ts` | New module | QuickBooks CSV -> `PayrollEntryImport[]` |
| `adpMapper.ts` | New module | ADP Workforce Now CSV -> `PayrollEntryImport[]` |
| `PayrollImportModal` (React) | New component | File upload -> preview table -> confirm commit |
| `payroll_imports` table | New | Audit log of import sessions |

### `payroll_imports` Audit Table

```
payroll_imports
  id           TEXT PK
  project_id   TEXT NOT NULL
  week_id      TEXT NOT NULL
  imported_by  TEXT NOT NULL  -> users.id
  provider     TEXT NOT NULL  ('quickbooks' | 'adp' | 'unknown')
  row_count    INTEGER NOT NULL
  skipped      INTEGER NOT NULL DEFAULT 0
  imported_at  TEXT NOT NULL
  raw_filename TEXT
```

Store the filename but not the raw CSV content -- raw files may
contain full SSNs that must not be persisted.

---

## Feature 3: SSN Encryption (AES-256)

### Decision: Service Layer Encryption, Env Var Key

**Recommendation: Encrypt/decrypt in the service layer. Store key in
environment variable.**

**Service layer vs DB layer:**
- SQLite has no native column-level encryption. DB-layer encryption
  requires SQLCipher -- a significant deployment change on Render.com
  persistent disk that risks breaking the existing Drizzle setup
- Service layer encryption is transparent to Drizzle ORM and requires
  no migration tooling changes
- The encrypt/decrypt functions use Node.js built-in `node:crypto` --
  zero new dependencies

**Env var vs KMS:**
- The app runs on Render.com with a small contractor user base. A KMS
  (AWS KMS, HashiCorp Vault) adds meaningful operational complexity and
  cost for marginal security gain at this scale
- Render.com environment variables are injected at runtime and are not
  stored in the codebase -- standard practice for this deployment tier
- KMS becomes the right answer at SOC 2 compliance scale; flag as a
  future milestone item

**Algorithm: AES-256-GCM** (not CBC). GCM provides authenticated
encryption -- it detects tampered ciphertext. CBC does not. Node.js
`node:crypto` supports GCM natively with no additional packages.

### Storage Pattern: Single Column, Concatenated Encoding

Do not store the IV as a separate column. Store `iv:authTag:ciphertext`
as a single concatenated hex string in one column.

```
workers
  ssn_encrypted  TEXT  (nullable; format: "<iv_hex>:<tag_hex>:<ciphertext_hex>")
  ssn_last4      TEXT  (keep as-is -- used for WH-347 display and
                        cross-project worker identity; not encrypted)
```

`ssn_last4` is NOT encrypted -- it is already non-identifying by
design and is used in the compliance engine's cross-project worker
identity matching.

### New vs Modified Components

| Component | Type | Change |
|-----------|------|--------|
| `workers.ssn_encrypted` column | New column | AES-256-GCM ciphertext of full SSN |
| `cryptoService.ts` | New service | `encryptSsn()` / `decryptSsn()` using `node:crypto` |
| `POST /workers` + `PATCH /workers/:id` | Modified routes | Accept `ssn` field, encrypt before DB write |
| CA eCPR XML export + WA PWIA XML export | Modified services | Decrypt SSN only at XML generation time |
| `AddWorkerForm` / `EditWorkerForm` (React) | Modified | Accept full SSN input (masked display) |
| `ENV: SSN_ENCRYPTION_KEY` | New env var | 32-byte hex string (256 bits) |

### Decrypt-on-Demand Policy

SSN is decrypted only at the moment it is written into a CA eCPR XML
export or WA PWIA XML. It is never included in API responses to the
client, never logged, and never included in any CSV export. This is
enforced in the service layer -- the React client never sees plaintext
SSN.

### Key Rotation (flag for future milestone)

If the encryption key must be rotated: select all rows with non-null
`ssn_encrypted`, decrypt with old key, re-encrypt with new key, update.
This is a maintenance script. The current schema supports it without any
schema change.

---

## Feature 4: Agency Portal Auto-Submit

### API Availability Finding

**Confidence: MEDIUM** (confirmed via official DIR and L&I documentation,
no REST API spec found after search of official portals).

**CA DIR eCPR:** No public REST API. The system supports two submission
modes: (1) web form at `efiling.dir.ca.gov` and (2) XML file upload via
the same portal. The XML schema is documented (CPR XML schema V1.3,
published by DIR at `dir.ca.gov`). There is no programmatic submission
endpoint that a third-party application can POST to.

**WA L&I PWIA:** No public REST API for direct submission as of
2026-03. The system supports XML file upload into the PWIA portal via
My L&I. L&I has improved XML validation and error messaging in 2025
but has not published a machine-to-machine API.

**Conclusion: Direct API auto-submit is not achievable for either CA
or WA at this time.** The correct architecture is export-assist:
generate the agency-required XML and provide a guided checklist for
manual portal upload. This is already partially implemented in v2.5
(CA eCPR XML export in Phase 29, WA PWIA assist in Phase 30). v3.0
extends this with submission status tracking.

### What IS Buildable: Submission Status Tracking

The `payrollWeeks.submittedAt` + `payrollWeeks.submittedTo` columns
(Phase 17/23) already support WH-347 submission tracking. The same
pattern should extend to CA eCPR and WA PWIA.

**No async job queue is needed for the non-API path.** XML generation
is synchronous (xmlbuilder2 is fast). If a future real API submission
becomes available, a lightweight SQLite-backed job table is the correct
approach -- not BullMQ/Redis (which would require adding Redis to the
Render.com deployment).

### New Columns on `payroll_weeks`

```
payroll_weeks
  ca_ecpr_submitted_at  TEXT  (nullable; ISO 8601; set when user marks CA submitted)
  wa_lni_submitted_at   TEXT  (nullable; ISO 8601; set when user marks WA submitted)
```

### Async Submission Table (future-ready, design now)

If CA or WA publish a public API, this table supports retry logic without
a Redis dependency:

```
agency_submissions
  id            TEXT PK
  project_id    TEXT NOT NULL
  week_id       TEXT NOT NULL
  agency        TEXT NOT NULL  ('ca-dir' | 'wa-li')
  status        TEXT NOT NULL  ('pending' | 'processing' | 'submitted' | 'failed' | 'rejected')
  attempt_count INTEGER NOT NULL DEFAULT 0
  last_attempt  TEXT
  next_retry    TEXT
  response_body TEXT           (agency API response; nullable)
  error_message TEXT
  submitted_at  TEXT           (set when status = 'submitted')
  created_at    TEXT NOT NULL
  updated_at    TEXT NOT NULL
```

A polling loop queries:
`SELECT * FROM agency_submissions WHERE status = 'pending' AND next_retry <= datetime('now')`

### New vs Modified Components

| Component | Type | Change |
|-----------|------|--------|
| `agency_submissions` table | New (future-ready) | Status tracking for agency submits |
| `payrollWeeks.caEcprSubmittedAt` + `waLniSubmittedAt` | New columns | Track per-agency submit events |
| CA eCPR modal (Phase 29) | Modified | Add "Mark as Submitted to DIR" action after export |
| WA PWIA assist panel (Phase 30) | Modified | Add "Mark as Submitted to L&I" action after export |
| `SubmissionStatusBadge` (React) | New component | Show CA/WA submission state on Payroll Week Detail |

---

## System Overview: v3.0 Layer Map

```
+-----------------------------------------------------------------------+
|                          React SPA                                     |
|  TeamSettingsPanel   PayrollImportModal  AddWorkerForm  SubmissionBadge|
|  InviteAcceptPage    ImportPreviewTable  (SSN input masked)            |
+-------------------------------+---------------------------------------+
                                | React Query (JWT cookie)
+-------------------------------v---------------------------------------+
|                       Express REST API                                 |
|  /projects/:id/invite          /workers (encrypt SSN on write)        |
|  /invites/accept               /workers/:id (decrypt gated)           |
|  /projects/:id/members         /payroll-weeks/:id/import              |
|  /agency-submissions           /payroll-weeks/:id/import/commit       |
+----------+---------------------+------------------+-------------------+
           |                     |                  |
+----------v---------+  +--------v--------+  +------v------------------+
| authService.ts     |  | importService   |  |   cryptoService.ts      |
| (member check)     |  | qbMapper.ts     |  | encryptSsn/decryptSsn   |
| inviteService.ts   |  | adpMapper.ts    |  | AES-256-GCM node:crypto |
+----------+---------+  +--------+--------+  +------+------------------+
           |                     |                  |
+----------v---------------------v------------------v-------------------+
|                         SQLite (Drizzle ORM)                          |
|  project_members    payroll_imports     workers.ssn_encrypted         |
|  users.invite_*     agency_submissions  payrollWeeks.ca/waSubmittedAt |
+-----------------------------------------------------------------------+
```

---

## Recommended Build Order (Feature Dependencies)

```
1. SSN encryption foundation
   No dependencies. Purely additive column + service.
   Must land before any CA eCPR / WA PWIA improvements that use full SSN.

2. Multi-user: DB schema + auth middleware
   project_members table + authMiddleware change.
   Must land before invite flow (invite routes reference the table).
   projects.userId stays as-is; only auth guard changes.

3. Multi-user: invite flow + React team UI
   Depends on step 2 (table must exist).
   New routes + InviteAcceptPage + TeamSettingsPanel.

4. Agency submission status tracking
   Depends on nothing new. Additive columns + SubmissionStatusBadge.
   agency_submissions table is future-ready (no active use yet).

5. Payroll import: server pipeline
   importService.ts + mappers + preview/commit routes.
   Depends on nothing except existing payrollEntries schema.

6. Payroll import: React UI
   PayrollImportModal depends on step 5 routes existing.
```

---

## Architectural Patterns

### Pattern 1: Preview-Then-Commit (existing, extend to import)

**What:** Return a dry-run preview from the server before any DB write.
User confirms. Second request commits.
**When to use:** Any bulk operation that could create many rows or
overwrite existing data.
**Trade-offs:** Two round-trips. The existing codebase already uses this
for `copyPayrollWeek` -- applying it to CSV import is consistent and
requires no new UX paradigm.

### Pattern 2: Service Layer Encryption

**What:** `cryptoService.ts` is the single entry point for all
encrypt/decrypt operations. Routes never call `node:crypto` directly.
**When to use:** Any field requiring at-rest encryption.
**Trade-offs:** Slight latency per call (AES-GCM is microseconds at
this scale -- negligible). Key isolation benefit is significant: rotating
the key means changing one service, not hunting call sites.

### Pattern 3: Member-Scoped Auth Guard

**What:** All project-scoped routes check `project_members` for active
(accepted) membership instead of `projects.userId`.
**When to use:** Every protected project route in v3.0+.
**Trade-offs:** One extra lookup per request. At SQLite scale with a
small team, this is not measurable. Index on `(project_id, user_id)`
in the migration is required.

### Pattern 4: Export-Assist (not auto-submit)

**What:** Generate the agency-required XML and surface a guided
checklist + "mark submitted" button. Do not POST to agency portals.
**When to use:** CA DIR eCPR and WA L&I PWIA -- neither has a public
API as of 2026-03.
**Trade-offs:** Less automation than "auto-submit" implies. But
attempting browser-based portal automation would be brittle, likely
violate portal ToS, and impossible on Render.com. Export-assist is
the correct honest scope.

---

## Data Flow

### SSN Write Flow

```
AddWorkerForm (SSN input, masked display)
  -> POST /workers { ssn: "123-45-6789", ssnLast4: "6789", ... }
  -> workerService.createWorker()
       -> cryptoService.encryptSsn("123-45-6789")  -> "<iv>:<tag>:<ciphertext>"
       -> db.insert(workers, { ssnLast4: "6789", ssnEncrypted: "...", ssn: undefined })
  -> Response: worker object (no ssn, no ssnEncrypted in response body)
```

### SSN Read Flow (CA eCPR XML export only)

```
POST /export/ecpr-xml/:weekId
  -> ecprXmlGenerator.generate()
       -> db.select workers (includes ssnEncrypted)
       -> cryptoService.decryptSsn(worker.ssnEncrypted)  -> "123-45-6789"
       -> xmlbuilder2 inserts plaintext SSN into XML
       -> plaintext SSN goes out of scope after XML generation
  -> Response: XML file download (plaintext SSN never stored or logged)
```

### Payroll Import Flow

```
PayrollImportModal (file picker)
  -> POST /projects/:id/payroll-weeks/:weekId/import  multipart/form-data
  -> importService.preview(file)
       -> detectProvider(headers)  -> 'quickbooks' | 'adp'
       -> mapper.map(rows)  -> PayrollEntryPreview[]
       -> fetchRateSnapshots(workers, weekId)  -> snapshots
  -> Response: { preview: PayrollEntryPreview[], unmapped: string[], provider }

User reviews preview, confirms
  -> POST /projects/:id/payroll-weeks/:weekId/import/commit { importId }
  -> importService.commit(importId)
       -> db.insert payrollEntries (with rate snapshots)
       -> db.insert payroll_imports (audit log)
  -> Response: { inserted: N, skipped: M }
```

### Team Invite Flow

```
TeamSettingsPanel (owner enters email)
  -> POST /projects/:id/invite { email }
  -> inviteService.createInvite(projectId, email, invitedBy)
       -> crypto.randomBytes(32)  -> raw token
       -> SHA-256 hash  -> stored token
       -> upsert users row (or find existing by email)
       -> insert project_members (acceptedAt: null)
       -> set users.inviteToken = hash, users.inviteTokenExp = now+72h
       -> send email (link: /accept-invite?token=<raw>)
  -> Response: { status: 'invited' }

Invitee clicks link -> InviteAcceptPage
  -> POST /invites/accept { token }
  -> inviteService.accept(token)
       -> SHA-256 hash incoming token
       -> find user WHERE invite_token = hash AND invite_token_exp > now()
       -> set project_members.acceptedAt = now()
       -> clear invite token fields on users
  -> Redirect to /dashboard
```

---

## SQLite-Specific Constraints

| Constraint | Impact on v3.0 | Mitigation |
|------------|---------------|------------|
| Foreign keys off by default | `project_members` FK to projects/users not enforced automatically | Add `PRAGMA foreign_keys = ON` to DB init |
| No RIGHT/FULL OUTER JOIN | Auth queries use LEFT JOIN + null check pattern | Use `LEFT JOIN project_members ON ... WHERE pm.accepted_at IS NOT NULL` |
| Single writer (WAL mode) | Import commits are synchronous; no concurrent bulk writes | WAL mode (already on Render); single-session writes are fine |
| Add-only migrations | Cannot drop `projects.userId` | Keep it; use only for original-owner display. Auth moves to `project_members` |
| No native encryption | Column-level crypto not possible at DB layer | Service-layer AES-256-GCM via `node:crypto` |
| No cascade enforcement | `onDelete: 'cascade'` in Drizzle schema does not fire unless FK pragma is on | Enable FK pragma OR add explicit delete logic in service layer |

---

## Anti-Patterns

### Anti-Pattern 1: Organizations Table for a Flat Team

**What people do:** Add an `organizations` table because "that's how
SaaS works," then force every project into an org and every user into
an org.
**Why it's wrong:** The requirement is "flat -- all members see all
projects." An org table adds a third entity, complicates every query,
and front-loads scope the product does not need.
**Do this instead:** `project_members` join table. If org-level features
are needed in v4.0, migrate then with a real requirements spec.

### Anti-Pattern 2: Storing Plaintext SSN at Rest

**What people do:** Store full SSN in a column "just temporarily" for
the import or pre-fill use case, intending to encrypt later.
**Why it's wrong:** SQLite on a shared disk is a flat file. Any breach
exposes all records. "Temporary" plaintext columns become permanent.
**Do this instead:** Encrypt at the service layer before the INSERT.
Never pass plaintext SSN through an API response.

### Anti-Pattern 3: Returning Plaintext SSN in API Responses

**What people do:** Return `{ ssn: decryptedSsn }` from `GET /workers/:id`
to let the frontend pre-fill an edit form.
**Why it's wrong:** The plaintext SSN travels over the wire and into
React state. Browser devtools, logging middleware, and React Query's
cache all become SSN stores.
**Do this instead:** For the edit form, require re-entry on edit, or
use a dedicated "reveal SSN" endpoint that returns a single-use,
short-lived response and is not cached by React Query.

### Anti-Pattern 4: Parsing CSV in the Browser

**What people do:** Use PapaParse in React to parse the CSV and send
JSON to the server.
**Why it's wrong:** The mapping logic is business logic that needs
tests and versioning. The rate snapshot fetch requires DB access.
Browser-parsed data arrives at the server unvalidated.
**Do this instead:** Send the raw file as multipart. Parse and map
server-side in `importService.ts`.

### Anti-Pattern 5: Browser Automation for Agency Submit

**What people do:** Attempt Puppeteer/Playwright to "auto-submit" by
filling the DIR or L&I portal form programmatically.
**Why it's wrong:** Render.com does not support headless browsers.
Portal ToS prohibit automation. Portal UI changes break the automation
silently. CA DIR already accepts XML uploads -- the correct integration
is XML generation plus a checklist.
**Do this instead:** Export-assist pattern: generate the XML, surface
a checklist, let the user upload manually, mark submitted in the app.

---

## Integration Points Summary

| Feature | Touches Existing Code | New Tables/Columns | New Routes | New React Components |
|---------|-----------------------|--------------------|------------|----------------------|
| Multi-user | authMiddleware (every project route) | `project_members`, `users.invite_token`, `users.invite_token_exp` | 4 invite/member routes | TeamSettingsPanel, InviteAcceptPage |
| Payroll import | None (new parallel flow) | `payroll_imports` | 2 import routes | PayrollImportModal |
| SSN encryption | `POST /workers`, `PATCH /workers/:id`, CA/WA XML exports | `workers.ssn_encrypted` | None new | AddWorkerForm/EditWorkerForm (SSN field) |
| Agency status | CA eCPR modal (Phase 29), WA assist panel (Phase 30) | `payrollWeeks.caEcprSubmittedAt`, `payrollWeeks.waLniSubmittedAt`, `agency_submissions` | None new | SubmissionStatusBadge |

---

## Sources

- California DIR eCPR XML Upload User Guide:
  https://www.dir.ca.gov/Public-Works/documents/CPR-XML-Upload-User-Guide.pdf
- California DIR Certified Payroll Reporting page:
  https://www.dir.ca.gov/Public-Works/Certified-Payroll-Reporting.html
- Washington L&I PWIA step-by-step instructions (XML submission confirmed):
  https://lni.wa.gov/licensing-permits/_docs/pwia-step-by-step-instructions.pdf
- ADP Workforce Now CSV export format:
  https://kb.7shifts.com/hc/en-us/articles/4417520074387-ADP-Workforce-Now-US-Payroll-Export
- Node.js AES-256-GCM implementation reference:
  https://gist.github.com/rjz/15baffeab434b8125ca4d783f4116d81
- SQLite-native background job system (no Redis pattern):
  https://jasongorman.uk/writing/sqlite-background-job-system/
- Existing schema: src/server/db/schema.ts (read directly)
- Project context: .planning/PROJECT.md (read directly)

---

*Architecture research for: HCC Prevailing Wage v3.0 -- Team & Integration milestone*
*Researched: 2026-03-27*
