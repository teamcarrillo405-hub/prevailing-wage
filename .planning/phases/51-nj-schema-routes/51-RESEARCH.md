# Phase 51: NJ Schema + Routes - Research

**Researched:** 2026-04-13
**Domain:** SQLite/Drizzle schema migration, Express route extension, React form state-gating
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NJ-01 | NJ is a selectable project state. NJ project form shows NJ Public Works Contractor Registration Number (`njPwcNumber`) and NJ Contract ID fields when state=NJ. NJ projects show a state-gated "Download NJ MW-562" button on PayrollWeekDetailPage. | Schema: 2 new project columns. ProjectForm: `isNJ` guard + field block. STATE_FORMS entry: `NJ: { route: 'nj-mw562' }`. Export stub route. |
| NJ-02 | New nullable worker EEO field: `workerSex` (text: `'M'` / `'F'` / `'N'` / null). Shown on WorkersPage for NJ projects (alongside existing demographics for IL). Not shown for non-NJ. | Schema: 1 new workers column. WorkerSchema on server + client: add `workerSex`. WorkersPage: `isNJ` guard around sex select. |
| NFR-01 | All new Drizzle migrations use `--> statement-breakpoint` separator between SQL statements; single-statement migrations need no separator. | Confirmed pattern in all existing multi-statement migrations (0029_ma_schema.sql is canonical). |
</phase_requirements>

---

## Summary

Phase 51 is a schema-plus-UI-wiring phase that follows the same pattern as Phase 49 (MA schema + UI). The deliverables are: one SQL migration file, Drizzle schema additions, server-side Zod schema/route updates, and client-side ProjectForm + WorkersPage + PayrollWeekDetailPage updates.

NJ reuses the existing `race` and `ethnicity` columns from Phase 42 (IL). The only new worker column is `workerSex` — a text column distinct from the existing `gender` column. NJ also needs two new project columns (`njPwcNumber` and `njContractId`). The WorkersPage already has an `isNJ` variable set, and the `(isMA || isNJ)` dual-gate for isWoman/isMinority/oshaTraining is already live. Phase 51 adds the `workerSex` field behind an `isNJ`-only gate.

The MA-CPR export route pattern is canonical for the NJ stub: `assertProjectAccess` before state gate, 403/404 handling, then return 501 (Phase 52 fills in the PDF generator). The STATE_FORMS registry already exists in `PayrollWeekDetailPage.tsx` and receives a single NJ entry.

**Primary recommendation:** Mirror Phase 49's three-touch approach — (1) migration + schema, (2) server routes, (3) client UI — but the NJ surface area is smaller than MA because no new payroll entry columns are needed.

---

## Standard Stack

### Core (already installed — no new packages)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| Drizzle ORM (better-sqlite3) | installed | Schema + migration | `text()` column, nullable by default |
| Zod | installed | Server + client validation | `.optional().nullable()` for update schemas |
| React Hook Form | installed | ProjectForm | `watch('state')` already drives `isNJ` |
| Vitest + Supertest | installed | Integration tests | Pattern from workers.test.ts + export.test.ts |

No new packages required.

---

## Architecture Patterns

### Established Pattern: State-Gated Project Column Addition (Phase 49 MA canonical)

**Migration file:** `0030_nj_schema.sql`
- Multiple statements require `--> statement-breakpoint` between each (NFR-01)
- File must be registered in `meta/_journal.json` at idx 26 (current highest is idx 25, tag `0029_ma_schema`)

**Schema additions in `src/server/db/schema.ts`:**
- `projects` table: two new nullable `text()` columns with a `// Phase 51` comment
- `workers` table: one new nullable `text()` column (`workerSex`)

**Server route: `src/server/routes/projects.ts`:**
- Add `njPwcNumber` and `njContractId` to both `CreateProjectSchema` and `UpdateProjectSchema` (z.string().max(N).optional())
- Add fields to the `db.insert(projects).values(...)` block and to the PATCH handler

**Server route: `src/server/routes/workers.ts`:**
- Add `workerSex: z.enum(['M', 'F', 'N']).optional()` to `CreateWorkerSchema`
- Add `workerSex: z.enum(['M', 'F', 'N']).optional().nullable()` to `UpdateWorkerSchema`
- Add to insert/update db calls

