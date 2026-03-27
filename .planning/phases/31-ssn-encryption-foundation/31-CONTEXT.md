# Phase 31: SSN Encryption Foundation — Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Workers can have their full 9-digit SSN collected and stored encrypted at rest. The CA eCPR XML generator and WA PWIA XML generator use the real decrypted SSN instead of the v2.5 placeholder. All UI views show the SSN masked. WH-347 and compliance CSV continue reading `ssnLast4` unchanged.

This phase does NOT include: multi-user access controls, payroll import, or any new agency submission UI.

</domain>

<decisions>
## Implementation Decisions

### Encryption Algorithm (SEC-01)

- **D-01:** AES-256-GCM via `node:crypto` built-in — no third-party crypto package. GCM provides authenticated encryption (detects tampering); CBC requires a separate HMAC and is inferior.
- **D-02:** Per-record random 12-byte IV (`crypto.randomBytes(12)`). IV is never reused across records.
- **D-03:** Versioned JSON envelope stored in `ssnEncrypted` column: `{"v":"1","iv":"<base64>","tag":"<base64>","ct":"<base64>"}`. Key version embedded so rotation can be handled without re-encrypting all records at once.
- **D-04:** Encryption key stored as `ENCRYPTION_KEY_V1` env var — 32-byte value encoded as 64-char hex string. Same pattern as existing `JWT_SECRET` and `INVITE_CODE` env vars on Render.com.
- **D-05:** Server startup assertion: if `ENCRYPTION_KEY_V1` is missing or the self-test (encrypt known plaintext → decrypt → compare) fails, the process exits immediately with a clear error. Prevents a misconfigured deploy from silently writing unencryptable records.

### Schema (SEC-01)

- **D-06:** Add `ssn_encrypted` nullable text column to `workers` table via SQL-only migration, manually registered in `src/server/db/migrations/meta/_journal.json` — same convention as every prior migration.
- **D-07:** `ssn_last4` column is NOT dropped or modified. It is kept as a derived convenience column: written at create/update time from the last 4 digits of the full SSN. WH-347, compliance CSV, and cross-project compliance history all read from `ssn_last4` — no changes to those routes.

### Existing Worker Migration (SEC-01)

- **D-08:** For existing workers with a non-null `ssn_last4`, the migration encrypts the 4-digit value into `ssn_encrypted`. This fulfills "encrypt existing PII at rest." The CA eCPR generator checks decrypted length: 4 digits → partial, treats as "full SSN not on file" for XML; 9 digits → real SSN, writes to XML.
- **D-09:** Workers with `ssn_last4 IS NULL` get `ssn_encrypted = NULL` in the migration — no change needed.

### Worker Input UX (SEC-03)

- **D-10:** The existing `ssnLast4` 4-digit input in the worker create/update form is replaced with a single full 9-digit SSN input field. No side-by-side dual fields.
- **D-11:** `CreateWorkerSchema` and `UpdateWorkerSchema` in `workers.ts` change from `ssnLast4: z.string().length(4)` to `ssn: z.string().length(9).optional()` (or equivalent — researcher/planner to pick final field name). On write: encrypt full SSN → `ssnEncrypted`; derive last 4 → `ssnLast4`.
- **D-12:** All UI views display SSN as `***-**-1234` (last 4 from `ssnLast4`). Workers with only a 4-digit encrypted partial show a "Full SSN not on file" badge — informational, does not block payroll entry or WH-347.
- **D-13:** The raw SSN value is never returned in any API response. Server routes return `ssnLast4` only (the 4-digit derived field). `ssnEncrypted` is never sent to the client.

### cryptoService.ts (SEC-01)

- **D-14:** Create `src/server/services/cryptoService.ts` — pure module, no I/O. Exports `encryptSsn(plaintext: string): string` (returns JSON envelope string) and `decryptSsn(envelope: string): string` (returns plaintext). All `node:crypto` calls isolated here — key rotation requires changes to one file only.
- **D-15:** `decryptSsn()` is called ONLY from: (a) CA eCPR XML generator in `export.ts`, (b) WA PWIA XML generator in `export.ts`. Never called from list/detail routes that return data to the client.

### CA eCPR and WA PWIA XML Generators (SEC-02)

- **D-16:** CA eCPR (`export.ts` ~line 584): replace `ssn10 = '000000' + ssnLast4` with a decrypt call. If `ssnEncrypted` is null or decrypted length ≠ 9, fall back to the existing placeholder behavior and flag the worker row as "SSN not available."
- **D-17:** WA PWIA (`export.ts` ~line 775): same pattern — replace `ssn9 = '00000' + ssnLast4` with decrypt call; same null/partial fallback.
- **D-18:** `getPayrollEntriesWithWorkerDetails()` (payrollService.ts) must be extended to join `ssn_encrypted` from `workers` so export handlers can decrypt it. The existing join already returns `workerSsnLast4` — add `workerSsnEncrypted` alongside it.

### Claude's Discretion

