---
phase: 39-worker-profile-depth
plan: 02
type: execute
wave: 2
depends_on: [39-01]
files_modified:
  - src/client/pages/WorkersPage.tsx
  - src/client/pages/PayrollWeekDetailPage.tsx
  - src/server/services/payrollService.ts
autonomous: true
requirements: [WORKER-01, WORKER-02, WORKER-03, WORKER-04, NFR-01, NFR-05]

must_haves:
  truths:
    - "Worker form shows 4 separate address inputs (Street, City, State, Zip) instead of single address field"
    - "Worker form shows Union Information section with unionLocal and unionBookNumber inputs"
    - "Worker form shows Apprenticeship section only when worker has an apprentice classification"
    - "Worker card display shows concatenated address and new fields"
    - "PayrollWeekDetailPage shows per-worker classification override dropdown"
    - "Classification override dropdown calls POST endpoint and reflects current override"
  artifacts:
    - path: "src/client/pages/WorkersPage.tsx"
      provides: "Updated worker form with structured address, union info, apprenticeship sections"
      contains: "addressStreet"
    - path: "src/client/pages/PayrollWeekDetailPage.tsx"
      provides: "Per-worker classification override dropdown with mutation"
      contains: "payroll-week-classifications"
  key_links:
    - from: "src/client/pages/WorkersPage.tsx"
      to: "/api/projects/:projectId/workers"
      via: "fetch in mutation (create/update worker)"
      pattern: "addressStreet.*addressCity.*addressState.*addressZip"
    - from: "src/client/pages/PayrollWeekDetailPage.tsx"
      to: "/api/projects/:projectId/payroll-week-classifications"
      via: "TanStack Query mutation (POST)"
      pattern: "payroll-week-classifications"
---

<objective>
Update WorkersPage and PayrollWeekDetailPage to use the new structured address fields, show union and apprenticeship sections, and provide per-week classification override UI.

Purpose: Surface the richer worker data model in the UI so contractors can enter structured addresses, union details, apprenticeship info, and override classifications per payroll week.
Output: Updated WorkersPage form + display, updated PayrollWeekDetailPage with override dropdown.
</objective>

<execution_context>
@C:/Users/glcar/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/glcar/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@C:/Users/glcar/prevailing-wage/.planning/PROJECT.md
@C:/Users/glcar/prevailing-wage/.planning/ROADMAP.md
@C:/Users/glcar/prevailing-wage/.planning/STATE.md
@C:/Users/glcar/prevailing-wage/.planning/phases/39-worker-profile-depth/39-RESEARCH.md
@C:/Users/glcar/prevailing-wage/.planning/phases/39-worker-profile-depth/39-01-SUMMARY.md

<interfaces>
<!-- From Plan 01 outputs — the API contracts the UI builds against -->

Updated POST /api/projects/:projectId/workers body (Zod schema):
```typescript
{
  name: string;             // required
  ssn?: string;             // optional, 9 digits
  tradeUnion?: string;      // optional
  addressStreet?: string;   // optional, max 500
  addressCity?: string;     // optional, max 200
  addressState?: string;    // optional, max 50
  addressZip?: string;      // optional, max 20
  unionLocal?: string;      // optional, max 200
  unionBookNumber?: string; // optional, max 100
  apprenticeshipCommittee?: string;    // optional, max 200
  apprenticeshipRegNumber?: string;    // optional, max 100
}
```

Updated PUT /api/projects/:projectId/workers/:workerId body — same fields, all optional + nullable.

GET /api/projects/:projectId/workers response includes all new fields on each worker object.

POST /api/projects/:projectId/payroll-week-classifications body:
```typescript
{
  payrollWeekId: string;      // UUID
  workerId: string;           // UUID
  classificationId: string;   // UUID
}
```
Returns 201 with inserted row.

DELETE /api/projects/:projectId/payroll-week-classifications/:id
Returns 204.

getPayrollEntriesWithWorkerDetails response now includes:
```typescript
{
  // ...existing fields...
  overrideClassificationId: string | null;  // from payroll_week_classifications
  tradeDescription: string;  // COALESCE(override, default)
  laborType: string;         // COALESCE(override, default)
}
```