**Server route: `src/server/routes/export.ts`:**
- Add `GET /api/export/nj-mw562/:weekId` stub:
  - Pattern: load week → `assertProjectAccess` (before state gate, NFR-03) → state gate (`project.state?.toUpperCase() !== 'NJ'` → 400) → return 501
  - Phase 52 fills in the PDF generator

**Client: `src/client/components/projects/ProjectForm.tsx`:**
- Add `njPwcNumber` and `njContractId` to the Zod schema
- Add `const isNJ = stateValue?.toUpperCase() === 'NJ';`
- Add `{isNJ && (...)}` block with two input fields (pattern: teal border, same as MA block)

**Client: `src/client/pages/WorkersPage.tsx`:**
- `workerSex` field in the edit form (already has `isNJ` variable):
  - Add `workerSex: null as string | null` to `editForm` state
  - Send `workerSex` in the `isNJ` branch of `updateWorker` mutation
  - Add `workerSex` to the worker type interface
  - Add `{isNJ && ...}` block inside the edit form for a `<select>` with options M/F/N/null
  - Display `workerSex` in the read-only card view for NJ projects

**Client: `src/client/pages/PayrollWeekDetailPage.tsx`:**
- Add `NJ: { downloadLabel: 'Download NJ MW-562', route: 'nj-mw562' }` to STATE_FORMS registry
- That is the only change needed — the `stateFormConfig` lookup and `handleStateFormDownload` already handle it generically

### Project Structure (no new files for UI, one new migration, one new export route section)

