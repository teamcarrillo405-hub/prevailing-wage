# Project Research Summary

**Project:** HCC Prevailing Wage — v3.0 Team & Integration
**Domain:** Multi-user team accounts, payroll provider CSV import, AES-256 SSN encryption, agency portal auto-submit research gate
**Researched:** 2026-03-27
**Confidence:** HIGH

## Executive Summary

HCC Prevailing Wage v3.0 adds four integrations on top of a fully-shipped v2.5 single-user compliance platform: multi-user team accounts, QuickBooks/ADP CSV import, AES-256 SSN encryption at rest, and a research-gated agency portal auto-submit feature. The existing stack (Node.js + Express + TypeScript, React + Vite + TailwindCSS v4, SQLite + Drizzle ORM) requires only one new production dependency — `nodemailer@8.0.4` for invite emails. All other v3.0 features are implemented using already-installed packages (`multer`, `papaparse`) or Node.js built-ins (`node:crypto`). The stack is minimal and intentional.

The most consequential architectural decision is the auth refactor: every project-scoped route currently guards via `project.userId === req.user.userId`, a single-owner invariant scattered across 9 route files. Upgrading to multi-user requires replacing this with a centralized `assertProjectAccess(projectId, userId, db)` function backed by a new `project_members` join table. This must be the first task of the team phase — every other team feature depends on it being correct. The risk is an IDOR vulnerability if even one route file retains the old check after the refactor, silently leaking one team's data to another.

The agency portal auto-submit research gate is closed: neither CA DIR eCPR nor WA L&I PWIA publish a public machine-to-machine API as of 2026-03. The correct scope for v3.0 is export-assist (XML file generation with guided checklist and "mark as submitted" tracking), which is already partially shipped in v2.5. No Playwright/Puppeteer automation should be attempted — it would violate portal ToS, break on UI changes, and require storing contractor portal credentials. SSN encryption requires AES-256-GCM (not CBC), with per-record random IVs, a versioned JSON envelope, and a startup assertion that fails fast if the encryption key is missing.

---

## Key Findings

### Recommended Stack

The existing stack handles all v3.0 features without architectural changes. One new dependency (`nodemailer@8.0.4`) handles transactional invite email over SMTP. This is transport-agnostic — the SMTP relay (Resend, SendGrid, Postmark) is configured via environment variables so the provider can be swapped without code changes. CSV upload and parsing reuse `multer@2.1.1` (already handles multipart/form-data) and `papaparse@5.5.3` (already installed; `header: true` mode is more ergonomic than `csv-parse` for column-name-based mapping required by QuickBooks and ADP). SSN encryption uses `node:crypto` AES-256-GCM — no third-party crypto library is needed or appropriate for server-side Node.js.

**Core technologies:**
- `nodemailer@8.0.4`: SMTP invite email — only new production dependency; v8 is ESM-compatible and bundles TypeScript types; install with `npm install nodemailer@8.0.4`
- `multer@2.1.1` (existing): Multipart CSV file upload; `memoryStorage()` for in-memory CSV processing avoids temp file cleanup
- `papaparse@5.5.3` (existing): CSV parsing with `header: true` + `skipEmptyLines: true`; preferred over `csv-parse` for column-name-based QB/ADP mapping
- `node:crypto` (built-in): AES-256-GCM encryption; random 12-byte IV per call; authenticated encryption detects tampering; no wrapper package needed
- SQLite + Drizzle ORM (existing): Additive schema migrations only; new `project_members`, `payroll_imports`, and `agency_submissions` tables

**Do not add:** Playwright/Puppeteer (no agency API exists), `aes-256-gcm` npm wrappers (use Node.js built-in), vendor-specific email SDKs (nodemailer is transport-agnostic), SQLCipher (breaks existing Drizzle setup), or an `organizations` table (flat model needs only a `project_members` join table).

### Expected Features

**Must have (table stakes for v3.0):**
- Invite user by email — tokenized link, 72-hour expiry, single-use, invitee creates account or accepts; owner and all members see all projects (flat model)
- Project member access revocation — compliance software handles sensitive payroll PII; soft-delete membership, do not destroy user record
- Pending invite status — owner must know whether an invite is still outstanding before re-sending
- QuickBooks CSV import — pre-populate payroll entry form from QB Payroll Summary or Time Activity export; contractor reviews and confirms before saving
- ADP CSV import — pre-populate from ADP Workforce Now PRcccEPI.csv format; contractor reviews and confirms before saving
- AES-256 SSN encryption at rest — full SSN needed for CA eCPR and WA PWIA XML; must be encrypted with GCM, decrypted only at XML export, never returned in API responses
- Agency submission status tracking — "Mark as Submitted" for CA DIR and WA L&I; `caEcprSubmittedAt` and `waLniSubmittedAt` columns on `payroll_weeks` extend the existing `submittedAt` pattern

