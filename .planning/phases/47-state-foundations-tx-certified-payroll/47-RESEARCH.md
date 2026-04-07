# Phase 47: State Foundations + TX Certified Payroll — Research

**Researched:** 2026-04-07
**Domain:** Multi-state prevailing wage compliance — state detection refactor + TX WH-347 with LCPtracker callout
**Confidence:** HIGH (all findings from direct code reads of the live codebase; no inference required)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STATE-12 | Replace `isCA`/`isWA`/`isNY`/`isIL` booleans in `PayrollWeekDetailPage.tsx` with a `STATE_FORMS` registry object | Registry pattern, blast radius, and exact line numbers documented |
| STATE-13 | Standardize all state comparisons to `.toUpperCase()` client and server | Every comparison location catalogued with file + line |
| TX-01 | TX selectable state; TX project form shows three TX-specific header fields; TX projects route to WH-347 with TX header overlay | WH-347 route pattern, ProjectForm pattern, schema addition pattern all confirmed |
| TX-02 | TX projects show LCPtracker informational callout on PayrollWeekDetailPage | HelpCallout and WA PWIA panel patterns documented; exact component signature confirmed |
| NFR-06 | `STATE_FORMS` registry committed before any new state phase | This phase delivers the registry; its presence is what enables Phase 48+ |
</phase_requirements>

---

## Summary

Phase 47 is a two-part phase: (1) a mandatory pre-flight refactor that normalizes state detection across the entire client and server, and (2) the first new state addition (TX) which is extremely low complexity because Texas uses the existing WH-347 generator unchanged.

The pre-flight refactor (STATE-12, STATE-13) is the highest-value work in this phase. Without it, every state added from Phase 48 onward risks silent failures: a project stored as `'tx'` could pass the frontend gate but hit a 400 on the server gate if one side normalizes and the other doesn't. The inconsistency is confirmed in the live codebase — CA and WA use exact-match comparisons while NY and IL use `.toUpperCase()` — and must be fixed before any new state is added.

The TX addition (TX-01, TX-02) requires: one migration adding three nullable project columns plus one nullable payroll_weeks column, one new route in `export.ts` following the exact 8-step state gate pattern, three new TX-specific fields in `ProjectForm.tsx`, a TX download button added to the `STATE_FORMS` registry block in `PayrollWeekDetailPage.tsx`, and a TX LCPtracker informational panel modeled on the WA PWIA Submission Guide panel already at line 1428 of `PayrollWeekDetailPage.tsx`.

**Primary recommendation:** Do STATE-13 normalization first (lowest-risk, pure find-and-replace), then STATE-12 registry refactor, then TX migration and route. All three are prerequisites for Phase 48 FL.

---

## Standard Stack

### Core (no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pdf-lib | ^1.17.1 | PDF generation | INSTALLED — WH-347 template overlay is the TX strategy |
| drizzle-orm | ^0.45.1 | Schema additions | INSTALLED — `ALTER TABLE` migrations, Drizzle schema.ts update |
| better-sqlite3 | ^12.8.0 | SQLite driver | INSTALLED |
| express | (installed) | Route addition | INSTALLED — new `/api/export/tx-cpr/:weekId` on existing router |

**No new npm packages required for Phase 47.**

**Version verification:** Confirmed directly from `package.json` read — no version staleness risk.

---

## Architecture Patterns

### STATE-12: STATE_FORMS Registry Pattern

**Current state (confirmed at lines 461-464 of `PayrollWeekDetailPage.tsx`):**
```typescript
const isCA = projectData?.data?.project?.state === 'CA';
const isWA = projectData?.data?.project?.state === 'WA';
const isNY = projectData?.data?.project?.state?.toUpperCase() === 'NY';
const isIL = projectData?.data?.project?.state?.toUpperCase() === 'IL';
```

**Target pattern (replaces download-button rendering only):**
```typescript
const STATE_FORMS: Record<string, {
  downloadLabel: string;
  route: string;
  submissionLabel: string;
  showPanel?: boolean;  // for state-specific info panels like WA PWIA / TX LCPtracker
}> = {
  CA: { downloadLabel: 'Download CA A-1-131', route: 'a1131', submissionLabel: 'CA DIR eCPR' },
  WA: { downloadLabel: 'Download WA F700-065-000', route: 'f700', submissionLabel: 'WA L&I PWIA', showPanel: true },
  NY: { downloadLabel: '', route: 'pw12', submissionLabel: 'NY MPWR' },
  IL: { downloadLabel: '', route: 'il-transcript', submissionLabel: 'IL IDOL' },
  TX: { downloadLabel: 'Download WH-347 (TX)', route: 'wh347', submissionLabel: 'TxDOT LCPtracker', showPanel: true },
};
const stateFormConfig = STATE_FORMS[projectData?.data?.project?.state?.toUpperCase() ?? ''] ?? null;
```

