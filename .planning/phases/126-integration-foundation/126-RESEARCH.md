# Phase 126: Integration Foundation - Research

**Researched:** 2026-05-11
**Domain:** SQLite / Drizzle ORM migration, TypeScript interface design, node-cron, React IntegrationsPage extension, AES-256-GCM vault wrapping, SSN exclusion testing
**Confidence:** HIGH — all findings verified directly against project source files

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Add new `integration_connections` table alongside `procore_tokens`. Do NOT alter or migrate `procore_tokens`.
- **D-02:** `integration_connections` schema: `id`, `user_id`, `erp_type` ('procore' | 'sage300' | 'vista'), `credentials_encrypted` (JSON blob AES-256-GCM), `file_path_config` (JSON: import_dir, export_dir), `sync_status` ('idle' | 'running' | 'error'), `consecutive_failure_count` (integer, default 0), `last_sync_at`, `last_error`, `connected_at`, `updated_at`.
- **D-03:** Add `integration_sync_runs` table: `id`, `connection_id` (FK → integration_connections), `erp_type`, `started_at`, `completed_at`, `records_synced`, `errors_count`, `error_detail`, `trigger` ('cron' | 'manual').
- **D-04:** Phase 127 reads from both `procore_tokens` and `integration_connections`. Unification deferred beyond v9.0.
- **D-05:** Sage 300 CRE and Vista cards use `warning` (amber) Badge variant with text "File Exchange".
- **D-06:** Import/export directory paths editable inline on the card — not behind a modal.
- **D-07:** Persistent label on file-ERP cards: "No live connection — place export files in the configured import directory."
- **D-08:** "Import Now" button triggers manual sync, shows loading state, records a sync run.
- **D-09:** All ERP cards in a single section — no visual split. Badge is the only differentiator.
- **D-10:** Create `src/server/integrations/` directory.
- **D-11:** `IErpAdapter` interface in `src/server/integrations/IErpAdapter.ts` with `pullWorkers`, `pullTimesheets`, `pushComplianceStatus`.
- **D-12:** `integrationVault.ts` wraps `encryptSsn`/`decryptSsn` as `encryptCredential`/`decryptCredential`. No new crypto.
- **D-13:** Enable WAL mode in `src/server/db/index.ts` — already present (see CRITICAL FINDING below).
- **D-14:** ERP nightly sync as job #6 in `src/server/index.ts` at `0 2 * * *`, sequential per connection.
- **D-15:** Write `integration_sync_runs` row after each sync attempt; increment `consecutive_failure_count` on error.
- **D-16:** All ERP serializers use explicit inclusion lists; unit test asserts no `/ssn/i` or 9-digit pattern in payloads.

### Claude's Discretion

- Minimal sync status on IntegrationsPage (last-sync timestamp + error badge) — exact format is Claude's call.
- Error toast wording for sync failure and success.
- Whether "Import Now" is disabled while sync is running (Claude should implement the guard).

### Deferred Ideas (OUT OF SCOPE)

