---
phase: 27-design-elevation
plan: "02"
subsystem: client-ui
status: complete
tags:
  - photography
  - hero
  - dashboard
  - design-elevation
  - landing-page
dependency_graph:
  requires:
    - 27-01 (print CSS for .hero-bg and .dashboard-bg, shadow-card-elevated token)
  provides:
    - Full-bleed hero section with photo overlay on LandingPage
    - Dashboard PageHeader photo background strip
    - Placeholder WebP assets in public/images/
  affects:
    - src/client/pages/LandingPage.tsx
    - src/client/pages/DashboardPage.tsx
    - src/client/public/images/
tech_stack:
  added: []
  patterns:
    - "CSS background-image via inline style for Vite static asset serving"
    - "Negative margin full-bleed: -mx-4 sm:-mx-6 lg:-mx-8 matching Layout.tsx responsive padding"
    - "TailwindCSS v4 descendant selector [&_h1]:text-white"
    - "clamp() for fluid responsive typography via inline style"
key_files:
  created:
    - src/client/public/images/hero.webp (placeholder — user must replace)
    - src/client/public/images/dashboard-bg.webp (placeholder — user must replace)
  modified:
    - src/client/pages/LandingPage.tsx
    - src/client/pages/DashboardPage.tsx
decisions:
  - "Placeholder WebP files created as 48-byte minimal valid WebP; user must replace with real Unsplash/Pexels construction photography before production"
  - "LandingNav function removed; nav markup inlined inside HeroSection z-10 container for D-09 floating nav"
  - "dashboard-bg wrapper uses -mt-8 pt-8 to consume Layout.tsx py-8 top padding and restore it inside the strip"
metrics:
  duration: "~15min total (Tasks 1+2: 6min auto; Task 3: checkpoint)"
  completed: "2026-03-27"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 4
requirements:
  - DES-02
---

# Phase 27 Plan 02: Photography and Hero Elevation Summary

One-liner: Full-bleed hero with photo overlay, floating transparent nav, and clamp(56px,8vw,88px) Oswald headline; dashboard PageHeader wrapped in a dark photo strip using placeholder WebPs.

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Create placeholder WebPs, rewrite HeroSection | 11b48b7 | Done |
| 2 | Add dashboard photo background strip | a285176 | Done |
| 3 | Visual verification — user approved | — | Done (approved) |

## What Was Built

### Task 1 — Hero Section with Photo Overlay

- Removed `LandingNav` as a standalone component — its markup is now inlined inside `HeroSection`'s `relative z-10` container (floating transparent nav per D-09)
- `HeroSection` is now a full-viewport section (`min-h-screen flex flex-col`) with:
  - `hero-bg` class targeting Plan 01 print CSS
  - Inline `backgroundImage: "url('/images/hero.webp')"` served from Vite public dir
  - `bg-black/60` dark overlay div with `aria-hidden="true"` per D-06
  - All content wrapped in `relative z-10` so it sits above the overlay
  - h1 at `clamp(56px, 8vw, 88px)` via inline style (Tailwind v4 doesn't support `clamp()` without arbitrary values)
  - h1 className includes `tracking-tight text-white font-headline font-bold`
- `LandingPage` render updated: `<LandingNav />` removed, `<HeroSection />` first

### Task 2 — Dashboard Photo Strip

- `PageHeader` in `DashboardPage.tsx` wrapped in a `dashboard-bg` div
- Full-bleed negative margins (`-mx-4 sm:-mx-6 lg:-mx-8`) match Layout.tsx responsive padding
- `px-4 sm:px-6 lg:px-8` restores content alignment within the bleed
- `-mt-8 pt-8` pulls strip flush to top of Layout main content, then restores padding inside
- `bg-nav-dark/85` (85% opacity) overlay — dark enough for legibility, subtle photo texture visible
- `[&_h1]:text-white` Tailwind v4 descendant selector ensures white title text
- `HelpCallout` remains outside the wrapper in normal page flow

### Task 3 — Visual Verification (User Approved)

User confirmed the following in browser:
- Hero section renders with photo background (placeholder), dark overlay, floating transparent nav, and large white Oswald headline
- Dashboard "Projects" PageHeader area shows the dark photo background strip
- Non-landing pages retain normal `bg-nav-dark` nav bar
- Print preview shows clean white backgrounds — no dark overlays printed

### Placeholder Images

Both `hero.webp` and `dashboard-bg.webp` are 48-byte minimal valid WebP placeholders. The CSS background-image resolves (no 404), but no photo is visible until the user replaces them.

**User action required:** Replace placeholders with real construction photography:
- **hero.webp**: Search "highway bridge construction aerial dark" on Unsplash. Select a dark-toned infrastructure/bridge scene. Download at 1920px width. Convert to WebP, target under 150KB.
- **dashboard-bg.webp**: Search "construction site steel workers" on Unsplash. Select a darker construction scene. Download at 1920px width. Convert to WebP, target under 100KB.

Place files in `src/client/public/images/` (overwrite the placeholders).

## Build and Test Verification

- `npm run build`: PASS (Vite build clean, 0 TS errors)
- `npm test`: Pre-existing failures in worktrees (RED TDD stubs and EADDRINUSE port conflicts from parallel agent sessions) — not caused by this plan's frontend-only changes. Main project tests unaffected.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- `src/client/public/images/hero.webp` — placeholder 48-byte file. CSS resolves but no photo renders. Intentional; user must supply real Unsplash photo.
- `src/client/public/images/dashboard-bg.webp` — same as above.

These stubs do NOT prevent the plan's goal from being achieved: all CSS structure, overlay, classes, and print targeting are wired and correct. Visual effect is complete once real photos are dropped in.

## Self-Check: PASSED

| Claim | Verified |
|-------|---------|
| hero.webp exists | PASS |
| dashboard-bg.webp exists | PASS |
| LandingPage build passes | PASS |
| DashboardPage build passes | PASS |
| hero-bg class in LandingPage.tsx | PASS |
| dashboard-bg class in DashboardPage.tsx | PASS |
| Commit 11b48b7 exists | PASS |
| Commit a285176 exists | PASS |
| Task 3 user approved | PASS |
| npm run build exits 0 | PASS |