```
src/server/db/migrations/
  0030_nj_schema.sql          NEW — workers.worker_sex + projects.nj_pwc_number, nj_contract_id
  meta/_journal.json          EDIT — add idx 26 entry for 0030_nj_schema

src/server/db/schema.ts       EDIT — workerSex on workers, njPwcNumber/njContractId on projects
src/server/routes/projects.ts EDIT — NJ fields in CreateProjectSchema + UpdateProjectSchema + insert/update
src/server/routes/workers.ts  EDIT — workerSex in Create/UpdateWorkerSchema + insert/update
src/server/routes/export.ts   EDIT — add nj-mw562 stub route

src/client/components/projects/ProjectForm.tsx  EDIT — isNJ + NJ field block
src/client/pages/WorkersPage.tsx               EDIT — workerSex field, NJ gate
src/client/pages/PayrollWeekDetailPage.tsx     EDIT — NJ entry in STATE_FORMS registry

tests/routes/workers.test.ts  EDIT — NJ-02 tests (workerSex CRUD)
tests/routes/export.test.ts   EDIT — NJ-01 tests (nj-mw562 route: 404, 400 state gate, 501 stub)
tests/routes/projects.test.ts EDIT — NJ project fields (create + update)
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State-gating the download button | Per-state boolean block | STATE_FORMS registry (already in PayrollWeekDetailPage) | Phase 47 refactor; adding NJ is a one-line dict entry |
| DB-layer nullable booleans | Drizzle `.notNull().default()` | `integer({ mode: 'boolean' })` with no `.notNull()` or `.default()` | Phase 49 MA pattern — nullable means no default |
| Text enum for workerSex | DB-level CHECK constraint | Zod enum validation at route layer only | Phase 42 IL `skillLevel` pattern: `text()` in schema, z.enum in Zod |
| IDOR check | Manual userId === projectUserId | `assertProjectAccess(db, week.projectId, userId)` | Centralized guard, tested cross-tenant |

---

## Common Pitfalls

### Pitfall 1: Missing `_journal.json` registration
**What goes wrong:** Drizzle silently skips migration files not registered in `meta/_journal.json`. The `workerSex` column never gets created; column-not-found errors appear at runtime.
**Why it happens:** The journal is the authoritative list of migrations to run; the SQL file alone is insufficient.
**How to avoid:** After writing `0030_nj_schema.sql`, immediately add a new entry to `_journal.json` at the next idx (26). Current highest is idx 25, tag `0029_ma_schema`.
**Warning signs:** Tests that insert `workerSex` throw SQLite "table workers has no column named worker_sex" errors.

### Pitfall 2: workerSex vs. gender column confusion
**What goes wrong:** Developer reuses the existing `gender` text column for workerSex, breaking IL demographics or blending legally distinct concepts.
**Why it happens:** Both fields are text columns on the workers table. The existing `gender` column stores gender identity (IL IDOL EEO); `workerSex` is the legally-required biological sex field on the NJ MW-562 compliance form.
**How to avoid:** Add `workerSex` as a separate column. Never write to `gender` for NJ. The decision is locked in STATE.md.
**Warning signs:** IL demographics tests break; NJ MW-562 PDF generator (Phase 52) receives the wrong value.

### Pitfall 3: Forgetting `assertProjectAccess` before state gate in export stub
**What goes wrong:** An unauthenticated or cross-tenant user can probe whether a payroll week exists for a project they don't own by calling the NJ export endpoint and seeing a different error code.
**Why it happens:** It's tempting to put the state gate first as a fast-fail. But NFR-03 requires authorization before any data access.
**How to avoid:** Follow the exact pattern of `ma-cpr` in `export.ts`: load week → assertProjectAccess → state gate → return 501.
**Warning signs:** Export test for IDOR (cross-tenant) returns 400 (state gate hit) instead of 403 (access denied).

### Pitfall 4: workerSex sent for non-NJ projects
**What goes wrong:** The WorkersPage edit mutation sends `workerSex` unconditionally, storing an arbitrary string for non-NJ workers that the server happily accepts.
**Why it happens:** The client-side Zod schema accepts any optional string without a state gate.
**How to avoid:** Gate `workerSex` behind `isNJ` in the client mutation (same as isMA/isNJ gate for isWoman/isMinority). The server does not need a state gate on the workers route itself — the field is nullable and harmless — but the UI should not surface it.
**Warning signs:** Workers on non-NJ projects show a Sex field in the edit form.

### Pitfall 5: NFR-01 statement-breakpoint format
**What goes wrong:** Migration has three statements with no separator, or uses `-- statement-breakpoint` (two dashes) instead of `--> statement-breakpoint` (arrow).
**Why it happens:** The Drizzle separator format is non-obvious.
**How to avoid:** Check `0029_ma_schema.sql` — it is the immediate predecessor and uses the correct format. Three statements = two separators.
**Warning signs:** Migration fails with a syntax error on the second or third ALTER TABLE statement.

### Pitfall 6: STATE_FORMS route key must match the export route path exactly
**What goes wrong:** STATE_FORMS entry uses `route: 'nj-mw562'` but the export route is `GET /api/export/nj_mw562/:weekId` — the `handleStateFormDownload` function constructs `/api/export/${route}/${weekId}`, so a mismatch causes a 404.
**Why it happens:** Route strings are typed as plain strings with no compile-time enforcement.
**How to avoid:** Verify the route key exactly matches the Express route path segment after `/api/export/`. Use `nj-mw562` (hyphen, matching `ma-cpr` convention).

---

## Code Examples

### Migration file (NFR-01 pattern)
```sql
-- Source: 0029_ma_schema.sql (canonical multi-statement pattern)
ALTER TABLE workers ADD COLUMN worker_sex TEXT;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN nj_pwc_number TEXT;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN nj_contract_id TEXT;
```
Three statements = two breakpoints.

### Drizzle schema additions
```typescript
// src/server/db/schema.ts — workers table (after Phase 49 columns)
// Phase 51 — NJ EEO field (legally-required sex, distinct from gender identity)
workerSex: text('worker_sex'),

// src/server/db/schema.ts — projects table (after Phase 49 MA columns)
// Phase 51 — New Jersey-specific fields
njPwcNumber: text('nj_pwc_number'),
njContractId: text('nj_contract_id'),
```

### Server Zod schema additions (workers.ts)
```typescript
// CreateWorkerSchema — NJ EEO sex field
// Phase 51 — NJ worker sex (M/F/N, nullable text)
workerSex: z.enum(['M', 'F', 'N']).optional(),

// UpdateWorkerSchema — nullable for updates
workerSex: z.enum(['M', 'F', 'N']).optional().nullable(),
```

### Export stub route (export.ts)
```typescript
// ── GET /api/export/nj-mw562/:weekId ────────────────────────────────────────
// New Jersey MW-562 — state-gated to NJ projects only
// Phase 51: stub returning 501; Phase 52 fills in the PDF generator

