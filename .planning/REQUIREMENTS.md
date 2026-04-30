# Requirements: v6.0 — Competitive Industry Leadership

**Milestone goal:** Achieve best-in-class scores on every dimension of the COMPETITIVE_ANALYSIS.md scoring matrix — beating B2Gnow (7.0) and Knowify (6.1) across all 12 categories. Priority order: Phase A (UI Polish + Trust) → Phase B (Power Features) → Phase C (Mobile/Field PWA) → Phase D (Market Credibility).

**Research artifacts:** `.planning/research/STACK.md`, `.planning/research/FEATURES.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md`, `.planning/research/SUMMARY.md`, `.planning/research/WATCHDOG-B2GNOW.md`, `.planning/research/WATCHDOG-KNOWIFY.md`

**Watchdog grading:** Watchdog Alpha (B2Gnow) + Watchdog Beta (Knowify) grade each phase before advancement. Required pass thresholds from WATCHDOG files.

**Continues numbering from:** Phase 63. v6.0 phases begin at Phase 64.

---

## Phase A: UI Polish + Trust Signals

Target: UI/UX score 8.5+ (currently 7.3, need to beat Knowify's 7.3 and B2Gnow's 5.3).

### Feature Area A1: Page-Level Visual Polish

- [ ] **UI-01** — Apply premium design treatment (CSS token-consistent elevated cards, shadow-card-elevated, section headers, action buttons) to `ProjectDetailPage.tsx` — matches landing page quality level, not just "functional." Watchdog criterion: project detail feels premium, not utilitarian.
- [ ] **UI-02** — Apply premium treatment to `PayrollListPage.tsx` — week rows use card elevation, status badges use design tokens (compliant = emerald, violations = crimson, submitted = gold), empty state has specific action guidance. No raw `<div>` + inline style rows.
- [ ] **UI-03** — Apply premium treatment to `PayrollWeekDetailPage.tsx` — worker rows use alternating row tint, violation callouts use amber/crimson inline alerts, download buttons grouped into a sticky action bar at bottom. Mobile-readable at 375px.
- [ ] **UI-04** — Apply premium treatment to `WorkersPage.tsx` — worker cards with avatar initials, role badge, union local chip; filter chips for trade classification; empty state with specific "Add your first worker" CTA. No raw table rows.
- [ ] **UI-05** — Apply premium treatment to `ReportsPage.tsx` — report cards with icon, description, and "Generate" CTA; PDF preview loading skeleton; success state with download link and timestamp.
- [ ] **UI-06** — Page transition animations: add `framer-motion` `AnimatePresence` fade-slide (100ms ease-out) on route changes for all protected pages. No animation on form submits — only route-level transitions.

### Feature Area A2: Mobile-Responsive Audit

- [ ] **UI-07** — Full mobile-responsive audit of all 25 app pages at 375px, 768px, 1024px breakpoints. All tables convert to card-stacked layout on mobile. All action buttons meet 44px minimum tap target. No horizontal scroll on any page at 375px.
- [ ] **UI-08** — Sidebar navigation collapses to hamburger menu on mobile (`<768px`). Navigation drawer opens as slide-in panel with backdrop. All nav links reachable without horizontal scroll. Active route highlighted in drawer.
- [ ] **UI-09** — All form inputs on mobile use `font-size: 16px` minimum (prevents iOS auto-zoom). All date pickers, select menus, and file inputs are touch-optimized.

### Feature Area A3: Loading + Empty States

- [ ] **UI-10** — Skeleton loading states on all data-fetching pages: `DashboardPage`, `ProjectDetailPage`, `PayrollListPage`, `WorkersPage`, `ReportsPage`. Skeleton matches the layout of loaded content (not generic spinner). No page shows blank white during load.
- [ ] **UI-11** — Empty state components on all list views with: illustration (SVG icon), specific action-oriented headline, CTA button to create first item. Empty states are contextual — Dashboard empty ≠ Workers empty ≠ PayrollList empty.

### Feature Area A4: Landing Page + Trust Signals

