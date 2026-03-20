---
phase: 12-app-shell-global-layout
verified: 2026-03-20T19:00:00Z
status: passed
score: 10/10 must-haves verified
re_verification: false
human_verification:
  - test: "Visual nav color check"
    expected: "Nav bar renders as #1a1a1a dark background with #F5C518 gold bottom border on every protected page"
    why_human: "Tailwind v4 custom token resolution cannot be confirmed via static analysis — bg-nav-dark must resolve to #1a1a1a at runtime"
  - test: "Typography hierarchy spot-check"
    expected: "All h1/h2/h3/h4 elements render in Oswald; body text renders in Inter"
    why_human: "Font loading depends on runtime font stack resolution, not statically verifiable"
  - test: "Card visual consistency check"
    expected: "All card sections (ProjectDetail info, Workers blocks, PayrollList container, PayrollWeekDetail tables) appear visually identical in border-radius and border color"
    why_human: "Visual regression requires browser rendering — human sign-off was documented as approved in SUMMARY-03"
---

# Phase 12: App Shell + Global Layout — Verification Report

**Phase Goal:** Every protected page shares the same dark nav with gold accent, Oswald/Inter typography hierarchy, and uniform card-based spacing — without touching each page individually.
**Verified:** 2026-03-20T19:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every protected page shows a dark (#1a1a1a) nav bar — no white or gray-900 nav visible | VERIFIED | `Layout.tsx:21` — `bg-nav-dark`; token `--color-nav-dark: #1a1a1a` in `index.css:11` |
| 2 | The nav bottom border displays gold (#F5C518) on every protected page | VERIFIED | `Layout.tsx:21` — `border-brand-gold`; token `--color-brand-gold: #F5C518` in `index.css:6` |
| 3 | Hovering the 'HCC Prevailing Wage' nav link turns the text gold | VERIFIED | `Layout.tsx:23` — `hover:text-brand-gold` on Link element |
| 4 | DashboardPage shows 'Projects' as a page title rendered via PageHeader (h1, Oswald font) | VERIFIED | `DashboardPage.tsx:35-42` — `<PageHeader title="Projects" action={...}>`; PageHeader renders `<h1 className="font-headline text-2xl ...">` |
| 5 | ProjectDetailPage shows the project name as a page title rendered via PageHeader (h1, Oswald font) | VERIFIED | `ProjectDetailPage.tsx:57-60` — `<PageHeader title={project.name} subtitle={...}>` |
| 6 | DashboardPage 'New Project' button appears right-aligned in the PageHeader action slot | VERIFIED | `DashboardPage.tsx:37-41` — `<Button onClick={() => setShowForm(true)}>New Project</Button>` passed as `action` prop |
| 7 | ProjectDetailPage project info section renders inside the Card primitive | VERIFIED | `ProjectDetailPage.tsx:62-89` — `<Card className="max-w-lg">` wraps the `<dl>` info list |
| 8 | PayrollWeekDetailPage entry table, empty state, and compliance panel render inside Card primitives | VERIFIED | Lines 157, 219, 226 — three `<Card padding="none">` instances present |
| 9 | WorkersPage individual worker blocks render inside Card primitives | VERIFIED | `WorkersPage.tsx:256` — `<Card key={w.id} padding="sm">` inside `.map()`; add-worker form at line 467 uses `<Card>` |
| 10 | ProjectCard hover border uses brand-gold token (not hardcoded #F5C518) | VERIFIED | `ProjectCard.tsx:48` — `hover:border-brand-gold` confirmed; no `hover:border-[#F5C518]` present |

**Score:** 10/10 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/client/components/shared/Layout.tsx` | Shared Layout with brand-token nav | VERIFIED | Contains `bg-nav-dark border-brand-gold hover:text-brand-gold` on nav element at line 21 |
| `src/client/pages/DashboardPage.tsx` | Dashboard with PageHeader primitive | VERIFIED | Imports PageHeader and Button; renders `<PageHeader title="Projects" action={...}>` at line 35 |
| `src/client/pages/ProjectDetailPage.tsx` | Project detail with PageHeader + Card primitive | VERIFIED | Imports both PageHeader and Card; both are used in render |
| `src/client/pages/PayrollWeekDetailPage.tsx` | Week summary and entry table sections in Card | VERIFIED | Imports Card; three Card instances present (entries table, empty state, compliance panel) |
| `src/client/pages/WorkersPage.tsx` | Worker blocks using Card primitive | VERIFIED | Imports Card; worker list items use `<Card padding="sm">`, add-worker form uses `<Card>` |
| `src/client/pages/PayrollListPage.tsx` | Payroll weeks container using Card primitive | VERIFIED | Imports Card; `<Card padding="none" className="divide-y divide-gray-100">` at line 78 |
| `src/client/components/projects/ProjectCard.tsx` | ProjectCard hover border using brand-gold token | VERIFIED | Line 48: `hover:border-brand-gold` — no hardcoded hex hover border present |
| `src/client/index.css` | @theme tokens: --color-nav-dark, --color-brand-gold | VERIFIED | Lines 6, 11 — both tokens defined; --font-headline and --font-body also present; h1-h4 global Oswald rule at line 43 |
| `src/client/components/ui/PageHeader.tsx` | PageHeader primitive with h1, font-headline | VERIFIED | Substantive component: renders `<h1 className="font-headline text-2xl text-text-primary">` with subtitle and action slots |
| `src/client/components/ui/Card.tsx` | Card primitive with padding variants | VERIFIED | Substantive component: uses `bg-surface-card rounded-card shadow-card border border-border-default` with three padding variants |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `Layout.tsx` | `index.css @theme` | `bg-nav-dark` Tailwind token resolution | VERIFIED | Token `--color-nav-dark: #1a1a1a` defined in @theme; class `bg-nav-dark` present in nav element |
| `Layout.tsx` | `index.css @theme` | `border-brand-gold` Tailwind token resolution | VERIFIED | Token `--color-brand-gold: #F5C518` defined in @theme; class `border-brand-gold` present in nav element |
| `Layout.tsx` | `index.css @theme` | `hover:text-brand-gold` Tailwind token resolution | VERIFIED | Token confirmed; class present on Link element |
| `DashboardPage.tsx` | `PageHeader.tsx` | `import { PageHeader }` + JSX usage | VERIFIED | Line 8: `import { PageHeader } from '../components/ui/PageHeader'`; rendered at line 35 |
| `DashboardPage.tsx` | `Button.tsx` | `import { Button }` + action slot usage | VERIFIED | Line 9: `import { Button } from '../components/ui/Button'`; rendered inside PageHeader action prop |
| `ProjectDetailPage.tsx` | `PageHeader.tsx` | `import { PageHeader }` + JSX usage | VERIFIED | Line 6: import present; rendered at line 57 with title and subtitle props |
| `ProjectDetailPage.tsx` | `Card.tsx` | `import { Card }` + JSX usage | VERIFIED | Line 7: import present; rendered at line 62 wrapping project info dl |
| `PayrollWeekDetailPage.tsx` | `Card.tsx` | `import Card` | VERIFIED | Line 8: import present; three Card usages at lines 157, 219, 226 |
| `WorkersPage.tsx` | `Card.tsx` | `import Card` | VERIFIED | Line 9: import present; worker list Card (padding="sm") and add-worker form Card both present |
| `PayrollListPage.tsx` | `Card.tsx` | `import Card` | VERIFIED | Line 8: import present; Card used at line 78 |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SHELL-01 | 12-01-PLAN.md | Dark nav (#1a1a1a) with gold accent (#F5C518) present on every protected page — no page uses a white or default nav | SATISFIED | Layout.tsx nav uses `bg-nav-dark` (resolves to #1a1a1a) and `border-brand-gold` (resolves to #F5C518); all protected pages wrapped in Layout |
| SHELL-02 | 12-02-PLAN.md | Typography hierarchy enforced globally — Oswald for page titles and section headers, Inter for body text, labels, table data | SATISFIED | Global rule in index.css `@layer base` sets h1-h4 to font-headline (Oswald) and body to font-body (Inter); DashboardPage and ProjectDetailPage use PageHeader (h1) primitive; remaining pages use raw h1 elements but Oswald is applied globally via the CSS rule |
| SHELL-03 | 12-03-PLAN.md | Consistent card-based layout with uniform spacing tokens across all pages | SATISFIED | Card primitive adopted in ProjectDetailPage, PayrollWeekDetailPage, WorkersPage, PayrollListPage; ProjectCard hover uses brand-gold token; Card uses `bg-surface-card rounded-card shadow-card border border-border-default` — uniform across all instances |

**Orphaned requirements check:** REQUIREMENTS.md maps SHELL-01, SHELL-02, SHELL-03 to Phase 12. All three are claimed in plans 01, 02, 03 respectively. No orphaned requirements.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `ProjectDetailPage.tsx` | 72 | `bg-[#F5C518]` on funding type badge span | Info | Hardcoded brand hex on a badge — not a card container. Phase 14 (PAGE-01) scope. Does not block phase goal. |
| `WorkersPage.tsx` | 298 | `bg-[#F5C518]` on Save Changes button | Info | Hardcoded brand hex on inline action button — not within SHELL-03 card container scope. Phase 14 scope. |
| `WorkersPage.tsx` | 569 | `bg-[#F5C518]` on Add Worker submit button | Info | Same as above — inline form button, Phase 14 scope. |
| `ProjectCard.tsx` | 62 | `bg-[#F5C518]` on funding type badge span | Info | Hardcoded brand hex on badge inside ProjectCard — not the hover border (which was correctly migrated). Phase 14 scope. |
| `WorkersPage.tsx` | 228 | Raw `h1` with `text-gray-900 font-headline` — not using PageHeader | Info | SHELL-02 plan explicitly scoped to DashboardPage + ProjectDetailPage. Global Oswald rule applies. Phase 14 (PAGE polish) will address remaining pages. |
| `PayrollListPage.tsx` | 47 | Raw `h1` with `text-gray-900 font-headline` — not using PageHeader | Info | Same as above — Phase 14 scope. |
| `PayrollWeekDetailPage.tsx` | 129 | Raw `h1` with `text-gray-900 font-headline` — not using PageHeader | Info | Same as above — Phase 14 scope. |

**Blocker anti-patterns:** None.
**Warning anti-patterns:** None (all Info level — known Phase 14 scope items).

---

### Human Verification Required

### 1. Nav Color Rendering

**Test:** Log in and view the Dashboard. Inspect nav background with browser devtools color picker.
**Expected:** Nav background renders as #1a1a1a (not #111827 gray-900); bottom border renders as #F5C518 gold.
**Why human:** Tailwind v4 custom property resolution requires runtime browser rendering to confirm token values resolve correctly.

### 2. Typography Hierarchy

**Test:** Navigate across Dashboard, ProjectDetail, Workers, PayrollList, PayrollWeekDetail pages.
**Expected:** All page titles and h1-h4 headings render in Oswald; all body text, labels, and table content render in Inter.
**Why human:** Font stack resolution depends on network font loading (Google Fonts / local) and cannot be verified statically.

### 3. Card Visual Consistency

**Test:** Open ProjectDetail, Workers, PayrollList, and PayrollWeekDetail. Compare card containers across pages.
**Expected:** All card sections show identical border-radius (~8px), identical subtle border (light gray), and identical shadow. No page shows a raw div that appears different from the Card primitive.
**Why human:** Visual regression requires browser rendering. Note: human sign-off was already documented as "approved" in 12-03-SUMMARY.md checkpoint task.

---

### Gaps Summary

No gaps found. All 10 must-have truths are verified. All three requirement IDs (SHELL-01, SHELL-02, SHELL-03) are satisfied.

The four `bg-[#F5C518]` hardcoded hex instances remaining in badge spans and action buttons are intentionally deferred to Phase 14 (Page-by-Page Polish) per the plan — they are in-scope for PAGE-01 through PAGE-07, not SHELL-03. The three raw `h1` patterns on WorkersPage, PayrollListPage, and PayrollWeekDetailPage are also Phase 14 scope; Oswald typography is globally enforced via `@layer base`, so the requirement is met even without PageHeader on those pages.

---

_Verified: 2026-03-20T19:00:00Z_
_Verifier: Claude (gsd-verifier)_
