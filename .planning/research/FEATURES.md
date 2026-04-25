# Feature Landscape: Prevailing Wage v6.0 Competitive Upgrade

**Domain:** Construction prevailing wage compliance SaaS
**Researched:** 2026-04-24
**Milestone:** v6.0 — Beat B2Gnow and Knowify on all scored dimensions
**Scope:** NEW capabilities only. All existing features (WH-347, 8 state forms, CSV import, RBAC, AES-256 encryption, violation detection, audit log, sub CPR tracking, Stripe, Resend, DOL lookup) are excluded from this analysis.

---

## Research Question 1: Mobile Field App (GPS Clock-In, Offline Sync, Photo Capture)

### Table Stakes (expected by any serious buyer in 2025)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| GPS clock-in/out with location stamp | All competitors have it: B2Gnow FieldReporter, Knowify iOS/Android, Workyard, ClockShark | Medium | `navigator.geolocation` API; 30-foot accuracy is the 2025 standard |
| Offline capability with auto-sync | Workyard, busybusy, ClockShark, allGeo all support offline; buyers expect this | Medium-High | Service worker + IndexedDB + Background Sync API pattern |
| Geofencing / site boundary enforcement | B2Gnow FieldInspector, Knowify/eBacon, SmartBarrel all offer geofencing | Medium | Haversine distance check against project lat/lng at clock-in server side |
| PWA installable on mobile home screen | Standard pattern for web-first apps competing with native | Medium | Web App Manifest + service worker; no App Store friction or review latency |

### Differentiators (valued but not universally expected)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Photo capture linked to payroll week | Field documentation for DOL audit defense — beyond what Knowify offers | Medium | `MediaDevices.getUserMedia()` in PWA; store blob with payroll_week_id |
| Geofence auto-clock-out on departure | Prevents forgotten clock-outs on prevailing wage jobs | Medium | Geo-boundary exit event via service worker geolocation watch |
| Mobile sub CPR submission | GC can require subs to submit from phone; closes sub CPR loop on mobile | High | Token-gated public upload page optimized for mobile viewport |
| Breadcrumb route tracking during shift | Proves worker was on-site for DOL investigation | High | Continuous geolocation polling at 5-min intervals; battery-intensive; must be opt-in per project |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Biometric facial verification | BIPA liability in IL; alienates workers; overkill for prevailing wage context | GPS geofencing is sufficient for compliance audit defense |
| Hardware time clock device | B2B hardware sales, supply chain, support overhead — not a software play | PWA on worker's own device or GC's tablet |
| Continuous breadcrumb tracking default-on | Battery drain; privacy concerns; worker resistance | Opt-in per-project setting for high-scrutiny federal jobs |
| Native iOS/Android App Store submission | Review latency, separate codebase, no meaningful compliance advantage | PWA with `display: standalone` is functionally equivalent for this use case |

### Implementation Pattern (HIGH confidence)

```
Workbox service worker caches app shell + assets
  ↓
IndexedDB stores clock-in events offline (idb-keyval or Dexie.js)
  ↓
Background Sync API queues server POST when connectivity returns
  ↓
Server receives { projectId, workerId, lat, lng, timestamp, photoBlob? }
  ↓
Geofence check: haversine(project.lat, project.lng, lat, lng) < project.radiusMeters
  ↓
Writes to time_punches table; violation flag if outside geofence
```

### Feature Dependencies

- GPS clock-in requires `projects` table to gain `lat`, `lng`, `radius_meters` columns
- Photo capture requires file storage (Render persistent disk is sufficient at current SQLite scale)
- Offline sync requires service worker registration in Vite build config
- Geofence check must be server-side (never trust client-only validation)

---

## Research Question 2: QuickBooks Online OAuth Integration

### What Actually Exists (MEDIUM confidence — official Intuit docs inaccessible to scraping; verified via multiple secondary sources including Intuit's own developer blog)

**OAuth 2.0 flow:**
- Standard PKCE-based OAuth 2.0
- App registered at developer.intuit.com
- Scopes: `com.intuit.quickbooks.accounting` (covers TimeActivity + Employee) for basic integration; `com.intuit.quickbooks.payroll.timetracking` for premium APIs
- Access token TTL: 1 hour; refresh token TTL: 100 days
- Sandbox environment available; production requires Intuit app listing review