**CRITICAL constraint:** The 4 individual booleans (`isCA`, `isWA`, `isNY`, `isIL`) MUST be preserved as-is for all non-download conditional logic throughout the component. They are used in at least 14 other locations in `PayrollWeekDetailPage.tsx` for submission tracking badges, form-specific modals, and compliance display. Only the download-button rendering block (lines 991-1044) and the WA PWIA panel trigger (line 1428) should move to the registry.

**Download buttons affected — lines 991-1044:**
- Line 991: `{isCA && weekId && (` — CA A-1-131 button
- Line 1000: `{isCA && weekId && (` — CA eCPR XML button
- Line 1009: `{isWA && weekId && (` — WA F700 button
- Line 1018: `{isWA && weekId && (` — WA CPR XML button
- Line 1027: `{isNY && weekId && (` — NY MPWR Submission button
- Line 1036: `{isIL && weekId && (` — IL IDOL Submission button

Note: CA has two buttons (A-1-131 + eCPR XML) and WA has two buttons (F700 + CPR XML) — the registry entry needs to handle these per-state extras. The registry structure may need a `buttons: Array<{label, action}>` field rather than a single `downloadLabel/route` to accommodate multi-button states.

**Submission tracking rows affected — lines 1321-1423:**
- Lines 1321-1348: `{isCA && ...}` — CA eCPR submitted row
- Lines 1350-1377: `{isWA && ...}` — WA L&I submitted row
- Lines 1379-1397: `{isNY && ...}` — NY MPWR submitted row
- Lines 1398-1423: `{isIL && ...}` — IL IDOL submitted row

These submission tracking rows are better left as `{isCA && ...}` boolean patterns — the shape of each row differs significantly (CA has un-submit button, NY has no button, IL has separate submit button). Do NOT include submission tracking in the registry; it would obscure rather than clarify.

**TX download: TX reuses the WH-347 route** (`/api/export/wh347/:weekId`) — no new route needed just for the TX download button. The button simply calls the existing WH-347 download handler, which is already present for all states. TX gets no additional download button beyond "Download WH-347". The registry's purpose for TX is only to add the LCPtracker panel flag.

### STATE-13: Full Case Normalization Blast Radius

Every state comparison that needs changing, by file:

**`src/client/pages/PayrollWeekDetailPage.tsx` (lines 461-462):**
```typescript
// BEFORE
const isCA = projectData?.data?.project?.state === 'CA';  // no .toUpperCase()
const isWA = projectData?.data?.project?.state === 'WA';  // no .toUpperCase()
// AFTER
const isCA = projectData?.data?.project?.state?.toUpperCase() === 'CA';
const isWA = projectData?.data?.project?.state?.toUpperCase() === 'WA';
// lines 463-464 (isNY, isIL) already correct — no change
```

**`src/client/pages/PayrollEntryPage.tsx` (line 72):**
```typescript
// BEFORE
const isCA = projectData?.data?.project?.state === 'CA';  // no .toUpperCase()
// AFTER
const isCA = projectData?.data?.project?.state?.toUpperCase() === 'CA';
// line 73 (isIL) already uses .toUpperCase() — no change
```

**`src/client/pages/WorkersPage.tsx` (line 180):**
```typescript
// BEFORE
const isWA = projectData?.data?.project?.state === 'WA';  // no .toUpperCase()
// AFTER
const isWA = projectData?.data?.project?.state?.toUpperCase() === 'WA';
// line 181 (isIL) already uses .toUpperCase() — no change
```

**`src/client/components/projects/ProjectForm.tsx` (lines 54-57):**
```typescript
// ALL FOUR already use .toUpperCase() — no changes needed
const isCA = stateValue?.toUpperCase() === 'CA';  // correct
const isWA = stateValue?.toUpperCase() === 'WA';  // correct
const isNY = stateValue?.toUpperCase() === 'NY';  // correct
const isIL = stateValue?.toUpperCase() === 'IL';  // correct
```

