---
phase: 84-dependabot-uptime-monitoring
verified: 2026-04-26T21:30:00Z
status: human_needed
score: 6/7 must-haves verified
human_verification:
  - test: "Better Stack account setup and STATUS_PAGE_URL replacement"
    expected: "STATUS_PAGE_URL constant in LandingPage.tsx updated from 'https://YOUR-SUBDOMAIN.betteruptime.com' to real subdomain; footer badge renders in browser; System Status link opens live status page in new tab; /api/health monitor active at 3-minute intervals"
    why_human: "Requires creating a Better Stack account, configuring a live monitor against https://prevailingwage.app/api/health, copying the subdomain URL, editing the constant, and visually confirming the iframe renders — cannot be verified programmatically without a live external service"
  - test: "GitHub 'dependencies' label creation"
    expected: "Label named 'dependencies' with color #0075ca exists in GitHub repo Settings > Labels before the first Dependabot Monday run"
    why_human: "GitHub UI action only — cannot be automated via CLI in this environment; without it, Dependabot will error on its first PR"
---

# Phase 84: Dependabot + Uptime Monitoring Verification Report

**Phase Goal:** Automated dependency updates via Dependabot and a public uptime status page reduce operational toil and provide SOC 2 availability evidence. Closes SEC-09, SEC-10.
**Verified:** 2026-04-26T21:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | `.github/dependabot.yml` exists and configures weekly npm and github-actions updates | VERIFIED | File exists; 2 `package-ecosystem` blocks confirmed; both `interval: "weekly"` |
| 2  | All npm updates are grouped into one PR per week (not one PR per package) | VERIFIED | `groups.npm-all` with `patterns: ["*"]` present; `open-pull-requests-limit: 5` set |
| 3  | Both update blocks apply the `dependencies` label to PRs | VERIFIED | `grep -c '"dependencies"'` returns 2 — one per block |
| 4  | `README.md` exists at repo root with CI and Security Audit badges | VERIFIED | File exists; `[![CI]` badge links `ci.yml/badge.svg`; `[![Security Audit]` links `security.yml/badge.svg` |
| 5  | LandingPage footer contains a `System Status` link pointing to `STATUS_PAGE_URL` | VERIFIED | `<a href={STATUS_PAGE_URL} target="_blank" rel="noopener noreferrer">System Status</a>` at line 1046-1053 |
| 6  | LandingPage footer contains an iframe badge from Better Stack (`betteruptime.com/badge`) | VERIFIED | `<iframe src={\`${STATUS_PAGE_URL}/badge?theme=dark\`} frameBorder="0" style={{colorScheme:'none'}} />` at lines 1058-1066 |
| 7  | `STATUS_PAGE_URL` placeholder will be updated to real Better Stack subdomain after account setup | HUMAN NEEDED | Placeholder `YOUR-SUBDOMAIN` in place; TODO comment present at line 1013; manual account setup required |

