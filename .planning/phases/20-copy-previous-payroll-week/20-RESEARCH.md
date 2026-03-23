# Phase 20: Copy Previous Payroll Week - Research

**Researched:** 2026-03-23
**Domain:** Payroll copy workflow — server-side bulk entry creation with live wage rate re-fetch and partial-failure warning UI
**Confidence:** HIGH — all findings from direct source code inspection

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PAY-01 | User can copy a previous payroll week to pre-fill a new week with worker/hour data and live rate re-fetch per classification | Copy endpoint in payrollService.ts + live `lookupWageDetermination()` call; new payroll week created via existing `createPayrollWeek()` service function |
| PAY-02 | System shows which entries were skipped during copy (worker no longer active, rate lookup failed) before confirming | Preview step in copy endpoint returns `copied[]` + `skipped[]` arrays to UI before committing entries |
</phase_requirements>

---

## Summary

Phase 20 adds a "copy from previous week" path to the payroll creation flow. The core mechanic is a new server-side POST endpoint that: (1) reads all payroll entries from a source week, (2) re-fetches live wage rates per classification via the existing `lookupWageDetermination()` + `getCachedWd()` pipeline, (3) creates a new payroll week, (4) bulk-inserts entries using fresh rate snapshots, and (5) reports any entries that were skipped because the worker is inactive or the rate lookup returned null.

The UI entry point is `PayrollListPage.tsx` (`/projects/:projectId/payroll`). The existing "+ New Week" button navigates to `/projects/:projectId/payroll/new` (the `PayrollEntryPage`). Phase 20 needs to intercept this flow: either replace the "+ New Week" button with a modal offering "Start Fresh" vs "Copy Previous Week", or add a separate "Copy" action per row on the payroll list. Either pattern works architecturally; the recommendation is the modal on the "+ New Week" button because it is the most natural decision point.

The highest-risk implementation decision — flagged in STATE.md `Research Flags` — is how `lookupWageDetermination()` behaves per-classification. It operates at the project level (state + county), not at the tradeCode level. The wage determination returns all classifications in a `wageClassifications` array. The copy routine must match each source entry's `tradeCode` against the returned WD's `classifications[]` to find the live rate. If a tradeCode is not present in the WD (e.g., WD was updated and classification removed), the entry must be skipped, not assigned a zero rate.

**Primary recommendation:** Single POST endpoint `POST /api/payroll/weeks/copy` with a `?preview=true` query option. The preview mode returns `{ copied, skipped }` without writing to the DB. The UI shows the warning screen (PAY-02), then calls the same endpoint without `?preview=true` to commit. This avoids a two-step endpoint surface and makes tests straightforward.

---

## Standard Stack

### Core (all already installed — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.45.1 | DB queries — reading source entries, inserting new week + entries | Already the project ORM |
| zod | ^4.3.6 | Request body validation for the copy endpoint schema | Already the project validator |
| express | ^5.2.1 | Router for the new copy route | Already the project framework |
| vitest + supertest | ^4.1.0 / ^7.2.2 | Route tests following existing `tests/routes/payroll.test.ts` pattern | Already the project test stack |

### No New Dependencies Required

The copy feature is entirely implementable with the existing stack. No additional packages are needed.

---

## Architecture Patterns

### Recommended Project Structure Changes

```
src/server/
├── routes/payroll.ts          # Add POST /api/payroll/weeks/copy route here
├── services/payrollService.ts  # Add copyPayrollWeek() service function here
tests/
└── routes/payroll.test.ts      # Extend with copy endpoint tests
src/client/pages/
└── PayrollListPage.tsx         # Add "Copy" UI — modal or inline selector
```

No new files are required for the server side. All copy logic belongs in the existing `payrollService.ts` and `payroll.ts` route files.

### Pattern 1: Preview-then-Commit Copy Endpoint

**What:** Single endpoint `POST /api/payroll/weeks/copy` with optional `preview` boolean in the body.

**When preview=true:** Runs the entire copy logic (rate lookups, active-worker checks) but does NOT write to DB. Returns `{ preview: true, copied: [...], skipped: [...] }`.

**When preview=false (or omitted):** Creates the new week and inserts entries. Returns `{ weekId, copied: [...], skipped: [...] }`.

**Why this pattern:** The same service function runs both paths — preview just skips the DB write step at the end. Tests can assert the skipped/copied arrays in both modes.