- [ ] **UI-12** — Landing page hero upgrade: add real construction site photography (WebP, <200KB), subheadline clarifies "8 states, bank-grade SSN encryption, pricing you can see in 5 seconds." Hero CTA is "Start Free — No Credit Card."
- [ ] **UI-13** — Social proof section on landing page: HCC (Houston Construction Council) logo + quote testimonial. "Trusted by contractors on $X in prevailing wage projects." Add two placeholder customer logos with "Client" label if real logos unavailable — placeholders are better than no social proof.
- [ ] **UI-14** — "How it Works" 4-step visual flow on landing page (with icon + number for each step): 1. Add Project → 2. Enter Payroll → 3. Check Compliance → 4. Download CPR. Replaces current text-only section.
- [ ] **UI-15** — 50-state coverage roadmap visualization on landing page: visual US map grid (SVG, not Mapbox) showing 8 active states (filled gold) + remaining states (outlined, "Coming Soon" tooltip on hover). Updates when new states ship.
- [ ] **UI-16** — Pricing page clarity upgrade: add "vs. Manual CPR" time-saved calculator widget. Inputs: payroll weeks/month, workers/project. Output: "Save X hours/month." Positioned above pricing tier table. Static calculation — no backend.
- [ ] **UI-17** — SOC 2 observation period begins NOW: add `security_events` table (id, user_id, event_type, ip_address, user_agent, metadata JSON, created_at) and `login_attempts` table (id, email, success boolean, ip_address, created_at, failure_reason). Wire to existing auth routes. This is Phase A (not Phase D) because the SOC 2 observation clock must start early.

---

## Phase B: Power Features

Target: Integrations 9.0+ (currently 6.3), Compliance 9.5+ (currently 8.4).

### Feature Area B1: QuickBooks Online OAuth Integration

- [ ] **QB-01** — "Connect to QuickBooks" OAuth 2.0 flow: button on IntegrationsPage (new page under Settings). Initiates PKCE OAuth with `com.intuit.quickbooks.accounting` scope. Callback at `/api/integrations/qbo/callback`. Access token (1hr TTL) and refresh token (100-day cliff) stored AES-256-GCM encrypted using existing cryptoService pattern — never in plaintext.
- [x] **QB-02** — `GET /api/integrations/qbo/employees` — pulls QB Online Employee list into a preview table. User selects which employees to import as Workers on a project. Maps `DisplayName` → worker name, `SSN` → encrypted SSN (if present in QB), `PrimaryAddr` → worker address fields.
- [x] **QB-03** — `GET /api/integrations/qbo/timeactivities?startDate=&endDate=&projectId=` — pulls `TimeActivity` records from QB for the selected date range and routes them through the existing `importService.ts` pipeline (worker matching, conflict detection, preview/commit). Replaces the CSV download step for QB Online users. Hours mapped to existing payroll entry format (daily M-Su split requires user confirmation if QB stores weekly totals only).
- [ ] **QB-04** — QB connection status badge on IntegrationsPage: connected (green, shows realm name + expiry), disconnected (gray, "Connect" CTA), token near expiry (amber, "Reconnect" CTA). Refresh token rotation handled server-side on every API call — never allow 100-day cliff to expire silently.
- [ ] **QB-05** — Disconnect QB: revoke token via Intuit API, delete stored tokens, reset connection status. Audit log entry on connect and disconnect.

### Feature Area B2: Apprenticeship Ratio Enforcement

- [x] **APP-01** — Per-trade apprenticeship ratio configuration on projects: `apprenticeship_requirements` JSON column on `projects` table. UI on ProjectForm shows a "Apprenticeship Ratios" section (visible when funding type is federal/state): trade classification dropdown + ratio input (e.g., "1:2" meaning 1 apprentice per 2 journeyworkers). Supports multiple trades per project.
- [x] **APP-02** — Worker profile gains `apprenticeship_program_name` (text) and `rapids_number` (text) fields on WorkersPage when worker labor type is apprentice. These are shown/required alongside existing `isApprenticeship` boolean.
- [x] **APP-03** — New compliance violation `COMP-04`: per-trade daily ratio check. On payroll week save, for each trade present in the week: compute `jw_hours` and `apprentice_hours` per day. If `apprentice_hours > jw_hours * ratio`, fire COMP-04 with trade, day, excess hours, and estimated additional wage liability (excess hours × (JW rate − apprentice rate)). Replaces the existing per-week aggregate NYS flag with a per-trade per-day check.
- [x] **APP-04** — IRA/IIJA apprenticeship percentage tracker: project-level setting for "IRA/IIJA clean energy project" boolean. When true, dashboard shows "Apprentice Hours %: X% of Y total hours" alongside the 15%-of-hours threshold indicator. Fires COMP-05 violation if apprentice % drops below 15% on any week.
- [x] **APP-05** — Apprenticeship violation detail in PayrollWeekDetailPage: violation panel shows per-trade breakdown — "Electricians: 4 apprentice hrs, 2 JW hrs (max: 2). Excess: 2 hrs. Est. wage adjustment: $XX." — not just a generic ratio flag.

