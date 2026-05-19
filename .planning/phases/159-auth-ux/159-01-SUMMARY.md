---
phase: 159-auth-ux
plan: 01
subsystem: auth
tags: [auth, ux, password-strength, oauth-scaffold]
dependency_graph:
  requires: []
  provides: [password-strength-meter, google-oauth-button-scaffold]
  affects: [RegisterForm, LoginForm, auth-routes]
tech_stack:
  added: []
  patterns: [react-hook-form-watch, transition-colors-animation]
key_files:
  created: []
  modified:
    - src/client/components/auth/RegisterForm.tsx
    - src/client/components/auth/LoginForm.tsx
    - src/server/routes/auth.ts
decisions:
  - Used watch('password') from react-hook-form to get live password value for strength scoring (PasswordInput forwards ref but does not expose value to parent)
  - Used text-text-secondary token for unmet checklist items instead of plan's text-surface-muted (surface-muted is #f9fafb — near-white background color, unusable as text)
  - Wrapped form in outer div to allow Google button + divider to sit above the <form> element
metrics:
  duration: 8m
  completed: 2026-05-18
  tasks_completed: 4
  files_modified: 3
---

# Phase 159 Plan 01: Password Strength Meter + Google OAuth Scaffold Summary

## One-liner

5-segment animated password strength meter with requirements checklist in RegisterForm, plus "Continue with Google" OAuth scaffold button on both auth forms with 501 stub backend route.

## What Was Built

### Task 2 — Password Strength Meter (RegisterForm)

- `scorePassword(pw: string): number` helper outside component — scores 0–5 based on: length >= 8, uppercase present, digit present, symbol present, length >= 12
- `watch('password')` added to `useForm` destructure to get real-time value for scoring
- 5-segment bar below password field: each segment uses `transition-colors` for smooth color animation, fills left-to-right with colors: gray (0) → red (1) → orange (2) → amber (3) → yellow (4) → green (5)
- Strength label text (Weak / Fair / Good / Strong / Very Strong) colored red/amber/green based on score
- Requirements checklist (8+ characters, Uppercase letter, Number or symbol) with green checkmark when met, muted text + circle when unmet
- Entire strength UI hidden when password field is empty; static help text hidden once typing begins

### Task 3 — Google OAuth Button + Stub Route

- "Continue with Google" button with inline Google G SVG (4-path official colors) added above credential fields on both RegisterForm and LoginForm
- "or" divider with `text-text-secondary` between OAuth section and credential form
- `GET /api/auth/google` stub route added to `authRouter` returning `501 OAUTH_NOT_CONFIGURED` — safe placeholder until `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` env vars are set
- No external OAuth libraries imported

### Task 4 — Verification

- HCC Member # label confirmed as `"HCC Member # (optional)"` (from phase 151, unchanged)
- `npx tsc --noEmit` — zero errors in auth-related files; pre-existing errors in `stateWageAdapter.ts` are unrelated to this plan

## Commits

| Hash    | Message |
|---------|---------|
| 6bb65e5 | feat(auth): password strength meter with 5-segment bar and requirements checklist |
| 6e9d84e | feat(auth): Google OAuth button on register/login forms + 501 stub route |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing correct token] Used text-text-secondary instead of text-surface-muted for unmet checklist items**
- **Found during:** Task 2
- **Issue:** Plan specified `text-surface-muted` but `--color-surface-muted` is `#f9fafb` (near-white), rendering invisible on light backgrounds. Not a usable text color.
- **Fix:** Used `text-text-secondary` (`--color-text-secondary: #6e6e73`) which is the correct design-token for muted/secondary text.
- **Files modified:** `src/client/components/auth/RegisterForm.tsx`

**2. [Rule 1 - Bug] Fixed "Number or symbol" regex in requirements checklist**
- **Found during:** Task 2
- **Issue:** Plan's checklist condition `/[0-9^A-Za-z]/.test(password)` would match any letter, digit, or caret — always true when password has any alphanumeric character.
- **Fix:** Used `/[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password)` which correctly checks for a digit OR non-alphanumeric symbol.
- **Files modified:** `src/client/components/auth/RegisterForm.tsx`

## Known Stubs

- `GET /api/auth/google` returns 501 intentionally — full OAuth flow requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` secrets and is deferred to a dedicated OAuth phase.

## Self-Check: PASSED

- `src/client/components/auth/RegisterForm.tsx` — exists, modified
- `src/client/components/auth/LoginForm.tsx` — exists, modified
- `src/server/routes/auth.ts` — exists, modified
- Commit `6bb65e5` — verified in git log
- Commit `6e9d84e` — verified in git log
