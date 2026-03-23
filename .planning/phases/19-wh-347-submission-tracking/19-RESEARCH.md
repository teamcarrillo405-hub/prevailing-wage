# Phase 19: WH-347 Submission Tracking - Research

**Researched:** 2026-03-23
**Domain:** Express route guard + Drizzle ORM update + React form + TanStack Query mutation
**Confidence:** HIGH

---

## Summary

Phase 19 adds a formal submission lifecycle to payroll weeks. The database columns needed (`submitted_at`, `submitted_to`) were already added in Phase 17's migration (`0009_payroll_week_submission_amendment.sql`) and are already mapped in `schema.ts`. The work is entirely in new API routes (submit, un-submit), a server-side lock guard injected into existing entry mutation routes, and UI updates to PayrollListPage and PayrollWeekDetailPage.

The critical non-negotiable from CLAUDE.md is that the server-side lock is enforced on every write to `payroll_entries`. The UI disable is supplementary — it is not the security boundary. Both the `POST /api/payroll/entries` and `PUT /api/payroll/entries/:id` routes must check the week's `submitted_at` field before accepting any write.

The PayrollWeek interface in the frontend currently omits `submittedAt` and `submittedTo`. Both `PayrollListPage.tsx` and `PayrollWeekDetailPage.tsx` will need their local `PayrollWeek` interface updated to include these fields so submitted state can drive badges and button visibility.

**Primary recommendation:** Implement as two API routes (PATCH submit + DELETE submit) on payroll weeks, a lock check helper in `payrollService.ts`, and targeted UI additions to the two existing payroll pages. No new pages required.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SUB-01 | User can mark a payroll week as submitted with a date and agency name | New `PATCH /api/payroll/weeks/:id/submit` route; `updatePayrollWeekSubmission()` service function writes `submitted_at` + `submitted_to`; UI form in PayrollWeekDetailPage |
| SUB-02 | System prevents editing payroll entries on a submitted week (server-side lock) | `assertWeekNotSubmitted()` helper called in both `POST /api/payroll/entries` and `PUT /api/payroll/entries/:id` before any write; returns 409 Conflict |
| SUB-03 | User can un-submit a week to clear its submission status | New `DELETE /api/payroll/weeks/:id/submit` (or `PATCH` with null body) route; clears `submitted_at` and `submitted_to` to NULL |
</phase_requirements>

---

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Note |
|---------|---------|---------|------|
| Drizzle ORM | existing | `db.update(payrollWeeks).set({...}).where(eq(...))` | `submitted_at`/`submitted_to` columns already in schema |
| Express + Zod | existing | Route validation | `SubmitWeekSchema` validates date + agency string |
| TanStack Query | existing | Client mutation + cache invalidation | `useMutation` + `queryClient.invalidateQueries` |
| React `useState` | existing | Modal / form open state | Same pattern as preflight modal in Phase 16 |

### No New Dependencies Required
All work uses existing stack. No npm installs needed.

---

## Architecture Patterns

### Recommended File Changes
```
src/server/
├── routes/payroll.ts          # Add PATCH .../submit + DELETE .../submit routes
├── services/payrollService.ts # Add updateWeekSubmission(), clearWeekSubmission(), assertWeekNotSubmitted()
└── (no new files)

src/client/pages/
├── PayrollWeekDetailPage.tsx  # Add submit form/modal + submitted badge + lock UI
└── PayrollListPage.tsx        # Add submitted badge per row; update PayrollWeek interface
```

### Pattern 1: Server-Side Lock Guard (Non-Negotiable)

The lock check must run BEFORE `upsertPayrollEntry()` in both write routes. The existing `assertProjectOwner()` helper in `payroll.ts` is the model to follow.

```typescript
// In payrollService.ts — export for testability
export async function assertWeekNotSubmitted(
  weekId: string,
): Promise<{ locked: boolean; submittedAt: string | null }> {
  const db = getDb();
  const [week] = await db
    .select({ submittedAt: payrollWeeks.submittedAt })
    .from(payrollWeeks)
    .where(eq(payrollWeeks.id, weekId))
    .limit(1);
  return { locked: !!week?.submittedAt, submittedAt: week?.submittedAt ?? null };
}
```

In `payroll.ts`, both entry routes add:
```typescript
const { locked } = await assertWeekNotSubmitted(body.payrollWeekId);
if (locked) {
  res.status(409).json({ error: 'Payroll week is submitted and cannot be edited' });
  return;
}
```

