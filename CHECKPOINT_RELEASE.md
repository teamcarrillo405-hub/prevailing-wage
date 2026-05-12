# Checkpoint Release

Checkpoint: `v8.1.0`

Base commit reviewed: `05bd795 chore: consolidate prevailing wage updates`

## Included

- Prevailing wage methodology and evidence workflow.
- User-facing certification boundary disclaimer.
- Compliance methodology page and API endpoint.
- Week-level compliance evidence endpoint.
- Audit packet methodology/evidence fields.
- Next feature focus: California DIR / eCPR validation and WH-347 preflight review.

## Verification

- `npm run build`
- Focused compliance/evidence/export tests
- Full suite passed before this checkpoint work; focused tests are rerun for the release commit.

## Release Notes

This checkpoint is intended as a stable baseline for QA and deployment validation. The system prepares and reviews certified payroll records, but final certification, legal classification decisions, and agency submission remain the responsibility of the authorized reviewer.
