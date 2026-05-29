---
phase: 162-agency-portal
plan: 01
status: complete
completed: 2026-05-28
---

# Phase 162-01 Summary: Agency Portal — Read-Only Reviewer Login + Review Stamp

## What Was Built

- `src/server/db/migrations/0084_agency_reviewer.sql` — creates `reviewer_project_access` (reviewer_user_id, project_id, granted_by, UNIQUE constraint) and `payroll_week_comments` (week_id, user_id, comment, review_stamp approved|flagged|pending) tables
- `src/server/routes/agency.ts` — three endpoints using Drizzle raw SQL: `GET /api/agency/projects` (returns projects joined via reviewer_project_access for the authenticated user), `GET /api/agency/projects/:id/weeks` (access-checked payroll weeks, read-only), `POST /api/agency/weeks/:weekId/review` (inserts comment + stamp)
- `src/client/pages/AgencyReviewPage.tsx` — two-panel layout: project list sidebar (highlights selected in brand-gold) and week list with clickable rows; inline review form with stamp selector (pending/approved/flagged), textarea, and submit mutation
- Route `/agency` wired in `src/client/App.tsx` via React.lazy behind ProtectedRoute

## Requirements Satisfied

- AGENCY-01: `reviewer_project_access` and `payroll_week_comments` DB tables with role-scoped access ✓
- AGENCY-02: Read-only `GET /api/agency/projects` and `GET /api/agency/projects/:id/weeks` endpoints with access-check guard ✓
- AGENCY-03: `POST /api/agency/weeks/:weekId/review` endpoint + AgencyReviewPage review form with stamp options ✓
