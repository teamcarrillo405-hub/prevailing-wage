# Phase 126: Integration Foundation - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the shared infrastructure every ERP phase (127-133) depends on:
- Generic `integration_connections` + `integration_sync_runs` DB tables
- `IErpAdapter` TypeScript interface (all 3 adapters implement it)
- `integrationVault.ts` — semantic wrapper around existing AES-256-GCM credential encryption
- SQLite WAL mode + `busy_timeout=5000` enabled at startup
- Nightly ERP sync registered as cron job #6 (node-cron, sequential per connection)
- IntegrationsPage extended with Sage 300 CRE and Viewpoint Vista file-exchange cards
- SSN exclusion enforced via unit assertions on all ERP serializers

This phase does NOT implement any ERP-specific sync logic — that starts in Phase 127.

</domain>

<decisions>
## Implementation Decisions

### DB Table Strategy
- **D-01:** Add a new generic `integration_connections` table alongside the existing `procore_tokens` table. Do NOT alter or migrate `procore_tokens` — it stays as-is for backward compatibility with existing QBO + Procore flows.
- **D-02:** `integration_connections` schema: `id`, `user_id`, `erp_type` (enum: 'procore' | 'sage300' | 'vista'), `credentials_encrypted` (JSON blob, AES-256-GCM), `file_path_config` (JSON: import_dir, export_dir — for file-based ERPs), `sync_status` ('idle' | 'running' | 'error'), `consecutive_failure_count` (integer, default 0), `last_sync_at`, `last_error`, `connected_at`, `updated_at`.
- **D-03:** Add `integration_sync_runs` table: `id`, `connection_id` (FK → integration_connections), `erp_type`, `started_at`, `completed_at`, `records_synced`, `errors_count`, `error_detail`, `trigger` ('cron' | 'manual').
- **D-04:** Phase 127 (Procore) will read from both `procore_tokens` (existing OAuth token storage) and `integration_connections` (generic status/config). The long-term migration to unify them is deferred beyond v9.0.

### IntegrationsPage — File ERP Cards (Sage 300 + Vista)
- **D-05:** Sage 300 CRE and Viewpoint Vista cards use a **"File Exchange"** badge (gold/neutral, not the green "Connected" badge). This communicates clearly that there is no live OAuth handshake.
- **D-06:** Import and export directory paths are editable **inline on the card** (not behind a modal). Input fields appear directly on the card with a Save button.
- **D-07:** Each file-ERP card shows a persistent label: _"No live connection — place export files in the configured import directory."_
- **D-08:** An **"Import Now"** button on each file-ERP card triggers a manual sync for that ERP. The button shows a loading state and a success/error toast. The sync run is recorded in `integration_sync_runs`.
- **D-09:** Page layout: keep all ERP cards in a single section (no visual split between "Live" and "File"). The "File Exchange" badge on Sage/Vista cards is sufficient to communicate the difference without splitting the page.

### IErpAdapter Interface
- **D-10:** Create `src/server/integrations/` directory (new, clean separation from `src/server/services/`).
- **D-11:** `IErpAdapter` interface in `src/server/integrations/IErpAdapter.ts`:
  ```ts
  interface SyncResult { recordsSynced: number; errors: string[]; }
  interface IErpAdapter {
    pullWorkers(connectionId: string): Promise<SyncResult>;
    pullTimesheets(connectionId: string, since: Date): Promise<SyncResult>;
    pushComplianceStatus(connectionId: string, weekId: string): Promise<SyncResult>;
  }
  ```
- **D-12:** `integrationVault.ts` in `src/server/integrations/` wraps `encryptSsn`/`decryptSsn` from `cryptoService.ts` with semantically named exports (`encryptCredential`, `decryptCredential`). No new crypto implementation.

### SQLite WAL Mode
- **D-13:** Enable WAL mode in `src/server/db/index.ts` at DB initialization time (before any route is registered). Use raw `PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;` via Drizzle's `db.run()` or equivalent. This is a one-time DB-level setting.

### Nightly Cron Slot
- **D-14:** Register ERP nightly sync as job #6 in `src/server/index.ts` alongside the 5 existing cron jobs. Schedule: `0 2 * * *` (2 AM local). Job iterates all `integration_connections` rows with `erp_type` and calls the appropriate adapter's `pullWorkers` + `pullTimesheets` + `pushComplianceStatus` sequentially. SQLite single-writer constraint means sequential (not parallel) per connection.
- **D-15:** On each sync job exit (success or error), write a row to `integration_sync_runs`. Increment `consecutive_failure_count` on error; reset to 0 on success.

### SSN Exclusion
- **D-16:** All ERP outbound serializers (even stub implementations in Phase 126) use explicit inclusion lists — spread operator on worker rows is prohibited. Add a unit test that asserts no field matching `/ssn/i` or a 9-digit numeric pattern appears in any serialized ERP payload.

