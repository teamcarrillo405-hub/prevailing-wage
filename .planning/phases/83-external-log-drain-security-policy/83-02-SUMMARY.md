---
phase: 83-external-log-drain-security-policy
plan: "02"
subsystem: security
tags: [security, soc2, disclosure, markdown]
dependency_graph:
  requires: ["83-01"]
  provides: [SEC-08]
  affects: [security-policy-page, well-known-security-txt]
tech_stack:
  added: []
  patterns: [coordinated-disclosure, three-artifact-consistency]
key_files:
  created:
    - SECURITY_POLICY.md
  modified:
    - src/client/pages/SecurityPolicyPage.tsx
decisions:
  - "Primary contact is security@prevailingwage.app to match the already-deployed /.well-known/security.txt from Phase 80; teamcarrillo405@gmail.com listed as escalation-only"
  - "48-hour SLA in SecurityPolicyPage.tsx updated to 72 hours to match SECURITY_POLICY.md and phase spec"
  - "PGP key fingerprint left as placeholder ('to be published') — intentional; request key via primary contact"
  - "Pre-existing TypeScript error in stripeService.ts (Stripe API version string mismatch) is out of scope and not introduced by this plan"
metrics:
  duration: "2m 12s"
  completed: "2026-04-26"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
requirements:
  - SEC-08
---

# Phase 83 Plan 02: Security Policy Markdown File + Page Reconciliation Summary

**One-liner:** SECURITY_POLICY.md created at repo root with five required sections; SecurityPolicyPage.tsx /security route aligned to same 72h SLA and security@prevailingwage.app contact — three security artifacts now consistent.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Create SECURITY_POLICY.md at repo root | e78dcb3 | SECURITY_POLICY.md (created) |
| 2 | Reconcile SecurityPolicyPage.tsx SLA copy + contact email | cac3499 | src/client/pages/SecurityPolicyPage.tsx |

## What Was Built

### SECURITY_POLICY.md (repo root)

- File path: `SECURITY_POLICY.md` (sibling to `package.json`, `README.md`)
- GitHub auto-renders this file on the repo's Security tab on next push to default branch
- All five required sections present: Supported Versions, Reporting a Vulnerability, Response SLA, Responsible Disclosure, Scope
- Primary contact: `security@prevailingwage.app` (matches `/.well-known/security.txt` from Phase 80)
- Escalation contact: `teamcarrillo405@gmail.com` (honors phase spec; listed only as 72h non-response fallback)
- Acknowledgement SLA: 72 hours — matches phase spec and SecurityPolicyPage.tsx (after Task 2)
- PGP key fingerprint section intentionally left as placeholder ("to be published") — to be added as a future enhancement; researchers can request the key via primary contact

### SecurityPolicyPage.tsx (/security route)

- Changed "48 hours" to "72 hours" in Responsible Disclosure paragraph
- Changed "7 business days" to "14 calendar days" in Responsible Disclosure paragraph
- Replaced all 3 occurrences of `security@prevwage.app` with `security@prevailingwage.app`:
  - `href="mailto:security@prevwage.app"` (anchor href)
  - link text `security@prevwage.app`
  - "Last updated" paragraph reference

### Three-Artifact Consistency

All three security artifacts now advertise the same contact and SLA:

| Artifact | Contact | Ack SLA |
| -------- | ------- | ------- |
| `/.well-known/security.txt` (Phase 80, index.ts) | security@prevailingwage.app | not specified (machine-readable only) |
| `SECURITY_POLICY.md` (this plan) | security@prevailingwage.app | 72 hours |
| `/security` React page (SecurityPolicyPage.tsx) | security@prevailingwage.app | 72 hours |

## Test Results

- Before: 724 passing, 42 todo (Plan 01 final state)
- After: 724 passing, 42 todo
- No regression introduced

## Known Stubs

None. SECURITY_POLICY.md is complete authoritative content. PGP fingerprint placeholder is intentional and documented.

## Deviations from Plan

None — plan executed exactly as written.

**Pre-existing issue noted (out of scope):** `src/server/services/stripeService.ts` has a pre-existing TypeScript error (Stripe API version string `"2026-04-22.dahlia"` not assignable to `"2026-03-25.dahlia"`). This error predates this plan, is not introduced by any change here, and is logged to deferred-items per scope rules.

## Self-Check: PASSED

- FOUND: SECURITY_POLICY.md at repo root
- FOUND: src/client/pages/SecurityPolicyPage.tsx modified
- FOUND: commit e78dcb3 (Task 1)
- FOUND: commit cac3499 (Task 2)
