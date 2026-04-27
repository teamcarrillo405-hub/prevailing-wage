# Phase 104 Validation — Advanced Audit Analytics

## Requirements Covered
- REPT-06: Pivot table hours by trade/classification/week, CSV + PDF export, drill-down

## Plan 01 — Server Endpoint

### Route exists
```bash
cd /c/Users/glcar/prevailing-wage && grep -n "hours-pivot" src/server/routes/reports.ts
```
Expected: route handler definition.

### JSON format
```bash
curl -s -b "session=<valid-cookie>" http://localhost:4099/api/reports/<projectId>/hours-pivot | python3 -m json.tool | head -20
```
Expected: `{ "pivot": [...], "total": N }` with rows containing weekEndingDate, tradeCode, totalHours, etc.

### CSV download
```bash
curl -s -b "session=<valid-cookie>" "http://localhost:4099/api/reports/<projectId>/hours-pivot?format=csv" | head -3
```
Expected: BOM + CSV header row + data rows.

### PDF download
```bash
curl -s -b "session=<valid-cookie>" "http://localhost:4099/api/reports/<projectId>/hours-pivot?format=pdf" -o /tmp/test-pivot.pdf && file /tmp/test-pivot.pdf
```
Expected: `PDF document`.

### Auth protection
```bash
curl -s http://localhost:4099/api/reports/any-id/hours-pivot
```
Expected: 401/403.

## Plan 02 — Client UI

### Manual checks
- [ ] Visit http://localhost:5173/projects/:id/reports (requires login)
- [ ] "Hours by Trade / Classification / Week" section visible
- [ ] Table renders with columns: Week Ending, Trade, Type, ST Hrs, OT Hrs, DT Hrs, Total, Workers, Gross Wages
- [ ] Trade code shown as dark gold badge
- [ ] "Download CSV" link triggers download (check browser download bar)
- [ ] "Download PDF" link opens PDF in new tab
- [ ] Clicking a row shows amber drill-down sub-row
- [ ] Clicking again collapses the drill-down
- [ ] Empty state shown when no payroll data exists

## TypeScript check
```bash
cd /c/Users/glcar/prevailing-wage && npx tsc --noEmit 2>&1 | grep -v "workers.ts" | grep "error" | wc -l
```
Expected: 0 new errors.
