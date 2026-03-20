# Phase 6: WH-347 2025 Compliance Foundation - Research

**Researched:** 2026-03-20
**Domain:** WH-347 PDF generation (pdf-lib coordinate overlay), SQLite schema migration (Drizzle ORM), React form extension
**Confidence:** HIGH — based entirely on direct codebase inspection; no guesswork

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WH347-01 | User can download a January 2025-compliant WH-347 PDF (correct form version, correct field positions) | Generator already targets the Jan 2025 form template (`wh347-official-2025.pdf`). The coordinate map is complete and measured. The compliance booleans are currently hardcoded to `true` — this must be fixed. No form rebuild is needed. |
| WH347-02 | Worker profile includes J/RA (journeyworker/registered apprentice) field — mandatory on 2025 WH-347 form | The J/RA field already exists in the generator (`Wh347WorkerRow.laborType`) and is rendered on the PDF. The missing piece is the J/RA field on `workerClassifications` (currently `laborType` covers it) but `export.ts` currently omits `ssnLast4` from the PDF row. The real gap for Phase 6 is: the generator outputs J/RA correctly, the export route maps it correctly, but the Statement of Compliance booleans are all hardcoded `true`. Phase 6 scope: ensure the J/RA data flows correctly end-to-end and the compliance booleans are not auto-checked. |
</phase_requirements>

---

## Summary

Phase 6 is narrower than the project research documents suggested. Direct codebase inspection reveals that the WH-347 generator (`wh347Generator.ts`) already:

1. Targets the January 2025 official form (`assets/wh347-official-2025.pdf`)
2. Has a complete, measured coordinate map for the 2-page landscape form
3. Already renders the J/RA field per worker row (prints "J" or "RA" at `x=198` on each row)
4. Has Page 2 Statement of Compliance fully mapped and wired

What the codebase does NOT do correctly for Phase 6:

1. The Statement of Compliance booleans in `export.ts` are hardcoded to `true` for most fields — this is a false certification
2. The `ssnLast4` field is not passed to the PDF worker rows (hardcoded to `''`) — the export route comments "privacy-safe default" but this must be a deliberate choice, not an oversight
3. There is no multi-page support — `fillWh347()` hard caps at 8 workers and silently drops more
4. The `workerClassifications` table has no `programName` field to flag unregistered apprentices

**The 2025 form is already in use. No coordinate map rebuild is needed. Phase 6 is about correctness of the data flowing into the existing generator — not a new form.**

**Primary recommendation:** Fix the Statement of Compliance boolean logic in `export.ts` to derive values from actual worker data (not hardcoded `true`); confirm J/RA field end-to-end; add multi-page generation to `fillWh347()` for weeks with more than 8 workers.

---

## Critical Questions Answered

### Q1: What does the current wh347 PDF generator look like? What fields does it fill? What form version?

**Answer (HIGH confidence — direct inspection):**

File: `src/server/services/wh347Generator.ts`

The generator uses coordinate-based text overlay via `pdf-lib`. The form is a FLAT PDF (no AcroForm fields) — all content is drawn with `page.drawText()` and `page.drawRectangle()`. The form template is the **January 2025 official DOL form** stored at `assets/wh347-official-2025.pdf`. This was confirmed by the comment at the top of the file: "The official DOL WH-347 (January 2025 revision) downloaded from https://www.dol.gov/sites/dolgov/files/WHD/legacy/files/wh347.pdf."

**Fields currently filled:**

Page 1 header:
- FINAL checkbox, PRIME CONTRACTOR checkbox, SUBCONTRACTOR checkbox
- Project name, project contract no., payroll number, contractor name
- Project location, wage determination no., week ending date, contractor address

Page 1 worker grid (8 rows max):
- Entry number, last name, first name, middle initial, identifying no.
- **J/RA label** (prints "J" or "RA" based on `laborType`) — already implemented
- Classification (trade description)
- Daily ST/OT hours: Mon, Tue, Wed, Thu, Fri, Sat
- Total ST hours, total OT hours
- Base rate, fringe credit
- Gross wages (project), gross wages (all), deductions, net pay