```typescript
// Source: direct code reading — payrollService.ts pattern

export interface CopyWeekInput {
  projectId: string;
  sourceWeekId: string;
  weekEndingDate: string;  // new week's date
  payrollNumber: number;   // new week's payroll number
}

export interface CopyWeekResult {
  weekId: string | null;   // null if preview=true
  copied: Array<{
    workerId: string;
    workerName: string;
    classificationId: string;
    tradeDescription: string;
    baseRate: number;
    fringeRate: number;
  }>;
  skipped: Array<{
    workerId: string;
    workerName: string;
    classificationId: string;
    tradeDescription: string;
    reason: 'worker-inactive' | 'rate-lookup-failed' | 'no-wd-found';
  }>;
}
```

### Pattern 2: Rate Lookup Per Source Entry

The copy service must match each source entry's `tradeCode` to the live WD classifications. The current workers route (`GET /api/projects/:projectId/workers`) already does this exact pattern using a `Map<tradeCode, {baseRate, fringeRate}>` built from `getCachedWd()` + `getCachedClassifications()`. The copy service should replicate this map-building approach.

```typescript
// Source: src/server/routes/workers.ts lines 93–99 — verified pattern

// Step 1: get the live WD for the project
const project = await db.select().from(projects).where(eq(projects.id, projectId))...
const wd = getCachedWd(project.state, project.county)
  ?? (await lookupWageDetermination(project.state, project.county));

// Step 2: build tradeCode → rate map
const rateMap = new Map<string, { baseRate: number; fringeRate: number }>();
if (wd) {
  for (const wc of getCachedClassifications(wd.id)) {
    rateMap.set(wc.tradeCode, { baseRate: wc.baseRate, fringeRate: wc.fringeRate });
  }
}

// Step 3: for each source entry, look up tradeCode from the worker's classification
// If rateMap.get(tradeCode) is undefined → skip with reason 'rate-lookup-failed'
// If worker.isActive === false → skip with reason 'worker-inactive'
// Otherwise → add to copied[] with fresh baseRate/fringeRate
```

**CRITICAL:** If `lookupWageDetermination()` returns null (no WD found at all), ALL entries must be skipped with reason `'no-wd-found'`. The copy must never proceed with rate=0 snapshots.

### Pattern 3: Submission Flag Exclusion

The new week created by the copy endpoint must NEVER carry `submitted_at`, `submitted_to`, `amendment_number`, or `original_week_id` from the source week. These are Phase 17 migration columns. The `createPayrollWeek()` service function already sets all four to null/undefined by default (see `payrollService.ts` lines 54–62). The copy service calls `createPayrollWeek()` directly — no extra scrubbing needed, but this must be verified in tests.

### Pattern 4: UI Entry Point — Copy Modal on PayrollListPage

**Current flow:** "+ New Week" Link navigates to `/projects/:projectId/payroll/new`.

**Phase 20 flow:** Replace the Link with a button that opens an inline modal:
- "Start Fresh" → navigates to `/projects/:projectId/payroll/new` (existing behavior)
- "Copy Previous Week" → shows a week selector (dropdown or radio list of existing weeks), then calls `POST /api/payroll/weeks/copy?preview=true`, shows the skipped warning if any, then on confirm calls the same endpoint to commit.

The modal follows the existing modal pattern from `PayrollWeekDetailPage.tsx` (preflight modal): `useState` for visibility, `useRef` for double-click guard, Escape/backdrop dismiss.

If there are no previous weeks yet (`weeks.length === 0`), the "+ New Week" button should not offer the copy option — just navigate directly to the new week form.

### Anti-Patterns to Avoid

- **Cloning rate snapshots:** NEVER copy `baseRateSnapshot`/`fringeRateSnapshot` from the source entries. The copy must call `lookupWageDetermination()` and use the fresh classification rates. This is a federal compliance requirement per CLAUDE.md.
- **Silent zero-rate fallback:** If `rateMap.get(tradeCode)` is undefined, do not substitute 0. Skip the entry with a descriptive reason.
- **All-or-nothing on WD failure:** If the WD lookup fails for the whole project, return all entries as skipped (`reason: 'no-wd-found'`). Don't block the new week creation entirely — the user can still start fresh.
- **Carrying submission flags:** Never copy `submitted_at`, `submitted_to`, `amendment_number`, `original_week_id` from source week to new week.
- **Skipping the preview step in tests:** PAY-02 requires that the user sees the warning before confirming. Tests must assert the `skipped[]` array is returned and populated correctly before the write path.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate lookup | Custom WD query in copy service | `lookupWageDetermination()` + `getCachedWd()` + `getCachedClassifications()` | Already handles cache-first, SAM.gov fallback, statewide fallback |
| tradeCode → rate mapping | Inline SQL join | `Map<tradeCode, rates>` pattern from workers.ts | Tested, handles null WD gracefully |
| Entry bulk insert | Custom multi-INSERT SQL | Existing `upsertPayrollEntry()` called in a loop | Already handles onConflictDoUpdate correctly |
| New week creation | Inline DB insert in copy route | Existing `createPayrollWeek()` service function | Guarantees null submission flags by design |
| Project ownership guard | Inline auth check | Existing `assertProjectOwner()` helper in payroll.ts | Pattern is consistent with all other payroll routes |