**Relevant API objects for payroll data sync:**

| Object | Endpoint Pattern | Key Fields | Use For |
|--------|----------|-----------|---------|
| `Employee` | `/v3/company/{realmId}/employee` | `DisplayName`, `SSN`, `HourlyRate`, `PrimaryAddr` | Worker roster sync |
| `TimeActivity` | `/v3/company/{realmId}/timeactivity` | `TxnDate`, `Hours`, `Minutes`, `HourlyRate`, `NameOf`, `EmployeeRef`, `CustomerRef` | Hours-by-day import (replaces CSV step) |
| `PayrollItem` | `/v3/company/{realmId}/payrollitem` | Pay type, rate, wage base | Rate reference |
| Payroll Compensation API (Premium) | New Time API — launched Nov 2025 | Salary, hourly, OT, holiday pay types | Full bi-directional payroll sync |

**Critical discovery — cost barrier introduced 2025 (HIGH confidence):**

The Intuit App Partner Program (launched mid-2025) introduced metered API pricing. Full variable fees began November 1, 2025:

| Tier | Cost/Month | API Credits | Payroll Compensation Access |
|------|-----------|-------------|----------------------------|
| Builder | $0 | 500K then blocked | No |
| Silver | $300 | 1M credits | Yes (min tier) |
| Gold | $1,700 | 10M credits (requires 500+ active connections) | Yes |
| Platinum | $4,500 | 75M credits (requires 3,000+ connections) | Yes |

**Practical implication:** `TimeActivity` read (time records) falls under standard `accounting` scope — available at Builder tier but now metered. The Payroll Compensation API (rich wage data) requires Silver tier minimum at $300/month. This is only worth paying at scale (50+ active QB-connected users).

**Recommended v6 scope:** OAuth + `TimeActivity` pull (replaces the CSV download step QB users already do). This is achievable at Builder tier. Save full payroll compensation sync for post-launch when user base justifies Silver partnership.

### Table Stakes vs Differentiating

| Feature | Classification | Notes |
|---------|---------------|-------|
| OAuth "Connect to QuickBooks" button | Table stakes to beat Knowify's "#1 QB integration" claim | One-time token exchange; store refresh token encrypted with existing AES-256 infra |
| Pull `TimeActivity` by date range into payroll import | Table stakes — replaces CSV file download step | Direct API call via existing import pipeline |
| Pull `Employee` list for worker roster pre-population | Differentiating — eliminates manual worker add | Net-new UI on WorkersPage |
| Bi-directional write (push payroll data back to QB) | Differentiating — matches Knowify 2-way sync | Requires Silver tier ($300/mo); defer until user base justifies |
| Webhook on QB payroll run completion auto-triggering import | High differentiating | Requires webhook config in QB app settings; Silver+ |

### Anti-Features

| Anti-Feature | Why Avoid |
|--------------|-----------|
| Replacing CSV import with OAuth-only | ADP/Gusto/Paychex/Sage users don't use QB Online Payroll; CSV remains necessary |
| Building for QB Desktop | QB Desktop API is sunset/deprecated; Online only |
| Requesting `payroll` scope on first OAuth | Scope creep; users reject broad permissions upfront; add incrementally |

### Feature Dependencies

- Requires OAuth callback route: `/api/integrations/qbo/callback`
- Requires encrypted token storage: extend existing AES-256-GCM envelope for tokens
- `TimeActivity` pull maps directly into existing payroll import pipeline (worker matching, conflict detection, preview/commit already built)
- Employee roster sync is net-new UI on WorkersPage

---

## Research Question 3: DBE/MBE/WBE Certification Tracking

### What Standard Systems Track (MEDIUM confidence — B2Gnow product page + DOT regulatory sources)

**Core data fields per subcontractor certification record:**

