# Phase 98 — Offline Compliance Checklists: Validation Checklist

## Automated Checks

```bash
cd /c/Users/glcar/prevailing-wage

# 1. TypeScript compiles clean
npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0 errors"

# 2. IDB wrapper exists and exports correct functions
ls src/client/lib/checklistDb.ts
grep -E "openChecklistDb|saveChecklist|getChecklists|markSynced|syncPendingChecklists" src/client/lib/checklistDb.ts | wc -l

# 3. Migration file exists
ls src/server/db/migrations/0036_checklist_syncs.sql

# 4. Schema has checklistSyncs
grep "checklistSyncs" src/server/db/schema.ts

# 5. Server route exists and is mounted
ls src/server/routes/checklists.ts
grep "checklists" src/server/index.ts

# 6. Page component exists
ls src/client/pages/OfflineChecklistPage.tsx

# 7. Routes registered in App.tsx
grep "checklists" src/client/App.tsx
```

## Functional Verification (Manual)

```bash
npm run dev
```

### Online Mode
- [ ] Navigate to /checklists — page renders with "Works Offline" banner
- [ ] Navigate to /projects/:id/checklists — default 8-item checklist auto-appears
- [ ] Sync status badge shows "Synced" or "Online" (no error)

### Offline Mode (Chrome DevTools > Network > Offline)
- [ ] Page is still accessible (not a blank screen)
- [ ] Existing checklists still visible (served from IDB, not server)
- [ ] Can check/uncheck items — no JS errors in console
- [ ] After checking all items, completedAt is set (visible in DevTools > Application > IndexedDB > pw-checklists)
- [ ] Sync badge shows "Offline"

### Reconnect Sync
- [ ] Set network back to Online
- [ ] Sync badge briefly shows "Syncing..." then "Synced"
- [ ] POST /api/checklists/sync appears in Network tab
- [ ] Server returns 200 with `{data:{synced:1}}`
- [ ] syncedAt field updated in IDB (check DevTools)

### Checklist Actions
- [ ] "New Checklist" button creates a second checklist with fresh UUID
- [ ] "Delete" on a checklist removes it from IDB
- [ ] Checking all 8 items marks checklist as complete

### IndexedDB Verification (DevTools > Application > Storage > IndexedDB)
- [ ] Database "pw-checklists" exists
- [ ] Object store "checklists" contains checklist records
- [ ] After checking items, the stored object reflects checked state

## Requirements Traceability

| Requirement | Component | Status |
|-------------|-----------|--------|
| MOB-22: Pre-inspection checklist in IndexedDB | checklistDb.ts + OfflineChecklistPage.tsx | Validate above |
| MOB-22: Offline accessible (no network needed) | IDB storage, native fetch fallback | Validate above |
| MOB-22: Syncs when connected | syncPendingChecklists() on online event | Validate above |