**Should have (differentiators):**
- Preview-then-commit import UX — show parsed rows, column mapping, matched vs unmatched workers before any DB write; extends existing `copyPayrollWeek` pattern; block import into submitted weeks
- `payroll_imports` audit table — records who imported, from what provider, how many rows, how many skipped; filename stored (not raw CSV, which may contain full SSNs)
- `createdByUserId` and `updatedByUserId` on `payroll_entries` — without these, imported entries are indistinguishable from manually-entered entries in a DOL audit
- SSN encryption key versioning — `{"v":"1","iv":"...","tag":"...","ct":"..."}` JSON envelope format; `ENCRYPTION_KEY_V1` env var naming convention; re-encryption runbook written before first migration
- `SubmissionStatusBadge` React component — surfaces CA/WA submission state on Payroll Week Detail alongside existing WH-347 submission badge

**Defer to v4+:**
- Per-project team permissions — flat model is sufficient; granular RBAC is a v4 milestone if needed
- SSO/SAML/OAuth provider login — JWT + email/password is the planned auth stack
- QuickBooks OAuth API integration — CSV export is a 2-minute operation; direct API requires Intuit developer registration and quota management; scope explosion not justified
- ADP API integration — requires ADP Marketplace approval; enterprise pricing; not feasible for small contractor tool
- KMS-backed encryption key management — Render.com env vars are sufficient at current scale; flag for SOC 2 milestone
- Agency portal auto-submit — monitor CA DIR and WA L&I developer portals for public API announcement; not available as of 2026-03

**Confirmed anti-features (must not build):**
- Playwright/Puppeteer portal automation — violates portal ToS, requires credential storage, breaks on UI changes, not supportable on Render.com
- Auto-save import without review — removes deliberate certification step; legal liability on a federal certified payroll document
- Full SSN in any API response, log, or CSV export — plaintext SSN is only acceptable inside server-side XML generator, in-process, never assigned to variables that escape that function

### Architecture Approach

v3.0 follows three established patterns from the existing codebase extended to multi-user. First, the single-owner auth guard (`project.userId === req.user.userId`) is replaced by a `project_members` membership check encapsulated in a single shared `assertProjectAccess` service — no route file should contain direct `userId` equality checks after this refactor; every child entity route must traverse to the project and call this function. Second, the preview-then-commit pattern from `copyPayrollWeek` is extended to CSV import — a preview endpoint returns parsed rows and unmatched workers; a commit endpoint writes to DB only after user confirmation. Third, service-layer encryption via a dedicated `cryptoService.ts` isolates all `node:crypto` calls so key rotation changes one file, not scattered call sites.

Agency submissions use the export-assist pattern (XML generation + guided checklist + mark-submitted tracking) with a future-ready `agency_submissions` table designed to support API retries if portals publish endpoints later — no Redis or BullMQ dependency, SQLite polling only.

**Major components:**
1. `assertProjectAccess(projectId, userId, db)` — centralized auth guard; replaces inline `project.userId !== userId` in all 9 route files; also called by every child-entity route after loading the child and reading its `projectId`
2. `project_members` table — flat team model with `(project_id, user_id)` unique constraint; `acceptedAt` distinguishes accepted from pending; index on `(project_id, user_id)` required for auth guard performance
3. `inviteService.ts` — invite token via `crypto.randomBytes(32)`; SHA-256 hash stored in DB; raw token in email link; 72-hour expiry; `project_members` row created with `acceptedAt: null` at invite time
4. `cryptoService.ts` — `encryptSsn()` and `decryptSsn()` using AES-256-GCM; all `node:crypto` calls isolated here; `decryptSsn()` called only from CA eCPR and WA PWIA XML generators
5. `importService.ts` + `qbMapper.ts` + `adpMapper.ts` — provider auto-detection by column signature; column-to-field mapping; rate snapshots fetched from WD cache (never from CSV); preview/commit two-step pipeline
6. `agency_submissions` table — future-ready SQLite-backed status tracking; `status` enum covers pending/processing/submitted/failed/rejected; polling via `SELECT WHERE status = 'pending' AND next_retry <= datetime('now')`

### Critical Pitfalls

