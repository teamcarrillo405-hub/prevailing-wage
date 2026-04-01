# Phase 37: Audit Trail Foundation — Research

**Researched:** 2026-04-01
**Domain:** SQLite + Drizzle ORM schema/migration, TypeScript service layer pattern
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUDIT-01 | `audit_logs` table: UUIDv4 id, ISO 8601 UTC createdAt, userId FK, userEmail denormalized, ipAddress, projectId (onDelete: set null), entityType, entityId, action, diff JSON text, snapshot JSON text, meta JSON text. Three indexes: (project_id, created_at DESC), (entity_type, entity_id, created_at DESC), (user_id, created_at DESC). | Schema pattern from schema.ts + index() from drizzle-orm/sqlite-core; migration format from 0017_project_members.sql |
| AUDIT-02 | `auditService.ts` exports only `insertAuditLog()`. Hybrid payload: snapshot for creates/deletes, diff for updates, meta-only for events. Redact `ssnEncrypted` → `"[REDACTED]"` before write. | Service pattern from payrollService.ts; redaction: key-presence check only, no cryptoService import |
| NFR-01 | All new Drizzle migrations use `--> statement-breakpoint` (one space) separator. | Confirmed in 0017_project_members.sql and 0019_agency_submission.sql |
| NFR-04 | `ssnEncrypted` always redacted before write; `hasFullSsn` boolean carries SSN-present signal. | cryptoService.ts envelope structure confirmed — check `'ssnEncrypted' in obj`, never import cryptoService |
| NFR-05 | All new migration files have a corresponding Drizzle schema update in `src/server/db/schema.ts`. | Additive pattern confirmed from schema.ts |
</phase_requirements>

---

## Summary

Phase 37 creates the infrastructure foundation for the audit trail: an `audit_logs` table in SQLite via Drizzle, and an `auditService.ts` that wraps the single `insertAuditLog()` function with SSN redaction and hybrid diff/snapshot payload logic. No existing tables or routes are modified — this phase is purely additive.

The project uses a well-established pattern across its 37 phases: `randomUUID()` from `crypto` (Node built-in) for IDs, plain SQL migration files with `--> statement-breakpoint` separators, `getDb()` from `src/server/db/index.ts` for DB access, and vitest + supertest for tests. All patterns can be replicated exactly.

The only schema.ts addition needed is adding `index` to the import from `drizzle-orm/sqlite-core` (currently only `uniqueIndex` is imported). The three audit log indexes are non-unique, so `index()` — not `uniqueIndex()` — is required.

**Primary recommendation:** Two plans. Plan 01 = schema.ts addition + migration file + `_journal.json` update. Plan 02 = `auditService.ts` + `tests/services/auditService.test.ts`.

---

## Project Constraints (from CLAUDE.md)

### DB Migration Pattern
- Migrations are plain SQL files in `src/server/db/migrations/`
- **Always register in `meta/_journal.json`** — Drizzle silently skips files not in the journal
- Current highest idx in journal: **16** (tag `0020_payroll_imports`) — next new entry is **idx 17**
- Next migration filename: `0021_audit_logs.sql`
- Never drop or rename columns — add-only migrations only

### Compliance Rules (carry-forward)
- Never hard-delete projects or payroll weeks (29 CFR Part 3)
- Amendments create new rows, never update in place

### Design / Code Conventions
- UUIDs: `randomUUID()` from `'crypto'` (Node built-in) — no `uuid` package
- UTC timestamps: `new Date().toISOString()`
- DB access: `getDb()` from `'../db/index.js'`
- Test DB: `globalThis.__testDb` injected by `tests/helpers/db.ts` via `setupFiles`
- Test env var: `process.env.ENCRYPTION_KEY_V1 = 'a'.repeat(64)` set in `tests/helpers/db.ts`

---

## Standard Stack

