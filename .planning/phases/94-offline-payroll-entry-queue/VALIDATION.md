# Phase 94 Validation: Offline Payroll Entry Queue

## Requirements Covered
- MOB-16: Full payroll form serialization to IndexedDB
- MOB-17: Optimistic UI + replay-on-reconnect + 409 conflict resolution

## Automated Checks

Run all of these before marking phase complete:

```bash
cd /c/Users/glcar/prevailing-wage

# 1. Unit tests for the IDB queue library
npx vitest run src/client/lib/payrollQueue.test.ts --reporter=verbose

# 2. Full TypeScript check — zero new errors
npx tsc --noEmit 2>&1 | head -40

# 3. Confirm payrollQueue exports are present
grep -n "export" src/client/lib/payrollQueue.ts

# 4. Confirm useOfflineEntryMutation is wired in PayrollWizard
grep -n "useOfflineEntryMutation\|OfflineSaveStatus" src/client/components/payrollWizard/PayrollWizard.tsx

# 5. Confirm OfflineBanner uses combined count
grep -n "getPendingCount" src/client/components/ui/OfflineBanner.tsx
```

## Manual Browser Verification (Required — cannot be automated)

| Check | How | Expected |
|-------|-----|----------|
| Offline entry saved to IDB | DevTools → Application → IndexedDB → payroll-queue → entries | Entry visible with status='pending' |
| "Queued for sync" badge | Set network to Offline, enter hours in Step 2 | Amber badge replaces "Saving..." |
| OfflineBadge count | Go offline, enter 2 entries | Nav shows "2" amber pill |
| Flush on reconnect | Restore network | IDB entries cleared, week detail shows hours |
| 409 conflict | Submit same entry from two devices | status='synced-elsewhere', "Synced by another device" red badge |

## Acceptance Criteria (from ROADMAP)

- Payroll entry created offline successfully syncs to server on reconnect
- No data loss: entries survive tab close while offline (IDB is persistent)
- 409 conflict: marked "synced by another device" — not silently dropped, not re-queued

## Plans in This Phase

| Plan | Wave | Description | Status |
|------|------|-------------|--------|
| 94-01 | 1 | payrollQueue.ts IDB library + tests | [ ] |
| 94-02 | 2 | useOfflineEntryMutation hook + wizard wiring | [ ] |
| 94-03 | 3 | OfflineBanner unified count + human checkpoint | [ ] |
