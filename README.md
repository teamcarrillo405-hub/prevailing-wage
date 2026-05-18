# HCC Prevailing Wage

[![CI](https://github.com/teamcarrillo405-hub/prevailing-wage/actions/workflows/ci.yml/badge.svg)](https://github.com/teamcarrillo405-hub/prevailing-wage/actions/workflows/ci.yml)
[![Security Audit](https://github.com/teamcarrillo405-hub/prevailing-wage/actions/workflows/security.yml/badge.svg)](https://github.com/teamcarrillo405-hub/prevailing-wage/actions/workflows/security.yml)

Certified payroll compliance software for federal construction contractors.

Davis-Bacon and Related Acts (DBRA) compliance — 8 states, AES-256-GCM SSN encryption, WH-347 PDF generation.

## Setup

```bash
npm install
npm run dev
```

Environment variables for production pilots and live integrations are documented in [docs/ENVIRONMENT.md](./docs/ENVIRONMENT.md). Jurisdiction launch status is tracked in [docs/JURISDICTION_COVERAGE_MATRIX.md](./docs/JURISDICTION_COVERAGE_MATRIX.md) and [docs/STATE_EXPANSION_READINESS.md](./docs/STATE_EXPANSION_READINESS.md). QuickBooks and Procore remain explicit import-fallback workflows until live OAuth credentials are configured.

## Tech Stack

- Node.js + Express + TypeScript
- React + Vite + TailwindCSS v4
- SQLite + Drizzle ORM
- pdf-lib (WH-347 PDF generation)

## Security

See [SECURITY_POLICY.md](./SECURITY_POLICY.md) for vulnerability disclosure and data classification policy.
