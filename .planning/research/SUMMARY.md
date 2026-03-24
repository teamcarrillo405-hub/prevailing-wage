# Research Summary — v2.4: Ship-Ready + Design Elevation

**Project:** HCC Prevailing Wage
**Domain:** Davis-Bacon / state prevailing wage compliance — certified payroll generation and audit readiness
**Milestone:** v2.4 — Ship-Ready + Design Elevation
**Researched:** 2026-03-24
**Confidence:** HIGH (all findings verified against official sources; MEDIUM on WA L&I portal-specific field details)

---

## Executive Summary

v2.4 is an additive milestone on top of a fully-functional v2.3 codebase (1,522 passing tests). The scope breaks into four delivery areas: (1) state-specific certified payroll forms for California and Washington, (2) dashboard compliance status filter and CSV export for the audit-response workflow, (3) contractor guidance UX woven through existing pages, and (4) production deployment on Render.com with design elevation. The research confirms that none of these areas require new architectural patterns or a database engine change — the entire milestone is implementable with the existing stack, one new library (`csv-stringify` ^6.7.0), and new service files following patterns already proven in the codebase.

The most consequential finding concerns California compliance: the CA A-1-131 form requires a double-time (DT) hours schema migration before any form code can be written. California law imposes daily overtime thresholds (OT after 8 hours, DT after 12 hours per day) that are structurally different from the federal CWHSSA weekly model the current compliance engine implements. Attempting to build the CA form without the `monDt`-`sunDt` column additions and a separate `computeCaliforniaCompliance()` function will produce an incorrect certified payroll that exposes contractors to DIR penalty. This migration is the hard gate for all CA form work. For Washington, the primary risk is the SAM.gov WDOL API gap: Washington prevailing wage rates are published by L&I independently and are not available through the federal API, requiring manual rate entry for WA projects in v2.4.

Production deployment on Render.com has three non-negotiable prerequisites that must be validated before any production data is created: (1) a persistent disk must be mounted at `/var/data` and `DATABASE_URL` pointed there before first deploy, (2) WAL journal mode must be disabled in favor of DELETE mode for the network-backed volume, and (3) Drizzle migrations must run at Express startup time via `migrate()` in `server.ts`, not in a Render build step, because only the startup process has access to the mounted volume. Any deployment executed without these three items verified will result in silent data loss on the next redeploy. Auth requires no changes — serving the Vite build as static files from the same Express origin keeps `SameSite=Lax` functional.

---

## Key Findings

### Recommended Stack

The existing stack handles all v2.4 requirements. One new library is added. No database migration to Postgres or Turso is warranted — the volume-mounted SQLite pattern on Render.com is the correct production approach for a single-user app at this stage.

**Core technologies (existing, unchanged):**
- Node.js + Express + TypeScript — API server; state form routes extend existing `export.ts` patterns
- React 18 + Vite + TailwindCSS v4 — client; design tokens extended in `index.css` `@theme` block; no new UI frameworks
- SQLite + Drizzle ORM (better-sqlite3) — volume-mounted at `/var/data` on Render; add-only migrations; synchronous driver stays
- pdf-lib 1.17.1 — AcroForm field fill or coordinate overlay for CA A-1-131 and WA F700-065-000; no new PDF library needed
- JWT httpOnly cookie auth — unchanged; served from same Express origin eliminates cross-origin cookie complexity

**New library (one only):**
- `csv-stringify` ^6.7.0 — server-side CSV generation; natural extension of `csv-parse` (same monorepo, same version line) already installed; streaming-native for Express; ~42KB

**New infrastructure:**
- Render.com Starter plan ($7/mo) + persistent disk ($0.25/GB/mo) — SQLite mount at `/var/data`; total ~$7.25/month

### Expected Features

**Must have (table stakes for v2.4):**
- CA DIR certified payroll form (A-1-131) — local PDF record generated via pdf-lib; contractor submits electronically via eCPR portal separately. Requires DT schema migration first.
- WA L&I certified payroll form (F700-065-000) — pdf-lib coordinate overlay; WA prevailing wage rates entered manually (no WDOL API coverage)
- Dashboard compliance status filter — `GET /api/compliance/projects/summary` endpoint batching all projects; client-side filter UI with 4 states: All / Compliant / Has Violations / No Payroll
- CSV export from compliance history — client-side export of already-fetched violation data; no new API endpoint required
- Invite-only registration — `crypto.randomBytes()` + `invitations` DB table; no new auth library
- Production deployment on Render.com — persistent SQLite, env var hygiene, static file serving from Express