- Unifying `procore_tokens` and `integration_connections` — deferred beyond v9.0.
- chokidar file watcher for auto-import — deferred to v10.0.
- Multi-company Procore support — deferred.
- Visual split of IntegrationsPage into "Live" vs "File Exchanges" — rejected in favor of badge differentiation.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INTG-01 | User can view IntegrationsPage showing Procore, Sage 300 CRE, Viewpoint Vista with connect/disconnect and sync status | Existing IntegrationsPage card pattern confirmed; FileErpCard anatomy specified in UI-SPEC |
| INTG-02 | System stores ERP connection state, encrypted credentials, and sync metadata in `integration_connections` table | Migration 0070 needed; Drizzle schema pattern confirmed from procoreTokens definition |
| INTG-03 | SQLite WAL mode and `busy_timeout=5000` at startup | WAL already set — only busy_timeout is missing; add `sqlite.pragma('busy_timeout = 5000')` |
| INTG-04 | `IErpAdapter` TypeScript interface implemented by all three ERP adapters | New `src/server/integrations/IErpAdapter.ts`; D-11 defines exact interface shape |
| INTG-05 | OAuth tokens and API keys encrypted at rest using AES-256-GCM vault | `integrationVault.ts` wraps existing `encryptSsn`/`decryptSsn`; no new crypto |
| INTG-06 | Nightly ERP sync via node-cron, sequential per connection | Job #6 added to `src/server/index.ts` after 5 existing jobs; exact pattern confirmed |
| INTG-07 | User can trigger manual sync for any connected ERP from IntegrationsPage | "Import Now" button on each FileErpCard POSTs to new `/api/erp-integrations/:erpType/sync` route |
| SEC-01 | No outbound ERP payload includes SSN; all serializers use explicit inclusion lists | Serializer stub + unit test asserting no `/ssn/i` field in Phase 126; enforced from day one |
| SEC-02 | All OAuth tokens encrypted before storage using AES-256-GCM; decrypted only at sync call site | `integrationVault.ts` enforces this pattern; existing `procoreService.ts` is the reference |
</phase_requirements>

---

## Summary

Phase 126 delivers the shared infrastructure layer that all nine ERP phases (127-133) depend on. The research found that the codebase is in excellent shape for this phase: WAL mode is already partially configured, the Drizzle schema pattern is consistent and well-established, node-cron has a clear 5-job registration pattern to follow, and `IntegrationsPage.tsx` already contains the card component structure to extend.

The most important discovery is that `sqlite.pragma('journal_mode = WAL')` is already called in `src/server/db/index.ts` at line 11. The only missing piece from D-13 is `busy_timeout`. The planner should add only `sqlite.pragma('busy_timeout = 5000')` on line 12 (after the existing WAL pragma), not re-set WAL mode.

The next migration file is **0070** (last idx in `_journal.json` is 69, tag `0069_copilot_interactions`). Two SQL files are needed: one for `integration_connections` and one for `integration_sync_runs`, or they can be combined into a single `0070_integration_foundation.sql` with `statement-breakpoint` separator.

The `Math.random()` nonce at lines 37 and 626 of `integrations.ts` must be fixed in Phase 126 per the CONTEXT.md security gap, since Phase 126 already edits that file.

