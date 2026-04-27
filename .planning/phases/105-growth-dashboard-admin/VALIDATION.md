# Phase 105 Validation — Growth Dashboard (Admin)

## Requirements Covered
- OPS-01: Admin-only /admin/growth page, metrics: active users, submission rate, compliance score trends, MRR

## Environment Setup
Before testing, ensure ADMIN_EMAILS is set in server .env:
```
ADMIN_EMAILS=teamcarrillo405@gmail.com
```
This controls who can access the growth endpoint.

## Plan 01 — Server Endpoint

### Route registration
```bash
cd /c/Users/glcar/prevailing-wage && grep -n "growthRouter\|/api/admin" src/server/index.ts
```
Expected: import + `app.use('/api/admin', growthRouter)` lines.

### 403 for non-admin
```bash
curl -s -b "session=<non-admin-cookie>" http://localhost:4099/api/admin/growth
```
Expected: `{"error":"Admin access required"}` with HTTP 403.

### JSON response for admin
```bash
curl -s -b "session=<admin-cookie>" http://localhost:4099/api/admin/growth | python3 -m json.tool
```
Expected JSON with all keys:
- totalUsers, activeUsersLast30d, newUsersLast30d
- totalPayrollWeeks, submittedWeeks, submissionRate
- avgComplianceScore, totalViolations
- totalProjects, activeProjects
- mrrEstimate
- weeklyNewUsers (array), weeklySubmissions (array)

## Plan 02 — Client UI

### Manual checks
- [ ] Visit http://localhost:5173/admin/growth as non-admin user
  - Expected: 403 message with "Admin access required" and back link
- [ ] Visit http://localhost:5173/admin/growth as admin user (ADMIN_EMAILS match)
  - Expected: Page loads with "Growth Dashboard" PageHeader
- [ ] 4 KPI metric cards visible: Active Users, Submission Rate, Compliance Score, MRR
- [ ] 2 sparkline charts visible: Weekly New Users, Weekly Submissions
- [ ] Projects summary card shows active vs total
- [ ] Loading skeleton visible briefly before data loads
- [ ] unauthenticated visit redirects to /login (ProtectedRoute)

## TypeScript check
```bash
cd /c/Users/glcar/prevailing-wage && npx tsc --noEmit 2>&1 | grep -v "workers.ts" | grep "error" | wc -l
```
Expected: 0 new errors.
