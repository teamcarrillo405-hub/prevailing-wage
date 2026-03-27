---
phase: 27-design-elevation
verified: 2026-03-26T00:00:00Z
status: human_needed
score: 9/9 must-haves verified
re_verification: false
human_verification:
  - test: "Landing page hero renders visually with real photography"
    expected: "Full-bleed construction photography with dark overlay, white clamp-headline, transparent floating nav — no solid-color placeholder visible"
    why_human: "hero.webp is a 48-byte placeholder. CSS structure is wired but photo content requires user to drop in real Unsplash/Pexels WebP. Cannot verify image quality or visual appearance programmatically."
  - test: "Dashboard photo background strip renders visually"
    expected: "Subtle dark photo texture behind the 'Projects' PageHeader — not a plain #1a1a1a block"
    why_human: "dashboard-bg.webp is a 48-byte placeholder. CSS structure, overlay, and negative-margin bleed are all wired, but photo texture requires user replacement of placeholder file."
  - test: "Print preview produces clean white backgrounds"
    expected: "Ctrl+P in browser on both landing page and dashboard: no dark overlays, no photo backgrounds render — clean white layout"
    why_human: "Print CSS targeting .hero-bg and .dashboard-bg exists in index.css but browser print rendering cannot be verified programmatically."
  - test: "Card elevation depth is visually distinguishable"
    expected: "Dashboard ProjectCards cast noticeably deeper shadows (0 8px 24px rgba(0,0,0,0.12)) compared to standard cards on other pages"
    why_human: "shadow-card-elevated token is defined and applied — className wiring verified. Visual depth perception requires human eye on running app."
---

# Phase 27: Design Elevation Verification Report

**Phase Goal:** The app visual design matches HCC website quality — construction photography, dark gold gradients, and elevated card depth that distinguishes HCC from generic compliance software

**Verified:** 2026-03-26

**Status:** HUMAN_NEEDED — All automated checks PASS. 4 items require human visual confirmation.

**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Dashboard project cards have visibly deeper shadow than cards on other pages | ✓ VERIFIED | `DashboardPage.tsx:266` — `<ProjectCard ... className="shadow-card-elevated" />`. Token `--shadow-card-elevated: 0 8px 24px rgba(0,0,0,0.12)` defined in `index.css:36`. |
| 2  | HelpCallout has the same elevated shadow as dashboard project cards | ✓ VERIFIED | `HelpCallout.tsx:16` — `shadow-card-elevated` in className. |
| 3  | All page-title h1 elements use PageHeader — no raw h1 page titles remain outside PageHeader | ✓ VERIFIED | `grep -rn "<h1" src/client/pages/` (excluding Login/Register/Landing) returns zero results. All 7 pages confirmed: GsaRateBuilderPage, AdminStateWagePage, OtScenarioPage, PayrollWeekDetailPage, VarianceReportPage, UnionAllocationPage, WageLookupPage. |
| 4  | PageHeader h1 text has tighter letter-spacing than before | ✓ VERIFIED | `PageHeader.tsx:15` — `tracking-tight` in h1 className. |
| 5  | Landing page hero shows full-bleed construction photography with dark overlay | ✓ VERIFIED (structure) / ? HUMAN (photo content) | `LandingPage.tsx:16-24` — `hero-bg` class, inline `backgroundImage: "url('/images/hero.webp')"`, `bg-black/60` overlay with `aria-hidden="true"`. Image file exists but is a 48-byte placeholder. |
| 6  | Nav bar floats over the hero photo with transparent background on landing page only | ✓ VERIFIED | `LandingPage.tsx:29` — `<nav className="px-6 py-4 flex items-center justify-between">` inside `relative z-10` — no `bg-nav-dark`. `LandingNav` function completely removed. |
| 7  | Hero headline renders at clamp(56px, 8vw, 88px) in Oswald with tracking-tight | ✓ VERIFIED | `LandingPage.tsx:44-46` — h1 with `className="font-headline font-bold leading-tight mb-6 tracking-tight text-white"` and `style={{ fontSize: 'clamp(56px, 8vw, 88px)' }}`. |
| 8  | Dashboard page header area has a subtle dark photo background behind it | ✓ VERIFIED (structure) / ? HUMAN (photo content) | `DashboardPage.tsx:145-166` — `dashboard-bg` div, `backgroundImage: "url('/images/dashboard-bg.webp')"`, `bg-nav-dark/85` overlay, negative margin bleed `-mx-4 sm:-mx-6 lg:-mx-8`. HelpCallout is outside the wrapper (line 168). |
| 9  | Print preview shows no dark overlays — clean white background | ✓ VERIFIED (CSS) / ? HUMAN (browser render) | `index.css:49-56` — `@media print` block targets `.hero-bg` and `.dashboard-bg`, sets `background-image: none !important` and hides `.absolute` children. |

