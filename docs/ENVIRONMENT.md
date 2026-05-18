# Environment Configuration

PrevWage can run locally with manual entry and CSV imports. Live integrations stay disabled unless their credentials are present.

## Core Runtime

| Variable | Required | Purpose |
| --- | --- | --- |
| `JWT_SECRET` | Production | Signs application sessions. Use a high-entropy value. |
| `ENCRYPTION_KEY_V1` | Production | AES-256-GCM key material for encrypted secrets and sensitive fields. |
| `CORS_ORIGIN` | Production | Browser origin allowed to call the API. |
| `DATABASE_URL` | Deployment-specific | SQLite path or deployed database URL, depending on runtime. |

## Storage

| Variable | Required | Purpose |
| --- | --- | --- |
| `PHOTOS_DIR` | Optional | Local directory for project and week photos. Defaults to local app storage. |
| `SIGNATURES_DIR` | Optional | Local directory for contractor signature images. Defaults to local app storage. |

## Live Integrations

| Provider | Variables | Behavior When Missing |
| --- | --- | --- |
| QuickBooks Online | `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_REDIRECT_URI` | OAuth connect returns setup-needed; payroll register CSV import remains available. |
| Procore | `PROCORE_CLIENT_ID`, `PROCORE_CLIENT_SECRET`, `PROCORE_REDIRECT_URI` | OAuth connect returns setup-needed; field clock and payroll import remain available. |
| SAM.gov | `SAM_GOV_API_KEY` | The app uses SAM's public `DEMO_KEY`, which is suitable only for low-volume demo lookup. |
| Resend | `RESEND_API_KEY` | Outbound email is skipped; upload links and reminders remain internal app actions. |

Production-pilot readiness requires checking `/api/integrations/readiness` and confirming whether each live provider is `configured` and `connected`, or documenting the import fallback used for the pilot.