**Should have (design elevation):**
- UI/UX overhaul — dark gold gradient landing page, elevated `Card` shadow variant, photography via `public/` directory referenced in CSS (not Vite import)
- Contractor guidance — `HelpText` primitive (inline + callout variants); contextual copy on 5 pages; instructional empty states updated; positive compliance confirmation on preflight modal

**Defer to v3+:**
- eCPR XML upload API integration (CA portal direct submission) — complex API, separate auth, out of scope
- WA L&I Intent/Affidavit portal automation — portal-only filing; the app generates reference PDFs only
- WA prevailing wage rate API integration — L&I publishes rates independently; API not available
- Turso or Postgres migration — not warranted until multi-device access is a real requirement
- Litestream replication — operational hardening for a future milestone; Render persistent disk is sufficient
- Email delivery for invite links — SMTP complexity unnecessary for small user base; copy-paste URL from admin endpoint is sufficient

**Critical form naming corrections (carried forward from research):**
- CA form is **A-1-131** (Public Works Payroll Reporting Form). DAS-140 and DAS-142 are apprenticeship notification forms — not certified payroll, not in scope.
- WA Intent to Pay and Affidavit of Wages Paid are filed via the PWIA portal only — the app generates **reference PDFs** for data-entry guidance, not submission artifacts. The F700-065-000 is the buildable weekly certified payroll form.
- WA prevailing wage rates are **not on SAM.gov** — manual rate entry required for all WA projects.

### Architecture Approach

v2.4 extends the existing Express/React layered architecture with new service files following established patterns. The single parametric state form route (`GET /api/export/state-form/:weekId?form=ca-dir|wa-li`) reuses the ownership-check + data-load + generate pattern from `export.ts` without duplicating boilerplate. The compliance summary endpoint (`GET /api/compliance/projects/summary`) is registered before the `/:weekId` wildcard in `compliance.ts` per the existing route-ordering convention. Design elevation follows a tokens-first build order: extend `@theme` in `index.css`, then Card/Button component variants, then page-level application.

**Major components and changes:**

1. `src/server/services/caDirGenerator.ts` (NEW) — mirrors `wh347Generator.ts`; `fillCaDirForm(data, templateBytes): Promise<Uint8Array>`; requires DT columns in schema before writing
2. `src/server/services/waLiGenerator.ts` (NEW) — same pattern for WA F700-065-000; includes WA 4-letter trade code mapping table
3. `src/server/routes/export.ts` (MODIFIED) — single `/state-form/:weekId?form=` handler appended
4. `src/server/routes/compliance.ts` (MODIFIED) — `/projects/summary` registered before `/:weekId`
5. `src/client/components/ui/HelpText.tsx` (NEW) — ~30-line display primitive; inline and callout variants; no state, no provider, no tooltip library
6. `src/client/index.css` (MODIFIED) — new `@theme` tokens: dark surface, gold gradient, elevated shadow; never add `--color-*: initial` (wipes Tailwind defaults)
7. `src/server/db/index.ts` (MODIFIED) — reads `DATABASE_URL` from env; fallback to local dev path
8. `public/` directory (NEW) — Vite copies verbatim to `dist`; photography referenced via CSS `background-image`, not Vite import statements