1. **IDOR auth bypass from scattered ownership checks** — 9 route files contain `project.userId !== req.user.userId`; migrating to `project_members` without centralizing leaves missed routes that silently pass data to unauthorized users. Prevention: extract `assertProjectAccess` first, write cross-tenant test suite (two users, two projects, all protected endpoints assert 403 for wrong user) before any team data exists in any environment.

2. **Cross-tenant data leak via indirect object references** — routes accepting child entity IDs (workers, payroll entries, classifications) without traversing the project ownership chain are safe in single-user but become IDOR vulnerabilities in multi-user; UUID opacity is not a security boundary. Prevention: every such route must load the child entity, read its `projectId`, and call `assertProjectAccess`.

3. **Rate snapshot corruption during CSV import** — QuickBooks and ADP export pay rates; if import maps these to `baseRateSnapshot` or `fringeRateSnapshot`, the WH-347 and compliance engine use wrong rates and may fail to fire violations. This is a legal compliance failure, not just a software bug. Prevention: rate snapshots must always come from `getCachedClassifications` — never from the CSV; enforce at the service layer before any CSV parsing logic is written.

4. **SSN encryption key loss** — rotating the `ENCRYPTION_KEY` env var without a versioned envelope destroys all encrypted SSNs permanently (AES-256 without the key is unrecoverable). Prevention: store key version in JSON envelope (`{"v":"1",...}`); use `ENCRYPTION_KEY_V1` naming; add a startup assertion that decrypts a known test vector and refuses to start if it fails; write the key rotation runbook before the first migration is written.

5. **`submittedAt` set optimistically before portal confirms** — CA DIR eCPR portal returns HTTP 200 but may mark submissions as "draft" rather than processing them; setting `submittedAt` before confirmed success permanently locks the week in the app while the portal has no record. Prevention: never set `submittedAt` until confirmed non-draft success; use `agency_submissions` table with explicit status states rather than writing to `payrollWeeks.submittedAt` directly.

---

## Implications for Roadmap

Based on combined research, the architecture recommends this build order with strict dependency respect:

### Phase 1: SSN Encryption Foundation

**Rationale:** No dependencies on any other v3.0 feature — purely additive column (`workers.ssn_encrypted`) plus `cryptoService.ts`. Must land before any CA eCPR or WA PWIA improvement that writes full SSN to XML. Key versioning envelope and startup assertion must be designed and implemented here before a single encrypted value is written to any environment.
**Delivers:** AES-256-GCM SSN encryption at rest; `cryptoService.ts` with `encryptSsn` and `decryptSsn`; key versioning JSON envelope (`{"v":"1","iv":"...","tag":"...","ct":"..."}`); `ENCRYPTION_KEY_V1` env var; startup health check assertion; re-encryption runbook documented
**Addresses:** SSN encryption table stakes from FEATURES.md Part 7; unblocks CA/WA XML full-SSN requirement deferred from v2.5
**Avoids:** SSN key loss (Pitfall 4), IV reuse/CBC mode, plaintext SSN in API responses, AES-CBC instead of AES-GCM

### Phase 2: Multi-User Auth Foundation (DB Schema + Middleware Refactor)

**Rationale:** The `project_members` table and the `assertProjectAccess` refactor must land before invite routes, team UI, or any team data can exist. The cross-tenant test suite must be written and passing before this phase is complete. `createdByUserId` and `updatedByUserId` columns on `payroll_entries` belong in this phase — retrofitting after import ships leaves null on all imported entries, indistinguishable from manually-entered entries in a DOL audit.
**Delivers:** `project_members` table with `(project_id, user_id)` unique index; `users.invite_token` and `users.invite_token_exp` columns; `assertProjectAccess` service replacing all inline `userId` checks across 9 route files; cross-tenant test suite; `createdByUserId` and `updatedByUserId` on `payroll_entries`
**Addresses:** Flat team model architectural decision; `project_members` over `organizations` design rationale
**Avoids:** IDOR auth bypass (Pitfall 1), indirect object reference data leak (Pitfall 2)

### Phase 3: Multi-User Invite Flow + Team UI

**Rationale:** Depends on Phase 2 (`project_members` table must exist). New routes (`POST /projects/:id/invite`, `POST /invites/accept`, `GET /projects/:id/members`, `DELETE /projects/:id/members/:userId`) plus `TeamSettingsPanel` and `InviteAcceptPage` React components. `nodemailer` install happens here.
**Delivers:** Email invite flow; tokenized accept link (SHA-256 hash stored, raw token in email); team member list for owner; access revocation; pending invite status; `nodemailer@8.0.4` install; SMTP env var configuration
**Addresses:** All team account table stakes and differentiators from FEATURES.md Part 7
**Avoids:** Invite token stored plaintext (always SHA-256 hash before storing); membership embedded in JWT payload (resolve from DB per request, never cache in token)