UI Primitives available:
- Card (padding="default"|"sm"|"none") from src/client/components/ui/
- Button, Badge, PageHeader, EmptyState
- Design tokens: bg-surface-card, border-brand-gold, text-brand-gold, bg-nav-dark
- Font: font-headline (Oswald), font-body (Inter)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update WorkersPage — form, display, and mutation payload</name>
  <files>src/client/pages/WorkersPage.tsx</files>
  <action>
Read `src/client/pages/WorkersPage.tsx` fully. Make these changes:

**1. Update `blankWorkerForm()`:**
Replace `address: ''` with:
```typescript
addressStreet: '',
addressCity: '',
addressState: '',
addressZip: '',
unionLocal: '',
unionBookNumber: '',
apprenticeshipCommittee: '',
apprenticeshipRegNumber: '',
```
Remove `address: ''`.

**2. Update `workerToEditForm(w)`:**
Replace `address: w.address ?? ''` with:
```typescript
addressStreet: w.addressStreet ?? '',
addressCity: w.addressCity ?? '',
addressState: w.addressState ?? '',
addressZip: w.addressZip ?? '',
unionLocal: w.unionLocal ?? '',
unionBookNumber: w.unionBookNumber ?? '',
apprenticeshipCommittee: w.apprenticeshipCommittee ?? '',
apprenticeshipRegNumber: w.apprenticeshipRegNumber ?? '',
```
Remove `address: w.address ?? ''`.

**3. Update the worker form UI (inside the modal/form JSX):**

Replace the single address `<input>` with a grid of 4 inputs:
```tsx
<div className="mt-4">
  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Address</p>
  <div className="space-y-2">
    <input
      type="text"
      placeholder="Street"
      value={form.addressStreet}
      onChange={e => setForm(f => ({ ...f, addressStreet: e.target.value }))}
      className={/* use the same className as the existing address input */}
    />
    <div className="grid grid-cols-3 gap-2">
      <input
        type="text"
        placeholder="City"
        value={form.addressCity}
        onChange={e => setForm(f => ({ ...f, addressCity: e.target.value }))}
        className={/* same input classes */}
      />
      <input
        type="text"
        placeholder="State"
        value={form.addressState}
        onChange={e => setForm(f => ({ ...f, addressState: e.target.value }))}
        className={/* same input classes */}
      />
      <input
        type="text"
        placeholder="Zip"
        value={form.addressZip}
        onChange={e => setForm(f => ({ ...f, addressZip: e.target.value }))}
        className={/* same input classes */}
      />
    </div>
  </div>
</div>
```

**4. Add "Union Information" section** (always visible, below address):
```tsx
<div className="mt-4 border-t border-gray-100 pt-4">
  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Union Information</p>
  <div className="grid grid-cols-2 gap-2">
    <input
      type="text"
      placeholder="Union Local"
      value={form.unionLocal}
      onChange={e => setForm(f => ({ ...f, unionLocal: e.target.value }))}
      className={/* same input classes */}
    />
    <input
      type="text"
      placeholder="Book Number"
      value={form.unionBookNumber}
      onChange={e => setForm(f => ({ ...f, unionBookNumber: e.target.value }))}
      className={/* same input classes */}
    />
  </div>
</div>
```

**5. Add "Apprenticeship" section** (conditionally rendered):

This section should only appear when the worker being edited has at least one classification with `laborType === 'apprentice'`. For NEW workers (no classifications yet), hide this section.

For the edit form, the worker object `w` has `w.classifications` array. Use:
```tsx
{editingWorker?.classifications?.some(c => c.laborType === 'apprentice') && (
  <div className="mt-4 border-t border-gray-100 pt-4">
    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Apprenticeship</p>
    <div className="grid grid-cols-2 gap-2">
      <input
        type="text"
        placeholder="Committee"
        value={form.apprenticeshipCommittee}
        onChange={e => setForm(f => ({ ...f, apprenticeshipCommittee: e.target.value }))}
        className={/* same input classes */}
      />
      <input
        type="text"
        placeholder="Registration Number"
        value={form.apprenticeshipRegNumber}
        onChange={e => setForm(f => ({ ...f, apprenticeshipRegNumber: e.target.value }))}
        className={/* same input classes */}
      />
    </div>
  </div>
)}
```

The variable name `editingWorker` may differ — read the component to find the actual variable that holds the worker being edited (likely the worker object fetched from state or passed as prop). For NEW worker creation, this section is hidden (no classifications exist yet).

