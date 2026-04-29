# Phase 90 Validation — Procore Timesheet Sync

## Acceptance Criteria (from ROADMAP Phase B)

> Procore OAuth connect/disconnect works end-to-end; test project timesheet imports cleanly.

---

## Requirements Coverage

| Requirement | Plan | Verified By |
|-------------|------|-------------|
| INT-01: Procore OAuth2 connect flow | 90-01, 90-03 | procoreService.test.ts + human checkpoint |
| INT-02: Timesheet import bridge → payroll entries | 90-02 | procoreRoutes.test.ts + human checkpoint |

---

## End-to-End Validation Checklist

Run after all three plans complete.

### 1. Schema + Migration

```bash
cd /c/Users/glcar/prevailing-wage

# Migration file present
ls src/server/db/migrations/0055_procore_connections.sql

# Journal entry registered
python3 -c "
import json
j = json.load(open('src/server/db/migrations/meta/_journal.json'))
entry = next((e for e in j['entries'] if e['idx'] == 55), None)
assert entry is not None, 'FAIL: 0055 not in journal'
assert entry['tag'] == '0055_procore_connections', f'FAIL: wrong tag {entry[\"tag\"]}'
print('PASS: journal entry idx=55 present')
"

# Schema export present
grep "export const procoreTokens" src/server/db/schema.ts && echo "PASS: procoreTokens in schema"
```

### 2. TypeScript Clean Build

```bash
cd /c/Users/glcar/prevailing-wage

npx tsc --noEmit 2>&1 | grep -v "workers.ts" > /tmp/tsc-out.txt
if [ -s /tmp/tsc-out.txt ]; then
  echo "FAIL: new tsc errors introduced:"
  cat /tmp/tsc-out.txt
else
  echo "PASS: tsc --noEmit clean (workers.ts pre-existing errors excluded)"
fi
```

### 3. Vitest

```bash
cd /c/Users/glcar/prevailing-wage

# procoreService unit tests
npx vitest run src/tests/procoreService.test.ts 2>&1 | tail -5

# procoreRoutes unit tests
npx vitest run src/tests/procoreRoutes.test.ts 2>&1 | tail -5

# Full suite regression (no new failures)
npx vitest run 2>&1 | tail -10
```

### 4. Server Routes Present

```bash
cd /c/Users/glcar/prevailing-wage

# All 6 Procore routes registered
for ROUTE in "procore/status" "procore/connect" "procore/callback" "delete.*procore" "procore/timesheet-entries" "procore/import"; do
  grep -n "$ROUTE" src/server/routes/integrations.ts | head -1 || echo "MISSING: $ROUTE"
done
```

### 5. Client

```bash
cd /c/Users/glcar/prevailing-wage

# ProcoreImportPage registered in App.tsx
grep "ProcoreImportPage\|procore/import" src/client/App.tsx

# Integrations page has Procore card
grep "procore-status\|Connect to Procore\|Import Timesheets" src/client/pages/IntegrationsPage.tsx
```

### 6. Manual Smoke Test (dev — Procore creds not required)

```bash
# Start the dev server
cd /c/Users/glcar/prevailing-wage && npm run dev
```

Steps (run in browser, logged in as any user):

1. Navigate to `/settings/integrations`
   - EXPECT: Procore card visible below QuickBooks card
   - EXPECT: "Not connected" badge (no dev creds)
   - EXPECT: "Connect to Procore" button present

2. Navigate to `/settings/integrations?procore=connected`
   - EXPECT: Green banner "Procore connected successfully."

3. Navigate to `/procore/import`
   - EXPECT: ProcoreImportPage renders (not a blank screen / 404)
   - EXPECT: Amber "Procore is not connected" callout with link to /settings/integrations

4. Call status endpoint directly
   ```bash
   curl -s -b "YOUR_SESSION_COOKIE" http://localhost:4099/api/integrations/procore/status
   # EXPECT: {"data":{"connected":false}}
   ```

5. Call without auth
   ```bash
   curl -s http://localhost:4099/api/integrations/procore/status
   # EXPECT: 401 or redirect
   ```

### 7. End-to-End Connect Flow (requires real Procore sandbox credentials)

If `PROCORE_CLIENT_ID`, `PROCORE_CLIENT_SECRET`, `PROCORE_REDIRECT_URI` are set in `.env`:

```bash
# In a browser tab while logged in:
# 1. Visit http://localhost:4099/api/integrations/procore/connect
#    → Should redirect to https://login.procore.com/oauth/authorize?...
# 2. Approve in Procore sandbox
#    → Should redirect back to /settings/integrations?procore=connected
# 3. Re-check status endpoint: connected=true, companyId populated
# 4. Navigate to /procore/import, enter a real Procore projectId + date range
#    → Should fetch and display timesheet rows
# 5. Click Disconnect on /settings/integrations
#    → Should return to Not connected state
```

---

## Phase Pass Criteria

Phase 90 passes when ALL of the following are true:

- [ ] `0055_procore_connections.sql` migration present and journal updated
- [ ] `procoreTokens` exported from schema.ts
- [ ] `procoreService.ts` exports 5 functions, uses encryptSsn/decryptSsn
- [ ] 6 Procore routes present in integrations.ts
- [ ] `ProcoreImportPage.tsx` exists with 3-state UI
- [ ] App.tsx registers `/procore/import` with ProtectedRoute
- [ ] IntegrationsPage.tsx has Procore card with Connected/Not connected states
- [ ] `npx tsc --noEmit` passes (pre-existing workers.ts errors excluded)
- [ ] `npx vitest run` passes (no new failures vs pre-phase baseline)
- [ ] Human visual checkpoint in 90-03 approved