| Field | Notes |
|-------|-------|
| Certification type | DBE / MBE / WBE / SBE / ACDBE / 8(a) / HUBZone — multi-select; a firm can hold multiple |
| Certifying agency | DOT, SBA, state OMWBE, local agency — varies by type |
| Certification number | Agency-assigned unique ID used in contract reporting |
| NAICS codes | 2–6 digit codes for work scope the cert covers; critical — cert is scope-limited |
| Issue date | When certification was granted |
| Expiration date | Varies: annual update (DBE), 3 years (local programs), no expiry (some state M/WBE) |
| Owner demographics | Race, ethnicity, gender — required for eligibility determination |
| Personal net worth | DBE eligibility threshold ($1.32M as of 2024); annual recertification field |
| Self-certification flag | Risk flag — some programs allow self-cert without agency verification |
| Annual update status | Submitted / pending / overdue |
| Reevaluation status (2025 IFR) | New field: under DOT IFR Oct 2025, all existing certs being reevaluated individually |
| Document attachments | Certificate PDF, proof of ownership, financial statements |

**Critical 2025 regulatory change (HIGH confidence):**
The DOT Interim Final Rule (October 3, 2025) eliminated race/sex-based presumptions for DBE certification. All currently certified firms are being reevaluated. During reevaluation, DBE contract goals and counting DBE participation toward goals is suspended. This creates an acute compliance need for tracking reevaluation status — a field no existing tool yet has as a first-class concept.

**Verification workflow (standard pattern):**
1. GC adds sub to project and links certification record
2. System checks: is cert type relevant to project funding source (federal DOT project = DBE required)?
3. System checks: does expiration date extend past project completion date?
4. System checks: do NAICS codes on cert cover the contracted work scope?
5. Violation flag if any check fails; warning if expiration within 90 days
6. Auto-notify sub via email at 90/60/30 days before expiration
7. GC can upload renewed certificate PDF to clear the flag

**What we do NOT need to replicate:** B2Gnow maintains the world's largest certified supplier database — they are the certifying authority aggregator. That is a 25-year moat. We track GC subcontractors' certifications via manual entry + document upload. We do not run a public registry.

### Table Stakes vs Differentiating

| Feature | Classification | Complexity |
|---------|---------------|------------|
| Certification record per sub (type, agency, number, NAICS, expiry) | Table stakes for federal project GCs | Medium |
| Expiration alert at 90/60/30 days via email | Table stakes — reuses existing Resend email infrastructure | Low |
| Block sub CPR upload if cert expired | Table stakes — compliance enforcement at submission | Low (check at CPR upload gate) |
| NAICS code validation against project work scope | Differentiating — most tools skip this check | Medium |
| DOT IFR 2025 reevaluation status field + flag | Differentiating — acute 2025 compliance need; no competitor has this yet | Low (data field + flag in UI) |
| Public DBE directory lookup (read from DOT DBELO) | High differentiating — live verification | High (each state has separate registry; maintenance-heavy) |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Building a certifying agency portal | That is B2Gnow's core business; not our market | Track certs; do not issue them |
| Pulling from multiple state DBE registries via API | Different formats per state; maintenance nightmare | Manual entry + PDF upload is sufficient for GC use case |
| Blocking project creation if no DBE subs | DBE goals are project-level targets, not always mandatory on every project | Warn + track participation %; never block project creation |

### Feature Dependencies

- Attaches to existing `subcontractors` table — add `certifications` child table
- Expiration alerts reuse Resend email infrastructure (already built in v4)
- CPR upload block extends existing subcontractor CPR workflow
- NAICS codes require `project_naics_codes` field on projects table (or a free-text scope description for simpler MVP)

---

## Research Question 4: Apprenticeship Ratio Enforcement

### Regulatory Reality (HIGH confidence — DOL + Points North verified)

Apprenticeship ratios are legally enforceable, per-trade limits on how many registered apprentices can work per journeyworker. Key rules:

- **Daily tracking required** — ratios apply per day, not averaged weekly. If a journeyman leaves mid-shift, excess apprentice hours automatically revert to journeyman prevailing wage rate.
- **Trade-specific, not project-global** — cannot offset electrical apprentice surplus with carpenter journeyman headcount. Each trade tracks independently.
- **Program-specific ratios** — come from the apprentice's registered program (state apprenticeship council or RAPIDS), not a universal DOL rule. Common structures: electrical 1:1, plumbing 1:1, carpentry 1:2 or 1:3, general labor 1:3.
- **No fractional rounding** — partial ratios cannot justify additional apprentices unless the program explicitly allows it.
- **IRA/IIJA expansion** — clean energy and infrastructure projects have mandatory apprenticeship percentage requirements (e.g., 15% of labor hours from registered apprentices for IRA clean energy tax credits).