**Key insight:** The copy feature is entirely orchestration of existing primitives. It needs no new DB helpers — just a new service function that sequences existing calls.

---

## Common Pitfalls

### Pitfall 1: lookupWageDetermination Returns Stale Cache
**What goes wrong:** `getCachedWd()` returns the cached WD without hitting SAM.gov. The cache may be 25 days old. Rates could be out of date.
**Why it happens:** `lookupWageDetermination()` is cache-first by design (30-day TTL). On copy, the cache IS consulted — it is only stale snapshots from the source entry that are forbidden.
**How to avoid:** This is acceptable behavior. The constraint is "use the current cache, not the source entry's snapshot". The cache is the authoritative source for current rates. Document this distinction clearly in tests.
**Warning signs:** Confusion about "live rate" meaning — it means "from the current wage determination cache", not "always hits SAM.gov".

### Pitfall 2: Worker isActive Check — Which Field
**What goes wrong:** `workers.isActive` exists in the schema (`integer('is_active', { mode: 'boolean' })`). However, `GET /api/projects/:projectId/workers` returns ALL workers including inactive ones — it does not filter by `isActive`. The copy service must explicitly check `worker.isActive === false` for each source entry's worker.
**Why it happens:** The workers route was built before the copy requirement and returns all workers for the project.
**How to avoid:** The copy service must join `workers` to check `isActive` per entry. Not just use the workerId from the source payroll entry directly.

### Pitfall 3: Source Week is Submitted — Should Copy Still Proceed?
**What goes wrong:** The source week may be submitted (`submitted_at !== null`). The copy reads from the source week, which is fine — it is read-only. The new week is created fresh with no submission flags. There is no conflict.
**How to avoid:** No special handling needed. Reading from a submitted week is always allowed. The `assertWeekNotSubmitted` guard only applies to write operations.

### Pitfall 4: upsertPayrollEntry Unique Constraint on New Week
**What goes wrong:** `payroll_entry_unique` is `UNIQUE(payroll_week_id, worker_id, classification_id)`. For a freshly created week this constraint is never violated. But if the copy is called twice (double-submit from the UI), duplicate entries would hit the constraint.
**How to avoid:** Use `useRef` double-click guard on the confirm button (same pattern as WH-347 download). The `upsertPayrollEntry` function already handles `onConflictDoUpdate` gracefully — a second call just overwrites with identical data.

### Pitfall 5: weekEndingDate and payrollNumber Must Come from the User
**What goes wrong:** The source week's `weekEndingDate` and `payrollNumber` are NOT carried over. The new week needs a new date and the next payroll number. The copy request body must include these user-provided values.
**Why it happens:** It is tempting to auto-increment the payroll number server-side, but the server does not currently compute `max(payrollNumber) + 1` automatically.
**How to avoid:** The copy endpoint Zod schema must require `weekEndingDate` and `payrollNumber` from the client. The UI can suggest `max(payrollNumber) + 1` and the following week's date as defaults.

### Pitfall 6: PayrollListPage Still Uses Raw Link for "+ New Week"
**What goes wrong:** The current "+ New Week" is a `<Link to="/new">` element. Converting it to a button that opens a modal requires changing the element type. If the modal state is hoisted to `PayrollListPage`, the weeks data (already fetched) can be used to populate the "copy from" selector without an extra query.
**How to avoid:** Change the Link to a `<button>` with an `onClick` handler. Hoist `showCopyModal` useState to `PayrollListPage`. Pass the already-fetched `weeks` array to the modal as props.

---

## Code Examples

Verified patterns from source code:

### How createPayrollWeek is called (safe for copy)
```typescript
// Source: src/server/services/payrollService.ts lines 47–65
// All submission columns default to null — safe for copy destination
await db.insert(payrollWeeks).values({
  id,
  projectId: input.projectId,
  weekEndingDate: input.weekEndingDate,
  payrollNumber: input.payrollNumber,
  isFinal: false,
  // submitted_at, submitted_to, amendment_number, original_week_id NOT set = null
  createdAt: now,
  updatedAt: now,
});
```