**`src/server/routes/export.ts` — 4 state gates:**
```typescript
// Line 278 — a1131 route:
if (project.state !== 'CA')         // BEFORE — no normalization
if (project.state?.toUpperCase() !== 'CA')  // AFTER

// Line 388 — f700 route:
if (project.state !== 'WA')         // BEFORE — no normalization
if (project.state?.toUpperCase() !== 'WA')  // AFTER

// Line 556 — ecpr-xml route:
if (project.state !== 'CA')         // BEFORE — no normalization
if (project.state?.toUpperCase() !== 'CA')  // AFTER

// Line 737 — wa-cpr-xml route:
if (project.state !== 'WA')         // BEFORE — no normalization
if (project.state?.toUpperCase() !== 'WA')  // AFTER

// Line 911 — pw12 route: already uses .toUpperCase() — no change
// Line 1123 — il-transcript route: already uses .toUpperCase() — no change
```

**`src/server/services/complianceService.ts` (line 57):**
```typescript
// Already uses .toUpperCase() — no change needed
const isNY = project?.state?.toUpperCase() === 'NY';
```

**Summary of changes for STATE-13:**
- `PayrollWeekDetailPage.tsx`: 2 lines changed (isCA line 461, isWA line 462)
- `PayrollEntryPage.tsx`: 1 line changed (isCA line 72)
- `WorkersPage.tsx`: 1 line changed (isWA line 180)
- `export.ts`: 4 lines changed (a1131 gate, f700 gate, ecpr-xml gate, wa-cpr-xml gate)
- `ProjectForm.tsx`: 0 changes (already normalized)
- `complianceService.ts`: 0 changes (already normalized)

**Total: 7 one-line changes.**

### TX-01: TX WH-347 Route + Project Fields Pattern

TX uses the **existing WH-347 generator unchanged** (`/api/export/wh347/:weekId`). The route at line 125 of `export.ts` is NOT state-gated — it runs for any state. TX projects simply use this existing endpoint with no additional server-side route.

However, the TX-specific header fields (TxDOT contract number, awarding agency name, project location) must be overlaid on the WH-347. The WH-347 generator's `Wh347Data` type already has `projectLocation`, `projectContractNo` (from `wdIdentifier`), and `contractorAddress`. The TX-specific fields (`txdotProjectId`, `txContractorLicense`, `txAwardingAgency`) map into the existing WH-347 header fields:
- `projectContractNo` ← `project.txdotProjectId` (if set; falls back to `wdIdentifier`)
- The "awarding agency" concept is a display-only note in the header area
- The WH-347 template header already has boxes for contract number, location, and contractor info

**New DB migration needed (0028_tx_schema.sql):**
```sql
ALTER TABLE projects ADD COLUMN txdot_project_id TEXT;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN tx_contractor_license TEXT;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN tx_awarding_agency TEXT;
--> statement-breakpoint
ALTER TABLE payroll_weeks ADD COLUMN tx_cpr_submitted_at TEXT;
```

**ProjectForm.tsx additions:**
- Add optional fields to Zod schema: `txdotProjectId`, `txContractorLicense`, `txAwardingAgency`
- Add `const isTX = stateValue?.toUpperCase() === 'TX';`
- Add `{isTX && ...}` block with three input fields (matching the CA amber/WA blue/NY green pattern — recommend orange border for TX)
- No additional validation (all nullable)

**PayrollWeekDetailPage.tsx changes for TX download:**
- Add `isTX` boolean at line 464 area
- The "Download WH-347" button is already shown for ALL projects at line 982 — no additional TX-specific download button is needed
- TX gets its identification through the LCPtracker panel (TX-02), not an additional button

### TX-02: TX LCPtracker Informational Panel

The WA PWIA Submission Guide panel at line 1428 is the exact pattern to follow. TX needs an equivalent "TX LCPtracker Submission" panel.

**HelpCallout component signature (confirmed from `src/client/components/ui/HelpCallout.tsx`):**
```typescript
interface HelpCalloutProps {
  icon: LucideIcon;
  title: string;
  body: React.ReactNode;
  className?: string;
}
```

The WA PWIA panel is a `<Card>` with a heading, paragraph text, and an `<a>` link — NOT a HelpCallout. The TX-02 requirement says "informational callout" — use HelpCallout for simplicity (already used at line 1059 on the same page for the "Review Before You Submit" notice), OR a Card panel for richer formatting with the LCPtracker link.