### Pattern 2: Submit / Un-Submit Routes

Use `PATCH /api/payroll/weeks/:id/submit` to submit and `DELETE /api/payroll/weeks/:id/submit` to un-submit. This follows REST conventions for a sub-resource action. Alternatively, a single `PATCH` with nullable body fields works — either is acceptable. The project uses PATCH elsewhere (confirmed in `api.ts`).

```typescript
// Zod schema for submit
const SubmitWeekSchema = z.object({
  submittedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),  // ISO date
  submittedTo: z.string().min(1).max(200),                 // agency name
});
```

Service function:
```typescript
export async function updateWeekSubmission(
  weekId: string,
  submittedAt: string,
  submittedTo: string,
): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.update(payrollWeeks)
    .set({ submittedAt, submittedTo, updatedAt: now })
    .where(eq(payrollWeeks.id, weekId));
}

export async function clearWeekSubmission(weekId: string): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.update(payrollWeeks)
    .set({ submittedAt: null, submittedTo: null, updatedAt: now })
    .where(eq(payrollWeeks.id, weekId));
}
```

### Pattern 3: Frontend Interface Update

Both pages share a `PayrollWeek` interface defined locally (not in a shared types file). Both must be updated:

```typescript
interface PayrollWeek {
  id: string;
  projectId: string;
  weekEndingDate: string;
  payrollNumber: number;
  isFinal: boolean;
  submittedAt: string | null;   // ADD
  submittedTo: string | null;   // ADD
  createdAt: string;
}
```

### Pattern 4: Submit Form in PayrollWeekDetailPage

Use inline controlled form (not a separate modal component — same approach as WorkflowProgress was kept inline in Phase 15). Two fields: date input + text input for agency. A `useState` for `showSubmitForm` controls visibility, following the `showPreflight` pattern already in the file.

```typescript
const [showSubmitForm, setShowSubmitForm] = useState(false);
const [submitDate, setSubmitDate] = useState('');
const [submitAgency, setSubmitAgency] = useState('');
```

TanStack Query mutation:
```typescript
const submitMutation = useMutation({
  mutationFn: () =>
    api.patch(`/payroll/weeks/${weekId}/submit`, {
      submittedAt: submitDate,
      submittedTo: submitAgency,
    }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['payroll-week', weekId] });
    queryClient.invalidateQueries({ queryKey: ['payroll-weeks', projectId] });
    setShowSubmitForm(false);
  },
});
```

### Pattern 5: Badge in PayrollListPage

The `PayrollListPage` currently shows an inline `isFinal` badge as raw JSX (not using the `Badge` component). The submitted badge should use the `Badge` component for consistency with the design system:

```tsx
{week.submittedAt && (
  <Badge variant="compliant">Submitted</Badge>
)}
{!week.submittedAt && (
  <Badge variant="neutral">Not Submitted</Badge>
)}
```

### Anti-Patterns to Avoid

- **UI-only lock:** Disabling the payroll entry form in the browser is not sufficient. The server must reject writes with 409. CLAUDE.md is explicit: "UI disable alone is not a security boundary."
- **Client-side date formatting for submitted_at:** Store the ISO date string the user enters directly (`YYYY-MM-DD`). Do not convert to a full ISO timestamp on the client. The column in schema is `TEXT` — the service can store `YYYY-MM-DD` consistently with `weekEndingDate` format.
- **Separate page for submit form:** No new page/route needed. The form belongs inline on `PayrollWeekDetailPage`, gated by `week.submittedAt === null`.
- **Invalidating only one query key:** Both `['payroll-week', weekId]` and `['payroll-weeks', projectId]` must be invalidated after submit/un-submit, because `PayrollListPage` has its own independent cache bucket.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Route ownership check | Custom auth check per route | Existing `assertProjectOwner()` helper in `payroll.ts` — call it first, then check submitted lock |
| Cache invalidation after mutation | Manual re-fetch or page reload | `queryClient.invalidateQueries()` in `onSuccess` — already used throughout the codebase |
| Date input validation | Custom regex in component | Zod `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` in route schema — identical to existing `CreateWeekSchema` pattern |

---

## Common Pitfalls

### Pitfall 1: Missing Lock on POST /api/payroll/entries
**What goes wrong:** The lock is added to `PUT /api/payroll/entries/:id` but forgotten on `POST /api/payroll/entries`. The POST route is used by test seeders and is a valid API surface.
**Why it happens:** Two separate entry write routes exist; it's easy to update one and miss the other.
**How to avoid:** Add `assertWeekNotSubmitted` call at the top of BOTH routes. Write a test that POSTs to each endpoint with a submitted week and asserts 409.
**Warning signs:** Test covers PUT lock but not POST lock.

