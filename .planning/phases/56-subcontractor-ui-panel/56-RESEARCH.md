# Phase 56: Subcontractor UI Panel - Research

**Researched:** 2026-04-13
**Domain:** React UI panel on ProjectDetailPage — TanStack Query, inline forms, expand/collapse rows, status badge logic
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SUB-05 | Subcontractors panel on ProjectDetailPage: list all subs, add/edit/remove; expandable per-sub CPR week table with status badges (Received+Compliant, Received+Non-Compliant, Not Received, Overdue); Overdue = weekEndingDate >7 days ago + CPR not received; subs never mixed into GC counts | All 7 API routes live at /api/projects/:id/subcontractors and /api/projects/:id/subcontractors/:subId/cpr-weeks; badge logic maps to three-state isCompliant (null/0/1) + receivedDate + date math; Badge component supports compliant/violation/warning/neutral variants |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

- Design tokens via `@theme` in `src/client/index.css` — never hardcode colors: use `bg-nav-dark`, `border-brand-gold`, `text-brand-gold`, `bg-surface-card`, `bg-surface-page`, `font-headline` (Oswald), `font-body` (Inter)
- UI Primitives from `src/client/components/ui/`: `Card` (padding="default"|"sm"|"none"), `Button` (primary/secondary/ghost, no asChild), `Badge` (compliant/violation/warning/neutral), `PageHeader`, `EmptyState`
- `useRef` for synchronous guards (double-click prevention); TanStack Query key includes all variable state
- React patterns: TanStack Query with `useQuery`/`useMutation`/`useQueryClient`; invalidate after mutations
- `BadgeVariant` type is locked to `'compliant' | 'violation' | 'warning' | 'neutral'` — do not add new variants
- `--color-status-neutral` does NOT exist; neutral variant uses built-in `bg-gray-100/text-gray-600`
- No `asChild` prop on Button; copy secondary classes to `<a>` for download links
- Subs are never mixed into GC worker counts/totals/compliance rollups — sub panel is purely informational/tracking

---

## Summary

Phase 56 is a pure client-side UI task. All seven API routes were implemented and tested in Phase 55. No new server routes, schema changes, or migrations are needed.

The work is entirely within `ProjectDetailPage.tsx`: add a "Subcontractors" panel below the existing project info card, implementing the full CRUD surface for subs plus an expandable per-sub CPR week tracking table. The panel follows the same structural approach as the notification preferences panel already in the page — inline state-driven panels rendered conditionally within the project `{project && (...)}` block.

The most technically specific part of this phase is the CPR week status badge logic. Badge state derives from three inputs: (1) whether `receivedDate` is non-null, (2) the value of `isCompliant` (null/0/1 three-state integer), and (3) a date comparison between `weekEndingDate` (ISO text) and today minus 7 days. The "Overdue" badge fires only when receivedDate is null AND the weekEndingDate is more than 7 days in the past. This is pure client-side computation — no new server endpoint needed.

**Primary recommendation:** Build a single `SubcontractorsPanel` component inline in `ProjectDetailPage.tsx` (single-use component, same pattern as `WorkflowProgress`). Use `useState<string | null>` to track the expanded sub ID. Fetch subs once on panel mount; fetch CPR weeks lazily per sub when expanded. Badge logic is a pure helper function.

---

## Standard Stack

### Core (no new packages required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | existing | Component rendering | Project standard |
| @tanstack/react-query | existing | Server state — useQuery + useMutation + useQueryClient | Project standard across all pages |
| react-router-dom | existing | useParams for projectId | Project standard |
| lucide-react | existing | ChevronDown/ChevronRight icons for expand toggle | Already imported in ProjectDetailPage |

### No new installation required

This phase is pure UI wiring against existing API routes. All dependencies are present.

---

## Architecture Patterns

### Recommended Component Structure

The `SubcontractorsPanel` component lives inline in `ProjectDetailPage.tsx` (same file, not a separate file). This matches the `WorkflowProgress` inline component precedent — single-use components do not warrant separate files per CLAUDE.md.

```
ProjectDetailPage.tsx
├── WorkflowProgress (existing inline component)
├── SubcontractorsPanel (new inline component)
│   ├── Sub list rows (each expandable)
│   │   └── CprWeekTable (rendered inline when sub is expanded)
│   ├── Add sub inline form (shown/hidden via addingNew boolean state)
│   └── Edit sub inline form (shown/hidden per sub via editingSubId state)
└── (existing: notifPanelOpen, archiveModalOpen, etc.)
```

