# Phase 21: Payroll Amendment Workflow — Research

**Researched:** 2026-03-23
**Domain:** Payroll amendment lifecycle — server-side service, route, PDF label, and UI button placement
**Confidence:** HIGH — all findings sourced directly from codebase; no speculative claims

---

## Summary

Phase 21 adds a formal amendment workflow on top of the already-shipped submission infrastructure (Phase 17 DB columns, Phase 19 service functions, Phase 20 copy pattern). The database already has the two required columns (`amendment_number`, `original_week_id`) added in migration 0009. The `copyPayrollWeek()` service is complete and functional — Phase 21 creates a thin `amendPayrollWeek()` wrapper that reuses the same entry-copy logic but sets `originalWeekId` and `amendmentNumber` on the new row, which `copyPayrollWeek()` currently leaves null.

The WH-347 PDF label change is contained entirely in `export.ts` — the `payrollNumber` field on `Wh347Data` is typed as `string` (confirmed in `wh347Generator.ts`), so the route can assemble `"N (AMENDED M)"` via string interpolation before calling `fillWh347()`. No coordinate changes to the PDF generator are required.

The "Amend This Week" button belongs on `PayrollWeekDetailPage.tsx`, gated by `week.submittedAt !== null`. The original submitted week's lock is already enforced by `assertWeekNotSubmitted()` — no new lock logic is needed. The amendment week itself is a normal editable week (submittedAt starts null, lock guard already in place for entry writes).

**Primary recommendation:** Dedicate Plan 01 to the server-side `amendPayrollWeek()` service + POST route + integration tests (TDD wave), and Plan 02 to the PayrollWeekDetailPage "Amend This Week" button + amended WH-347 label in export.ts + browser verification.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AMD-01 | User can amend a submitted payroll week — creates a new week row with amendment number; original week preserved and read-only | `amendPayrollWeek()` service sets `originalWeekId` + `amendmentNumber`; original lock already enforced by `assertWeekNotSubmitted()` |
| AMD-02 | Amended WH-347 PDF shows payroll number in "N (AMENDED M)" format | `Wh347Data.payrollNumber` is `string` (wh347Generator.ts:162); assembled in `export.ts` before `fillWh347()` call; no generator changes needed |
| AMD-03 | Amendment week entries are pre-filled from the original week's worker hours for editing | `copyPayrollWeek()` already copies all 14 daily hour fields; `amendPayrollWeek()` reuses this logic without live rate re-fetch (amendment clones snapshot rates from original) |
</phase_requirements>

---

## Standard Stack

### Core (all already in project)

| Component | Version | Purpose | Status |
|-----------|---------|---------|--------|
| `payrollService.ts` | in-repo | Service layer for week/entry mutations | Extend with `amendPayrollWeek()` |
| `payroll.ts` route | in-repo | REST endpoints for payroll operations | Add `POST /weeks/amend` |
| `export.ts` route | in-repo | WH-347 PDF generation route | Modify `payrollNumber` string assembly |
| `wh347Generator.ts` | in-repo | PDF fill function | No changes needed — accepts `string` |
| `payrollEntries` schema | Drizzle/SQLite | Source entry rows for pre-fill | Joined query matches `copyPayrollWeek()` pattern |
| `PayrollWeekDetailPage.tsx` | React/TanStack Query | Detail page where "Amend" button lives | Add conditional button + amendRef guard |

### No New Dependencies

No new npm packages. The amendment workflow is a server-side service extension + route + UI button using all existing primitives.

---

## Architecture Patterns

### Recommended File Changes

```
src/server/services/payrollService.ts   — add amendPayrollWeek() + AmendWeekInput/AmendWeekResult types
src/server/routes/payroll.ts            — add POST /api/payroll/weeks/amend route
src/server/routes/export.ts             — modify payrollNumber assembly for amendments
src/client/pages/PayrollWeekDetailPage.tsx — add "Amend This Week" button + navigation
tests/routes/payroll.test.ts            — add AMD-01, AMD-03 integration tests
```

### Pattern 1: amendPayrollWeek() Service Function

**What:** Creates a new payroll week with `originalWeekId` + `amendmentNumber` set, and copies entries from the original week. Differs from `copyPayrollWeek()` in three ways: (1) it does NOT re-fetch live wage rates — it clones `baseRateSnapshot`/`fringeRateSnapshot` from source entries, (2) it sets `originalWeekId` and `amendmentNumber` on the new week, (3) there is no preview mode.