### Claude's Discretion
- Minimal sync status on IntegrationsPage (last-sync timestamp + error badge) — Phase 134 is the full history dashboard. Claude decides the exact display format.
- Error toast wording for sync failure and success.
- Whether "Import Now" is disabled while a sync is already running (Claude should implement this guard).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Integration Infrastructure
- `src/server/routes/integrations.ts` — existing QBO + Procore OAuth routes; Phase 126 extends this file or creates a parallel router
- `src/server/services/procoreService.ts` — existing Procore token save/get/refresh; Phase 126 wraps with integrationVault pattern
- `src/server/db/migrations/0056_procore_connections.sql` — existing `procore_tokens` table schema; Phase 126 adds alongside it
- `src/client/pages/IntegrationsPage.tsx` — existing IntegrationsPage (QBO + Procore); Phase 126 extends with Sage + Vista cards

### Cryptography Pattern
- `src/server/services/cryptoService.ts` — `encryptSsn`/`decryptSsn` AES-256-GCM implementation; Phase 126 wraps these, never reimplements

### UI Primitives
- `src/client/components/ui/Card.tsx` — use for ERP connection cards
- `src/client/components/ui/Badge.tsx` — use variants: `compliant` (Connected), `neutral` (File Exchange), `violation` (Error)
- `src/client/components/ui/Button.tsx`, `Input.tsx`, `PageHeader.tsx` — standard primitives

### Phase Requirements
- `.planning/REQUIREMENTS.md` §Integration Foundation (INTG-01 through INTG-07, SEC-01, SEC-02)
- `.planning/research/ARCHITECTURE.md` — adapter interface design, cron pattern, vault wrapper details
- `.planning/research/PITFALLS.md` — WAL mode setup, SSN exclusion pattern, consecutive failure tracking

### DB Migration Pattern
- `src/server/db/migrations/` — plain SQL `ALTER TABLE`/`CREATE TABLE` files; register in `meta/_journal.json`
- `src/server/db/schema.ts` — Drizzle schema definitions; new tables added here

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `encryptSsn` / `decryptSsn` (cryptoService.ts): Wrap as `encryptCredential` / `decryptCredential` in integrationVault.ts — no new crypto needed
- `IntegrationsPage.tsx`: Already renders QBO + Procore cards; extend with Sage + Vista cards using same Card primitive
- `procore_tokens` table + `procoreService.ts`: Leave untouched; Phase 126 adds generic layer alongside
- `requireAuth` middleware: Already applied to all `/api/integrations/*` routes
- node-cron: Already running 5 jobs in `src/server/index.ts` — register job #6 here
- `SyncStatusIndicator` component in `src/client/components/ui/`: May be reusable for per-card sync status display

### Established Patterns
- Token encryption: `encryptSsn(plaintext)` → store; `decryptSsn(ciphertext)` → use at call site only
- Migrations: Plain SQL files in `src/server/db/migrations/`, registered in `meta/_journal.json`
- Route auth: `requireAuth` middleware on all protected routes
- Audit/activity: Write to audit_log for sensitive actions (connect/disconnect an ERP is auditable)

### Integration Points
- `src/server/index.ts` — cron job registration (add ERP sync as job #6)
- `src/server/db/index.ts` — DB init (add WAL PRAGMA here before routes load)
- `src/server/routes/integrations.ts` — extend with Sage/Vista config routes, or create `src/server/routes/erpIntegrations.ts`
- `src/client/App.tsx` — IntegrationsPage already routed; no routing changes needed

### Security Gaps to Fix (from ARCHITECTURE research)
- `integrations.ts` line ~44: `Math.random()` used for OAuth state nonce → replace with `crypto.randomBytes(16).toString('hex')` (Phase 126, since we're editing this file)
- State `userId` decoded from base64 but not verified against DB → add DB lookup before use

</code_context>

<specifics>
## Specific Ideas

- File Exchange badge should be gold/neutral tone — matches brand and communicates "informational, not an error" vs red Error badge
- "Import Now" button disabled while sync is in-flight (prevent double-trigger)
- Inline path config on file-ERP cards (not behind a modal) — reduces friction for Sage/Vista setup
- Message on file-ERP cards: _"No live connection — place export files in the configured import directory."_

</specifics>

<deferred>
## Deferred Ideas

- Unifying `procore_tokens` and `integration_connections` into a single table — deferred beyond v9.0
- chokidar file watcher for auto-import when file lands in directory — deferred to v10.0 (manual trigger sufficient)
- Multi-company Procore support — deferred
- Visual split of IntegrationsPage into "Live Connections" vs "File Exchanges" sections — rejected in favor of badge differentiation

</deferred>

---

*Phase: 126-integration-foundation*
*Context gathered: 2026-05-11*
