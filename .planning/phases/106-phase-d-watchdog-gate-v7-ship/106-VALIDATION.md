---
phase: 106
slug: phase-d-watchdog-gate-v7-ship
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-27
---

# Phase 106 — Validation Strategy

> Gate phase: validation IS the plan. All checks are automated file/grep/test commands.
> No new production code is written. The artifact under test is 106-SCORE.md.
> Score target is 9.2/10 — the highest bar of any gate (Phase B required 8.75, Phase C 8.90).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (existing), bash file/grep checks |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `cd /c/Users/glcar/prevailing-wage && npx vitest run --exclude ".worktrees/**" 2>&1 \| tail -5` |
| **Full suite command** | `cd /c/Users/glcar/prevailing-wage && npx vitest run --exclude ".worktrees/**"` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After Task 1:** Verify all 10 bash checks completed, LCPtracker audit rows collected, raw results noted
- **After Task 2:** Confirm 106-SCORE.md exists with GATE_PASS or GATE_FAIL
- **After Task 3 (GATE_PASS only):** Confirm `git tag v7.0.0` exists and ROADMAP.md updated

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 106-01-01 | 01 | 1 | TRUST-05,TRUST-06,ENT-01,ENT-02,AI-01,AI-02,REPT-06,OPS-01 | file+grep | See 10 criterion checks in PLAN Task 1 | pending |
| 106-01-02 | 01 | 1 | all | file-exists | `test -f .planning/phases/106-phase-d-watchdog-gate-v7-ship/106-SCORE.md && grep -q "GATE_PASS\|GATE_FAIL" .planning/phases/106-phase-d-watchdog-gate-v7-ship/106-SCORE.md` | pending |
| 106-01-03 | 01 | 1 | all (ship) | git+file | `git tag \| grep -q "v7.0.0" && grep -q "106.*Complete" .planning/ROADMAP.md` | pending (GATE_PASS only) |

---

## Gate Criteria Reference

These are the 10 scored criteria. Each is worth 1.0 point. Score target: **9.2 / 10**.

| ID  | Phase | Requirement | Bash Command | Pass Condition |
|-----|-------|-------------|--------------|----------------|
| C1  | 101 | TRUST-05 | `find src/client/pages -name "*estimonial*" -o -name "*Testimonial*"` AND `grep -r "testimonial\|Testimonial" src/client/App.tsx src/client/main.tsx` | file found AND router reference found |
| C2  | 101 | TRUST-06 | `grep -r "youtube\|vimeo\|<video\|iframe.*src\|VideoEmbed" src/client/pages/ \| grep -v ".test."` | count >= 1 |
| C3  | 102 | ENT-01 | `grep -r "Enterprise\|enterprise" src/client/pages/PricingPage.tsx` | count >= 1 |
| C4  | 102 | ENT-02 | `grep -c "sso_configs\|ssoConfigs" src/server/db/schema.ts` | count >= 1 |
| C5  | 103 | AI-01 | `grep -r "ai/classify\|ai-classify" src/server/routes/` | count >= 1 |
| C6  | 103 | AI-02 | `grep -r "anthropic\|@anthropic-ai" src/server/ \| grep -v ".test.\|node_modules"` | count >= 1 |
| C7  | 104 | REPT-06 | `find src/client -name "*ivot*" -o -name "*Pivot*"` OR `grep -r "PivotTable\|pivot-table" src/client/ \| grep -v ".test."` | file found OR reference found |
| C8  | 104 | REPT-06 | `grep -r "audit.*csv\|analytics.*export\|pivot.*export" src/server/routes/` | count >= 1 |
| C9  | 105 | OPS-01 | `find src/client/pages -name "*rowth*" -o -name "*Growth*" -o -name "*dmin*"` OR `grep -r "admin/growth\|AdminGrowth\|GrowthDashboard" src/client/` | file found OR route reference found |
| C10 | 105 | OPS-01 | `grep -r "isAdmin\|adminOnly\|AdminRoute\|requireAdmin\|role.*admin" src/server/routes/ src/client/ \| grep -v ".test."` | count >= 1 |

---

## Integrity Checks (deductions, not scored criteria)

| Check | Command | Deduction if failing |
|-------|---------|----------------------|
| Full test suite green | `npx vitest run --exclude ".worktrees/**" 2>&1 \| tail -3` | -0.5 if failures > 0 |
| No new TS errors | `npx tsc --noEmit 2>&1 \| grep -v "workers.ts" \| grep -v "stripeService.ts" \| grep "error TS" \| wc -l` | -0.5 if count > 0 |

