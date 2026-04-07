---
phase: 46-notifications
plan: "04"
subsystem: notifications
tags: [notif-settings, project-detail, patch-merge, ui-panel]
dependency_graph:
  requires: [46-01, 46-02, 46-03]
  provides: [notif-prefs-ui, projectSettings-merge]
  affects: [ProjectDetailPage, projects-patch-handler]
tech_stack:
  added: []
  patterns: [read-modify-write JSON merge, collapsible Card panel, useMutation + invalidateQueries]
key_files:
  created: []
  modified:
    - src/server/routes/projects.ts
    - src/client/pages/ProjectDetailPage.tsx
decisions:
  - "Used shallow spread merge (currentParsed + incomingParsed) so incoming notification keys overwrite existing ones while all other keys are preserved"
  - "parseNotifSettings helper defined locally in ProjectDetailPage (not imported from emailService) to avoid pulling server code into the client bundle"
  - "Panel seeded on open (handleOpenNotifPanel) rather than useEffect — avoids stale closure issues and ensures fresh project.projectSettings is used at click time"
  - "border-border-default and bg-surface-page used on number input to stay on design tokens; accent-brand-gold on checkboxes"
metrics:
  duration: "~25 minutes"
  completed: "2026-04-07T19:38:00Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase 46 Plan 04: Notification Preferences Panel Summary

Server-side projectSettings read-modify-write merge in PATCH handler + collapsible notification preferences Card panel on ProjectDetailPage with 4 checkboxes and a configurable days-before threshold.

## What Was Built

### Task 1 — Server-side projectSettings merge (`src/server/routes/projects.ts`)

The PATCH `/api/projects/:id` handler previously passed `projectSettings` directly from the request body to `db.update()`. This was unsafe: a client sending `{ projectSettings: '{"notifyViolations":false}' }` would wipe any other keys stored in that column (NY form data, `lastDueSoonNotifiedAt`, etc.).

The handler now does a read-modify-write:
1. If `updates.projectSettings` is defined, read the current row's `projectSettings` from the DB
2. Parse both current and incoming as JSON (IIFE try/catch — invalid JSON falls back to `{}`)
3. Spread merge: `{ ...currentParsed, ...incomingParsed }` — incoming keys overwrite, all other keys preserved
4. Write `resolvedProjectSettings` (the merged JSON string) instead of raw `updates.projectSettings`

Key variable introduced: `resolvedProjectSettings` (grep-able, confirmed in plan artifact contract).

### Task 2 — Notification preferences panel (`src/client/pages/ProjectDetailPage.tsx`)

Added to the existing project detail page:

- **`Project` interface** — added `projectSettings: string | null`
- **`NotifSettings` interface** + `DEFAULT_NOTIF_SETTINGS` constant + `parseNotifSettings` helper (safe JSON.parse with defaults fallback)
- **`Settings` icon** imported from lucide-react alongside existing `Workflow`
- **`notifPanelOpen`** and **`notifPrefs`** state variables
- **`saveNotifMutation`** — calls `api.patch('/projects/:id', { projectSettings: JSON.stringify(prefs) })`, invalidates `['projects', id]` query on success, closes panel
- **`handleOpenNotifPanel`** — seeds `notifPrefs` from `parseNotifSettings(project.projectSettings)` before opening
- **Gear button** added to action button row (variant="secondary", beside Archive/Restore)
- **Collapsible `Card` panel** with:
  - Compliance violation alerts checkbox
  - Team activity alerts checkbox
  - Submission confirmation emails checkbox
  - Payroll due-soon reminders checkbox + number input (1–30 days, disabled when unchecked)
  - Save Preferences / Cancel buttons

Design tokens used throughout: `font-headline` on h3, `font-body` on label text, `accent-brand-gold` on checkboxes, `border-border-default` + `bg-surface-page` on number input. No hardcoded hex values.

## Deviations from Plan

None — plan executed exactly as written. The plan specified `border-border-default` design token for the number input border (rather than the hardcoded `border-gray-300` shown in the prompt's example snippet); the design-token version was used to comply with CLAUDE.md.

## Known Stubs

None. All panel controls are wired to `notifPrefs` state and the save mutation persists to DB.

## Self-Check: PASSED

| Item | Status |
| ---- | ------ |
| src/server/routes/projects.ts | FOUND |
| src/client/pages/ProjectDetailPage.tsx | FOUND |
| .planning/phases/46-notifications/46-04-SUMMARY.md | FOUND |
| Commit eeb44b2 (Task 1) | FOUND |
| Commit bd6c045 (Task 2) | FOUND |