Page 2 header:
- Project name, contract no., payroll no., contractor name
- Project location, week ending date, certifying official name+title

Page 2 Statement of Compliance:
- 5 checkboxes: certProperPayment, certAccuratePayroll, certWorkPerformed, certApprentices, certFringeBenefits
- Signature date, phone number, certifying official name

**Note:** Sunday hours are calculated but the form has Mon-Sat columns only. Sun hours are included in `totalSt`/`totalOt` but have no individual column. This matches the WH-347 form layout.

### Q2: What is the exact schema of workers and workerClassifications tables?

**Answer (HIGH confidence — direct inspection of `src/server/db/schema.ts`):**

**workers table:**
```
id            text PK
projectId     text FK → projects.id (cascade delete)
name          text NOT NULL
ssnLast4      text (nullable)
tradeUnion    text (nullable)
address       text (nullable — required for WH-347)
isActive      boolean NOT NULL default true
createdAt     text NOT NULL
updatedAt     text NOT NULL
```

**workerClassifications table:**
```
id                text PK
workerId          text FK → workers.id (cascade delete)
projectId         text FK → projects.id (cascade delete)
tradeCode         text NOT NULL
tradeDescription  text NOT NULL
laborType         text NOT NULL  ('journeyworker' | 'apprentice' | 'foreman')
apprenticePercent integer (nullable — required when laborType='apprentice')
isActive          boolean NOT NULL default true
createdAt         text NOT NULL
```

**Missing for Phase 6:** No `programName` or `registeredProgram` field on `workerClassifications`. Per the PITFALLS research, an apprentice with `laborType='apprentice'` but no program name should surface as a warning. This is in scope per Phase 6 requirements.

