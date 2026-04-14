# Phase 53: CA A-1-131 Gap Close - Research

**Researched:** 2026-04-13
**Domain:** PDF coordinate verification, CA A-1-131 form, pdf-lib overlay, UI flow audit
**Confidence:** HIGH — all findings from direct codebase inspection

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CA-02 | Browser verification of the existing CA A-1-131 PDF: run the dev server, download an A-1-131 for a CA project, visually confirm all field coordinates are correct (header fields, per-worker rows, fringe section, SDI deduction, certification text). Document any coordinate corrections needed and apply them. | Generator fully built; coordinate constants in `a1131Generator.ts` inspected; prior screenshots exist in `assets/`; UI flow partially wired but has a disclosure modal routing bug that needs fixing. |
</phase_requirements>

---

## Summary

Phase 24 Plan 03 (Task 3) was never executed. Tasks 1 and 2 of that plan were completed: `a1131Generator.ts` exists and passes all 7 unit tests, the export route `GET /api/export/a1131/:weekId` is live, and the CA download button is present in `PayrollWeekDetailPage.tsx`. What was never done is the human-in-the-loop browser verification step and formal gap closure.

Two pre-existing screenshots exist in `assets/` (`a1131-page1.png`, `a1131-page2.png`) from prior debug runs. Page 1 shows plausible coordinate placement but with test fixture data ("ca 2 test", "any, CA"). Page 2 is blank/gray — the certification page content may not be rendering visibly. These screenshots were captured against an older code state and do not constitute the formal verification required by CA-02.

There is also one structural bug found during research: `handleCaDownloadClick` (which opens the CSLB/WC disclosure modal) is defined but never called. The STATE_FORMS registry-driven button calls `handleStateFormDownload` directly, bypassing the mandatory eCPR disclosure modal. This must be fixed as part of this phase. Additionally, the a1131 export route is the only export route that lacks a best-effort audit log (`ca_pdf.downloaded`), which all other state export routes include.

**Primary recommendation:** Set up a CA project with real payroll entries, download via browser, visually verify all 5 coordinate sections against the official form, apply any corrections to `a1131Generator.ts`, fix the modal routing bug, add the missing audit log, and formally mark CA-02 done.

---

## Standard Stack

### Core (already in use — no new installs)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| pdf-lib | installed | PDF coordinate overlay — CTM-based landscape drawing | Already used by a1131Generator.ts |
| vitest | installed | Test runner | Already configured |
| React + TanStack Query | installed | CA download button + modal | Already wired |

**Installation:** None required. All dependencies are already installed.

**Dev server:** `npm run dev` (port 4099 per CLAUDE.md)
**Test run:** `npx vitest run tests/services/a1131.test.ts tests/routes/export.test.ts`

---

## Architecture Patterns

### PDF Coordinate System (CRITICAL — unique to A-1-131)

The A-1-131 official PDF (`assets/a1131-official.pdf`) uses a non-standard layout:

- **Physical storage:** Portrait (612×1008 points) with `/Rotate=90` CW
- **Display result:** Browser/viewer rotates 90° CW, producing landscape (1008×612) display
- **Drawing method:** `concatTransformationMatrix(0, 1, -1, 0, 612, 0)` applied to page 1 — rotates the drawing context 90° CCW to cancel the page rotation
- **After CTM:** All coordinates are in landscape space: `lx` 0–1008 (left→right), `ly` 0–612 (bottom→top)
- **Page 2 (cert page):** `/Rotate=0`, native portrait 612×1008. pdf-lib's `normalize()` wraps template content in shared q/Q streams, so the existing template CTM `"1 0 0 1 79.08 788.76 cm"` is already undone. Draw at **absolute portrait coordinates**.

This CTM pattern is fully implemented and correct. Do NOT change it unless visual verification proves a specific coordinate is misaligned.

### Coordinate Constants (from a1131Generator.ts — verified by inspection)