**Why no live rate re-fetch for amendments:** An amendment corrects the *record* of what was paid in the original week. The rates must match the original pay period, not current market rates. Cloning snapshots is the legally correct behavior here — the amendment is an addendum to the already-submitted certified payroll, not a fresh payroll entry.

**Amendment numbering:**
- Query `MAX(amendmentNumber)` WHERE `originalWeekId = rootWeekId` (or `id = rootWeekId`)
- `amendmentNumber = max + 1`, starting at 1 for the first amendment
- Always link to the original root week (`original_week_id`), never to a prior amendment. This keeps the numbering chain flat and prevents "amendment of amendment" confusion. A second amendment to week 5 is amendment 2 of week 5, not amendment 1 of amendment 1 of week 5.

**Interface (source: schema.ts + payrollService.ts patterns):**

```typescript
// Source: src/server/services/payrollService.ts (CopyWeekInput pattern)
export interface AmendWeekInput {
  originalWeekId: string;   // the week being amended (must be submitted)
  projectId: string;
}

export interface AmendWeekResult {
  weekId: string;            // new amendment week ID
  amendmentNumber: number;   // assigned sequence number (1, 2, 3...)
  copiedCount: number;       // entries transferred
}
```

**amendPayrollWeek() logic:**

```typescript
// Source: pattern from copyPayrollWeek() in payrollService.ts
export async function amendPayrollWeek(input: AmendWeekInput): Promise<AmendWeekResult> {
  const db = getDb();

  // 1. Verify original week exists and is submitted
  const [originalWeek] = await db.select().from(payrollWeeks)
    .where(eq(payrollWeeks.id, input.originalWeekId)).limit(1);
  if (!originalWeek?.submittedAt) throw new Error('Week must be submitted to amend');

  // 2. Determine root week (always link to root, not to prior amendment)
  const rootWeekId = originalWeek.originalWeekId ?? originalWeek.id;

  // 3. Compute next amendment number
  const existing = await db.select({ n: payrollWeeks.amendmentNumber })
    .from(payrollWeeks)
    .where(eq(payrollWeeks.originalWeekId, rootWeekId));
  const maxAmendment = existing.reduce((m, r) => Math.max(m, r.n ?? 0), 0);
  const amendmentNumber = maxAmendment + 1;

  // 4. Create new week row (same payrollNumber + same weekEndingDate as original)
  const newId = randomUUID();
  const now = new Date().toISOString();
  await db.insert(payrollWeeks).values({
    id: newId,
    projectId: input.projectId,
    weekEndingDate: originalWeek.weekEndingDate,  // same week
    payrollNumber: originalWeek.payrollNumber,    // same number — label handles AMENDED
    isFinal: originalWeek.isFinal,
    originalWeekId: rootWeekId,
    amendmentNumber,
    submittedAt: null,    // amendment starts unsubmitted — editable
    submittedTo: null,
    createdAt: now,
    updatedAt: now,
  });

  // 5. Copy entries — clone snapshot rates (do NOT re-fetch live rates)
  const sourceEntries = await db.select().from(payrollEntries)
    .where(eq(payrollEntries.payrollWeekId, input.originalWeekId));

  for (const entry of sourceEntries) {
    await db.insert(payrollEntries).values({
      id: randomUUID(),
      payrollWeekId: newId,
      workerId: entry.workerId,
      classificationId: entry.classificationId,
      monSt: entry.monSt, tueSt: entry.tueSt, wedSt: entry.wedSt,
      thuSt: entry.thuSt, friSt: entry.friSt, satSt: entry.satSt, sunSt: entry.sunSt,
      monOt: entry.monOt, tueOt: entry.tueOt, wedOt: entry.wedOt,
      thuOt: entry.thuOt, friOt: entry.friOt, satOt: entry.satOt, sunOt: entry.sunOt,
      baseRateSnapshot: entry.baseRateSnapshot,    // clone, not re-fetch
      fringeRateSnapshot: entry.fringeRateSnapshot,
      grossWages: null,
      deductions: 0,
      netPay: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  return { weekId: newId, amendmentNumber, copiedCount: sourceEntries.length };
}
```

### Pattern 2: POST /api/payroll/weeks/amend Route