### Pattern 1: Lazy per-sub CPR week fetch

Fetch all subs for the project with one `useQuery`. Only fetch CPR weeks for a sub when the user expands that sub row. Use `enabled: !!expandedSubId && expandedSubId === sub.id` to gate the CPR weeks query.

```typescript
// Subs list — loaded once
const { data: subsData, isLoading: subsLoading } = useQuery({
  queryKey: ['subcontractors', id],
  queryFn: () => api.get<{ data: { subcontractors: Subcontractor[] } }>(`/projects/${id}/subcontractors`),
  enabled: !!id,
});

// CPR weeks — inside CprWeekTable, enabled only when this sub is expanded
const { data: cprData } = useQuery({
  queryKey: ['cpr-weeks', id, subId],
  queryFn: () => api.get<{ data: { cprWeeks: CprWeek[] } }>(`/projects/${id}/subcontractors/${subId}/cpr-weeks`),
  enabled: !!subId,
});
```

### Pattern 2: CPR Status Badge Logic

The badge logic is a pure function — no server involvement. Inputs: `receivedDate: string | null`, `isCompliant: number | null` (0/1/null), `weekEndingDate: string`.

```typescript
type CprStatus = 'overdue' | 'received-compliant' | 'received-non-compliant' | 'not-received';

function getCprStatus(week: CprWeek): CprStatus {
  const notReceived = !week.receivedDate;
  if (notReceived) {
    const daysAgo = Math.floor(
      (Date.now() - new Date(week.weekEndingDate).getTime()) / 86_400_000
    );
    return daysAgo > 7 ? 'overdue' : 'not-received';
  }
  return week.isCompliant === 1 ? 'received-compliant' : 'received-non-compliant';
}

// Badge variant mapping
const STATUS_BADGE: Record<CprStatus, { variant: BadgeVariant; label: string }> = {
  'received-compliant':     { variant: 'compliant', label: 'Received — Compliant' },
  'received-non-compliant': { variant: 'violation', label: 'Received — Non-Compliant' },
  'not-received':           { variant: 'neutral',   label: 'Not Received' },
  'overdue':                { variant: 'warning',   label: 'Overdue' },
};
```

**Key constraint:** `BadgeVariant` is locked to `'compliant' | 'violation' | 'warning' | 'neutral'` — confirmed in `Badge.tsx`. All four CPR statuses map onto existing variants without adding new ones.

### Pattern 3: Inline add/edit forms

Follow the notification preferences panel pattern already in `ProjectDetailPage.tsx`. Show/hide via `useState` booleans. Controlled inputs with a local form state object. Save via `useMutation` → `onSuccess: () => { queryClient.invalidateQueries(...); setAddingNew(false); }`.

```typescript
// State in SubcontractorsPanel
const [addingNew, setAddingNew] = useState(false);
const [editingSubId, setEditingSubId] = useState<string | null>(null);
const [expandedSubId, setExpandedSubId] = useState<string | null>(null);
const [form, setForm] = useState(blankSubForm());

// Add mutation
const addSubMutation = useMutation({
  mutationFn: (body: CreateSubBody) =>
    api.post(`/projects/${projectId}/subcontractors`, body),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['subcontractors', projectId] });
    setAddingNew(false);
    setForm(blankSubForm());
  },
});
```

### Pattern 4: "Mark Received / Non-Compliant" action

When a CPR week does not yet have a `receivedDate`, show action buttons: "Mark Received" (sets `receivedDate = today`, prompts for isCompliant). For a week that has a `receivedDate`, allow toggling `isCompliant`. These call `PATCH /api/projects/:id/subcontractors/:subId/cpr-weeks/:weekId`. After success, invalidate the CPR weeks query for that sub.

```typescript
// POST a new cpr-week record (when weekEndingDate entered manually)
const addCprWeekMutation = useMutation({
  mutationFn: (body: { weekEndingDate: string; receivedDate?: string; isCompliant?: 0 | 1; notes?: string }) =>
    api.post(`/projects/${projectId}/subcontractors/${subId}/cpr-weeks`, body),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cpr-weeks', projectId, subId] }),
});

// PATCH an existing cpr-week record
const updateCprWeekMutation = useMutation({
  mutationFn: ({ weekId, body }: { weekId: string; body: Partial<CprWeekUpdate> }) =>
    api.patch(`/projects/${projectId}/subcontractors/${subId}/cpr-weeks/${weekId}`, body),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cpr-weeks', projectId, subId] }),
});
```

