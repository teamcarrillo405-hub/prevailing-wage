---
phase: 16
slug: wh-347-submission-ux
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (server-side regression only — modal/fetch UX is frontend-only) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test -- --run` |
| **Estimated runtime** | ~10 seconds |

> **Note:** Both WH-01 (preflight modal) and WH-02 (generating state + double-click guard) are frontend-only. The existing 181-test server suite is the regression guard. All modal and download behavior requires manual browser verification.

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run` (regression guard)
- **After every plan wave:** Run `npm run test -- --run` + manual browser test of download flow
- **Before `/gsd:verify-work`:** Full suite green + manual sign-off on all 4 success criteria
- **Max feedback latency:** 10 seconds (automated) + 3 minutes (manual: modal + download flow)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Manual Steps | Status |
|---------|------|------|-------------|-----------|-------------------|--------------|--------|
| 16-01-01 | 01 | 1 | WH-01 | shell+manual | `npm run test -- --run` | Open PayrollWeekDetailPage with violations — click download anchor → preflight modal opens listing violations; click Cancel → modal dismisses, no PDF | ⬜ pending |
| 16-01-02 | 01 | 1 | WH-02 | shell+manual | `npm run test -- --run` | Click Download Anyway → button shows "Generating...", PDF download begins, label returns to normal; rapid double-click does NOT trigger second request | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No Wave 0 test stubs needed. Phase 16 modifies a single existing TSX file — no new TypeScript services, routes, or API endpoints. The 181-test suite is the regression guard.

*Existing infrastructure covers all phase requirements (as regression guard).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Preflight modal opens when violations exist | WH-01 | Modal rendering requires browser | Enter payroll week with under-wage or apprentice ratio violation, navigate to PayrollWeekDetailPage, click download button, verify modal appears |
| Modal lists violations with worker name, type, delta | WH-01 | UI content rendering — visual | Verify each violation row in modal shows worker name, violation type badge, and delta amount |
| Cancel dismisses modal, no PDF generated | WH-01 | Browser fetch behavior | Click Cancel — verify modal closes, no network request to /api/export/wh347 |
| "Download Anyway" proceeds with download | WH-01 | Browser fetch + Blob URL | Click Download Anyway — verify PDF download begins |
| No modal when no violations | WH-01 | Client-side conditional | Open payroll week with no violations, click download — verify PDF downloads directly (no modal) |
| "Generating..." label during in-flight request | WH-02 | Async state — browser timing | Click download, observe label changes to "Generating..." during request |
| Label returns to normal after download begins | WH-02 | Async state cleanup | Verify label reverts after fetch resolves and Blob URL is created |
| Double-click does not trigger second request | WH-02 | Race condition — requires browser | Click download button twice rapidly — verify only one network request to /api/export/wh347 in DevTools Network tab |

---

## Validation Sign-Off

- [ ] All tasks have automated regression verify (`npm run test -- --run`)
- [ ] Sampling continuity: regression suite after each task commit
- [ ] Wave 0: N/A — no new TS services; existing suite is regression guard
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s automated + 3min manual
- [ ] `nyquist_compliant: true` set in frontmatter after sign-off

**Approval:** pending