**Recommendation: use HelpCallout component** (simpler, already imported, already used on this page). TX does not need the tabular data display that the WA PWIA panel has — just a note and a link.

**Placement:** After the WA PWIA panel, gated on `isTX`:
```typescript
{!isLoading && !isError && isTX && (
  <HelpCallout
    icon={ExternalLink}  // or AlertCircle — already imported
    title="Texas LCPtracker Electronic Submission Required"
    body={<>
      Texas Chapter 2258 requires electronic submission of certified payroll
      records via LCPtracker for TxDOT and other public works contracts.
      Submit your WH-347 through the{' '}
      <a href="https://lcp123.com" target="_blank" rel="noopener noreferrer"
        className="text-brand-gold underline">
        LCPtracker portal (lcp123.com)
      </a>
      . Refer to the{' '}
      <a href="https://www.txdot.gov/business/contractors/labor-compliance.html"
        target="_blank" rel="noopener noreferrer"
        className="text-brand-gold underline">
        TxDOT contractor compliance page
      </a>
      {' '}for submission requirements.
    </>}
  />
)}
```

**TX submission tracking row:** Add a `txCprSubmittedAt` tracking row (matching CA/WA/NY/IL pattern) after the `{isIL && ...}` block at line 1398. TX follows the IL pattern (badge + submitted date, no un-submit button if simple toggle is sufficient).

### Migration File Naming

Next migration should be `0028_tx_schema.sql` (current highest is `0027_payroll_provider_mappings.sql`, journal idx 23). Next journal idx is 24.

Multi-statement migrations use `--> statement-breakpoint` (one space before and after `-->`). Single-statement migrations need no separator. The TX schema migration has 4 statements — requires 3 breakpoints.

### ProjectForm.tsx — No STATE_OPTIONS List

The state input is a free-text field (`<input type="text" maxLength={2} className="... uppercase" />`), not a `<select>` with a STATE_OPTIONS array. The Zod schema enforces `z.string().length(2).toUpperCase()`. New states are added by:
1. Adding the `isTX` boolean (line ~57 in ProjectForm.tsx)
2. Adding the `{isTX && ...}` fields block (after the `{isIL && ...}` block at line 271)
3. Adding the Zod optional fields for TX-specific columns

No dropdown list to update.

### Anti-Patterns to Avoid

- **Do not refactor submission tracking rows into the STATE_FORMS registry** — each row has different shape (CA has un-submit button, IL has a separate submit button) making a registry abstraction more harmful than individual boolean blocks.
- **Do not add a separate `/api/export/tx-cpr/:weekId` route** — TX uses WH-347 directly. Creating a TX-specific route that calls the WH-347 generator adds routing complexity for zero benefit.
- **Do not add STATE-13 normalization to `ProjectForm.tsx`** — it is already normalized; changing it is a no-op but risks introducing a bug.
- **Do not use `<select>` for state input** — existing design is a 2-letter text input with Zod enforcement; maintaining consistency is more important than adding a dropdown for 8 states.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF generation for TX | New `txCprGenerator.ts` | Existing `fillWh347()` + WH-347 template | TX uses federal WH-347; no state form exists |
| State dropdown | `<select>` with STATE_OPTIONS | Existing free-text input + Zod `.length(2).toUpperCase()` | Existing constraint is sufficient; dropdown adds no value at 8 states |
| Submission tracking abstraction | Unified submission registry | Individual `{isXX && ...}` blocks | Each state's submission UX is different enough that abstraction obscures intent |

---

## Common Pitfalls

### Pitfall 1: Preserving Boolean-Only Usages When Introducing Registry
**What goes wrong:** Developer converts ALL `{isCA && ...}` blocks to registry lookups, breaking the submission tracking rows which have different shapes per state.
**Why it happens:** The refactor goal (eliminate boolean sprawl) is applied too broadly.
**How to avoid:** The registry governs only the download-button rendering block (lines 991-1044) and optionally the state-specific panel trigger. All other `{isCA && ...}` / `{isWA && ...}` etc. blocks stay as individual booleans.
**Warning signs:** Submission tracking Card section (lines 1321-1423) starts using `stateFormConfig?.submissionLabel` — this is a sign the refactor went too far.

