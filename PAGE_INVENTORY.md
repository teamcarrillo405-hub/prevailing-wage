# Prevailing Wage Page Inventory

This is the current page map from the landing page through every declared client route in `src/client/App.tsx`, plus navigation notes found in the shared layout.

## Public Entry Pages

| Route | Page | Purpose |
| --- | --- | --- |
| `/` | Landing page | Public homepage and primary product pitch. |
| `/login` | Login | Existing user sign-in. |
| `/register` | Create account | New account registration, then onboarding. |
| `/pricing` | Pricing | Public pricing page. |
| `/government` | Government | Public government/agency page. |
| `/roi` | ROI calculator | Public value calculator. |
| `/testimonials` | Testimonials | Public social proof page. |
| `/reviews` | Reviews | Public reviews page, currently served by the testimonials page. |
| `/case-studies` | Case studies | Public case study index. |
| `/case-studies/hcc` | HCC case study | Public HCC case study. |
| `/case-studies/wa-dot` | WA DOT case study | Public WA DOT case study. |
| `/contact` | Contact | Public contact/sales page. |
| `/security` | Security policy | Public security and trust page. |
| `/api-docs` | API docs | Public developer/API documentation. |

## Public Token Or Invite Pages

| Route | Page | Purpose |
| --- | --- | --- |
| `/accept-invite` | Accept invite | Team invite acceptance. |
| `/sub-upload/:token` | Subcontractor upload | Token-based subcontractor upload flow. |

## Authenticated Core Pages

| Route | Page | Purpose |
| --- | --- | --- |
| `/onboarding` | Onboarding | Contractor business setup, preferences, and integrations setup. |
| `/dashboard` | Dashboard | Authenticated home, project portfolio, alerts, and readiness overview. |
| `/wages` | Prevailing wage lookup | Search federal wage determinations and pin WD sources to projects. |
| `/cost-estimation` | Cost estimation | Estimate labor and compliance cost impacts. |
| `/field` | Field hub | Field clock/project entry point. |
| `/reports` | Global reports | Cross-project reporting. |
| `/team` | Team | Team/user management. |
| `/billing` | Billing | Account billing page. |
| `/classification-assist` | Classification assist | Help classify worker/trade information. |
| `/checklists` | Offline checklists | Global checklist access. |

## Project Pages

| Route | Page | Purpose |
| --- | --- | --- |
| `/projects/:id` | Project detail | Main project workspace and readiness panel. |
| `/projects/:id#wage-determinations` | Project wage determinations section | Project section for pinned/primary wage determinations. |
| `/projects/:projectId/settings` | Project settings | Project configuration, WD details, compliance settings, and defaults. |
| `/projects/:id/activity` | Project activity | Project audit/activity history. |
| `/projects/:projectId/field` | Field clock | Clock in/out and admin time punch corrections for a project. |
| `/projects/:projectId/checklists` | Project checklists | Project-specific offline/compliance checklists. |
| `/projects/:projectId/apprenticeship` | Apprenticeship | Apprenticeship setup and apprentice compliance tracking. |
| `/projects/:projectId/workers` | Project workers | Worker roster, classifications, demographics, and project assignments. |
| `/projects/:projectId/workers/:workerId/compliance-history` | Worker compliance history | Worker-level compliance history for a project. |
| `/projects/:projectId/payroll` | Payroll list | Certified payroll week list for a project. |
| `/projects/:projectId/payroll/new` | New payroll week | Create a certified payroll week. |
| `/projects/:projectId/payroll/:weekId` | Payroll week detail | Review, validate, and prepare a payroll week. |
| `/projects/:projectId/payroll/:weekId/edit` | Edit payroll week | Edit an existing payroll week. |
| `/projects/:projectId/ot-scenarios` | Overtime scenarios | Overtime scenario modeling for a project. |
| `/projects/:projectId/variance` | Variance report | Project wage/payroll variance report. |
| `/projects/:projectId/reports` | Project reports | Project-specific reports. |

## Settings And Integrations

| Route | Page | Purpose |
| --- | --- | --- |
| `/settings/integrations` | Integrations | QuickBooks, Procore, and other integration setup. |
| `/procore/import` | Procore import | Import Procore project data. |
| `/settings/sso` | SSO configuration | Single sign-on setup. |
| `/settings/mfa` | MFA setup | Multi-factor authentication setup. |
| `/settings/security` | Security dashboard | Account security posture and controls. |
| `/settings/api-keys` | API keys | API key creation and management. |
| `/settings/webhooks` | Webhooks | Webhook endpoint configuration. |

## Admin Pages

| Route | Page | Purpose |
| --- | --- | --- |
| `/admin/coverage` | Wage coverage | Wage determination/state coverage administration. |
| `/admin/wages` | Admin state wages | State wage administration. |
| `/admin/growth` | Growth dashboard | Internal growth/metrics dashboard. |
| `/admin/copilot` | Copilot audit | Copilot audit and action review. |

## Redirects And Gaps

| Route | Behavior | Note |
| --- | --- | --- |
| `*` | Wildcard redirect | Authenticated users go to `/dashboard`; unauthenticated users go to `/`. |
| `/reviews` | Public page | Fixed: `/reviews` now resolves to the testimonials/reviews page instead of falling through the wildcard redirect. |

## Main Authenticated Navigation

The shared app layout currently exposes these primary navigation links after login:

- `/dashboard` - Projects
- `/field` - Field
- `/wages` - Wage Lookup
- `/reports` - Reports
- `/team` - Team
- `/settings/integrations` - Integrations
- `/settings/security` - Security
- `/settings/api-keys` - API Keys
- `/settings/webhooks` - Webhooks
- `/billing` - owner-only
- `/admin/coverage` - owner-only
- `/admin/copilot` - owner-only

## Footer Navigation

The shared footer currently links to:

- `/case-studies`
- `/government`
- `/contact`
- `/reviews`
- `/security`
- `/pricing`
- `/api-docs`
