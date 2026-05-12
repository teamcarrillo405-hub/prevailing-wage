# Next Feature Focus

Recommended focus: **California DIR / eCPR validation and WH-347 preflight review**.

## Why This Is Next

The product now has a documented federal/state methodology, compliance evidence, and audit packet support. The next highest-value work is validating the package users actually submit. California is the best first target because HCC users are likely to encounter California public works requirements, and the app already has California fields, daily overtime checks, A-1-131/eCPR export paths, and DIR-specific data points.

## Scope

1. Add a preflight review screen before WH-347, A-1-131, and eCPR exports.
2. Show every blocking issue, warning, and human-review item in one export checklist.
3. Validate required California project fields: DIR project ID, awarding agency, contractor FEIN, CSLB license, workers compensation policy, and contract number.
4. Validate worker fields required for state/federal payroll packages: address, last-four or placeholder identifier, classification, labor type, apprentice program, and rate snapshots.
5. Validate eCPR fringe breakdown totals against payroll entry fringe snapshots.
6. Generate an export evidence summary that records the exact preflight result used at download time.

## Acceptance Criteria

- Export buttons show a preflight summary before file generation.
- Blocking issues prevent export unless the route is explicitly marked as advisory.
- Warnings are visible and must be acknowledged before export.
- The evidence packet includes the preflight result for each exported payroll week.
- Tests cover clean California payroll, missing required DIR fields, apprentice program gaps, fringe mismatch, and WH-347-only federal payroll.

## Out Of Scope

- Automatic legal classification decisions.
- Live submission to DIR or federal agency portals.
- State coverage beyond California, except preserving existing federal WH-347 behavior.
