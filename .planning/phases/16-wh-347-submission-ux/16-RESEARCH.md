# Phase 16: WH-347 Submission UX - Research

**Researched:** 2026-03-22
**Domain:** React client-side state management, fetch-driven file download, modal/dialog UX
**Confidence:** HIGH

---

## Summary

Phase 16 adds two UI behaviors to the WH-347 download anchor in `PayrollWeekDetailPage.tsx`: a preflight compliance modal (WH-01) and a generating/ready state with double-click prevention (WH-02). Both features are entirely client-side. No server changes are required — the existing `GET /api/export/wh347/:weekId` endpoint and `GET /api/compliance/:weekId` endpoint already provide everything needed.

The central architectural challenge is that the WH-347 download is currently a plain `<a href>` anchor. This pattern cannot support either requirement: it fires immediately with no chance to intercept, and it cannot show a loading state. The anchor must be replaced with a `<button>` that calls `fetch()` directly, constructs a Blob URL, and programmatically clicks a hidden `<a>` to trigger the download. This is the standard pattern for authenticated fetch-driven downloads and is already used widely in the React ecosystem.

The compliance data for the modal is already fetched by `PayrollWeekDetailPage` via `useQuery(['compliance', weekId])`. The modal can read directly from that cached query result rather than making a second network call. This makes the preflight check instant once the page loads.

**Primary recommendation:** Replace the `<a>` anchor with a `<button onClick={handleDownload}>`, manage `generating` and `showPreflight` with `useState`, reuse existing `complianceData` from the already-loaded query, and compose the modal with existing Card/Button/Badge primitives.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WH-01 | When violations exist, clicking "Download WH-347" opens a preflight modal listing each violation (worker name, type, delta amount) with "Download Anyway" and cancel actions | Compliance data already in `complianceData` from existing `useQuery(['compliance', weekId])` — no new endpoint needed; modal composed from Card/Button/Badge primitives |
| WH-02 | Download button shows "Generating..." while in-flight, returns to normal label after download begins — prevents double-clicks | `useState<boolean>` for `generating` flag + `disabled={generating}` on button; fetch-driven Blob download replaces plain anchor |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React `useState` | (project React version) | `generating` flag and `showPreflight` modal open state | Built-in — no dependency |
| React `useRef` | (project React version) | Hidden `<a>` element reference for programmatic download trigger | Built-in — only way to trigger download from JS blob URL |
| `fetch` (browser) | native | Replace `<a href>` with an authenticated fetch that constructs a Blob URL | Required for loading state + double-click guard |
| TanStack Query `useQuery` | (project version) | Compliance data already fetched — consume from cache | Already used on page; no new queries needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Existing `Badge` primitive | Phase 11 | Render violation type labels in modal | All violation type displays already use Badge |
| Existing `Button` primitive | Phase 11 | Modal action buttons (Download Anyway, Cancel) | All interactive buttons use Button primitive |
| Existing `Card` primitive | Phase 11 | Modal body container | Consistent surface treatment |
| `cn` utility | (project) | Class composition in modal | Already imported everywhere |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Fetch + Blob URL | `<a href>` with URL manipulation | Anchor pattern cannot produce loading state or double-click guard — not viable |
| Inline modal (portal-less) | Headless UI Dialog / Radix Dialog | No dialog library is installed; a fixed overlay with z-index is sufficient for a single modal; avoids adding a dependency |
| Re-querying compliance on click | Using cached `complianceData` | Re-querying on click adds unnecessary latency; cached data is current (fetched on page load) |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Component Structure

The preflight modal and download logic live entirely inside `PayrollWeekDetailPage.tsx`. No new file is needed — the component is already large enough to absorb this, and the modal is single-use.

```
PayrollWeekDetailPage.tsx
  ├── existing: useQuery(['compliance', weekId])  ← already fetched
  ├── new: useState generating = false
  ├── new: useState showPreflight = false
  ├── new: useRef hiddenAnchorRef
  ├── new: handleDownloadClick()  ← checks violations, opens modal or fetches directly
  ├── new: handleConfirmedDownload()  ← fetch → Blob → trigger anchor
  ├── existing: <a> anchor  → replaced with <button>
  └── new: PreflightModal (inline JSX, conditionally rendered)
```

### Pattern 1: Fetch-Driven Blob Download

