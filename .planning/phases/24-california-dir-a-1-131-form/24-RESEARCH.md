# Phase 24: California DIR A-1-131 Form - Research

**Researched:** 2026-03-24
**Domain:** California public works certified payroll — A-1-131 form, CA Labor Code overtime rules, schema migration, PDF coordinate overlay, state-gated UI
**Confidence:** MEDIUM (form field layout derived from multiple secondary sources since DIR PDF is binary-only; coordinate mapping requires hands-on measurement at execution time)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CAL-01 | System captures CA-specific project fields (CSLB contractor license, WC policy number) on CA projects only | Schema migration adds two nullable columns to `projects`; `ProjectForm` conditionally renders fields when `state === 'CA'`; server schema updated with optional fields |
| CAL-02 | System generates a CA A-1-131 PDF with CA-specific fields: Sun-Sat grid, DT column, SDI deduction, CSLB license; UI discloses eCPR portal requirement | New `fillA1131()` generator following `wh347Generator.ts` pattern; new export route `/api/export/a1131/:weekId`; preflight modal with persistent eCPR disclosure; state-gated download button on `PayrollWeekDetailPage` |
| CAL-03 | System captures and displays DT hours alongside ST/OT for CA projects (schema migration required) | Migration adds 7 `*Dt` columns to `payroll_entries`; `UpsertEntrySchema` and `PayrollWeekForm` extended; CA project detection gates DT column rendering |
</phase_requirements>

---

## Summary

Phase 24 adds California-specific certified payroll support across three layers: (1) a DB schema migration to capture double-time hours and CA project fields, (2) a new PDF generator for the DIR A-1-131 form following the established `pdf-lib` coordinate-overlay pattern, and (3) conditional UI that renders CA-only fields and the download button only on CA projects.

The California DIR A-1-131 is a landscape-oriented multi-page form structurally similar to the WH-347 but with distinct differences: the hours grid runs Sun-Sat (not Mon-Sat), has three hour type rows per worker (ST / OT / DT), includes a dedicated SDI deduction field, puts fringe contributions in their own section separate from deductions, and captures CSLB contractor license and WC policy number in the header. The form PDF is available at `https://www.dir.ca.gov/dlse/Forms/PW/DLSEFormA-1-131.pdf` and is a flat (non-AcroForm) PDF like the WH-347, requiring coordinate overlay.

CA overtime rules under Labor Code § 1815 differ from federal CWHSSA: OT (1.5x) after 8 hours/day or 40 hours/week, DT (2x) after 12 hours/day or on the 7th consecutive workday. The UI must capture DT as a separate daily input column per worker. The existing compliance engine does not need to compute DT pay — the form records what was paid; the worker enters the DT hours they worked and the pay already reflects the 2x rate they received.

**Primary recommendation:** Follow the exact pattern of `wh347Generator.ts` + `export.ts` for the A-1-131 generator. Migrate `payroll_entries` to add 7 `*Dt` columns. Migrate `projects` to add `cslbLicense` and `wcPolicyNumber`. Gate the "Download CA A-1-131" button on `project.state === 'CA'`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pdf-lib | already installed | PDF coordinate overlay for A-1-131 | Same library used for WH-347; flat PDF requires drawText() approach |
| drizzle-orm | already installed | Schema migration + queries | Project ORM; add-only migrations |
| zod | already installed | Schema validation for new fields | Existing validation pattern |
| react-hook-form | already installed | DT column inputs in PayrollWeekForm | Existing form library |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| better-sqlite3 | already installed | Test DB (in-memory) | Test infrastructure |

### No New Dependencies Required
Phase 24 uses only existing project dependencies.

---

## Architecture Patterns

### Recommended File Structure (new files only)
```
src/server/
  db/
    migrations/
      0010_ca_project_fields.sql          # CSLB + WC columns on projects
      0011_payroll_entries_double_time.sql # *Dt columns on payroll_entries
  services/
    a1131Generator.ts                     # new — mirrors wh347Generator.ts
  routes/
    export.ts                             # modified — add GET /api/export/a1131/:weekId

src/client/
  components/projects/
    ProjectForm.tsx                       # modified — CA conditional fields
  pages/
    PayrollWeekDetailPage.tsx             # modified — CA download button
  components/
    PayrollWeekForm.tsx                   # modified — DT columns when CA project
```