### Rate map building pattern (from workers.ts)
```typescript
// Source: src/server/routes/workers.ts lines 93–99
const wd = getCachedWd(project.state, project.county);
const rateMap = new Map<string, { baseRate: number; fringeRate: number }>();
if (wd) {
  for (const wc of getCachedClassifications(wd.id)) {
    rateMap.set(wc.tradeCode, { baseRate: wc.baseRate, fringeRate: wc.fringeRate });
  }
}
// Usage: rateMap.get(tradeCode) ?? null (null = skip with 'rate-lookup-failed')
```

### assertProjectOwner helper (reuse in copy route)
```typescript
// Source: src/server/routes/payroll.ts lines 69–90
// Already exported-within-module — copy route can reuse directly
async function assertProjectOwner(projectId, userId, res): Promise<boolean>
```

### How to look up tradeCode from a source entry
```typescript
// The payroll_entries table stores classificationId (not tradeCode directly).
// Must join workerClassifications to get tradeCode for the rate map lookup.
// getPayrollEntries() already does this join and returns tradeDescription + laborType.
// But it does NOT return tradeCode. The copy service needs a slightly different query
// that includes workerClassifications.tradeCode + workers.isActive in the select.
```

### Existing upsertPayrollEntry signature
```typescript
// Source: src/server/services/payrollService.ts lines 86–169
export async function upsertPayrollEntry(input: UpsertPayrollEntryInput)
// Required: payrollWeekId, workerId, classificationId, baseRateSnapshot, fringeRateSnapshot
// All daily hour fields are optional (default 0)
// Returns the entry row or null
```

### Test fixture pattern (from payroll.test.ts)
```typescript
// Source: tests/routes/payroll.test.ts lines 12–54
// Pattern: registerAndLogin → createProject → createWorkerWithClassification → createPayrollWeek
// Copy tests add: create source entries, then call copy endpoint, assert response
```

---

## Schema Fields: What to Copy vs. What to Exclude

### payrollWeeks — Source Week Fields

| Field | Copy to New Week? | Notes |
|-------|------------------|-------|
| id | NO — generate new UUID | |
| projectId | YES | Same project |
| weekEndingDate | NO — from request body | User provides new date |
| payrollNumber | NO — from request body | User provides next number |
| isFinal | NO — default false | New week starts as not final |
| submittedAt | NEVER | Federal compliance — CLAUDE.md rule |
| submittedTo | NEVER | Federal compliance — CLAUDE.md rule |
| amendmentNumber | NEVER | Phase 21 concern only |
| originalWeekId | NEVER | Phase 21 concern only |
| createdAt / updatedAt | NO — generate fresh | |

### payrollEntries — Source Entry Fields

| Field | Copy to New Week? | Notes |
|-------|------------------|-------|
| id | NO — generate new UUID | |
| payrollWeekId | NO — use new week's ID | |
| workerId | YES — if worker.isActive | Skip if inactive |
| classificationId | YES — if rate found | |
| monSt–sunSt (7 fields) | YES | Hour data is copied |
| monOt–sunOt (7 fields) | YES | Hour data is copied |
| baseRateSnapshot | NEVER — re-fetch from WD | CLAUDE.md critical rule |
| fringeRateSnapshot | NEVER — re-fetch from WD | CLAUDE.md critical rule |
| grossWages | NO — set null | Recomputed after edit |
| deductions | NO — set 0 | User re-enters |
| netPay | NO — set null | Recomputed after edit |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No copy feature | New copy endpoint | Phase 20 | Adds `/api/payroll/weeks/copy` POST route |
| "+ New Week" is a Link | "+ New Week" triggers modal with copy option | Phase 20 | PayrollListPage.tsx modified |
| Rate snapshots cloned on copy | Rates re-fetched from live WD cache | Phase 20 | Compliance requirement from CLAUDE.md |

**No deprecated patterns apply to this phase.** The copy feature is purely additive.

---

## Open Questions

1. **Should copied hour data be preserved exactly, or zeroed out?**
   - What we know: Success criteria says "pre-filled with prior week's worker hours" — this clearly means preserve the hours.
   - What's unclear: Should OT hours be zeroed if the new week hasn't been worked yet? The user can edit before submission, so preserving them is the safer default.
   - Recommendation: Copy all hour fields exactly. The user edits before submission. This matches AMD-03 (amendment pre-fill) which also preserves hours.