**6. Update worker card/list display:**
Find where `w.address` is rendered in the worker card/list view. Replace with a concatenated display:
```tsx
{[w.addressStreet, w.addressCity, w.addressState, w.addressZip].filter(Boolean).join(', ')}
```

If union info or apprenticeship fields have values, show them in the card too:
- `{w.unionLocal && <span>Union: {w.unionLocal} {w.unionBookNumber && `#${w.unionBookNumber}`}</span>}`
- Show apprenticeship info similarly if present.

**7. Update mutation payload:**
Find the `fetch` call that sends worker data to the API (create and update mutations). Replace `address: form.address` with the 8 new fields:
```typescript
addressStreet: form.addressStreet || undefined,
addressCity: form.addressCity || undefined,
addressState: form.addressState || undefined,
addressZip: form.addressZip || undefined,
unionLocal: form.unionLocal || undefined,
unionBookNumber: form.unionBookNumber || undefined,
apprenticeshipCommittee: form.apprenticeshipCommittee || undefined,
apprenticeshipRegNumber: form.apprenticeshipRegNumber || undefined,
```

Use `|| undefined` (not `|| null`) to avoid sending empty strings — let Zod treat missing keys as optional. Remove the old `address` field from the payload.

**Design tokens:** Use only existing Tailwind classes and design tokens (never hardcode hex). Use `border-gray-100` for section dividers (matching existing patterns in the file). Use the same input className pattern already used by the existing address input.
  </action>
  <verify>
    <automated>cd C:/Users/glcar/prevailing-wage && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>`npx tsc --noEmit` passes. Worker form shows 4 address inputs in a grid, Union Information section with 2 inputs, conditionally rendered Apprenticeship section with 2 inputs. Worker card shows concatenated address. Mutation sends 8 new fields instead of single address.</done>
</task>

<task type="auto">
  <name>Task 2: Add classification override dropdown to PayrollWeekDetailPage</name>
  <files>src/client/pages/PayrollWeekDetailPage.tsx</files>
  <action>
Read `src/client/pages/PayrollWeekDetailPage.tsx` fully. This is the page that shows individual payroll entries for a week. Each row represents a worker's hours/pay for that week.