### Phase 4: Agency Submission Status Tracking

**Rationale:** No dependencies on other v3.0 features. Purely additive — `caEcprSubmittedAt` and `waLniSubmittedAt` columns on `payroll_weeks`, new `agency_submissions` table (future-ready), and `SubmissionStatusBadge` React component. Extends existing v2.5 Phase 29/30 CA/WA modal UI with "Mark as Submitted" actions.
**Delivers:** Per-agency submission tracking on `payroll_weeks`; `SubmissionStatusBadge` on Payroll Week Detail; `agency_submissions` table with full status state machine for future API support; "Mark as Submitted" UI action in CA eCPR and WA PWIA export modals
**Addresses:** Agency portal auto-submit research gate finding (not feasible as machine-to-machine); export-assist pattern formalization
**Avoids:** Optimistic `submittedAt` before portal confirms (Pitfall 5); portal session expiry mid-submission; headless browser automation anti-pattern

### Phase 5: Payroll Import — Server Pipeline

**Rationale:** Depends only on existing `payrollEntries` schema. Server-side CSV parsing is business logic that needs tests and versioning; WD rate snapshot fetch requires DB access. Two-route pattern (preview + commit) mirrors `copyPayrollWeek`. Rate snapshot sourcing rule must be the first constraint implemented in `importService.ts` before any CSV parsing is written — this is not an afterthought.
**Delivers:** `importService.ts` with provider auto-detection; `qbMapper.ts` and `adpMapper.ts`; `POST /import` preview route and `POST /import/commit` route; `payroll_imports` audit table; submitted-week protection (reject import into weeks with `submittedAt` set)
**Addresses:** QuickBooks and ADP import table stakes; server-side parsing architectural decision; preview-then-commit pattern
**Avoids:** Rate snapshot corruption from CSV (Pitfall 3), duplicate entries on re-import (Pitfall 4), CSV SSN staging in plaintext

### Phase 6: Payroll Import — React UI

**Rationale:** Depends on Phase 5 routes. `PayrollImportModal` with file picker, provider label, preview table showing matched and unmatched workers and estimated daily hour distribution, column mapping annotations, and confirm-commit action.
**Delivers:** `PayrollImportModal`; unmatched worker warning list; import confirmation flow with hours-delta display; integration with existing Payroll Week Detail page
**Addresses:** Import UX table stakes and differentiators — preview before commit, unmatched worker surfacing, column mapping transparency
**Avoids:** Auto-save without review anti-feature; silent unmatched worker skip; import that proceeds with partial data

### Phase Ordering Rationale

- SSN encryption is first because it has zero dependencies and CA/WA XML full-SSN support has been deferred since v2.5 — it unblocks two downstream compliance features
- Auth foundation (Phase 2) precedes the invite flow (Phase 3) because invite routes reference `project_members` and the cross-tenant test suite is the regression gate for all subsequent team work
- Submission tracking (Phase 4) is independent and low-complexity; placing it before import avoids the import phase being blocked by unrelated status UI work
- Import server pipeline (Phase 5) before import React UI (Phase 6) is the natural dependency order; shipping the pipeline with automated tests before building UI reduces debugging surface

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Invite Flow):** SMTP relay selection (Resend vs SendGrid vs Postmark) and Render.com environment variable setup for `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` — confirm relay provider and verify deliverability to contractor email domains before implementation
- **Phase 5 (Import Pipeline):** QuickBooks column names vary by QB version and export type (QB Desktop vs QB Online, Payroll Summary vs Time Activity); ADP column names differ between ADP Run and ADP Workforce Now; test with real contractor export files before hardcoding column templates; build column mapping UI that shows parsed headers for user confirmation rather than relying solely on hardcoded templates

