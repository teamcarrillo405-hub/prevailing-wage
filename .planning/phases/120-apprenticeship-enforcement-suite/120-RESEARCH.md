# Phase 120: Apprenticeship Enforcement Suite — Research

**Researched:** 2026-04-29
**Domain:** Compliance enforcement UI + DB schema + server-side violation logic
**Confidence:** HIGH

---

## Summary

The core server-side logic for Phase 120 is **already implemented**. The schema columns exist (`apprenticeshipRequirements`, `isIraIijaProject` on `projects`; `apprenticeshipProgramName`, `rapidsNumber` on `workers`). The DB migrations for those columns landed in `0041_qbo_tokens.sql`. The compliance engine already implements COMP-04 (`apprentice-trade-ratio`) and COMP-05 (`ira-iija-apprentice-pct`) in `complianceService.ts`. The client `ApprenticeshipDashboard` component and its server route (`GET /api/apprenticeship/:projectId/apprenticeship-dashboard`) shipped in Phase 117. ProjectForm already shows the Apprenticeship Ratios section. WorkersPage already shows the `apprenticeshipProgramName` / `rapidsNumber` fields in the edit form when `w.classifications.some(c => c.laborType === 'apprentice')`.

**The gap is three narrow UI polish / test gaps:** (1) `apprenticeshipProgramName` and `rapidsNumber` are NOT shown in the **add-worker** form (only the edit form), (2) the `PayrollWeekDetailPage` violation panel renders `wv.detail` as a flat string — it does not parse and render the per-trade COMP-04 structured fields (`trade`, `excessHours`, `estimatedLiabilityUsd`) with the specific pill + row format described in APP-05, and (3) COMP-04/COMP-05 have no Vitest coverage in `complianceService.test.ts`.

**Primary recommendation:** Phase 120 is a precision delta — three tasks: (1) add `apprenticeshipProgramName`/`rapidsNumber` inputs to the add-worker form section, (2) upgrade the violation panel in `PayrollWeekDetailPage` to render COMP-04 details as a structured row rather than a flat string, (3) add COMP-04 and COMP-05 test cases to `complianceService.test.ts`.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| APP-01 | `apprenticeship_requirements` JSON on projects; ProjectForm Apprenticeship Ratios section with trade dropdown + ratio; visible when funding_type = federal/state | **Already shipped.** Schema column exists; ProjectForm section with `isFederalOrState` guard, trade-ratio table, and `isIraIijaProject` checkbox already live. No new work needed. |
| APP-02 | `apprenticeshipProgramName` + `rapidsNumber` on workers; shown on WorkersPage when `isApprenticeship=true` | Schema columns, server routes, and **edit** form already live. Gap: these fields are absent from the **add-worker** form's apprenticeship section (the form only adds them when `laborType === 'apprentice'` inside the mutation, but there are no UI inputs in `blankWorkerForm()`). |
| APP-03 | COMP-04 per-trade daily ratio check with `estWageLiability`; fires in complianceService | **Already implemented** in `complianceService.ts` (lines 276–362). Aggregates by trade description, parses ratio string, computes `estimatedLiabilityUsd`. **Zero tests exist.** |
| APP-04 | `ira_iija_project` boolean on projects; dashboard shows "Apprentice Hours %" with 15% indicator; COMP-05 fires if below 15% | `isIraIijaProject` column exists; COMP-05 implemented in `complianceService.ts` (lines 364–399); `ApprenticeshipDashboard` IRA/IIJA banner wired in Phase 117. **Fully shipped.** No work needed unless the planner wants to verify ApprenticeshipSection renders in ProjectDetailPage — it does (line 1780 of ProjectDetailPage.tsx). |
| APP-05 | PayrollWeekDetailPage violation panel shows per-trade COMP-04 breakdown — "Electricians: 4 apprentice hrs, 2 JW hrs (max: 2). Excess: 2 hrs. Est. wage adjustment: $XX." | `WeekViolation` interface already has `trade`, `excessHours`, `estimatedLiabilityUsd` fields. The existing violation panel renders `wv.detail` as a plain string. Gap: need a structured render branch for `violationType === 'apprentice-trade-ratio'` that shows the pill + per-field breakdown format from the requirement. |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