### Pitfall 2: Query Key Mismatch on Invalidation
**What goes wrong:** After submitting, `PayrollListPage` still shows "Not Submitted" because it caches under `['payroll-weeks', projectId]` and that key was not invalidated.
**Why it happens:** Two pages cache the same data under different keys. Only the detail page key gets invalidated.
**How to avoid:** Invalidate both `['payroll-week', weekId]` (detail) and `['payroll-weeks', projectId]` (list) in mutation `onSuccess`.

### Pitfall 3: submittedAt Sent as Full ISO Timestamp by Client
**What goes wrong:** Frontend sends `new Date().toISOString()` (e.g., `2026-03-23T14:32:00.000Z`) instead of `YYYY-MM-DD`. This passes Zod if schema uses `z.string().min(1)` but creates inconsistency with other date fields.
**Why it happens:** Developer uses JS `Date` to pre-fill the input value.
**How to avoid:** Use `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` in the server Zod schema to reject non-date strings. Pre-fill the client date input with `new Date().toISOString().slice(0, 10)`.

### Pitfall 4: Un-Submit Returns 409 If Already Un-Submitted
**What goes wrong:** Calling DELETE submit on a week that is already not submitted throws because the update affects 0 rows, or the route returns an unexpected error.
**Why it happens:** No idempotency check.
**How to avoid:** The `clearWeekSubmission()` service function runs an UPDATE that sets NULL whether or not the week was submitted — this is idempotent. Always return 200/204, even if the week was already un-submitted.

### Pitfall 5: PayrollEntryPage Allows Saving on Submitted Week
**What goes wrong:** `PayrollEntryPage.tsx` (the new entry form at `/projects/:projectId/payroll/new`) doesn't know about submission state and lets the user submit a form. The server will reject it with 409, but the UX is jarring.
**Why it happens:** `PayrollEntryPage` creates *new* weeks, not editing existing ones. This is not actually an issue — new weeks are always unsubmitted. The concern is only `PayrollWeekDetailPage` where entries can be edited. Confirm that PayrollEntryPage only creates new weeks, not edits existing submitted weeks. (Verified: PayrollEntryPage route is `/payroll/new` — it only creates new weeks. No edit-in-place UI exists currently.)

---

## Code Examples

Verified patterns from existing codebase:

### Drizzle UPDATE pattern (from projects route — Phase 17)
```typescript
// Source: src/server/routes/projects.ts (Phase 17 pattern)
await db.update(projects)
  .set({ status: 'closed', updatedAt: now })
  .where(eq(projects.id, projectId));
```

The same pattern applies to `payrollWeeks`:
```typescript
await db.update(payrollWeeks)
  .set({ submittedAt, submittedTo, updatedAt: now })
  .where(eq(payrollWeeks.id, weekId));
```

### TanStack Query mutation with invalidation (from Phase 17/18 pattern)
```typescript
// Pattern used in DashboardPage.tsx (Phase 17-02)
const archiveMutation = useMutation({
  mutationFn: () => api.patch(`/projects/${projectId}/archive`, {}),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['projects'] });
  },
});
```

### Zod date string validation (from existing CreateWeekSchema)
```typescript
// Source: src/server/routes/payroll.ts
weekEndingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: 'weekEndingDate must be YYYY-MM-DD',
}),
```