### Pattern 1: Schema Migration (add-only, SQL-only)
**What:** Two new migrations following the established `ALTER TABLE ... ADD COLUMN` pattern
**When to use:** Always when adding DB columns in this project
**Migration index:** Next idx is 6 (current highest: idx 5, tag `0009_payroll_week_submission_amendment`)

Migration `0010_ca_project_fields.sql`:
```sql
ALTER TABLE projects ADD COLUMN cslb_license TEXT;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN wc_policy_number TEXT;
```

Migration `0011_payroll_entries_double_time.sql`:
```sql
ALTER TABLE payroll_entries ADD COLUMN mon_dt REAL NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE payroll_entries ADD COLUMN tue_dt REAL NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE payroll_entries ADD COLUMN wed_dt REAL NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE payroll_entries ADD COLUMN thu_dt REAL NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE payroll_entries ADD COLUMN fri_dt REAL NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE payroll_entries ADD COLUMN sat_dt REAL NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE payroll_entries ADD COLUMN sun_dt REAL NOT NULL DEFAULT 0;
```

Both migrations must be manually registered in `meta/_journal.json` — Drizzle silently skips unregistered files. Journal entries: idx 6 for `0010_ca_project_fields`, idx 7 for `0011_payroll_entries_double_time`.

Also update `schema.ts` to match (Drizzle type layer):
```typescript
// In projects table:
cslbLicense: text('cslb_license'),
wcPolicyNumber: text('wc_policy_number'),

// In payrollEntries table:
monDt: real('mon_dt').notNull().default(0),
tueDt: real('tue_dt').notNull().default(0),
// ... etc for all 7 days
```

### Pattern 2: A-1-131 PDF Generator (mirrors wh347Generator.ts)
**What:** New service file `a1131Generator.ts` using pdf-lib coordinate overlay on the blank DIR form
**When to use:** CA project A-1-131 download

Key structural differences from WH-347:
- Form dimensions: portrait 8.5"×11" (612×792 pt), NOT landscape like WH-347
- Hours grid: Sun / Mon / Tue / Wed / Thu / Fri / Sat column order (Sunday first)
- Three hour-type rows per worker: ST / OT / DT (not just ST/OT)
- SDI is a named deduction column (not a generic "Other Deductions" bucket)
- Fringe contributions go in a dedicated contributions section, NOT in the deductions total
- Header includes CSLB license and WC policy number
- CRITICAL: The blank A-1-131 PDF must be downloaded from the DIR website before Phase 24 executes — save to `assets/a1131-official.pdf`

```typescript
// Source: Secondary research + pattern match to wh347Generator.ts
export async function fillA1131(
  data: A1131Data,
  templateBytes: Uint8Array,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(templateBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  // coordinate overlay using drawText() — no AcroForm fields
  // ...
}
```

NOTE: Exact field coordinates must be measured against the actual form PDF at execution time (same process used for WH-347 — annotate with grid overlay, measure each field).

### Pattern 3: Export Route for A-1-131
**What:** New route in `export.ts` following existing `GET /api/export/wh347/:weekId` pattern
**Key differences from WH-347 route:**
- Fetches `project.cslbLicense` and `project.wcPolicyNumber` from project row
- Maps `monDt / tueDt ... sunDt` columns from each entry
- CA download gated: return 400 if `project.state !== 'CA'`
- Filename: `a1131-${week.payrollNumber}.pdf`

```typescript
// Source: Pattern from export.ts wh347 route
router.get('/a1131/:weekId', async (req, res) => {
  // ... ownership check (same as wh347 route)
  if (project.state !== 'CA') {
    res.status(400).json({ error: 'A-1-131 is only available for California projects' });
    return;
  }
  const templatePath = path.join(process.cwd(), 'assets', 'a1131-official.pdf');
  // ...
});
```

