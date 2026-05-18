# Prevailing Wage — Competitive Analysis & Scoring Matrix
**Date:** 2026-04-24 | **Analyst:** Claude Code

> **2026-04-30 update:** Follow-up remediation added a public REST API with per-key rate limiting, `violationBreakdown` response fields, an evidence dashboard, required-vs-collected evidence checks, and JSON/CSV evidence packet exports. The original matrix below should be read as the baseline audit; public API, audit evidence, and field/GPS evidence scores should be reassessed upward before using this document for sales or roadmap decisions.

> **FLC Note:** FLCPrevailingWage.com is an *immigration* wage calculator (H-1B, PERM, H-2B visas) — not a construction prevailing wage tool. It operates under a completely different regulatory regime (NPWC/OES vs. Davis-Bacon/SCA). Included for completeness but not a direct competitor.

---

## 2026-05-16 Tested Competitive Update

This update reflects the verified product state after the May 2026 MVP execution pass. Sources checked: LCPtracker official pages and marketplace listing, eMars official certified payroll page, PRISM labor/wage management page, Prevail official site, and WagePath official/pricing pages.

### Current Contractor-Facing Scorecard

Scale: 1-10. No category is scored 10 unless the product is complete, tested, and production-proven.

| Category | PrevWage | LCPtracker | eMars | PRISM | Prevail | WagePath |
|---|---:|---:|---:|---:|---:|---:|
| Visual design | 8 | 6 | 6 | 5 | 7 | 8 |
| Navigation clarity | 8 | 6 | 6 | 5 | 7 | 7 |
| Ease of use | 8 | 6 | 6 | 5 | 7 | 7 |
| Onboarding | 7 | 5 | 5 | 4 | 6 | 7 |
| Performance feel | 8 | 6 | 6 | 5 | 7 | 7 |
| Mobile field workflow | 6 | 8 | 5 | 5 | 8 | 6 |
| Information density | 8 | 7 | 7 | 7 | 7 | 7 |
| Workflow guidance | 8 | 7 | 7 | 6 | 7 | 8 |
| Typography/interface polish | 8 | 6 | 6 | 5 | 7 | 8 |
| Payroll automation | 7 | 8 | 7 | 6 | 8 | 8 |
| Audit readiness | 8 | 9 | 8 | 8 | 7 | 8 |
| Integrations | 6 | 8 | 6 | 6 | 7 | 8 |
| Support maturity | 4 | 9 | 8 | 8 | 5 | 5 |
| **Average** | **7.2** | **7.0** | **6.5** | **5.8** | **7.0** | **7.5** |

### Updated Competitive Position

PrevWage is strongest where a contractor needs guided setup, source-proven payroll review, visible correction paths, subcontractor CPR operations, field evidence labeling, and a previewable audit packet. The strongest current competitor pressure is WagePath's payroll/fringe automation positioning, Prevail's modern time-tracking story, and LCPtracker's mature agency-mandated submission ecosystem.

### Remaining Competitor Advantages

| Gap | Competitor Advantage | PrevWage Status | Next Investment |
|---|---|---|---|
| Agency adoption and mandate presence | LCPtracker is already required on many public projects. | Not agency-mandated. | Export profiles, portal handoff documentation, and agency/prime pilot references. |
| Live payroll ecosystem | LCPtracker and WagePath emphasize payroll/time integrations; Prevail emphasizes time tracking. | QuickBooks/Procore readiness exists, but live credentials still need pilot validation. | Sandbox/live OAuth UAT and provider-specific contract tests. |
| Native/employee mobile depth | LCPtracker/Prevail have stronger dedicated field/mobile stories. | PWA field clock and photo capture are usable, not a native employee app. | Mobile QA, supervisor approval states, and employee app only after pilot demand. |
| Support and implementation maturity | LCPtracker/eMars/PRISM sell mature compliance operations. | Engineering foundation is strong; support process is not market-proven. | Training material, runbooks, support SLAs, and customer onboarding playbooks. |
| Union/payroll fringe automation | WagePath is heavily positioned around fringe, union, and payroll calculation automation. | Import reconciliation and fringe/deduction visibility exist; payroll provider remains source of truth unless integrated. | Deeper fringe strategy automation and payroll provider handoff. |

