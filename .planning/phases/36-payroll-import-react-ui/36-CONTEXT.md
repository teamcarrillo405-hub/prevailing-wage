# Phase 36: Payroll Import — React UI — Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Add an "Import from Payroll Provider" button to PayrollWeekDetailPage that opens a 3-step import modal. Step 1: file picker. Step 2: preview table with matched rows, unmatched resolution dropdowns, and conflict warning panel. Step 3: commit summary with count + Confirm Import. After successful commit, the payroll-week query is invalidated and the detail page refreshes.

This phase does NOT include: worker creation from the modal (escape hatch to Workers page only), re-parsing the CSV on commit (server receives resolved rows from client), or any changes to the import server pipeline (Phase 35 — complete).

</domain>

<decisions>
## Implementation Decisions

### Entry Point (PI-03)

- **D-01:** Add an "Import from Payroll Provider" button to PayrollWeekDetailPage in the existing action buttons area (near the WH-347 / CA eCPR / WA CPR download buttons). Button is disabled + tooltip when `week.submittedAt` is set (locked week). Clicking opens the import modal.

### Modal State (PI-03)

- **D-02:** Add a `showImportModal: boolean` and `importStep: 1 | 2 | 3` state variable to PayrollWeekDetailPage, mirroring the `showEcprModal`/`ecprStep` pattern. When the modal closes (Cancel or success), reset both to `false` / `1`.

### Step 1 — File Picker (PI-03)

- **D-03:** Step 1 renders a file `<input type="file">` accepting `.csv` files, a "Browse file" label-styled button, and the selected filename displayed after selection. After file selection, call `POST /api/payroll/import/preview` with `FormData` (field name: `file`, plus `weekId`). Show "Parsing…" pending state during upload. On success → advance to Step 2. On 400 (unknown provider) → show inline error: "Could not detect payroll provider. Upload a QuickBooks Time by Employee Detail or ADP payroll export." On 423 (submitted week) → show inline error. On network error → show generic error.

### Step 2 — Preview / Resolve (PI-03)

- **D-04:** Step 2 shows the preview result. Structure from top to bottom:
  1. **Provider badge** — `<Badge variant="neutral">QuickBooks</Badge>` or `<Badge variant="neutral">ADP</Badge>`
  2. **ADP amber banner** (only when `adpWeeklyTotalsOnly === true`) — amber warning panel: "ADP export does not include daily breakdown. Hours are shown as weekly totals."
  3. **Conflict warning section** (only when `conflicts.length > 0`) — amber warning panel listing conflicting worker names with message: "These workers already have manual entries this week and cannot be imported. Delete their existing entries first."
  4. **Matched workers table** — one row per `ImportedRow` with checkbox (checked by default), worker name, classification, and hours columns. Checkboxes allow deselecting rows before commit.
  5. **Unmatched workers section** (only when `unmatched.length > 0`) — one row per `UnmatchedRow` with the CSV name, hours, and a dropdown (`<select>`) of existing project workers to remap to. If the contractor leaves a row unmapped, it is excluded from commit. Below the list: a note "Workers not remapped will be skipped. To import them, add them on the Workers page first."
  6. **Navigation**: "Back" button (returns to Step 1) + "Review Import →" button (advances to Step 3).

- **D-05:** The matched workers table columns depend on provider:
  - QB: full 14-column day grid (Mon–Sun ST/OT) — same pattern as existing payroll entry table
  - ADP (`adpWeeklyTotalsOnly`): collapse to 2 columns — "Total ST" (sum of all ST day fields) and "Total OT" (sum of all OT day fields)

- **D-06:** The unmatched worker remap dropdown is populated by the existing `GET /api/projects/:projectId/workers` query (already loaded in PayrollWeekDetailPage as `projectData`). Use `worker.id` as the value and `worker.name` as the label. Default option: `<option value="">— Select worker —</option>`.

### Step 3 — Confirm (PI-03)

