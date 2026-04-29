---
phase: 99
slug: phase-c-watchdog-gate
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-27
---

# Phase 99 — Validation Strategy

> Gate phase: validation is the plan. All checks are automated file/grep/test commands.
> No new production code is written. The artifact under test is 99-SCORE.md.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (existing), bash file/grep checks |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `cd /c/Users/glcar/prevailing-wage && npx vitest run --exclude ".worktrees/**" 2>&1 \| tail -5` |
| **Full suite command** | `cd /c/Users/glcar/prevailing-wage && npx vitest run --exclude ".worktrees/**"` |
| **Estimated runtime** | ~35 seconds (Phase 94's payrollQueue.test.ts adds IDB mock tests) |

---

## Sampling Rate

- **After Task 1:** Verify all 10 bash checks completed and raw results are noted
- **After Task 2:** Confirm 99-SCORE.md exists and contains GATE_PASS or GATE_FAIL
- **No mid-phase sampling needed:** Two sequential tasks with immediate feedback

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 99-01-01 | 01 | 1 | MOB-16,MOB-17,MOB-18,MOB-19,MOB-20,MOB-21,MOB-22 | file+grep | See 10 criterion checks in PLAN Task 1 | pending |
| 99-01-02 | 01 | 1 | all | file-exists | `test -f .planning/phases/99-phase-c-watchdog-gate/99-SCORE.md && grep -q "GATE_PASS\|GATE_FAIL" .planning/phases/99-phase-c-watchdog-gate/99-SCORE.md` | pending |

---

## Gate Criteria Reference

These are the 10 scored criteria. Each is 1.0 point.

| ID  | Phase | Requirement | Bash Command | Pass Condition |
|-----|-------|-------------|--------------|----------------|
| C1  | 94 | MOB-16 | `grep -c "enqueuePayrollEntry\|getPayrollQueue\|clearPayrollEntry\|markSyncedElsewhere" src/client/lib/payrollQueue.ts` | count >= 3 |
| C2  | 94 | MOB-17 | `test -f src/client/components/payrollWizard/useOfflineEntryMutation.ts && grep -c "enqueuePayrollEntry\|navigator.onLine" src/client/components/payrollWizard/useOfflineEntryMutation.ts` | file exists + count >= 1 |
| C3  | 95 | MOB-18 | `grep -c "payroll-queue-replay\|replayPayrollQueue" src/client/sw.ts` | count >= 1 |
| C4  | 95 | MOB-18 | `test -f src/client/hooks/useSyncStatus.ts && test -f src/client/components/ui/SyncStatusIndicator.tsx && grep -c "SyncStatusIndicator" src/client/components/shared/Layout.tsx` | both files exist + count >= 1 |
| C5  | 96 | MOB-19 | `ls src/server/db/migrations/*photo_verification*.sql 2>/dev/null` + `grep -c "contractorSignatures\|projectPhotos" src/server/db/schema.ts` | migration file found + count >= 1 |
| C6  | 96 | MOB-20 | `test -f src/client/components/ui/SignaturePad.tsx && grep -c "export.*SignaturePad" src/client/components/ui/SignaturePad.tsx` + `grep -rn "PhotoGallery" src/client/components/ \| wc -l` | SignaturePad exists + PhotoGallery referenced |
| C7  | 97 | MOB-21 | `test -f src/client/components/shared/BottomTabBar.tsx && grep -c "BottomTabBar" src/client/components/shared/Layout.tsx` | file exists + count >= 1 |
| C8  | 97 | MOB-21 | `grep -c "md:hidden\|md:flex\|768" src/client/components/shared/BottomTabBar.tsx` + `grep -c "touchstart\|swipe\|onTouchStart" src/client/components/shared/BottomTabBar.tsx src/client/components/shared/Layout.tsx 2>/dev/null` | both counts >= 1 |
| C9  | 98 | MOB-22 | `grep -c "openChecklistDb\|saveChecklist\|getChecklists\|markSynced" src/client/lib/checklistDb.ts` | count >= 3 |
| C10 | 98 | MOB-22 | `test -f src/client/pages/OfflineChecklistPage.tsx && grep -c "OfflineChecklistPage\|checklists" src/client/App.tsx` | file exists + count >= 1 |

## Integrity Checks (deductions, not scored criteria)

| Check | Command | Deduction if failing |
|-------|---------|----------------------|
| Full test suite green | `npx vitest run --exclude ".worktrees/**" 2>&1 \| tail -3` | -0.5 |
| No new TS errors | `npx tsc --noEmit 2>&1 \| grep -v "workers.ts" \| grep "error TS" \| wc -l` | -0.5 if count > 0 |

---

## TDD Coverage Note

Phase 94 (MOB-16) specified TDD with `src/client/lib/payrollQueue.test.ts` using `fake-indexeddb`.
The test suite count after Phase 94 should be higher than after Phase 93. The presence of
`payrollQueue.test.ts` in the suite output is an informational gate signal — document in SCORE.md
Notes but do not deduct for its absence (test file presence is captured via file checks, not
rerun here).

---

## Manual-Only Verifications (excluded from score)

| Behavior | Requirement | Why Excluded |
|----------|-------------|--------------|
| Offline payroll submit syncs to server on reconnect | MOB-17 | Requires browser DevTools network throttle + live server |
| Background Sync fires within 30s of connectivity restoration | MOB-18 | Requires SW registration + live browser + connectivity toggle |
| SyncStatusIndicator shows correct state transitions | MOB-18 | Requires interactive browser session |
| Signature capture produces verifiable PNG blob | MOB-20 | Requires canvas interaction + live server save |
| EXIF geotag lat/lng displayed on uploaded photo | MOB-19 | Requires camera-capable device or EXIF test fixture |
| Bottom tab bar swipe navigates between routes | MOB-21 | Requires touch-capable device or pointer emulation |
| Checklist state persists across hard refresh | MOB-22 | Requires IDB inspection in browser DevTools |

These are real requirements but cannot be mechanically verified in a CI context.
They are noted in 99-SCORE.md under Notes as "manual deferred."

---

## Wave 0 Requirements

None. This phase creates no new source files — only the 99-SCORE.md evidence document.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify
- [x] Sampling continuity: 2-task plan with verification after each
- [x] No Wave 0 needed (no new test stubs required)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending execution