**Score:** 9/9 truths verified (4 require human visual confirmation for photo content / print behavior)

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/client/index.css` | shadow-card-elevated token and print CSS override | ✓ VERIFIED | Line 36: token defined. Lines 49-56: print CSS targets .hero-bg and .dashboard-bg. |
| `src/client/components/ui/PageHeader.tsx` | tracking-tight on h1 element | ✓ VERIFIED | Line 15: `tracking-tight` in h1 className. |
| `src/client/components/projects/ProjectCard.tsx` | className prop for external shadow injection | ✓ VERIFIED | Line 19: `className?: string` in interface. Line 51: `cn()` call merges className. No `hover:shadow-md` present. |
| `src/client/components/ui/HelpCallout.tsx` | elevated shadow on help callouts | ✓ VERIFIED | Line 16: `shadow-card-elevated` in className (replaced `shadow-card`). |

### Plan 02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/client/public/images/hero.webp` | Hero construction photography | ⚠️ PLACEHOLDER | File exists (48 bytes). Minimal valid WebP — no photo content. User must replace with real Unsplash photo. |
| `src/client/public/images/dashboard-bg.webp` | Dashboard header background photography | ⚠️ PLACEHOLDER | File exists (48 bytes). Same as above. |
| `src/client/pages/LandingPage.tsx` | Hero section with photo overlay + floating nav | ✓ VERIFIED | `hero-bg` class, inline backgroundImage, bg-black/60 overlay, transparent floating nav, clamp h1. LandingNav removed. |
| `src/client/pages/DashboardPage.tsx` | Dashboard header with photo background strip | ✓ VERIFIED | `dashboard-bg` div with full-bleed negative margins, overlay, PageHeader inside, HelpCallout outside. |

---

## Key Link Verification

### Plan 01 Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `DashboardPage.tsx` | `ProjectCard.tsx` | className prop passing `shadow-card-elevated` | ✓ WIRED | `DashboardPage.tsx:266` passes `className="shadow-card-elevated"` directly to ProjectCard. ProjectCard's `cn()` call merges it onto the button element. |

### Plan 02 Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `LandingPage.tsx` | `public/images/hero.webp` | CSS `background-image: url('/images/hero.webp')` | ✓ WIRED (path resolves) | `LandingPage.tsx:18` — inline style with correct path. File exists in `src/client/public/images/`. |
| `DashboardPage.tsx` | `public/images/dashboard-bg.webp` | CSS `background-image: url('/images/dashboard-bg.webp')` | ✓ WIRED (path resolves) | `DashboardPage.tsx:149` — inline style with correct path. File exists. |
| `index.css` | `LandingPage.tsx` | `@media print` targets `.hero-bg` class | ✓ WIRED | `index.css:49-52` — `.hero-bg` and `.dashboard-bg` selectors match classes applied in both pages. |

---

## Data-Flow Trace (Level 4)

Not applicable — this phase modifies static CSS design tokens, component classNames, and layout structure. No dynamic data rendering was added or changed. Existing data flows (project list, payroll data) are untouched.

---

## Behavioral Spot-Checks

Step 7b: SKIPPED for items requiring a running dev server. Build verification confirms structural correctness.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| shadow-card-elevated token defined | `grep "shadow-card-elevated" src/client/index.css` | Line 36: `--shadow-card-elevated: 0 8px 24px rgba(0,0,0,0.12)` | ✓ PASS |
| HelpCallout uses elevated shadow | `grep "shadow-card-elevated" HelpCallout.tsx` | Line 16: confirmed | ✓ PASS |
| Dashboard passes shadow to ProjectCard | `grep "shadow-card-elevated" DashboardPage.tsx` | Line 266: confirmed | ✓ PASS |
| No raw h1 page titles outside PageHeader | `grep -rn "<h1" src/client/pages/ \| grep -v Login\|Register\|Landing\|PageHeader` | No output | ✓ PASS |
| hero-bg class on HeroSection | `grep "hero-bg" LandingPage.tsx` | Line 16: confirmed | ✓ PASS |
| dashboard-bg class on Dashboard wrapper | `grep "dashboard-bg" DashboardPage.tsx` | Line 147: confirmed | ✓ PASS |
| Clamp headline in LandingPage | `grep "clamp(56px"` | Line 46: confirmed | ✓ PASS |
| Print CSS targets both classes | `grep -A6 "@media print" index.css` | Lines 49-56: `.hero-bg`, `.dashboard-bg` selectors confirmed | ✓ PASS |
| Commits exist in git log | `git log --oneline -5` | 11b48b7, a285176, 11f3839, c629f9f, f8f4cbe all present | ✓ PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DES-01 | 27-01 | App visual design elevated — card depth with elevated shadows | ✓ SATISFIED | `shadow-card-elevated` token defined; ProjectCard accepts className; DashboardPage passes elevated class; HelpCallout updated. |
| DES-02 | 27-02 | Landing page hero with full-bleed photography, Oswald clamp headline, and high-contrast CTA | ✓ SATISFIED (structure) / ? HUMAN (photo) | HeroSection rebuilt with photo overlay structure, clamp h1, floating transparent nav. Image files are placeholder — user action required for real photos. |
| DES-03 | 27-01 | Richer typography hierarchy — tighter letter-spacing on Oswald headlines | ✓ SATISFIED | `tracking-tight` added to PageHeader h1; all 7 raw h1 page titles migrated to PageHeader. Zero raw h1 page titles remain outside PageHeader (excluding Login/Register/Landing brand headings). |