- **NEVER hard-delete projects or payroll weeks** — 29 CFR Part 3 three-year retention. No DELETE endpoints for projects.
- **No drop/rename migrations** — add-only `ALTER TABLE ... ADD COLUMN` SQL files in `src/server/db/migrations/`. Register in `meta/_journal.json`.
- **Design tokens only** — use `bg-nav-dark`, `text-brand-gold`, `bg-brand-gold`, `font-headline`, `font-body`. Never hardcode hex values in JSX.
- **UI primitives** — `Card`, `Button`, `Badge` (variants: `compliant`, `violation`, `warning`, `neutral`), `PageHeader`, `EmptyState` from `src/client/components/ui/`.
- **React patterns** — `useRef` for synchronous guards; TanStack Query keys include all variable state; Blob URL downloads via fetch → Blob → `URL.createObjectURL()`.
- **assertProjectAccess** before any project-scoped data in route files (IDOR guard).
- **Non-fatal emails** — all send functions: try/catch + console.error, never rethrow.

---

## Standard Stack

### Core (already in use — no new installs required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | installed | Schema + migrations | Project-wide ORM |
| express + TypeScript | installed | Server routes | Project standard |
| React + TanStack Query | installed | Client data fetching | Project standard |
| Vitest | installed | Testing | Project test runner — `npm test` |
| Zod | installed | Route body validation | Project standard |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Pattern 1: Conditional field display in worker add-form

**What:** The add-worker form's apprenticeship section is gated on `form.laborType === 'apprentice'`. This is the same gate that controls `apprenticePercent`. `apprenticeshipProgramName` and `rapidsNumber` inputs must be inserted inside the existing apprentice-conditional block in the add form, parallel to their edit-form counterparts.

**When to use:** Any time a field applies only to apprentice workers.

**Example — existing edit form pattern (line 728–758):**
```tsx
// Source: src/client/pages/WorkersPage.tsx line 728
{w.classifications.some(c => c.laborType === 'apprentice') && (
  <div className="mt-4 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
    <p className="text-xs font-semibold text-amber-800">Apprenticeship Program (Phase 70)</p>
    <div>
      <label ... >Apprenticeship Program Name</label>
      <input value={editForm.apprenticeshipProgramName ?? ''} ... />
    </div>
    <div>
      <label ... >RAPIDS Number</label>
      <input value={editForm.rapidsNumber ?? ''} ... />
    </div>
  </div>
)}
```

The add-form equivalent must gate on `form.laborType === 'apprentice'` and read from `form.apprenticeshipProgramName` / `form.rapidsNumber` (already in `blankWorkerForm()` and passed to the mutation — just no UI inputs yet).

### Pattern 2: Structured violation rendering in PayrollWeekDetailPage

**What:** The existing violation list renders `wv.detail` as a plain string for all `weekViolations`. APP-05 requires a structured row for `violationType === 'apprentice-trade-ratio'` that formats as a pill + multi-field breakdown. The `detail` string already contains the formatted text, but the requirement is for a richer display.

**Existing pattern (lines 1779–1786 and 3357–3365, two render sites):**
```tsx
// Source: src/client/pages/PayrollWeekDetailPage.tsx ~line 1779
{complianceData.weekViolations?.map((wv, i) => (
  <li key={`week-${i}`} className="flex items-start gap-2 text-sm text-gray-700">
    <Badge variant="violation" className="mt-0.5 shrink-0">
      {wv.violationType === 'apprentice-trade-ratio' ? 'Trade Ratio' :
       wv.violationType === 'ira-iija-apprentice-pct' ? 'IRA\IIJA' :
       'Apprentice Ratio'}
    </Badge>
    <span>{wv.detail}</span>
  </li>
))}
```