### Feature Area B3: DBE/MBE/WBE Certification Tracking

- [x] **DBE-01** — New `subcontractor_certifications` table: id, subcontractor_id (FK → subcontractors, CASCADE DELETE), cert_type (ENUM: DBE/MBE/WBE/SBE/ACDBE/8a/HUBZone — multi-value via CSV column), certifying_agency (text), cert_number (text), naics_codes (text — comma-separated), issue_date (date), expires_date (date), owner_race (text), owner_gender (text), personal_net_worth_usd (integer), reevaluation_status (ENUM: not_required/pending/cleared/suspended — DOT IFR Oct 2025), self_certified (boolean), document_path (text), created_at, updated_at.
- [x] **DBE-02** — Certification CRUD on SubcontractorPanel: "+ Add Certification" form per sub with all fields from DBE-01. Edit and delete within panel. Multiple certs per sub supported (e.g., a firm can be both DBE and WBE).
- [x] **DBE-03** — Certification expiration alerts: at 90/60/30 days before `expires_date`, send Resend email to project owner with sub name, cert type, and days remaining. Reuses existing Resend email infrastructure and scheduled check pattern from compliance alerts.
- [x] **DBE-04** — CPR upload gate: if a subcontractor's active certification is expired or in `reevaluation_status = 'suspended'`, block their CPR upload with inline warning: "Sub's DBE certification expired — resolve before accepting CPR." Warning shown in SubcontractorPanel and on public upload portal.
- [x] **DBE-05** — DBE participation summary on ProjectDetailPage: "DBE/MBE/WBE Participation" card showing: active certified subs count, expired cert warnings count, subs under DOT reevaluation count. Clicking opens the sub certification detail view.
- [x] **DBE-06** — DOT IFR 2025 reevaluation status field is prominently labeled "DOT Oct 2025 IFR Status" in UI with tooltip explaining the rule change. Certs imported before Oct 3, 2025 default to `reevaluation_status = 'pending'` with advisory to verify current status.

### Feature Area B4: Real-Time Compliance Dashboard

- [x] **DASH-01** — Dashboard hero stat row: "X Active Projects | Y Open Violations | Z Weeks Due This Week." Stats computed from batch compliance summary (existing endpoint, extend to include due-this-week count). Updates on page load (no WebSocket — React Query staleTime 60s).
- [x] **DASH-02** — Compliance trend chart on DashboardPage: weekly violation count over the last 12 weeks (line chart using existing recharts dependency if present, or a lightweight SVG chart). Shows "getting better" or "getting worse" trend at a glance.
- [x] **DASH-03** — Projects-at-risk panel: top 5 projects with open violations older than 7 days, sorted by violation count. Each row shows project name, violation count, and "Resolve" link. Shown below the stat row.
- [x] **DASH-04** — Compliance violation live counter on project cards: project card badges updated to show specific violation count (not just "Has Violations" text). "3 violations" badge in crimson with count.

---

## Phase C: Mobile/Field PWA

Target: Mobile/Field score 7.5+ (currently 1.3 vs. B2Gnow's 8.8 and Knowify's 5.8). Closing this gap is the highest-impact competitive move.

### Feature Area C1: PWA Foundation

- [ ] **MOB-01** — Install `vite-plugin-pwa ^1.2.0` + `workbox-window ^7.4.0` + `idb ^8`. Configure `injectManifest` strategy with `prompt` update UI. Web App Manifest: name "PrevailingWage", short_name "PWage", display `standalone`, theme_color matches brand gold, icons at 192×192 and 512×512 (maskable). App installable on iOS/Android home screen.
- [ ] **MOB-02** — Service worker caches app shell (HTML + JS + CSS bundles) and static assets. Workbox `StaleWhileRevalidate` for API reads. API writes (POST/PATCH/DELETE) are never cached — only queued if offline. Cache strategy survives app update (prompt user to refresh on new version).
- [ ] **MOB-03** — Offline queue: IndexedDB store (`idb ^8`) accumulates payroll entry saves when offline. On connectivity restore, Background Sync API flushes the queue via server POST. All offline-queued POSTs carry an `idempotencyKey` (UUID generated at creation time) to prevent duplicate entries on retry. `If-Unmodified-Since` header on sync PUT to prevent rate snapshot corruption.
- [ ] **MOB-04** — Offline indicator banner: sticky banner "You're offline — entries will sync when connected" when `navigator.onLine === false`. Dismissed automatically on reconnect. Never blocks navigation — field workers must be able to continue entering hours offline.
- [ ] **MOB-05** — Draft-to-server safety net: any unsaved payroll entry form state auto-saved to IndexedDB `drafts` store every 30 seconds. Survives iOS background eviction (7-day/50MB limit). On return to the form, if draft is newer than server copy, offer "Restore Draft" prompt.