**Current state vs. target:**
Existing COMP-03 fires a weekly aggregate violation when apprentice hours exceed 1:3 ratio (NYS flag only, per-week, not per-trade per-day). The target is per-trade, per-day ratio enforcement with program-sourced ratios.

### Table Stakes vs Differentiating

| Feature | Classification | Complexity |
|---------|---------------|------------|
| Per-trade apprentice ratio configuration (not global 1:3) | Table stakes — what B2Gnow scores 9/10 for | Medium |
| Real-time violation flag on payroll entry when ratio exceeded per trade | Table stakes — current COMP-03 is per-week; needs per-entry daily check | Medium |
| Apprenticeship program name + registration number on worker profile | Table stakes — WH-347 requires this; partially in place | Low |
| Automatic wage upgrade calculation when ratio exceeded (excess hours at JW rate) | Differentiating — most tools flag only; we can surface the dollar liability | High |
| IRA/IIJA apprenticeship percentage tracker (15% of total hours) | Differentiating — acute need for clean energy and infrastructure contractors | Medium |
| RAPIDS API integration for program verification | High differentiating — RAPIDS is the federal apprenticeship registry | High (API availability unconfirmed; verify before committing) |

### Anti-Features

| Anti-Feature | Why Avoid |
|--------------|-----------|
| Hardcoding 1:3 as universal ratio | Wrong for most trades; creates false compliance confidence |
| Per-project global ratio (not per-trade) | Legally incorrect; cannot offset across trades |
| Hard-blocking payroll entry if ratio violated | Should warn and flag, not block; GC may have a legitimate exception to document |

### Implementation Pattern

```
workers table gains: apprenticeship_program_name, apprenticeship_program_id, rapids_number
projects table gains: apprenticeship_requirements JSON
  Example: { "Electrician": { "max_ratio": "1:1", "program_id": "CA-0032" },
             "Carpenter":   { "max_ratio": "1:2", "program_id": "CA-0015" } }

On payroll entry save (per payroll week):
  FOR EACH trade classification present in week:
    jw_hours       = SUM(hours WHERE classification = trade AND worker_type = 'JW')
    apprentice_hrs = SUM(hours WHERE classification = trade AND worker_type = 'RA')
    max_apprentice = jw_hours * ratio_numerator / ratio_denominator
    IF apprentice_hrs > max_apprentice:
      fire COMP-04 (per-trade ratio exceeded)
      excess_hours = apprentice_hrs - max_apprentice
      additional_liability = excess_hours * (jw_rate - apprentice_rate)
      surface in violation detail: "Excess apprentice hours: {excess}, additional wage liability: ${liability}"
```

### Feature Dependencies

- Extends existing compliance engine (COMP-01 through COMP-03 patterns already established)
- Requires per-trade ratio config UI on ProjectForm or a new ProjectComplianceSettings page
- Worker profile already has `isApprenticeship` boolean — needs `apprenticeship_program_name`, `rapids_number` added
- Existing `weekViolations[]` array pattern (separate from per-entry violations) is the right structure for COMP-04

---

## Research Question 5: SOC 2 Type II Controls

### What Type II Actually Requires (HIGH confidence — multiple authoritative sources)

Type II assesses operating effectiveness of controls over an observation period of 3–12 months. SOC 2 Type II cannot be "shipped in a sprint" — the clock must run after all controls are in place.

**The five Trust Service Criteria (TSC) mapped to Node.js implementation:**

### Security (CC6 — required for all SOC 2 reports)

| Control | Current State | Implementation Needed |
|---------|--------------|----------------------|
| Unique user credentials, no shared accounts | Done (JWT per user) | Already compliant |
| Role-based access control | Done (Owner/Member/Auditor) | Already compliant |
| MFA on sensitive accounts | Missing | TOTP via `speakeasy` + QR enrollment on owner accounts |
| Quarterly access reviews | Missing | Audit log query scheduled report to owner email |
| Annual penetration test | Missing | External vendor or automated tool (Detectify, Intruder) |
| Vulnerability scanning | Missing | GitHub Dependabot + OWASP ZAP in CI pipeline |
| Data at rest encryption | Partial — SSN encrypted; SQLite file itself not | Confirm or add SQLite-level encryption (SQLCipher) |
| TLS for all traffic | Done (Render HTTPS) | Already compliant |
| Key Management Service | Partial — env var storage | Move to proper KMS (AWS KMS or Infisical) for key rotation |
| Centralized logging with retention policy | Partial (Pino JSON logging exists) | Route Pino output to hosted log aggregation (Logtail, Better Stack) |
| Anomaly detection / alerting | Missing | Sentry already in place; add rate anomaly alerts |