**Primary recommendation:** Plan in this wave order: (1) DB migration + schema, (2) vault + adapter interface, (3) WAL busy_timeout + cron job #6, (4) API routes for connection config and manual sync, (5) IntegrationsPage FileErpCard extension, (6) SSN exclusion unit test.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.45.1 (installed) | ORM + migration runner | Already used for all schema; same pattern throughout |
| better-sqlite3 | ^12.8.0 (installed) | SQLite driver | Already the project database driver |
| node-cron | ^4.2.1 (installed) | Scheduled jobs | 5 existing jobs already registered in index.ts |
| node:crypto | built-in | randomBytes for nonce fix | Already imported in procoreService.ts and elsewhere |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ^4.0.18 (installed) | Unit testing | SSN exclusion unit test + serializer assertions |
| supertest | installed | Integration testing | Route-level tests for ERP config + manual sync endpoints |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Drizzle migration files | Drizzle push | `drizzle-kit push` is dev-only; project uses file-based migrations registered in _journal.json |
| node-cron (job #6) | BullMQ / Redis | Explicitly rejected in STATE.md: "nightly ERP sync is cron job #6 in index.ts — no new infrastructure" |

**Installation:** No new packages needed. All dependencies are already installed.

---

## Architecture Patterns

### Recommended Project Structure

```
src/server/integrations/           # NEW directory (D-10)
├── IErpAdapter.ts                 # TypeScript interface (D-11)
└── integrationVault.ts            # Credential encrypt/decrypt wrapper (D-12)

src/server/routes/
└── erpIntegrations.ts             # NEW: connection config + manual sync routes

src/server/db/migrations/
├── 0070_integration_foundation.sql  # integration_connections + integration_sync_runs
└── meta/_journal.json               # Register idx 70, tag 0070_integration_foundation

src/server/db/schema.ts            # Add integrationConnections + integrationSyncRuns tables

src/client/pages/IntegrationsPage.tsx  # Add FileErpCard + two new card instances

tests/
├── server/integrations.vault.test.ts  # integrationVault round-trip test
└── server/erp-serializer.ssn.test.ts  # SSN exclusion assertion (SEC-01)
```

### Pattern 1: Drizzle Schema Definition (from procoreTokens reference)

**What:** New tables added to `src/server/db/schema.ts` using `sqliteTable` with text/integer columns, FK references, and index helper.
**When to use:** Every new table in this project.

```typescript
// Source: src/server/db/schema.ts lines 596-611 (procoreTokens)
export const integrationConnections = sqliteTable('integration_connections', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  erpType: text('erp_type').notNull().$type<'procore' | 'sage300' | 'vista'>(),
  credentialsEncrypted: text('credentials_encrypted'),  // AES-256-GCM JSON blob; null if no creds
  filePathConfig: text('file_path_config'),             // JSON: { import_dir, export_dir }
  syncStatus: text('sync_status').notNull().default('idle').$type<'idle' | 'running' | 'error'>(),
  consecutiveFailureCount: integer('consecutive_failure_count').notNull().default(0),
  lastSyncAt: text('last_sync_at'),
  lastError: text('last_error'),
  connectedAt: text('connected_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  idxIntegrationConnUser: index('idx_integration_connections_user').on(table.userId),
  idxIntegrationConnType: index('idx_integration_connections_type').on(table.erpType),
}));

export const integrationSyncRuns = sqliteTable('integration_sync_runs', {
  id: text('id').primaryKey(),
  connectionId: text('connection_id').notNull().references(() => integrationConnections.id, { onDelete: 'cascade' }),
  erpType: text('erp_type').notNull().$type<'procore' | 'sage300' | 'vista'>(),
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
  recordsSynced: integer('records_synced').notNull().default(0),
  errorsCount: integer('errors_count').notNull().default(0),
  errorDetail: text('error_detail'),
  trigger: text('trigger').notNull().$type<'cron' | 'manual'>(),
}, (table) => ({
  idxSyncRunsConn: index('idx_sync_runs_connection').on(table.connectionId),
}));
```

### Pattern 2: SQL Migration File (from 0056_procore_connections.sql + 0069_copilot_interactions.sql)

**What:** Plain SQL CREATE TABLE with `statement-breakpoint` separator between statements.
**When to use:** Every migration. Register in meta/_journal.json with next sequential idx.

```sql
-- 0070_integration_foundation.sql
CREATE TABLE `integration_connections` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `erp_type` text NOT NULL,
  `credentials_encrypted` text,
  `file_path_config` text,
  `sync_status` text NOT NULL DEFAULT 'idle',
  `consecutive_failure_count` integer NOT NULL DEFAULT 0,
  `last_sync_at` text,
  `last_error` text,
  `connected_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_integration_connections_user` ON `integration_connections` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_integration_connections_type` ON `integration_connections` (`erp_type`);
--> statement-breakpoint
CREATE TABLE `integration_sync_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `connection_id` text NOT NULL,
  `erp_type` text NOT NULL,
  `started_at` text NOT NULL,
  `completed_at` text,
  `records_synced` integer NOT NULL DEFAULT 0,
  `errors_count` integer NOT NULL DEFAULT 0,
  `error_detail` text,
  `trigger` text NOT NULL,
  FOREIGN KEY (`connection_id`) REFERENCES `integration_connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sync_runs_connection` ON `integration_sync_runs` (`connection_id`);
```

_journal.json entry to add:
```json
{
  "idx": 70,
  "version": "6",
  "when": 1747000000000,
  "tag": "0070_integration_foundation",
  "breakpoints": true
}
```

### Pattern 3: node-cron Job Registration (from src/server/index.ts lines 267-325)

**What:** `cron.schedule(expression, async () => { ... }, { timezone })` called inside the `server.listen()` callback.
**When to use:** All cron jobs in this project.

```typescript
// Source: src/server/index.ts lines 267-275 (job #1 pattern)
// Register ERP nightly sync — INTG-06 (Phase 126)
// Cron: 2:00 AM local every night; sequential per connection (SQLite single-writer)
cron.schedule('0 2 * * *', async () => {
  logger.info('erp-sync: starting nightly ERP sync');
  try {
    await runErpNightlySync();
  } catch (err) {
    logger.error({ err }, 'erp-sync: nightly sync failed');
    // Never rethrow — cron failures must not crash Express
  }
}, { timezone: 'America/Los_Angeles' });
```

Key rules from existing pattern:
- Always wrapped in try/catch — never rethrow
- log entry at start with descriptive label (e.g., `'erp-sync: ...'`)
- Registered inside `server.listen()` callback (not at module top-level)
- `runErpNightlySync` imported from a dedicated jobs file (e.g., `src/server/jobs/erpNightlySync.ts`)

### Pattern 4: integrationVault.ts — Semantic Wrapper (D-12)

**What:** Re-exports `encryptSsn`/`decryptSsn` under domain-appropriate names. Zero new crypto logic.

```typescript
// Source: CONTEXT.md D-12; cryptoService.ts pattern
// src/server/integrations/integrationVault.ts
export { encryptSsn as encryptCredential, decryptSsn as decryptCredential } from '../services/cryptoService.js';
```

### Pattern 5: IErpAdapter Interface (D-11)

```typescript
// src/server/integrations/IErpAdapter.ts
export interface SyncResult {
  recordsSynced: number;
  errors: string[];
}

export interface IErpAdapter {
  pullWorkers(connectionId: string): Promise<SyncResult>;
  pullTimesheets(connectionId: string, since: Date): Promise<SyncResult>;
  pushComplianceStatus(connectionId: string, weekId: string): Promise<SyncResult>;
}
```

### Pattern 6: Math.random() Nonce Fix (Security gap from CONTEXT.md)

**What:** Replace `Math.random().toString(36)` with `crypto.randomBytes(16).toString('hex')` at lines 37 and 626 of `integrations.ts`.

```typescript
// BEFORE (insecure — lines 37 and 626)
const state = Buffer.from(JSON.stringify({ userId, nonce: Math.random().toString(36) })).toString('base64url');

// AFTER (cryptographically secure)
import { randomBytes } from 'node:crypto';
const state = Buffer.from(JSON.stringify({ userId, nonce: randomBytes(16).toString('hex') })).toString('base64url');
```

Both instances must be fixed: line 37 (QBO OAuth connect) and line 626 (Procore OAuth connect).

### Pattern 7: WAL busy_timeout Addition (D-13 — CRITICAL FINDING)

**CRITICAL FINDING:** `journal_mode = WAL` is ALREADY set at `src/server/db/index.ts` line 11. The STATE.md note "Confirm: check whether PRAGMA journal_mode=WAL is already set" is now resolved — it is set. Only `busy_timeout` is missing.

Add exactly one line:
```typescript
// src/server/db/index.ts — current state (verified)
sqlite.pragma('journal_mode = WAL');  // line 11 — already present
sqlite.pragma('foreign_keys = ON');   // line 12 — already present

// ADD after line 11 or 12:
sqlite.pragma('busy_timeout = 5000');  // INTG-03 — prevents SQLITE_BUSY during sync
```

### Pattern 8: SSN Exclusion Unit Test (SEC-01)

**What:** Unit test that instantiates a stub serializer, calls it with a worker row that includes ssn fields, and asserts the output contains no matching keys.

```typescript
// tests/server/erp-serializer.ssn.test.ts
describe('ERP serializers — SSN exclusion (SEC-01)', () => {
  it('stub serializer produces no ssn fields', () => {
    const workerRow = {
      id: 'w1', name: 'Jane Doe',
      ssnEncrypted: 'enc:...',  // field that must never appear in output
      tradeClassification: 'Carpenter',
      baseRateSnapshot: '45.00',
    };
    const payload = serializeWorkerForErp(workerRow);
    const payloadStr = JSON.stringify(payload);
    expect(payloadStr).not.toMatch(/ssn/i);
    expect(payloadStr).not.toMatch(/\b\d{9}\b/);  // 9-digit SSN pattern
  });
});
```

The serializer stub in Phase 126 must use explicit inclusion lists (never `{ ...workerRow }`).

### Pattern 9: FileErpCard Component (UI-SPEC verified)

**What:** Local named component inside `IntegrationsPage.tsx` (not a separate file — single-use pattern).

Toast API: `const { add } = useToast()` from `'../contexts/ToastContext'`. Call `add('success', message)` or `add('error', message)`.

Badge variant for "File Exchange": `warning` (amber) — confirmed from `Badge.tsx` variant types.

Card order: QBO → QB Employee Import/Timesheet sections → Procore → **Sage 300 CRE** → **Viewpoint Vista** → Security footnote → Enterprise SSO.

### Anti-Patterns to Avoid

- **Spreading worker rows in serializers:** `{ ...workerRow }` in any ERP outbound payload — violates SEC-01. Always use explicit field lists.
- **Re-implementing crypto:** `integrationVault.ts` must import from `cryptoService.ts`, never call `createCipheriv` directly.
- **Registering cron jobs outside `server.listen()` callback:** All 5 existing jobs are inside the callback — job #6 must follow the same pattern.
- **Adding `idx` gap in _journal.json:** Next idx must be exactly 70 (current last is 69). Any gap causes Drizzle to skip migrations silently.
- **Setting WAL mode again:** `journal_mode = WAL` is already set. Adding it again is harmless but misleading. Only add `busy_timeout`.
- **Using `Promise.all` for sync DB writes:** STATE.md locked decision: "Sequential DB writes in syncOrchestrator.ts — never Promise.all against SQLite."

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Credential encryption | New AES implementation | `encryptSsn`/`decryptSsn` via `integrationVault.ts` | Already battle-tested with startup self-test; key loaded at process start |
| Cron scheduling | setInterval / setTimeout | `node-cron` (already installed) | Supports cron expressions, timezone-aware, already used 5 times |
| Toast notifications | Custom state management | `useToast()` from `ToastContext` | `add(variant, message)` API already wired to `ToastContainer` in App.tsx |
| DB migration runner | Manual schema sync | Drizzle migrator + `_journal.json` | Auto-runs on startup for non-test env; skipping journal registration causes silent failure |

**Key insight:** This phase is pure infrastructure extension — every primitive (crypto, cron, toasts, migrations, Drizzle, test helpers) is already installed and in use. No new packages are needed.

---

## Runtime State Inventory

Step 2.5: SKIPPED — Phase 126 is a greenfield extension, not a rename or migration of existing state. No stored data is being renamed or migrated. `procore_tokens` is explicitly left untouched (D-01).

---

## Environment Availability Audit

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node-cron | INTG-06 nightly sync | Yes | ^4.2.1 | — |
| better-sqlite3 | INTG-02/03 DB | Yes | ^12.8.0 | — |
| drizzle-orm | INTG-02 schema | Yes | ^0.45.1 | — |
| vitest | SEC-01 tests | Yes | ^4.0.18 | — |
| node:crypto | INTG-05, nonce fix | Yes | built-in | — |

**No missing dependencies.** All required tooling is already installed.

---

## Common Pitfalls

### Pitfall 1: WAL Already Set — Don't Double-Set It

**What goes wrong:** Plan specifies adding `PRAGMA journal_mode=WAL` when it is already line 11 in `db/index.ts`.
**Why it happens:** CONTEXT.md D-13 says "add WAL PRAGMA" and STATE.md has a "Confirm" note, which can be read as "WAL is not yet set."
**How to avoid:** Only add `busy_timeout = 5000`. The research confirms WAL is already active.
**Warning signs:** If implementation adds `sqlite.pragma('journal_mode = WAL')` a second time, tests will pass (it's idempotent) but code is misleading.

### Pitfall 2: _journal.json idx Must Be Exactly 70

**What goes wrong:** Migration file created but `_journal.json` not updated, or idx is set to wrong number.
**Why it happens:** CLAUDE.md rule: "Always register in `meta/_journal.json` — Drizzle silently skips files not in the journal."
**How to avoid:** Verify last idx is 69 before writing 70. The file `0069_copilot_interactions.sql` is the current last file.
**Warning signs:** Migration file exists but tables are not created at startup.

### Pitfall 3: Math.random() at TWO Locations in integrations.ts

**What goes wrong:** Fixing only line 37 (QBO) but missing line 626 (Procore).
**Why it happens:** The security fix is mentioned as a single item but both OAuth flows use the same insecure pattern.
**How to avoid:** Fix both line 37 and line 626. Verify with grep after editing.
**Warning signs:** `grep -n "Math.random" src/server/routes/integrations.ts` returns any results.

### Pitfall 4: integrationVault.ts Must Import from cryptoService, Not Re-implement

**What goes wrong:** Implementer writes new AES logic in `integrationVault.ts` instead of re-exporting from `cryptoService.ts`.
**Why it happens:** The task says "no new crypto implementation" but the implementer adds "just a thin wrapper."
**How to avoid:** `integrationVault.ts` must be a pure re-export — no `createCipheriv`, no `randomBytes`, no key loading.
**Warning signs:** Any import from `node:crypto` directly inside `integrationVault.ts`.

### Pitfall 5: FileErpCard Not Extracting to a Separate File

**What goes wrong:** `FileErpCard` created as `src/client/components/ui/FileErpCard.tsx` (separate file) instead of a local component in `IntegrationsPage.tsx`.
**Why it happens:** Habit of creating new component files.
**How to avoid:** UI-SPEC explicitly states: "Create as a named component within IntegrationsPage.tsx (not a separate file — single-use pattern consistent with EmployeeImportSection and SyncTimesheetSection in the same file)."

### Pitfall 6: SSN Serializer Test Must Run Against Actual Output Shape

**What goes wrong:** Test mocks the serializer and asserts on mock output — false assurance.
**Why it happens:** Over-mocking in tests.
**How to avoid:** Test must import the actual stub serializer function and pass it a worker row with `ssnEncrypted` and similar fields. Assert on the real return value.

### Pitfall 7: Cron Job #6 Timezone

**What goes wrong:** ERP sync job registered without a timezone option, causing DST-dependent firing times.
**Why it happens:** Forgetting the `{ timezone }` option.
**How to avoid:** D-14 specifies `0 2 * * *`. STATE.md does not lock a timezone for this job. Use `'America/Los_Angeles'` (matches HCC's CA-centric contractor base) or `'UTC'` for determinism — Claude's discretion. The existing `runScheduledReports` job uses UTC for determinism (Phase 86 pattern); align to UTC for ERP sync.

---

## Code Examples

### Verified Toast API (from ToastContext.tsx)

```typescript
// Import inside component
const { add } = useToast();

// Success toast
add('success', `Sage 300 CRE sync completed — ${result.recordsSynced} records synced.`);

// Error toast
add('error', `Sync failed — ${errorMsg}. Check the configured import directory.`);
```

Toast duration is 4000ms (`DURATION_MS = 4000` in ToastContext.tsx). No custom duration API exists — use as-is.

### Verified Badge Usage (from Badge.tsx)

```tsx
// "File Exchange" badge — warning variant (amber)
<Badge variant="warning">File Exchange</Badge>

// Sync error badge
<Badge variant="violation" title={lastError ?? undefined}>Sync Error</Badge>
```

Four variants available: `compliant`, `violation`, `warning`, `neutral`.

### Verified Card Usage

```tsx
// Standard card wrapper — padding="default" = p-6 (24px)
<Card padding="default">
  {/* card content */}
</Card>
```

### Verified Cron Pattern (from index.ts line 317)

```typescript
cron.schedule('0 8 * * *', async () => {
  logger.info('scheduled-reports: running daily report dispatch');
  try {
    await runScheduledReports();
  } catch (err) {
    logger.error({ err }, 'scheduled-reports: failed');
    // Never rethrow — cron failures must not crash Express
  }
}, { timezone: 'UTC' });
```

Job #6 follows this exact pattern with `runErpNightlySync`.

### Verified procoreService.ts Pattern (for integrationConnections service)

`src/server/services/procoreService.ts` shows the exact service pattern to follow:
- `getDb()` called inside each function (not at module scope)
- Drizzle `.select().from(table).where(eq(...)).limit(1)` for single-row fetch
- `encryptSsn(token)` at write time; `decryptSsn(encrypted)` at read time
- `randomUUID()` from `'crypto'` for ID generation

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Math.random() OAuth nonce | crypto.randomBytes(16) | Phase 126 (this phase) | Eliminates CSRF predictability vulnerability in QBO + Procore OAuth flows |
| No integration_connections table | Generic ERP connection table | Phase 126 (this phase) | Enables Phases 127-133 to share a single connection registry |
| No busy_timeout | busy_timeout=5000 | Phase 126 (this phase) | Prevents SQLITE_BUSY on concurrent sync + payroll entry writes |

---

## Open Questions

1. **Cron job #6 timezone**
   - What we know: D-14 specifies `0 2 * * *`; no timezone locked; STATE.md has no ERP-specific timezone decision.
   - What's unclear: UTC (deterministic) vs America/Los_Angeles (matches contractor locale).
   - Recommendation: Use `'UTC'` for consistency with `runScheduledReports` (Phase 86 precedent). This means sync fires at 2:00 AM UTC (6:00 PM PST / 9:00 PM EST), which is low-traffic for US contractors. Document in comment.

2. **New route file vs extending integrations.ts**
   - What we know: CONTEXT.md says "extend this file or creates a parallel router." integrations.ts is already large (867+ lines).
   - What's unclear: Whether adding file-ERP config endpoints to integrations.ts creates maintainability issues.
   - Recommendation: Create `src/server/routes/erpIntegrations.ts` (parallel router) mounted at `/api/erp-integrations`. Keeps file-ERP concerns separate from OAuth concerns. Register in index.ts alongside integrationsRouter.

3. **`runErpNightlySync` stub scope for Phase 126**
   - What we know: Phase 126 defines the adapter interface and cron slot, but no ERP-specific sync logic ships until Phase 127.
   - What's unclear: How complete should the nightly sync job be in Phase 126?
   - Recommendation: `runErpNightlySync` in Phase 126 queries `integration_connections`, iterates rows, and calls a no-op stub (logging only). Real adapter dispatch wired in Phase 127. This satisfies INTG-06 (job exists and runs) without coupling to Phase 127 completion.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/server/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INTG-02 | integration_connections and integration_sync_runs tables created by migration | Integration (supertest) | `npx vitest run tests/routes/integrations.test.ts` | Extend existing |
| INTG-03 | busy_timeout=5000 pragma applied at startup | Unit (db init) | `npx vitest run tests/server/` | New Wave 0 |
| INTG-04 | IErpAdapter interface compiles with TypeScript | TypeScript compile (tsc) | `npx tsc --noEmit` | New |
| INTG-05 | integrationVault encryptCredential/decryptCredential round-trips correctly | Unit | `npx vitest run tests/server/integrations.vault.test.ts` | New Wave 0 |
| INTG-06 | runErpNightlySync stub executes without throwing | Unit | `npx vitest run tests/server/erp-nightly.test.ts` | New Wave 0 |
| INTG-07 | POST /api/erp-integrations/:erpType/sync returns 200 for configured connection | Integration | `npx vitest run tests/routes/` | New Wave 0 |
| SEC-01 | No /ssn/i or 9-digit pattern in any ERP serializer output | Unit | `npx vitest run tests/server/erp-serializer.ssn.test.ts` | New Wave 0 |
| SEC-02 | Credentials stored encrypted, decrypted only at call site | Unit (integrationVault test) | `npx vitest run tests/server/integrations.vault.test.ts` | Shared with INTG-05 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/server/ tests/routes/integrations.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work 126`

### Wave 0 Gaps

- [ ] `tests/server/integrations.vault.test.ts` — covers INTG-05, SEC-02
- [ ] `tests/server/erp-serializer.ssn.test.ts` — covers SEC-01
- [ ] `tests/server/erp-nightly.test.ts` — covers INTG-06 (stub invocation)
- [ ] New route tests in `tests/routes/` for `/api/erp-integrations` — covers INTG-07

No new framework installation needed — Vitest + supertest already configured.

---

## Sources

### Primary (HIGH confidence — verified directly against source files)

- `src/server/db/index.ts` — WAL pragma already set at line 11; only busy_timeout missing
- `src/server/db/migrations/meta/_journal.json` — last idx is 69; next migration is 0070
- `src/server/db/migrations/0069_copilot_interactions.sql` — canonical multi-table migration with statement-breakpoint pattern
- `src/server/db/migrations/0056_procore_connections.sql` — procore_tokens schema (add-alongside pattern)
- `src/server/db/schema.ts` lines 596-611 — procoreTokens Drizzle definition pattern
- `src/server/services/cryptoService.ts` — encryptSsn/decryptSsn AES-256-GCM; self-test confirmed
- `src/server/services/procoreService.ts` — service pattern; getDb() inside functions; encrypt at write/decrypt at call site
- `src/server/index.ts` lines 267-325 — 5 cron jobs; exact pattern for job #6; registered inside server.listen() callback
- `src/server/routes/integrations.ts` lines 37 and 626 — both Math.random() nonce locations
- `src/client/pages/IntegrationsPage.tsx` — card rendering pattern; EmployeeImportSection as local component precedent
- `src/client/components/ui/Badge.tsx` — 4 variants: compliant/violation/warning/neutral
- `src/client/components/ui/Input.tsx` — label prop, FieldWrapper, focus-visible:ring-brand-gold
- `src/client/components/ui/Card.tsx` — padding prop: default/sm/none
- `src/client/contexts/ToastContext.tsx` — useToast() → add(variant, message); DURATION_MS=4000
- `vitest.config.ts` — node environment, setupFiles, fileParallelism:false, maxWorkers:1
- `package.json` — vitest^4.0.18, node-cron^4.2.1, drizzle-orm^0.45.1, better-sqlite3^12.8.0 confirmed installed

### Secondary (MEDIUM confidence)

- `.planning/phases/126-integration-foundation/126-CONTEXT.md` — all D-01..D-16 decisions, security gap documentation
- `.planning/phases/126-integration-foundation/126-UI-SPEC.md` — FileErpCard anatomy, toast wording, state machine
- `.planning/STATE.md` — locked decisions including sequential DB writes, no BullMQ, nonce fix requirement

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all packages verified against installed package.json versions
- Architecture: HIGH — all patterns verified against existing source files; no assumptions from training data
- Pitfalls: HIGH — each pitfall traces directly to a verified source code finding or locked STATE.md decision
- WAL finding: HIGH — `sqlite.pragma('journal_mode = WAL')` confirmed at db/index.ts line 11
- Migration numbering: HIGH — _journal.json last idx=69 confirmed by direct read

**Research date:** 2026-05-11
**Valid until:** 2026-06-11 (stable codebase; no moving targets)