Phases with standard patterns (skip research-phase):
- **Phase 1 (SSN Encryption):** AES-256-GCM with `node:crypto` is a well-documented Node.js pattern; implementation code is fully specified in STACK.md and ARCHITECTURE.md with working TypeScript snippets
- **Phase 2 (Auth Foundation):** `project_members` join table pattern is standard multi-tenant SaaS; ARCHITECTURE.md specifies exact schema, guard pattern, and data flow diagrams
- **Phase 4 (Submission Tracking):** Additive columns plus existing submission badge pattern; no new domain complexity

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | nodemailer version confirmed from live GitHub release (2026-03-27); multer and papaparse confirmed in project package.json; Node.js crypto AES-256-GCM from official docs; project confirmed ESM with Node >= 20 |
| Features | HIGH (team/encryption) / MEDIUM (import field mapping) | Team invite and SSN encryption patterns are standard and well-documented; QB/ADP CSV column names vary by product version — confirmed in principle but exact column names need real-file validation before hardcoding templates |
| Architecture | HIGH | Grounded in direct source code review of existing routes, schema, and middleware; `project_members` vs `organizations` decision based on actual flat-model requirement; service-layer encryption preference over SQLCipher based on confirmed Render.com deployment constraints |
| Pitfalls | HIGH (security/data integrity) / MEDIUM (portal behavior) | IDOR and rate snapshot pitfalls grounded in source code analysis of 9 route files; CA DIR "returns 200 but marks as draft" behavior documented in vendor reports but not confirmed by direct portal testing |

**Overall confidence:** HIGH

### Gaps to Address

- **QuickBooks exact column names by version:** STACK.md documents QB column names from a community support article (MEDIUM confidence); exact column headers vary by QB version, locale, and export type. Mitigation: build a column mapping UI that shows parsed headers and lets the contractor confirm hours columns; treat hardcoded QB template as a default override-able per upload.

- **ADP Run vs ADP Workforce Now formats:** ADP Workforce Now (`PRcccEPI.csv`) is documented at MEDIUM confidence from third-party integration guides; ADP Run (small business product) uses a different export format with different column names. Mitigation: same column mapping UI; ship WFN template first; ADP Run is a secondary target.

- **CA DIR XML: SSN gap now closeable with Phase 1:** v2.5 shipped a masked SSN placeholder in CA eCPR XML. With Phase 1 (SSN encryption) complete, the CA XML generator must be updated to call `cryptoService.decryptSsn()` and write the real SSN. This update belongs in Phase 1 scope, not a separate phase.

- **Invite token storage — SHA-256 hash vs plaintext:** ARCHITECTURE.md recommends SHA-256 hashing the invite token before storage; FEATURES.md Part 7 uses "cryptographically random, single-use" without specifying hashing. Implementation must hash before storage — 256-bit entropy raw token travels only in the email link; SHA-256 hash stored in DB; hash comparison at acceptance.

---

## Sources

### Primary (HIGH confidence)
- `package.json` (project root) — confirmed installed: multer@^2.1.1, papaparse@^5.5.3, argon2@^0.44.0, csv-parse@^6.2.0; `"type": "module"` ESM; engines.node >= 20
- `https://github.com/nodemailer/nodemailer/releases` — nodemailer v8.0.4 released 2026-03-25; ESM support confirmed; TypeScript types bundled; one breaking change from v7 (error code rename, no impact on clean install)
- `https://nodejs.org/api/crypto.html` — AES-256-GCM, `createCipheriv`, `randomBytes` official Node.js docs
- `src/server/routes/projects.ts`, `src/server/db/schema.ts` — direct source code review for auth pattern and existing schema; `project.userId !== userId` pattern confirmed in 9 route files
- `https://efiling.dir.ca.gov/eCPR/pages/home.jsp` — CA DIR eCPR portal: XML file upload only, no REST API confirmed
- `https://lni.wa.gov/licensing-permits/_docs/xmlschema.xsd` — WA L&I official XML schema (parsed directly in v2.5 research); no machine-to-machine submission endpoint

### Secondary (MEDIUM confidence)
- `https://quickbooks.intuit.com/learn-support/en-us/employees-and-payroll/csv-file-export-for-payroll/00/700576` — QB CSV export column structure; community support article, not official API docs
- ADP Workforce Now PRcccEPI.csv format — Co Code, Batch ID, File #, Reg Hours, O/T Hours confirmed from multiple third-party integration guides; official ADP docs behind login wall
- CA DIR "returns 200 but marks as draft" behavior — documented in `thewpcca.com/dir-update-on-public-works-website-issues`; not confirmed by direct portal testing
- `https://agnitestudio.com/blog/preventing-cross-tenant-leakage/` — multi-tenant IDOR prevention patterns

### Tertiary (LOW confidence — needs validation)
- QB Time Activity export day-level columns — inferred from ADP Marketplace listing for Points North integration; exact field names in day-level QB export not confirmed from official QB documentation; validate with real contractor export file before hardcoding

---
*Research completed: 2026-03-27*
*Ready for roadmap: yes*
