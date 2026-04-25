# Domain Pitfalls — v6.0 Competitive Upgrade

**Project:** HCC Prevailing Wage — v6.0 Competitive Industry Leadership
**Researched:** 2026-04-24
**Stack context:** Node.js + Express + TypeScript, React + Vite + TailwindCSS v4, SQLite + Drizzle ORM
**Phases:** A (UI Polish), B (Power Features), C (Mobile/Field PWA), D (Market Credibility)

---

## 1. PWA + Offline Sync for Compliance Data

### CRITICAL — Sync Conflict Corrupts Frozen Rate Snapshots

**What goes wrong:** A worker enters payroll hours offline on Monday. The GC's office edits the same payroll week online Tuesday before the field device reconnects. On reconnect, the Background Sync API fires and the client POSTs the offline payload. Without explicit conflict detection, the server either silently overwrites the office edit or the offline edit is dropped. Either outcome corrupts the frozen `baseRateSnapshot` / `fringeRateSnapshot` values — the exact fields that make a WH-347 legally defensible.

**Why it happens:** The Background Sync API guarantees at-least-once delivery with no built-in conflict semantics. It fires the queued sync tag when connectivity returns, regardless of whether the server-side record changed in the interim.

**Consequences:** Compliance violation badges become unreliable. Submitted WH-347s contain incorrect wage data. DOL audit fails.