- **D-07:** Step 3 shows a commit summary:
  - "Ready to import N entries for [provider]"
  - List of worker names being imported (matched + remapped unmatched)
  - If any rows were deselected or skipped: "X rows will be skipped"
  - Conflict warning repeat if any conflicts (non-committable)
  - "Confirm Import" button (primary, gold) — calls `POST /api/payroll/import/commit` with resolved rows
  - "Back" button — returns to Step 2

- **D-08:** On commit success:
  - Invalidate `['payroll-week', weekId]` and `['payroll-weeks', projectId]`
  - Close modal (reset state)
  - Show success message on the main page: inline banner (green) — "Imported N entries from [provider]." Auto-dismisses after 4 seconds or on next user action.

- **D-09:** On commit error (409 conflict re-detected server-side, 423 submitted lock): show inline error in Step 3 with specific message. Do not advance or close modal.

### Unmatched Worker Resolution (PI-03)

- **D-10:** Unmatched workers use a dropdown (not free-text) to map to an existing project worker. If no project workers exist or the contractor doesn't remap, the row is silently skipped on commit (with a count shown in the Step 3 summary). This satisfies PI-03 — rows are not silently skipped without the contractor seeing them; they are explicitly shown, and the contractor chooses to skip by leaving the dropdown empty.
- **D-11:** When a worker is remapped via dropdown, the `UnmatchedRow` is promoted to a resolved row for commit. The commit body sends it with the selected `workerId` (and the worker's active `classificationId` — fetched from `projectData.workers` on the client). If the selected worker has multiple classifications, use the first one; the contractor can edit the entry after import if needed.

### Conflicts Display (PI-03)

- **D-12:** Conflict rows are shown in a separate amber warning panel above the preview table (not inline in the table). The panel lists conflicting worker names and says: "These workers already have manual entries this week and cannot be imported. Delete their existing entries on the Payroll Entry page, then re-import." Conflict rows are NOT shown in the main table and cannot be committed.

### ADP Display (PI-03)

- **D-13:** When `adpWeeklyTotalsOnly === true`, show an amber sticky banner below the provider badge and above the preview table. Collapse the preview table to 2 columns: "Total Regular Hours" (sum monSt+tueSt+...+sunSt) and "Total OT Hours" (sum monOt+...+sunOt). No individual day columns shown for ADP imports.

### File State Between Steps (PI-03)

- **D-14:** The `ImportPreviewResult` from Step 1 is held in component state (`importPreview`) for Step 2 and Step 3. The resolved rows (matched checked rows + remapped unmatched rows) are computed in Step 3 before sending to commit. No re-upload required.

### Worker Classification for Remapped Rows (PI-03)

- **D-15:** When an unmatched row is remapped to an existing worker via dropdown, the commit payload uses that worker's first active classification from `projectData` (already in component state). If the worker has no classifications, the remap dropdown is shown but an inline warning is shown: "This worker has no classifications. Add a classification on the Workers page before importing." That row cannot be committed until classified.

### Claude's Discretion

- Exact copy for the amber ADP banner and conflict panel
- Loading/pending state styling during `POST /preview` ("Parsing…" step indicator)
- Whether the matched worker table uses `<table>` or CSS grid (use `<table>` — consistent with existing payroll entry tables in the app)
- Success banner dismiss behavior (4-second auto-dismiss or manual X)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### API (Phase 35 — Already Exists)
- `src/server/services/importTypes.ts` — `ImportedRow`, `UnmatchedRow`, `ConflictRow`, `ImportPreviewResult`
- `src/server/routes/import.ts` — `POST /api/payroll/import/preview` + `POST /api/payroll/import/commit`

### Files to Modify
- `src/client/pages/PayrollWeekDetailPage.tsx` — add import button, modal state, 3-step modal UI

### Existing Patterns to Replicate
- `ecprStep: 1 | 2` / `showEcprModal` — modal open/step state pattern
- `useMutation` + `queryClient.invalidateQueries({ queryKey: ['payroll-week', weekId] })` — commit mutation pattern
- `projectData.data.workers` — already fetched, reuse for remap dropdown
- `Badge`, `Card` components — for provider badge and warning panels

### Requirements
- `.planning/REQUIREMENTS.md` §PI-03

</canonical_refs>

<code_context>
## Existing Code Insights

### Modal Pattern in PayrollWeekDetailPage
```tsx
const [showEcprModal, setShowEcprModal] = useState(false);
const [ecprStep, setEcprStep] = useState<1 | 2>(1);
// ...
{showEcprModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    onClick={() => setShowEcprModal(false)}>
    <div className="..." onClick={e => e.stopPropagation()}>
      {ecprStep === 1 ? <Step1 /> : <Step2 />}
    </div>
  </div>
)}
```
Phase 36 uses `showImportModal` + `importStep: 1 | 2 | 3` — exact same pattern extended to 3 steps.

### Workers Already Available
```tsx
const { data: projectData } = useQuery({
  queryKey: ['project', projectId],
  queryFn: () => api.get(`/api/projects/${projectId}`)
});
// projectData.data.project and projectData.data.workers
```
No additional query needed for the remap dropdown.

### Commit Mutation Pattern
```tsx
const caSubmitMutation = useMutation({
  mutationFn: () => api.patch(`/api/payroll/weeks/${weekId}/ca-submit`, { submitted: true }),
  onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['payroll-week', weekId] }); }
});
```
Import commit mutation follows same pattern with `api.post`.

### FormData Upload Pattern
No existing FormData upload in this file — `POST /preview` requires `multipart/form-data`. Use:
```ts
const formData = new FormData();
formData.append('file', selectedFile);
formData.append('weekId', weekId);
await api.post('/api/payroll/import/preview', formData);
// Axios/fetch: do NOT set Content-Type manually — let browser set multipart boundary
```

### Critical Pitfalls
- Do NOT set `Content-Type: multipart/form-data` manually — browser/fetch must set the boundary
- Remap dropdown must use `workerId` value, not `workerName` — worker names are not unique
- ADP: collapse to total columns, not show 14 mostly-zero columns
- `importStep` must reset to `1` on modal close (both Cancel and success)
- The commit body must send resolved `ImportedRow[]` — not the raw CSV file again

</code_context>

<specifics>
## Specific Implementation Details

- Entry: "Import from Payroll Provider" button on PayrollWeekDetailPage, disabled on submitted week
- State: `showImportModal: boolean`, `importStep: 1 | 2 | 3`, `importPreview: ImportPreviewResult | null`
- Step 1: file input + POST /preview → ImportPreviewResult → advance to Step 2
- Step 2: provider badge, ADP banner (if applicable), conflict panel (if applicable), matched table (checkboxes), unmatched section (remap dropdowns)
- Step 3: commit summary, "Confirm Import" → POST /commit → invalidate queries → close modal + success banner
- ADP display: amber banner + 2-column totals (no day columns)
- Conflicts: amber panel above table, not inline rows
- Unmatched: dropdown to remap to existing worker (projectData already loaded); skip if not remapped
- No inline worker creation — escape hatch to Workers page
- Success: inline green banner, auto-dismiss 4 seconds

</specifics>

<deferred>
## Deferred Ideas

- Inline worker creation from the import modal (blocked by complexity — escape hatch to Workers page is sufficient for v3.0)
- Drag-and-drop file upload (file input button is adequate)
- Import history view ("previous imports for this week") — payroll_imports table exists but no UI read path
- Re-import / undo import — deferred per Phase 35 decision (event-level audit only)
- ADP daily breakdown (impossible — ADP Run platform limitation)

</deferred>

---

*Phase: 36-payroll-import-react-ui*
*Context gathered: 2026-03-31*