**Route placement:** BEFORE `router.get('/weeks/:id', ...)` — same pattern as `/weeks/copy` to prevent wildcard capture.

```typescript
// Source: payroll.ts route pattern (POST /weeks/copy)
const AmendWeekSchema = z.object({
  originalWeekId: z.string().min(1),
});

router.post('/weeks/amend', validate(AmendWeekSchema), async (req, res) => {
  const { originalWeekId } = req.body as z.infer<typeof AmendWeekSchema>;
  const userId = req.user!.userId;

  const originalWeek = await getPayrollWeek(originalWeekId);
  if (!originalWeek) { res.status(404).json({ error: 'Payroll week not found' }); return; }

  const ok = await assertProjectOwner(originalWeek.projectId, userId, res);
  if (!ok) return;

  // Must be submitted to amend
  if (!originalWeek.submittedAt) {
    res.status(409).json({ error: 'Only submitted weeks can be amended' });
    return;
  }

  const result = await amendPayrollWeek({
    originalWeekId,
    projectId: originalWeek.projectId,
  });

  res.status(201).json(result);
});
```

### Pattern 3: Amended WH-347 Label in export.ts

**Confirmed:** `Wh347Data.payrollNumber` is typed as `string` in `wh347Generator.ts` line 162. The export route already does `payrollNumber: String(week.payrollNumber)`. For amendment weeks, wrap in conditional:

```typescript
// Source: export.ts lines 149-173 (Wh347Data assembly)
// Current code:
payrollNumber: String(week.payrollNumber),

// Amendment logic to replace that line:
const payrollNumberLabel = week.amendmentNumber != null && week.originalWeekId != null
  ? `${week.payrollNumber} (AMENDED ${week.amendmentNumber})`
  : String(week.payrollNumber);
// ...
payrollNumber: payrollNumberLabel,
```

No changes to `fillWh347()` or coordinate map needed. The string is drawn at `WH347_FIELDS.payrollNumber` (x: 510, y: 458) and `WH347_FIELDS.p2_payrollNo` (x: 550, y: 568) — both already accept arbitrary strings.

**CONFIRMED:** `wh347Generator.ts` interface definition at line 162:
```typescript
payrollNumber: string;
```
The field is already a string. No type changes required.

### Pattern 4: "Amend This Week" Button in PayrollWeekDetailPage

**Placement:** In the Submission Status panel (currently at bottom of page), adjacent to the "Submitted" badge — only visible when `week.submittedAt !== null`. Use a `useRef` guard (`amendingRef`) to prevent double-click.

**Navigation:** After successful amend, navigate to the new amendment week's detail page: `navigate(\`/projects/${projectId}/payroll/${result.weekId}\`)`.

**PayrollWeek interface extension needed in the page:** Add `amendmentNumber` and `originalWeekId` to the local `PayrollWeek` interface (currently missing from page — the API returns these columns from schema).

```typescript
// Extend existing PayrollWeek interface in PayrollWeekDetailPage.tsx
interface PayrollWeek {
  // ... existing fields ...
  amendmentNumber: number | null;   // add
  originalWeekId: string | null;    // add
}
```

**Amendment badge:** Show a `<Badge variant="warning">Amendment {week.amendmentNumber}</Badge>` in the page header when `week.amendmentNumber != null`. This satisfies the "read-only" indicator for the original while making the amendment's identity visible.

**Original week read-only:** The original submitted week is already read-only via `assertWeekNotSubmitted()` — no new enforcement needed. The UI lock notice already renders when `week.submittedAt !== null`.

### Anti-Patterns to Avoid