### Pitfall 2: Adding TX-Specific Export Route
**What goes wrong:** Developer adds `/api/export/tx-cpr/:weekId` with a TX state gate that calls `fillWh347()`, creating a redundant route.
**Why it happens:** The CA A-1-131 and WA F700 routes exist, so "TX should have its own route" seems logical.
**How to avoid:** TX uses WH-347 directly. The only TX distinction is project header fields (`txdotProjectId` etc.) passed to the existing WH-347 data mapper in the `/api/export/wh347/:weekId` route.
**Warning signs:** A new file `txCprGenerator.ts` exists — if it just wraps `fillWh347()` with a state gate, it is unnecessary.

### Pitfall 3: STATE-13 Change Misses the ecpr-xml Route
**What goes wrong:** Developer updates the a1131 and f700 state gates but misses the ecpr-xml gate at line 556 (also `project.state !== 'CA'` without normalization).
**Why it happens:** The a1131 and f700 gates are in adjacent code blocks; the ecpr-xml gate is further down the file (line 556 vs 278 and 388).
**How to avoid:** Search `export.ts` for ALL occurrences of `project.state !==` and `project.state ===` before considering the file done. There are 4 exact-match gates: a1131 (278), f700 (388), ecpr-xml (556), wa-cpr-xml (737).
**Warning signs:** A test that creates a lowercase-state project and hits the ecpr-xml route returns 400 incorrectly.

### Pitfall 4: isTX Not Added as an Individual Boolean
**What goes wrong:** Developer relies only on `stateFormConfig` from the registry for TX-specific conditional logic throughout the component, then a future developer adds TX-specific compliance rules and can't find the `isTX` boolean.
**Why it happens:** The registry refactor creates `stateFormConfig` — it's tempting to use that everywhere.
**How to avoid:** Add `const isTX = projectData?.data?.project?.state?.toUpperCase() === 'TX';` alongside the other boolean declarations at lines 461-464. The registry is for the download section only.

### Pitfall 5: TX Migration Missing Journal Registration
**What goes wrong:** `0028_tx_schema.sql` is created in `src/server/db/migrations/` but never added to `meta/_journal.json`. Drizzle silently skips unregistered migration files — the columns are missing at runtime.
**Why it happens:** CLAUDE.md warns about this but it's easy to forget under phase time pressure.
**How to avoid:** After writing `0028_tx_schema.sql`, immediately update `_journal.json` with idx 24. Current entry count in `_journal.json` ends at idx 23 (tag `0027_payroll_provider_mappings`).
**Warning signs:** `project.txdotProjectId` is always `undefined` even after save; `SELECT sql FROM sqlite_master WHERE name = 'projects'` doesn't show the new columns.

---

## Code Examples

### State Gate Pattern (confirmed from export.ts)

The 8-step pattern from the IL transcript route (most recent, lines 1100-1200 of export.ts):
```typescript
// Source: src/server/routes/export.ts lines 1100+ (il-transcript route)
router.get('/il-transcript/:weekId', async (req, res) => {
  const weekId = req.params.weekId as string;
  const userId = req.user!.userId;

  // 1. Load payroll week
  const week = await getPayrollWeek(weekId);
  if (!week) {
    res.status(404).json({ error: 'Payroll week not found' });
    return;
  }

  // 2. Verify project access (NFR-03)
  const db = getDb();
  let project: Project;
  try {
    project = await assertProjectAccess(db, week.projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  // 3. State gate — IL Certified Transcript is IL-only
  if (project.state?.toUpperCase() !== 'IL') {
    res.status(400).json({ error: 'IL Certified Transcript is only available for Illinois projects' });
    return;
  }
  // ... rest of route
```

**For TX: no separate route.** The existing WH-347 route at `/api/export/wh347/:weekId` already handles TX projects. The WH-347 route is NOT state-gated — it runs for all states. TX header fields are mapped from `project.txdotProjectId` and related columns in the same data-mapping block.

### WH-347 Data Builder Modification for TX Fields

```typescript
// Source: src/server/routes/export.ts lines 195-221 (wh347 route data builder)
// Existing pattern — TX fields slot into existing Wh347Data fields:
const wh347Data: Wh347Data = {
  contractorName: project.name,
  contractorAddress: `${project.county}, ${project.state}`,
  // TX-specific: use txdotProjectId as contract number if set, fall back to wdIdentifier
  projectContractNo: (project as any).txdotProjectId ?? project.wdIdentifier ?? '',
  // TX awarding agency goes into a header line — check Wh347Data type for available fields
  // ... rest unchanged
};
```