**Known pre-existing errors (not penalized):**
- `workers.ts` lines 108/115 implicit any — pre-existing since v1.0
- `stripeService.ts(14,33)` Stripe API version string mismatch — introduced Phase 90, documented in 93-SCORE.md

---

## LCPtracker Gap Audit Scope

LCPtracker (https://lcptracker.com) targets the same market segment. The audit documents
competitive position across 8 dimensions. This is informational — does not affect score —
but is required to appear in SCORE.md.

| # | Dimension | Files to Check | Expected Status |
|---|-----------|---------------|-----------------|
| 1 | Electronic CPR submission | `src/server/services/*Xml*.ts`, `*ecpr*`, `*pwia*` | AHEAD (CA eCPR + WA PWIA) |
| 2 | Automated prevailing wage rate lookup | `src/server/services/wdolSync.ts` | PARITY+ (weekly cron) |
| 3 | Multi-state certified payroll forms | `src/server/services/*PdfGenerator.ts` count | AHEAD if >= 8 states |
| 4 | Payroll import from accounting software | `src/server/routes/` import routes | AHEAD (5 providers) |
| 5 | DBE/MBE/WBE subcontractor tracking | `src/server/*dbe*` or `*Dbe*` | PARITY (Phase 71-72) |
| 6 | Mobile field access (PWA) | `src/client/public/manifest.json` or SW file | PARITY or BEHIND |
| 7 | Davis-Bacon apprenticeship ratio enforcement | `complianceService.ts` COMP-03 | AHEAD |
| 8 | Real-time compliance dashboards | `src/client/pages/*Compliance*` or `*Dashboard*` | PARITY (Phase 73) |

---

## Score Target Context

| Gate | Phase | Score Target | Rationale |
|------|-------|-------------|-----------|
| Phase A | 67 | 8.55+ | UI polish baseline |
| Phase B | 93 | 8.75 | ACTUAL: 9.50 (all 10 criteria PASS, -0.5 TS) |
| Phase C | 99 | 8.90 | Mobile/field features |
| Phase D | 106 | **9.20** | Final milestone — highest bar |

Phase D requires 9.2. With 10 criteria at 1.0 each, the maximum without deductions is 10.0.
To achieve 9.2 with both integrity checks passing: need at least 10/10 criteria (score = 10.0 - 0.0 deductions = 10.0, or 9/10 = 9.0 which FAILS, so all 10 criteria must pass).

**Critical implication:** Phase D GATE_PASS requires all 10 criteria to PASS plus both integrity checks to PASS (or at most one deduction if 10/10 criteria pass). Any criterion failure that brings the base below 9.7 will cause GATE_FAIL even with zero deductions.

---

## Ship Conditions

GATE_PASS triggers:
1. `git tag -a v7.0.0 -m "v7.0.0 — prevailing-wage milestone complete"`
2. ROADMAP.md: phases 101-106 → Complete with date 2026-04-27
3. ROADMAP.md: Phase D checkbox items `- [ ]` → `- [x]`
4. ROADMAP.md: WATCHDOG GATE line updated with GATE_PASS declaration

GATE_FAIL blocks:
- No tag created
- ROADMAP.md not updated
- Each failing criterion has a specific remediation pointer in SCORE.md

---

## Manual-Only Verifications (excluded from score)

| Behavior | Requirement | Why Excluded |
|----------|-------------|--------------|
| AI classification returns suggestion in < 3s | AI-01 | Requires live ANTHROPIC_API_KEY + network call |
| SSO connect flow completes with Okta dev account | ENT-02 | Requires live Okta developer tenant |
| Video actually plays in testimonials page | TRUST-06 | Requires browser session + video hosting account |
| ROI calculator email capture reaches inbox | TRUST-04 | Requires live email service credentials |
| Admin growth metrics show real user data | OPS-01 | Requires production DB access |

These are real requirements but cannot be mechanically verified in a CLI context.
They are noted in 106-SCORE.md under Notes as "manual deferred."

---

## Wave 0 Requirements

None. This phase creates no new source files — only the 106-SCORE.md evidence document
and (on GATE_PASS) a git tag and ROADMAP.md update.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify
- [x] Sampling continuity: 3-task plan with verification after each
- [x] No Wave 0 needed (no new test stubs required)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter
- [x] GATE_PASS threshold documented (9.2 — highest of all four gates)
- [x] Ship conditions (git tag + ROADMAP update) documented

**Approval:** pending execution