- **Live rate re-fetch in amendments:** Do NOT call `getCachedWd`/`lookupWageDetermination` for amendments. The amendment corrects an original certified payroll record — the rates must match what was originally certified, not current market.
- **Linking amendment to prior amendment:** Always store `rootWeekId` (the original non-amendment week), not the most-recent amendment ID. Query `WHERE originalWeekId = rootWeekId` for numbering. This prevents amendment chains.
- **Client-only amend guard:** The 409 check (`if (!originalWeek.submittedAt)`) must be server-side. The UI gate on `week.submittedAt !== null` is advisory display only.
- **copyPayrollWeek() for amendments:** Do not call `copyPayrollWeek()` — it re-fetches live rates (wrong for amendments) and leaves `originalWeekId`/`amendmentNumber` null (schema violation). A dedicated `amendPayrollWeek()` is required.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Entry row copy | Manual SQL INSERT loop | Reuse `db.select().from(payrollEntries)` + `db.insert(payrollEntries)` | Already proven in copyPayrollWeek() |
| Project ownership check | Inline ownership query | `assertProjectOwner()` in payroll.ts | Already exported, accepts (projectId, userId, res) |
| Submission check | Inline submittedAt check | `getPayrollWeek()` returns full row including submittedAt | Already joined by service |
| PDF label | New PDF field or coordinate | String interpolation on `payrollNumber: string` field | Generator already accepts string; no coordinate changes |
| Double-click guard | setTimeout debounce | `useRef(false)` (amendingRef pattern) | Used in copyPayrollWeek UI (copyingRef) and WH-347 download (generatingRef) |

---

## Common Pitfalls