**Target pattern for APP-05** — when `violationType === 'apprentice-trade-ratio'` and `wv.trade` is set, render structured fields:
```tsx
{wv.violationType === 'apprentice-trade-ratio' && wv.trade ? (
  <span>
    <strong>{wv.trade}</strong>:{' '}
    {wv.apprenticeHours.toFixed(1)} apprentice hrs,{' '}
    {wv.journeyworkerHours.toFixed(1)} JW hrs (max: {wv.maxAllowedApprenticeHours.toFixed(1)}).
    {' '}Excess: {wv.excessHours?.toFixed(1)} hrs.
    {' '}Est. wage adjustment: ${wv.estimatedLiabilityUsd?.toFixed(2)}
  </span>
) : (
  <span>{wv.detail}</span>
)}
```

Note: There are **two render sites** in `PayrollWeekDetailPage.tsx` — the main violations section (~line 1779) and the WH-347 preflight modal (~line 3357). Both need to be updated.

### Pattern 3: COMP-04 and COMP-05 Vitest test structure

**What:** `tests/services/complianceService.test.ts` already has COMP-03 tests (lines 278–389). COMP-04 and COMP-05 must follow the same factory pattern: create project row with `apprenticeshipRequirements`/`isIraIijaProject` in the seed, create payroll entries, run `computeCompliance`, assert on `weekViolations`.

**Source:** `tests/services/complianceService.test.ts` lines 278–302 (COMP-03 pattern).

COMP-04 test matrix needed:
- Fires when apprentice hours exceed configured trade ratio (one trade, ratio "1:2").
- Does NOT fire when apprentice hours are at or below ratio.
- Does NOT fire when `apprenticeshipRequirements` is null on the project.
- `estimatedLiabilityUsd` > 0 when JW rate > apprentice rate.

COMP-05 test matrix needed:
- Fires when `isIraIijaProject = true` and apprentice % < 15%.
- Does NOT fire when apprentice % >= 15%.
- Does NOT fire when `isIraIijaProject = false`.

### Project Structure (relevant files)

```
src/
├── client/
│   ├── pages/
│   │   ├── WorkersPage.tsx          # add-form: add APP-02 inputs in laborType === 'apprentice' block
│   │   └── PayrollWeekDetailPage.tsx # violation panel: 2 render sites for APP-05 structured display
│   └── components/
│       └── ApprenticeshipDashboard.tsx  # already complete; wire-up done in ProjectDetailPage.tsx
├── server/
│   ├── services/
│   │   └── complianceService.ts     # COMP-04 + COMP-05 already implemented; no changes needed
│   ├── routes/
│   │   └── apprenticeship.ts        # already complete
│   └── db/
│       └── schema.ts                # apprenticeshipRequirements + isIraIijaProject + apprenticeshipProgramName + rapidsNumber all present
└── tests/
    └── services/
        └── complianceService.test.ts  # add COMP-04 and COMP-05 test cases here
```

### Anti-Patterns to Avoid

- **Duplicating COMP-04/COMP-05 logic in the client** — the violation data already comes from `computeCompliance`; the client only needs to render the structured fields from `WeekViolation`.
- **Adding a new migration** — all four apprenticeship columns already exist in the schema and were migrated in `0041_qbo_tokens.sql`. A new migration would be wrong.
- **Changing the `WeekViolation` interface in `complianceService.ts`** — all fields needed for APP-05 (`trade`, `excessHours`, `estimatedLiabilityUsd`) already exist on the interface (lines 36–40 of complianceService.ts).
- **Gating `apprenticeshipProgramName`/`rapidsNumber` on a project flag** — these are gated on `laborType === 'apprentice'`, not on a project funding type or state. The existing edit form already uses this pattern correctly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Compliance violation computation | Re-implement ratio math in client | `complianceService.ts` COMP-04/COMP-05 already fully implemented | Server is single source of truth; client renders what server returns |
| Apprenticeship dashboard data | New endpoint or client-side aggregation | `GET /api/apprenticeship/:projectId/apprenticeship-dashboard` already ships per-trade data | Avoids duplicating GROUP BY SQL |
| Test DB seeding helpers | New factory | Use existing `createProject`, `createWorker`, `createPayrollEntry` helpers from `tests/helpers/` | Consistent with all 849 existing tests |

---

## Common Pitfalls

### Pitfall 1: Two violation render sites in PayrollWeekDetailPage