### Feature Area C2: GPS Clock-In/Clock-Out

- [ ] **MOB-06** — New `time_punches` table: id, project_id (FK), worker_id (FK), punch_type (ENUM: clock_in/clock_out), punched_at (datetime UTC), lat (real), lng (real), accuracy_meters (real), geofence_status (ENUM: inside/outside/unavailable), photo_path (text nullable), created_by_user_id, created_at.
- [ ] **MOB-07** — Projects table gains: `site_latitude` (real), `site_longitude` (real), `site_radius_meters` (integer, default 200), `gps_clock_in_enabled` (boolean, default false). GPS clock-in is opt-in per project (required by CA AB 1355 principles). ProjectForm shows GPS settings section when enabled.
- [ ] **MOB-08** — Clock-in/Clock-out UI on mobile: `/projects/:id/clockin` route shows large "Clock In" button. On tap: `navigator.geolocation.getCurrentPosition()` (not watchPosition — one-shot). Displays accuracy badge (green <50m, amber 50–200m, red >200m). Never hard-blocks on poor accuracy — stores `geofence_status = 'outside'` or `'unavailable'` and continues. No GPS permission = `geofence_status = 'unavailable'` — never block clock-in on permission denial.
- [ ] **MOB-09** — Server-side geofence check on time punch: `haversine(project.siteLat, project.siteLng, punchLat, punchLng) > siteRadiusMeter` → `geofence_status = 'outside'`. Never block the punch server-side — only record the status. GC reviews outside-fence punches in the admin panel.
- [ ] **MOB-10** — GPS punch admin view on ProjectDetailPage: "Field Activity" tab showing all time_punches for the project in reverse chronological order. Columns: worker name, in/out, time, GPS accuracy, fence status (inside/outside/unavailable). Filter by date range. "Outside fence" rows highlighted in amber. Export to CSV.
- [ ] **MOB-11** — Payroll entry auto-population from time punches: button "Import from Clock-In Records" on PayrollWeekDetailPage. Aggregates daily hours from `time_punches` for the week. Splits into ST/OT/DT per worker per day using existing compliance engine rules. Shows preview table before committing. Never overwrites existing payroll entries — merges additive only.

### Feature Area C3: Photo Capture

- [ ] **MOB-12** — Field photo capture linked to payroll week: on PayrollWeekDetailPage (mobile), "Add Photo" button opens device camera via `<input type="file" accept="image/*" capture="environment">`. Photo stored on Render persistent disk at `/var/data/photos/{projectId}/{weekId}/`. Metadata (filename, size, created_at, uploaded_by_user_id) stored in `week_photos` table.
- [ ] **MOB-13** — Photo gallery on PayrollWeekDetailPage: thumbnail grid of all photos for the week. Click to view full-size. "Delete" with confirmation. Photos shown in order of capture time.
- [ ] **MOB-14** — Photo capture linked to time punch: at clock-in, optional "Take Photo" step. Photo saved to `time_punches.photo_path`. Shown in GPS punch admin view alongside punch record. Used as DOL audit defense evidence.

### Feature Area C4: Mobile Sub CPR Submission

- [ ] **MOB-15** — Mobile-optimized public sub CPR upload page: existing token-gated `/upload/:token` page audited for 375px. All file inputs meet 44px tap target. "Choose File" replaced with "Tap to upload or take photo" on mobile. Progress indicator during upload. Success confirmation with submission timestamp.

---

## Phase D: Market Credibility

Target: Market/Trust score 8.0+ (currently 4.5 vs. B2Gnow's 10.0 and Knowify's 5.5). SOC 2 preparation, public API, and economic impact.

### Feature Area D1: SOC 2 Preparation Controls