### Pitfall 1: Amendment of Amendment Creates Wrong Chain
**What goes wrong:** If user amends amendment 1, and the service stores `originalWeekId = amendmentWeekId` (the amendment's ID), then querying `WHERE originalWeekId = x` for numbering breaks — amendment 2 would find no siblings to count.
**Why it happens:** Naive implementation stores the immediate parent.
**How to avoid:** Always resolve the root: `const rootWeekId = originalWeek.originalWeekId ?? originalWeek.id`. Store that as `originalWeekId`. Query `WHERE originalWeekId = rootWeekId` for numbering.
**Warning signs:** `amendmentNumber` returns 1 for what should be amendment 2.

### Pitfall 2: Amendment Week Inherits Submitted Lock
**What goes wrong:** If `amendmentNumber` or `originalWeekId` is set on the new week row, code that checks "is this an amendment" might also accidentally set `submittedAt`. The new amendment week must start with `submittedAt: null` so it is editable.
**How to avoid:** `createPayrollWeek()` already leaves all nullable columns null by default. The `db.insert(payrollWeeks).values({...})` call in `amendPayrollWeek()` must explicitly set `submittedAt: null`.

### Pitfall 3: PayrollNumber Collisions in listPayrollWeeks
**What goes wrong:** Two weeks can have the same `payrollNumber` — the original (submitted) and its amendment (editable). The list view in `PayrollListPage.tsx` currently shows `Payroll #{week.payrollNumber}`. Without a disambiguation label, users see two identical entries.
**How to avoid:** In `PayrollListPage.tsx`, add an "AMENDED" badge when `week.amendmentNumber != null`. The `PayrollWeek` interface in that file also needs `amendmentNumber: number | null` added.

### Pitfall 4: Route Capture by /:id
**What goes wrong:** `POST /api/payroll/weeks/amend` registered after `GET /api/payroll/weeks/:id` gets captured as a GET to weekId="amend".
**How to avoid:** Register `router.post('/weeks/amend', ...)` BEFORE `router.get('/weeks/:id', ...)`. This is the same pattern used for `/weeks/copy` (confirmed in current payroll.ts).

### Pitfall 5: Stale PayrollWeek Interface in Pages
**What goes wrong:** `PayrollWeekDetailPage.tsx` and `PayrollListPage.tsx` both define a local `PayrollWeek` interface. Neither currently includes `amendmentNumber` or `originalWeekId`. Using amendment data without adding these fields causes TypeScript errors or silent undefined renders.
**How to avoid:** Extend both local interfaces before adding amendment-conditional JSX.

### Pitfall 6: STATE.md Research Flag (High Priority)
The STATE.md records this explicit research flag for Phase 21:
> "Verify wh347Data.payrollNumber type in wh347Generator.ts accepts string values before writing any route code. Confirm export.ts string assembly approach for 'N (AMENDED M)' label does not require fillWh347() coordinate changes."

**Verified findings:**
- `Wh347Data.payrollNumber` is typed as `string` (wh347Generator.ts line 162) — HIGH confidence.
- `payrollNumber` is drawn with `drawText()` at fixed coordinates — any string value works.
- export.ts already does `payrollNumber: String(week.payrollNumber)` — wrapping in conditional covers the amendment case cleanly.
- No `fillWh347()` changes needed.

---

## Code Examples

### Creating the Amendment Week Row

```typescript
// Source: schema.ts payrollWeeks table definition
// New row for an amendment — sets the 4 Phase 17 columns appropriately:
await db.insert(payrollWeeks).values({
  id: newId,
  projectId: input.projectId,
  weekEndingDate: originalWeek.weekEndingDate,   // same week-ending date
  payrollNumber: originalWeek.payrollNumber,     // same number (label differs in PDF only)
  isFinal: originalWeek.isFinal,
  originalWeekId: rootWeekId,                    // always the root, never a prior amendment
  amendmentNumber,                               // 1, 2, 3... sequentially
  submittedAt: null,                             // editable until user submits this amendment
  submittedTo: null,
  createdAt: now,
  updatedAt: now,
});
```

### Payroll Number Label in export.ts

```typescript
// Source: export.ts lines 145-173 (Wh347Data assembly section)
// Replace the current `payrollNumber: String(week.payrollNumber)` with:
const payrollNumberLabel =
  week.amendmentNumber != null && week.originalWeekId != null
    ? `${week.payrollNumber} (AMENDED ${week.amendmentNumber})`
    : String(week.payrollNumber);

const wh347Data: Wh347Data = {
  // ...
  payrollNumber: payrollNumberLabel,
  // ...
};
```

### "Amend This Week" Button in Submission Status Panel

```tsx
// Source: PayrollWeekDetailPage.tsx — inside the Submission Status Card
// Conditionally render after the "Submitted" badge row, only when submittedAt !== null:
{week.submittedAt && (
  <Button
    variant="secondary"
    size="sm"
    disabled={isAmending}
    onClick={handleAmendClick}
  >
    {isAmending ? 'Creating Amendment...' : 'Amend This Week'}
  </Button>
)}
```

### Amendment Badge in Page Header

```tsx
// Source: PayrollWeekDetailPage.tsx — heading area (lines 204-211)
{week && (
  <h1 className="text-2xl font-headline text-gray-900">
    Payroll Week #{week.payrollNumber}
    {week.amendmentNumber != null && (
      <Badge variant="warning" className="ml-3">
        Amendment {week.amendmentNumber}
      </Badge>
    )}
    <span className="ml-3 text-base font-normal text-gray-500">
      Week Ending {week.weekEndingDate}
    </span>
  </h1>
)}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| In-place payroll correction | New payroll_weeks row (amendment) | Phase 17 DB columns added | 29 CFR Part 3 compliant — original preserved |
| Plain integer payroll number on WH-347 | "N (AMENDED M)" string on amended PDF | Phase 21 | No coordinate changes, string field already exists |

**Regulatory note:** 29 CFR Part 3.3 requires certified payroll records to be retained for 3 years and prohibits falsification. The amendment-as-new-row pattern is the correct implementation of the federal requirement noted in CLAUDE.md: "Amendments must create new payrollWeeks rows — never update entries in place."

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (confirmed — 621 tests passing in current suite) |
| Config file | `/c/Users/glcar/prevailing-wage/vitest.config.ts` |
| Quick run command | `npx vitest run tests/routes/payroll.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AMD-01 | POST /api/payroll/weeks/amend creates new week with originalWeekId + amendmentNumber | integration | `npx vitest run tests/routes/payroll.test.ts` | ✅ (add describe block) |
| AMD-01 | Original week remains read-only after amendment (assertWeekNotSubmitted still returns locked=true) | integration | `npx vitest run tests/routes/payroll.test.ts` | ✅ (add test in same describe) |
| AMD-01 | POST /amend returns 409 when week is not submitted | integration | `npx vitest run tests/routes/payroll.test.ts` | ✅ (add test) |
| AMD-01 | Second amendment to same week gets amendmentNumber=2 | integration | `npx vitest run tests/routes/payroll.test.ts` | ✅ (add test) |
| AMD-02 | GET /api/export/wh347/:weekId for amendment week returns PDF with "N (AMENDED M)" in payrollNumber field | integration | `npx vitest run tests/routes/payroll.test.ts` (or wh347.test.ts) | ❌ Wave 0 gap |
| AMD-03 | New amendment week's entries match source week's daily hours | integration | `npx vitest run tests/routes/payroll.test.ts` | ✅ (add test) |
| AMD-03 | Amendment entries use cloned rate snapshots (not live-fetched) | integration | `npx vitest run tests/routes/payroll.test.ts` | ✅ (add test) |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/routes/payroll.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/routes/payroll.test.ts` — add `describe('POST /api/payroll/weeks/amend — AMD-01 + AMD-03', ...)` block with 5+ failing stubs before implementation
- [ ] AMD-02 PDF label test — either add to `tests/services/wh347.test.ts` (unit test of label assembly) or test via the export route; route-level test requires a real PDF parse to confirm string content (use regex on response header filename or binary search in PDF bytes). Simpler: unit-test the label assembly logic extracted to a helper function.

Note: AMD-02 is the most difficult to test at the route level without a PDF parser. Recommended approach: extract the `payrollNumberLabel` computation to a pure function (e.g., `buildPayrollNumberLabel(week)`) exported from export.ts, then write a unit test for it in wh347.test.ts.

---

## Open Questions

1. **Should the "Amend" button navigate directly to the new amendment week, or confirm first?**
   - What we know: `copyPayrollWeek` uses a preview → confirm two-step flow; but that flow exists because live rate re-fetch might skip entries. Amendments have no such uncertainty.
   - What's unclear: whether a confirmation step adds value or friction.
   - Recommendation: Direct navigate (no confirm modal) — same as the "weeks.length === 0" path in `handleNewWeekClick()`. The user is already on the submitted week detail page and explicitly clicked "Amend This Week" — intent is unambiguous.

2. **Should PayrollListPage show a visual hierarchy (original week + indented amendments)?**
   - What we know: The list is sorted DESC by weekEndingDate; amendments share the same weekEndingDate as the original.
   - What's unclear: Whether the sort order groups them naturally or interleaves them unexpectedly.
   - Recommendation: Keep flat list, add "Amendment 1/2/3" Badge per row when `amendmentNumber != null`. Group-by hierarchy is deferred scope.

3. **Should the amendment week allow the user to mark it as Final (isFinal)?**
   - What we know: The new week row copies `isFinal` from the original. The amendment is a correction, not necessarily a final week.
   - Recommendation: Copy `isFinal: originalWeek.isFinal` so the amendment inherits the same final status. The user can change this in the normal week detail UI if needed.

---

## Sources

### Primary (HIGH confidence)

- `src/server/services/payrollService.ts` — `copyPayrollWeek()` implementation, `amendPayrollWeek` design basis, `createPayrollWeek()` signature
- `src/server/services/wh347Generator.ts` — `Wh347Data.payrollNumber: string` (line 162), coordinate map confirms string field
- `src/server/routes/export.ts` — `payrollNumber: String(week.payrollNumber)` assembly (line 152), `Wh347Data` construction
- `src/server/routes/payroll.ts` — route ordering, `assertProjectOwner()` pattern, `assertWeekNotSubmitted()` usage
- `src/server/db/schema.ts` — `payrollWeeks` columns including `amendmentNumber`, `originalWeekId`, `submittedAt` (all confirmed present)
- `src/client/pages/PayrollWeekDetailPage.tsx` — current `PayrollWeek` interface, Submission Status panel, `generatingRef`/`copyingRef` guard pattern
- `src/client/pages/PayrollListPage.tsx` — current `PayrollWeek` interface, `copyingRef` pattern, weeks list render

### Secondary (MEDIUM confidence)

- `.planning/phases/17-db-migration-project-archive/17-01-PLAN.md` — confirmed `original_week_id TEXT REFERENCES payroll_weeks(id)` SQL, no `.references()` in schema.ts to avoid `AnySQLiteColumn` import
- `.planning/phases/19-wh-347-submission-tracking/19-01-PLAN.md` — `assertWeekNotSubmitted()` return contract `{ locked: boolean; submittedAt: string | null }`
- `.planning/phases/20-copy-previous-payroll-week/20-01-PLAN.md` — confirmed `copyPayrollWeek()` never sets `amendmentNumber`/`originalWeekId`; new week leaves them null

### Tertiary (LOW confidence)

- None — all findings from direct codebase inspection.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already present and in use
- Architecture: HIGH — service pattern derived directly from copyPayrollWeek() source
- Pitfalls: HIGH — derived from schema inspection and route ordering rules documented in STATE.md decisions
- PDF label: HIGH — wh347Generator.ts explicitly types payrollNumber as string; confirmed in source

**Research date:** 2026-03-23
**Valid until:** Stable — no external dependencies. Re-research only if wh347Generator.ts field types change.
