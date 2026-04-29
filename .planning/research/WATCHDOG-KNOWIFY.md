# WATCHDOG BETA — KNOWIFY COMPETITIVE BENCHMARK
**Version:** 1.0 | **Updated:** 2026-04-25 | **Status:** Active Monitoring
**Purpose:** Objective grading rubric for evaluating our prevailing wage app against Knowify across all v6.0 phases.

---

## 1. KNOWIFY SCORECARD — ALL 36 DIMENSIONS

| Dimension | Category | Weight | Knowify Score | Status | Notes |
|---|---|---|---|---|---|
| Certified payroll forms | Compliance & Forms | ★★★ | **6/10** | Weak | WH-347 via Lumber/eBacon; limited state coverage |
| Federal Davis-Bacon / WH-347 | Compliance & Forms | ★★★ | **7/10** | Weak | Partner-dependent (Lumber); not native |
| State-specific compliance forms | Compliance & Forms | ★★★ | **4/10** | Critical Gap | Generic; no CA eCPR XML, WA CPR XML, NY MPWR XML |
| Apprenticeship ratio tracking | Compliance & Forms | ★★ | **5/10** | Weak | Via eBacon only; not native enforcement |
| Amendment / correction tracking | Compliance & Forms | ★★ | **5/10** | Weak | Unclear workflow; likely manual |
| Live DOL wage lookup | Wage Determination | ★★★ | **5/10** | Weak | Project-level setup only |
| State wage CSV import | Wage Determination | ★★ | **3/10** | Critical Gap | No documentation on state wage data |
| Wage determination assignment | Wage Determination | ★★★ | **6/10** | Weak | Per-project; not multi-class |
| Fringe benefit disaggregation | Wage Determination | ★★★ | **8/10** | Strong | eBacon fringe trust integration |
| Payroll entry (hours + ST/OT/DT) | Payroll Processing | ★★★ | **7/10** | Competitive | Time tracking + QB sync |
| Payroll CSV import (providers) | Payroll Processing | ★★★ | **9/10** | STRENGTH | QB native #1 rated (Intuit Approved) |
| Payroll provider mapping | Payroll Processing | ★★ | **7/10** | Competitive | QB 2-way sync; persistent mapping |
| Export formats (PDF/XML/CSV) | Reporting & Analytics | ★★★ | **5/10** | Weak | QB sync only; limited export formats |
| Compliance dashboards | Reporting & Analytics | ★★ | **6/10** | Weak | Job cost dashboard; not compliance-focused |
| Variance / budget vs. actual | Reporting & Analytics | ★★ | **7/10** | Competitive | Real-time job costing |
| Audit log / trail | Reporting & Analytics | ★★ | **4/10** | Critical Gap | Limited; not audit-focused |
| Visual design modernity | UI / UX | ★★★ | **7/10** | Competitive | Clean, user-friendly |
| Onboarding / ease of use | UI / UX | ★★ | **8/10** | STRENGTH | Built for SMB speed; fast setup |
| Navigation & info arch | UI / UX | ★★ | **7/10** | Competitive | 6-stage workflow; logical |
| Loading states / empty states | UI / UX | ★ | **5/10** | Weak | Undocumented |
| Native mobile app | Mobile & Field | ★★★ | **7/10** | Competitive | iOS/Android time tracking apps |
| Field time capture / clock-in | Mobile & Field | ★★★ | **7/10** | Competitive | Jobsite clock-in/out capability |
| Geofencing / site verification | Mobile & Field | ★★ | **5/10** | Weak | Via eBacon only; not native |
| Offline capability | Mobile & Field | ★★ | **4/10** | Critical Gap | Undocumented; likely cloud-dependent |
| Role-based access control | Team & Collaboration | ★★★ | **6/10** | Weak | Enterprise tier only |
| Team invitations | Team & Collaboration | ★★ | **6/10** | Weak | User seats model |
| Ownership transfer | Team & Collaboration | ★ | **4/10** | Critical Gap | No documentation |
| Sub CPR tracking | Subcontractor Mgmt | ★★★ | **6/10** | Weak | Sub management module; not specialized |
| Public CPR upload portal | Subcontractor Mgmt | ★★ | **4/10** | Critical Gap | No documented public portal |
| DBE/MBE/WBE certification tracking | Subcontractor Mgmt | ★★ | **3/10** | Critical Gap | Basic sub info only; no cert database |
| Payroll ecosystem integrations | Integrations | ★★★ | **10/10** | STRENGTH | QB #1, Lumber, eBacon partnerships |
| External API / webhooks | Integrations | ★★ | **3/10** | Critical Gap | No documented public API |
| Billing / payments | Integrations | ★★ | **7/10** | Competitive | Online payment processing |
| Email / notifications | Integrations | ★★ | **4/10** | Weak | Basic notifications only |
| SSN / PII encryption at rest | Security | ★★★ | **5/10** | Weak | Unknown encryption standard |
| Compliance certifications | Security | ★★ | **4/10** | Critical Gap | Intuit Approved only; no SOC 2 |
| Rate limiting / CSRF / headers | Security | ★★ | **5/10** | Weak | Unknown; likely inadequate |
| Pricing transparency | Pricing & Business | ★★★ | **8/10** | STRENGTH | $79–149/mo clearly stated |
| Free tier / trial | Pricing & Business | ★★ | **7/10** | Competitive | 14-day no-CC trial |
| SMB accessibility | Pricing & Business | ★★★ | **8/10** | STRENGTH | Built for SMB; no enterprise tax |
| Platform maturity / trust signals | Market | ★ | **7/10** | Competitive | 13 years; $6M revenue; Intuit approved |
| Government customer validation | Market | ★ | **4/10** | Weak | Davis-Bacon; no government case studies |