- [ ] **SEC-01** — TOTP MFA for owner accounts: `otplib ^12.x` + `qrcode ^1.5.x`. Owner-role users prompted to enroll MFA on next login after feature ships. TOTP secret stored AES-256-GCM encrypted alongside SSN envelope. QR enrollment page + backup recovery codes (10 one-time codes, bcrypt-hashed). MFA required on: login, ownership transfer, team invite revocation.
- [ ] **SEC-02** — Centralized log aggregation: pipe Pino JSON output to Logtail/Better Stack via HTTPS drain. All `security_events` and `login_attempts` rows (from UI-17) also forwarded. Logs immutable at destination — not editable via app. 90-day retention minimum. Evidence: log drain URL configured in Render env, confirmed log entries visible in Logtail dashboard.
- [ ] **SEC-03** — Hash chain tamper-evidence on `audit_logs`: add `prev_hash` (text) and `row_hash` (text) columns to `audit_logs`. On each `insertAuditLog()` call: `row_hash = SHA-256(id + action + diff + prev_hash)`. Enables auditor to verify the log has not been modified. Migration adds columns; backfill script hashes existing rows in chronological order.
- [ ] **SEC-04** — Uptime monitoring + public status page: configure Uptime Robot (free tier) on production URL with 5-minute check interval. Instatus (free tier) public status page at `status.prevailingwage.app`. Incident creation is manual — not automated. Status page URL linked in app footer.
- [ ] **SEC-05** — Dependabot enabled on GitHub repo: `dependabot.yml` config for npm weekly security updates. OWASP ZAP baseline scan added to CI (GitHub Actions). ZAP report artifact saved per run. Any HIGH or CRITICAL finding blocks merge. Evidence: Dependabot alerts tab active, ZAP action in CI log.
- [ ] **SEC-06** — Written security policy documentation: `SECURITY_POLICY.md` in repo root. Sections: Data Classification (PII/sensitive/internal), Acceptable Use, Access Control, Incident Response, Vendor Security (Render, Resend, Stripe, Sentry SOC 2 status). Not a code deliverable — document only.

### Feature Area D2: Public REST API + Webhooks

- [ ] **API-01** — API key management: `api_keys` table (id, user_id FK, key_hash SHA-256 — never raw key stored, name, last_used_at, expires_at nullable, created_at). `POST /api/keys` (create), `GET /api/keys` (list — shows name + last4 of key only), `DELETE /api/keys/:id` (revoke). Key shown once on creation — not retrievable after. Rate limit: 100 req/min per key hash (not per IP).
- [ ] **API-02** — Public REST API (v1): `GET /api/v1/projects` — paginated project list. `GET /api/v1/projects/:id` — project detail. `GET /api/v1/projects/:id/payroll-weeks` — list payroll weeks. `GET /api/v1/projects/:id/payroll-weeks/:weekId/compliance` — compliance result for a week. All endpoints: Bearer token (API key) auth, JSON response, rate-limited, audit logged. No write endpoints in v1.
- [ ] **API-03** — OpenAPI 3.1 spec: `openapi.json` in repo root, auto-generated from route definitions. Served at `GET /api/docs` (JSON) and rendered at `GET /api/docs/html` (Swagger UI). Spec includes all v1 endpoints, request/response schemas, authentication description.
- [ ] **API-04** — Webhook delivery: `webhooks` table (id, user_id FK, url, events JSON array, secret, active boolean, created_at). `POST /api/webhooks` (register), `GET /api/webhooks`, `DELETE /api/webhooks/:id`. SSRF protection: before saving URL, DNS pre-resolve and block RFC 1918 ranges (10.x, 172.16–31.x, 192.168.x). Payload signed with HMAC-SHA-256 (`X-PW-Signature` header). Events: `payroll_week.created`, `payroll_week.submitted`, `compliance.violation_detected`.
- [ ] **API-05** — Webhook delivery queue: SQLite-backed `webhook_deliveries` table. `setInterval` polling (30s) attempts delivery; exponential backoff, max 5 attempts, then `status = 'failed'`. Delivery log viewable in Settings → Webhooks. Failed deliveries show last error + retry count. Manual "Retry" button.

### Feature Area D3: Government Case Study + Economic Impact