### Pattern 5: Delete confirmation

Use inline conditional rendering (not a modal overlay) for sub deletion — e.g., a "Confirm delete?" prompt replacing the row's action buttons temporarily. This avoids the full modal overhead used for the archive confirmation. The DELETE route hard-deletes and cascades CPR weeks.

### Expand/Collapse: useState, not HTML details/summary

Use `useState<string | null>(null)` for `expandedSubId` rather than HTML `<details>/<summary>` elements. The HTML approach is used for fixed-open state-specific sections in WorkersPage (always `open`), but for user-toggled accordion rows, `useState` gives cleaner control over the expand icon rotation and conditional query fetching.

### Anti-Patterns to Avoid

- **Mixing subs into GC compliance rollup:** The subcontractor panel is display-only for CPR tracking. Never pass sub CPR data to `computeCompliance` or show sub counts in the WorkflowProgress indicator.
- **Fetching all CPR weeks upfront:** Don't load all sub CPR weeks on page mount. Use lazy fetch (`enabled: expandedSubId === sub.id`) to avoid N+1 fetches for projects with many subs.
- **Adding a new BadgeVariant:** The four CPR statuses map cleanly to existing variants. Do not extend the `BadgeVariant` type.
- **Using asChild on Button:** Button has no `asChild` prop. For any link-styled button, copy secondary classes directly.
- **Hardcoding #hex values:** Use `@theme` tokens — `bg-surface-card`, `text-brand-gold`, `border-brand-gold`, etc.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Server state sync | Custom fetch + state | TanStack Query (useQuery/useMutation) | Already installed; handles cache invalidation, loading/error states, stale-time |
| Date math for overdue | Moment.js / date-fns | Inline `Date.now() - new Date(weekEndingDate).getTime()` | Simple subtraction is sufficient; no library needed for one date comparison |
| Form validation | Custom validation library | Inline `if (!form.name.trim())` guard before mutation | Server validates via Zod; client only needs empty-check on required `name` field |
| Modal component | Custom modal library | Existing `fixed inset-0 bg-black/40` pattern from archiveModal | Already established in same file |

---

## Common Pitfalls

### Pitfall 1: isCompliant three-state semantics
**What goes wrong:** Treating `isCompliant` as a boolean. `null` means "not yet assessed" (CPR received but compliance not determined), `0` means non-compliant, `1` means compliant.
**Why it happens:** Drizzle integer columns with no mode default to number | null, but the natural JS intuition is boolean.
**How to avoid:** The badge logic function must check `week.isCompliant === 1` (not just `week.isCompliant`) for compliant, and `week.isCompliant === 0` for non-compliant. A received week with `isCompliant === null` should still show "Received — Non-Compliant" or a separate "Pending Assessment" variant — per the requirement spec, the two named received states are Compliant and Non-Compliant, so treat null-isCompliant-with-receivedDate as non-compliant for badge purposes.
**Warning signs:** Badge flickers between states, or received weeks show as "Not Received."

### Pitfall 2: weekEndingDate timezone offset
**What goes wrong:** `new Date('2026-04-06')` interprets the date string as UTC midnight, but `Date.now()` is local time. On machines west of UTC, a Sunday weekEndingDate can appear to be one day earlier than intended.
**Why it happens:** ISO date strings without a time component are parsed as UTC by the ECMA-262 spec.
**How to avoid:** For the overdue comparison, append `T00:00:00` to force local parsing: `new Date(week.weekEndingDate + 'T00:00:00')`. Or compare date strings directly after stripping time from `new Date().toISOString().slice(0,10)`.
**Warning signs:** A week that ended exactly 7 days ago shows as "Overdue" only on some machines.

### Pitfall 3: Query key mismatch on invalidation
**What goes wrong:** After a mutation, the CPR weeks table does not refresh because the `invalidateQueries` key does not exactly match the `useQuery` key.
**Why it happens:** TanStack Query does prefix matching on arrays, but if the key arrays are ordered differently or have missing elements, invalidation misses.
**How to avoid:** Use consistent key arrays: `['subcontractors', projectId]` for the subs list; `['cpr-weeks', projectId, subId]` for a specific sub's CPR weeks. Invalidate using the same arrays in mutation `onSuccess` handlers.