**Prevention:**
- Store a `clientMutatedAt` timestamp with every offline write in IndexedDB.
- On sync, send `If-Unmodified-Since` (or an ETag equivalent using the row's `updatedAt`) with every PUT.
- Server returns `409 Conflict` when the server version is newer; surface a resolution UI — not a silent merge.
- Never allow offline writes to override a submitted payroll week (`submitted_at IS NOT NULL`). Lock the local record the moment submission status arrives from the server.

**Detection warning signs:**
- Two users report different numbers for the same payroll week.
- Compliance badge flips between states without a user action.
- `payroll_imports` audit table shows entries with timestamps predating the `payroll_weeks.updated_at`.

**Phase:** C — lock the conflict protocol before writing a single line of service worker code.

---

### CRITICAL — iOS Storage Eviction Loses Queued Offline Data

**What goes wrong:** Field workers on iPhones add clock-in/clock-out records all week. Safari limits PWA IndexedDB + Cache Storage to approximately 50 MB and aggressively evicts data if the PWA is not opened for 7 days. A worker who only opens the app on Fridays to sync may find their queued records gone.

**Why it happens:** iOS Safari enforces strict per-origin storage limits and does not distinguish between "important unsynced data" and "expendable cache." The eviction is LRU-based and silent — no error is thrown to the application.

**Consequences:** A week of GPS clock-in records disappears. The payroll week shows incomplete hours. GC faces compliance gap.

**Prevention:**
- Display a persistent "unsynced records: N" counter in the PWA header. Workers can see risk before it materializes.
- Implement a `syncQueue` table in IndexedDB with `createdAt` and `syncedAt`. Warn the user via badge if any record is older than 3 days and not yet synced.
- For compliance-critical records (payroll entry, clock-in), also POST a draft to the server immediately if any connectivity exists, even before the user taps "submit." Use status `draft` to distinguish from finalized entries.
- Document clearly in user-facing help: "PWA requires at least one weekly open to preserve offline data on iPhone."

**Detection warning signs:**
- Field workers report disappearing entries on iOS but not Android.
- Unsynced record count drops to zero without a sync event in logs.

**Phase:** C — test on real iOS devices, not simulators. Simulators do not enforce the same eviction policy.

---

### MODERATE — Service Worker Update Lag Serves Stale Wage Rates

**What goes wrong:** The DOL monthly wage determination sync runs and updates rates in the database. Field workers on PWA are served the old service worker (cache-first strategy) and see the previous month's rates for the entire next week, until the browser decides to check for a new service worker (at most once per 24 hours, or on hard refresh).

**Consequences:** Workers see and submit payroll against stale prevailing wage rates — a compliance violation source that is invisible at time of entry.

**Prevention:**
- Wage rates must always come from the server API, never from the service worker cache. Only cache static assets (JS bundles, CSS, images). All `/api/` routes must be NetworkFirst or NetworkOnly in Workbox config.
- Use Workbox `clientsClaim()` and `skipWaiting()` so new service workers activate immediately on deploy.
- Show a "New version available — refresh" banner when a waiting service worker is detected.

**Phase:** C.

---

### MINOR — Background Sync API Not Supported on All Browsers

**What goes wrong:** The Background Sync API (for syncing while the app is not open) is not available in Safari or Firefox. Workers who close the tab entirely will have queued records stuck in IndexedDB with no mechanism to fire them.

**Prevention:** Fall back to foreground sync on tab open. Display a warning in the install prompt: "For best offline sync, use Chrome on Android." Do not architect the sync flow to depend on background sync as the only path — foreground sync on reconnect must be the reliable baseline.

**Phase:** C.

---

## 2. QuickBooks Online OAuth Integration

### CRITICAL — Refresh Token Silent Expiry After 100 Days

**What goes wrong:** The QBO OAuth 2.0 refresh token expires after exactly 100 days. If no QBO sync occurs during that window (seasonal contractor, project pause, holidays), the token expires silently. The next sync attempt calls the refresh endpoint, gets `400 invalid_grant`, and has no token to fall back to. The GC must re-authorize from scratch — but the app may not surface a clear re-auth UI, leaving the user stuck.

**Why it happens:** QBO rotates the refresh token every 24 hours (the old token expires when a new one is issued). If zero syncs occur for 100 days, the token simply goes cold. The 100-day clock is per-company — a GC with a winter shutdown gap hits this every year.

**Consequences:** QBO sync silently breaks. GC reverts to manual CSV import. Trust in the integration erodes.

**Prevention:**
- Store `qbo_token_expires_at` in the database. Run a daily job that identifies tokens expiring within 14 days and emails the GC: "Your QuickBooks connection needs to be refreshed."
- Build a `/settings/integrations` page showing token health: connected, days remaining, last sync timestamp.
- On any QBO API call returning `400 invalid_grant`, redirect immediately to the re-auth flow with a clear message — not a generic 500.
- Implement proactive refresh: if `expires_at - now < 7 days`, attempt a refresh on the next sync regardless of whether the current token is still valid.

**Detection warning signs:**
- QBO sync endpoint returns 400 with `invalid_grant` in the error body.
- `qbo_tokens` table has rows where `refreshed_at` is older than 90 days.

**Phase:** B.

---

### CRITICAL — Access Token Expires Mid-Sync on Large Imports

**What goes wrong:** A GC with 80 workers kicks off a QBO sync. The access token is 55 minutes old at sync start. The sync iterates employee time records page by page, and 10 minutes later the token expires mid-loop. The sync fails partway through, leaving a partial import that commits some workers' hours but not others — a gap that is invisible unless the GC audits row counts.

**Why it happens:** QBO access tokens have a hard 1-hour TTL. Sync code that fetches a token once at the start of a job will not refresh mid-job.

**Prevention:**
- Wrap every QBO API call in a token-aware client that checks `expires_at - now < 5 minutes` before each request and refreshes if needed.
- Design the sync to be resumable: record a `sync_cursor` (last processed employee ID or page token) so a failure mid-job can resume from the checkpoint rather than restart from zero.
- Never commit partial payroll imports without a database transaction that either commits all rows for a given week or none.

**Detection warning signs:**
- Sync logs show a `401 Unauthorized` mid-job followed by a partial row count.
- `payroll_imports` table shows status `partial`.

**Phase:** B.

---

### MODERATE — Sandbox vs. Production Base URL Mismatch

**What goes wrong:** During development, QBO sandbox uses a different base URL (`sandbox-quickbooks.api.intuit.com`) from production (`quickbooks.api.intuit.com`). Developers who test exclusively in sandbox and hardcode the sandbox URL will break production sync. The authentication layer is identical across both environments (there is no sandbox OAuth) — the difference is only the API base URL and which company data is returned.

**Prevention:**
- `QBO_BASE_URL` must be an environment variable: sandbox value for dev/staging, production value for prod. Never hardcode either URL.
- The `realmId` must always come from the OAuth callback and be stored per-user in the database.
- Add a CI assertion: the `QBO_BASE_URL` in the production environment does not contain "sandbox."

**Phase:** B.

---

### MODERATE — QBO Payroll Fields Do Not Map Cleanly to WH-347

**What goes wrong:** QBO payroll exports hours as weekly totals per employee, not as the daily breakdown (Monday–Sunday) required by WH-347 Column 5. QBO job classifications ("Carpenter") do not match DOL trade codes ("Carpenter - Rough" vs. "Carpenter - Finish"). QBO stores a single pay rate that does not distinguish base wage from fringe — the WH-347 requires them disaggregated per 29 CFR Part 5.

**Consequences:** Auto-populated WH-347 fields are wrong. GC submits incorrect certified payroll. Davis-Bacon violation risk.

**Prevention:**
- Do not attempt full auto-population of WH-347 from QBO data. Use QBO to populate weekly gross and hours only; require the GC to confirm trade classification mapping and fringe disaggregation manually.
- Build a persistent `qbo_worker_classification_map` table storing the GC's confirmed mapping from QBO job code to DOL trade code — survives across syncs.
- Surface a "Review before committing" step in the QBO sync modal that highlights fields requiring human confirmation.
- Document explicitly in the UI: "QuickBooks Online provides weekly totals only. Daily hour breakdown must be entered or confirmed manually."

**Detection warning signs:**
- `under-wage` violations fire on QBO-imported entries where the GC believes rates are correct — root cause is fringe not disaggregated.
- Duplicate worker records because QBO name format ("Last, First") differs from stored worker name ("First Last").

**Phase:** B.

---

### MINOR — QBO Rate Limits (500 Requests/Minute Per Company)

**What goes wrong:** Syncing a large company with many workers across multiple projects can exhaust QBO's rate limit of 500 requests per minute per `realmId`. The API returns `429 Too Many Requests`. Retry without backoff hammers the limit further and extends the outage.

**Prevention:** Implement exponential backoff with jitter on all QBO API calls. Batch employee queries using the QBO query endpoint (`SELECT * FROM Employee MAXRESULTS 100`). Log rate limit hits to a metrics counter — if it fires more than 3 times per sync, the sync design needs pagination adjustment.

**Phase:** B.

---

## 3. Public REST API on Existing Express Routes

### CRITICAL — Existing Internal Routes Become Public Attack Surface

**What goes wrong:** The Phase D public API is bolted onto the same Express app and shares route prefixes with internal routes. API key auth middleware is added alongside the existing JWT cookie check using an `||` condition. A subtle logic error leaves internal routes reachable via Bearer token — file upload endpoints, admin endpoints, or routes that were never hardened for untrusted callers become accessible to any API key holder or attacker with a leaked key.

**Consequences:** Cross-tenant data exposure (IDOR via public API). Internal endpoints triggered by external actors. SSN data reachable without JWT session.

**Prevention:**
- Mount the public API on a dedicated router prefix: `/api/v1/public/`. Internal routes stay on `/api/` and must never accept Bearer token auth. The two auth middleware stacks must be completely separate and tested in isolation.
- Enumerate all Express routes at startup and log which auth middleware applies to each. A CI test should assert no internal route accepts API key auth.
- Rate-limit the public API per API key: 100 req/min using `express-rate-limit` keyed by the hashed API key value.

**Detection warning signs:**
- API key holder can read data from another tenant's projects.
- Public API responds to routes that were not in the published spec.

**Phase:** D.

---

### CRITICAL — SSRF via User-Supplied Webhook URLs

**What goes wrong:** The public API allows callers to register webhook endpoints. An attacker registers a webhook pointing to an internal URL: `http://localhost:4099/api/admin/reset` or `http://169.254.169.254/latest/meta-data/` (cloud metadata endpoint). When a WH-347 submission event fires, the server makes an outbound HTTP request to the attacker-controlled internal URL.

**Consequences:** Internal admin endpoints triggered by external actors. Cloud metadata exfiltration. Internal network traversal on Render.com infrastructure.

**Prevention:**
- Validate webhook URLs at registration time: must use `https://`, must not resolve to RFC 1918 addresses (10.x, 172.16–31.x, 192.168.x), must not be `localhost`, `127.x`, or link-local addresses.
- Use a DNS pre-resolution check at registration: resolve the hostname and reject if it maps to a private IP range.
- Make webhook delivery calls from an HTTP client with strict allowlist (HTTPS only) and a 10-second connection timeout.

**Detection warning signs:**
- Webhook registration for `localhost` or `169.254.*` addresses succeeds without error.
- Outbound HTTP requests to internal IPs appear in server logs.

**Phase:** D.

---

### CRITICAL — API Key Rotation With No Grace Period Breaks Integrations

**What goes wrong:** A GC rotates their API key (leaked key, security audit, staff departure). The app immediately invalidates the old key and issues a new one. The GC's integration is still using the old key in 12 different automation scripts. All automation breaks simultaneously. Because the app has no webhook delivery failure alerting, the GC does not know their integration is broken until a compliance deadline is missed.

**Prevention:**
- Implement a 48-hour grace period on key rotation: old key remains valid for 48 hours, new key is immediately usable. Show both keys in the settings UI with an expiry countdown on the old key.
- Store API keys as a salted hash (`sha256(key)`). Never store the raw key. Show the full key only once at generation time.
- Emit a webhook event when a key is rotated (to any other configured endpoint) so integrators can detect rotation programmatically.

**Phase:** D.

---

### MODERATE — API Versioning Breaks Existing Callers

**What goes wrong:** Phase D ships `/api/v1/` endpoints. A subsequent milestone renames a field (`weekEnding` to `periodEndDate`). The team bumps to `/api/v2/` but decommissions `/api/v1/` immediately. Two GC integrations built on v1 break silently — payroll automation stops pushing data and compliance records go unsubmitted.

**Prevention:**
- Define a deprecation policy before shipping v1: minimum 6-month deprecation window, `Sunset` response header on deprecated routes, email notification to all key holders 60 days before sunset.
- Never remove a field from a v1 response — only add. Removals require a version bump with migration guide.
- Maintain a changelog at `/api/v1/changelog` updated with every release.

**Phase:** D.

---

### MODERATE — Webhook Delivery Failures Create Silent Compliance Gaps

**What goes wrong:** The app sends a webhook on WH-347 submission. The integrator's endpoint returns `500`. The app retries three times, all fail, and drops the event. The integrator's system never records the submission. Months later a DOL audit requests submission confirmation records — the integrator's system shows a gap.

**Prevention:**
- Retry with exponential backoff: 1 min, 5 min, 30 min, 2 hr, 24 hr.
- Move failed events to a dead-letter queue (DLQ) table in SQLite after all retries exhausted. Surface DLQ events in the admin UI.
- Include a unique `eventId` in every webhook payload so integrators can deduplicate retries.
- Sign all webhook payloads with `HMAC-SHA256` using a per-tenant secret. Integrators verify the signature before processing.

**Phase:** D.

---

## 4. GPS Clock-In for Field Workers

### CRITICAL — Browser Permission Denial Blocks the Entire Feature

**What goes wrong:** A field worker opens the PWA for the first time and taps "Block" on the browser geolocation permission prompt (common when workers are privacy-conscious or confused by the prompt). The browser permanently blocks geolocation for the origin. All subsequent clock-in attempts fail with `GeolocationPositionError.PERMISSION_DENIED`. The worker cannot clock in for the rest of the project unless they manually reset browser permissions — a step most workers will not take.

**Why it happens:** Browser geolocation permission is sticky and cannot be re-prompted after denial without the user explicitly resetting it in browser settings.

**Prevention:**
- Before calling `navigator.geolocation.getCurrentPosition()`, show an in-app modal explaining why GPS is needed ("to verify your location at the job site for certified payroll compliance"). Prime the worker before the browser prompt appears.
- After a denial, show a recovery screen with step-by-step instructions for the specific browser (Chrome Android, Safari iOS, Samsung Internet) on how to reset permissions.
- Make GPS a soft requirement: allow clock-in without GPS but flag the entry as "location unverified" in the audit trail. Do not block the entire workflow — flag it for supervisor review instead.

**Detection warning signs:**
- Spike in clock-ins with `gps_status: 'denied'` on Mondays (first day workers install PWA).

**Phase:** C.

---

### CRITICAL — VPN and Mock GPS Spoofing Undermines Compliance Attestation

**What goes wrong:** A worker uses a mock GPS app (freely available on Android, trivially enabled on jailbroken iPhones) to report being at the job site while working elsewhere. The payroll record shows compliant certified payroll hours for work not performed on the prevailing wage site — a Davis-Bacon violation and potential fraud.

**Why it happens:** The browser Geolocation API reads from the device's location provider, which mock GPS apps can override at the OS level. There is no browser-level mechanism to detect mock GPS on Android.

**Consequences:** GC held liable for fraudulent certified payroll. Davis-Bacon audit uncovers discrepancies between GPS records and site access logs. Potential debarment.

**Prevention:**
- Do not claim GPS clock-in as a fraud-proof system. Frame it as a compliance assist, not a fraud prevention control. This manages GC expectations and limits liability.
- Record `accuracy` (meters) from the Geolocation API. Flag entries where `accuracy > 500m` as "low confidence" — accuracy this poor often indicates mock GPS or pure network triangulation.
- Store the IP address at clock-in time. Flag clock-ins where IP geolocation (city level) differs from GPS-reported city by more than 50 miles.
- Log haversine speed between consecutive clock events: if a worker clocks out at location A and clocks in 5 minutes later at a location 300 miles away, flag for supervisor review.
- Include a legal disclaimer in the clock-in UI: "By clocking in, you confirm you are physically present at the job site."

**Phase:** C.

---

### MODERATE — GPS Accuracy Degrades on Construction Sites

**What goes wrong:** Construction sites in urban canyons, underground (tunnels, below-grade parking), or large metal structures (steel fabrication yards) degrade GPS accuracy to 35–100m+. The app may record a worker as being 200m from the job site boundary — a geofence failure — when they are actually inside the building.

**Why it happens:** Browser geolocation blends GPS, WiFi triangulation, and cell tower data. Construction environments systematically degrade all three signal types.

**Prevention:**
- Do not use tight geofencing (10m radius) for clock-in verification. Use a 200–500m radius buffer, or make the job site boundary radius configurable per project.
- Always store the raw `accuracy` value. Clock-in verification logic should use: `distance_from_site <= (geofence_radius + reported_accuracy)`.
- Offer WiFi SSID as an alternative site-presence signal: if the worker is connected to the job site's configured WiFi network, treat it as equivalent to GPS geofence compliance.

**Phase:** C.

---

### MODERATE — GDPR and CCPA Privacy Exposure for Location Data

**What goes wrong:** The app collects GPS coordinates at clock-in for all workers. California's proposed AB 1355 (Location Privacy Act) would require opt-in consent for any location data collection. GDPR requires a Data Protection Impact Assessment (DPIA) and a lawful basis — consent is problematic in employment contexts due to power imbalance; legitimate interest requires proportionality analysis. The app stores raw coordinates indefinitely with no retention policy. A regulatory complaint requires producing all location data for a specific worker — the app has no data export or deletion capability for this data.

**Prevention:**
- Write a privacy notice specifically for location data collection before shipping Phase C. Include: what is collected, why, retention period, who can access it.
- Enforce a data retention policy: GPS records older than 3 years (matching Davis-Bacon record retention requirements) are automatically purged.
- Implement a "Delete my location history" flow accessible to workers (CCPA right to delete).
- Store coordinates at reduced precision for general use (2 decimal places, approximately 1.1km accuracy) and store full-precision coordinates only in the immutable audit log, access-controlled to Owner role.
- Make GPS clock-in opt-in per project, with the GC accepting a privacy responsibility acknowledgment before enabling it.

**Phase:** C.

---

### MINOR — Battery Drain Complaints From Field Workers

**What goes wrong:** Continuous GPS polling (`watchPosition()`) drains phone battery 20–30% faster than normal use. Workers on 10-hour shifts with no charging access run out of battery mid-shift and stop using the PWA.

**Prevention:**
- Use `getCurrentPosition()` (single-shot) only at clock-in and clock-out events. Never use `watchPosition()`.
- Set `maximumAge: 60000` to accept a cached position up to 60 seconds old, avoiding a fresh GPS fix on every clock event.
- Set `timeout: 10000` and `enableHighAccuracy: false` for the initial position — high accuracy mode keeps the GPS radio active longer.

**Phase:** C.

---

## 5. SOC 2 Type II Audit Prep

### CRITICAL — Policy-Practice Misalignment Is Worse Than No Policy

**What goes wrong:** The team writes a security policy: "all production deployments require two-person approval via pull request review." In practice, hotfixes are deployed by pushing directly to `main` via the Render.com auto-deploy hook. The written policy exists; the practice contradicts it. When auditors sample production deployment events, they find deployments with no corresponding approved PR. This is an audit finding that can fail the certification — it demonstrates controls are documented but not operating.

**Why it happens:** Startups write policies to check a compliance box and build their actual processes separately.

**Prevention:**
- Do not write policies until you understand your actual current practice. Document what you do, then tighten it to what the policy will say.
- For deployment approval: configure Render.com to deploy only from tagged releases, not raw `main` pushes. Require PR approval from a second team member via GitHub branch protection. The GitHub PR approval log is tamper-resistant and is valid audit evidence.
- For this Express/Node app: add a `DEPLOYMENT_APPROVED_BY` environment variable required in the Render.com deploy hook — forces a named approver identity for every deploy.

**Detection warning signs:**
- Production deploy timestamps in Render.com logs do not match any PR merge timestamp in GitHub.

**Phase:** D — but begin accumulating evidence from Phase A onward. Every month of consistent practice matters for Type II.

---

### CRITICAL — Logging Gaps: What Auditors Actually Request

**What goes wrong:** The app uses Pino structured logging (already shipped). But auditors request: (1) all login attempts with success/failure, IP, and timestamp; (2) all access to SSN data with who accessed it and when; (3) all role and permission changes; (4) all production deployments with approver identity; (5) evidence of monthly access reviews showing who has production database access. The current audit log captures payroll mutations but not auth events at the granularity auditors expect. Logs written to stdout on Render.com disappear after the platform's log retention window.

**Prevention:**
- Export Pino logs from Render.com to a log aggregation service (Logtail, Papertrail, or Datadog free tier). Retain for minimum 12 months. Auditors need point-in-time queries: "show me all logins on March 15."
- Add a dedicated `security_events` table (or Pino log category) for: `login_success`, `login_failure`, `logout`, `ssn_accessed`, `role_changed`, `member_invited`, `member_removed`, `api_key_created`, `api_key_revoked`. Each row: `timestamp, user_id, event_type, detail_json, ip_address`.
- The existing `audit_log` table already captures payroll mutations — that satisfies Processing Integrity. The gap is Security (auth events) and Availability (uptime/incident log).
- Schedule a monthly access review calendar event. Export the list of users with database and deployment access and confirm it matches the intended list. Document with a dated screenshot. This is the most-commonly-missed evidence artifact in SOC 2 audits.

**Detection warning signs:**
- Auditor asks "show me all failed logins in January" and the answer is "we don't log that."
- The last access review document is from initial setup.

**Phase:** D — but begin logging security events in Phase A. Every month of evidence accumulates for the Type II observation period.

---

### MODERATE — Access Termination Timing Failures

**What goes wrong:** A GC's employee leaves the company. The GC removes them from the HCC Prevailing Wage team via the TeamPage. But the removal happens 3 days after the actual termination date. Auditors check: was access revoked on the day of termination? The 3-day gap is a finding.

**Prevention:**
- When an Owner removes a member, display a confirmation modal that includes: "Confirm this user's access has been revoked from all related systems." Require the Owner to check a box. Log the acknowledgment with a timestamp.
- Revoke all active sessions for the removed user immediately on removal (invalidate JWT). Verify that session validation checks `project_members` membership on every request — not only at login.
- Add a SOC 2 evidence report endpoint (admin-only): exportable list of all member add/remove events with timestamps.

**Phase:** D.

---

### MODERATE — Change Management Evidence Gap for Production Deploys

**What goes wrong:** Auditors sample 10 production deployments during the audit period. They want: change description, who approved it, what was tested, and when it went live. GitHub PRs cover approval, but the link between a PR and the exact Render.com deploy timestamp is not automated. The team cannot show auditors which deploy corresponded to which PR without manual reconstruction.

**Prevention:**
- Tag every production deploy with the Git SHA and PR number. Render.com exposes a `SOURCE_VERSION` environment variable on deploy — log this to the `security_events` table on app startup.
- Use conventional commit messages that include a phase number: `feat(phase-B): QBO OAuth integration (#42)`. This makes the deploy log navigable for auditors.
- Use GitHub Releases — each release tagged, with release notes, and linked to the Render.com deploy timestamp.

**Phase:** D.

---

### MINOR — Manual Evidence Collection Fails Under Audit Deadline

**What goes wrong:** The audit period ends and the team spends two weeks manually pulling screenshots from GitHub, Render.com, and the database to answer auditor requests. Evidence is inconsistently formatted, some screenshots lack timestamps, and some requests cannot be satisfied because the data was not retained.

**Prevention:**
- Use a compliance automation platform (Vanta or Drata) at startup scale. They auto-connect to GitHub, Render.com, and Google Workspace to continuously collect evidence. Cost is $500–$1,500/month — less expensive than the engineering time for manual collection.
- If budget-constrained, build a simple admin page at `/admin/soc2-evidence` that auto-generates the most-requested reports: current user list, access change history, login event count by month, deployment log.

**Phase:** D.

---

## 6. DBE/MBE/WBE Certification Tracking

### CRITICAL — Stale Certification Status Creates GC Liability

**What goes wrong:** A subcontractor uploads their DBE certificate at project start. The certificate expires 12 months later. The app stores the certificate and expiry date but does not proactively notify the GC. The GC submits a DBE utilization report to the funding agency claiming DBE participation for the full project duration — including months after the certificate expired. The funding agency's compliance office discovers the lapse. The GC faces a DBE goal non-compliance finding, potential project disqualification, and reputational damage.

**Prevention:**
- Store `certification_expires_at` for every DBE/MBE/WBE certificate. Run a daily job that identifies certificates expiring within 30 days and emails both the GC (Owner) and the subcontractor contact.
- Block the GC from claiming DBE participation credit for any payroll week where the sub's certificate was expired. Surface a `certification_expired` compliance violation badge — same pattern as the existing `under-wage` badge.
- Do not auto-renew or auto-verify. The certification authority is the state UCP, not this app. The app's role is to track and alert, not to certify.

**Detection warning signs:**
- Sub's `certification_expires_at` is in the past but the sub still appears as "DBE-verified" on project reports.
- GC is reporting DBE participation for weeks where the certification was expired.

**Phase:** B.

---

### CRITICAL — October 2025 DOT DBE Rule Changes Invalidate Pre-Change Certificates

**What goes wrong:** The U.S. DOT issued a Final Rule effective October 3, 2025 removing race- and sex-based presumptions of social and economic disadvantage for DBE/ACDBE eligibility. Firms previously certified under the old presumption standard must now provide individualized showings of disadvantage. An app that displays "DBE Certified" based on a pre-October-2025 certificate may be showing a status that no longer reflects actual eligibility under the new standard — depending on whether the firm has been re-evaluated by its jurisdiction of original certification (JOC).

**Prevention:**
- Store the `certification_issued_date` and `issuing_ucp` (jurisdiction) alongside each certificate. Display a notice on any certificate issued before October 3, 2025: "This certificate was issued under prior DBE eligibility standards. Confirm current eligibility with the issuing UCP before claiming DBE credit."
- Do not make eligibility determinations — only track what the GC uploads and flag staleness.

**Phase:** B.

---

### MODERATE — Interstate Certification Recognition Gaps

**What goes wrong:** A sub is DBE-certified in Texas. The project is in California. The GC assumes the Texas certification transfers. Under DOT Uniform Certification, interstate recognition is supposed to be honored, but: Georgia DOT has paused processing interstate applications entirely as of 2025; receiving-state UCPs have no set deadline to complete re-evaluation; some states add requirements on top of the federal standard. The GC claims DBE credit for this sub on a California federal-aid project. California DOT audits and rejects the credit because interstate recognition was not formally completed.

**Prevention:**
- When a GC adds a sub with a certificate from State A on a project in State B, display a warning: "DBE certification is issued by [State A] UCP. Verify that [State B] recognizes this certification before claiming DBE credit on this project."
- Maintain a static lookup table of known interstate recognition issues (e.g., GA not currently accepting applications). Update when rules change.
- Store `project_state` alongside certification records so the app can flag mismatches automatically.

**Phase:** B.

---

### MODERATE — Document Privacy Risk From Full Certification Package Uploads

**What goes wrong:** GCs request that subcontractors upload their full DBE certification package — which includes personal financial statements, tax returns, personal net worth affidavits, and business ownership documentation. A data breach exposes personal financial data for hundreds of subcontractor business owners. Additionally, employees named in the certification package have no knowledge that their employer uploaded their personal data to a third-party platform.

**Prevention:**
- Do not store full DBE certification packages. Store only: certificate number, issuing authority, certification type (DBE/MBE/WBE/SBE), expiry date, and a GC-provided upload of the certificate summary page only (single-page PDF).
- Encrypt all uploaded certification documents at rest using the same AES-256-GCM envelope already in use for SSNs.
- Add a data retention policy: certification documents are automatically purged 3 years after project closeout (matching Davis-Bacon record retention requirements).

**Phase:** B.

---

### MINOR — No Public API Exists for Real-Time DBE Verification

**What goes wrong:** The team considers building real-time DBE verification by calling state UCP directories via API. There is no standardized public API for DBE certification lookup across state UCPs. The DOT FHWA maintains a directory as a web portal only, not a machine-readable API. Attempting to scrape it violates terms of service and is brittle.

**Prevention:** Do not promise real-time automated DBE verification. This feature does not exist in any competitor (B2Gnow's certified supplier database is a privately maintained dataset requiring vendor partnerships). Manual upload + expiry tracking is the correct approach for v6.0. Monitor the DOT developer portal for future API availability.

**Phase:** B — explicitly out of scope for automated real-time verification.

---

## Phase-Specific Warning Summary

| Phase | Topic | Primary Pitfall | Mitigation Priority |
|-------|-------|----------------|-------------------|
| A | UI Polish | SOC 2 logging gaps accumulate if not started now | Begin `security_events` logging in Phase A — every month of evidence counts for Type II |
| B | QBO OAuth | Refresh token silent expiry after 100 days | Token health dashboard + proactive 14-day expiry warning email |
| B | QBO sync | Access token expires mid-import | Token-aware HTTP client that refreshes before every request |
| B | QBO data | Field mapping mismatches (daily hours, fringe) | Mandatory human review step before committing QBO imports |
| B | DBE tracking | Stale certificates create GC liability | `certification_expires_at` column + daily expiry alert job |
| B | DBE tracking | October 2025 DOT rule changes | Flag pre-2025-10-03 certificates with re-evaluation notice |
| B | DBE tracking | Interstate recognition gaps | Per-project state mismatch warning on certificate add |
| C | PWA sync | Sync conflict corrupts frozen rate snapshots | `If-Unmodified-Since` protocol + 409 Conflict UI before writing any service worker code |
| C | PWA sync | iOS IndexedDB eviction loses queued records | Draft-to-server on any connectivity + unsynced record counter in PWA header |
| C | PWA cache | Service worker serves stale wage rates | All `/api/` routes must be NetworkFirst or NetworkOnly — never cache wage data |
| C | GPS | Permission denial blocks feature entirely | In-app priming modal before browser prompt + soft-failure fallback path |
| C | GPS | Mock GPS spoofing | Accuracy flag + IP cross-check + legal disclaimer; never claim fraud-proof |
| C | GPS | Privacy (CCPA/GDPR) | Opt-in per project, privacy notice, 3-year retention purge, reduced-precision storage |
| C | GPS | Battery drain | Single-shot `getCurrentPosition()` only, never `watchPosition()` |
| D | Public API | Internal routes exposed via API key auth | Dedicated `/api/v1/public/` prefix + completely separate auth middleware |
| D | Public API | SSRF via webhook URL registration | DNS pre-resolution + RFC 1918 blocklist at webhook registration |
| D | Public API | API key rotation breaks integrations | 48-hour grace period for old keys + rotation webhook event |
| D | SOC 2 | Policy-practice misalignment | Document actual practices first; enforce via GitHub branch protection |
| D | SOC 2 | Auth event logging gaps | `security_events` table for login, SSN access, role changes from Phase A |
| D | SOC 2 | Access review never happens | Monthly calendar event + admin evidence export page |

---

## Sources

- [QuickBooks OAuth 2.0 FAQ — Intuit Developer](https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/faq)
- [Handling OAuth Token Expiration — Intuit Help](https://help.developer.intuit.com/s/article/Handling-OAuth-token-expiration)
- [The Pain of Integrating with QuickBooks' OAuth 2.0 — DEV Community](https://dev.to/bstewart/the-pain-of-integrating-with-quickbooks-oauth-20-api-1mb0)
- [5 Things That Will Fail Your SOC 2 Audit — DEV Community](https://dev.to/robertatkinson3570/5-things-that-will-fail-your-soc-2-audit-that-nobody-warns-you-about-5apo)
- [SOC 2 Type II Readiness Checklist — Securance](https://www.securance.com/blog/soc-2-type-ii-readiness-checklist-8-steps-for-saas-teams/)
- [SOC 2 Logging Pipelines — Konfirmity](https://www.konfirmity.com/blog/soc-2-logging-pipelines-for-soc-2)
- [GPS Spoofing Detection and Audit Guide — DATABASICS](https://blog.data-basics.com/clock-in/out-gps-spoofing-detection-and-audit-guide-1)
- [GPS Tracking Compliance: GDPR, DPDP — Appit Software](https://www.appitsoftware.com/blog/gps-tracking-compliance-gdpr-employee-privacy-2025)
- [California Location Privacy Act AB 1355 — CyberAdviser](https://www.cyberadviserblog.com/2025/03/california-proposes-ccpa-update-on-location-data-rules/)
- [U.S. DOT DBE Program Changes October 2025 — ACEC MA](https://www.acecma.org/news/u-s-dot-announces-significant-changes-to-dbe-program/)
- [Securing APIs Against SSRF — Stytch](https://stytch.com/blog/securing-identity-apis-against-ssrf/)
- [Webhook Retry Best Practices — Hookdeck](https://hookdeck.com/outpost/guides/outbound-webhook-retry-best-practices)
- [GeolocationCoordinates accuracy — MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/GeolocationCoordinates/accuracy)
- [PWA iOS Limitations and Safari Support — Magicbell](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
- [Data Synchronization in PWAs — GTCSys](https://gtcsys.com/comprehensive-faqs-guide-data-synchronization-in-pwas-offline-first-strategies-and-conflict-resolution/)
- [Background Sync PWA Backbone — Excellarate](https://www.excellarate.com/blogs/background-sync-pwas-backbone/)