The `Wh347Data` type needs verification to confirm which header fields are available for TX overlay. The `projectContractNo`, `projectLocation`, and `contractorAddress` fields in the existing WH-347 map are the natural destination for TX-specific project fields.

### Migration Pattern (multi-statement with breakpoints)

```sql
-- 0028_tx_schema.sql
-- Source: Pattern from 0025_il_schema.sql (multi-statement migration)
ALTER TABLE projects ADD COLUMN txdot_project_id TEXT;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN tx_contractor_license TEXT;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN tx_awarding_agency TEXT;
--> statement-breakpoint
ALTER TABLE payroll_weeks ADD COLUMN tx_cpr_submitted_at TEXT;
```

### Journal Registration Pattern

```json
// src/server/db/migrations/meta/_journal.json — append after idx 23:
{
  "idx": 24,
  "version": "7",
  "when": 1744070400000,
  "tag": "0028_tx_schema",
  "breakpoints": true
}
```

### ProjectForm Texas Block (matched pattern from IL block lines 271-276)

```tsx
{/* Source: ProjectForm.tsx lines 271-276 (IL pattern) */}
{isTX && (
  <div className="space-y-4 rounded-lg border border-orange-200 bg-orange-50 p-4">
    <p className="text-sm font-medium text-orange-800">Texas Project Fields</p>
    <div>
      <label htmlFor="txdotProjectId" className="block text-sm font-medium text-gray-700">
        TxDOT Project ID
      </label>
      <input
        id="txdotProjectId"
        type="text"
        {...register('txdotProjectId')}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-brand-gold focus:outline-none"
        placeholder="e.g. STP 2025(123)"
      />
    </div>
    <div>
      <label htmlFor="txContractorLicense" className="block text-sm font-medium text-gray-700">
        TX Contractor License #
      </label>
      <input
        id="txContractorLicense"
        type="text"
        {...register('txContractorLicense')}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-brand-gold focus:outline-none"
        placeholder="TDLR license number"
      />
    </div>
    <div>
      <label htmlFor="txAwardingAgency" className="block text-sm font-medium text-gray-700">
        Awarding Agency Name
      </label>
      <input
        id="txAwardingAgency"
        type="text"
        {...register('txAwardingAgency')}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-brand-gold focus:outline-none"
        placeholder="e.g. Texas Department of Transportation"
      />
    </div>
  </div>
)}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 4 individual boolean vars for download buttons | STATE_FORMS registry | Phase 47 (this phase) | Download section stays maintainable at 8 states |
| Mixed case normalization (CA/WA exact, NY/IL .toUpperCase()) | All comparisons use `.toUpperCase()` | Phase 47 (this phase) | New states added in Phase 48+ cannot silently fail |
| No TX support | TX selectable, WH-347 with project header fields | Phase 47 (this phase) | Largest US prevailing wage construction market supported |

---

## Environment Availability

Step 2.6: SKIPPED (Phase 47 is purely code + config changes; no external services, CLIs, or databases beyond the project's own SQLite + Node.js stack are required)

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (confirmed from `vitest.config.ts` in project root) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/routes/export.test.ts` |
| Full suite command | `npx vitest run` |

**Current test baseline:** 380+ passing in main suite (confirmed by test run 2026-04-07).

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Status |
|--------|----------|-----------|-------------------|-------------|
| STATE-13 | `export.ts` CA state gate works for lowercase `'ca'` project | Integration | `npx vitest run tests/routes/export.test.ts` | Existing file — add new test |
| STATE-13 | `export.ts` WA state gate works for lowercase `'wa'` project | Integration | `npx vitest run tests/routes/export.test.ts` | Existing file — add new test |
| TX-01 | `GET /api/export/wh347/:weekId` returns 200 PDF for TX project | Integration | `npx vitest run tests/routes/export.test.ts` | Existing file — WH-347 already tested; TX test adds TX-specific fields check |
| TX-01 | `txdotProjectId`, `txContractorLicense`, `txAwardingAgency` saved via `POST /api/projects` | Integration | `npx vitest run tests/routes/projects.test.ts` | Existing file — add new test |
| TX-02 | Visual: TX projects show LCPtracker callout (no automated test — UI-only) | Manual | Browser check on `http://localhost:4099` | N/A — manual |
| NFR-06 | STATE_FORMS registry object exported from or defined in PayrollWeekDetailPage | Static (TS compile) | `npx tsc --noEmit` | Covered by TypeScript compilation |