2. **How does the UI communicate a partially-successful copy?**
   - What we know: PAY-02 says "user sees a warning listing the skipped entries before confirming". This implies a preview step where skipped entries are visible before the copy is committed.
   - What's unclear: Does the user confirm even when some entries are skipped, or can they cancel?
   - Recommendation: Both paths. "Confirm Copy (N entries will be skipped)" + "Cancel" buttons. Skipped entry details shown in a list. This matches the preflight modal pattern already in PayrollWeekDetailPage.tsx.

3. **What payroll number should the UI suggest for the new week?**
   - What we know: `payrollNumber` is user-provided; the server does not auto-increment. The `listPayrollWeeks()` returns weeks ordered by `weekEndingDate` descending.
   - Recommendation: The UI should compute `max(week.payrollNumber) + 1` from the already-fetched weeks list and pre-populate the payrollNumber field in the copy modal.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 + Supertest 7.2.2 |
| Config file | `vitest.config.ts` — `setupFiles: ['./tests/helpers/db.ts']` |
| Quick run command | `npm test -- tests/routes/payroll.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PAY-01 | POST /api/payroll/weeks/copy creates new week pre-filled with source hours | integration | `npm test -- tests/routes/payroll.test.ts` | Extend existing file |
| PAY-01 | Copied entries have fresh baseRateSnapshot/fringeRateSnapshot (not source values) | integration | same | Extend existing file |
| PAY-01 | submitted_at/submitted_to/amendment_number/original_week_id are null on copied week | integration | same | Extend existing file |
| PAY-02 | preview=true returns copied[] + skipped[] without writing to DB | integration | same | Extend existing file |
| PAY-02 | Worker with isActive=false appears in skipped[] with reason 'worker-inactive' | integration | same | Extend existing file |
| PAY-02 | Entry with no WD rate match appears in skipped[] with reason 'rate-lookup-failed' | integration | same | Extend existing file |

### Sampling Rate
- **Per task commit:** `npm test -- tests/routes/payroll.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green (198+ tests) before `/gsd:verify-work 20`

### Wave 0 Gaps

None — existing test infrastructure covers all phase requirements. All copy tests extend the existing `tests/routes/payroll.test.ts` file following the established `registerAndLogin → createProject → createWorkerWithClassification` pattern. No new test files or framework configuration is needed.

---

## Sources

### Primary (HIGH confidence)

- Direct read of `src/server/services/payrollService.ts` — full service API, createPayrollWeek, upsertPayrollEntry
- Direct read of `src/server/routes/payroll.ts` — route structure, assertProjectOwner, assertWeekNotSubmitted patterns
- Direct read of `src/server/db/schema.ts` — payrollWeeks and payrollEntries column definitions
- Direct read of `src/server/services/wageLookup.ts` — lookupWageDetermination signature and cache-first flow
- Direct read of `src/server/services/wageCache.ts` — getCachedWd, getCachedClassifications functions
- Direct read of `src/server/routes/workers.ts` lines 93–99 — tradeCode → rate map building pattern
- Direct read of `src/client/pages/PayrollListPage.tsx` — current "+ New Week" entry point
- Direct read of `src/client/pages/PayrollEntryPage.tsx` — current new-week form structure
- Direct read of `src/client/components/PayrollWeekForm.tsx` — hours grid and form structure
- Direct read of `CLAUDE.md` — "Copy week must re-fetch live wage rates" compliance rule
- Direct read of `src/server/db/migrations/0009_payroll_week_submission_amendment.sql` — confirms Phase 17 columns in DB
- Direct read of `tests/routes/payroll.test.ts` — test pattern for copy tests
- Direct read of `tests/helpers/db.ts` — in-memory SQLite test setup
- Direct read of `vitest.config.ts` — test framework configuration

### Secondary (MEDIUM confidence)

- `.planning/STATE.md` Research Flags — "Review wageLookup.ts before building the copy route — confirm per-classification lookup supports graceful per-entry failure" — confirmed resolved: lookup is at project level, per-entry failure handled via tradeCode map miss

### Tertiary (LOW confidence)

None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — direct code inspection, no new dependencies
- Architecture: HIGH — copy pattern is orchestration of verified existing primitives
- Pitfalls: HIGH — all pitfalls identified from direct schema and route reading, not speculation
- Rate lookup behavior: HIGH — full wageLookup.ts and wageCache.ts read; confirmed cache-first, no per-classification fallback needed

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable codebase; only invalidated if payrollService.ts or wageLookup.ts change)