### Pitfall 4: Expanded sub lost after add/remove mutation
**What goes wrong:** After adding or removing a subcontractor, the `expandedSubId` state still holds a sub ID that may no longer be valid (on delete) or may refer to a stale entry.
**Why it happens:** The subs list query refetches but local `expandedSubId` state is not cleared.
**How to avoid:** In the delete mutation's `onSuccess`, call `setExpandedSubId(prev => prev === deletedSubId ? null : prev)`.

### Pitfall 5: 409 on duplicate CPR week
**What goes wrong:** User tries to add a CPR week for a `weekEndingDate` that already has a record — server returns 409.
**Why it happens:** The server enforces UNIQUE `(subcontractorId, weekEndingDate)` at both DB and application level.
**How to avoid:** Display the 409 error message to the user ("CPR week record already exists for this subcontractor and week ending date") rather than silently failing. The `api.post` call will throw on non-2xx status; catch in `onError` of the mutation or use the `isError` mutation state.

---

## Code Examples

### TypeScript interfaces for sub and CPR week

```typescript
// Source: subcontractors.ts routes (Phase 55) + schema.ts (Phase 54)
interface Subcontractor {
  id: string;
  projectId: string;
  name: string;
  licenseNumber: string | null;
  contactName: string | null;
  contactEmail: string | null;
  address: string | null;
  createdAt: string;
}

interface CprWeek {
  id: string;
  subcontractorId: string;
  weekEndingDate: string;          // YYYY-MM-DD text
  receivedDate: string | null;     // YYYY-MM-DD text, null = not received
  isCompliant: number | null;      // null=unassessed, 0=non-compliant, 1=compliant
  notes: string | null;
  createdAt: string;
}
```

### Add sub mutation with invalidation

```typescript
const addSubMutation = useMutation({
  mutationFn: (body: { name: string; licenseNumber?: string; contactName?: string; contactEmail?: string; address?: string }) =>
    api.post<{ data: { subcontractor: Subcontractor } }>(`/projects/${id}/subcontractors`, body),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['subcontractors', id] });
    setAddingNew(false);
  },
});
```

### Badge rendering for a CPR week

```typescript
function CprStatusBadge({ week }: { week: CprWeek }) {
  const status = getCprStatus(week);
  const { variant, label } = STATUS_BADGE[status];
  return <Badge variant={variant}>{label}</Badge>;
}
```

### Expand toggle with chevron icon

```typescript
// Source: existing pattern approach from ProjectDetailPage notification panel
<button
  className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-brand-gold transition-colors"
  onClick={() => setExpandedSubId(prev => prev === sub.id ? null : sub.id)}
  aria-expanded={expandedSubId === sub.id}
>
  <ChevronRight className={cn('w-4 h-4 transition-transform', expandedSubId === sub.id && 'rotate-90')} />
  {sub.name}
</button>
```

---

## API Surface (Phase 55 — already live)

All routes are mounted at `/api/projects` in `index.ts` via `app.use('/api/projects', subcontractorsRouter)`.

| Method | Path | Purpose | Response shape |
|--------|------|---------|----------------|
| GET | `/api/projects/:id/subcontractors` | List all subs | `{ data: { subcontractors: Subcontractor[] } }` |
| POST | `/api/projects/:id/subcontractors` | Create sub | `{ data: { subcontractor: Subcontractor } }` 201 |
| PATCH | `/api/projects/:id/subcontractors/:subId` | Update sub | `{ data: { subcontractor: Subcontractor } }` |
| DELETE | `/api/projects/:id/subcontractors/:subId` | Remove sub + cascade CPR weeks | `{ data: { deleted: true } }` |
| GET | `/api/projects/:id/subcontractors/:subId/cpr-weeks` | List CPR weeks (desc) | `{ data: { cprWeeks: CprWeek[] } }` |
| POST | `/api/projects/:id/subcontractors/:subId/cpr-weeks` | Add CPR week | `{ data: { cprWeek: CprWeek } }` 201; 409 on duplicate |
| PATCH | `/api/projects/:id/subcontractors/:subId/cpr-weeks/:weekId` | Update CPR week status | `{ data: { cprWeek: CprWeek } }` |

**Zod validation on POST/PATCH sub:**
- `name`: required string min(1) max(500)
- `licenseNumber`, `contactName`, `address`: optional string max(200/500)
- `contactEmail`: optional valid email

**Zod validation on POST/PATCH CPR week:**
- `weekEndingDate`: required YYYY-MM-DD regex on POST; not in PATCH body
- `receivedDate`: optional YYYY-MM-DD or null
- `isCompliant`: optional `z.union([z.literal(0), z.literal(1)])` or null — NOT a boolean
- `notes`: optional string max(1000) or null