**What:** Replace `<a href="/api/export/wh347/:weekId">` with a button that calls `fetch()`, receives the PDF as a `Blob`, creates an object URL, and programmatically clicks a hidden `<a>`.

**When to use:** Any time a download must show a loading state, require confirmation, or prevent double submission.

**Example:**
```typescript
// Pattern established in Phase 07 decision log:
// "WH-347 download is a plain <a href> anchor — browser handles Content-Disposition attachment natively"
// Phase 16 explicitly supersedes this by converting to fetch-driven download.

const hiddenAnchorRef = useRef<HTMLAnchorElement>(null);
const [generating, setGenerating] = useState(false);

async function handleConfirmedDownload() {
  if (generating) return;           // double-click guard
  setGenerating(true);
  setShowPreflight(false);
  try {
    const res = await fetch(`/api/export/wh347/${weekId}`, { credentials: 'include' });
    if (!res.ok) throw new Error('PDF generation failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = hiddenAnchorRef.current!;
    a.href = url;
    a.download = `wh347-${weekId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);       // free memory after click
  } finally {
    setGenerating(false);
  }
}
```

### Pattern 2: Preflight Modal (Portal-Less Overlay)

**What:** A fixed-position overlay rendered inline in JSX, visible only when `showPreflight === true`. Uses existing Card/Button/Badge primitives.

**When to use:** Single confirmation dialog where no library dependency is warranted.

```typescript
// Inline modal — no portal needed for a single-instance overlay
{showPreflight && (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
    <Card className="max-w-lg w-full mx-4">
      <h2 className="text-base font-headline text-gray-900 mb-3">
        Compliance Violations Detected
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        This payroll week has the following violations. You may still download the WH-347,
        but these issues will be reflected in the certification checkboxes.
      </p>
      <ul className="space-y-2 mb-6">
        {complianceData!.violations.map((v, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
            <Badge variant="violation" className="mt-0.5 shrink-0">
              {violationLabel(v.violationType)}
            </Badge>
            <span>
              <span className="font-medium">{v.workerName}</span>
              {': delta $'}{v.delta.toFixed(2)}
            </span>
          </li>
        ))}
        {complianceData!.weekViolations?.map((wv, i) => (
          <li key={`wv-${i}`} className="flex items-start gap-2 text-sm text-gray-700">
            <Badge variant="violation" className="mt-0.5 shrink-0">Apprentice Ratio</Badge>
            <span>{wv.detail}</span>
          </li>
        ))}
      </ul>
      <div className="flex gap-3 justify-end">
        <Button variant="ghost" size="sm" onClick={() => setShowPreflight(false)}>
          Cancel
        </Button>
        <Button variant="secondary" size="sm" onClick={handleConfirmedDownload}>
          Download Anyway
        </Button>
      </div>
    </Card>
  </div>
)}
```

### Pattern 3: Download Click Handler (Decides: Modal or Direct)

```typescript
function handleDownloadClick() {
  const hasViolations = complianceData?.hasViolations ?? false;
  if (hasViolations) {
    setShowPreflight(true);   // WH-01: show preflight modal
  } else {
    handleConfirmedDownload(); // WH-02: go directly to fetch
  }
}
```

### Anti-Patterns to Avoid

- **Calling `fetch()` from `handleDownloadClick` directly before checking violations:** The generating state gets set before the modal decision is made. Separate the "decide" step (handleDownloadClick) from the "execute" step (handleConfirmedDownload).
- **Not revoking the Blob URL:** `URL.createObjectURL()` leaks memory if not revoked. Always call `URL.revokeObjectURL(url)` after `a.click()`. A short `setTimeout(() => URL.revokeObjectURL(url), 100)` is the safer pattern — gives the browser time to initiate the download before the URL is freed.
- **Using `disabled` attribute only:** `disabled` prevents clicks but a programmatic `element.click()` call can still fire. The `if (generating) return;` guard inside the handler is the true double-click prevention.
- **Rendering the hidden anchor inside the modal:** The hidden `<a ref={hiddenAnchorRef}>` must be outside the modal so it persists when the modal is unmounted (for the direct-download / no-violations path).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fetching compliance on modal open | Second useQuery or manual fetch | Consume `complianceData` from the already-loaded query | TanStack Query caches it; zero latency |
| Violation type display in modal | Custom label logic | Existing `violationLabel()` function already in the file | Already handles 'under-wage' and 'cwhssa-ot' |
| Modal backdrop | Custom CSS animation class | `bg-black/40` Tailwind opacity utility | Already available via TailwindCSS v4 |
| Download button disabled state | Custom opacity CSS | Button primitive's `disabled:opacity-50 disabled:cursor-not-allowed` | Already in Button.tsx |

**Key insight:** Every building block is already in place. The full implementation is pure UI wiring — no new endpoints, no new primitives, no new libraries.

---

## Common Pitfalls

### Pitfall 1: Memory Leak from Unreleased Blob URL
**What goes wrong:** `URL.createObjectURL(blob)` creates a reference in browser memory that persists until the page unloads or you explicitly revoke it.
**Why it happens:** Easy to forget; the download appears to work fine.
**How to avoid:** `setTimeout(() => URL.revokeObjectURL(url), 100)` after `a.click()`. The 100ms delay gives the browser time to register the download before the URL is invalidated.
**Warning signs:** Memory usage grows on repeat downloads in the same session.

### Pitfall 2: Double-Click Fires Two PDF Requests
**What goes wrong:** User clicks twice quickly while the generating state is being set; React batches state updates so two clicks both pass the guard.
**Why it happens:** `useState` setter is async — the first `setGenerating(true)` may not have propagated by the time the second click handler runs.
**How to avoid:** Use `useRef` for the "in-flight" guard in addition to (or instead of) state: `const generatingRef = useRef(false)`. Check and set synchronously: `if (generatingRef.current) return; generatingRef.current = true;`. Reset in `finally`. The visual state (`generating` useState) can mirror this for UI display.
**Warning signs:** Two simultaneous network requests visible in DevTools network tab.

### Pitfall 3: Modal Not Showing All Three Violation Types
**What goes wrong:** Modal only renders `complianceData.violations` (entry-level) and omits `complianceData.weekViolations` (apprentice ratio).
**Why it happens:** The apprentice-ratio violation lives in `weekViolations`, not `violations` — easy to miss.
**How to avoid:** Render both arrays in the modal list, exactly as `PayrollWeekDetailPage` already does in the compliance panel below the entries table. The existing rendering pattern is the reference.
**Warning signs:** Apprentice ratio violations show in the compliance panel but not the preflight modal.

### Pitfall 4: Modal Blocked by No-Violations Path Going Through Modal State
**What goes wrong:** `showPreflight` gets set to `true` even when there are no violations.
**Why it happens:** Missing the `hasViolations` guard in `handleDownloadClick`.
**How to avoid:** Explicitly check `complianceData?.hasViolations === true` before setting `showPreflight(true)`.

### Pitfall 5: `complianceData` is Null When Download Clicked Too Fast
**What goes wrong:** User clicks download before the compliance query finishes loading.
**Why it happens:** `complianceData` from useQuery can be undefined during initial load.
**How to avoid:** When `complianceData` is not yet loaded, treat as "no violations" (same as the existing `?? true` pattern used in export.ts). The download proceeds directly — worst case the user skips the modal on a slow connection.

---

## Code Examples

### Current Download Anchor (to be replaced)
```typescript
// src/client/pages/PayrollWeekDetailPage.tsx — lines 148-155
// Phase 07 decision: "plain <a href> anchor — browser handles Content-Disposition attachment natively"
// Phase 16 converts this to fetch-driven download.
{weekId && (
  <a
    href={`/api/export/wh347/${weekId}`}
    className="inline-flex items-center justify-center text-xs px-3 py-1.5 font-semibold rounded-sm border border-brand-gold text-brand-gold hover:bg-brand-gold/10 transition-colors duration-150"
  >
    Download WH-347
  </a>
)}
```

### Compliance Endpoint Already Exposed
```typescript
// GET /api/compliance/:weekId — src/server/routes/compliance.ts, line 47
// Returns: ComplianceResult { violations[], weekViolations[], hasViolations, ... }
// Already consumed by PayrollWeekDetailPage useQuery(['compliance', weekId])
// No new endpoint needed for Phase 16.
```

### violationLabel() Function Already in File
```typescript
// PayrollWeekDetailPage.tsx — lines 84-87
function violationLabel(type: 'under-wage' | 'cwhssa-ot'): string {
  if (type === 'under-wage') return 'Under-Wage';
  return 'CWHSSA OT Error';
}
// Re-use for modal labels — do not duplicate.
```

### Button Primitive Disabled Pattern
```typescript
// src/client/components/ui/Button.tsx
// 'disabled:opacity-50 disabled:cursor-not-allowed' already in base classes.
<Button
  variant="secondary"
  size="sm"
  disabled={generating}
  onClick={handleDownloadClick}
