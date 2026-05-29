---
phase: 166-sca-support
plan: 01
status: complete
completed: 2026-05-28
---

# Phase 166-01 Summary: SCA (Service Contract Act) Support

## What Was Built

- `src/server/db/migrations/0087_sca_project_type.sql` — adds `project_type TEXT NOT NULL DEFAULT 'davis-bacon' CHECK(project_type IN ('davis-bacon','sca','both'))` to the `projects` table
- `src/server/services/scaComplianceService.ts` — `checkScaCompliance()` function that evaluates payroll entries against the SCA Health & Welfare fringe floor ($5.36/hr, 2024 WD baseline) and returns typed `ScaViolation[]`
- `src/client/components/projects/ProjectForm.tsx` — `projectType` field (Zod enum davis-bacon|sca|both) added to the form schema with a "Project Type" select (Davis-Bacon Act / Service Contract Act / Both)
- `src/client/pages/ProjectDetailPage.tsx` — SCA indicator badge rendered in the project header when `project_type` is not `'davis-bacon'`; displays "SCA" or "Davis-Bacon + SCA" in purple styling

## Requirements Satisfied

- SCA-01: `projects.project_type` column with davis-bacon|sca|both constraint and davis-bacon default ✓
- SCA-02: `scaComplianceService.checkScaCompliance()` enforcing SCA fringe floor per worker entry ✓
- SCA-03: Project type selector in ProjectForm and SCA badge on ProjectDetailPage ✓