### Availability (CC7)

| Control | Implementation |
|---------|--------------|
| Uptime monitoring | Uptime Robot free tier or Better Stack |
| Incident response runbook | Written document + on-call definition |
| Backup + recovery (RPO/RTO defined) | SQLite daily backup to separate storage; document RTO |
| Status page | Instatus (free tier) or statuspage.io |

### Confidentiality (CC9)

| Control | Implementation |
|---------|--------------|
| Data classification policy | Written policy: PII (SSN, DOB), sensitive (payroll), internal |
| Vendor security review on file | List Render, Resend, Stripe, Sentry + their SOC 2 status; written doc |
| Data retention and deletion procedures | Policy doc + delete-on-request endpoint |

### Change Management (CC8)

| Control | Implementation |
|---------|--------------|
| Change management process | Git PR review process documented |
| Deployment approval | Branch protection rules enforced; document it |
| Rollback procedures | Written rollback playbook |

**The non-code reality of SOC 2 Type II:**
SOC 2 Type II is primarily a documentation and evidence collection problem, not a features problem. The major gaps are: written security policies, evidence collection during the observation period, annual penetration test report, vendor security assessments on file, and formal risk assessment. The largest time investment is the 3–12 month observation period, not implementation.

**Recommended path:** Use a compliance automation platform (Drata, Vanta, or Sprinto — startup tiers $500–1,500/year) to automate evidence collection and map controls to auditor requirements. This is significantly cheaper than manual evidence collection.

**Timeline reality:** Minimum 9–18 months from decision to final Type II report. The clock starts after all controls are implemented and evidenced.

### Table Stakes vs Differentiating

| Feature | Classification | Notes |
|---------|---------------|-------|
| MFA for owner accounts | Table stakes for enterprise sales conversations | Medium complexity; TOTP sufficient |
| Centralized structured log aggregation | Table stakes for observation period | Low — Pino already outputs JSON; add Logtail/Better Stack drain |
| Uptime monitoring + public status page | Table stakes — enterprise buyers check | Low — Uptime Robot free + Instatus $0 |
| Dependabot + OWASP ZAP in CI | Table stakes for vulnerability scanning evidence | Low — GitHub settings |
| Written security policy documentation | Table stakes — auditors require it | No code; 1–2 days of writing |
| Vanta/Drata integration | Differentiating — shows SOC 2 progress to enterprise buyers pre-certification | $500–1,500/year; automates evidence |
| SOC 2 Type II report (achieved) | Ultimate differentiator — B2Gnow has this; we do not | 9–18 month timeline; start now, claim later |

### Anti-Features

| Anti-Feature | Why Avoid |
|--------------|-----------|
| Claiming "SOC 2 compliant" before completing the audit | Legally and commercially dangerous; use "SOC 2 in progress" with controls listed |
| Building a custom SIEM | Not our core competency; use Logtail/Better Stack |
| GDPR compliance as a substitute for SOC 2 | Different frameworks; US government buyers require SOC 2, not GDPR |

---

## Research Question 6: Economic Impact Dashboard

### What Compelling Dashboards Track (MEDIUM confidence — B2Gnow product analysis + industry research)

B2Gnow's economic impact module (part of their 160+ reports) and prevailing wage compliance dashboards center on:

**Workforce metrics:**
- CPRs submitted count (by subcontractor, by week, aggregate)
- Worker headcount by trade classification
- Journeyman vs. apprentice hour split (absolute and %)
- Hours by worker demographic (race, gender, Section 3, New Hire status) — agency reporting requirement
- Local hire percentage: workers from project zip code / county vs. total workforce

**Wage metrics:**
- Total gross wage spend on project
- Wage spend by trade classification
- Average hourly rate by trade vs. prevailing wage rate (compliance gap indicator)
- Fringe benefit spend by fund type (H&W, pension, vacation, training)