### Pattern 4: CA-Conditional UI Fields
**What:** `ProjectForm.tsx` shows CSLB license and WC policy number fields only when `state === 'CA'`
**Implementation:** Watch the `state` field with `useWatch` or `watch()` from react-hook-form

```typescript
// Source: react-hook-form watch() pattern
const stateValue = watch('state');
const isCA = stateValue?.toUpperCase() === 'CA';

// In JSX:
{isCA && (
  <div>
    <label>CSLB Contractor License #</label>
    <input {...register('cslbLicense')} />
  </div>
)}
{isCA && (
  <div>
    <label>Workers' Compensation Policy #</label>
    <input {...register('wcPolicyNumber')} />
  </div>
)}
```

Server schema update: `CreateProjectSchema` adds optional `cslbLicense` and `wcPolicyNumber` fields; `projects.ts` route inserts them.

### Pattern 5: DT Columns in PayrollWeekForm
**What:** Add a DT row of inputs for CA projects — gated on whether the project's state is CA
**Problem:** `PayrollWeekForm` currently does not receive or display the project's state. It only receives `projectId` and `workers`. Need to pass `isCA: boolean` prop.

Current form structure: two header rows (ST / OT), each with 7 day columns. For CA projects, add a third row per worker (DT) styled distinctly (e.g., amber-800 border to distinguish from OT's amber-200).

`UpsertEntrySchema` in `payroll.ts` must add optional `*Dt` fields alongside existing `*St` and `*Ot`.

### Pattern 6: State-Gated Download Button
**What:** "Download CA A-1-131" button appears only on CA projects; non-CA projects have no button
**Where:** `PayrollWeekDetailPage.tsx` — needs to know `project.state`

The page currently loads `PayrollWeekDetailResponse` which contains `week` (with `projectId`) but does NOT include the project object. Two options:
1. Add a second query to fetch the project from `/api/projects/:id` using `week.projectId`
2. Include `projectState` in the week detail endpoint response

Option 1 is cleaner and matches existing patterns (`PayrollEntryPage` already queries workers separately). The project query can be enabled only once `weekData` is available (after `week.projectId` is known).

```typescript
// Source: TanStack Query pattern from ProjectDetailPage
const { data: projectData } = useQuery({
  queryKey: ['project', weekData?.week.projectId],
  queryFn: () => api.get<ProjectResponse>(`/projects/${weekData!.week.projectId}`),
  enabled: !!weekData?.week.projectId,
});

const isCA = projectData?.data?.project?.state === 'CA';
```

### Pattern 7: eCPR Preflight Disclosure Modal
**What:** Download CA A-1-131 triggers a modal with a PERSISTENT disclosure that electronic submission requires `efiling.dir.ca.gov/eCPR`
**Persistent** means: unlike the WH-347 preflight (which only shows when violations exist), the CA A-1-131 preflight ALWAYS shows before download (it's a mandatory disclosure, not a conditional warning)
**Structure:** Same modal pattern as WH-347 preflight but always-on, with eCPR link text

```typescript
// "Persistent" means setShowCaDisclosure(true) is called on every button click
// NOT conditionally based on compliance state
function handleCaDownloadClick() {
  setShowCaDisclosure(true);  // always show
}
```

### Anti-Patterns to Avoid
- **Computing DT hours automatically from ST entry:** DT hours are entered by the contractor based on what they actually paid. The system records what was entered, not what was computed.
- **Putting fringe contributions in the deductions total:** CA form explicitly separates fringe contributions (employer payments to benefit plans) from employee deductions. The WH-347 generator already handles this separation — the A-1-131 must too.
- **Changing the existing WH-347 form or payroll entry flow for federal projects:** DT columns must be additive and CA-gated; federal projects must not be affected.
- **Skipping the journal.json update:** Drizzle silently ignores migrations not in `_journal.json`. This has burned this project before (Phase 06 decision log).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF text overlay | Custom canvas/SVG rendering | pdf-lib `drawText()` | Already proven for WH-347; same license-compliance rationale |
| Form state watching | Manual `onChange` handlers | `watch()` / `useWatch()` from react-hook-form | Already installed; clean reactivity |
| Download trigger | `window.open()` | Blob + `URL.createObjectURL()` pattern | Already used for WH-347; handles cookie-auth correctly |
| Double-click guard | `setTimeout` debounce | `useRef(false)` guard | Existing `generatingRef` pattern |

---

## Common Pitfalls

### Pitfall 1: Migration Journal Not Updated
**What goes wrong:** Migration SQL file added, schema.ts updated, but `meta/_journal.json` not updated — Drizzle silently skips the migration; columns do not exist at runtime, queries fail
**Why it happens:** Drizzle only runs migrations registered in the journal
**How to avoid:** After writing the SQL file, immediately add both entries to `_journal.json` with correct `idx`, `when`, and `tag`
**Warning signs:** No error at startup; INSERT/SELECT queries return "table X has no column Y"

### Pitfall 2: Fringe Contributions in Deductions Total
**What goes wrong:** Fringe benefit amounts appear in deductions section — violates CA DIR requirements and produces invalid form
**Why it happens:** The WH-347 deductions field is a catch-all; A-1-131 explicitly separates them
**How to avoid:** In `fillA1131()`, map `fringeRateSnapshot * totalHours` to the fringe contributions section, not to the deductions column
**Warning signs:** Auditor flags form for incorrect fringe handling

### Pitfall 3: A-1-131 Template PDF Missing at Runtime
**What goes wrong:** Route crashes with `ENOENT: no such file or directory 'assets/a1131-official.pdf'` at download time
**Why it happens:** Template PDF must be manually downloaded from DIR and committed to assets/
**How to avoid:** Wave 0 task must download `https://www.dir.ca.gov/dlse/Forms/PW/DLSEFormA-1-131.pdf` and save to `assets/a1131-official.pdf` before any generator code runs
**Warning signs:** Test for `existsSync('assets/a1131-official.pdf')` fails; download endpoint 500s

### Pitfall 4: WH-347 Form Broken by DT Column Addition
**What goes wrong:** Adding `*Dt` fields to `UpsertEntrySchema` causes WH-347 flow to break if new fields are required
**Why it happens:** Schema validation rejects payloads without the new fields
**How to avoid:** All `*Dt` fields must be `.optional()` in Zod schema; `payrollService.ts` defaults them to 0; existing WH-347 tests must still pass
**Warning signs:** Existing vitest suite breaks on payroll route tests

### Pitfall 5: Project State Not Available in PayrollWeekDetailPage
**What goes wrong:** CA download button either appears on all projects or requires a prop-drilling chain
**Why it happens:** `PayrollWeekDetailPage` only fetches week + entries; project state is not in that payload
**How to avoid:** Add a second TanStack Query for project data once `week.projectId` is known; use `enabled: !!weekData?.week.projectId`
**Warning signs:** Download button always shows or page crashes on undefined projectState

### Pitfall 6: eCPR Disclosure Not Persistent
**What goes wrong:** Disclosure only shows on violations (like WH-347 preflight), not every download
**Why it happens:** Copying the WH-347 conditional logic pattern literally
**How to avoid:** CA preflight modal is triggered unconditionally on every "Download CA A-1-131" click — it is a regulatory disclosure, not a warning
**Warning signs:** User can download without seeing the eCPR portal URL

### Pitfall 7: Sun-Sat vs Mon-Sat Column Order
**What goes wrong:** WH-347 generator omits Sunday from hours grid (Mon-Sat only); A-1-131 requires Sun-Sat order with Sunday on the left
**Why it happens:** WH-347 form doesn't have a Sunday column in the same grid position; A-1-131 does
**How to avoid:** A-1-131 worker rows must use `DAYS = ['sun','mon','tue','wed','thu','fri','sat']` order, mapping `sunSt/sunOt/sunDt` in column 1

---

## Code Examples

### Existing WH-347 generator structure to mirror
```typescript
// Source: src/server/services/wh347Generator.ts
// Key decision: pdf-lib coordinate overlay, no AcroForm
// Template must be blank when copyPages() is called
const pdfDoc = await PDFDocument.load(templateBytes);
const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
// drawText at measured (x, y) coordinates
page.drawText(value, { x, y, size: TEXT_SIZE, font, color: black });
drawCheckbox(page, x, y, checked);  // filled 7x7 rectangle
```

### Existing export route ownership check to reuse
```typescript
// Source: src/server/routes/export.ts lines 84-98
const db = getDb();
const [project] = await db.select().from(projects).where(eq(projects.id, week.projectId)).limit(1);
if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
if (project.userId !== userId) { res.status(403).json({ error: 'Access denied' }); return; }
```

### Existing Blob download pattern (already in PayrollWeekDetailPage)
```typescript
// Source: src/client/pages/PayrollWeekDetailPage.tsx handleConfirmedDownload()
const res = await fetch(`/api/export/a1131/${weekId}`, { credentials: 'include' });
if (!res.ok) throw new Error(`Download failed: ${res.status}`);
const blob = await res.blob();
const url = URL.createObjectURL(blob);
hiddenAnchorRef.current!.href = url;
hiddenAnchorRef.current!.download = `a1131-${weekId}.pdf`;
hiddenAnchorRef.current!.click();
setTimeout(() => URL.revokeObjectURL(url), 100);
```

### React-hook-form conditional field watching
```typescript
// Source: react-hook-form docs / established pattern
const { watch, register } = useForm<ProjectFields>();
const stateValue = watch('state');
const isCA = stateValue?.toUpperCase() === 'CA';
```

---

## CA A-1-131 Form Field Inventory

Based on research from multiple sources (MEDIUM confidence — coordinates require measurement at execution time).

### Header Fields
| Field | Location | Notes |
|-------|----------|-------|
| Contractor Name | Top left header band | |
| Contractor Address | Below name | |
| CSLB License # | Header band | CA-specific — not on WH-347 |
| WC Insurance Policy # | Header band | CA-specific — not on WH-347 |
| Project Name | Header | |
| Project Location | Header | |
| Contract / Bid # | Header | |
| Week Ending Date | Header | |
| Payroll Number | Header | |

### Worker Grid (per worker row)
| Column | Notes |
|--------|-------|
| Entry # | Worker sequence number |
| Worker Name | Last, First MI |
| SSN (last 4 or full) | CA DIR policy — research at execution |
| J / RA | Journeyworker or Registered Apprentice |
| Trade Classification | |
| **Sun ST / OT / DT** | Sunday is FIRST column (left-most day) |
| **Mon ST / OT / DT** | |
| **Tue ST / OT / DT** | |
| **Wed ST / OT / DT** | |
| **Thu ST / OT / DT** | |
| **Fri ST / OT / DT** | |
| **Sat ST / OT / DT** | Saturday is LAST column |
| Total ST | |
| Total OT | |
| Total DT | |
| ST Rate | Base rate |
| OT Rate | 1.5x base |
| DT Rate | 2.0x base |

### Deductions Section (per worker)
| Field | Notes |
|-------|-------|
| Federal Income Tax | |
| State Income Tax | |
| **SDI** | State Disability Insurance — CA-specific named field |
| Union / Other | |
| Total Deductions | Sum of above ONLY |

### Fringe Contributions Section (SEPARATE from deductions)
| Field | Notes |
|-------|-------|
| Health & Welfare | Employer contribution per hour |
| Pension / Retirement | Employer contribution per hour |
| Vacation / Holiday | |
| Training | |
| **Note:** These are NOT included in Total Deductions | CA DIR requirement |

### Certification/Statement Section
| Field | Notes |
|-------|-------|
| Certifying Official Signature | |
| Title | |
| Date | |
| eCPR Portal disclosure | Required: efiling.dir.ca.gov/eCPR |

---

## CA Double-Time Rules (California Labor Code § 1815)

**Confidence: HIGH** (verified from multiple authoritative sources)

| Situation | Rate |
|-----------|------|
| Hours 1-8 per day | ST (1.0x base) |
| Hours 9-12 per day | OT (1.5x base + fringe) |
| Hours 13+ per day | DT (2.0x base + fringe) |
| Weekly hours 1-40 | ST (if under daily threshold) |
| Weekly hours 41+ | OT (1.5x) |
| 7th consecutive workday hours 1-8 | OT (1.5x) |
| 7th consecutive workday hours 9+ | DT (2.0x) |

**Key distinction from federal CWHSSA:** CWHSSA only requires OT at 1.5x for hours over 8/day or 40/week. California adds the 12-hour DT threshold and 7th-day rules.

**For Phase 24 scope:** The UI must capture DT hours as entered by the contractor (they are responsible for calculating and paying DT based on their actual records). The system does NOT auto-compute DT from ST entry — it records what was paid.

The compliance engine (currently checking CWHSSA) does NOT need to validate DT for Phase 24. DT columns are captured and displayed on the CA form. DT compliance validation is out of scope for this phase.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Paper A-1-131 submission | eCPR portal at efiling.dir.ca.gov/eCPR | Per CA DIR, ongoing | Local PDF is for contractor records only; portal required for official submission |
| N/A | A-1-131 PDF is flat (no AcroForm) | Always | Coordinate overlay required, same as WH-347 |

**eCPR Portal note (MEDIUM confidence):** The California DIR requires electronic submission via the eCPR portal (`efiling.dir.ca.gov/eCPR`) for most public works projects. The A-1-131 PDF generated by this app is a local reference/draft document only. Official submission requires the portal. This must be disclosed in the preflight modal.

**Deprecated/outdated:**
- Paper-only A-1-131 submission: CA now requires eCPR portal for most projects. The generated PDF serves as a contractor's working copy and local record.

---

## Open Questions

1. **A-1-131 PDF availability and form version**
   - What we know: The form is at `https://www.dir.ca.gov/dlse/Forms/PW/DLSEFormA-1-131.pdf` (confirmed by DIR DLSE forms page)
   - What's unclear: Whether the current form version matches research descriptions (the form may have been updated). Exact field coordinates are unknown until the PDF is visually inspected.
   - Recommendation: Wave 0 task must download the PDF, open it, annotate with a grid, and measure all field coordinates before writing any generator code. This is the same process used for WH-347.

2. **Full SSN vs. SSN Last-4 on A-1-131**
   - What we know: WH-347 uses `identifyingNo` which is privacy-safe (last 4 by design in this app). CA DIR research flags note to "verify current DIR policy on SSN last-4 vs. full SSN."
   - What's unclear: California may require full SSN on A-1-131 for official records, or may accept last-4.
   - Recommendation: Default to last-4 (same as WH-347) for the local PDF. Note in the modal that official eCPR submission through the portal handles full SSN requirements separately.

3. **CSLB license — required or optional at project creation**
   - What we know: CA projects need CSLB license on the A-1-131. Research flags note to "confirm whether CSLB license fields are required at project creation or optional."
   - What's unclear: Should the form hard-block creation without CSLB, or allow creation and warn?
   - Recommendation: Make CSLB license and WC policy optional at project creation (nullable in DB); show a warning on the CA A-1-131 preflight modal if missing, similar to how the WH-347 preflight handles missing worker data.

4. **A-1-131 multi-page behavior**
   - What we know: WH-347 supports 8 workers/page with chunking. A-1-131 likely has a similar row limit.
   - What's unclear: How many worker rows per page on A-1-131.
   - Recommendation: Determine from the actual PDF at execution time. Implement same chunking pattern as WH-347.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/routes/projects.test.ts tests/routes/payroll.test.ts tests/services/wh347.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAL-01 | CA project creation includes cslbLicense + wcPolicyNumber fields | route/integration | `npx vitest run tests/routes/projects.test.ts` | Wave 0 additions needed |
| CAL-01 | Non-CA project creation does NOT include CA fields in response | route/integration | `npx vitest run tests/routes/projects.test.ts` | Wave 0 additions needed |
| CAL-03 | POST /api/payroll/entries accepts monDt-sunDt fields for CA project | route/integration | `npx vitest run tests/routes/payroll.test.ts` | Wave 0 additions needed |
| CAL-03 | Existing payroll tests still pass (WH-347 flow unbroken) | route/regression | `npx vitest run tests/routes/payroll.test.ts` | Existing file |
| CAL-02 | fillA1131() returns a valid PDF bytes when given valid A1131Data | service/unit | `npx vitest run tests/services/a1131.test.ts` | Wave 0 new file |
| CAL-02 | GET /api/export/a1131/:weekId returns 400 for non-CA project | route/integration | `npx vitest run tests/routes/export.test.ts` (if exists) | Wave 0 additions needed |
| CAL-02 | GET /api/export/a1131/:weekId returns PDF for CA project | route/integration | `npx vitest run tests/routes/export.test.ts` | Wave 0 additions needed |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/routes/payroll.test.ts tests/services/wh347.test.ts` (regression check — verifies WH-347 flow unbroken)
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/routes/projects.test.ts` — add CA field tests (file exists; add describe block for CAL-01)
- [ ] `tests/routes/payroll.test.ts` — add DT field tests (file exists; add describe block for CAL-03)
- [ ] `tests/services/a1131.test.ts` — new file covering `fillA1131()` for CAL-02 (mirrors `wh347.test.ts`)
- [ ] `assets/a1131-official.pdf` — download from `https://www.dir.ca.gov/dlse/Forms/PW/DLSEFormA-1-131.pdf` (required before generator can be tested)
- [ ] Export route tests for `/api/export/a1131/:weekId` — either new file `tests/routes/export.test.ts` or additions to payroll test file

---

## Sources

### Primary (HIGH confidence)
- `src/server/db/schema.ts` — current `payrollEntries` schema (monSt/monOt columns confirmed, no DT columns)
- `src/server/services/wh347Generator.ts` — established PDF overlay pattern; coordinate approach documented
- `src/server/routes/export.ts` — established export route pattern
- `src/server/routes/payroll.ts` — UpsertEntrySchema (all existing *St and *Ot fields confirmed)
- `src/server/db/migrations/meta/_journal.json` — current idx=5; next idx=6 confirmed
- `src/client/components/projects/ProjectForm.tsx` — current fields; no CA-specific fields yet
- `src/client/pages/PayrollWeekDetailPage.tsx` — existing WH-347 download pattern

### Secondary (MEDIUM confidence)
- [California DIR DLSE Public Works Forms page](https://www.dir.ca.gov/dlse/DLSE-Forms-PW.htm) — confirmed form PDF URL and eCPR note
- [hh2.com California construction overtime rules](https://www.hh2.com/construction-human-resources/overtime-rules-and-laws-for-californias-construction-industry) — OT at 8 hrs/day, DT at 12 hrs/day, 7th day rules
- [DIR Certified Payroll Reporting page](https://www.dir.ca.gov/public-works/certified-payroll-reporting.html) — eCPR portal is required for most projects
- sdhc.org A-1-131 form analysis — Sun-Sat day order confirmed, ST/OT/DT rows per worker, SDI deduction field, fringe contributions separate from deductions, CSLB license and WC policy in header
- WebSearch result summary — "S = STRAIGHT TIME" / "O = OVERTIME" / "DT" abbreviations on form; SDI named deduction field; M/T/W/TH/F/S/S (Mon-Sun) column headers

### Tertiary (LOW confidence)
- Various certified payroll software vendor pages — general form structure descriptions; not authoritative for exact field coordinates

---

## Metadata

**Confidence breakdown:**
- Schema migration: HIGH — current schema fully examined; next migration index confirmed
- Architecture patterns: HIGH — mirrors established wh347Generator.ts pattern exactly
- CA DT rules: HIGH — confirmed via multiple authoritative sources
- A-1-131 form structure: MEDIUM — field types and order confirmed from multiple sources; exact PDF coordinates are LOW confidence until the blank form PDF is physically inspected
- eCPR disclosure requirement: MEDIUM — confirmed from DIR page and multiple vendor sources

**Research date:** 2026-03-24
**Valid until:** 2026-06-24 (stable government form; unlikely to change)

**Critical pre-execution blocker:** The blank `assets/a1131-official.pdf` must be downloaded and field coordinates measured before `a1131Generator.ts` can be written. This is the same process as WH-347 and should be Wave 0 Task 1 in the phase plan.
