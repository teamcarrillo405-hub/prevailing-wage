# Security And Compliance Evidence Pack

Maintain this evidence pack for enterprise customers, agency reviews, and SOC 2 preparation.

## Required Artifacts

- System architecture diagram
- Data flow diagram for worker, payroll, SSN, export, and subcontractor upload data
- Access control matrix for owner, member, auditor, subcontractor upload link, and public API key
- Incident response plan
- Backup and restore policy
- Backup restore test evidence
- Vulnerability management policy
- Dependency review evidence
- Logging and monitoring configuration
- Vendor list and data processing notes
- Data retention and deletion policy
- Security contact and responsible disclosure process

## Operational Evidence

- Latest production deployment tag
- `npm run build` output
- `npm test` output
- `QA_BASE_URL=<production-url> npm run qa:deployment` output
- `/api/health` response
- `/api/ready` response
- Sample audit evidence ZIP
- Sample export preflight blocker report
- Team role review screenshot
- SSO and MFA configuration screenshot when enabled

## Buyer Notes

- Auditors have read-only project access except for the review decision endpoint.
- Payroll mutation routes use write-access checks and reject auditor users.
- SSNs are encrypted at rest and only last four digits are exposed through normal application flows.
- Subcontractor upload links are tokenized, scoped to one CPR week, and expire.
- External logging, email, and Sentry are configurable; production readiness should flag missing required secrets before launch.