**Compliance metrics:**
- Violation count by type (under-wage, OT, ratio)
- Weeks with violations / total weeks = compliance rate %
- Projects at risk (any open violation older than 14 days)
- Correction rate: amended CPRs / total CPRs

**Economic impact (for public presentation by government agencies):**
- Local economic multiplier estimate
- Jobs sustained (worker-weeks of employment)
- Small business / DBE / MBE participation rate (sub contract value)
- Geographic impact map (worker zip codes plotted)

### User Personas and What They Need

| Persona | Key Metrics | Why They Matter |
|---------|-------------|-----------------|
| GC Owner / Project Manager | Violation count, compliance rate %, projects at risk | Avoid debarment; pass DOL audit |
| Payroll Administrator | CPR submission status, underpayment flags, correction queue | Day-to-day operations |
| Government Agency / Owner | Local hire %, wage spend by trade, DBE participation rate | Mandatory program reporting |
| Auditor / Owner Representative | Correction rate, amendment history, fringe spend detail | Audit defense documentation |

### Table Stakes vs Differentiating

| Feature | Classification | Complexity |
|---------|---------------|------------|
| Project-level compliance summary (violations, compliance rate %) | Table stakes — already partially present; needs visual upgrade | Low (extend existing dashboard) |
| Cross-project portfolio view (total violations, projects at risk count) | Table stakes | Medium |
| Trade-level wage spend breakdown (gross wages by classification) | Differentiating | Medium (query existing payroll entry data) |
| Journeyman vs. apprentice hour ratio trend over time | Differentiating — needed once apprenticeship enforcement is built | Medium |
| Local hire % (worker home address vs. project address comparison) | Differentiating — worker address already collected | Medium |
| DBE/MBE/WBE participation rate (sub contract value tracked) | Differentiating — requires DBE tracking feature first | High (depends on Q3 certification feature) |
| Exportable PDF / CSV of all dashboard metrics | Table stakes | Low (reuse existing PDF/CSV patterns) |
| Public-facing agency report (shareable URL, no login required) | High differentiating — B2Gnow's "present to public" capability | High |
| Geographic map visualization (worker zip codes plotted) | Differentiating | High (requires Leaflet or Mapbox; defer to post-MVP) |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| 160+ canned reports (B2Gnow clone) | Report sprawl; 90% unused; maintenance burden | 8–10 high-value metrics, beautifully designed with clear labels |
| Real-time streaming dashboard (WebSocket) | Overkill for weekly payroll cadence | React Query polling at page load + staleTime cache is sufficient |
| Ad-hoc query builder | Enterprise complexity, maintenance overhead | Parameterized filters (date range, project, trade) on a fixed chart set |
| Geographic map as first-priority deliverable | High visual complexity vs. compliance value add | Ship local hire % as a number first; map is a v6.1 enhancement |

---

## Feature Dependencies Map

```
GPS Clock-In / Mobile PWA (Phase C)
  ← requires: projects table gains lat, lng, radius_meters
  ← requires: service worker registration in Vite build
  ← requires: new time_punches table
  → feeds: payroll entry auto-population (Phase C+)

QB OAuth Sync (Phase B)
  ← requires: OAuth token storage (extend AES-256-GCM infra)
  ← requires: /api/integrations/qbo/* routes
  → replaces: CSV file download step for QB Online users
  → note: full bi-directional payroll sync requires Silver tier Intuit partnership ($300/mo)

DBE/MBE/WBE Tracking (Phase B)
  ← requires: certifications child table on subcontractors
  ← reuses: Resend email for expiration alerts
  → feeds: Economic Impact dashboard (DBE participation %)
  → feeds: sub CPR upload gate (expired cert = blocked upload)

Apprenticeship Ratio Enforcement (Phase B)
  ← requires: per-trade ratio config JSON on projects
  ← requires: apprenticeship_program_name, rapids_number on workers
  → extends: compliance engine (new COMP-04 violation type)
  → feeds: Economic Impact dashboard (JW/apprentice hour split trend)

SOC 2 Controls (Phase D)
  ← requires: MFA (TOTP via speakeasy)
  ← requires: centralized log aggregation (Logtail/Better Stack)
  ← requires: written security policy documentation
  ← requires: 3-month observation period AFTER all controls live
  → unlocks: government and enterprise contract eligibility

Economic Impact Dashboard (Phase D)
  ← requires: DBE tracking data for participation %
  ← requires: apprenticeship data for JW/apprentice split
  ← reuses: worker address (already collected) for local hire %
  ← reuses: existing payroll entry gross wage calculations
```

