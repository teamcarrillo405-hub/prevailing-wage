# Phase 88 Validation Checklist — Live SAM.gov WD Fetch

Requirements: COMP-06, COMP-07

Run all checks from the repo root:
```bash
cd /c/Users/glcar/prevailing-wage
```

---

## C1 — SAMGOV_API_KEY in .env.example (COMP-06)

```bash
grep "SAMGOV_API_KEY" .env.example && echo "PASS" || echo "FAIL"
```

Expected: `SAMGOV_API_KEY=` line present with comment referencing open.gsa.gov.

---

## C2 — Weekly cron expression (COMP-06)

```bash
grep "0 3 \* \* 0" src/server/index.ts && echo "PASS" || echo "FAIL"
```

Expected: `cron.schedule('0 3 * * 0', ...)` with `timezone: 'UTC'`.

---

## C3 — Monthly cron removed (COMP-06)

```bash
result=$(grep -c "0 2 1 \* \*" src/server/index.ts 2>/dev/null || echo "0")
[ "$result" = "0" ] && echo "PASS — old monthly cron gone" || echo "FAIL — old cron still present"
```

Expected: 0 matches (old `'0 2 1 * *'` expression fully replaced).

---

## C4 — wd_revision_log migration file exists (COMP-07)

```bash
[ -f src/server/db/migrations/0055_wd_revision_log.sql ] && \
  grep -q "wd_revision_log" src/server/db/migrations/0055_wd_revision_log.sql && \
  echo "PASS" || echo "FAIL"
```

Expected: File exists and contains `CREATE TABLE IF NOT EXISTS wd_revision_log`.

---

## C5 — Migration registered in journal (COMP-07)

```bash
node -e "
const j = JSON.parse(require('fs').readFileSync('src/server/db/migrations/meta/_journal.json', 'utf8'));
const e = j.entries.find(x => x.idx === 55);
if (e && e.tag === '0055_wd_revision_log') console.log('PASS:', e.tag);
else { console.log('FAIL — entry missing or wrong tag'); process.exit(1); }
"
```

Expected: `PASS: 0055_wd_revision_log`

---

## C6 — Drizzle wdRevisionLog exported from schema.ts (COMP-07)

```bash
grep "export const wdRevisionLog" src/server/db/schema.ts && echo "PASS" || echo "FAIL"
```

Expected: `export const wdRevisionLog = sqliteTable('wd_revision_log', ...)`

---

## C7 — Revision diff logged in wdolSync.ts (COMP-07)

```bash
grep "db.insert(wdRevisionLog)" src/server/services/wdolSync.ts && echo "PASS" || echo "FAIL"
```

Expected: insert call present in Phase 1 pinned-WD loop.

---

## C8 — wdChangeDetector surfaces revision log entries (COMP-07)

```bash
grep "recentRevisions\|wdRevisionLog" src/server/services/wdChangeDetector.ts && echo "PASS" || echo "FAIL"
```

Expected: Both identifiers present — detector scans wd_revision_log in last 24 h.

---

## C9 — Stale-WD banner in ProjectDetailPage (COMP-06)

```bash
node -e "
const p = require('fs').readFileSync('src/client/pages/ProjectDetailPage.tsx', 'utf8');
const checks = [
  ['StaleWdBanner component', p.includes('function StaleWdBanner')],
  ['AlertTriangle import', p.includes('AlertTriangle')],
  ['wd-pins query key', p.includes(\"'wd-pins'\")],
  ['ROADMAP banner text', p.includes('days ago')],
  ['amber bg token', p.includes('bg-amber-50')],
  ['no hardcoded hex', !p.match(/#[0-9a-fA-F]{6}/)],
];
let pass = true;
for (const [label, ok] of checks) {
  console.log((ok ? 'PASS' : 'FAIL') + ' — ' + label);
  if (!ok) pass = false;
}
process.exit(pass ? 0 : 1);
"
```

Expected: All 6 lines show PASS.

---

## C10 — GET /wage-determinations returns lastFetchedAt (COMP-06)

```bash
grep "lastFetchedAt\|wageDeterminations\.lastFetchedAt" src/server/routes/projectWageDeterminations.ts && echo "PASS" || echo "FAIL"
```

Expected: lastFetchedAt is selected via JOIN on wageDeterminations in the GET handler.

---

## C11 — TypeScript clean (no new errors)

```bash
npm run typecheck 2>&1 | grep -E "error TS" | grep -v "workers.ts" | head -10
echo "Exit $? — 0 means clean (workers.ts pre-existing implicit-any excluded)"
```

Expected: No lines (pre-existing workers.ts lines 108/115 implicit-any are exempt).

---

## C12 — Test suite green

```bash
npm test 2>&1 | tail -8
```

Expected: All existing tests pass (count >= pre-Phase-88 baseline).

---

## Summary table

| # | Criterion | Requirement |
|---|-----------|-------------|
| C1 | SAMGOV_API_KEY in .env.example | COMP-06 |
| C2 | Weekly cron '0 3 * * 0' UTC | COMP-06 |
| C3 | Old monthly cron removed | COMP-06 |
| C4 | 0055_wd_revision_log.sql exists | COMP-07 |
| C5 | Journal idx=55 registered | COMP-07 |
| C6 | wdRevisionLog exported from schema | COMP-07 |
| C7 | Revision diff inserted in wdolSync | COMP-07 |
| C8 | Detector surfaces revision log entries | COMP-07 |
| C9 | StaleWdBanner on ProjectDetailPage | COMP-06 |
| C10 | GET /wage-determinations returns lastFetchedAt | COMP-06 |
| C11 | TypeScript clean | - |
| C12 | Test suite green | - |

GATE_PASS requires C1–C10 all PASS + C11 clean + C12 green.
