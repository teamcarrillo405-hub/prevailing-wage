---
phase: 23
slug: dashboard-compliance-filter-csv-export
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.0 + Supertest ^7.2.2 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `vitest run tests/routes/compliance.test.ts` |
| **Full suite command** | `vitest run` |
| **Estimated runtime** | ~15 seconds (quick) / ~60 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `vitest run tests/routes/compliance.test.ts`
- **After every plan wave:** Run `vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| Wave 0 stubs — batch summary | TBD | 0 | DASH-05 | integration | `vitest run tests/routes/compliance.test.ts` | ✅ (file exists; new describe block added) | ⬜ pending |
| Wave 0 stubs — CSV download | TBD | 0 | AUD-03 | integration | `vitest run tests/routes/compliance.test.ts` | ✅ (file exists; new describe block added) | ⬜ pending |
| csv-stringify install | TBD | 0 | AUD-03 | infrastructure | `node -e "require('csv-stringify')"` | ❌ W0 (not installed) | ⬜ pending |
| GET /projects/summary route | TBD | 1 | DASH-05 | integration | `vitest run tests/routes/compliance.test.ts` | ✅ | ⬜ pending |
| Filter chips + batch query | TBD | 1 | DASH-05 | manual | See manual verifications table | N/A | ⬜ pending |
| GET /worker/:id/history/csv route | TBD | 1 | AUD-03 | integration | `vitest run tests/routes/compliance.test.ts` | ✅ | ⬜ pending |
| CSV download button + Blob pattern | TBD | 2 | AUD-03 | manual | See manual verifications table | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/routes/compliance.test.ts` — add `describe('GET /api/compliance/projects/summary')` block with 5 stub tests (authenticated returns array; returns `violations` for project with under-wage entry; returns `no-payroll` for project with no weeks; returns `archived` for closed project; returns 403 when unauthenticated)
- [ ] `tests/routes/compliance.test.ts` — add `describe('GET /api/compliance/worker/:workerId/history/csv')` block with 4 stub tests (200 with Content-Type text/csv; response body begins with `\uFEFF` BOM; CSV has header row with 17 column names; returns 403 for worker belonging to different user)
- [ ] `npm install csv-stringify` — library not present in `package.json`; required before Wave 1 can import it

*All Wave 0 stubs use real `expect()` assertions (not `.todo`) so they fail RED immediately with clear error messages.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Filter chips appear above project grid with All/Compliant/Has Violations/No Payroll/Archived options | DASH-05 | UI rendering — no headless test for DashboardPage | Load dashboard at localhost:4099/dashboard; verify 5 chip buttons render above project cards |
| Clicking "Has Violations" chip hides compliant + no-payroll projects | DASH-05 | UI filter state — requires live data | Ensure project mix; click "Has Violations"; verify only violation-status projects remain |
| Compliance filter chip persists in URL (`?compliance=violations`) | DASH-05 | URL persistence — browser navigation required | Click chip; verify URL bar shows `?compliance=violations`; navigate away; press back; verify chip still selected |
| Clicking chip does NOT clear search `?q=` or `?funding=` params | DASH-05 | URL param preservation — functional setSearchParams | Set search query; click compliance chip; verify `?q=` param still present in URL |
| "Download CSV" button appears on WorkerComplianceHistoryPage | AUD-03 | UI rendering | Navigate to any worker's compliance history; verify button visible |
| CSV file downloads and opens without encoding errors in Excel | AUD-03 | Cross-app interop — Excel outside test harness | Click Download CSV; open file in Excel; verify worker names with accented characters display correctly |
| CSV has exactly 17 column headers in correct order | AUD-03 | Header verification in real file | Open downloaded CSV; verify header row matches 17-column spec from RESEARCH.md |
| Double-clicking Download CSV downloads only one file | AUD-03 | Double-click guard behavior | Rapidly double-click Download CSV; verify only one file appears in Downloads |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (csv-stringify install + test stubs)
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
