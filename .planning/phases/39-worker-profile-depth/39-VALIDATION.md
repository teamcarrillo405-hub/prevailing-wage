---
phase: 39
slug: worker-profile-depth
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-01
---

# Phase 39 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler (no test runner — project uses manual integration testing) |
| **Config file** | `tsconfig.json` |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full compile must be green (zero errors)
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 39-01-01 | 01 | 1 | NFR-01, NFR-05 | compile | `npx tsc --noEmit` | ✅ extend | ⬜ pending |
| 39-01-02 | 01 | 1 | WORKER-01 | compile | `npx tsc --noEmit` | ✅ extend | ⬜ pending |
| 39-01-03 | 01 | 1 | WORKER-02, WORKER-03 | compile | `npx tsc --noEmit` | ✅ extend | ⬜ pending |
| 39-01-04 | 01 | 1 | WORKER-04 | compile | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 39-01-05 | 01 | 1 | WORKER-01 | compile | `npx tsc --noEmit` | ✅ extend | ⬜ pending |
| 39-01-06 | 01 | 1 | WORKER-04 | compile | `npx tsc --noEmit` | ✅ extend | ⬜ pending |
| 39-02-01 | 02 | 2 | WORKER-01 | compile | `npx tsc --noEmit` | ✅ extend | ⬜ pending |
| 39-02-02 | 02 | 2 | WORKER-02, WORKER-03 | compile | `npx tsc --noEmit` | ✅ extend | ⬜ pending |
| 39-02-03 | 02 | 2 | WORKER-04 | compile | `npx tsc --noEmit` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/server/routes/payrollWeekClassifications.ts` — new route file stub for WORKER-04 POST/DELETE endpoints (created in Plan 01 Task 4)

*All other files are extensions of existing files; no additional stubs required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration applies cleanly: `address_street` backfilled from `address`, all 8 ADD COLUMN statements succeed | WORKER-01, WORKER-02, WORKER-03 | SQLite migration outcome not verifiable by compiler | Start dev server; check console for "migrating" output; run `SELECT address_street, union_local, apprenticeship_committee FROM workers LIMIT 5` in SQLite shell to confirm columns exist |
| WorkersPage renders 4 address inputs (Street, City, State, Zip) for new and existing workers | WORKER-01 | React UI requires browser | Navigate to WorkersPage; click "Add Worker"; confirm 4 address fields appear; create worker; edit it; confirm fields populate correctly |
| "Union Information" section appears on WorkersPage | WORKER-02 | React UI requires browser | In WorkersPage worker form, confirm "Union Information" section with `unionLocal` and `unionBookNumber` inputs is visible |
| "Apprenticeship" section shows only for workers with apprentice classification | WORKER-03 | Conditional render requires browser | Add apprentice classification to a worker; open edit form; confirm Apprenticeship section appears. For journeyman worker, confirm section is hidden |
| Classification override dropdown appears on PayrollWeekDetailPage; WH-347 uses override tradeDescription | WORKER-04 | UI + PDF output requires browser and PDF inspection | Navigate to PayrollWeekDetailPage; set a classification override for a worker; download WH-347; confirm override tradeDescription appears in worker row |
| CA eCPR XML uses concatenated address fields after WORKER-01 migration | WORKER-01 | XML output requires browser | Download CA eCPR XML for a project; confirm `<workerAddress>` element contains concatenated street+city+state+zip (not blank) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-01