**1. Understand the data model:**
The page fetches payroll entries (which include worker info via the join). Each entry has:
- `entry.workerId` — the worker
- `tradeDescription` — currently from the default classification (now COALESCE'd with override from Plan 01)
- `overrideClassificationId` — new field from Plan 01, null if no override

The page also needs access to the worker's available classifications (the `worker_classifications` rows for that worker). Check if the page already fetches worker data with classifications, or if a separate query is needed.

**2. Fetch worker classifications for override dropdown:**
The page likely fetches workers for the project already (or entries include worker data). For the dropdown, we need each worker's available classifications. If the page doesn't already have this data, add a TanStack Query to fetch workers with classifications:
```typescript
const { data: workers } = useQuery({
  queryKey: ['workers', projectId],
  queryFn: () => fetch(`/api/projects/${projectId}/workers`).then(r => r.json()),
});
```

If a workers query already exists on this page, reuse it.

**3. Add override mutation:**
Create a TanStack Query mutation for the POST endpoint:
```typescript
const overrideMutation = useMutation({
  mutationFn: async ({ payrollWeekId, workerId, classificationId }: {
    payrollWeekId: string;
    workerId: string;
    classificationId: string;
  }) => {
    const res = await fetch(`/api/projects/${projectId}/payroll-week-classifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payrollWeekId, workerId, classificationId }),
    });
    if (!res.ok) throw new Error('Failed to set classification override');
    return res.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['payroll-entries', weekId] });
  },
});
```

Also add a delete mutation for removing overrides:
```typescript
const removeOverrideMutation = useMutation({
  mutationFn: async (overrideId: string) => {
    const res = await fetch(`/api/projects/${projectId}/payroll-week-classifications/${overrideId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to remove classification override');
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['payroll-entries', weekId] });
  },
});
```

**4. Add override dropdown to each worker entry row:**
In the entry row JSX (where each worker's hours are displayed), add a classification override dropdown. Find the worker's available classifications from the workers data:

```tsx
{/* Classification Override Dropdown */}
{(() => {
  const worker = workers?.find((w: any) => w.id === entry.workerId);
  const classifications = worker?.classifications ?? [];
  if (classifications.length <= 1) return null; // no point overriding if only one classification

  return (
    <select
      value={entry.overrideClassificationId ?? ''}
      onChange={e => {
        const val = e.target.value;
        if (val) {
          overrideMutation.mutate({
            payrollWeekId: weekId,
            workerId: entry.workerId,
            classificationId: val,
          });
        } else {
          // Remove override — need the override row ID
          // The entry should include overrideClassificationId but we need the override row ID
          // Alternative: use a dedicated query or pass through the response
          removeOverrideMutation.mutate(/* override row ID */);
        }
      }}
      className="text-sm border border-gray-200 rounded px-2 py-1"
    >
      <option value="">Default classification</option>
      {classifications.map((c: any) => (
        <option key={c.id} value={c.id}>
          {c.tradeDescription} ({c.laborType})
        </option>
      ))}
    </select>
  );
})()}
```

**Important consideration on DELETE:** The DELETE endpoint requires the override row `id`, not the classification ID. The current `getPayrollEntriesWithWorkerDetails` response includes `overrideClassificationId` but may not include the override row ID. Two options:
- Option A: Add `payrollWeekClassifications.id` to the select in payrollService (preferred — small change in Plan 01 summary file, or make in this task by updating payrollService).
- Option B: Use the POST endpoint with the worker's default classification ID to "reset" the override (POST replaces via DELETE+INSERT pattern).

**Use Option B** — it avoids needing to modify payrollService again. When the user selects "Default classification" (empty value), call POST with the worker's default classification ID (the first classification in `worker.classifications`, or skip the POST and just visually show the default). Actually, the simplest approach: when selecting empty, we need to remove the override. Since we don't have the override row ID easily, modify the approach:

**Revised DELETE approach:** Add a query endpoint or modify the POST route to handle "remove override" when classificationId matches the default. OR: simpler — in the payrollService query, also select the `payrollWeekClassifications.id` as `overrideId`. Read `src/server/services/payrollService.ts` and add `overrideId: payrollWeekClassifications.id` to the select. This is a one-line change and is worth doing here for a clean UI experience.

If modifying payrollService in this task, add to the select:
```typescript
overrideId: payrollWeekClassifications.id,
```

Then the DELETE call becomes: `removeOverrideMutation.mutate(entry.overrideId)` and is only shown when `entry.overrideId` is truthy.

**5. Visual indicator for active override:**
When an override is active (`overrideClassificationId` is not null), show a small visual indicator next to the classification — e.g., a Badge with variant "warning" showing "Override" or a colored border on the dropdown.

**Design tokens:** Use existing design tokens only. Use `border-gray-200` for the select border (matching existing form patterns). Use `Badge` component with `variant="warning"` for the override indicator if Badge is available on this page.
  </action>
  <verify>
    <automated>cd C:/Users/glcar/prevailing-wage && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>`npx tsc --noEmit` passes. PayrollWeekDetailPage shows a classification override dropdown per worker entry row. Dropdown lists worker's available classifications. Selecting a classification calls POST mutation. Selecting "Default" removes the override via DELETE. Active overrides show visual indicator. Query invalidation refreshes entry data on change.</done>
</task>

</tasks>

<verification>
After both tasks complete:
1. `npx tsc --noEmit` — zero TypeScript errors
2. WorkersPage form has 4 address inputs, union section, conditional apprenticeship section
3. Worker card/list displays concatenated address and new fields
4. Mutation payloads send 8 new fields
5. PayrollWeekDetailPage shows classification override dropdown per worker
6. Override mutations call correct API endpoints
7. No hardcoded hex values — design tokens only
8. UI primitives used where appropriate
</verification>

<success_criteria>
- `npx tsc --noEmit` passes with zero errors after every task
- WorkersPage: 4 address inputs in grid layout, Union Information section always visible, Apprenticeship section shown only for apprentice workers
- WorkersPage: worker card shows concatenated structured address
- PayrollWeekDetailPage: override dropdown visible for workers with multiple classifications
- Override selection triggers API call and refreshes entry data
- All form state uses flat keys (addressStreet, etc.) matching existing blankWorkerForm pattern
</success_criteria>

<output>
After completion, create `.planning/phases/39-worker-profile-depth/39-02-SUMMARY.md`
</output>
