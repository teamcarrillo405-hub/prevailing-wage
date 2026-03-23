---
phase: 18
slug: dashboard-search-filter
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.1.0 |
| **Config file** | package.json (`"test": "vitest run"`) |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npm run test -- --run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npm run test -- --run`
- **Before `/gsd:verify-work`:** Full suite green + manual browser verification of search/filter/URL persistence
- **Max feedback latency:** 10 seconds (automated) + 2 minutes (manual: type in search box, select funding filter, use back button)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Manual Steps | Status |
|---------|------|------|-------------|-----------|-------------------|--------------|--------|
| 18-01-01 | 01 | 1 | DASH-03, DASH-04 | shell+manual | `npx vitest run` | Type in search box — list filters in real time; select funding type — list narrows | ⬜ pending |
| 18-01-02 | 01 | 1 | DASH-03 | shell+manual | `npx vitest run` | Navigate to a project, click back — search input and dropdown retain values from URL | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Phase 18 is a pure client-side UI change to `DashboardPage.tsx` — no new server endpoints, no new test files needed. Vitest suite confirms no regressions.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real-time name search | DASH-03 | DOM typing requires browser | Type "Oak" in search box — only projects containing "Oak" in name visible |
| Funding type filter | DASH-04 | Dropdown interaction requires browser | Select "Federal" from dropdown — only Federal projects visible |
| URL persistence on back | DASH-03/04 | Browser history requires live browser | Filter to "Oak" + "Federal", click a project, press Back — filter values restored |
| Empty state message | DASH-03/04 | Visual rendering requires browser | Search for "zzz" — EmptyState shows "No projects match your search" (not blank list) |
| Search + archive toggle combine | DASH-03 | Multi-state interaction requires browser | Enable Show Archived + type search — both filters apply simultaneously |

---

## Validation Sign-Off

- [ ] All tasks have automated regression verify (`npx vitest run`)
- [ ] Sampling continuity: regression suite after each task commit
- [ ] Wave 0: not needed (no new test files — pure UI phase)
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s automated + 2min manual
- [ ] `nyquist_compliant: true` set in frontmatter after sign-off

**Approval:** pending