**Header positions (landscape lx/ly after CTM):**
```
contractorName:  { lx: 315, ly: 535 }
cslbLicense:     { lx: 618, ly: 535 }
address:         { lx: 770, ly: 535 }
payrollNo:       { lx: 283, ly: 514 }
weekEndingDate:  { lx: 454, ly: 514 }
wcPolicyNumber:  { lx: 675, ly: 497 }
projectNo:       { lx: 866, ly: 514 }
projectLocation: { lx: 856, ly: 497 }
```

**Worker row Y positions (landscape ly):**
- Base Y: 391 (first worker's ST row)
- Block spacing: 92 pts between workers
- Sub-row spacing: 47 pts (ST → OT → DT)
- Formula: `stY = 391 - workerIdx * 92`

**Day column X positions (landscape lx, Monday-first display):**
```
monHours: 327, tueHours: 344, wedHours: 357,
thuHours: 379, friHours: 401, satHours: 419, sunHours: 437
totalHours: 462, hourlyRate: 499, grossWages: 540
fedTax: 638, stateTax: 720, sdi: 761,
otherDeductions: 830, totalDeductions: 869, netPay: 912
fringeCredit: 912 (drawn at otY to avoid overlap with netPay)
```

**Cert page (page 2) absolute portrait coordinates:**
```
contractor name: x=80,  y=630  (maxWidth: 290)
payroll desc:    x=375, y=588  (maxWidth: 160)
date:            x=108, y=451
```

These were derived from pdfminer text extraction. Visual verification in browser is the authoritative check.

### Form Capacity
- 5 workers per page set (ROWS_PER_PAGE = 5)
- Multi-page: `copyPages()` for each additional set (worker page + cert page per set)
- Page numbering overlay at lx=940, ly=556 for multi-page PDFs

### CA UI Flow (STATE_FORMS registry pattern)

The CA A-1-131 button is driven by the `STATE_FORMS` registry in `PayrollWeekDetailPage.tsx`:
```typescript
const STATE_FORMS = {
  CA: { downloadLabel: 'Download CA A-1-131', route: 'a1131' },
  // ...
};
```

The registry button calls `handleStateFormDownload(route, weekId)` — a generic handler that calls `fetch(/api/export/${route}/${wkId})` directly with no modal. This **bypasses the eCPR disclosure modal** (a bug). The fix: CA must not use the generic STATE_FORMS handler; it must call `handleCaDownloadClick()` which opens `showCaDisclosure`.

### Existing CA-Specific Handlers (already implemented)

```typescript
// handleCaDownloadClick() — opens disclosure modal (defined but never called)
// handleCaConfirmedDownload() — fetches PDF after modal confirmation
// showCaDisclosure state — controls modal visibility
// caGeneratingRef — double-click guard (separate from generatingRef)
```

The disclosure modal contains: eCPR portal link, CSLB/WC missing advisory. Already fully built — just not reachable from the button.

### Audit Log Gap

The `GET /api/export/a1131/:weekId` route in `export.ts` streams the PDF but has **no audit log call**. Every other state export route (`wh347`, `f700`, `pw12`, `il-pdf`, `ma-cpr`, `nj-mw562`) includes:
```typescript
try {
  const { insertAuditLog } = await import('../services/auditService.js');
  await insertAuditLog({
    userId, ipAddress: req.ip ?? null, projectId: week.projectId,
    entityType: 'payroll_week', entityId: weekId,
    action: 'ca_pdf.downloaded',
    meta: { payrollNumber: week.payrollNumber, weekEnding: week.weekEndingDate, format: 'pdf' },
  });
} catch (auditErr) { console.error('[audit]', auditErr); }
```

Adding this to the a1131 route completes parity with all other export routes.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF coordinate overlay | Custom PDF writer | pdf-lib already in use | pdf-lib handles CTM, font embedding, page copy |
| Coordinate measurement | Manual pixel math | Existing pdfminer-derived constants | Already measured and documented in a1131Generator.ts |
| Multi-page PDF | Custom page splitter | Existing `copyPages()` chunking | Already implemented, passes tests |
| Double-click guard | setTimeout debounce | `caGeneratingRef` (already exists) | Already wired, same ref pattern as all other download handlers |

---

## Common Pitfalls

### Pitfall 1: CTM State Leak Between Pages
**What goes wrong:** If `popGraphicsState()` is omitted after the worker page CTM, the landscape transformation leaks into subsequent PDF operations.
**Why it happens:** pdf-lib appends operators to the content stream; without `popGraphicsState()`, the CTM remains active.
**How to avoid:** The generator already wraps the CTM with `pushGraphicsState()` before and `popGraphicsState()` after — do not remove these.
**Warning signs:** All text on subsequent pages appears rotated 90°.

### Pitfall 2: Cert Page Uses Absolute Coords, NOT Landscape Coords
**What goes wrong:** Drawing cert page text at landscape `lx/ly` values produces off-page content.
**Why it happens:** Page 2 has `/Rotate=0` — no CTM applied. pdf-lib's normalize() means the template's existing translation is already undone.
**How to avoid:** Cert page draws use `certPage.drawText(...)` with absolute portrait coords (x=80, y=630 etc.) — NOT through the landscape helper function `dt()`.
**Warning signs:** Certification text invisible or appearing at top-left of page 2.

### Pitfall 3: CA Button Uses Generic Handler, Bypassing Modal
**What goes wrong:** `handleStateFormDownload('a1131', weekId)` fetches the PDF without showing the CSLB/WC disclosure modal — violating the eCPR persistent-disclosure requirement.
**Why it happens:** The STATE_FORMS registry was added in Phase 47; CA was included in the registry but the per-state modal routing wasn't adjusted.
**How to avoid:** The STATE_FORMS registry button for CA must be replaced with a CA-specific `onClick={() => handleCaDownloadClick()}` call (or the registry must support custom onClick handlers).
**Warning signs:** Clicking "Download CA A-1-131" triggers immediate download with no modal.

### Pitfall 4: SDI Column Overlap with otherDeductions
**What goes wrong:** If SDI value is non-zero, text at COL.sdi (761) might overlap with otherDeductions (830) if very long.
**Why it happens:** SMALL_SIZE=6 text at narrow column widths — no maxWidth clipping on deduction columns.
**How to avoid:** Deduction values are always 2-decimal dollar amounts (e.g., "12.50") — short enough that column overlap is cosmetically unlikely at SIZE 6. Verify visually during browser check.
**Warning signs:** Deduction column values appear to overrun their column boxes.

### Pitfall 5: Worktree Tests Pollute Test Run
**What goes wrong:** Running `npx vitest run` from the project root discovers test files in `.claude/worktrees/` — these are stale old-agent files with RED stubs and port conflicts.
**Why it happens:** No `exclude` pattern in `vitest.config.ts`.
**How to avoid:** For Phase 53 verification, run: `npx vitest run tests/services/a1131.test.ts tests/routes/export.test.ts` (explicit paths). The main-path a1131 tests all pass; the failures are only in worktrees.
**Warning signs:** Test output shows failures in `.claude/worktrees/agent-*/` paths.

---

## Code Examples

### Correct CA Button Click Handler (fix the routing bug)

```typescript
// In the STATE_FORMS registry button section, CA must be handled specially:
// Option A: Override stateFormConfig click for CA only
{stateFormConfig && weekId && stateFormConfig.route !== 'a1131' && (
  <Button
    variant="secondary" size="sm" disabled={generating}
    onClick={() => handleStateFormDownload(stateFormConfig.route, weekId)}
  >
    {stateFormConfig.downloadLabel}
  </Button>
)}
{isCA && weekId && (
  <Button
    variant="secondary" size="sm"
    onClick={handleCaDownloadClick}
  >
    Download CA A-1-131
  </Button>
)}
```

Or simpler: use a conditional onClick on the STATE_FORMS button:
```typescript
onClick={() => stateFormConfig.route === 'a1131'
  ? handleCaDownloadClick()
  : handleStateFormDownload(stateFormConfig.route, weekId)
}
```

### Audit Log Addition to a1131 Route (export.ts, after line 364)

```typescript
// Best-effort audit log (AUDIT-03) — add before closing }); of the route
try {
  const { insertAuditLog } = await import('../services/auditService.js');
  await insertAuditLog({
    userId,
    ipAddress: req.ip ?? null,
    projectId: week.projectId,
    entityType: 'payroll_week',
    entityId: weekId,
    action: 'ca_pdf.downloaded',
    meta: { payrollNumber: week.payrollNumber, weekEnding: week.weekEndingDate, format: 'pdf' },
  });
} catch (auditErr) { console.error('[audit]', auditErr); }
```

### Coordinate Correction Pattern (if coordinates need adjustment)

```typescript
// In a1131Generator.ts, adjust the HEADER or COL constants:
const HEADER = {
  contractorName: { lx: 315, ly: 535 },   // change lx/ly here
  // ...
} as const;

// For worker rows, adjust getWorkerRowLY():
function getWorkerRowLY(workerIdx: number): { st: number; ot: number; dt: number } {
  const baseY = 391;         // change if first worker row is off
  const blockSpacing = 92;   // change if worker rows overlap or have gaps
  const subRowSpacing = 47;  // change if ST/OT/DT sub-rows are off
  // ...
}
```

---

## State of the Art

| Status | What Exists | Notes |
|--------|-------------|-------|
| DONE | `src/server/services/a1131Generator.ts` | All 7 unit tests pass; coordinate math uses pdfminer-verified constants |
| DONE | `GET /api/export/a1131/:weekId` in export.ts | State-gated to CA, uses assertProjectAccess |
| DONE | `showCaDisclosure` modal in PayrollWeekDetailPage | Built but unreachable due to button routing bug |
| BUG | CA button calls `handleStateFormDownload` | Bypasses eCPR disclosure modal — must fix |
| MISSING | Audit log in a1131 route | All other export routes have it; a1131 does not |
| UNVERIFIED | PDF field coordinates | Screenshots exist but are from test fixture data; formal browser verification never done |
| UNVERIFIED | Cert page (page 2) content | a1131-page2.png is blank gray — may indicate cert content is invisible or coordinate issue |

---

## Environment Availability

| Dependency | Required By | Available | Notes |
|------------|------------|-----------|-------|
| Node.js / npm | Dev server | Yes | Already in use |
| Dev server port 4099 | Browser verification | Yes | `npm run dev` (or `npx tsx src/server/index.ts`) |
| `assets/a1131-official.pdf` | Generator template | Yes | File exists at project root |
| `assets/a1131-page1.png` | Reference screenshot | Yes | Prior filled PDF screenshot available |
| CA project with payroll data | Browser verification | Must create | Need a CA project with at least 1 payroll entry |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/services/a1131.test.ts` |
| Full CA-related run | `npx vitest run tests/services/a1131.test.ts tests/routes/export.test.ts` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CA-02 | fillA1131 produces valid %PDF | unit | `npx vitest run tests/services/a1131.test.ts` | Yes (7 tests pass) |
| CA-02 | GET /api/export/a1131/:weekId returns PDF for CA project | integration | `npx vitest run tests/routes/export.test.ts` | Yes (passes in main) |
| CA-02 | GET /api/export/a1131/:weekId returns 400 for non-CA | integration | `npx vitest run tests/routes/export.test.ts` | Yes |
| CA-02 | Audit log recorded on CA PDF download | integration | Verify via ProjectActivityPage after download | No — must verify manually |
| CA-02 | eCPR disclosure modal shown on CA download | browser | Manual browser verification | Human task |
| CA-02 | All field coordinates correct on form | browser | Manual visual verification | Human task |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/services/a1131.test.ts tests/routes/export.test.ts`
- **Phase gate:** Both test files green + browser verification approved

### Wave 0 Gaps
None — existing test infrastructure fully covers the automated portion of CA-02.

---

## Project Constraints (from CLAUDE.md)

The following directives from `CLAUDE.md` apply to this phase:

- **NEVER hard-delete projects or payroll weeks** — 29 CFR Part 3 compliance. Not relevant to this phase (no data deletion).
- **Design Tokens:** All brand values via `@theme` tokens — `bg-nav-dark`, `border-brand-gold`, `bg-surface-card`. No hardcoded hex colors.
- **UI Primitives:** Use `Card`, `Button`, `Badge`, `PageHeader` from `src/client/components/ui/`. No `asChild` prop on Button.
- **React Patterns:** `useRef` for synchronous guards (double-click prevention). `caGeneratingRef` is already in place — do not switch to useState.
- **Blob URL downloads:** `fetch()` → `.blob()` → `URL.createObjectURL()` → click → `setTimeout(URL.revokeObjectURL, 100)` — already implemented in `handleCaConfirmedDownload`.
- **DB Migration pattern:** Not needed for this phase (no schema changes).
- **assertProjectAccess pattern:** Already in the a1131 route — do not remove it.
- **Server port:** 4099.

---

## Open Questions

1. **Cert page (page 2) blank screenshot**
   - What we know: `assets/a1131-page2.png` is a solid gray rectangle — no visible text
   - What's unclear: Is this because the old screenshot was of the blank template? Or are the cert page coordinates (x=80, y=630; x=375, y=588; x=108, y=451) landing outside the visible area?
   - Recommendation: Print cert page coordinates during verification. The code comments explain that pdf-lib normalize() undoes the template CTM, so absolute coords should be correct — but this must be visually confirmed.

2. **DT columns in export route vs. A-1-131 form**
   - What we know: The A-1-131 official form does NOT have a dedicated DT row — it has S (straight), O (overtime), and the form's design predates CA's DT rules. The generator draws DT at `dtY` positions, but these may not align to labeled rows on the actual form.
   - What's unclear: Whether the existing DT row drawing positions (stY - 94) are within the worker block boundaries or extend into the next worker's space.
   - Recommendation: Verify visually. If DT rows collide with the next worker block, the form may need to use a "DT included in OT row" approach or a note field.

3. **Block spacing with 5 workers per page**
   - What we know: `blockSpacing = 92`, `subRowSpacing = 47`. Three sub-rows per worker: ST at stY, OT at stY-47, DT at stY-94. Block boundary from next worker: stY - 92.
   - What's unclear: With DT at stY-94 and next block starting at stY-92, DT row draws 2pt into the next worker's space. This may not be visible at size 6 but needs visual confirmation.
   - Recommendation: If DT overlaps, reduce `subRowSpacing` from 47 to 44 or `blockSpacing` from 92 to 96 (expand).

---

## Sources

### Primary (HIGH confidence)
- Direct inspection of `src/server/services/a1131Generator.ts` — all coordinate constants, CTM logic, page structure
- Direct inspection of `src/server/routes/export.ts` lines 258–365 — a1131 route implementation
- Direct inspection of `src/client/pages/PayrollWeekDetailPage.tsx` — CA button handlers, STATE_FORMS registry, disclosure modal
- Direct inspection of `tests/services/a1131.test.ts` — 7 passing tests confirmed
- Visual inspection of `assets/a1131-page1.png` — prior filled form screenshot
- `REQUIREMENTS.md` CA-02 specification
- `STATE.md` Phase 24 Pending Todos section

### Secondary (MEDIUM confidence)
- `assets/a1131-page2.png` — cert page appears blank (may be expected for template-only screenshot or may indicate coordinate issue)
- `24-03-PLAN.md` Task 3 — original browser verification spec (never executed)

---

## Metadata

**Confidence breakdown:**
- Generator code (a1131Generator.ts): HIGH — inspected directly
- Route code (export.ts): HIGH — inspected directly
- UI flow (PayrollWeekDetailPage.tsx): HIGH — inspected directly; routing bug found and documented
- Coordinate accuracy: LOW — pdfminer-derived constants exist but browser visual verification is the CA-02 requirement and has never been done
- Cert page rendering: LOW — blank screenshot is ambiguous; requires live verification

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (stable codebase; no external dependencies)