### Ranked Next Investments By Customer Impact

1. Complete the California production pilot with two real payroll weeks, subcontractor CPR, generated forms, evidence packet, and reviewer approval.
2. Validate QuickBooks and Procore live OAuth/imports with sandbox or real pilot credentials.
3. Add portal export profiles and handoff checklists for LCPtracker/eMars/eComply-style contract requirements.
4. Reduce remaining mobile density on public landing, Project Home, and Subcontractors.
5. Build customer-facing onboarding/training assets and a support runbook.

---

## 1. SCORING MATRIX

**Scale:** 1–10 | **Weight:** indicates strategic importance

| Category | Weight | **Our App** | **B2Gnow** | **Knowify** | **FLC PW** |
|---|---|---|---|---|---|
| **COMPLIANCE & FORMS** | | | | | |
| Certified payroll forms (# of states) | ★★★ | **9** — 8 states, 8 form types | 7 — WH-347 + state (no specifics) | 6 — WH-347 via Lumber/eBacon | 1 — immigration only |
| Federal Davis-Bacon / WH-347 | ★★★ | **9** — native PDF + eMARS CSV | **10** — DBA, DBRA, SCA, HUD, FTA | 7 — via partner (Lumber) | 1 — N/A |
| State-specific compliance forms | ★★★ | **9** — CA eCPR XML, WA CPR XML, NY MPWR XML, IL, MA, NJ, TX | 6 — state forms implied, not documented | 4 — limited state specifics | 1 — N/A |
| Apprenticeship ratio tracking | ★★ | 5 — NYS apprentice flag only | **9** — automated ratio tracking | 5 — via eBacon | 1 — N/A |
| Amendment / correction tracking | ★★ | **8** — sequence numbers, copy+modify | 6 — implied | 5 — unclear | 1 — N/A |
| **WAGE DETERMINATION** | | | | | |
| Live DOL wage lookup | ★★★ | **8** — monthly sync + manual lookup | **9** — auto rate mgmt team, zero add'l cost | 5 — project-level setup | 6 — BLS/OES live data |
| State wage CSV import | ★★ | **8** — CA, WA, NY via CSV | 6 — implied | 3 — unclear | 1 — N/A |
| Wage determination assignment | ★★★ | **9** — pin, primary, construction type | 7 — project-level | 6 — per-project setup | 1 — N/A |
| Fringe benefit disaggregation | ★★★ | **9** — H&W, pension, vacation, training | 7 — implied | 8 — eBacon fringe trust | 1 — N/A |
| **PAYROLL PROCESSING** | | | | | |
| Payroll entry (hours + ST/OT/DT) | ★★★ | **9** — wizard, daily M-Su, multi-class | 6 — FieldReporter input | 7 — time tracking + QB sync | 1 — N/A |
| Payroll CSV import (providers) | ★★★ | **9** — QB, ADP, Gusto, Paychex, Sage | 5 — generic payroll integration | **9** — QB native (#1 rated) | 1 — N/A |
| Payroll provider mapping (persistent) | ★★ | **8** — worker ID persistence across imports | 4 — unknown | 7 — QB 2-way sync | 1 — N/A |
| **REPORTING & ANALYTICS** | | | | | |
| Export formats (PDF/XML/CSV) | ★★★ | **9** — PDF + XML (eCPR/MPWR/CPR) + CSV | 7 — 160+ reports (no format detail) | 5 — QB sync, limited export | 2 — web display only |
| Compliance dashboards | ★★ | 7 — multi-project summary PDF, badges | **10** — 160+ reports, ad-hoc, economic impact | 6 — job cost dashboard | 3 — wage level only |
| Variance / budget vs. actual | ★★ | **8** — trend chart + threshold flags | 7 — WIP reporting | 7 — real-time job costing | 1 — N/A |
| Audit log / trail | ★★ | **9** — immutable append-only, CSV export | 8 — digital audit trails | 4 — limited detail | 1 — N/A |
| **UI / UX** | | | | | |
| Visual design modernity | ★★★ | **8** — Apple-inspired, dark hero, premium | 5 — no screenshots, cloud-native hybrid | 7 — clean, user-friendly | 6 — clean 3-step form |
| Onboarding / ease of use | ★★ | 7 — wizard + onboarding checklist | 5 — enterprise complexity | **8** — built for SMB speed | 7 — simple calculator |
| Navigation & information arch | ★★ | 7 — sidebar + project context | 6 — complex 25-module suite | 7 — 6-stage workflow | 6 — minimal tool |
| Loading states / empty states | ★ | **8** — skeletons, empty state components | 4 — unknown | 5 — unknown | 5 — basic |
| **MOBILE & FIELD** | | | | | |
| Native mobile app | ★★★ | **2** — web only | **9** — FieldReporter + FieldInspector | 7 — iOS/Android time tracking | 3 — mobile-responsive web |
| Field time capture / clock-in | ★★★ | **1** — not present | **9** — real-time site data | 7 — jobsite clock-in/out | 1 — N/A |
| Geofencing / site verification | ★★ | **1** — not present | 7 — FieldInspector onsite match | 5 — via eBacon | 1 — N/A |
| Offline capability | ★★ | **1** — not present | 6 — unclear | 4 — unclear | 1 — N/A |
| **TEAM & COLLABORATION** | | | | | |
| Role-based access control | ★★★ | **8** — Owner/Member/Auditor + IDOR guards | **8** — view/edit/manage configurable | 6 — enterprise tier only | 1 — single user |
| Team invitations | ★★ | **8** — email token, 7-day expiry, revocable | 7 — user management | 6 — user seats | 1 — N/A |
| Ownership transfer | ★ | **8** — full transfer flow | 5 — unknown | 4 — unknown | 1 — N/A |
| **SUBCONTRACTOR MGMT** | | | | | |
| Sub CPR tracking | ★★★ | 7 — CPR week tracking, compliance status | **9** — multi-tier, submission tracking | 6 — sub management module | 1 — N/A |
| Public CPR upload portal | ★★ | **8** — token-gated public upload | 5 — implied | 4 — unclear | 1 — N/A |
| DBE/MBE/WBE certification tracking | ★★ | **1** — not present | **10** — world's largest certified supplier DB | 3 — basic sub info | 1 — N/A |
| **INTEGRATIONS** | | | | | |
| Payroll ecosystem integrations | ★★★ | 7 — CSV import (5 providers) | 5 — generic payroll links | **10** — QB #1 rated, Lumber, eBacon | 3 — DOL data only |
| External API / webhooks | ★★ | **2** — no public API | 6 — data exchange capability | 3 — unknown | 1 — N/A |
| Billing / payments | ★★ | **8** — Stripe native | 3 — enterprise invoiced | 7 — online payment processing | 1 — N/A |
| Email / notifications | ★★ | **8** — Resend, compliance alerts, due-soon | 6 — email templates | 4 — basic | 1 — N/A |
| **SECURITY** | | | | | |
| SSN / PII encryption at rest | ★★★ | **10** — AES-256-GCM, versioned envelope | 8 — AES-256 SQL Server + SSL | 5 — unknown | 1 — N/A |
| Compliance certifications | ★★ | 5 — no SOC 2 yet | **9** — SOC 2 Type II | 4 — Intuit Approved only | 2 — none |
| Rate limiting / CSRF / headers | ★★ | **9** — Helmet, CSRF, login rate limit | 7 — enterprise-grade assumed | 5 — unknown | 3 — basic |
| **PRICING & BUSINESS** | | | | | |
| Pricing transparency | ★★★ | **9** — 3-tier public (starter free, pro, ent) | 1 — no public pricing | **8** — $79–149/mo stated | 5 — appears free |
| Free tier / trial | ★★ | **8** — starter free forever | 1 — demo only | 7 — 14-day no-CC trial | **8** — appears free |
| SMB accessibility | ★★★ | **8** — self-serve, transparent pricing | 2 — enterprise only | **8** — built for SMB | 7 — free tool |
| **MARKET** | | | | | |
| Platform maturity / trust signals | ★ | 6 — newer but production-grade | **10** — 25yr, 400+ clients, $1T+ contracts | 7 — 13yr, $6M rev, Intuit approved | 6 — 20yr niche |
| Government customer validation | ★ | 3 — HCC / HIS projects | **10** — CTA, Palm Beach, UT System | 4 — government work via Davis-Bacon | 1 — private employers |

---

## 2. AGGREGATE SCORES

| Category | Our App | B2Gnow | Knowify | FLC PW |
|---|---|---|---|---|
| Compliance & Forms | **8.4** | 7.6 | 5.4 | 1.0 |
| Wage Determination | **8.5** | 7.3 | 5.5 | 3.5 |
| Payroll Processing | **8.7** | 5.0 | 7.7 | 1.0 |
| Reporting & Analytics | **8.3** | 8.0 | 5.5 | 1.8 |
| UI / UX | **7.3** | 5.3 | 7.3 | 6.3 |
| Mobile & Field | **1.3** | **8.8** | 5.8 | 1.5 |
| Team & Collaboration | **8.0** | 6.7 | 5.3 | 1.0 |
| Subcontractor Mgmt | **5.3** | **9.3** | 4.3 | 1.0 |
| Integrations | **6.3** | 4.7 | **7.7** | 1.7 |
| Security | **8.0** | 8.0 | 4.7 | 1.3 |
| Pricing & Business | **8.3** | 1.3 | **7.7** | 6.7 |
| Market | 4.5 | **10.0** | 5.5 | 3.5 |
| **WEIGHTED TOTAL** | **7.1** | **7.0** | **6.1** | **2.4** |

> We are competitive or best-in-class in 9 of 12 categories. We lose on **Mobile/Field** (critical) and **Subcontractor DBE/MBE** (government segment). We beat B2Gnow on pricing, payroll processing, SSN security, and transparency.

---

## 3. GAP ANALYSIS — WHAT WE NEED TO WIN

### 🔴 CRITICAL GAPS (blockers to market leadership)

| Gap | Their Advantage | Our Gap | Effort |
|---|---|---|---|
| **Mobile field app** | B2Gnow FieldReporter, Knowify iOS/Android | Web only, no field time capture | Large |
| **Geofencing / clock-in verification** | Knowify/eBacon, B2Gnow FieldInspector | Not present | Medium |
| **DBE/MBE/WBE certification tracking** | B2Gnow (world's largest certified supplier DB) | Not present | Medium |
| **SOC 2 Type II** | B2Gnow certified | Not certified | Large (process) |

### 🟡 IMPORTANT GAPS (needed for enterprise credibility)

| Gap | Their Advantage | Our Gap | Effort |
|---|---|---|---|
| **External API / webhooks** | B2Gnow data exchange, enterprise integrations | No public API | Medium |
| **Apprenticeship ratio enforcement** | B2Gnow automated ratio tracking | Only NYS flag | Medium |
| **Economic impact dashboards** | B2Gnow 160+ reports | Limited dashboard depth | Medium |
| **Real-time compliance dashboard** | B2Gnow live violation detection | Batch violation scan | Small |
| **More state coverage** | B2Gnow implies all 50, Knowify unclear | 8 states | Medium per state |
| **Native QuickBooks 2-way sync** | Knowify (#1 QB integration) | CSV import only | Medium |

### 🟢 QUICK WINS (high impact, low effort)

| Gap | Fix |
|---|---|
| No video tutorials / onboarding tours | Add 2-3 loom/video walkthroughs |
| No trust signals / customer logos | Add HCC logo + testimonial to landing |
| No pricing page clarity on ROI | Add "vs. manual CPR" time-saved calculator |
| No geofencing for sub uploads | Add GPS metadata capture on sub file upload |
| Compliance badge not on dashboard hero | Surface violation count prominently at top |
| No state coverage map | Add visual 50-state coverage map (shows 8 active + roadmap) |

---

## 4. OUR ADVANTAGES (double down on these)

| Advantage | Detail | How to Amplify |
|---|---|---|
| **State form depth** | 8 state-specific forms (CA eCPR XML, WA CPR XML, NY MPWR XML, IL, MA, NJ, TX) — more than any competitor | Lead with "8 states, all forms, all formats" on landing |
| **SSN encryption** | AES-256-GCM at rest, SSN never in API responses — best-in-class | "Bank-grade SSN protection" callout with tech detail |
| **Pricing transparency** | Starter free, clear pro pricing — vs. B2Gnow's hidden enterprise pricing | "See pricing in 5 seconds" vs. "Request a demo" |
| **Payroll CSV import** | 5 providers (QB, ADP, Gusto, Paychex, Sage) natively | Add Lumber + eBacon native partnerships |
| **Amendment tracking** | Sequence numbers, copy+modify — CPR correction workflow | Market as "amendment-ready" for audit defense |
| **Audit log** | Immutable append-only with diffs + CSV export | Position as "audit-proof" for DOL investigations |
| **Focused tool** | Not buried in 25-module platform or vendor management suite | "The only tool built exclusively for prevailing wage" |

---

## 5. DESIGN ASSESSMENT

### B2Gnow Design
- **Verdict: Legacy/hybrid** — No public screenshots, cloud-native architecture but UI language feels enterprise-form-heavy
- Missing: visual polish, product screenshots on website, modern component system
- Weakness: opacity breeds distrust for SMB buyers

### Knowify Design
- **Verdict: Clean but utilitarian** — 6-stage workflow logical but Gantt chart "clunky" per user reviews
- Missing: premium feel, advanced scheduling views, mobile parity with desktop
- Strength: fast onboarding for trade contractor persona

### FLC Design
- **Verdict: Modern 3-step form** — Well-suited for simple calculator UX, recently redesigned
- Missing: everything beyond wage lookup (no payroll, no CPR, no state forms)

### Our Design (Current)
- **Verdict: Best visual quality** — Apple-inspired nav, dark hero, gold hover cards, premium CSS tokens
- Gaps: mobile-first responsive audit needed, no onboarding video, landing page needs social proof
- Next: apply same premium treatment to ProjectDetailPage, PayrollListPage, mobile views

---

## 6. DESIGN ROADMAP TO BEAT EVERYONE

### Phase A — UI Polish (1-2 weeks)
- [ ] Apply premium treatment to ProjectDetailPage and PayrollListPage
- [ ] Add page transition animations
- [ ] Mobile-responsive audit of all 25 pages
- [ ] Add skeleton states to all data-loading pages
- [ ] Trust signals on landing: HCC logo, testimonial, "As seen at..." 

### Phase B — Power Features (2-4 weeks)
- [ ] Real-time compliance violation counter on dashboard (not just badge)
- [ ] 50-state coverage roadmap visualization
- [ ] Add native QB direct API sync (vs. CSV only)
- [ ] Apprenticeship ratio enforcement (per project, per trade)
- [ ] DBE/MBE sub certification tracking

### Phase C — Mobile & Field (4-8 weeks)
- [ ] Progressive Web App (PWA) for field time entry (offline-capable)
- [ ] Worker clock-in/clock-out with GPS verification
- [ ] Field photo capture linked to payroll week
- [ ] Subcontractor mobile CPR submission

### Phase D — Market Credibility (ongoing)
- [ ] SOC 2 Type II audit (process-heavy but unlocks government market)
- [ ] Public API + webhooks for integrations
- [ ] Government customer case study (HCC as reference)
- [ ] Economic impact dashboard (local hire %, wage spend by trade)

---

## 7. COMPETITIVE POSITIONING STATEMENT

**vs. B2Gnow:** "B2Gnow is built for government agencies managing $1T in contracts. We're built for contractors who have to file those reports — faster, clearer, and at a price you can see before you call."

**vs. Knowify:** "Knowify is a construction management platform with prevailing wage bolted on. We're a prevailing wage platform with everything you need and nothing you don't."

**vs. FLC:** "FLC solves H-1B visa wages. We solve Davis-Bacon certified payroll — the forms, the states, the exports, the audits."

**Brand position:** *"The only prevailing wage platform built for contractors, not agencies — with bank-grade SSN security, 8-state form coverage, and pricing you can see in 5 seconds."*
