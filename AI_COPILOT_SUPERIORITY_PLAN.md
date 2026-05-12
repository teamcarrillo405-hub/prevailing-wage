# PrevWage Copilot and Competitive Advantage Plan

## Product Position

PrevWage should not compete as another wage lookup calculator or generic construction management add-on. The launch product should be a guided federal prevailing wage operating system for contractors: project setup, wage determination matching, worker/classification mapping, payroll review, certified payroll readiness, imports, audit trail, and exception resolution in one flow.

## Paperclip Patterns Reused

The Paperclip folder is a broader autonomous agent platform. PrevWage should reuse the useful product patterns without importing the full control plane:

- Agent identity: PrevWage Copilot is a named compliance assistant with a clear scope.
- Governance: the assistant is advisory first and does not silently change certified payroll.
- Context layer: the assistant receives current page path, safe visible fields, onboarding profile, project data, wage determinations, and payroll compliance status.
- Audit trail: every interaction is recorded with context, suggestions, model used, and latency.
- Tool readiness: suggestions are structured so later phases can convert them into approved actions.

## Why This Is Stronger Than The Competition

### FLC Prevailing Wage Level Calculator

FLC-style calculators answer a narrow wage-level question. PrevWage can be stronger because it connects wage data to the contractor's actual project, county, classification, workers, payroll week, fringe handling, overtime, and filing workflow. The Copilot makes the calculator gap obvious by telling the user what is missing or risky on the page they are already using.

### Knowify

Knowify is broader construction business software. PrevWage can be stronger for federal prevailing wage because the compliance logic is the core workflow, not an add-on. The Copilot should guide contractors through project defaults, worker/classification selection, payroll imports, certified payroll review, and exceptions before payroll is submitted.

### B2Gnow / eComply

B2Gnow/eComply is strong in government compliance administration. PrevWage can be stronger for contractors by being faster to navigate, easier to understand, and focused on doing the work correctly before it becomes an agency rejection or audit issue. The Copilot should explain issues in contractor language and point to the next practical correction.

## Launch Copilot Scope

The launch Copilot should:

- Review the current page and visible non-sensitive fields.
- Use onboarding answers to tailor advice to the contractor's trades, payroll provider, project types, and import workflow.
- Read project wage determination coverage, classifications, workers, payroll weeks, and compliance results.
- Explain missing wage determinations, classification gaps, underpayment warnings, fringe concerns, overtime issues, and import/setup problems.
- Provide next steps and structured suggestions.
- Record interactions for support, QA, and audit defensibility.
- Fall back to local rules when no Claude API key is configured.

## Guardrails

The launch Copilot should not:

- File certified payroll.
- Change worker pay, classifications, wage determinations, or payroll entries without user approval.
- Read sensitive fields such as SSNs, passwords, tokens, bank data, or account numbers from the browser.
- Pretend AI guidance is legal advice or a government determination.

## Next Superiority Layer

After the demo-safe Copilot is stable, the next layer should add approved action tools:

- Prepare a missing project setup checklist.
- Prepare a worker classification correction.
- Prepare a payroll underpayment correction.
- Prepare QuickBooks/import mapping recommendations.
- Prepare a certified payroll readiness report.
- Let the user review and apply each action with a visible change summary.

The later Playwright/browser agent should be an internal QA and assisted-navigation tool first. It can observe screens and test flows, but production account changes should still go through explicit user approval.
