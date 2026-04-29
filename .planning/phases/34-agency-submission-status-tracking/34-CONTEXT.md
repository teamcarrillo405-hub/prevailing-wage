# Phase 34: Agency Submission Status Tracking — Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

After downloading a CA eCPR XML or WA L&I CPR XML file, contractors can record that the submission was made to the respective portal. Each agency's submission status is independently tracked with its own timestamp column, displayed as a distinct badge on Payroll Week Detail, and clearable without affecting the other agency or the WH-347 submission status.

This phase does NOT include: agency portal API submission (deferred v4+), auto-detecting that a download has occurred, or any changes to the CA A-1-131 PDF or WA F700 PDF flows.

</domain>

<decisions>
## Implementation Decisions

### DB Schema (AS-01, AS-02)

- **D-01:** Add two nullable text columns to `payroll_weeks`:
  - `ca_ecpr_submitted_at` (nullable text, ISO 8601 timestamp)
  - `wa_lni_submitted_at` (nullable text, ISO 8601 timestamp)
  Both are nullable — no backfill needed. All existing rows have no agency submission.
- **D-02:** Migration file `0019_agency_submission.sql`, idx 15 in `_journal.json`. Contains two `ALTER TABLE payroll_weeks ADD COLUMN` statements separated by `-->  statement-breakpoint`.

### Drizzle Schema

- **D-03:** Add to `payrollWeeks` in `schema.ts`:
  ```ts
  caEcprSubmittedAt: text('ca_ecpr_submitted_at'),
  waLniSubmittedAt: text('wa_lni_submitted_at'),
  ```
  Both nullable text, no references.

### API Routes (AS-01, AS-02)

- **D-04:** Two new PATCH routes on the existing payroll router (or a dedicated sub-path):
  - `PATCH /api/payroll/weeks/:id/ca-submit` — sets `ca_ecpr_submitted_at = now()` when `submitted: true`, or `null` when `submitted: false`
  - `PATCH /api/payroll/weeks/:id/wa-submit` — same pattern for `wa_lni_submitted_at`
  Both require auth + `assertProjectAccess`. Request body: `{ submitted: boolean }`.
  Returns updated `{ caEcprSubmittedAt, waLniSubmittedAt }` (just the two fields).
- **D-05:** These routes do NOT enforce the WH-347 edit-lock (`submittedAt` guard). CA/WA submission status is independent of WH-347 submission. A contractor can mark CA DIR submitted even on a locked/submitted week.

### CA eCPR Modal — Step 2 (AS-01)

- **D-06:** The CA eCPR modal already has `ecprStep: 1 | 2` state. Step 2 (checklist) currently shows portal upload instructions. Add a "Mark as Submitted to CA DIR" button at the end of the Step 2 checklist. The button calls `PATCH /api/payroll/weeks/:id/ca-submit` with `{ submitted: true }`.
- **D-07:** If `week.caEcprSubmittedAt` is already set when the modal opens at step 2, show the badge ("CA DIR Submitted" + date) instead of the button, with an "Un-submit" link that calls the route with `{ submitted: false }`.

### WA CPR Modal — Add Step 2 (AS-02)

- **D-08:** The WA CPR intentId modal (`waCprIntentId` state, `handleWaCprConfirm` handler) is currently single-step. Add a `waCprStep: 1 | 2` state variable. After `handleWaCprConfirm` triggers a successful download, transition to step 2.
- **D-09:** WA CPR Step 2 mirrors CA eCPR Step 2 in structure: a brief "File downloaded" confirmation with portal instructions, followed by a "Mark as Submitted to WA L&I" button. Same button/un-submit logic as CA (D-06, D-07).

### Badge Display on PayrollWeekDetailPage (AS-01, AS-02)

- **D-10:** In the WH-347 submission section (where `week.submittedAt` badge is displayed), add two new badge rows — one for CA eCPR, one for WA L&I — below the WH-347 row. Each row is independent.
- **D-11:** Badge variants:
  - WH-347 "Submitted": `variant="compliant"` (green) — unchanged
  - CA DIR "Submitted": `variant="warning"` (amber)
  - WA L&I "Submitted": `variant="neutral"` (gray)
  All three use the existing `Badge` component with these established variants.
- **D-12:** Each agency row shows:
  - If submitted: `<Badge variant="...">CA DIR Submitted</Badge>` + date + "Un-submit" link
  - If not submitted: `<Badge variant="neutral">Not Submitted to CA DIR</Badge>` (no button — user submits from the modal)
  The "Mark as Submitted" action is ONLY in the modal flows (D-06, D-09). The detail page shows status and provides un-submit only. This keeps the flow: download → mark submitted in the same modal context.
- **D-13:** CA and WA badge rows are gated: CA row shows only when `project.state === 'CA'`, WA row shows only when `project.state === 'WA'`. No CA row shown on WA projects and vice versa.