- [ ] **TRUST-01** — Government case study page at `/case-studies/hcc` — highlights HCC project: project type, prevailing wage obligation, states covered, key benefit ("eliminated 8 hours/week of manual CPR preparation"). No sensitive project data — only GC's approved narrative. Linked from landing page "Trusted by" section.
- [ ] **TRUST-02** — Economic Impact dashboard on DashboardPage (new tab "Impact"): 8 metrics:
  1. Total gross wages paid (all projects, all time)
  2. Total prevailing wage hours (all projects)
  3. JW vs. apprentice hour split (%)
  4. Local hire % (worker home zip vs. project zip — both already collected)
  5. Compliance rate % (weeks passing / total weeks)
  6. Certified subs count (active + certified)
  7. DBE/MBE/WBE participation count
  8. States covered (count of distinct project states)
  
  Metrics computed from existing data — no new data collection required except local hire % (requires worker zip comparison). Export to PDF button using existing PDF pattern.
- [ ] **TRUST-03** — "About" page update at `/about`: company mission statement, team (placeholder if no real team photos), tech stack transparency ("AES-256-GCM SSN encryption, SOC 2 in progress, 8 states covered"). Builds trust with government procurement offices who evaluate vendor credibility.

---

## Future Requirements (Deferred)

- **QB bi-directional write (push CPR back to QB):** Requires Intuit Silver partnership ($300/mo). Defer until user base justifies cost.
- **RAPIDS API for apprenticeship program verification:** API availability unconfirmed. Manual `rapids_number` field is correct MVP.
- **Geographic impact map (worker zip codes plotted on Mapbox):** High complexity vs. compliance value. TRUST-02 ships local hire % as a flat number first.
- **Public DBE directory lookup (live DOT DBELO pull):** Different state registries, maintenance-heavy. Manual entry + document upload is correct GC-use-case MVP.
- **SOC 2 Type II report (certification achieved):** Minimum 9–18 month observation period after Phase D controls are live. Phases A–D start the clock.
- **Breadcrumb route tracking during shift:** Battery-intensive, privacy concerns — opt-in only after GPS clock-in is adopted.
- **More than 8 states:** TX/FL/MA/NJ shipped in v5.0. Additional states (CO, OH, PA, MN) are v6.1+ scope.

---

## Out of Scope (v6.0)

| Excluded | Reasoning |
|----------|-----------|
| B2Gnow-style 160+ canned reports | Report sprawl; 90% unused; 8–10 high-value metrics is better UX |
| Native iOS/Android App Store submission | PWA with `display: standalone` is functionally equivalent for this use case; no App Store review latency |
| Hardware time clock device | B2B hardware sales model — not our play |
| Biometric facial verification | BIPA liability in IL; overkill for prevailing wage context |
| Building a certifying agency portal (DBE issuer) | That is B2Gnow's 25-year moat; we track certs, not issue them |
| QB Desktop API | Sunset/deprecated; QB Online only |
| Real-time streaming dashboard (WebSocket) | Overkill for weekly payroll cadence; React Query staleTime polling is sufficient |

---

## Traceability

| REQ-ID | Phase | Category | Beats Competitor |
|--------|-------|----------|-----------------|
| UI-01 to UI-11 | Phase A (64–67) | UI/UX | Knowify (7.3→8.5) |
| UI-12 to UI-16 | Phase A (64–67) | Market/Trust | Knowify (5.5→8.0) |
| UI-17 | Phase A (64) | Security | SOC 2 clock starts |
| QB-01 to QB-05 | Phase B (68–69) | Integrations | Knowify (7.7→9.0) |
| APP-01 to APP-05 | Phase B (68–70) | Compliance | B2Gnow (7.6→9.5) |
| DBE-01 to DBE-06 | Phase B (71–72) | Sub Mgmt | B2Gnow (9.3→8.0) |
| DASH-01 to DASH-04 | Phase B (73) | Reporting | B2Gnow (8.0→9.0) |
| MOB-01 to MOB-05 | Phase C (74) | Mobile/Field | B2Gnow (8.8→7.5+) |
| MOB-06 to MOB-11 | Phase C (75) | Mobile/Field | B2Gnow gap close |
| MOB-12 to MOB-14 | Phase C (76) | Mobile/Field | Differentiator |
| MOB-15 | Phase C (77) | Mobile/Field | Sub CPR mobile |
| SEC-01 to SEC-06 | Phase D (78–79) | Security | B2Gnow (9/10→match) |
| API-01 to API-05 | Phase D (80–81) | Integrations | B2Gnow (6/10→9/10) |
| TRUST-01 to TRUST-03 | Phase D (82) | Market/Trust | Market credibility |