### Specific Tests to Add in `tests/routes/export.test.ts`

```typescript
// STATE-13 validation: lowercase state still routes correctly
describe('STATE-13: case normalization on existing routes', () => {
  it('should return 400 for non-CA project even with lowercase state', async () => {
    const cookie = await registerUser('state13-ca');
    const projectId = await createProject(cookie, 'tx');  // lowercase
    const weekId = await createPayrollWeek(cookie, projectId);
    const res = await supertest(app).get(`/api/export/a1131/${weekId}`).set('Cookie', cookie);
    expect(res.status).toBe(400);
  });

  it('should return 400 for non-WA project with lowercase state', async () => {
    const cookie = await registerUser('state13-wa');
    const projectId = await createProject(cookie, 'ca');  // lowercase CA, hits WA gate
    const weekId = await createPayrollWeek(cookie, projectId);
    const res = await supertest(app).get(`/api/export/f700/${weekId}`).set('Cookie', cookie);
    expect(res.status).toBe(400);
  });
});

// TX-01: WH-347 download works for TX project
describe('GET /api/export/wh347/:weekId - TX project', () => {
  it('should return PDF for TX project with TX-specific fields', async () => {
    const cookie = await registerUser('tx-pdf');
    const projectId = await createProject(cookie, 'TX', {
      txdotProjectId: 'STP 2025(001)',
      txContractorLicense: 'TDLR-12345',
      txAwardingAgency: 'Texas DOT',
    });
    const { workerId, classificationId } = await createWorkerWithClassification(cookie, projectId);
    const weekId = await createPayrollWeek(cookie, projectId);
    await createPayrollEntry(cookie, weekId, workerId, classificationId);
    const res = await supertest(app).get(`/api/export/wh347/${weekId}`).set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
  });
});
```

### Sampling Rate

- **Per task commit:** `npx vitest run tests/routes/export.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work 47`

### Wave 0 Gaps

None — existing test infrastructure covers all phase requirements. `tests/routes/export.test.ts` exists and has the helper pattern (registerUser, createProject, createPayrollWeek, etc.) needed for new TX tests. New test cases are additive to the existing describe block structure.

---

## Open Questions

1. **WH-347 template header field mapping for TX fields**
   - What we know: `Wh347Data` has `projectContractNo`, `projectLocation`, `contractorAddress`, `contractorName`. TX wants `txdotProjectId`, `txContractorLicense`, `txAwardingAgency` on the form.
   - What's unclear: Whether `txdotProjectId` maps cleanly to `projectContractNo`, or whether `txAwardingAgency` needs a separate field added to `Wh347Data`. Read `src/server/services/wh347Generator.ts` and `Wh347Data` type at plan time to confirm field availability.
   - Recommendation: Read `wh347Generator.ts` as the first action in Plan 47-02 (the TX route plan). The mapping decision is low-risk either way — existing fields likely suffice.

2. **STATE_FORMS registry shape for multi-button states (CA, WA)**
   - What we know: CA has two download buttons (A-1-131 + eCPR XML) and WA has two (F700 + CPR XML). A single `downloadLabel/route` per state entry doesn't capture this.
   - What's unclear: Whether to use `buttons: Array<{label, onClick}>` in the registry, or keep CA and WA's second buttons as individual `{isCA && ...}` blocks outside the registry.
   - Recommendation: Keep the CA eCPR XML and WA CPR XML buttons as their own `{isCA && ...}` / `{isWA && ...}` blocks. The registry only needs to handle the primary download button per state. This limits the registry's scope and avoids over-engineering for the Phase 47 deliverable.

3. **TX submission tracking row design**
   - What we know: CA has un-submit button (caUnsubmitMutation), WA has un-submit button (waUnsubmitMutation), NY has no button, IL has a separate submit button.
   - What's unclear: TX has no official portal API — does TX need an un-submit toggle, or just a badge showing submitted date?
   - Recommendation: Follow the IL pattern — badge + date, with a "Mark as Submitted" button using the `txCprSubmittedAt` column. No un-submit needed for TX (no portal to undo).

---

## Sources

### Primary (HIGH confidence — direct code reads)