router.get('/nj-mw562/:weekId', async (req, res) => {
  const weekId = req.params.weekId as string;
  const userId = req.user!.userId;

  // 1. Load payroll week
  const week = await getPayrollWeek(weekId);
  if (!week) {
    res.status(404).json({ error: 'Payroll week not found' });
    return;
  }

  // 2. Verify project access (NFR-03) — BEFORE state gate
  const db = getDb();
  let project: Project;
  try {
    project = await assertProjectAccess(db, week.projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  // 3. State gate — NJ MW-562 is NJ-only
  if (project.state?.toUpperCase() !== 'NJ') {
    res.status(400).json({ error: 'NJ MW-562 is only available for New Jersey projects' });
    return;
  }

  // Phase 52 fills in the PDF generator
  res.status(501).json({ error: 'NJ MW-562 PDF generator not yet implemented' });
});
```

### STATE_FORMS registry addition (PayrollWeekDetailPage.tsx)
```typescript
// Add to existing STATE_FORMS object (after MA entry)
NJ: { downloadLabel: 'Download NJ MW-562', route: 'nj-mw562' },
```

### ProjectForm NJ block (ProjectForm.tsx)
```tsx
// Add after isMA block, same teal color scheme or use indigo to distinguish
const isNJ = stateValue?.toUpperCase() === 'NJ';

{isNJ && (
  <div className="space-y-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
    <p className="text-sm font-medium text-indigo-800">New Jersey Project Fields</p>
    <div>
      <label htmlFor="njPwcNumber" className="block text-sm font-medium text-gray-700">
        NJ Public Works Contractor Registration Number
      </label>
      <input id="njPwcNumber" type="text" {...register('njPwcNumber')}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-brand-gold focus:outline-none"
        placeholder="e.g. 123456" />
    </div>
    <div>
      <label htmlFor="njContractId" className="block text-sm font-medium text-gray-700">
        NJ Contract ID
      </label>
      <input id="njContractId" type="text" {...register('njContractId')}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-brand-gold focus:outline-none"
        placeholder="State contract identifier" />
    </div>
    <p className="text-xs text-indigo-600">
      NJ MW-562 certified payroll download will be available on payroll weeks.
    </p>
  </div>
)}
```

### WorkersPage workerSex edit form (WorkersPage.tsx)
```tsx
// In the edit section, add after (isMA || isNJ) workforce block, behind isNJ-only gate
{isNJ && (
  <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
    <p className="text-sm font-medium text-indigo-800 mb-2">NJ EEO — Sex</p>
    <select
      className="w-full rounded border px-2 py-1 text-sm"
      value={editForm.workerSex ?? ''}
      onChange={e => setEditForm(f => ({ ...f, workerSex: e.target.value || null }))}
    >
      <option value="">Not reported</option>
      <option value="M">M — Male</option>
      <option value="F">F — Female</option>
      <option value="N">N — Non-binary / Decline to state</option>
    </select>
  </div>
)}
```

---

## Key Schema Design Decisions (confirmed from STATE.md)

| Decision | Rationale |
|----------|-----------|
| `workerSex` is a separate `text()` column, not reusing `gender` | Legally-required sex on NJ MW-562 is semantically distinct from gender identity (IL IDOL). Different code sets, different forms. |
| `workerSex` values: `'M'` / `'F'` / `'N'` / null | `'N'` covers non-binary and decline-to-state; null means field not yet recorded. Matches NJ-02 spec. |
| No server-side state gate on `workers.ts` for `workerSex` | Field is nullable; storing it on non-NJ workers is harmless. Client gates the UI. |
| `njContractId` is a new project column | The existing `contractNumber` column is CA/general-purpose (eCPR export). NJ needs its own contract identifier field. |
| NJ export stub returns 501 | Phase 52 fills in the PDF generator. Same pattern as Phase 49 MA stub. |
| `isNJ` added to PayrollWeekDetailPage | Not needed for STATE_FORMS (registry handles it), but may be needed for submission tracking row in Phase 52. Safe to add now. |

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x + Supertest 7.x |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/routes/workers.test.ts tests/routes/export.test.ts tests/routes/projects.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NJ-01 | nj-mw562 returns 404 for unknown weekId | integration | `npx vitest run tests/routes/export.test.ts` | Yes — extend |
| NJ-01 | nj-mw562 returns 400 for non-NJ project (state gate) | integration | `npx vitest run tests/routes/export.test.ts` | Yes — extend |
| NJ-01 | nj-mw562 returns 501 for valid NJ project (stub) | integration | `npx vitest run tests/routes/export.test.ts` | Yes — extend |
| NJ-01 | nj-mw562 returns 403 for cross-tenant access (IDOR) | integration | `npx vitest run tests/routes/export.test.ts` | Yes — extend |
| NJ-01 | NJ project fields (njPwcNumber, njContractId) round-trip via POST/GET | integration | `npx vitest run tests/routes/projects.test.ts` | Yes — extend |
| NJ-02 | POST /workers accepts workerSex for NJ worker | integration | `npx vitest run tests/routes/workers.test.ts` | Yes — extend |
| NJ-02 | PUT /workers accepts workerSex update + null round-trip | integration | `npx vitest run tests/routes/workers.test.ts` | Yes — extend |
| NJ-02 | workerSex does not appear on non-NJ project worker by default | integration | `npx vitest run tests/routes/workers.test.ts` | Yes — extend |
| NFR-01 | Migration file uses correct breakpoint format | manual inspection | N/A — verified at write time | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/routes/workers.test.ts tests/routes/export.test.ts tests/routes/projects.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work 51`

### Wave 0 Gaps
None — existing test infrastructure and test files cover all phase requirements. Tests are added to existing files, not new ones.

---

## Environment Availability

Step 2.6: SKIPPED (no new external dependencies — pure schema + route + UI changes within the existing Node.js/SQLite/React stack).

---

## Open Questions

1. **NJ Contract ID field name**
   - What we know: The success criteria says "NJ Contract ID fields" (plural mention but may be one field). The column is new; there's no existing canonical name in the codebase.
   - What's unclear: Whether it should be `njContractId` (generic) or a more specific name like `njDpwProjectNumber`. The NJ MW-562 form header has a "Contract No." field.
   - Recommendation: Use `njContractId` / `nj_contract_id` as the column name — generic enough to cover the NJ MW-562 "Contract No." field without over-specifying. Phase 52 PDF generator will use it. If the planner has domain knowledge, name it to match the exact MW-562 form field label.

2. **workerSex in add-worker flow (not just edit)**
   - What we know: The WorkersPage has separate "add worker" and "edit worker" form states. Phase 49 MA fields were added only to the edit form because demographics are typically filled after initial add.
   - What's unclear: Whether NJ requires workerSex at worker creation time or if post-creation editing is sufficient.
   - Recommendation: Follow the MA/NJ dual-gate pattern already in the codebase — expose workerSex in the edit form. The add-worker flow can be left without it for Phase 51 (consistent with MA treatment of isWoman/isMinority); Phase 52 can expand if needed.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `src/server/db/schema.ts` — verified current column set on workers and projects tables
- Direct codebase inspection: `src/server/db/migrations/0029_ma_schema.sql` — canonical multi-statement migration format
- Direct codebase inspection: `src/server/db/migrations/meta/_journal.json` — verified next idx is 26
- Direct codebase inspection: `src/server/routes/export.ts` (lines 1206-1313) — canonical NJ stub pattern (MA-CPR route)
- Direct codebase inspection: `src/client/components/projects/ProjectForm.tsx` — isNJ variable absent; all other state variables present
- Direct codebase inspection: `src/client/pages/WorkersPage.tsx` (lines 188-189) — `isNJ` already declared; `(isMA || isNJ)` dual-gate already live
- Direct codebase inspection: `src/client/pages/PayrollWeekDetailPage.tsx` (lines 469-483) — STATE_FORMS registry structure
- Direct codebase inspection: `src/server/routes/workers.ts` — CreateWorkerSchema/UpdateWorkerSchema patterns
- `.planning/STATE.md` — locked decisions for v5.0 (workerSex separate from gender, isNJ pattern, STATE_FORMS)
- `.planning/REQUIREMENTS.md` — NJ-01, NJ-02, NFR-01 specifications

### Secondary (MEDIUM confidence)
- None required — all facts verified directly from codebase.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all patterns directly verified in codebase
- Architecture: HIGH — every pattern has a confirmed precedent in a completed phase (49 MA)
- Pitfalls: HIGH — all pitfalls derived from actual CLAUDE.md rules, STATE.md decisions, and code inspection

**Research date:** 2026-04-13
**Valid until:** Stable (code patterns; valid until schema or route structure is refactored)