**Anti-patterns to explicitly avoid:**
- Two separate state form routes per state (duplicates 30 lines of ownership/data-load boilerplate per new state)
- Caching compliance status on the `projects` table (cache invalidation becomes more complex than the computation)
- Importing photography via Vite `import` statement (hashes change on every swap, breaks CDN caching)
- WAL journal mode on cloud deployment (NFS volumes have inconsistent `fsync` semantics; use DELETE journal)
- `tailwind.config.js` alongside `@theme` setup (v3 syntax conflicts with v4's CSS-first configuration)

### Critical Pitfalls

1. **CA daily overtime schema missing — blocks all CA form work.** The existing schema has `monSt`/`monOt` per day but no `monDt`-`sunDt` double-time columns. CA law requires OT after 8 hours/day and DT after 12 hours/day. A-1-131 reports all three buckets per day. Migrate first; build CA form logic after. Create `computeCaliforniaCompliance()` in a separate `complianceCA.ts` module — never modify the federal `computeCompliance()`.

2. **SQLite database silently erased on every redeploy without a persistent volume.** Containers on Render have ephemeral filesystems. A DB written to the project root is wiped on every deploy — including all payroll records. Configure the Render persistent disk and verify it before creating any production data. Detection: deploy, create a test project, redeploy, confirm the project survives.

3. **WAL journal mode + NFS volume = potential database corruption.** Cloud-hosted volumes (Render, Fly.io) are NFS-backed with inconsistent `fsync`. WAL mode requires reliable `fsync` for journal integrity. Disable WAL in production; use DELETE journal mode. Audit `db/index.ts` for `PRAGMA journal_mode=WAL` before deploying.

4. **WA L&I uses 4-letter trade codes (CARP, ELEC, LABO) — SAM.gov classification strings are not 1:1.** Inserting federal classification strings directly into WA form fields will fail L&I validation. Build a mapping table for the 15-20 most common trades before writing the WA generator. For unmapped classifications, show a UI dropdown for the contractor to select the correct L&I code and store the selection per worker per project.

5. **CA form fringe contributions must go in the Fringe Benefits section, not Total Deductions.** Employer contributions to bona fide benefit plans are employer costs, not worker deductions. Placing `fringeRateSnapshot` values in the "Total Deductions" column (copying WH-347 deduction logic) causes DIR to flag the submission. The CA form filler must route these to the fringe section with a code comment documenting the distinction.

6. **CA PDF download implies submission — eCPR portal is still required.** SB 854 mandates electronic submission via California DIR's eCPR portal for most public works projects. The generated A-1-131 PDF is a local record and data-entry reference only. A persistent UI disclosure with a link to `efiling.dir.ca.gov/eCPR` must appear in the preflight modal before every CA form download.

7. **`VITE_`-prefixed secrets are bundled into the public JavaScript.** SAM.gov API key, JWT secret, and database path must never use the `VITE_` prefix. Only `VITE_API_BASE_URL` belongs in the client build. Audit before setting production secrets in the Render dashboard.

8. **Drizzle migration journal must be manually updated for every new migration.** Migration files not registered in `meta/_journal.json` are silently skipped. Current highest idx is 4 (tag `0008_program_name`); next idx is 5. Verify post-migration with `SELECT sql FROM sqlite_master WHERE name = 'payroll_entries'`.

---

## Implications for Roadmap

Based on dependencies discovered in the research, the recommended phase structure for v2.4 is 7 phases across 4 tracks. Phase A gates Phase B. Phases D-F are largely independent and can be parallelized with B-C if capacity allows. Phase G (deployment) comes last but infrastructure can be set up any time after Phase A.

### Phase A: Schema Migration + Groundwork

**Rationale:** The DT schema migration is the hard gate for all CA form work and must land before any CA generation code is written. The WA trade code mapping table should be built simultaneously before WA generation code begins. Both are add-only migrations that will not affect existing functionality. Sourcing official form PDFs (CA A-1-131 and WA F700-065-000) must also happen in this phase — PDF assets are required before coordinate calibration begins, and sourcing is the most likely scheduling constraint.

**Delivers:** `monDt`-`sunDt` columns on `payrollEntries` (registered at idx 5 in `_journal.json`); `invitations` table for invite-only auth; WA 4-letter trade code mapping table; both official form PDFs bundled in `src/server/assets/forms/`

**Addresses:** CA OT schema gap (Pitfall 1); Drizzle journal registration (Pitfall 8); auth gate foundation

**Avoids:** Writing form logic against an incomplete schema

### Phase B: CA DIR A-1-131 Form Generation

**Rationale:** CA form depends on Phase A schema. Build CA first because it is the higher-complexity state form (daily OT model, fringe column routing, eCPR disclosure). The CA-specific project-level fields (CSLB license, WC policy number) establish the pattern for WA project-level additions in Phase C.

**Delivers:** `caDirGenerator.ts`; `GET /api/export/state-form/:weekId?form=ca-dir`; download button in `PayrollWeekDetailPage` (state === 'CA' only); eCPR disclosure in preflight modal; new CA-specific project fields

**Addresses:** FEATURES Part 4 CA form spec; fringe/deductions column routing (Pitfall 5); eCPR disclosure requirement (Pitfall 6)

**Research flag:** Measure all A-1-131 field coordinates against the official PDF before writing generation code (4-6 hours of calibration). Verify current DIR policy on SSN last-4 vs. full SSN on the form before implementing that field.

### Phase C: WA L&I F700-065-000 Form Generation

**Rationale:** Follows CA pattern. WA project additionally requires manual prevailing wage rate entry (SAM.gov gap). The Intent/Affidavit reference PDFs can be scoped as supplementary to the F700-065-000 if capacity is tight.

**Delivers:** `waLiGenerator.ts`; WA form download button (state === 'WA' only); WA-specific project fields (UBI, L&I registration cert, WC account); PWIA portal disclosure for Intent/Affidavit reference documents; WA apprentice coverage advisory display (project-level cumulative %, not per-week)

**Addresses:** WA 4-letter code mapping (Pitfall 4); WA 15% apprentice coverage display (advisory); manual WA rate entry UI

**Research flag:** Measure F700-065-000 field coordinates. Confirm which fields have AcroForm entries vs. requiring coordinate overlay. Validate that the PWIA portal approach (reference PDF only) is correctly scoped.

### Phase D: Dashboard Compliance Filter + CSV Export

**Rationale:** Independent of state form work. The compliance summary endpoint and client-side filter are pure additive features. CSV export is client-only (no new API endpoint). Both are quick wins that deliver immediate auditor-response value.

**Delivers:** `GET /api/compliance/projects/summary` registered before `/:weekId` in `compliance.ts`; compliance filter chips in `DashboardPage.tsx`; `complianceByProject` lookup map via `useMemo`; CSV export button and Blob download from `WorkerComplianceHistoryPage`

**Addresses:** FEATURES Part 4 dashboard compliance filter spec; CSV column ordering for auditor usability (Pitfall 19 — columns ordered by WH-347 field convention, not schema order)

**Avoids:** Caching compliance status in DB (compute on read via `computeCompliance()` is fast; a cache column creates sync problems on every entry change)

**Research flag:** Standard patterns. Skip research-phase. Note: `computeCompliance()` is O(projects × weeks) — acceptable for single-user app; document for future pagination if contractor builds up hundreds of projects.

### Phase E: Contractor Guidance UX

**Rationale:** Depends only on `HelpText.tsx` primitive existing first. Applied across 5 pages in a single pass. Low complexity — copywriting and component placement, no data model changes.

**Delivers:** `HelpText.tsx` primitive (inline + callout variants, ~30 lines); contextual callouts on `ProjectDetailPage`, `PayrollEntryPage`, `PayrollWeekDetailPage`; updated EmptyState copy on `DashboardPage` and `WorkersPage`; positive compliance confirmation on preflight modal

**Addresses:** FEATURES Part 4 guidance UX patterns (inline help, positive preflight, post-action context)

**Avoids:** Tooltip library installation — use `HelpText` callout instead (Radix `TooltipProvider` at app root causes all tooltips to re-render on any hover, Pitfall 11); hover-only guidance is invisible on iPad (Pitfall 12); no sidebar guidance panel (occupies permanent horizontal real estate for rarely-needed content)

**Research flag:** Standard patterns. Skip research-phase.

### Phase F: Design Elevation (UI/UX Overhaul)

**Rationale:** Tokens must be finalized before Card/Button variants, and variants must exist before page-level application. Photography assets must be sourced, sized (WebP, <200KB), and compressed before being added to `public/`. Design work is largely isolated from server-side changes.

**Delivers:** New `@theme` tokens in `index.css` (dark surface `#1a1a1a`, gold gradient start/end, elevated shadow); `Card` `elevated` variant; `Button` `gold` variant (if needed for dark surface CTAs); `LandingPage` hero + gradient sections; `DashboardPage` elevated card styling; `public/hero-construction.webp` and optional `public/dashboard-bg.webp`

**Addresses:** FEATURES Part 2 brand differentiation; HCC competitive visual advantage over blue-palette competitors (LCPtracker, Elation both use generic enterprise blue)

**Avoids:** `tailwind.config.js` creation alongside `@theme` (v3/v4 conflict, Pitfall 15); photography via Vite `import` statement (hash churn, Pitfall 14); uncompressed images causing LCP > 2.5s (Pitfall 14); missing `@media print` overrides for photo backgrounds — white text on white paper when printing (Pitfall 13)

**Research flag:** Standard patterns. Skip research-phase. Note: Use `<link rel="preload" as="image">` in `<head>` for hero image to avoid LCP blocking.

### Phase G: Production Deployment

**Rationale:** Last to ship but infrastructure can be set up ahead of time. Three non-negotiable validation steps must complete before any user data enters the system.

**Delivers:** Render.com Starter service linked to GitHub repo; persistent disk attached at `/var/data`; `DATABASE_URL`, `JWT_SECRET`, `SAM_GOV_API_KEY`, `NODE_ENV`, `ADMIN_SECRET` in Render runtime env; `VITE_API_BASE_URL` set as Render build-time env var; `process.env.PORT ?? 4099` in Express; `express.static('dist/')` + SPA catch-all registered after all API routes; `migrate(db, ...)` at startup in `server.ts`; `.env.example` committed; invite-only registration activated; `VITE_` env var audit completed

**Addresses:** Persistent volume (Pitfall 2); WAL mode disabled (Pitfall 3); startup-time migrations instead of build-step (migration volume access); JWT `SameSite=Lax` with same-origin serving (Pitfall 9 equivalent); `VITE_` secret audit (Pitfall 7); Express catch-all route ordering (Pitfall 18)

**Critical verification:** Deploy twice. Create a project after first deploy. Trigger a redeploy. Confirm the project survives. If it is gone, the volume mount is misconfigured.

### Phase Ordering Rationale

- Phase A (schema + assets) gates Phase B (CA forms) — DT migration must precede generation code
- Phase B gates Phase C — CA establishes the state-specific project field pattern that WA extends
- Phase D is independent and can begin as soon as v2.3 is stable
- Phase E should wait until Phase F design tokens are locked (HelpText uses brand token classes)
- Phase F can run in parallel with B-D if design work is resourced separately
- Phase G comes last for production launch but disk infrastructure can be configured at any time

### Research Flags

**Needs per-phase research during planning:**
- **Phase B (CA form):** Measure A-1-131 PDF field coordinates against the official form before writing generation code. Verify current DIR policy on SSN last-4 vs. full SSN. Confirm AcroForm field accessibility by name vs. coordinate fallback.
- **Phase C (WA form):** Measure F700-065-000 field coordinates. Validate portal-only scope for Intent/Affidavit. Confirm contract value thresholds ($2,500 short form; $10,000 registration cert required).
- **Phase G (deployment):** Audit `db/index.ts` for `PRAGMA journal_mode=WAL` before deploy. Validate persistent disk by deploying twice before any real user data.

**Standard patterns — skip research-phase:**
- **Phase D:** Compliance summary endpoint is fully specified in ARCHITECTURE.md. TanStack Query filter pattern is established.
- **Phase E:** Pure component and copy work. No data model changes. No external APIs.
- **Phase F:** TailwindCSS v4 `@theme` extension pattern is documented. Photography sizing is standard.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified against live npm registry (csv-stringify 6.7.0), Render pricing page, official platform docs. One new library confirmed. |
| Features | HIGH (regulatory); MEDIUM (WA form fields) | CA A-1-131 structure confirmed from official DIR PDF + eCPR XML guidelines v1.9. WA F700-065-000 confirmed from RCW 39.12.040 + secondary sources; PWIA portal field details from system descriptions, not direct access. DAS-140/142 confirmed as apprenticeship forms, not CPR. |
| Architecture | HIGH | Research based on direct codebase analysis of `export.ts`, `compliance.ts`, `complianceService.ts`, `stateWageAdapter.ts`, and `index.css`. Patterns verified against working implementation, not inference. |
| Pitfalls | HIGH | Regulatory pitfalls (CA daily OT, WA trade codes, fringe column routing) verified against official DIR and L&I docs. Deployment pitfalls (volume persistence, WAL mode, build-step migration failure) verified against platform docs and community reports. |

**Overall confidence:** HIGH — primary risks are known and preventable. The CA daily OT schema gap and the WA SAM.gov rate gap are the two structurally important findings that affect feature scope; both have clear documented mitigations.

### Gaps to Address During Planning

- **CA SSN requirement on A-1-131:** Current DIR guidance on last-4 vs. full SSN on the paper form. Privacy rules have shifted since the form was designed. Verify before implementing the SSN field in the CA generator. MEDIUM confidence on the current requirement.

- **CA CSLB license fields as required vs. optional:** CSLB license, specialty license, and WC policy number are not in the current project data model. Determine whether these are required at project creation (enforces compliance) or optional (reduces friction for first-time users) before building the CA project-field additions.

- **WAL mode in current codebase:** PITFALLS.md recommends auditing whether `PRAGMA journal_mode=WAL` is set in `db/index.ts` before deploying. This is a one-line code check that belongs at the start of Phase G planning.

- **WA Intent/Affidavit scope confirmation:** The current research recommendation is a reference PDF with a portal link. Validate this is the right scope vs. a form UI that walks contractors through portal fields. The reference PDF approach is simpler and sufficient for v2.4.

---

## Key Corrections Carried Forward

The following corrections from the milestone briefing are integrated throughout this summary and must propagate to all planning and execution documents:

| Incorrect | Correct | Impact |
|-----------|---------|--------|
| DAS-140 = CA certified payroll form | DAS-140 is an apprenticeship notification form; CA CPR form is A-1-131 | All CA form work targets A-1-131 only |
| WA Intent/Affidavit are PDF-submittable | Intent/Affidavit are portal-only via PWIA; F700-065-000 is the buildable CPR form | WA scope = F700-065-000 PDF + reference docs for Intent/Affidavit |
| WA wage rates on SAM.gov | WA rates are L&I-published only; not in WDOL API | Manual rate entry required for all WA projects |
| CA form can reuse ST/OT schema | CA requires per-day DT hours; `monDt`-`sunDt` migration mandatory before CA form code | DT migration is the first step in Phase A |
| WA classifications = SAM.gov strings | WA requires 4-letter L&I codes (CARP, ELEC, LABO, etc.) | Trade code mapping table required before WA generation code |
| Render is one option among equals | Render.com is the confirmed hosting choice | All deployment docs target Render |
| csv-stringify version unspecified | ^6.7.0 — current, matches csv-parse monorepo version line | `npm install csv-stringify` |

---

## Sources

### Primary (HIGH confidence — official sources, live verification)
- CA DIR certified payroll reporting: `https://www.dir.ca.gov/public-works/certified-payroll-reporting.html`
- CA DIR A-1-131 form PDF: `https://www.dir.ca.gov/dlse/forms/pw/dlseforma-1-131.pdf`
- CA DIR eCPR XML Guidelines v1.9: `https://www.dir.ca.gov/public-works/eCPRXMLGuideline1.9.pdf`
- CA DIR Prevailing Wage FAQ: `https://www.dir.ca.gov/dlse/FAQ_PrevailingWage.html`
- California Labor Code Sections 1810-1815 (daily OT thresholds)
- WA L&I PWIA system: `https://secure.lni.wa.gov`
- WA RCW 39.12.040 (Intent/Affidavit requirements)
- csv-stringify npm registry: `https://www.npmjs.com/package/csv-stringify` — version 6.7.0 confirmed
- Render pricing: `https://render.com/pricing` — $7/mo service, $0.25/GB/mo disk
- Render persistent disks: `https://render.com/docs/disks`
- Vite env vars: `https://vite.dev/guide/env-and-mode`
- TailwindCSS v4 docs: `https://tailwindcss.com/docs/background-image`
- pdf-lib AcroForm API: `https://pdf-lib.js.org/docs/api/classes/pdfform`
- DOL WH-347 form instructions (Rev. Jan 2025): `https://www.dol.gov/agencies/whd/forms/wh347`
- California SB 854 eCPR mandate: Ogletree analysis confirmed active requirement

### Secondary (MEDIUM confidence — verified against multiple sources)
- WA F700-065-000 form fields: L&I documentation + Points North WA certified payroll guide
- WA Intent/Affidavit online-only confirmation: MRSC March 2025 guide + LCPtracker CA Q&A
- WA apprentice 15% labor hours requirement: Workyard WA prevailing wage guide 2025; Points North apprenticeship ratios
- Fly.io/Render release_command volume access failure: community reports at `community.fly.io`
- Radix UI TooltipProvider re-render issues: GitHub issues #2375, #3596
- Print CSS background image suppression: documented browser default, `@media print` guidance

### Tertiary (validated through direct codebase analysis)
- `src/server/routes/export.ts`, `compliance.ts`, `complianceService.ts`, `stateWageAdapter.ts`, `index.css`, `db/schema.ts` — confirmed patterns, route ordering constraints, token architecture, and existing CA/WA adapter structures
- `.planning/PROJECT.md` — stack constraints confirmed; migration workflow documented; next migration idx is 5

---

*Research completed: 2026-03-24*
*Ready for roadmap: yes*