### Core (already installed — no new packages needed)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| drizzle-orm | installed | ORM + schema definitions | `index()` already exported from `drizzle-orm/sqlite-core` — just not yet imported in schema.ts |
| better-sqlite3 | installed | SQLite driver | In-memory DB used in tests via `new Database(':memory:')` |
| vitest | installed | Test runner | `setupFiles: ['./tests/helpers/db.ts']` provides in-memory DB |

**No new packages required for this phase.**

---

## Architecture Patterns

### Exact Table Definition Pattern (from schema.ts)

The project uses `sqliteTable` with inline column definitions and a second argument for constraints/indexes. Currently only `uniqueIndex` is imported. For the audit table, `index` must be added to the import.

```typescript
// Current import — must add `index`
import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
```

All existing tables use:
- `text('id').primaryKey()` — text PK (never integer autoincrement)
- `text('created_at').notNull()` — ISO 8601 UTC string
- `.references(() => otherTable.id)` — FK inline on column
- `.references(() => projects.id, { onDelete: 'cascade' })` or `{ onDelete: 'set null' }` for FK behavior
- Second argument `(table) => ({ ... })` for index/uniqueIndex definitions

**Audit table Drizzle schema (exact pattern to use):**

```typescript
// Source: direct observation of schema.ts + drizzle-orm/sqlite-core/indexes.d.ts
export const auditLogs = sqliteTable('audit_logs', {
  id:          text('id').primaryKey(),
  createdAt:   text('created_at').notNull(),

  userId:      text('user_id').references(() => users.id),
  userEmail:   text('user_email'),
  ipAddress:   text('ip_address'),

  projectId:   text('project_id').references(() => projects.id, { onDelete: 'set null' }),

  entityType:  text('entity_type').notNull(),
  entityId:    text('entity_id').notNull(),
  action:      text('action').notNull(),

  diff:        text('diff'),
  snapshot:    text('snapshot'),
  meta:        text('meta'),
}, (table) => ({
  idxAuditProject: index('idx_audit_project_time').on(table.projectId, table.createdAt),
  idxAuditEntity:  index('idx_audit_entity').on(table.entityType, table.entityId, table.createdAt),
  idxAuditUser:    index('idx_audit_user').on(table.userId, table.createdAt),
}));
```

**Note on DESC in Drizzle:** Drizzle's `index()` builder does not expose a `.desc()` modifier for multi-column composite indexes in the SQLite driver as of the installed version. The DESC ordering is specified in the raw SQL migration only (the Drizzle schema entry is the type definition; the SQL migration is the source of truth for index ordering). This is consistent with the existing project pattern where raw SQL migrations are the deployment artifact.

### Exact Migration File Format

Two confirmed patterns from the project:

**Pattern A — CREATE TABLE with multiple statements** (from `0017_project_members.sql`):
```sql
-- 1. Create project_members table (per D-01, D-02)
CREATE TABLE project_members (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  UNIQUE(project_id, user_id)
);
--> statement-breakpoint

-- 2. Backfill ...
INSERT INTO ...;
--> statement-breakpoint

-- 3. ...
ALTER TABLE ...;
```

**Pattern B — Single ALTER statements** (from `0019_agency_submission.sql`):
```sql
ALTER TABLE payroll_weeks ADD COLUMN ca_ecpr_submitted_at text;--> statement-breakpoint
ALTER TABLE payroll_weeks ADD COLUMN wa_lni_submitted_at text;
```

**Critical NFR-01 finding:** The separator is `--> statement-breakpoint` with **exactly one space** before `statement-breakpoint`. Both patterns confirm this. There is never a double space.

**Migration 0021_audit_logs.sql will follow Pattern A** — CREATE TABLE + three CREATE INDEX statements, each separated by `--> statement-breakpoint`.

```sql
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  user_id TEXT REFERENCES users(id),
  user_email TEXT,
  ip_address TEXT,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  diff TEXT,
  snapshot TEXT,
  meta TEXT
);
--> statement-breakpoint
CREATE INDEX idx_audit_project_time ON audit_logs(project_id, created_at DESC);
--> statement-breakpoint
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id, created_at DESC);
--> statement-breakpoint
CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);
```