**Weighted Total: 6.1/10**

---

## 2. KNOWIFY CRITICAL ADVANTAGES — 5 HARDEST-TO-BEAT AREAS

### 2.1 QB Native Integration — Intuit #1 Rated (10/10)
Official Intuit partnership with 2-way API sync. Native QB timesheet → prevailing wage → certified payroll flow.

**Why it's hard to beat:** Intuit endorsement badge. Deep integration at identity level — no worker ID mapping. High switching cost once embedded. Knowify IS the "QB prevailing wage companion" in contractor minds.

**Beat threshold (Phase B):** Ship native QB OAuth + TimeActivity sync before Phase B end. Add 6 additional provider imports (Lumber, eBacon, ADP, Gusto, Paychex, Sage) to exceed breadth. Match quality, exceed variety.

---

### 2.2 SMB-Optimized Onboarding + Transparent Pricing (8/10 + 8/10)
Purpose-built for trade contractors. $79–149/mo visible. 14-day free trial, no CC. Fast time-to-value.

**Why it's hard to beat:** Cultural alignment with SMB buyer persona. Speed to first CPR is their headline. Knowify wins on "simplicity" perception in SMB segment.

**Beat threshold (Phase A):** Reduce onboarding to < 5 min (vs. Knowify's ~15). Maintain starter free forever tier. Add onboarding video. "0 to first WH-347" wizard completes before Knowify's "0 to first QB sync."

---

### 2.3 Fringe Benefit Trust via eBacon (8/10)
eBacon partnership provides industry-standard fringe trust management — H&W, pension, vacation, training.

**Why it's hard to beat:** eBacon is the compliance-specialist partner. Knowify + eBacon is a known "stack" in the industry. Hard to displace with a native implementation without eBacon partnership or equivalent.

**Beat threshold (Phase B):** Build eBacon partnership OR native fringe disaggregation engine matching H&W/pension/vacation/training breakdown. Validation audit confirming >99% accuracy.

---

### 2.4 13-Year Platform Maturity + Intuit Approval (7/10)
Institutional credibility. $6M revenue. Intuit Approved badge. 13 years = stable roadmap signal.

**Why it's hard to beat:** Cannot fake time. Buyers perceive Knowify as "safe" — won't shut down. Intuit badge is official endorsement.

**Beat threshold (Phase D):** SOC 2 Type II (signals security maturity > Intuit Approved). 3 government case studies. Funding announcement or profitability. 2-year public roadmap.

---

### 2.5 iOS/Android Native Mobile Apps (7/10)
Production time-tracking apps with jobsite clock-in/out. Daily contractor crew usage.

**Why it's hard to beat:** Field workers use Knowify's app daily. High retention/habit. Switching requires crew retraining.

**Beat threshold (Phase C):** PWA installable on iOS/Android with offline GPS + photo. Beat Knowify's offline score (4/10) decisively. Position as "web-first = instant updates, no app store delays."

---

## 3. KNOWIFY EXPLOITABLE GAPS — 5 WEAKEST AREAS

### 3.1 State-Specific Compliance Forms (4/10) — CRITICAL
Generic state forms; no CA eCPR XML, WA CPR XML, NY MPWR XML, IL, MA, NJ native export.
**Exploit:** We support 8 states with native exports. Lead with "8-state coverage" on landing. Roadmap to 12 states.

### 3.2 Audit Log / Trail (4/10) — CRITICAL
Limited audit logging; unlikely to export immutable diffs for DOL investigations.
**Exploit:** Market as "audit-proof for DOL investigations." Show audit trail sample in demo.

### 3.3 DBE/MBE/WBE Tracking (3/10) — CRITICAL
Basic sub info only; no certification database, no expiry tracking, no SAM.gov lookup.
**Exploit:** Phase B: DBE fields + SAM.gov + Oct 2025 reevaluation status (first-mover). Knowify has nothing.

### 3.4 No Public API or Webhooks (3/10) — CRITICAL
No documented API; no webhook support; cannot integrate with custom ERP or time tools.
**Exploit:** Phase D: REST API v1 + 5 webhooks. Announce "build on our platform." Developer docs.

### 3.5 SSN Encryption Unknown / No SOC 2 (5/10 + 4/10) — IMPORTANT
Unknown encryption standard. Only "Intuit Approved" — no independent security audit.
**Exploit:** "Bank-grade AES-256-GCM SSN protection" callout on landing. SOC 2 in progress badge.

---

## 4. GRADING RUBRIC — PHASE-BY-PHASE

### PHASE A — UI POLISH
**Knowify UI Baseline:** 7.3/10 (visual 7, onboarding 8, nav 7, loading 5)
**Our Target:** 8.5+/10 on all 4 UI dimensions

| Dimension | Knowify | Our Baseline | Beat Threshold | Deliverable |
|---|---|---|---|---|
| Visual design modernity | 7/10 | 8/10 | 9/10 | All 25 pages premium Apple-inspired system |
| Onboarding / ease of use | 8/10 | 7/10 | 9/10 | < 5 min to first payroll entry; 3-step wizard |
| Navigation & info arch | 7/10 | 7/10 | 8/10 | < 2 clicks to any function; sidebar context |
| Loading/empty states | 5/10 | 8/10 | 9/10 | Skeletons + illustrations on all data pages |

**Phase A Checklist:**
- [ ] All 25 pages match premium design system (no raw form inputs remaining)
- [ ] Mobile responsive: 100% pages pass 320px–1920px viewport test
- [ ] 3-step onboarding wizard: Create Project → Add Worker → Enter Payroll → Download WH-347
- [ ] Onboarding time: < 5 min from registration to first payroll entry (timed user test)
- [ ] Skeleton states on all data-loading pages (ProjectList, PayrollList, Workers, Reports)
- [ ] Empty state illustrations on all zero-data screens
- [ ] Video tutorials: landing walkthrough, payroll entry, CPR export (3 videos)
- [ ] Trust signals: HCC logo + 1 testimonial on landing page
- [ ] 50-state coverage map (8 active states + roadmap to 12)
- [ ] Dark mode toggle, persisted in localStorage
- [ ] Page transitions (subtle, CSS-level, no jank)
- [ ] SOC 2 auth event logging: `security_events` table live (login, SSN access, role change)

**Pass Condition:** UI/UX 8.5+/10 vs. Knowify's 7.3/10. BEAT Knowify on all 4 UI dimensions.

---

### PHASE B — POWER FEATURES
**Knowify Integration Baseline:** 10/10 QB, 3/10 API — weighted 7.7/10
**Our Target:** Exceed Knowify's QB advantage + leapfrog on state coverage + API

| Dimension | Knowify | Our Baseline | Beat Threshold | Deliverable |
|---|---|---|---|---|
| State-specific forms | 4/10 | 9/10 | 9/10 | Maintain 8+ states; add CO + GA (10 states) |
| Apprenticeship ratio tracking | 5/10 | 5/10 | 8/10 | Per-trade per-day enforcement; 5+ states |
| Payroll ecosystem integrations | 10/10 | 7/10 | 9/10 | QB native OAuth + Lumber + eBacon |
| External API / webhooks | 3/10 | 2/10 | 7/10 | REST API v1 + 5 webhooks + OpenAPI spec |
| Compliance dashboards | 6/10 | 7/10 | 8/10 | Real-time violation counter + economic impact |
| DBE/MBE/WBE tracking | 3/10 | 1/10 | 6/10 | DBE fields + SAM.gov + Oct 2025 reevaluation |

**Phase B Checklist:**
- [ ] QB OAuth 2.0 flow: authorization, token storage (AES-256-GCM encrypted), refresh
- [ ] QB TimeActivity sync: pull employee hours by week into preview-then-commit flow
- [ ] QB idempotency: `qbo_import_id` prevents duplicate commits
- [ ] Token health dashboard: 14-day warning email before 100-day cliff
- [ ] Apprenticeship ratio enforcement: per-trade config JSON on project; per-day check on payroll save
- [ ] Apprenticeship dollar liability display: excess hours × wage gap surfaced
- [ ] IRA/IIJA 15%-of-hours threshold tracking for clean energy/infrastructure projects
- [ ] DBE/MBE/WBE fields on subcontractor records
- [ ] Certification expiry alerts: 90/60/30-day Resend email notifications
- [ ] Oct 2025 reevaluation status field on certifications
- [ ] SAM.gov basic lookup integration
- [ ] Real-time compliance violation counter on dashboard hero
- [ ] Economic impact dashboard: wage spend by trade, local hire %, apprentice %
- [ ] Webhook SSRF protection: DNS pre-resolution + RFC 1918 blocklist on registration
- [ ] REST API v1: GET /projects, POST /payrolls, GET /compliance
- [ ] API key auth: SHA-256 hash stored, never raw key; separate middleware stack

**Pass Condition:** Integration score 9/10 vs. Knowify's 7.7/10 weighted. State coverage 9/10 vs. Knowify's 4/10. DECISIVE WIN on both dimensions.

---

### PHASE C — MOBILE/FIELD PWA
**Knowify Mobile Baseline:** 5.8/10 (native 7, field 7, geo 5, offline 4)
**Our Target:** 7.5+/10 — beat Knowify decisively; close gap with B2Gnow

| Dimension | Knowify | Our Baseline | Beat Threshold | Deliverable |
|---|---|---|---|---|
| Native mobile app | 7/10 | 2/10 | 8/10 | PWA installable iOS/Android |
| Field time capture | 7/10 | 1/10 | 8/10 | GPS clock-in + photo linked to payroll week |
| Geofencing verification | 5/10 | 1/10 | 7/10 | Soft geofence (audit trail); never hard gate |
| Offline capability | 4/10 | 1/10 | 7/10 | IndexedDB queue; sync < 5 sec on reconnect |

**Phase C Checklist:**
- [ ] `vite-plugin-pwa` with `injectManifest` + `prompt` update strategy (never `autoUpdate`)
- [ ] Service worker: cache app shell + worker roster for offline access
- [ ] PWA install prompt on iOS (Add to Home Screen) and Android (install banner)
- [ ] GPS clock-in: `getCurrentPosition` (one-shot, not `watchPosition`); store lat/lng + accuracy
- [ ] Clock-in speed: < 5 seconds from button tap to recorded
- [ ] GPS soft failure: if denied/inaccurate → clock-in succeeds with "location unverified" flag
- [ ] GPS opt-in per project (not global default) — CA AB 1355 compliance
- [ ] Geofence: project radius set by PM; warning (not block) if worker > 100m from site
- [ ] Photo capture: attach 1+ photos to payroll week; stored with S3/Render encrypted link
- [ ] Offline queue: `idb ^8`; IndexedDB time entries with `If-Unmodified-Since` on sync PUT
- [ ] Sync: entries drain within 5 sec of reconnect; 409 Conflict UI for rate snapshot mismatch
- [ ] Draft-to-server safety net: iOS 7-day/50MB eviction protection
- [ ] Battery test: < 5% per 8-hour shift
- [ ] Worker roster: offline accessible from IndexedDB cache
- [ ] Sub CPR mobile submission: subcontractors scan project QR to submit CPR docs

**Pass Condition:** Mobile 7.5+/10 vs. Knowify's 5.8/10. BEAT Knowify by 1.7 points. Gap to B2Gnow (8.8) narrowed to < 1.5 points.

---

### PHASE D — MARKET CREDIBILITY
**Knowify Market Baseline:** 5.5/10 (maturity 7, government 4, certs 4, security 5)
**Our Target:** 8.0+/10 — beat Knowify decisively on trust signals

| Dimension | Knowify | Our Baseline | Beat Threshold | Deliverable |
|---|---|---|---|---|
| Compliance certifications | 4/10 | 5/10 | 8/10 | SOC 2 controls live + auditor engaged |
| Government validation | 4/10 | 3/10 | 7/10 | 3 government case studies published |
| Platform maturity | 7/10 | 6/10 | 8/10 | Funding + 2-year roadmap + production metrics |
| SSN encryption | 5/10 | 10/10 | 10/10 | Maintain AES-256-GCM advantage |
| External API | 3/10 | 2/10 | 7/10 | REST API + webhooks live with docs |

**Phase D Checklist:**
- [ ] `security_events` table: login, SSN access, role change, export, session events (started Phase A)
- [ ] `login_attempts` table: brute-force evidence for SOC 2 CC6.x
- [ ] Hash chain on audit_logs: `prev_hash` + `row_hash` SHA-256 chaining
- [ ] Pino route to Logtail/Better Stack (immutable log aggregation)
- [ ] SOC 2 Type II controls: all implemented; auditor engaged; "SOC 2 in progress" badge live
- [ ] 3 case studies: HCC (Hispanic Construction Council), state agency, federal contractor
- [ ] Security whitepaper: SSN encryption, audit trails, CSRF, rate limiting — published
- [ ] Funding announcement OR profitability statement published
- [ ] 2-year product roadmap published (phases 2026–2027)
- [ ] Public REST API: v1 live, rate-limited, API key management UI
- [ ] 5 webhooks: CPR submission, wage update, compliance alert, payroll sync, team invite
- [ ] OpenAPI spec at /api/docs
- [ ] ROI calculator: "manual CPR vs. our platform" time-saved calculator on landing
- [ ] 5+ customer testimonials on landing page
- [ ] Government endorsement letter from 1 state DOL or federal agency

**Pass Condition:** Market/Trust score 8.0+/10 vs. Knowify's 5.5/10. BEAT Knowify by 2.5 points.

---

## 5. GRADE THRESHOLDS — ALL DIMENSIONS

| Dimension | Knowify | Min Score to Beat | Validation |
|---|---|---|---|
| Certified payroll forms | 6/10 | 8/10 | 8-state export accuracy test |
| Federal Davis-Bacon | 7/10 | 9/10 | WH-347 native PDF parity |
| State-specific forms | 4/10 | 9/10 | 10+ states with registrar acceptance |
| Apprenticeship ratio | 5/10 | 8/10 | Per-trade per-day automation; weekly report |
| Amendment tracking | 5/10 | 8/10 | Sequence numbers + audit diff |
| Live DOL wage lookup | 5/10 | 8/10 | Monthly sync + < 24h update |
| State wage CSV import | 3/10 | 8/10 | 5+ state formats; bulk test |
| Wage determination assignment | 6/10 | 9/10 | Pin + primary + construction type |
| Fringe disaggregation | 8/10 | 9/10 | H&W/pension/vacation/training; > 99% accuracy |
| Payroll entry | 7/10 | 9/10 | Wizard; daily M-Su; multi-class |
| Payroll CSV import | 9/10 | 9/10 | QB native OAuth + 6 providers (tie + breadth) |
| Provider mapping | 7/10 | 8/10 | Persistent across 100 cycles |
| Export formats | 5/10 | 9/10 | PDF + XML + CSV multi-state |
| Compliance dashboards | 6/10 | 8/10 | Real-time counter; < 5 sec load |
| Variance / budget | 7/10 | 8/10 | Trend chart + threshold flags |
| Audit log | 4/10 | 9/10 | Immutable; CSV export; < 1 sec on 100K rows |
| Visual design | 7/10 | 9/10 | WCAG 2.1 AA; all 25 pages |
| Onboarding | 8/10 | 9/10 | < 5 min; timed user test (10 users) |
| Navigation | 7/10 | 8/10 | < 2 clicks to any function |
| Loading/empty states | 5/10 | 9/10 | Skeletons on all data pages |
| Native mobile | 7/10 | 8/10 | PWA iOS/Android installable |
| Field time capture | 7/10 | 8/10 | GPS < 5 sec clock-in |
| Geofencing | 5/10 | 7/10 | 100m soft radius; never hard gate |
| Offline capability | 4/10 | 7/10 | IndexedDB; < 5 sec sync; zero lost entries |
| RBAC | 6/10 | 8/10 | Owner/Member/Auditor; all tiers |
| Team invitations | 6/10 | 8/10 | Email token; 7-day; revocable |
| Ownership transfer | 4/10 | 8/10 | Full transfer; all data moves |
| Sub CPR tracking | 6/10 | 7/10 | Week tracking + compliance status |
| Public CPR upload | 4/10 | 8/10 | Token-gated; 1K uploads; < 1 sec |
| DBE/MBE/WBE | 3/10 | 6/10 | Fields + SAM.gov + Oct 2025 reevaluation |
| Payroll ecosystem | 10/10 | 9/10 | QB native + Lumber + eBacon (tie on quality, beat on breadth) |
| External API | 3/10 | 7/10 | REST v1; 5 webhooks; OpenAPI |
| Billing / payments | 7/10 | 8/10 | Stripe; already 8/10 |
| Email / notifications | 4/10 | 8/10 | Resend; compliance alerts; due-soon |
| SSN encryption | 5/10 | 10/10 | AES-256-GCM; versioned; already 10/10 |
| Compliance certs | 4/10 | 8/10 | SOC 2 controls live; auditor engaged |
| Rate limiting/CSRF | 5/10 | 9/10 | OWASP test; Helmet; already 9/10 |
| Pricing transparency | 8/10 | 9/10 | 3-tier public; already 9/10 |
| Free tier | 7/10 | 8/10 | Starter free forever; already 8/10 |
| SMB accessibility | 8/10 | 9/10 | Self-serve; < 5 min onboarding |
| Platform maturity | 7/10 | 8/10 | Funding + roadmap + production metrics |
| Government validation | 4/10 | 7/10 | 3 case studies + 1 endorsement |

---

## 6. COMBINED THRESHOLD — BEATING BOTH B2GNOW AND KNOWIFY

| Phase | B2Gnow Weighted | Knowify Weighted | Our Target | Beat Condition |
|---|---|---|---|---|
| **Phase A: UI/UX** | 5.3/10 | 7.3/10 | **8.5+/10** | Exceed Knowify (harder bar) by 1.2+ pts |
| **Phase B: Compliance + Integrations** | 7.6 + 4.7 | 5.4 + 7.7 | **8.5 + 8.5** | Beat B2Gnow on integrations; beat Knowify on compliance |
| **Phase C: Mobile** | 8.8/10 | 5.8/10 | **7.5+/10** | Beat Knowify decisively; close gap with B2Gnow |
| **Phase D: Market** | 10.0/10 | 5.5/10 | **8.0+/10** | Beat Knowify (easier); narrow B2Gnow gap |
| **WEIGHTED OVERALL** | **7.0/10** | **6.1/10** | **7.5+/10** | Exceed both competitors' weighted totals |

---

## 7. WATCHDOG MONITORING PROTOCOL

After each phase ships, run this grading checklist before advancing:

```
WATCHDOG BETA GRADE — PHASE [X]
=================================
Date: ___________
Phase: ___________
Grader: Watchdog Beta (Knowify benchmark)

DIMENSIONS TARGETED:
□ [Dimension 1]: Our score ___ vs. Knowify ___. PASS/FAIL
□ [Dimension 2]: Our score ___ vs. Knowify ___. PASS/FAIL

CHECKLIST (from phase rubric above):
□ Item 1: PASS/FAIL
□ Item 2: PASS/FAIL

PHASE VERDICT:
□ PASS — all dimensions beat Knowify threshold → advance
□ CONDITIONAL PASS — 80%+ pass → advance with remediation
□ FAIL — < 80% pass → rework required before advancing

NEXT PHASE CLEARED: YES / NO
```

---

## 8. KNOWIFY'S 3 HARDEST-TO-BEAT ADVANTAGES (Summary)

### #1 — QB Native Integration (10/10)
Intuit's officially endorsed prevailing wage partner. 2-way API sync. Official badge. **Counter:** Ship QB OAuth + TimeActivity before Phase B end. Add 6 providers to exceed breadth. Beat on variety if not on depth.

### #2 — SMB Onboarding + Transparent Pricing (8/10 + 8/10)
$79/mo visible, 14-day trial, 6-stage workflow for contractors. **Counter:** < 5 min onboarding (vs. Knowify's ~15). Free starter forever. "0 to WH-347" faster than "0 to QB sync."

### #3 — 13-Year Platform Maturity + Intuit Approval (7/10)
$6M revenue, Intuit badge, decade of trust signals. **Counter:** SOC 2 Type II (beats Intuit Approved on security credibility). 3 government case studies. Funding announcement. 2-year roadmap.