### Un-submit behavior (AS-01, AS-02)

- **D-14:** Un-submit is a direct click (no confirmation modal). Matches the existing WH-347 un-submit pattern (`unsubmitMutation`). Show "Clearing..." pending state.
- **D-15:** Un-submitting CA or WA does NOT affect WH-347 `submittedAt`, the other agency's timestamp, or the week's edit lock.

### Claude's Discretion

- Exact copy for the WA CPR step 2 checklist items (WA portal steps)
- Loading/error states on the ca-submit and wa-submit mutations
- Whether to invalidate the `weekQuery` or just update state locally after submit/un-submit

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### DB Schema
- `src/server/db/schema.ts` — add `caEcprSubmittedAt` + `waLniSubmittedAt` to `payrollWeeks`
- `src/server/db/migrations/meta/_journal.json` — register idx 15, tag `0019_agency_submission`

### New Files
- `src/server/db/migrations/0019_agency_submission.sql` — two ALTER TABLE ADD COLUMN statements

### Files to Modify
- `src/server/routes/payroll.ts` — add `PATCH /weeks/:id/ca-submit` + `PATCH /weeks/:id/wa-submit`
- `src/client/pages/PayrollWeekDetailPage.tsx` — CA modal step 2 button, WA modal step 2, badge rows

### Requirements
- `.planning/REQUIREMENTS.md` §AS-01, AS-02

</canonical_refs>

<code_context>
## Existing Code Insights

### Current PayrollWeekDetailPage State (relevant to phase)
- `ecprStep: 1 | 2` — already exists; step 2 is the checklist section after CA eCPR download
- `waCprIntentId`, `waCprGenerating`, `waCprGeneratingRef` — WA CPR single-step modal state; add `waCprStep: 1 | 2` parallel to `ecprStep`
- `submitMutation` / `unsubmitMutation` — WH-347 pattern to replicate for CA/WA; use `useMutation` + `queryClient.invalidateQueries({ queryKey: ['week', weekId] })`
- Week type already has `submittedAt: string | null` — add `caEcprSubmittedAt: string | null` and `waLniSubmittedAt: string | null` to the local Week interface

### Existing WH-347 Badge Pattern (lines ~682–752)
```tsx
{week.submittedAt ? (
  <>
    <Badge variant="compliant">Submitted</Badge>
    {week.submittedAt} — {week.submittedTo}
    <button onClick={() => unsubmitMutation.mutate()}>Un-submit</button>
  </>
) : (
  <>
    <Badge variant="neutral">Not Submitted</Badge>
    <form>... Mark as Submitted ...</form>
  </>
)}
```
CA/WA rows follow the same pattern (badge + date + un-submit link when set; neutral badge when not set).

### Migration Convention
- SQL-only, manually registered in `meta/_journal.json`
- Next idx: 15, next tag: `0019_agency_submission`
- Two statements separated by `-->  statement-breakpoint` (two spaces — verify against project migrator)
- Note from Phase 33: the migrator on this project uses single space `-->  statement-breakpoint` — verify which works in the actual migration runner before committing

### Critical Pitfalls
- The CA row must be gated `project.state === 'CA'` and WA row gated `project.state === 'WA'` — no spurious "Not Submitted to CA DIR" on a WA project
- `PATCH /weeks/:id/ca-submit` must NOT enforce the WH-347 edit lock — CA/WA tracking is independent
- WA step 2 must only render when `waCprStep === 2`, not replace the existing intentId form

</code_context>

<specifics>
## Specific Implementation Details

- Migration: `0019_agency_submission.sql`, idx 15 — two ALTER TABLE ADD COLUMN statements
- Schema: `caEcprSubmittedAt` + `waLniSubmittedAt` on `payrollWeeks` (nullable text)
- API: `PATCH /api/payroll/weeks/:id/ca-submit` + `PATCH /api/payroll/weeks/:id/wa-submit`, body `{ submitted: boolean }`
- CA modal: "Mark as Submitted to CA DIR" button added to existing Step 2 checklist
- WA modal: `waCprStep: 1 | 2` added; Step 2 triggered after successful download
- Badge colors: CA = `warning` (amber), WA = `neutral` (gray), WH-347 = `compliant` (green, unchanged)
- Un-submit: direct click, no confirmation, same pattern as existing WH-347 un-submit
- State-gating: CA row only when `project.state === 'CA'`, WA row only when `project.state === 'WA'`

</specifics>

<deferred>
## Deferred Ideas

- Agency portal auto-submit (CA DIR eCPR API + WA L&I PWIA direct API) — no public API as of 2026-03; deferred v4+
- Submission status history / audit log
- "Mark as Submitted" available outside the modal (standalone button on detail page) — decided against in D-12

</deferred>

---

*Phase: 34-agency-submission-status-tracking*
*Context gathered: 2026-03-30*