### Journal Update Pattern

`meta/_journal.json` must receive a new entry. Current highest entry:

```json
{ "idx": 16, "version": "6", "when": 1775200000000, "tag": "0020_payroll_imports", "breakpoints": true }
```

New entry to append (idx 17, timestamp slightly after 16):

```json
{ "idx": 17, "version": "6", "when": 1775300000000, "tag": "0021_audit_logs", "breakpoints": true }
```

### Service File Pattern (from payrollService.ts)

All service files follow this exact structure:
1. Named imports from `'crypto'` (`randomUUID`) and Drizzle operators (`eq`, `desc`, etc.)
2. `import { getDb } from '../db/index.js'` (note `.js` extension — ESM convention)
3. Schema imports from `'../db/schema.js'`
4. Interface/type definitions first
5. Exported async functions, no default export

```typescript
// Source: payrollService.ts lines 1-13 (exact pattern)
import { randomUUID } from 'crypto';
import { eq, desc } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { auditLogs } from '../db/schema.js';
```

**auditService.ts will export:**
- `insertAuditLog(input: InsertAuditLogInput): Promise<void>` — the only exported function
- `diffObjects(before, after, omitFields?)` — helper, also exported for testability
- No `updateAuditLog`, no `deleteAuditLog` — enforces append-only at the TypeScript level

### SSN Redaction Pattern

**Key finding from cryptoService.ts:** The `ssnEncrypted` field stores a JSON envelope string with keys `v`, `len`, `iv`, `tag`, `ct`. The redaction logic in `auditService.ts` must NOT import `cryptoService.ts` — that module runs a startup assertion (`process.exit(1)`) that requires a valid `ENCRYPTION_KEY_V1` env var. Importing it in test contexts without the key would fail.

**Correct approach:** Check for key presence in any object being written to `diff` or `snapshot`:

```typescript
// Source: audit-trail-research.md section 8 + cryptoService.ts observation
const REDACTED_FIELDS = ['ssnEncrypted', 'passwordHash'] as const;

function redactSensitiveFields(obj: Record<string, unknown>): Record<string, unknown> {
  const result = { ...obj };
  for (const field of REDACTED_FIELDS) {
    if (field in result) {
      result[field] = result[field] !== null ? '[REDACTED]' : null;
    }
  }
  return result;
}
```

This function is called on both `before` and `after` objects before `JSON.stringify()` when writing the `diff` column. It is also called on the `snapshot` object for create/delete events.

**NFR-04 note:** `hasFullSsn` is a boolean signal that replaces the encrypted value in consumer-facing contexts. In `auditService.ts`, the redaction means: if `ssnEncrypted` key is present and its value is non-null, emit `hasFullSsn: true` in `meta`, and replace the field value with `"[REDACTED]"` in the diff/snapshot. The `hasFullSsn` field belongs in `meta`, not in the diff itself.

### Test File Pattern (from tests/services/)

Tests for DB-touching services use the `supertest` + `app` + seeded fixture approach (payrollService.test.ts). Tests for pure functions (no DB) use direct import + `describe`/`it`/`expect` without fixtures (importService.test.ts, ecprXmlGenerator.test.ts).

`auditService.ts` mixes both: `insertAuditLog` needs DB, `diffObjects` and `redactSensitiveFields` are pure functions.

**Test file structure for `tests/services/auditService.test.ts`:**

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
// Set env before any module with startup assertions is imported
beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

// Pure function tests (no DB needed)
describe('diffObjects', () => { ... });
describe('redactSensitiveFields', () => { ... });

