# Phase 26: Contractor Guidance System - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-26
**Phase:** 26-contractor-guidance-system
**Areas discussed:** Tooltip / ? icon, Help callout design, Empty state content strategy, Landing page how-it-works

---

## Tooltip / ? Icon (UX-08)

| Option | Description | Selected |
|--------|-------------|----------|
| Custom React component | No new dependencies, ~30 lines, useState open/close | ✓ |
| Radix UI Tooltip | Battle-tested, a11y built-in, adds dependency | |
| CSS-only hover + JS tap fallback | Minimal JS, limited a11y | |

**User's choice:** Custom React component
**Notes:** Consistent with existing codebase pattern (no Radix or Headless UI anywhere)

| Option | Description | Selected |
|--------|-------------|----------|
| Inline with the term | `?` appears right after the word inline | ✓ |
| Only in help callouts | Terms only get tooltips inside callout | |
| You decide | Claude picks placement | |

**User's choice:** Inline with the term

---

## Help Callout Design (UX-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Persistent info card | Subtle Card, info icon, 1-2 sentences, always visible | ✓ |
| Collapsible panel | Collapsed by default, requires click | |
| Banner strip | Full-width, more prominent | |

**User's choice:** Persistent info card

| Option | Description | Selected |
|--------|-------------|----------|
| Always visible, no dismiss | No localStorage state needed | ✓ |
| Dismissible per-session | X button, reappears next session | |
| Dismissible permanently (localStorage) | One-time close | |

**User's choice:** Always visible, no dismiss

| Option | Description | Selected |
|--------|-------------|----------|
| New HelpCallout component | src/client/components/ui/HelpCallout.tsx | ✓ |
| Inline JSX per page | Direct markup, 5 copies to maintain | |

**User's choice:** New HelpCallout component

---

## Empty State Content Strategy (UX-07)

| Option | Description | Selected |
|--------|-------------|----------|
| Text + action button | Message + Button that navigates | ✓ |
| Text only | Instructional, no button | |
| You decide per page | Claude picks per context | |

**User's choice:** Text + action button

Pages selected for update:
- Workers page ✓
- Payroll Week list ✓
- Payroll Entry (verify/update) ✓
- Dashboard (verify/update) ✓

---

## Landing Page How-It-Works (UX-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Move section directly under hero | Reorder, minimal change | ✓ |
| Embed abbreviated version in hero | Redesign hero layout | |
| You decide position | Claude decides | |

**User's choice:** Move section directly under hero

| Option | Description | Selected |
|--------|-------------|----------|
| Rewrite in contractor-friendly language | Speak to GC unfamiliar with Davis-Bacon | ✓ |
| Reposition only | Keep current text | |
| Add Workers step (currently missing) | Expand to 4-step flow | |

**User's choice:** Rewrite in contractor-friendly language
**Notes:** Implied add Workers step as part of rewrite (4-step flow: Create → Add Workers → Enter Payroll → Generate WH-347)

---

## Claude's Discretion

- Exact tooltip definition wording per compliance term
- Tooltip positioning (bias above the term)
- Info icon choice for HelpCallout
- Specific help callout copy per page
- Whether HelpCallout wraps Card or replicates token classes

## Deferred Ideas

None.