**What goes wrong:** A developer updates the main violations panel but misses the WH-347 preflight modal violation list (~line 3357). COMP-04 detail appears in the main panel but renders as a flat string in the preflight.

**Why it happens:** The file is long (~3400 lines). The preflight modal repeats the violation list.

**How to avoid:** Search for `weekViolations?.map` — exactly two occurrences exist. Both must be updated.

**Warning signs:** If the task only changes one render site, the preflight panel will still show the flat `wv.detail` string.

### Pitfall 2: add-form vs. edit-form distinction in WorkersPage

**What goes wrong:** Developer adds inputs to the wrong section. The edit form is inside `{editingId === w.id ? (...) : (...)}`. The add form is at the bottom of the page (after the worker list). They share `blankWorkerForm()` state but are separate JSX blocks.

**How to avoid:** The add form's apprentice section is gated by `{form.laborType === 'apprentice' && (...)}`. Add the two inputs inside this gate, mirroring the edit form's amber-bordered block.

### Pitfall 3: `wv.detail` already contains formatted text — don't remove it

**What goes wrong:** Replacing `<span>{wv.detail}</span>` entirely breaks the `apprentice-ratio` and `ira-iija-apprentice-pct` cases which rely on `detail` for display.

**How to avoid:** The structured render is conditional on `wv.violationType === 'apprentice-trade-ratio' && wv.trade`. All other violation types fall through to `<span>{wv.detail}</span>`.

### Pitfall 4: COMP-04 uses trade description matching (not exact key lookup)

**What goes wrong:** Tests that configure `apprenticeshipRequirements` with a trade key like `"Electrician"` expect an exact match, but the compliance engine uses case-insensitive partial match (`k.toLowerCase().includes(configTrade.toLowerCase())`). Trade entries from payroll use `tradeDescription` (e.g. `"ELECTRICIAN, JW"`).

**How to avoid:** In tests, set both the config trade key AND the `tradeDescription` on worker classifications to values that satisfy the partial match. Use the same string for both (e.g. `"Electrician"` in config, `"Electrician"` in tradeDescription).

---

## Code Examples

### COMP-04 already implemented — key section

```typescript
// Source: src/server/services/complianceService.ts lines 276–362
if (project?.apprenticeshipRequirements) {
  let ratioConfig: Record<string, { maxRatio: string }> = {};
  try {
    ratioConfig = JSON.parse(project.apprenticeshipRequirements);
  } catch { ratioConfig = {}; }

  for (const [configTrade, { maxRatio }] of Object.entries(ratioConfig)) {
    const matchKey = [...tradeJwHours.keys()].find(
      k => k.toLowerCase().includes(configTrade.toLowerCase()) ||
           configTrade.toLowerCase().includes(k.toLowerCase()),
    ) ?? configTrade;

    const jwHours = tradeJwHours.get(matchKey) ?? 0;
    const appHours = tradeAppHours.get(matchKey) ?? 0;

    // Parse "1:2" → numerator/denominator; compute maxAllowedApp
    const parts = maxRatio.split(':').map(Number);
    const maxAllowedApp = jwHours * ((parts[0] ?? 1) / (parts[1] ?? 1));

    if (appHours > maxAllowedApp + 0.001) {
      // estimatedLiabilityUsd = excessHours × (avgJwRate − avgAppRate)
      weekViolations.push({
        violationType: 'apprentice-trade-ratio',
        trade: configTrade,
        excessHours,
        estimatedLiabilityUsd,
        ...
      });
    }
  }
}
```

### WeekViolation interface — all APP-05 fields already present