- `src/client/pages/PayrollWeekDetailPage.tsx` lines 461-464 — isCA/isWA/isNY/isIL boolean declarations confirmed
- `src/client/pages/PayrollWeekDetailPage.tsx` lines 991-1044 — download button rendering block confirmed
- `src/client/pages/PayrollWeekDetailPage.tsx` lines 1321-1423 — submission tracking rows confirmed
- `src/client/pages/PayrollWeekDetailPage.tsx` lines 1428-1620 — WA PWIA panel pattern confirmed
- `src/client/pages/PayrollEntryPage.tsx` lines 72-73 — isCA (exact), isIL (normalized) confirmed
- `src/client/pages/WorkersPage.tsx` lines 180-181 — isWA (exact), isIL (normalized) confirmed
- `src/client/components/projects/ProjectForm.tsx` lines 54-57 — all four already normalized confirmed
- `src/client/components/projects/ProjectForm.tsx` lines 171-276 — state-specific field block pattern confirmed; free-text state input confirmed
- `src/client/components/ui/HelpCallout.tsx` — component signature confirmed: `{icon, title, body, className?}`
- `src/server/routes/export.ts` lines 278, 388, 556, 737 — four exact-match state gates confirmed
- `src/server/routes/export.ts` lines 911, 1123 — two already-normalized state gates confirmed
- `src/server/routes/export.ts` lines 125-251 — WH-347 route pattern (no state gate) confirmed
- `src/server/db/schema.ts` lines 31-50 — projects table columns confirmed; payroll_weeks columns 201-209 confirmed
- `src/server/db/migrations/` — highest migration is 0027; next is 0028; journal idx 23 is current max
- `src/server/services/complianceService.ts` line 57 — already normalized, no change needed
- `.planning/REQUIREMENTS.md` — STATE-12, STATE-13, TX-01, TX-02, NFR-06 requirements confirmed
- `.planning/STATE.md` — v5.0 locked decisions confirmed
- `CLAUDE.md` — migration pattern, design tokens, Button component constraints confirmed
- `tests/routes/export.test.ts` — test helper pattern confirmed; existing test structure reviewed

### Secondary (HIGH confidence — milestone research artifacts)

- `.planning/research/SUMMARY.md` — TX uses WH-347 confirmed; zero new packages confirmed; state gate 8-step pattern confirmed
- `.planning/research/PITFALLS.md` — case normalization pitfall, boolean sprawl pitfall, server gate omission pitfall confirmed
- `.planning/research/ARCHITECTURE.md` — state gate pattern template, DB column patterns, file map confirmed

---

## Project Constraints (from CLAUDE.md)

The following directives from `CLAUDE.md` apply to Phase 47:

| Directive | Phase 47 Application |
|-----------|---------------------|
| **Never drop or rename columns** — add-only migrations | `0028_tx_schema.sql` adds nullable columns only; no column removal |
| **Always register migrations in `meta/_journal.json`** | New migration 0028 must be added as idx 24 — this is a required task |
| **Design tokens via `@theme`** — never hardcode hex | TX fields in ProjectForm use existing token classes (`border-orange-200 bg-orange-50` etc.) |
| **`Button` has no `asChild` prop** — use `<a>` with secondary classes for links | TX LCPtracker links use `<a className="...">` directly, not `<Button asChild>` |
| **State comparisons: `.toUpperCase()` pattern** | STATE-13 is literally the requirement to enforce this across all files |
| **Migrations: `ALTER TABLE ... ADD COLUMN` files in `src/server/db/migrations/`** | TX migration follows this exact pattern |
| **`--> statement-breakpoint`** separator between multi-statement migrations | TX migration has 4 statements; 3 breakpoints required |

---

## Metadata

**Confidence breakdown:**
- STATE-12 blast radius: HIGH — exact line numbers from code reads, not inference
- STATE-13 file inventory: HIGH — all client and server files grep-confirmed
- TX-01 WH-347 reuse: HIGH — confirmed TX uses federal WH-347 from v5.0 research + confirmed WH-347 route is NOT state-gated
- TX-02 callout pattern: HIGH — HelpCallout signature and WA PWIA panel pattern confirmed from live code
- Migration numbering: HIGH — current highest is 0027 confirmed from directory listing + journal read
- Test patterns: HIGH — existing export.test.ts helper functions read and confirmed

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (stable codebase; patterns unlikely to change between phases)