// DB-touching tests (use globalThis.__testDb via setupFiles)
describe('insertAuditLog', () => { ... });
```

The `tests/helpers/db.ts` `setupFiles` entry runs `beforeAll` that creates `:memory:` SQLite, runs all migrations from `src/server/db/migrations/` (including `0021_audit_logs.sql` once it exists), and sets `globalThis.__testDb`. The `getDb()` function in `src/server/db/index.ts` returns `globalThis.__testDb` in test env — so `insertAuditLog` will use the in-memory DB automatically.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation | Custom ID generator | `randomUUID()` from `'crypto'` | Already used in every service file; Node built-in, no package needed |
| Diff computation | Custom recursive diff | Simple `Object.keys` loop (see pattern below) | Schema is flat; no nested objects in audit-relevant columns |
| JSON storage | Separate JSON table | `text` column + `JSON.stringify` | SQLite pattern already established in project; no jsonb needed |
| Immutability enforcement | SQLite BEFORE DELETE trigger | Export only `insertAuditLog()`, no delete fn | Trigger lives outside Drizzle schema — maintenance gap. App-level is sufficient at this scale (per research doc section 5 pitfall 2) |

---

## Common Pitfalls

### Pitfall 1: Double Space in `statement-breakpoint`
**What goes wrong:** Writing `-->  statement-breakpoint` (two spaces) violates NFR-01 and breaks Drizzle's migration parser.
**Why it happens:** Copy-paste from documentation examples that use two spaces.
**How to avoid:** The separator is always `--> statement-breakpoint` — one space between `-->` and `statement`.
**Warning signs:** Test DB setup throws `SqliteError` on `migrate()` call.

### Pitfall 2: Forgetting `_journal.json` Update
**What goes wrong:** Migration file exists in `src/server/db/migrations/` but Drizzle never runs it. Schema.ts has the table definition but the DB doesn't. Tests fail with "no such table: audit_logs".
**Why it happens:** CLAUDE.md explicitly warns: "Drizzle silently skips files not in the journal."
**How to avoid:** Plan 01 must include journal update as an explicit step, not an afterthought.

### Pitfall 3: Importing cryptoService in auditService
**What goes wrong:** `cryptoService.ts` runs `process.exit(1)` at module level if `ENCRYPTION_KEY_V1` is missing or invalid. Any test that imports `auditService.ts` → `cryptoService.ts` without the env var dies the test process.
**Why it happens:** Developer wants to use `encryptSsn`/`decryptSsn` to detect encrypted values.
**How to avoid:** Redaction is purely structural — check for key name `'ssnEncrypted'` in the object, never inspect the value. Zero imports from cryptoService.

### Pitfall 4: Adding `index` Export Without Updating Schema Import
**What goes wrong:** `index()` call in schema.ts throws "index is not a function" at runtime.
**Why it happens:** Current schema.ts only imports `uniqueIndex`, not `index`.
**How to avoid:** Plan 01 must update the `import` line in schema.ts to add `index` alongside `uniqueIndex`.
**Verification:** `grep "from 'drizzle-orm/sqlite-core'" src/server/db/schema.ts` should show `index` in the import after the plan executes.

### Pitfall 5: DESC Ordering in Drizzle index() Builder
**What goes wrong:** Assuming `index('name').on(table.col)` in the Drizzle schema automatically creates a DESC index. The Drizzle builder for SQLite doesn't expose `.desc()` on multi-column composite indexes in this version.
**How to avoid:** Put the DESC index direction in the raw SQL migration (`created_at DESC`). The Drizzle schema entry is only for TypeScript type awareness. The SQL migration is the actual deployment artifact.

### Pitfall 6: Exporting update/delete functions "just for testing"
**What goes wrong:** AUDIT-02 explicitly requires no update or delete exports. Any accidental export breaks the TypeScript-level immutability guarantee.
**How to avoid:** The test for `insertAuditLog` verifies the insert by reading back from DB directly via `getDb().select()...` — no delete helper is needed.

---

## Code Examples

### insertAuditLog Input Interface
```typescript
// Modeled on payrollService.ts interface pattern
export interface InsertAuditLogInput {
  userId:     string | null;       // null for system actions
  userEmail:  string | null;
  ipAddress:  string | null;       // req.ip; null if not available
  projectId:  string | null;       // null if project deleted
  entityType: string;              // e.g. 'worker', 'payroll_entry'
  entityId:   string;
  action:     string;              // e.g. 'worker.created', 'payroll_entry.updated'
  diff?:      Record<string, unknown> | null;      // { before: {...}, after: {...} }
  snapshot?:  Record<string, unknown> | null;      // full entity state
  meta?:      Record<string, unknown> | null;      // free-form context
}
```

### diffObjects Helper
```typescript
// Source: audit-trail-research.md section 8
export function diffObjects(
  before: Record<string, unknown>,
  after:  Record<string, unknown>,
  omitFields: string[] = ['updatedAt', 'createdAt', 'updated_at', 'created_at'],
): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  const changedBefore: Record<string, unknown> = {};
  const changedAfter:  Record<string, unknown> = {};
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of allKeys) {
    if (omitFields.includes(key)) continue;
    if (before[key] !== after[key]) {
      changedBefore[key] = before[key];
      changedAfter[key]  = after[key];
    }
  }
  if (Object.keys(changedBefore).length === 0) return null;
  return { before: changedBefore, after: changedAfter };
}
```

### insertAuditLog Implementation Sketch
```typescript
export async function insertAuditLog(input: InsertAuditLogInput): Promise<void> {
  const db = getDb();
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  const diffPayload = input.diff
    ? JSON.stringify({
        before: redactSensitiveFields(input.diff.before as Record<string, unknown>),
        after:  redactSensitiveFields(input.diff.after  as Record<string, unknown>),
      })
    : null;

  const snapshotPayload = input.snapshot
    ? JSON.stringify(redactSensitiveFields(input.snapshot))
    : null;

  const metaPayload = input.meta ? JSON.stringify(input.meta) : null;

  await db.insert(auditLogs).values({
    id,
    createdAt,
    userId:     input.userId,
    userEmail:  input.userEmail,
    ipAddress:  input.ipAddress,
    projectId:  input.projectId,
    entityType: input.entityType,
    entityId:   input.entityId,
    action:     input.action,
    diff:       diffPayload,
    snapshot:   snapshotPayload,
    meta:       metaPayload,
  });
}
```

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (version from package.json) |
| Config file | `vitest.config.ts` in project root |
| Setup file | `tests/helpers/db.ts` (runs migrations on in-memory DB) |
| Quick run command | `npx vitest run tests/services/auditService.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUDIT-01 | `audit_logs` table created in DB with all columns | integration | `npx vitest run tests/services/auditService.test.ts` | Wave 0 |
| AUDIT-01 | Three indexes exist (idx_audit_project_time, idx_audit_entity, idx_audit_user) | integration | same | Wave 0 |
| AUDIT-02 | `insertAuditLog()` inserts a row and returns void | integration | same | Wave 0 |
| AUDIT-02 | `insertAuditLog()` with `ssnEncrypted` in diff writes `"[REDACTED]"` | unit | same | Wave 0 |
| AUDIT-02 | `auditService.ts` has no exported `updateAuditLog` or `deleteAuditLog` | TypeScript compile | `npx tsc --noEmit` | n/a (compile check) |
| NFR-01 | Migration file uses `--> statement-breakpoint` with one space | manual/visual | n/a | n/a |
| NFR-04 | `ssnEncrypted` value in diff/snapshot is `"[REDACTED]"`, not encrypted envelope | unit | same | Wave 0 |
| NFR-05 | `auditLogs` export exists in schema.ts | TypeScript compile | `npx tsc --noEmit` | n/a |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/services/auditService.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/services/auditService.test.ts` — covers AUDIT-01, AUDIT-02, NFR-04 (create in Plan 02)

---

## How Many Plans This Phase Needs

**Recommendation: 2 plans.**

**Plan 37-01 — Schema + Migration**
- Add `index` to schema.ts import line
- Add `auditLogs` table definition to `schema.ts` (end of file, new section comment)
- Create `src/server/db/migrations/0021_audit_logs.sql`
- Update `src/server/db/migrations/meta/_journal.json` (add idx 17 entry)
- Verify: `npx vitest run` passes (migration runs on in-memory DB in tests)
- Verify: `npx tsc --noEmit` passes

**Plan 37-02 — auditService + Tests**
- Create `src/server/services/auditService.ts` with `InsertAuditLogInput`, `insertAuditLog()`, `diffObjects()`, `redactSensitiveFields()` (internal)
- Create `tests/services/auditService.test.ts`
- Verify: `npx vitest run tests/services/auditService.test.ts` green
- Verify: `npx vitest run` (full suite still passes)

These are correctly sequenced: Plan 01 establishes the DB table that Plan 02's tests depend on (the migration runs when the in-memory test DB is initialized via `setupFiles`).

---

## Environment Availability

Step 2.6: SKIPPED — this phase creates new files only. No external dependencies beyond what is already installed in the project.

---

## Open Questions

1. **`index()` DESC direction in Drizzle schema type definition**
   - What we know: The raw SQL migration specifies `created_at DESC`. The Drizzle `index()` builder doesn't expose `.desc()` for composite indexes in the installed version (confirmed via `indexes.d.ts`).
   - What's unclear: Whether Drizzle generates a warning at introspect time about the schema not matching the DB index definition.
   - Recommendation: Accept the mismatch — the SQL migration is the source of truth. The Drizzle schema entry is only for TypeScript type awareness. Do not add `.desc()` to the schema if it's not supported; it won't affect runtime query behavior.

2. **`req.ip` accuracy behind Render.com proxy**
   - What we know: Phase 37 creates `auditService.ts` with an `ipAddress` parameter — it does not resolve `req.ip` itself (callers pass `ipAddress` in).
   - What's unclear: Whether `app.set('trust proxy', 1)` is set in the Express app config.
   - Recommendation: This is Phase 38's concern (when `insertAuditLog` is wired to routes). Phase 37 only creates the service that accepts `ipAddress` as a string. No action needed in this phase.

---

## Sources

### Primary (HIGH confidence)
- `src/server/db/schema.ts` — exact import list, table definition syntax, FK patterns, index/uniqueIndex usage
- `src/server/db/migrations/0017_project_members.sql` — multi-statement migration format, `--> statement-breakpoint` one-space pattern
- `src/server/db/migrations/0019_agency_submission.sql` — inline breakpoint format confirmation
- `src/server/db/migrations/meta/_journal.json` — next idx = 17, next tag = `0021_audit_logs`
- `src/server/services/payrollService.ts` — service file structure, `randomUUID` from `'crypto'`, `getDb()` usage
- `src/server/services/cryptoService.ts` — module-level `process.exit(1)` startup assertion; ssnEncrypted envelope structure
- `src/server/db/index.ts` — `getDb()` returns `globalThis.__testDb` in test env
- `tests/helpers/db.ts` — in-memory DB setup, migration runner, `ENCRYPTION_KEY_V1` stub
- `tests/services/ecprXmlGenerator.test.ts` — pure-function test pattern
- `tests/services/payrollService.test.ts` — DB-touching service test pattern
- `vitest.config.ts` — `setupFiles: ['./tests/helpers/db.ts']`
- `node_modules/drizzle-orm/sqlite-core/indexes.d.ts` — confirms `export declare function index(name: string): IndexBuilderOn`
- `.planning/research/audit-trail-research.md` — domain research (SSN redaction, hybrid payload strategy, index rationale)

### Secondary (MEDIUM confidence)
- `CLAUDE.md` — project conventions and migration pattern rules

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in use
- Schema/migration patterns: HIGH — read directly from source files
- Service file structure: HIGH — read directly from payrollService.ts
- SSN redaction approach: HIGH — confirmed by reading cryptoService.ts startup behavior
- Test patterns: HIGH — read from existing test files

**Research date:** 2026-04-01
**Valid until:** Stable — no external dependencies; all findings from project source files