```typescript
// Source: src/server/services/complianceService.ts lines 29–42
export interface WeekViolation {
  violationType: 'apprentice-ratio' | 'apprentice-trade-ratio' | 'ira-iija-apprentice-pct';
  detail: string;
  apprenticeHours: number;
  journeyworkerHours: number;
  maxAllowedApprenticeHours: number;
  // COMP-04 extra fields (per-trade ratio):
  trade?: string;
  excessHours?: number;
  estimatedLiabilityUsd?: number;
  // COMP-05 extra fields:
  totalHours?: number;
  actualPct?: number;
}
```

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely code changes to existing files. No external dependencies beyond the project's own stack.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (vitest.config.ts in project root) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/services/complianceService.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| APP-02 | `apprenticeshipProgramName`/`rapidsNumber` inputs visible in add-worker form when `laborType=apprentice` | manual visual | — | — (UI only) |
| APP-03 | COMP-04 fires when apprentice hours exceed per-trade ratio | unit | `npx vitest run tests/services/complianceService.test.ts` | Existing file, new test cases needed |
| APP-03 | COMP-04 does NOT fire when ratio is satisfied | unit | `npx vitest run tests/services/complianceService.test.ts` | Existing file, new test cases needed |
| APP-03 | COMP-04 `estimatedLiabilityUsd` computed correctly | unit | `npx vitest run tests/services/complianceService.test.ts` | Existing file, new test cases needed |
| APP-04 | COMP-05 fires when IRA/IIJA project apprentice % < 15% | unit | `npx vitest run tests/services/complianceService.test.ts` | Existing file, new test cases needed |
| APP-04 | COMP-05 does NOT fire when % >= 15% or project not IRA/IIJA | unit | `npx vitest run tests/services/complianceService.test.ts` | Existing file, new test cases needed |
| APP-05 | Structured COMP-04 breakdown rendered in PayrollWeekDetailPage main panel | manual visual | — | — (UI only) |
| APP-05 | Structured COMP-04 breakdown rendered in WH-347 preflight modal | manual visual | — | — (UI only) |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/services/complianceService.test.ts`
- **Per wave merge:** `npm test` (full suite — currently 849 tests)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

None — existing test infrastructure covers all phase requirements. New test cases are additions to the existing `tests/services/complianceService.test.ts` file, not new files.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-week aggregate apprenticeship ratio (COMP-03) | Per-trade per-week ratio (COMP-04) + IRA/IIJA 15% (COMP-05) | Phase 120 | More granular violations; contractors can identify which specific trade is out of ratio |
| Generic `wv.detail` string in violation panel | Structured per-trade breakdown with hours + dollar estimate | Phase 120 | APP-05 requirement — direct actionability |

---

## Open Questions

None — all implementation details are verified against the codebase.

---

## Sources

### Primary (HIGH confidence)

- `src/server/db/schema.ts` — confirmed all four apprenticeship columns present; no migration needed
- `src/server/services/complianceService.ts` — confirmed COMP-04 (lines 276–362) and COMP-05 (lines 364–399) fully implemented
- `src/client/pages/WorkersPage.tsx` — confirmed `apprenticeshipProgramName`/`rapidsNumber` in edit form (lines 728–758); absent from add form
- `src/client/pages/PayrollWeekDetailPage.tsx` — confirmed two `weekViolations?.map` render sites; both show flat `wv.detail`
- `src/client/components/ApprenticeshipDashboard.tsx` — confirmed IRA/IIJA banner implemented; wired in ProjectDetailPage.tsx line 1780
- `src/server/routes/apprenticeship.ts` — confirmed dashboard endpoint fully implemented
- `src/client/components/projects/ProjectForm.tsx` — confirmed Apprenticeship Ratios section with `isFederalOrState` gate (lines 438–492)
- `tests/services/complianceService.test.ts` — confirmed COMP-03 tests exist; COMP-04/COMP-05 have zero coverage
- `src/server/db/migrations/meta/_journal.json` — last migration idx is 65 (`0065_payroll_entry_sub_fk`); no new migration needed for Phase 120

### Secondary (MEDIUM confidence)

- `.planning/STATE.md` — Phase 119 complete; 849 tests passing; 0 TS errors; no blockers

---

## Metadata

**Confidence breakdown:**
- Schema / server state: HIGH — read directly from source files
- UI gaps: HIGH — verified exact line numbers for add-form omission and both render sites
- Test gaps: HIGH — grepped complianceService.test.ts; zero hits for COMP-04/COMP-05

**Research date:** 2026-04-29
**Valid until:** Indefinite — all findings are code-state facts, not external API state
