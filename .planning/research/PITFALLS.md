# Domain Pitfalls: v2.4 New Features

**Domain:** Davis-Bacon compliance payroll system — adding state forms, guidance UX, UI overhaul, and production deployment to existing v2.3 app
**Researched:** 2026-03-24
**Confidence:** HIGH (official regulatory sources + platform docs verified; specific to this system's stack and deployment targets)

---

## Critical Pitfalls

### Pitfall 1: California Daily Overtime Is Structurally Different From the Federal Model

**What goes wrong:**

The existing compliance engine (`computeCompliance()`) operates on the federal CWHSSA model: overtime triggers after 40 hours in a workweek. California prevailing wage law (California Labor Code Sections 1810-1815) requires overtime after 8 hours in a single day, and double-time after 12 hours in a single day — regardless of the weekly total. A worker who works a single 10-hour day and no other hours that week has 2 OT hours under California law and zero OT hours under federal law.

The A-1-131 form reports hours in a daily breakdown format precisely because California needs the per-day view to validate the daily overtime threshold. Reusing the existing `ST`/`OT` hour columns without a `DT` (double-time) column and daily-threshold logic will produce systematically incorrect California compliance checks and incorrect form population.

**Why it happens:**

The existing schema stores hours as `monSt`, `monOt` (straight/overtime per day) with no double-time columns. The compliance engine computes weekly totals, not daily totals. It is natural to reuse this structure for the CA form because the field names look similar to CA's reporting columns.

**Consequences:**

California form A-1-131 will show the wrong OT hours. The compliance engine will flag false-clean weeks (no violation when there should be one) for any day over 8 hours. Workers in LA County or under trades with day-length-specific rate schedules will have incorrect certified payroll submitted to DIR.

**Prevention:**

Before implementing the CA form, extend the payroll entry schema with `monDt`, `tueDt`, `wedDt`, `thuDt`, `friDt`, `satDt`, `sunDt` double-time columns via a Drizzle migration. Create a separate `computeCaliforniaCompliance()` function in a new `complianceCA.ts` module — do not modify `computeCompliance()`. The CA computation must read per-day hour buckets and apply: OT = hours 8-12 per day, DT = hours over 12 per day. Keep this calculation isolated from the federal engine. The federal engine must remain unmodified for WH-347 compliance.

**Detection:**

Generate a CA form for a worker who worked 13 hours on Monday. The A-1-131 should show: 8 ST hours, 4 OT hours, 1 DT hour on Monday. If it shows 8 ST + 5 OT with no DT column, the logic is wrong.

**Phase to address:** State Forms phase — schema migration must precede any CA form generation code.

**Confidence:** HIGH — California Labor Code Sections 1810-1815, DIR FAQ, and Caltrans labor compliance manual all confirm dual daily/weekly overtime thresholds.

Sources: [California DIR Prevailing Wage FAQ](https://www.dir.ca.gov/dlse/FAQ_PrevailingWage.html), [Caltrans Labor Compliance Manual Chapter 10](https://dot.ca.gov/programs/construction/labor-compliance/labor-compliance-manual/chapter-10)

---

### Pitfall 2: CA DIR Fringe Benefits Must Not Appear in the Deductions Column on A-1-131

**What goes wrong:**

The A-1-131 form has a "Total Deductions" column and a separate "Fringe Benefits" section. Employer contributions to bona fide benefit plans are not deductions from the worker's wages — they are employer costs. If the form-filling logic places fringe benefit plan contributions in the "Total Deductions" column (copying the pattern used for the federal WH-347 deductions), DIR will flag the submission as incorrect. The DIR has explicitly stated this causes unnecessary wage assignment authorization requests.

The existing `wh347Generator.ts` handles fringe benefit reporting with `fringeRateSnapshot` multiplied by hours. On the WH-347 this is reported in the "Fringe Benefits" section. The A-1-131 has the same conceptual split but different field positions and calculation expectations.

**Why it happens:**

Developers porting the WH-347 PDF generation logic to A-1-131 see "deductions" on both forms and route fringe contributions there. The distinction between deductions (worker money) and employer fringe contributions (employer money) is not visible in the schema — both are numbers.

**Consequences:**

DIR rejects or flags the certified payroll. Employer contributions appear as worker deductions, making gross-to-net pay reconciliation impossible for auditors.

**Prevention:**

The A-1-131 form filler must route:
- Worker-paid deductions (taxes, union dues) → "Total Deductions" column
- Employer fringe benefit contributions → "Fringe Benefits" section

Add a comment to the CA form generation function: "Fringe benefit contributions are EMPLOYER costs — do not populate Total Deductions with fringeRateSnapshot values." The `fringeRateSnapshot` on `payrollEntries` represents the per-hour employer contribution rate and belongs in the fringe section.

**Detection:**

Generate an A-1-131 for a worker with a $5/hr fringe rate and verify the "Total Deductions" column does not include the fringe contribution. The fringe section should show the per-hour rate and total.

**Phase to address:** State Forms phase — verify this before testing the CA PDF output against the actual A-1-131 form.

**Confidence:** HIGH — DIR XML guideline documentation and DIR certified payroll FAQ explicitly address this distinction.

Sources: [DIR eCPR XML Guidelines](https://www.dir.ca.gov/public-works/eCPRXMLGuideline1.9.pdf), [CA DIR Certified Payroll FAQ](https://www.dir.ca.gov/Public-Works/FAQ-certified-payroll-reporting.html)

---

### Pitfall 3: California Requires Electronic Submission via eCPR — A PDF Is Insufficient for Compliance

**What goes wrong:**

The existing WH-347 workflow generates a PDF for download and manual submission. For California public works, SB 854 (effective 2014, still enforced) requires electronic certified payroll reporting via the DIR's eCPR portal — not a paper A-1-131. The eCPR portal accepts manual entry via iForm or XML file upload. A generated A-1-131 PDF is useful for the contractor's records and for manual iForm entry reference, but it does not constitute electronic submission to DIR.

If the app presents an "A-1-131 Download" button alongside the WH-347 with no disclosure that the PDF must also be submitted electronically via eCPR, contractors may believe generating the PDF fulfills the CA requirement.

**Why it happens:**

The WH-347 workflow is entirely download-based. The state form is added using the same pattern. The electronic submission requirement is a policy fact about California law, invisible from the PDF generation implementation.

**Consequences:**

Contractor submits to the federal awarding agency but not to California DIR. DIR compliance gap creates liability. Contractor believes they are compliant because the app generated a form.

**Prevention:**

The CA form download must include a persistent UI warning: "California public works projects require electronic submission via the DIR eCPR portal. This PDF is for your records. You must submit directly at [link to eCPR portal]." The warning must appear on the preflight modal before download (parallel to the existing WH-347 violation preflight) and on the download confirmation. Do not generate a CA PDF without this disclosure visible.

**Detection:**

Review the CA download flow with a contractor user — is the eCPR portal requirement visible without reading fine print?

**Phase to address:** State Forms phase — write the eCPR disclosure copy before building the download button.

**Confidence:** HIGH — California SB 854 and DIR public works page confirm mandatory electronic reporting requirement.

Sources: [DIR Certified Payroll Reports](https://www.dir.ca.gov/public-works/certified-payroll-reporting.html), [Ogletree SB 854 overview](https://ogletree.com/insights-resources/blog-posts/california-public-works-contractors-will-be-required-to-submit-payroll-records-electronically-starting-august-1/)

---

### Pitfall 4: Washington L&I Uses Four-Letter Craft Codes — Mapping Trade Classifications Is Not 1:1 With Federal

**What goes wrong:**

Washington L&I's certified payroll form F700-065-000 requires trade codes (BOIL, CARP, ELEC, LABO, etc.) that do not directly map to the federal SAM.gov wage determination trade classification strings used in this app. A worker classified as "Carpenter - Cabinetwork (Excluding Millwright)" in the federal WD has a different name than what L&I expects. If the app inserts the federal classification string directly into the WA L&I trade code field, the form submission will fail L&I validation.

Washington also requires that the classification is determined by the work performed, not the worker's job title or federal classification — these can differ from federal classifications.

**Why it happens:**

The existing `classifications` table stores the SAM.gov WD classification label verbatim. Reusing that label for the state form field is the path of least resistance. The developer does not know that L&I has its own trade code vocabulary.

**Consequences:**

L&I form validation rejects or flags submissions with unrecognized trade codes. If the form is manually submitted, auditors see "Carpenter - Cabinetwork (Excluding Millwright)" where they expect "CARP."

**Prevention:**

Build a mapping table from common SAM.gov classification strings to L&I four-letter trade codes. This does not need to be exhaustive at launch — cover the 15-20 most common trades (carpenter, laborer, electrician, ironworker, painter, plumber, roofer, operator). For classifications that have no mapping, display a dropdown on the WA form generation screen that lets the contractor select the correct L&I code before generating. Store the selected code per worker per project to avoid re-entry.

**Detection:**

Attempt to generate a WA form for a worker with a SAM.gov classification that includes a sub-specialty. Verify the output uses the correct L&I code or prompts for one.

**Phase to address:** State Forms phase — build the mapping table before writing the PDF generation function.

**Confidence:** HIGH — L&I Prevailing Wage Suite documentation and certified payroll form F700-065-000 confirm the four-letter code requirement.

Sources: [Washington L&I Prevailing Wage Suite](https://secure.lni.wa.gov/wagelookup/), [Points North WA certified payroll](https://www.points-north.com/state-by-state-certified-payroll-reporting/washington)

---

### Pitfall 5: Washington Apprentice Ratio Is 15% of Total Labor Hours — Different Metric Than the Federal 1:3 Ratio

**What goes wrong:**

The existing compliance engine (COMP-03) enforces a 1:3 apprentice-to-journeyworker ratio per payroll week (the federal Davis-Bacon standard). Washington state law requires that 15% of total labor hours on a public works project be performed by apprentices. This is a project-level cumulative percentage, not a per-week ratio between worker types.

If the WA form generation code reuses `weekViolations[]` from COMP-03 to display apprentice ratio compliance for Washington projects, it will show the wrong metric. A project with 10 apprentice-hours in week 1 and 0 in weeks 2-8 may pass the weekly 1:3 check in some weeks but fail the cumulative 15% requirement.

**Why it happens:**

COMP-03 is already implemented and the concept of "apprentice ratio" is familiar. Reusing it for WA appears to be a minor parameter change.

**Consequences:**

Washington project compliance status shows clean when the project is actually below the required apprentice utilization. The WA form does not surface apprentice hour totals in a way that reveals the cumulative percentage to the contractor.

**Prevention:**

Create a separate `computeWashingtonApprenticeCoverage()` function that queries all payroll entries for the project to date and computes `totalApprenticeHours / totalLaborHours`. Display this as a project-level gauge on the WA form generation screen: "Apprentice coverage: 12% (required: 15%)." This is advisory, not a blocking violation — the contractor may still be on track if apprentices will be added in future weeks.

**Detection:**

Build a project with 5 weeks of payroll where week 1 has 10% apprentice hours and all other weeks have 0. Verify the WA coverage display shows the cumulative running percentage, not a per-week ratio.

**Phase to address:** State Forms phase — document the WA-specific apprentice rule before any compliance logic is written for the WA form.

**Confidence:** HIGH — Washington State prevailing wage law and L&I documentation confirm the 15% labor hours requirement.

Sources: [Washington Prevailing Wage Guide 2025](https://www.workyard.com/us-labor-laws/prevailing-wage-washington-state), [Points North Apprenticeship Ratios](https://www.points-north.com/trends-and-insights/apprenticeship-ratios-prevailing-wage-requirements)

---

### Pitfall 6: SQLite Database on Render/Fly.io Is Erased on Every Deploy Without a Persistent Volume

**What goes wrong:**

Both Render.com and Fly.io have ephemeral container filesystems. Every new deployment overwrites the container image, including any SQLite file written into the container's local path. A SQLite database written to `/app/data/app.db` inside the container (with no persistent volume) will be empty after every deploy. All production data — projects, workers, payroll records, compliance history — is destroyed.

This is the most catastrophic production deployment mistake for this app. The compliance audit trail that the app is built to maintain is silently destroyed on each code push.

**Why it happens:**

The app works in local development with a SQLite file at a relative path. Moving to a Docker container and deploying to Render or Fly.io preserves the build-time filesystem, which does not include runtime data. The app starts clean and appears to work fine — until a second deploy happens.

**Consequences:**

All user data is lost on every deploy. Federal records retention (29 CFR Part 3, 3 years) cannot be met. Data loss with no recovery path.

**Prevention:**

On Fly.io: create a persistent volume (`fly volumes create app_data --size 10`), mount it in `fly.toml` as `[mounts] source = "app_data" destination = "/data"`, and configure the SQLite file path to `/data/app.db`. On Render.com: add a Persistent Disk via the dashboard, set mount path to `/data`, and configure `DATABASE_URL` to point to `/data/app.db`. Verify persistence by deploying twice: deploy, create a test project, deploy again, confirm the test project is still present.

On Railway: Railway does not natively support persistent disk for non-Postgres services on the free plan. If using Railway, use a Postgres database instead of SQLite, which requires a Drizzle adapter swap.

**Detection:**

Deploy the app, create a project, push a trivial code change to trigger a redeploy, confirm the project still exists. If it is gone, the volume mount is missing.

**Phase to address:** Deployment phase — configure the persistent volume before any production data is created. This is the first deployment step, not a later optimization.

**Confidence:** HIGH — Render persistent disk documentation, Fly.io SQLite documentation, and multiple community reports confirm this behavior.

Sources: [Render Persistent Disks](https://render.com/docs/disks), [Fly.io SQLite docs](https://fly.io/docs/js/prisma/sqlite/), [Fly.io all-in on SQLite](https://fly.io/blog/all-in-on-sqlite-litestream/)

---

### Pitfall 7: Fly.io `release_command` Does Not Have Access to the Persistent Volume — Migrations Fail Silently

**What goes wrong:**

A common pattern for running database migrations on deploy is to add `release_command = "npm run db:migrate"` to `fly.toml`. Fly.io's release command runs in a temporary VM that has access to secrets and environment variables but NOT to persistent volumes. The SQLite database lives on the persistent volume. The migration command connects to the database path, finds no file (because the volume is not mounted), creates a new empty database at that path in the temporary VM, runs migrations against it, and exits. The temporary VM is discarded. The production database on the volume is never migrated.

The application starts with the unmigrated production database. New columns from the migration are missing. The app crashes or silently returns incorrect data.

**Why it happens:**

The `release_command` pattern is the documented approach for Heroku, Railway (Postgres), and other platforms. The SQLite-on-volume constraint is Fly.io-specific and non-obvious.

**Consequences:**

Drizzle schema TypeScript types include new columns; the production SQLite tables do not. Runtime throws `no such column` errors. The migration appears to have succeeded (release command exit 0) but had no effect on the real database.

**Prevention:**

On Fly.io with SQLite, run migrations at application startup, not in the release command. In the Express server entry point (`server.ts`), add a startup migration call before `app.listen()`:

```typescript
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
// Run before listen()
migrate(db, { migrationsFolder: './src/server/db/migrations' });
```

This runs against the live database file on the mounted volume. Remove any `release_command` referencing migrations from `fly.toml`. Test by adding a new column migration locally, deploying to a fresh instance, and verifying the column exists in production.

**Detection:**

After deploying with a new migration, run `fly ssh console` and execute `sqlite3 /data/app.db ".schema payroll_weeks"` — confirm the new columns are present.

**Phase to address:** Deployment phase — validate migration approach against the specific platform before deploying any schema changes.

**Confidence:** HIGH — Fly.io community forum posts confirm this exact failure pattern with SQLite + release_command. Multiple language stacks affected.

Sources: [Fly.io community: deploy sqlite with persistent volume not migrating](https://community.fly.io/t/deploy-sqlite-with-persistent-volume-not-migrating/18712), [SQLite3 Fly Docs](https://fly.io/docs/rails/advanced-guides/sqlite3/)

---

### Pitfall 8: SQLite WAL Mode + Network Filesystem = Data Corruption

**What goes wrong:**

SQLite WAL (Write-Ahead Logging) mode creates three files: `app.db`, `app.db-wal`, and `app.db-shm`. WAL mode requires reliable `fsync()` operations for journal integrity. Fly.io persistent volumes and Render persistent disks are NFS-backed network storage. NFS filesystems have inconsistent `fsync` semantics — writes may appear to succeed but not be durable. Under WAL mode, this can result in database corruption: the main database file is behind the WAL, the WAL is partially written, and the checkpoint cannot reconcile them.

**Why it happens:**

WAL mode is universally recommended for production SQLite as it improves read concurrency and write throughput. Developers enable it without knowing that the recommendation applies to local disk, not network storage.

**Consequences:**

SQLite database becomes corrupted. Payroll data is unrecoverable without a backup. The error often appears as `SQLITE_IOERR` or "database disk image is malformed" after a write-heavy period.

**Prevention:**

Option A (preferred): Disable WAL mode for cloud deployments. Use the default journal mode (DELETE) with `PRAGMA busy_timeout = 5000`. Single-user SQLite with sequential writes does not need WAL's concurrent reader benefit.

Option B: Use Litestream for continuous replication to S3/R2. Litestream takes control of WAL journaling and handles the backup. If WAL is needed, Litestream mitigates the data-loss risk but does not solve the corruption risk on network filesystems.

In `src/server/db/index.ts`, check whether `PRAGMA journal_mode=WAL` is currently set. If yes, remove it for the production deployment configuration. Use environment-conditional journal mode: WAL in local development (local disk), DELETE journal in production (network volume).

**Detection:**

Run a write-heavy test (batch insert 500 payroll entries) against the deployed instance and immediately check `PRAGMA integrity_check`.

**Phase to address:** Deployment phase — configure journal mode before any production data is written.

**Confidence:** MEDIUM — WAL + NFS issues are well-documented in SQLite internals documentation. Platform-specific behavior on Fly.io/Render volumes is not officially confirmed by those platforms; inferred from community reports.

Sources: [Fly.io SQLite WAL internals](https://fly.io/blog/sqlite-internals-wal/), [SQLite locking documentation](https://sqlite.org/lockingv3.html)

---

### Pitfall 9: JWT httpOnly Cookie `SameSite=None` Requires `Secure=true` — Breaks on HTTP

**What goes wrong:**

The app uses JWT in an httpOnly cookie. In local development, the server runs on `localhost:4099` and the Vite dev server proxies API calls — same-origin, no cookie issues. In production on Render or Fly.io, if the API and static files are served from the same origin, `SameSite=Lax` works correctly. However, if the deployment architecture separates the frontend static files to a CDN or a different subdomain from the API (e.g., `app.example.com` frontend and `api.example.com` backend), cookies set with `SameSite=Lax` or `SameSite=Strict` will not be sent on the API calls. The fix — `SameSite=None` — requires `Secure=true` (HTTPS). If HTTPS is not configured (e.g., on a free Render tier using the default HTTP endpoint), `SameSite=None` cookies are silently rejected by the browser.

**Why it happens:**

The cookie auth works in development with the Vite proxy. Production deployment changes the origin structure. The auth appears to work in basic testing (same-origin) but fails when the architecture diverges.

**Consequences:**

Users cannot log in on production. Every API request returns 401. The app appears broken for no obvious reason.

**Prevention:**

Serve the built Vite frontend as static files from the same Express server that handles the API. This ensures a single origin and eliminates cross-origin cookie complexity. In the Express server, add static file serving after building:

```typescript
app.use(express.static(path.join(__dirname, '../../client/dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../../client/dist/index.html')));
```

Configure the cookie in production: `secure: process.env.NODE_ENV === 'production'`, `sameSite: 'lax'`. Both Render and Fly.io terminate HTTPS before the app server, so the app receives HTTP internally — but the browser sees HTTPS. The `Secure` flag is safe to enable.

**Detection:**

Deploy to production, open browser devtools → Application → Cookies, log in, and confirm the `jwt` cookie has `Secure` checked and `SameSite: Lax`. Attempt a protected API call from a different browser session.

**Phase to address:** Deployment phase — finalize the cookie configuration as the first auth-related deployment step.

**Confidence:** HIGH — MDN Web Docs and multiple sources confirm `SameSite=None` requires `Secure`. Express cookie documentation confirms `secure` flag behavior behind reverse proxies.

Sources: [MDN HTTP Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies), [Wisp Blog JWT httpOnly cookies](https://www.wisp.blog/blog/ultimate-guide-to-securing-jwt-authentication-with-httponly-cookies)

---

### Pitfall 10: `VITE_` Prefixed Environment Variables Expose Secrets to the Browser Bundle

**What goes wrong:**

Vite's environment variable system exposes any variable prefixed `VITE_` to the client-side JavaScript bundle. Variables without the prefix are server-only. If the SAM.gov production API key, JWT secret, or database path is accidentally defined as `VITE_SAMGOV_KEY` or `VITE_JWT_SECRET` and used in the frontend code (even just for display), those secrets ship in the publicly downloadable JavaScript bundle.

This app has at minimum: a SAM.gov API key, a JWT signing secret, and a database file path — all of which must never reach the browser.

**Why it happens:**

A developer sets up the `.env` file with `VITE_` prefix for everything, discovers the frontend cannot read non-`VITE_` variables, and assumes all vars need the prefix.

**Consequences:**

SAM.gov API key is public. JWT secret is public — any user can forge tokens. Rate limit exhaustion from credential abuse.

**Prevention:**

Never prefix server-side secrets with `VITE_`. The frontend only needs: `VITE_API_BASE_URL` (if not using same-origin). All other configuration lives in server-side `process.env`. Add a `.env.example` file to the repository with blank values and a comment indicating which variables are server-only. Add a CI check: `grep -r "VITE_SAMGOV\|VITE_JWT\|VITE_DATABASE" src/client/` should return empty.

**Detection:**

Build the production bundle (`npm run build`), open `dist/assets/*.js`, search for any known secret value. If found, that variable is being bundled.

**Phase to address:** Deployment phase — audit env var prefixes before setting production secrets in the hosting platform.

**Confidence:** HIGH — Vite documentation explicitly documents the `VITE_` exposure behavior.

Sources: [Vite Environment Variables](https://vite.dev/guide/env-and-mode)

---

## Moderate Pitfalls

### Pitfall 11: Radix UI `TooltipProvider` Wrapping the App Causes Every Tooltip to Re-render on Hover

**What goes wrong:**

Radix UI `Tooltip` requires a `<TooltipProvider>` ancestor. The natural implementation wraps the entire app in `<TooltipProvider>` inside `App.tsx`. A known Radix UI issue (GitHub issue #2375) causes every tooltip instance to re-render whenever any tooltip is hovered or unhovered — even tooltips that are not visible. On a page with 15 contextual help tooltips (the guidance UX feature), hovering one tooltip triggers 15 re-renders.

**Prevention:**

Scope `TooltipProvider` as close as possible to each tooltip group, not at the app root. For the guidance system, wrap individual sections (e.g., each form card) in their own `TooltipProvider`. Alternatively, use a single `TooltipProvider` with `delayDuration={300}` and `skipDelayDuration={0}` to reduce re-render frequency. If performance issues appear, use Floating UI directly (the underlying library Radix uses) with a custom `useTooltip` hook — this avoids the provider overhead entirely.

**Detection:**

React DevTools Profiler: hover a tooltip with profiler recording, confirm no unrelated tooltip components appear in the re-render flamegraph.

**Phase to address:** Guidance UX phase — validate tooltip rendering performance before building the full guidance system.

**Confidence:** HIGH — Radix UI GitHub issue #2375 and #3596 confirm this behavior. Status as of 2026: partially addressed in newer versions but not fully resolved.

Sources: [Radix UI Tooltip re-render issue #2375](https://github.com/radix-ui/primitives/issues/2375), [Radix UI Tooltip re-render issue #3596](https://github.com/radix-ui/primitives/issues/3596)

---

### Pitfall 12: Tooltips on Touch Devices Have No Activation Mechanism

**What goes wrong:**

CSS `:hover` and pointer-enter events do not fire reliably on touch devices. A tooltip triggered by hover is invisible on mobile/tablet browsers. The app is positioned as "web-first; browser on tablet is sufficient" (PROJECT.md). A contractor using an iPad to review payroll has no access to the contextual help tooltips.

**Why it happens:**

Tooltip libraries default to hover trigger because it is the desktop interaction model. Touch alternative (tap) is often not configured.

**Consequences:**

The guidance UX feature — a primary v2.4 goal — is entirely non-functional for the tablet use case.

**Prevention:**

Use `<Tooltip.Trigger asChild>` with an explicit `?` icon button alongside each tooltip target, rather than wrapping the entire form field. A button is keyboard accessible and touch-tappable. On tap: toggle tooltip open state. This gives desktop (hover), keyboard (focus), and touch (tap) access through a single component. Do not rely on hover-only tooltips for compliance-critical guidance text.

**Detection:**

Open the app on an iOS or Android browser (or Chrome DevTools mobile emulation), attempt to trigger a help tooltip without hovering, confirm it opens.

**Phase to address:** Guidance UX phase — design the help icon + tap interaction before building tooltip components.

**Confidence:** HIGH — fundamental browser behavior; confirmed by accessibility guidelines (WCAG 2.5.3).

---

### Pitfall 13: Construction Photography as CSS Backgrounds Prints as Blank on Most Browsers

**What goes wrong:**

CSS `background-image` properties are not printed by default in most browsers. Chrome and Safari both default to not printing background images unless the user enables "Background graphics" in the print dialog. The app has existing print CSS for the reports page (established in v2.2). Adding photography as a decorative background on the dashboard or project detail pages will produce blank white areas or missing dark gradient backgrounds when printed. More critically, if the dark background is used to create contrast for white text (gold-on-dark-photo pattern), removing the background leaves white text on white paper — illegible.

**Why it happens:**

Print CSS was implemented for the reports page tables, which had no background images. Extending the design to photography introduces a new print rendering category that the existing print CSS does not handle.

**Consequences:**

Reports and project detail pages sent to auditors via print-to-PDF will have broken layouts with invisible text.

**Prevention:**

In the `@media print` CSS block, add explicit overrides for any container that uses photography as a background:

```css
@media print {
  .hero-section,
  .dashboard-header-photo {
    background-image: none !important;
    background-color: white !important;
    color: #1a1a1a !important;
  }
}
```

Photography backgrounds should only be used on sections that are non-functional decorations (hero banners, landing page sections). Never use photography as the background for data-containing cards or form areas that may be printed. Use solid color fallbacks for all text-bearing sections.

**Detection:**

Open the browser print preview for any page that uses a photography background. Confirm no text is white-on-white.

**Phase to address:** UI/UX Overhaul phase — write print CSS overrides for every photography section before finalizing the visual design.

**Confidence:** HIGH — print CSS behavior for backgrounds is a documented browser default. The issue is well-known in web development.

Sources: [Print Styles pitfalls](https://blog.pixelfreestudio.com/print-styles-gone-wrong-avoiding-pitfalls-in-media-print-css/)

---

### Pitfall 14: Large Photography Assets Cause First-Load Performance Regression on Compliance Pages

**What goes wrong:**

A high-resolution construction photograph used as a hero background (e.g., 3000 x 2000 px, 2-4 MB) will block the Largest Contentful Paint (LCP) if served without size reduction or modern format encoding. The dashboard, which contractors use daily, will load noticeably slowly on standard office broadband. More critically, the Vite build does not automatically optimize or compress images in the `/public` directory.

**Why it happens:**

Images are added to the repository from a camera or stock library at original resolution. The Vite build copies them unchanged to the output bundle.

**Consequences:**

Dashboard LCP degrades from <1s (current, no images) to 5-8s (unoptimized hero photo). This is particularly noticeable on cloud hosting with cross-region latency.

**Prevention:**

Before adding any photography asset:
1. Resize to the maximum CSS render size (e.g., a 1440px wide hero needs at most a 1440px image, ideally 2880px for 2x DPR)
2. Compress to WebP format (target: < 200 KB for a hero background)
3. Use `loading="lazy"` for below-fold photos
4. Use CSS `background-size: cover` with a solid color fallback that renders immediately while the image loads

For the landing page hero section, add `<link rel="preload" as="image" href="/hero-construction.webp">` in the `<head>` to start the download before the CSS is parsed.

**Detection:**

Run Lighthouse on the deployed production URL after adding photography. LCP should stay under 2.5 seconds. A score below this indicates the images need further optimization.

**Phase to address:** UI/UX Overhaul phase — size and compress images before adding them to the repository.

**Confidence:** HIGH — Lighthouse LCP metrics are well-established. WebP compression ratios are documented.

Sources: [Image optimization for web performance](https://www.debugbear.com/blog/image-optimization-web-performance)

---

### Pitfall 15: TailwindCSS v4 `@theme` Background Image Registration for Photography Has Different Syntax Than v3

**What goes wrong:**

In TailwindCSS v4, background images are registered in the `@theme` block as `--background-image-<key>: url(...)`, not as a `backgroundImage` key in `tailwind.config.js` (which no longer exists). If a developer attempts to register the photography hero background using v3 syntax (by creating a `tailwind.config.js` alongside the `@theme` setup), it will silently conflict with v4's CSS-first configuration. The result is either no background image or an import resolution error.

**Why it happens:**

The v3 → v4 migration for this project was completed in v2.1, but documentation and examples online are still predominantly v3-syntax. New photography assets are added by developers who find a v3 tutorial.

**Prevention:**

Register photography backgrounds in `src/client/index.css` inside the existing `@theme` block:

```css
@theme {
  --background-image-hero-construction: url('/hero-construction.webp');
}
```

Then use `bg-hero-construction` class in JSX. Do not create a `tailwind.config.js` file. Do not use the v3 `backgroundImage` configuration key.

**Phase to address:** UI/UX Overhaul phase — add a comment to `index.css` documenting the image registration pattern before adding photography.

**Confidence:** HIGH — TailwindCSS v4 documentation confirms CSS-first configuration and the `--background-image-*` custom property pattern.

Sources: [TailwindCSS v4.0 announcement](https://tailwindcss.com/blog/tailwindcss-v4), [TailwindCSS background-image docs](https://tailwindcss.com/docs/background-image)

---

### Pitfall 16: Drizzle Migration Journal Must Still Be Manually Updated for Double-Time Schema Columns

**What goes wrong:**

This was documented as a critical pitfall in v2.3 (PITFALLS.md on file, Pitfall 13). It remains relevant for v2.4: the California A-1-131 implementation requires adding `monDt` through `sunDt` double-time columns and potentially a `stateFormType` column to the `payrollEntries` table. These are add-only migrations in the `src/server/db/migrations/` directory that must also be registered in `meta/_journal.json` with the correct sequential `idx`. Drizzle silently skips unregistered files.

**Prevention:**

Before writing any CA/WA form generation code, run the schema migration and verify:
```sql
SELECT sql FROM sqlite_master WHERE name = 'payroll_entries';
```
New columns must be visible before any form code is written.

**Phase to address:** State Forms phase — this is the first step before any form logic.

**Confidence:** HIGH — observed in this codebase's v2.3 implementation.

---

## Minor Pitfalls

### Pitfall 17: pdf-lib Coordinate System Origin Is Bottom-Left — CA and WA State Forms Have Different Dimensions Than WH-347

**What goes wrong:**

The WH-347 form is a specific PDF size. California A-1-131 and Washington F700-065-000 are different forms with different page dimensions and different coordinate layouts. The existing `fillWh347()` function uses hardcoded coordinate constants (e.g., `WH347_FIELDS.checkboxFinal = { page: 0, x: 39, y: 497 }`). If a developer attempts to build the CA form by modifying these constants without re-measuring against the actual state form PDFs, fields will print in wrong positions.

pdf-lib measures from the bottom-left corner of the page. The y=0 origin is the bottom of the page. A form that visually shows a field "near the top" will have a high y value. This is counterintuitive and causes off-by-significant-amounts errors when guessing coordinates.

**Prevention:**

For each state form: open the official PDF in Adobe Acrobat or Acrobat Reader, enable "Show cursor coordinates" in preferences, and measure the actual position of each field. Create a separate constants file `wh347Fields.ts` → `dirA1131Fields.ts` → `waF700Fields.ts`. Never reuse WH-347 coordinate constants for state forms.

**Phase to address:** State Forms phase — measure coordinates before writing any form fill code.

**Confidence:** HIGH — documented in the pdf-lib GitHub issues and the project's own WH-347 implementation history.

---

### Pitfall 18: Express Static File Serving Order — API Routes Must Be Registered Before the SPA Catch-All

**What goes wrong:**

The Express production setup serves the Vite build as static files with a catch-all `GET *` handler that returns `index.html` for client-side routing. If the catch-all is registered before the API routes, every API call (`GET /api/projects`) matches the catch-all first and returns HTML. The frontend receives HTML where it expects JSON, produces a parse error, and appears broken.

**Why it happens:**

The static serving setup is often added to the bottom of `server.ts` without checking the route registration order. The catch-all route is registered before the API route setup.

**Prevention:**

Register in this order:
1. All API routers (`app.use('/api', ...)`)
2. Static file serving (`app.use(express.static(...))`)
3. SPA catch-all (`app.get('*', ...)`)

The catch-all must be the last route registered. Add a comment: "SPA catch-all must be last — after all API routes."

**Detection:**

After adding static serving, make a direct `curl` call to `GET /api/projects` and confirm the response is JSON, not HTML.

**Phase to address:** Deployment phase.

**Confidence:** HIGH — documented Express pattern. This is a common mistake.

---

### Pitfall 19: CSV Export Column Order Must Match WH-347 Field Order for Auditor Usability

**What goes wrong:**

The CSV export from the compliance history page is a new v2.4 feature. If columns are ordered by database schema column order (which is implementation order, not logical audit order), the exported CSV will be confusing for a DOL auditor who expects: worker name, SSN last 4, trade, week ending, hours by day, gross wages, deductions, net pay, compliance status. A CSV that starts with internal IDs and has columns ordered randomly creates friction during an audit review.

**Prevention:**

Define the CSV column order explicitly in the export function. Map the column spec to the WH-347 field order as a reference. Add a descriptive header row (not just database field names).

**Phase to address:** Dashboard/CSV export phase.

**Confidence:** MEDIUM — based on auditor usability best practices; no official column order mandate found.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| CA State Form | Daily OT schema missing — CA requires per-day DT hours | Add `monDt`-`sunDt` columns before writing any CA form logic |
| CA State Form | Fringe contributions placed in deductions column | Separate form-filler logic keeps fringe in fringe section only |
| CA State Form | PDF download implies full compliance — eCPR portal submission still required | Bake eCPR portal disclosure into the download preflight modal |
| WA State Form | SAM.gov trade classification strings ≠ L&I four-letter craft codes | Build a mapping table; provide UI dropdown for unmapped classifications |
| WA State Form | Reusing COMP-03 ratio logic for WA 15% apprentice hours requirement | New `computeWashingtonApprenticeCoverage()` function, project-level cumulative |
| Guidance UX | Radix TooltipProvider at app root → all tooltips re-render on any hover | Scope provider close to tooltip groups; use `?` icon buttons for touch |
| Guidance UX | Hover-only tooltips invisible on iPad (tablet use case) | All tooltips triggered by a tappable icon button, not just hover |
| UI/UX Overhaul | Photography backgrounds disappear when printing; dark background leaves white text on white paper | `@media print` overrides for all photo backgrounds before finalizing design |
| UI/UX Overhaul | Uncompressed photography assets slow dashboard LCP | WebP, max 200 KB per asset, preload hint for hero images |
| UI/UX Overhaul | v3-style `backgroundImage` config key conflicts with v4 `@theme` | Register background images in `@theme` block in `index.css` only |
| Production Deployment | SQLite database erased on redeploy — no persistent volume | First deployment step: configure and verify persistent volume mount |
| Production Deployment | Fly.io `release_command` skips persistent volume — migrations don't apply | Run Drizzle `migrate()` at Express startup, not in fly.toml release command |
| Production Deployment | WAL mode + network filesystem (NFS volume) → potential corruption | Use DELETE journal mode in production; WAL only on local disk |
| Production Deployment | JWT cookie breaks if API and frontend on different origins | Serve frontend as static files from same Express server; `SameSite=Lax` works |
| Production Deployment | `VITE_`-prefixed secrets exposed in browser bundle | Never prefix SAM.gov key, JWT secret, or DB path with `VITE_` |
| CSV Export | Column order doesn't match auditor expectations | Define explicit column map ordered by WH-347 field convention |
| Schema Changes | New OT/DT columns not registered in Drizzle journal | Manual `_journal.json` registration + post-migration schema verification |

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| DB wiped on redeploy (no persistent volume) | HIGH — data loss | Restore from Litestream backup if configured; otherwise manual re-entry; implement persistent volume immediately |
| Migrations run against temp VM (Fly.io release_command) | MEDIUM — schema out of sync | SSH into prod container, run `sqlite3 /data/app.db` manually, apply migration SQL; switch to startup-time migration |
| CA form fringe in wrong column | LOW — submission rejected | Regenerate form after fixing form-filler logic; resubmit to eCPR portal |
| CA form missing DT hours | MEDIUM — incorrect certified payroll submitted | Identify affected weeks; regenerate with corrected logic; resubmit to DIR via eCPR; notify awarding agency |
| Photography asset causes LCP > 4s | LOW — performance only | Replace with WebP-compressed version; update URL reference |
| Tooltip inaccessible on tablet | LOW — UX gap | Wrap tooltip in icon button trigger; no data affected |
| `VITE_` secret in bundle | HIGH — credential exposure | Rotate the exposed credential immediately; redeploy with corrected env var prefix; audit all `VITE_` variables |
| WAL mode corruption on NFS volume | HIGH — data loss | Restore from most recent Litestream replica; if no backup, data is lost; switch to DELETE journal mode |

---

## Sources

- [California DIR Certified Payroll Reporting FAQ](https://www.dir.ca.gov/Public-Works/FAQ-certified-payroll-reporting.html)
- [California DIR Prevailing Wage FAQ](https://www.dir.ca.gov/dlse/FAQ_PrevailingWage.html)
- [DIR eCPR XML Guidelines v1.9](https://www.dir.ca.gov/public-works/eCPRXMLGuideline1.9.pdf)
- [DIR Public Works Certified Payroll Reporting](https://www.dir.ca.gov/public-works/certified-payroll-reporting.html)
- [Caltrans Labor Compliance Manual Chapter 10](https://dot.ca.gov/programs/construction/labor-compliance/labor-compliance-manual/chapter-10)
- [Ogletree: California SB 854 eCPR requirement](https://ogletree.com/insights-resources/blog-posts/california-public-works-contractors-will-be-required-to-submit-payroll-records-electronically-starting-august-1/)
- [LCPtracker: CA Prevailing Wage Q&A](https://lcptracker.com/blog-post/qa-california-prevailing-wage-and-certified-payroll-requirements/)
- [Washington L&I Prevailing Wage Suite](https://secure.lni.wa.gov/wagelookup/)
- [MRSC: Navigating Intents and Affidavits (March 2025)](https://mrsc.org/stay-informed/mrsc-insight/march-2025/intents-affidavits-prevailing-wages)
- [Points North: Washington Certified Payroll Reporting](https://www.points-north.com/state-by-state-certified-payroll-reporting/washington)
- [Points North: Apprenticeship Ratios and Prevailing Wage](https://www.points-north.com/trends-and-insights/apprenticeship-ratios-prevailing-wage-requirements)
- [Workyard: Washington Prevailing Wage Guide 2025](https://www.workyard.com/us-labor-laws/prevailing-wage-washington-state)
- [Render Persistent Disks documentation](https://render.com/docs/disks)
- [Fly.io SQLite documentation (Node.js / Prisma)](https://fly.io/docs/js/prisma/sqlite/)
- [Fly.io All-In on SQLite + Litestream](https://fly.io/blog/all-in-on-sqlite-litestream/)
- [Fly.io community: SQLite migration with persistent volume](https://community.fly.io/t/deploy-sqlite-with-persistent-volume-not-migrating/18712)
- [Fly.io SQLite WAL internals](https://fly.io/blog/sqlite-internals-wal/)
- [Radix UI Tooltip re-render issue #2375](https://github.com/radix-ui/primitives/issues/2375)
- [Radix UI Tooltip re-render issue #3596](https://github.com/radix-ui/primitives/issues/3596)
- [TailwindCSS v4.0 announcement and CSS-first config](https://tailwindcss.com/blog/tailwindcss-v4)
- [Vite environment variable documentation](https://vite.dev/guide/env-and-mode)
- [MDN: HTTP Cookies (SameSite / Secure)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)
- [Print CSS background image pitfalls](https://blog.pixelfreestudio.com/print-styles-gone-wrong-avoiding-pitfalls-in-media-print-css/)
- [DebugBear: image optimization for web performance](https://www.debugbear.com/blog/image-optimization-web-performance)
- SQLite documentation: [File locking and WAL concurrency](https://sqlite.org/lockingv3.html)

---
*Pitfalls research for: v2.4 — state forms, guidance UX, UI overhaul, production deployment*
*Researched: 2026-03-24*
*Previous PITFALLS.md (v2.3 features) archived in this overwrite — v2.3 pitfalls are resolved and shipped.*