All three requirement IDs from REQUIREMENTS.md (DES-01, DES-02, DES-03) are claimed by plans and have implementation evidence. No orphaned requirements found.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/client/public/images/hero.webp` | — | 48-byte placeholder file | ⚠️ Warning | Photo intent is not delivered. CSS structure is correct. User must replace with real Unsplash/Pexels WebP before production. Documented in SUMMARY. |
| `src/client/public/images/dashboard-bg.webp` | — | 48-byte placeholder file | ⚠️ Warning | Same as above. |

No code stubs, TODO comments, or hardcoded empty values were found in any of the 12 modified source files.

**Bonus fix noted:** SUMMARY documents that `text-[#F5C518]` hardcoded color values in VarianceReportPage and UnionAllocationPage were migrated to `text-brand-gold` during Plan 01 execution — correct CLAUDE.md compliance improvement.

---

## Human Verification Required

### 1. Hero Photography Visible

**Test:** Replace `src/client/public/images/hero.webp` with a real construction photo (e.g., "highway bridge construction aerial dark" from Unsplash, 1920px width, converted to WebP under 150KB). Start dev server (`npm run dev`). Open http://localhost:5173. Verify the hero section displays the photo behind the dark overlay.

**Expected:** Dark-toned construction/infrastructure photography fills the hero viewport, dark overlay (`bg-black/60`) makes white headline text readable, gold "HCC Prevailing Wage" logo and "Log In" link float above with transparent nav bar.

**Why human:** Image file content (the actual photo) cannot be verified programmatically. CSS structure is confirmed wired.

### 2. Dashboard Photo Strip Visible

**Test:** Replace `src/client/public/images/dashboard-bg.webp` with a real construction photo (e.g., "construction site steel workers" from Unsplash, 1920px width, WebP under 100KB). Log in and navigate to Dashboard. Verify the "Projects" PageHeader area shows a subtle photo background strip.

**Expected:** Subtle dark photo texture behind the "Projects" heading across full width, 85% dark overlay makes text readable, HelpCallout below the strip is on plain white background.

**Why human:** Photo content cannot be verified programmatically. CSS structure and wiring are confirmed.

### 3. Print Preview Clean Backgrounds

**Test:** On the landing page and dashboard, open browser print preview (Ctrl+P). Verify no dark photo overlays print.

**Expected:** Both pages show clean white backgrounds in print preview — no dark overlays, no photo areas. Normal content prints normally.

**Why human:** Browser print rendering cannot be tested programmatically without a headless browser.

### 4. Card Elevation Depth Visually Distinguishable

**Test:** Log in, navigate to Dashboard. Observe ProjectCard shadows. Navigate to another page with standard cards. Compare shadow depth.

**Expected:** Dashboard ProjectCards visibly cast a deeper, more prominent shadow (`0 8px 24px rgba(0,0,0,0.12)`) compared to standard `shadow-card` elements on other pages.

**Why human:** Shadow depth perception requires visual confirmation — CSS token and className wiring are verified but visual effect depends on rendering context.

---

## Gaps Summary

No automated gaps found. All must-have artifacts exist, are substantive, and are properly wired. The only open items are the two placeholder image files — these are intentional, documented stubs that cannot be auto-replaced (require manual photo sourcing). The CSS infrastructure to display those photos is fully wired and verified.

**User action required before production:**
- Replace `src/client/public/images/hero.webp` — search "highway bridge construction aerial dark" on Unsplash, download 1920px, convert to WebP under 150KB
- Replace `src/client/public/images/dashboard-bg.webp` — search "construction site steel workers" on Unsplash, download 1920px, convert to WebP under 100KB

---

_Verified: 2026-03-26_
_Verifier: Claude (gsd-verifier)_