>
  {generating ? 'Generating...' : 'Download WH-347'}
</Button>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `<a href>` for file download | `fetch()` + Blob URL + programmatic anchor click | Phase 16 | Enables loading state and double-click guard |
| No download confirmation | Preflight modal with violation list | Phase 16 | Closes WH-01 compliance feedback gap |

**Superseded decision:**
- [Phase 07] "WH-347 download is a plain `<a href>` anchor — browser handles Content-Disposition attachment natively" — superseded by Phase 16 requirements. The fetch-driven pattern is now correct.

---

## Open Questions

1. **Should `generating` use useRef or useState for double-click guard?**
   - What we know: `useState` update is async and may not prevent rapid double-clicks; `useRef` is synchronous.
   - What's unclear: Whether React's batched event handling makes double-click with `useState` a real problem in practice for a slow network request trigger.
   - Recommendation: Use both — `useRef` for the synchronous guard (correct behavior), `useState` for the visual label change (correct display). Cost is two lines.

2. **Modal keyboard accessibility (Escape to close, focus trap)**
   - What we know: No dialog library is installed. A portal-less overlay will not auto-trap focus or respond to Escape.
   - What's unclear: Whether the project has accessibility requirements beyond basic WCAG.
   - Recommendation: Add `onKeyDown` handler on the overlay for Escape close and `autoFocus` on the Cancel button. This is 3 lines and covers the minimum. Full focus trap is not required for this milestone.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (vitest.config.ts) |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` (vitest run) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WH-01 | Preflight modal opens when violations exist, lists all violations, dismisses on cancel | Manual browser verification | N/A — no JSDOM/RTL in project | Manual |
| WH-02 | Button shows "Generating..." during fetch, returns to label after download, blocks double-click | Manual browser verification | N/A | Manual |

**Note on test scope:** The project's Vitest setup targets `environment: 'node'` and uses supertest for route tests. There is no React Testing Library or JSDOM configured — client component tests are not part of this project's test suite. Both WH-01 and WH-02 are verified by browser manual testing, consistent with Phase 07 and Phase 08 browser verification precedent in STATE.md.

Server-side: No server changes means no new route tests needed. The existing `tests/routes/compliance.test.ts` covers the compliance endpoint that the modal reads from.

### Sampling Rate
- **Per task commit:** `npm test` (full suite — fast, node only)
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green + manual browser verification of both WH-01 and WH-02 behaviors

### Wave 0 Gaps
None — existing test infrastructure covers all phase requirements. Phase 16 is client-only UI work with no new server endpoints or services.

---

## Sources

### Primary (HIGH confidence)
- Direct source inspection: `src/client/pages/PayrollWeekDetailPage.tsx` — download anchor location, compliance query pattern, existing violation rendering
- Direct source inspection: `src/server/routes/export.ts` — `GET /api/export/wh347/:weekId` endpoint behavior, Content-Disposition attachment header
- Direct source inspection: `src/server/routes/compliance.ts` — `GET /api/compliance/:weekId` endpoint response shape
- Direct source inspection: `src/server/services/complianceService.ts` — `ComplianceResult`, `ComplianceViolation`, `WeekViolation` type shapes
- Direct source inspection: `src/client/components/ui/Button.tsx`, `Card.tsx`, `Badge.tsx` — available primitives and their props
- Direct source inspection: `src/client/index.css` — design tokens (colors, fonts, radius)
- `.planning/STATE.md` — Phase 07 decision confirming plain anchor, Phase 16 research flag on anchor conversion
- `.planning/REQUIREMENTS.md` — WH-01, WH-02 exact acceptance criteria

### Secondary (MEDIUM confidence)
- MDN Web API: `URL.createObjectURL()` / `URL.revokeObjectURL()` — standard Blob download pattern, well established
- React `useRef` pattern for synchronous in-flight guards — standard React community pattern

### Tertiary (LOW confidence)
None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in codebase, verified by direct file inspection
- Architecture: HIGH — all data shapes and endpoints verified by direct source reading; pattern is standard fetch+Blob
- Pitfalls: HIGH — double-click race condition and Blob URL leak are well-known, Blob URL revoke timing confirmed by MDN pattern

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable — no external dependencies changing)
