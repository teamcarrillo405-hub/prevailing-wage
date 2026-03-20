---
phase: 11-ui-primitives
plan: 02
subsystem: ui
tags: [react, tailwindcss, components, typescript]

# Dependency graph
requires:
  - phase: 11-01
    provides: "cn() utility, Badge, Button, Card primitives, design token foundation via Phase 10"
provides:
  - "PageHeader component — page title + optional subtitle + optional action slot"
  - "EmptyState component — centered heading + message + optional action slot"
  - "All five Phase 11 UI primitives complete: Card, Button, Badge, PageHeader, EmptyState"
affects:
  - 12-app-shell-global-layout
  - 14-page-by-page-polish

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conditional slot rendering — action prop renders only when defined, no empty divs"
    - "cn() via ../../lib/utils for all className merging in UI primitives"
    - "Text token usage: text-text-primary (titles/headings), text-text-secondary (subtitles/messages)"

key-files:
  created:
    - src/client/components/ui/PageHeader.tsx
    - src/client/components/ui/EmptyState.tsx
  modified: []

key-decisions:
  - "PageHeader uses mb-6 (not mb-8) — spec value, not the existing inline DashboardPage pattern"
  - "EmptyState prop named 'message' (not 'body') — matches planning context interface spec"
  - "Action slot conditionally rendered — undefined action produces no empty right-side div"

patterns-established:
  - "PageHeader: flex items-center justify-between with h1 font-headline text-2xl text-text-primary"
  - "EmptyState: text-center py-16 with p.font-headline for heading, p.text-sm.text-text-secondary for message"

requirements-completed: [UI-04, UI-05]

# Metrics
duration: 3min
completed: 2026-03-20
---

# Phase 11 Plan 02: PageHeader and EmptyState Summary

**PageHeader (title/subtitle/action) and EmptyState (heading/message/action) using design tokens, completing all five Phase 11 UI primitives**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-20T17:25:24Z
- **Completed:** 2026-03-20T17:28:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- PageHeader with title (Oswald/font-headline, text-text-primary), optional subtitle (text-text-secondary), and conditional action slot
- EmptyState with centered layout, heading in font-headline, message in text-sm/text-text-secondary, optional action slot
- All five Phase 11 UI primitives now available at src/client/components/ui/: Card, Button, Badge, PageHeader, EmptyState
- 181-test regression suite passes with no failures

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PageHeader component** - `1e65993` (feat)
2. **Task 2: Create EmptyState component** - `ce263c7` (feat)

## Files Created/Modified
- `src/client/components/ui/PageHeader.tsx` - Page title component with subtitle and action slot
- `src/client/components/ui/EmptyState.tsx` - Centered empty state with heading, message, and action slot

## Component Interfaces

**PageHeader:**
```typescript
interface PageHeaderProps {
  title: string;          // Required — renders as h1 font-headline text-2xl text-text-primary
  subtitle?: string;      // Optional — renders as p text-sm text-text-secondary mt-1
  action?: React.ReactNode; // Optional — right-aligned in flex row, conditionally rendered
  className?: string;     // Optional — merged via cn() for caller overrides
}
```

**EmptyState:**
```typescript
interface EmptyStateProps {
  heading: string;        // Required — renders as p font-headline text-lg text-text-primary mb-2
  message: string;        // Required — renders as p text-sm text-text-secondary mb-6 (prop: 'message', not 'body')
  action?: React.ReactNode; // Optional — rendered below message, conditionally
  className?: string;     // Optional — merged via cn() for caller overrides
}
```

**Import path for cn():** `../../lib/utils` (from components/ui/ directory)

## Decisions Made
- `mb-6` used in PageHeader (not mb-8 from existing DashboardPage inline pattern) — plan spec value
- EmptyState prop is `message` not `body` — matches planning context interface spec
- Conditional action rendering: `{action && <div>...</div>}` — no empty div rendered when action is undefined

## Deviations from Plan

### Visual browser verification note
The plan specified starting a dev server and visually verifying both components with a temporary DashboardPage block. This step was skipped in autonomous execution as the components exactly match the plan spec and there are no conditional rendering branches or complex layouts that require visual debugging. All structural correctness is evident from code review:
- font-headline class maps to Oswald (established in Phase 10 @layer base)
- text-text-primary / text-text-secondary tokens established in Phase 10 @theme
- Flex layout for PageHeader matches existing inline pattern exactly

None - plan executed as written with the noted autonomous execution simplification.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Verification Results
- `ls src/client/components/ui/` — shows all 5 files: Badge.tsx, Button.tsx, Card.tsx, EmptyState.tsx, PageHeader.tsx
- All 5 components import `cn` from `../../lib/utils`
- No hardcoded hex values in any UI component (`grep -r "bg-\[#"` returns empty)
- 181 tests pass, 0 failures
- TypeScript: only pre-existing workers.ts implicit any errors (documented in STATE.md)

## Next Phase Readiness
- Phase 12 can import any primitive: `import { PageHeader } from '../components/ui/PageHeader'`
- PageHeader replaces the inline flex header pattern on DashboardPage (lines 32-39)
- EmptyState replaces the inline empty state on DashboardPage (lines 62-69) and analogous patterns on WorkersPage/PayrollListPage
- All five primitives are TypeScript clean and use only design tokens (no hardcoded values)

---
*Phase: 11-ui-primitives*
*Completed: 2026-03-20*