- Exact input field type for SSN entry (password-type to mask while typing, or text with a show/hide toggle)
- Exact wording for the "Full SSN not on file" badge (vs "Partial SSN only")
- Placement of startup assertion code (server entry point vs a dedicated `startup.ts` module)
- Whether "Full SSN not on file" badge appears on the worker card list or only on the worker detail/edit view
- Key validation: whether to include a `GET /health` endpoint that reports encryption status without revealing the key

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### DB Schema
- `src/server/db/schema.ts` — add `ssnEncrypted` nullable text to `workers`; `ssnLast4` stays, kept in sync
- `src/server/db/migrations/meta/_journal.json` — manual migration registration required (SQL-only convention)

### Server
- `src/server/services/cryptoService.ts` — NEW pure service; `encryptSsn()` + `decryptSsn()`; all `node:crypto` calls here
- `src/server/routes/workers.ts` — update schemas + create/update handlers; encrypt on write, derive last-4
- `src/server/routes/export.ts` — update CA eCPR (~line 584) and WA PWIA (~line 775) to decrypt SSN; fallback for null/partial
- `src/server/services/payrollService.ts` — extend `getPayrollEntriesWithWorkerDetails()` to join `ssn_encrypted`

### Client
- Worker create/edit form (find via `ssnLast4` in client components) — replace 4-digit input with 9-digit; display masked value

### Research
- `.planning/research/STACK.md` — AES-256-GCM implementation pattern with full TypeScript code example
- `.planning/research/ARCHITECTURE.md` — cryptoService.ts design, key versioning envelope, startup assertion pattern
- `.planning/research/PITFALLS.md` — SSN encryption pitfalls (IV reuse, key loss, CBC mode, indexed fields)

### Requirements
- `.planning/REQUIREMENTS.md` §SEC-01, SEC-02, SEC-03

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `node:crypto` — built-in, no install needed; AES-256-GCM via `createCipheriv` / `createDecipheriv`
- `src/server/db/migrations/meta/_journal.json` — manual registration pattern established in every prior migration
- `getPayrollEntriesWithWorkerDetails()` (payrollService.ts) — existing join already returns `workerSsnLast4`; extend to also return `workerSsnEncrypted`

### Established Patterns
- SQL-only migrations manually registered in `_journal.json` — same for this phase
- Worker schema validation via Zod in `workers.ts` — `CreateWorkerSchema` and `UpdateWorkerSchema` are the entry points
- Export route reads worker fields from `getPayrollEntriesWithWorkerDetails()` result — both CA and WA generators follow this pattern

### Integration Points
- `workers.ts` lines 19/26: Zod schema validation for `ssnLast4` — replace with full SSN field
- `workers.ts` lines 165/194: DB write for `ssnLast4` — add `ssnEncrypted` write, keep `ssnLast4` write (derived)
- `export.ts` line 584: CA eCPR `ssn10` construction — replace with decrypt call
- `export.ts` line 775: WA PWIA `ssn9` construction — replace with decrypt call
- Server entry point (find `app.listen` or `server.ts`) — add startup assertion before listen

### Critical Pitfalls
- `ssnLast4` drives compliance history cross-project matching (`name + ssnLast4` identity key) — do NOT drop or nullify this column
- `ssnEncrypted` must NEVER appear in any API response body — strip at the DB select layer or in the route handler
- IV must be random per record — static IV breaks AES-GCM security entirely
- Key must not be hardcoded or committed — Render.com env var only; add to `.env.example` with a placeholder

</code_context>

<specifics>
## Specific Implementation Details

- New column: `ssn_encrypted` nullable text on `workers`
- Migration backfill: `UPDATE workers SET ssn_encrypted = encrypt(ssn_last4) WHERE ssn_last4 IS NOT NULL`
- `ssnLast4` column: kept, written from last 4 of full SSN on create/update going forward
- `cryptoService.ts`: pure module, `encryptSsn()` + `decryptSsn()`, AES-256-GCM, versioned JSON envelope
- Worker input: 9-digit full SSN replaces 4-digit field; displayed as `***-**-1234` everywhere
- CA eCPR + WA PWIA exports: decrypt SSN server-side; fallback to placeholder if null or partial (4 digits)
- Startup assertion: server refuses to start if `ENCRYPTION_KEY_V1` missing or self-test fails
- `getPayrollEntriesWithWorkerDetails()`: add `ssn_encrypted` to join result for export use

</specifics>

<deferred>
## Deferred Ideas

- Full SSN on WH-347 — federal standard uses last-4 only; full SSN on WH-347 is out of scope permanently
- KMS-backed key management — Render.com env var sufficient at current scale; v4+ SOC 2 milestone
- SSN field show/hide toggle in UI — Claude's discretion on input type
- Key rotation tooling — runbook document is sufficient for v3.0; automated rotation is v4+
- Audit log of every decrypt event — deferred to v4+ compliance milestone

</deferred>

---

*Phase: 31-ssn-encryption-foundation*
*Context gathered: 2026-03-27*