---

## Validation Architecture

`workflow.nyquist_validation` key is absent from `.planning/config.json` — treat as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Notes |
|--------|----------|-----------|-------|
| SUB-05 | Badge logic — getCprStatus pure function | Unit | Testable without DOM: input CprWeek objects, assert CprStatus output |
| SUB-05 | Overdue calculation at boundary (exactly 7 days, 8 days) | Unit | Pure function, no DOM needed |
| SUB-05 | isCompliant three-state mapping (null/0/1) | Unit | Pure function |
| SUB-05 | Panel renders — React component smoke test | Manual / visual | TanStack Query mock setup cost; manual verification acceptable |

### Wave 0 Gaps

- [ ] `src/server/services/cprStatus.test.ts` (or `src/client/lib/cprStatus.test.ts`) — covers SUB-05 badge logic (if the helper is extracted to a testable module)

**Note:** If `getCprStatus` is kept inline in `ProjectDetailPage.tsx`, unit testing it requires either extracting it to a separate utility file OR accepting manual visual verification only. The planner should decide whether to extract to `src/client/lib/cprStatus.ts` for testability. The logic is simple enough that manual verification is acceptable for this phase.

---

## Environment Availability

Step 2.6: SKIPPED — this phase has no external tool dependencies beyond the existing project stack (Node.js, npm, Vitest all confirmed installed in prior phases).

---

## Open Questions

1. **CPR week add UX: manual date input vs. date picker**
   - What we know: `weekEndingDate` is a free-text ISO date string; the server validates YYYY-MM-DD format via Zod regex
   - What's unclear: Should the UI use `<input type="date">` (browser native picker) or a plain text input with format hint?
   - Recommendation: Use `<input type="date">` — it gives YYYY-MM-DD output natively, no library needed, consistent with other date inputs in the project

2. **How many CPR weeks to show per sub**
   - What we know: The GET route returns all weeks ordered by `weekEndingDate DESC`
   - What's unclear: Projects can run for many months; a sub with 52 weeks of data would make the expanded row very long
   - Recommendation: Show all weeks (no pagination) for now; most projects have fewer than 20 active weeks; pagination can be added in a future phase if needed

3. **isCompliant null-with-receivedDate badge display**
   - What we know: `isCompliant` can be null even when `receivedDate` is set (CPR received but compliance not yet assessed)
   - What's unclear: The requirement says "Received+Compliant" and "Received+Non-Compliant" — no explicit "Received+Pending" state is named
   - Recommendation: Treat `receivedDate != null && isCompliant === null` as "Received — Pending" shown with `warning` badge variant; or collapse into "Received — Non-Compliant" (simpler). Planner should decide which to use; this research recommends the explicit "Pending" label using `warning` variant to distinguish from confirmed non-compliance.

---

## Sources

### Primary (HIGH confidence)

- `src/server/routes/subcontractors.ts` — all 7 route handlers, Zod schemas, response shapes (Phase 55 implementation, read directly)
- `src/server/db/schema.ts` lines 412–439 — `subcontractors` and `subcontractorCprWeeks` table definitions, `isCompliant` integer semantics
- `src/client/pages/ProjectDetailPage.tsx` — existing inline component pattern (`WorkflowProgress`), notification panel pattern, TanStack Query usage
- `src/client/components/ui/Badge.tsx` — confirmed `BadgeVariant` type, variant class definitions
- `src/client/components/ui/Card.tsx`, `Button.tsx`, `EmptyState.tsx` — confirmed prop signatures
- `.planning/STATE.md` Accumulated Context — Phase 54/55 locked decisions on `isCompliant` three-state semantics

### Secondary (MEDIUM confidence)

- `src/client/pages/WorkersPage.tsx` — expand pattern using HTML `<details>/<summary>` (always-open variant); confirmed `useState` is preferred for user-controlled accordion rows
- `.planning/REQUIREMENTS.md` SUB-05 — exact success criteria wording for badge labels and overdue rule

---

## Metadata

**Confidence breakdown:**
- API surface: HIGH — routes read directly from Phase 55 implementation
- Badge logic: HIGH — three-state semantics locked in STATE.md, Badge variants confirmed in Badge.tsx
- Component structure: HIGH — ProjectDetailPage patterns read directly, existing inline component precedent is clear
- Date math pitfall: HIGH — UTC midnight trap is a documented JS spec behavior

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (stable domain — UI patterns and API routes are already implemented)