### assertProjectOwner helper pattern (from payroll.ts)
```typescript
// Source: src/server/routes/payroll.ts — model for assertWeekNotSubmitted
async function assertProjectOwner(projectId, userId, res): Promise<boolean> {
  // fetch, 404/403 if not found/not owner
  return true; // if OK
}
// Called at top of each route handler before business logic
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `isFinal` boolean (Phase 7) used as proxy for "submitted" in WorkflowProgress | `submitted_at` + `submitted_to` (Phase 17 columns) are the official submission record | WH-347 download tracking via `isFinal` can be retired; `submitted_at` is the authoritative marker |

**Note on `isFinal`:** The `isFinal` field was previously used in `WorkflowProgress` in `ProjectDetailPage.tsx` as a proxy for WH-347 download tracking (see Phase 15 decision: "isFinal used as WH-347 download proxy for step 4"). After Phase 19, `submitted_at IS NOT NULL` becomes the canonical "step 4 complete" signal. The planner should decide whether to update the WorkflowProgress step 4 check to use `submitted_at` or leave `isFinal` as-is. This is in-scope if the planner judges it low-effort; otherwise defer to Phase 21 cleanup.

---

## Open Questions

1. **WorkflowProgress step 4 signal**
   - What we know: Step 4 ("Download WH-347") currently uses `isFinal` as the proxy. `isFinal` is set... (checking when) — it appears `isFinal` is never explicitly set to `true` in current routes. It defaults to `false` in `createPayrollWeek`. So `isFinal` is currently always `false`, meaning step 4 never shows complete.
   - What's unclear: Should Phase 19 also set step 4 to use `submitted_at`? This would make WorkflowProgress actually functional for the first time for that step.
   - Recommendation: Planner should include updating `ProjectDetailPage.tsx` WorkflowProgress to use `week.submittedAt` as a bonus task at low cost, since the data will now be available from `GET /api/payroll/weeks/:id`.

2. **Which page hosts the submit action**
   - What we know: Success Criterion 1 says "the week shows a submitted badge" and Criterion 4 says "PayrollListPage shows submitted/not-submitted status." The submit action (entering date + agency) is most logically on `PayrollWeekDetailPage` where the full week context is shown.
   - What's unclear: Should `PayrollListPage` also have a quick-submit button inline per row, or only a status badge?
   - Recommendation: Keep submit action on `PayrollWeekDetailPage` only. `PayrollListPage` shows read-only status badges. This minimizes surface area and matches the existing pattern where the detail page hosts all actions.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via `vitest run`) |
| Config file | `vitest.config.ts` (or package.json scripts) |
| Quick run command | `npx vitest run tests/routes/payroll.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SUB-01 | `PATCH /api/payroll/weeks/:id/submit` sets submitted_at + submitted_to | integration | `npx vitest run tests/routes/payroll.test.ts` | ❌ Wave 0 |
| SUB-02 | `PUT /api/payroll/entries/:id` returns 409 on submitted week | integration | `npx vitest run tests/routes/payroll.test.ts` | ❌ Wave 0 |
| SUB-02 | `POST /api/payroll/entries` returns 409 on submitted week | integration | `npx vitest run tests/routes/payroll.test.ts` | ❌ Wave 0 |
| SUB-03 | `DELETE /api/payroll/weeks/:id/submit` clears submitted_at + submitted_to | integration | `npx vitest run tests/routes/payroll.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/routes/payroll.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] New test cases appended to `tests/routes/payroll.test.ts` — covers SUB-01, SUB-02 (both entry routes), SUB-03
- [ ] No new test file required — tests extend the existing payroll route test file

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `src/server/routes/payroll.ts` — confirmed two entry write routes, confirmed `assertProjectOwner` pattern
- Direct codebase inspection: `src/server/db/schema.ts` — confirmed `submittedAt`/`submittedTo` columns present in `payrollWeeks` table
- Direct codebase inspection: `src/server/db/migrations/0009_payroll_week_submission_amendment.sql` — confirmed migration ran with all four Phase 17 columns
- Direct codebase inspection: `src/server/services/payrollService.ts` — confirmed `getPayrollWeek` returns full row including new columns
- Direct codebase inspection: `src/client/pages/PayrollListPage.tsx` — confirmed `PayrollWeek` interface lacks `submittedAt`/`submittedTo`; update required
- Direct codebase inspection: `src/client/pages/PayrollWeekDetailPage.tsx` — confirmed `PayrollWeek` interface lacks `submittedAt`/`submittedTo`; confirmed `useMutation` pattern not yet used (mutations done via `api.patch` directly in Phase 17/18 pages)
- Direct codebase inspection: `CLAUDE.md` — confirmed "server-side edit lock on submitted weeks is non-negotiable" rule
- Direct codebase inspection: `tests/routes/payroll.test.ts` — confirmed Vitest + Supertest pattern; no submission tests exist yet

### Secondary (MEDIUM confidence)
- Pattern inference from Phase 17-02 (archive/restore) — `PATCH /api/projects/:id/archive` using same `db.update().set().where()` Drizzle pattern

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — entire implementation uses existing libraries; no new dependencies
- Architecture: HIGH — all patterns verified directly in codebase files
- Pitfalls: HIGH — derived from direct inspection of both existing entry routes and the two pages that need updating

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable stack; no fast-moving dependencies in scope)