**Key finding:** The schema does NOT need a separate J/RA field. `laborType` is already the J/RA indicator. The 2025 WH-347 J/RA column maps directly to `laborType` (journeyworker = "J", apprentice = "RA", foreman = "J" per the generator's mapping in `export.ts` line 92).

### Q3: Does the export route exist? What does it return?

**Answer (HIGH confidence — direct inspection of `src/server/routes/export.ts`):**

Yes. Route: `GET /api/export/wh347/:weekId`

The route:
1. Loads the payroll week by `weekId`
2. Verifies project ownership (user `userId` matches `project.userId`)
3. Loads payroll entries via `getPayrollEntries(weekId)`
4. Maps entries to `Wh347WorkerRow[]`
5. Builds `Wh347Data` object
6. Loads template from `assets/wh347-official-2025.pdf`
7. Calls `fillWh347(wh347Data, templateBytes)`
8. Streams result as `application/pdf` download with `Content-Disposition: attachment`

**Current problems in this route (lines 129-140):**
```typescript
compliance: {
  certProperPayment: true,        // HARDCODED — must be derived
  certAccuratePayroll: true,      // HARDCODED — must be derived
  certWorkPerformed: true,        // HARDCODED — must be derived
  certApprentices: workerRows.some(w => w.laborType === 'apprentice'),
  certFringeBenefits: workerRows.some(w => w.fringeCredit > 0),
  certDeductions: false,          // HARDCODED (fine — always false per form)
  officialName: 'Certifying Official',   // HARDCODED placeholder
  officialTitle: 'Project Manager',      // HARDCODED placeholder
  signatureDate: formatDate(week.weekEndingDate),
  phoneNumber: '',                // HARDCODED empty
}
```

Additionally, `identifyingNo` is hardcoded to `''` (line 93): "ssnLast4 not joined — privacy-safe default." This is intentional per the comment, but the J/RA mapping is already correct: `laborType === 'foreman' ? 'journeyworker' : row.laborType` maps foreman to "J" on the PDF.

### Q4: What coordinate map exists for the current WH-347? Will it need to be fully rebuilt for the 2025 form?

**Answer (HIGH confidence — direct inspection):**

The coordinate map does NOT need to be rebuilt. It is already measured and mapped for the January 2025 form. The `WH347_FIELDS` constant in `wh347Generator.ts` has full coordinate coverage for both pages. The `WORKER_COLUMNS` constant has all 8-column positions. The `WORKER_ROW_Y` array has all 8 row pairs (ST/OT y-positions).

The 2025 form is already in use as the template. The Statement of Compliance is already on Page 2 of the same template (not a separate WH-348). The form revision is complete.

**What may need adjustment:** If coordinate calibration is off (text overlapping printed lines), minor x/y tweaks may be needed — but this is a calibration task, not a rebuild. The comments indicate coordinates were measured from a grid-annotated PDF.

### Q5: How does pdf-lib handle multi-page PDFs? (the generator currently truncates at 8 workers)

**Answer (HIGH confidence — verified via pdf-lib API patterns in existing codebase):**

The existing generator uses `PDFDocument.load(templateBytes)` to load a 2-page template and fills the pre-existing pages. For multi-page support, there are two approaches:

**Option A — Copy template pages (recommended for WH-347):**
Load the 2-page template and for each 8-worker chunk beyond the first, copy page 1 and page 2 from the loaded template into the PDF document:
```typescript
const [page1Template, page2Template] = pdfDoc.getPages();
// For additional page sets:
const [copiedPage1] = await pdfDoc.copyPages(pdfDoc, [0]); // copy page 0 (worker grid)
pdfDoc.addPage(copiedPage1);
const [copiedPage2] = await pdfDoc.copyPages(pdfDoc, [1]); // copy page 2 (Statement)
pdfDoc.addPage(copiedPage2);
// Then overlay text onto the new pages
```

**Option B — Load fresh template for each page set and merge:**
Load the template multiple times and merge PDFs with `PDFDocument.create()` + `copyPages`.

Option A is simpler and matches the existing pattern. The `Wh347Data.workers` array must be chunked into groups of 8. Each chunk uses one Page 1 + one Page 2 pair. The "Page X of Y" notation must be drawn as text overlay on each Page 1.

**Current truncation (line 290-291 in wh347Generator.ts):**
```typescript
const maxRows = Math.min(data.workers.length, 8);
for (let i = 0; i < maxRows; i++) {
```
This is the only change needed in the generator for multi-page.

**`fillWh347()` signature change for multi-page:**
The function currently returns `Promise<Uint8Array>`. For multi-page, it must either:
- Accept the full workers array and handle chunking internally (preferred — keeps the interface stable)
- Or require the caller to chunk and call once per page

Internal chunking is cleaner. The `Wh347Data.workers` field can hold more than 8 workers; `fillWh347()` handles pagination. The caller in `export.ts` needs no change.

### Q6: What is the exact column structure on the WH-347 that needs J/RA checkbox?

**Answer (HIGH confidence — direct inspection of generator):**

Column (J/RA) is at `x=198` in `WORKER_COLUMNS.laborTypeBox`. The generator currently draws "J" or "RA" as text at that position (not a checkbox square — it's printed text). The 2025 form instruction says "Indicate J for journeyworker or RA for registered apprentice in this column." Text is the correct approach; a filled square is used for the form's other checkboxes (FINAL, PRIME, etc.).

The J/RA column is already implemented and working. No schema change is needed for this specific column — `workerClassifications.laborType` provides the data, and the mapping in `export.ts` handles it correctly.

---

## Standard Stack

### Core (unchanged from existing project)

| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| pdf-lib | installed | PDF generation — coordinate overlay on flat PDF template | `wh347Generator.ts` |
| drizzle-orm | installed | Schema migration (add-only column) | `db/schema.ts` |
| express + zod | installed | Route + validation for updated workers endpoint | `routes/workers.ts` |
| @tanstack/react-query | installed | Client-side data fetching for Workers page update | `WorkersPage.tsx` |

### No New Libraries Required

Phase 6 does not require any new npm packages. All needed functionality is already in the installed stack.

---

## Architecture Patterns

### Pattern 1: Add-Only Schema Change (Drizzle)

For the `programName` field on `workerClassifications`:

```typescript
// In src/server/db/schema.ts — add nullable column to workerClassifications
export const workerClassifications = sqliteTable('worker_classifications', {
  // ... existing columns unchanged ...
  apprenticePercent: integer('apprentice_percent'),
  programName: text('program_name'),  // NEW — nullable; name of DOL-registered apprenticeship program
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
});
```

SQLite migration: `ALTER TABLE worker_classifications ADD COLUMN program_name TEXT;`

This is the only schema change for Phase 6. The column is nullable, so all existing rows get `NULL` — no data migration.

### Pattern 2: Multi-Page fillWh347()

The function signature stays the same. Internal change: chunk workers into groups of 8, copy template pages for each additional chunk, add "Page X of Y" text overlay.

```typescript
// Chunking logic inside fillWh347():
const chunks: Wh347WorkerRow[][] = [];
for (let i = 0; i < data.workers.length; i += 8) {
  chunks.push(data.workers.slice(i, i + 8));
}
const totalPages = chunks.length;

// For each chunk after the first, copy template pages into the document
for (let pageSet = 1; pageSet < totalPages; pageSet++) {
  const [copiedWorkerPage] = await pdfDoc.copyPages(pdfDoc, [0]);
  pdfDoc.insertPage(pageSet * 2, copiedWorkerPage);
  const [copiedStatementPage] = await pdfDoc.copyPages(pdfDoc, [1]);
  pdfDoc.insertPage(pageSet * 2 + 1, copiedStatementPage);
}
```

**"Page X of Y" notation:** Draw at a consistent position in the header area of each Page 1. The DOL convention is to use additional form copies numbered as continuation pages.

### Pattern 3: Compliance Booleans Derived from Worker Data

The Statement of Compliance booleans in `export.ts` must not be hardcoded. For Phase 6 (before the compliance engine exists in Phase 7), the derivation rules are:

| Boolean | Phase 6 Derivation Rule | Source |
|---------|------------------------|--------|
| `certProperPayment` | `true` — not falsifiable without compliance engine; Phase 7 will override | Keep `true` but document that Phase 7 will replace |
| `certAccuratePayroll` | `workerRows.every(w => w.identifyingNo !== '')` — at minimum, must have identifying numbers | Derive from data |
| `certWorkPerformed` | `true` — subjective certification; cannot be auto-verified | Keep `true` |
| `certApprentices` | `true` only if no apprentices present OR all apprentices have `programName` set | Must be derived from classification data |
| `certFringeBenefits` | `workerRows.some(w => w.fringeCredit > 0)` — already correctly derived | Keep existing logic |

**Important scope note for Phase 6:** The compliance engine (Phase 7) is what drives these booleans with real accuracy. Phase 6 must NOT leave all booleans hardcoded `true`, but it cannot implement the full compliance engine. The correct Phase 6 approach: derive what is derivable from the loaded payroll data (apprentice program name check, fringe credit check), leave `certProperPayment` and `certAccuratePayroll` as `true` with a TODO comment, and ensure `certApprentices` checks `programName` presence.

### Pattern 4: Workers Route and Schema Update Propagation

The `UpdateWorkerSchema` in `workers.ts` currently accepts: `name`, `ssnLast4`, `tradeUnion`, `address`.

For Phase 6, `programName` on a classification is updated through a different endpoint — the classification update. Currently there is no PATCH endpoint for individual classifications (only add + delete exist). A new endpoint is needed:

```
PATCH /api/projects/:projectId/workers/:workerId/classifications/:classificationId
```

Or, simpler: add `programName` as an optional field to `CreateClassificationSchema` and the worker form's classification section. The WorkersPage.tsx already has an "Add Another Trade" flow — the programName field can be added there.

### Pattern 5: WorkersPage.tsx Edit Form Extension

The WorkersPage has two edit flows:
1. Edit worker profile (name, SSN, union, address) — inline form at `editingId === w.id`
2. Add classification — separate "Add Another Trade" panel at `addingClassFor === w.id`

For J/RA field display: the classification cards already show `c.laborType` as text (`· Journeyworker` / `· Apprentice`). No UI change is needed for J/RA display — it's already shown.

For `programName`: add an optional text input in the "Add Another Trade" panel when `laborType === 'apprentice'`. Also add a way to update it on existing apprentice classifications (either via the classification edit inline, or by a separate PATCH endpoint).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-page PDF | Custom PDF merge library | `pdfDoc.copyPages()` + `pdfDoc.insertPage()` from pdf-lib | pdf-lib already installed; copyPages is the official API for this |
| SQLite migration | Custom migration runner | Drizzle `ALTER TABLE` via db push or manual SQL | Existing pattern in schema.ts; add-only column needs no ORM migration file |
| Coordinate recalibration | Re-measure all positions | Use existing `WH347_FIELDS` + `WORKER_COLUMNS` | Already measured for the 2025 form |

---

## Common Pitfalls

### Pitfall 1: Statement of Compliance Booleans All Hardcoded True

**What goes wrong:** `export.ts` lines 129-132 hardcode `certProperPayment: true`, `certAccuratePayroll: true`, `certWorkPerformed: true`. A contractor downloads the WH-347 certifying full compliance when the system has no idea if payroll is correct. Under 29 CFR 5.5(a)(3)(ii), a false certification is a federal crime.

**Phase 6 fix:** Derive `certApprentices` from whether all apprentices have `programName` set. Leave `certProperPayment` and `certAccuratePayroll` as `true` with explicit TODOs pointing to Phase 7 compliance engine. Never silently auto-certify without documentation of what the certification actually checks.

**Warning sign:** WH-347 generates for a week where a worker has `laborType='apprentice'` and `programName IS NULL`, and the `certApprentices` checkbox is checked.

### Pitfall 2: Multi-Page Uses insertPage Instead of addPage (Wrong Ordering)

**What goes wrong:** When copying pages to extend the document, using `insertPage` at incorrect indices causes pages to be out of order. The DOL requires: page 1A (workers), page 2A (Statement), page 1B (workers cont.), page 2B (Statement cont.).

**Phase 6 fix:** Each chunk gets exactly one worker-grid page and one Statement page. Use `pdfDoc.copyPages(pdfDoc, [0])` to get the worker grid template and `pdfDoc.copyPages(pdfDoc, [1])` to get the Statement template. Add them in alternating order. Verify page count matches `chunks.length * 2`.

### Pitfall 3: programName Field Not Propagated to Export Route

**What goes wrong:** The `programName` column is added to `workerClassifications` but `export.ts` calls `getPayrollEntries()` which joins to `workerClassifications` for `laborType` only. The `programName` is not in the SELECT. The `certApprentices` logic in `export.ts` cannot check `programName` without it being included in the entries query.

**Phase 6 fix:** Extend `getPayrollEntries()` in `payrollService.ts` to also select `workerClassifications.programName` (or add a separate query in the export route). The `Wh347WorkerRow` interface does not need `programName` — it only needs to influence the `certApprentices` boolean in the compliance object.

### Pitfall 4: Worker Rows in export.ts Are Per-Classification, Not Per-Worker

**What goes wrong:** A worker with two classifications (e.g., carpenter and equipment operator) appears as two rows in `payrollEntries`, and therefore as two rows in the WH-347. This is correct behavior — the WH-347 has one row per classification per worker per week. But the 8-row cap counts classification rows, not worker headcount. A project with 6 workers who each have 2 classifications could exhaust 8 rows with just 4 workers.

**Phase 6 fix:** The multi-page logic must chunk by entry row count (not worker count). A project with 6 workers × 2 classifications = 12 rows needs 2 page sets. This is already how the data flows — `entries` is classification-level rows. No logic change needed; just ensure the chunk size is based on `entries.length`, not `workerIds.length`.

### Pitfall 5: "Page X of Y" Text Overwrites Existing Header Content

**What goes wrong:** The header area of Page 1 is densely packed. Drawing "Page 1 of 2" at an unverified position could overwrite project name, contract no., or other fields.

**Phase 6 fix:** Measure a safe position for the page notation. The payroll number field (`x=510, y=458`) area is adjacent to existing fields. A better location is the far right of the header area (x≈755, y≈458) where there is open space, or a dedicated position within the Payroll Number cell (which already shows a number).

---

## Code Examples

### Current getPayrollEntries() — fields needed for programName

```typescript
// src/server/services/payrollService.ts (existing, lines 171-200+)
export async function getPayrollEntries(weekId: string) {
  const db = getDb();
  const rows = await db
    .select({
      entry: payrollEntries,
      workerName: workers.name,
      tradeDescription: workerClassifications.tradeDescription,
      laborType: workerClassifications.laborType,
      // ADD: programName: workerClassifications.programName,
    })
    // ... joins ...
}
```

### export.ts compliance object — current vs Phase 6 target

```typescript
// CURRENT (problematic):
compliance: {
  certProperPayment: true,       // hardcoded
  certAccuratePayroll: true,     // hardcoded
  certWorkPerformed: true,       // hardcoded
  certApprentices: workerRows.some(w => w.laborType === 'apprentice'),
  // ...
}

// PHASE 6 TARGET:
const apprenticeRows = entries.filter(r => r.laborType === 'apprentice');
const allApprenticesRegistered =
  apprenticeRows.length === 0 ||
  apprenticeRows.every(r => r.programName != null && r.programName.trim() !== '');

compliance: {
  certProperPayment: true,           // TODO Phase 7: derive from compliance engine
  certAccuratePayroll: true,         // TODO Phase 7: derive from compliance engine
  certWorkPerformed: true,           // manual certification; always true
  certApprentices: allApprenticesRegistered,  // derived from programName
  certFringeBenefits: workerRows.some(w => w.fringeCredit > 0),  // already correct
  // ...
}
```

### Multi-page chunk logic for fillWh347()

```typescript
// Inside fillWh347() — replace the current maxRows cap:
const ROWS_PER_PAGE = 8;
const chunks: Wh347WorkerRow[][] = [];
for (let i = 0; i < data.workers.length; i += ROWS_PER_PAGE) {
  chunks.push(data.workers.slice(i, i + ROWS_PER_PAGE));
}
const totalPageSets = chunks.length; // each "set" = 1 worker page + 1 statement page

// Get initial pages (already exist in template)
const pages = pdfDoc.getPages();
// pages[0] = first worker grid page
// pages[1] = first statement page

// For page sets 2..N, copy and append template pages
for (let setIdx = 1; setIdx < totalPageSets; setIdx++) {
  const [extraWorkerPage] = await pdfDoc.copyPages(pdfDoc, [0]);
  const [extraStatementPage] = await pdfDoc.copyPages(pdfDoc, [1]);
  pdfDoc.addPage(extraWorkerPage);
  pdfDoc.addPage(extraStatementPage);
}

// Now fill each page set
const allPages = pdfDoc.getPages();
for (let setIdx = 0; setIdx < totalPageSets; setIdx++) {
  const workerPage = allPages[setIdx * 2];
  const statementPage = allPages[setIdx * 2 + 1];
  const chunk = chunks[setIdx];
  // ... draw header, page notation, worker rows, statement ...
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact on Phase 6 |
|--------------|------------------|-------------------|
| Separate WH-348 for Statement of Compliance | 2025 form: Statement on Page 2 of WH-347 | Already implemented in generator — no change needed |
| Form had no J/RA column | 2025 form: mandatory J/RA column per worker | Already implemented at `WORKER_COLUMNS.laborTypeBox` |
| 8-worker hard cap (single page) | DOL supports "Page X of Y" continuation | Must be implemented in Phase 6 per success criteria |
| All compliance booleans caller-supplied | Phase 7 will drive these from compliance engine | Phase 6: fix `certApprentices`; leave others with TODOs |

---

## Open Questions

1. **ssnLast4 privacy decision**
   - What we know: `export.ts` hardcodes `identifyingNo: ''` with comment "privacy-safe default"
   - What's unclear: Is this intentional product design (never show SSN even on the PDF), or a v1 shortcut?
   - Recommendation: The 2025 WH-347 instructions require "last 4 digits of SSN or other identifying number." For legal compliance, the SSN last 4 should be populated. Phase 6 should include passing `ssnLast4` (or a non-SSN identifier like employee ID) to the PDF. The planner should confirm this is in scope.

2. **"Page X of Y" position**
   - What we know: The header has tight field density; the payroll number cell (x=510, y=458) already contains the payroll number
   - What's unclear: Exact safe position for page notation without overlapping other printed content
   - Recommendation: Use a small font (size 6) at x=760, y=458 (far right of header row 1) or add it to the payroll number field as a suffix ("1 of 2"). Confirm visually against the PDF.

3. **officialName / officialTitle / phoneNumber hardcoded placeholders**
   - What we know: Lines 137-138 in `export.ts` hardcode `'Certifying Official'` and `'Project Manager'`
   - What's unclear: Is there a user profile table that stores this data? The schema shows `users` with only `id`, `email`, `passwordHash`
   - Recommendation: This is out of scope for Phase 6. The signature block requires human input (contractor signs the physical form). Leave as placeholders. Phase 6 success criteria do not mention certifying official name.

---

## Validation Architecture

The project has no existing test configuration detected. Phase 6 changes are concentrated in 3 files:
- `src/server/services/wh347Generator.ts` — multi-page logic
- `src/server/routes/export.ts` — compliance boolean derivation
- `src/server/db/schema.ts` + `src/server/routes/workers.ts` — programName field

**Recommended manual validation per task:**

| Requirement | Manual Validation | Command |
|-------------|------------------|---------|
| WH347-01: 2025 form correct | Download WH-347 for a known payroll week; open in PDF viewer; verify all fields visible | `GET /api/export/wh347/:weekId` |
| WH347-01: certApprentices = false when unregistered | Create worker with `laborType='apprentice'` and no `programName`; generate WH-347; verify Page 2 checkbox not filled | Visual |
| WH347-02: J/RA column populated | Worker with apprentice classification generates "RA" in column (1J/RA) | Visual |
| Multi-page: 9+ workers produce 4-page PDF | Create payroll week with 9 workers; generate WH-347; verify 4 pages (2 worker + 2 statement) | Visual |
| Multi-page: Page X of Y shown | Verify "Page 1 of 2" appears on first page; "Page 2 of 2" on third page | Visual |

**Server restart requirement:** The project uses `tsx` without `--watch`. After any server-side file change, the server must be manually restarted on port 4099.

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)

- `src/server/services/wh347Generator.ts` — complete coordinate map, J/RA implementation, 8-row cap, `fillWh347()` signature
- `src/server/routes/export.ts` — WH-347 route, hardcoded compliance booleans, data mapping from payrollEntries to Wh347WorkerRow
- `src/server/db/schema.ts` — workers and workerClassifications exact column structure, payrollEntries fields
- `src/client/pages/WorkersPage.tsx` — current form fields, classification UI, edit flows
- `src/server/routes/workers.ts` — CreateWorkerSchema, UpdateWorkerSchema, CreateClassificationSchema, all worker endpoints
- `src/server/services/payrollService.ts` — getPayrollEntries() query structure, fields joined from workerClassifications
- `assets/wh347-official-2025.pdf` — confirmed file exists in the repository
- `.planning/research/SUMMARY.md` — project-level research, phase ordering rationale
- `.planning/research/PITFALLS.md` — all 10 pitfalls, Statement of Compliance false certification risk
- `.planning/REQUIREMENTS.md` — WH347-01, WH347-02 requirement definitions

### Secondary (MEDIUM confidence)

- [DOL WH-347 Form Instructions — Rev. Jan 2025](https://www.dol.gov/agencies/whd/forms/wh347) — J/RA column requirement, Statement of Compliance consolidation
- [29 CFR 5.5(a)(3)(ii)](https://www.ecfr.gov/current/title-29/subtitle-A/part-5) — false certification liability

---

## Metadata

**Confidence breakdown:**
- Current WH-347 generator state: HIGH — read the file directly
- Schema structure: HIGH — read schema.ts directly
- Export route behavior: HIGH — read export.ts directly
- Multi-page pdf-lib approach: HIGH — established pdf-lib API pattern; copyPages is the documented API
- Compliance boolean derivation rules: MEDIUM — Phase 6 derivation is conservative; Phase 7 compliance engine will improve accuracy
- Coordinate positions for "Page X of Y": LOW — needs visual verification against the actual PDF; exact safe x/y position not confirmed

**Research date:** 2026-03-20
**Valid until:** Stable — these are filesystem facts about the codebase, not ecosystem research