---

## MVP Recommendation for v6.0

**Phase B — Power Features (highest ROI per unit of effort):**
1. Apprenticeship ratio enforcement per-trade — closes biggest B2Gnow gap; builds directly on existing COMP-03 engine and worker profile
2. QB OAuth + `TimeActivity` pull — eliminates CSV download friction for the plurality of users already on QB Online
3. DBE/MBE/WBE certification record + expiration alerts — unlocks government GC segment; leverages existing sub CPR and email infrastructure

**Phase C — Mobile/Field (critical competitive gap):**
4. PWA installable + offline clock-in/out with GPS stamp — directly closes the 1.3/10 mobile score vs B2Gnow's 8.8/10
5. Photo capture linked to payroll week — unique differentiator vs both competitors

**Defer with rationale:**
- QB bi-directional write: Requires $300/mo Intuit Silver partnership; defer until user base justifies
- Economic impact geographic map: High complexity vs. compliance value; ship flat % numbers first
- SOC 2 Type II report: 9–18 month process; start policies and log aggregation now, but do not block Phase D on certification
- RAPIDS API for program verification: API availability unconfirmed; manual entry + RAPIDS number field is correct MVP

---

## Sources

- [SmartBarrel: Best Construction Time Tracking Software 2026](https://smartbarrel.io/blog/best-construction-time-tracking-software/)
- [Workyard: Construction GPS Time Clock Apps Comparison](https://www.workyard.com/compare/construction-time-clock-apps)
- [Points North: Apprenticeship Ratios and Prevailing Wage Requirements](https://www.points-north.com/trends-and-insights/apprenticeship-ratios-prevailing-wage-requirements)
- [DOL: Davis-Bacon Compliance Principles](https://www.dol.gov/agencies/whd/government-contracts/prevailing-wage-resource-book/db-compliance-principles)
- [IRS: Prevailing Wage and Apprenticeship FAQ (IRA)](https://www.irs.gov/credits-deductions/frequently-asked-questions-about-the-inflation-reduction-act-prevailing-wage-and-apprenticeship-requirements)
- [Intuit Developer: QBO API Developer Portal](https://developer.intuit.com/app/developer/qbo/docs/develop)
- [Intuit App Partner Program FAQ](https://developer.intuit.com/app/developer/qbo/docs/get-started/partner-faq)
- [Truto: QuickBooks API Cost 2026 — Tiers and Rate Limits](https://truto.one/blog/how-much-does-the-quickbooks-api-cost-2026-pricing-rate-limits)
- [Knit: QuickBooks Online API Directory](https://www.getknit.dev/blog/quickbooks-online-api-directory)
- [B2Gnow: Certification Management Module](https://b2gnow.com/products/vendor-management-software/certification-management/)
- [B2Gnow: Prevailing Wage Labor Compliance Software](https://b2gnow.com/products/prevailing-wage-labor-compliance-software/)
- [DOT: Disadvantaged Business Enterprise Program](https://www.transit.dot.gov/dbe)
- [DOT DBE Interim Final Rule October 2025 — context via FedBiz Access](https://fedbizaccess.com/services/certifications/dbe-certification/)
- [ComplyJet: SOC 2 Controls Complete Founder Guide 2025](https://www.complyjet.com/blog/soc-2-controls)
- [Venn: SOC 2 Compliance 2026 Requirements](https://www.venn.com/learn/soc2-compliance/)
- [Pivla: 2025 Trends in Prevailing Wage and Apprenticeship Tracking](https://blog.pivla.com/2025-trends-prevailing-wage-apprenticeship-tracking/)
- [Microsoft Learn: PWA Background Sync](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/background-syncs)
- [DEV Community: PWA Offline Storage with IndexedDB and Cache API](https://dev.to/tianyaschool/pwa-offline-storage-strategies-indexeddb-and-cache-api-3570)