**Score:** 6/7 truths verified (truth #7 deferred to human by design)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.github/dependabot.yml` | Dependabot v2 config for npm + github-actions ecosystems | VERIFIED | 28 lines, `version: 2`, 2 ecosystems, `npm-all` group, `dependencies` label on both |
| `README.md` | Repo readme with CI badge for SOC 2 observability evidence | VERIFIED | 27 lines; CI badge + Security Audit badge; correct owner/repo `teamcarrillo405-hub/prevailing-wage` |
| `src/client/pages/LandingPage.tsx` | Footer with System Status link + Better Stack iframe badge | VERIFIED (partial) | All code wiring in place; `STATUS_PAGE_URL` constant exists at line 1015; real URL pending human setup |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `.github/dependabot.yml` | GitHub Dependabot | `version: 2` YAML schema + `package-ecosystem` | WIRED | Valid v2 schema; `package-ecosystem` appears twice; `groups.npm-all` present |
| `README.md` | `.github/workflows/ci.yml` | GitHub Actions badge URL | WIRED | `actions/workflows/ci.yml/badge.svg` in badge markdown at line 3 |
| `README.md` | `.github/workflows/security.yml` | GitHub Actions badge URL | WIRED | `actions/workflows/security.yml/badge.svg` in badge markdown at line 4 |
| `LandingFooter` (LandingPage.tsx) | Better Stack status page | `href={STATUS_PAGE_URL}` anchor | WIRED (placeholder) | Link wired to constant; constant has `YOUR-SUBDOMAIN` placeholder pending human setup |
| `LandingFooter` (LandingPage.tsx) | Better Stack badge iframe | `src={STATUS_PAGE_URL + '/badge?theme=dark'}` | WIRED (placeholder) | iframe src uses template literal on constant; renders once real URL is filled in |
| `LandingFooter` | `LandingPage` assembly | `<LandingFooter />` at line 1093 | WIRED | Footer is correctly included in `LandingPage` export |

---

### Data-Flow Trace (Level 4)

Not applicable for this phase. Both artifacts are static configuration files (`.github/dependabot.yml`, `README.md`) or UI wiring to an external service (`LandingPage.tsx`). No dynamic data is fetched — the footer component renders a constant URL and an iframe pointing to an external service. No internal state or DB query to trace.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| dependabot.yml has 2 ecosystems | `grep -c "package-ecosystem" .github/dependabot.yml` | 2 | PASS |
| npm block has grouping | `grep "npm-all" .github/dependabot.yml` | matched | PASS |
| Both ecosystems labeled | `grep -c '"dependencies"' .github/dependabot.yml` | 2 | PASS |
| Both schedules weekly | `grep -c 'interval: "weekly"' .github/dependabot.yml` | 2 | PASS |
| README CI badge present | `grep "ci.yml/badge.svg" README.md` | matched | PASS |
| README Security badge present | `grep "security.yml/badge.svg" README.md` | matched | PASS |
| STATUS_PAGE_URL constant defined | `grep -c "STATUS_PAGE_URL" LandingPage.tsx` | 3 | PASS |
| System Status link present | `grep "System Status" LandingPage.tsx` | matched | PASS |
| iframe frameBorder camelCase | `grep "frameBorder" LandingPage.tsx` | matched (line 1062) | PASS |
| colorScheme dark mode fix | `grep "colorScheme" LandingPage.tsx` | matched (line 1065) | PASS |
| TODO comment present | `grep "TODO: set after Better Stack" LandingPage.tsx` | matched (line 1013) | PASS |
| noopener noreferrer on external link | `grep "noopener noreferrer" LandingPage.tsx` | matched (line 1049) | PASS |
| LandingFooter wired into LandingPage | `grep "<LandingFooter />" LandingPage.tsx` | line 1093 | PASS |
| Commits exist in git history | `git show ba6dbfe 4d26862 2c5ea8a` | all 3 confirmed | PASS |
| Better Stack URL functional in browser | visual browser check | not run | SKIP (deferred human) |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SEC-09 | 84-01 | Automated dependency updates configured | SATISFIED | `.github/dependabot.yml` with grouped weekly npm + github-actions updates; commit `ba6dbfe` |
| SEC-10 | 84-02 | Public status page linked from app; SOC 2 availability evidence | PARTIAL | Code wiring complete (constant + link + badge); live monitor and real URL pending Better Stack account setup |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/client/pages/LandingPage.tsx` | 1015 | `STATUS_PAGE_URL = 'https://YOUR-SUBDOMAIN.betteruptime.com'` placeholder | INFO | Known deliberate stub per plan; TODO comment present; does not break other functionality; real URL populates after Better Stack account setup |

**Classification note:** The `YOUR-SUBDOMAIN` placeholder is NOT a code quality stub — it is a deliberate deferred configuration value with an explicit TODO comment, documented in the SUMMARY under "Known Stubs." The link and iframe render without errors; they simply point to an invalid URL until replaced. Severity: INFO only.

---

### Human Verification Required

#### 1. Better Stack Account Setup and STATUS_PAGE_URL Replacement

**Test:** Create a Better Stack account at https://betterstack.com/uptime (free tier). Create a monitor targeting `https://prevailingwage.app/api/health` at 3-minute intervals with keyword `"ok"`. Create a public status page, associate the monitor, copy the public subdomain URL (format: `https://YOUR-SUBDOMAIN.betteruptime.com`). In `src/client/pages/LandingPage.tsx` line 1015, replace `YOUR-SUBDOMAIN` with the actual subdomain. Run `npm run dev`, navigate to http://localhost:4099, scroll to footer.

**Expected:** "System Status" link visible in footer nav row; Better Stack iframe badge renders below the nav links; clicking "System Status" opens the live status page in a new tab; the badge shows current service status.

**Why human:** Requires an external service account that cannot be automated. The iframe content depends on a live Better Stack monitor. Visual rendering of the iframe cannot be confirmed programmatically.

#### 2. GitHub 'dependencies' Label Creation

**Test:** In GitHub repo `teamcarrillo405-hub/prevailing-wage` go to Settings > Labels > New label. Create label named `dependencies` with color `#0075ca`.

**Expected:** Label appears in the repo label list. When Dependabot opens its first PR next Monday (03:00 America/Chicago), the `dependencies` label is applied automatically.

**Why human:** GitHub UI action only. Without this label, Dependabot will log an error when it attempts to apply the label to its first PR.

---

### Gaps Summary

No code gaps. All automated checks pass across both plans. The phase ships complete code for SEC-09 (Dependabot) and SEC-10 (status page wiring). Two items remain as expected human follow-ups per the plan design:

1. **Better Stack account + URL update** — documented in 84-02-PLAN.md `user_setup` section and in 84-02-SUMMARY.md "User Setup Required." The code constant, link, and iframe are all wired correctly and await only the real subdomain value.
2. **GitHub `dependencies` label** — documented in 84-01-SUMMARY.md "User Setup Required." Dependabot config is valid; the label must pre-exist in GitHub before the first Monday run.

SEC-09 is fully closed. SEC-10 code artifact is in place; full SOC 2 evidence requires the live Better Stack monitor to be running, which is a human-gated post-deploy action.

---

_Verified: 2026-04-26T21:30:00Z_
_Verifier: Claude (gsd-verifier)_
