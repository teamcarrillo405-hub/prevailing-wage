# Security Policy

PrevWage takes security seriously. This document describes which versions are supported, how to report vulnerabilities, and what response you can expect from us.

## Supported Versions

PrevWage is a single-tenant SaaS application. Only the version currently deployed at `https://prevailingwage.app` is supported. There is no end-of-life schedule for older versions because customers always run the latest deployment.

| Version | Supported |
| ------- | --------- |
| Production (`prevailingwage.app` — latest deploy) | Yes |
| Self-hosted forks | No — community responsibility |
| Pre-release / staging branches | No |

## Reporting a Vulnerability

Please report security vulnerabilities **privately**. Do not open a public GitHub issue, post in social media, or share details with third parties before we have had a reasonable opportunity to address the report.

**Primary contact (preferred):** [security@prevailingwage.app](mailto:security@prevailingwage.app)

**Escalation contact (if no acknowledgement within 72 hours):** [teamcarrillo405@gmail.com](mailto:teamcarrillo405@gmail.com)

The same primary contact is also published in [`.well-known/security.txt`](https://prevailingwage.app/.well-known/security.txt) for automated discovery.

Please include:

- A clear description of the vulnerability and its impact
- Step-by-step reproduction instructions (or proof-of-concept)
- Affected URL(s), endpoint(s), or component(s)
- Any logs, screenshots, or supporting material
- Whether you would like to be publicly credited after remediation

PGP-encrypted reports are welcome. PGP key fingerprint: *to be published* — request via the primary contact and we will send the key out-of-band.

## Response SLA

| Phase | Target |
| ----- | ------ |
| Acknowledgement of receipt | Within **72 hours** of report |
| Initial triage and severity classification | Within 7 calendar days |
| Remediation plan with target fix date | Within 14 calendar days |
| High / Critical fix deployed | Within 30 calendar days |
| Coordinated public disclosure (if applicable) | Negotiated with reporter |

Acknowledgements come from the primary contact. If you have not received an acknowledgement within 72 hours, please email the escalation contact.

## Responsible Disclosure

We follow a coordinated disclosure model:

1. You report the issue privately via the primary contact.
2. We acknowledge within 72 hours.
3. We confirm the issue, assign a severity, and share a remediation timeline.
4. We deploy a fix to production.
5. We coordinate the public disclosure date with you, including a credit line if you opt in.
6. We will not pursue legal action against good-faith security researchers who:
   - Make a reasonable effort to avoid privacy violations and service disruption
   - Do not exfiltrate, modify, or destroy customer data
   - Do not access more data than necessary to demonstrate the issue
   - Give us a reasonable opportunity to remediate before public disclosure

## Scope

**In scope:**

- The production application at `https://prevailingwage.app` and its API surface
- The publicly accessible `/upload/:token` subcontractor portal
- The public REST API at `/v1/*` (Bearer-token authenticated)
- The marketing pages and public-facing routes (`/`, `/about`, `/security`, `/api-docs`, `/case-studies/*`)
- First-party JavaScript bundles served by the application

**Out of scope:**

- Third-party services we depend on (Render, Resend, Stripe, Sentry, Better Stack) — please report directly to those vendors
- Denial-of-service or volumetric attacks
- Social engineering of staff or customers
- Physical attacks against infrastructure
- Findings from automated scanners that do not demonstrate a real-world impact
- Self-XSS that requires a victim to paste attacker-controlled content into the browser console
- Missing security headers without a demonstrated exploit chain

## Recognition

We do not currently operate a paid bug bounty program. We do publish a public Hall of Fame for researchers who responsibly disclose qualifying issues — opt in via the primary contact.

---

*Last updated: April 2026.*
*Mirrored at [https://prevailingwage.app/security](https://prevailingwage.app/security) (rendered React page) and [`.well-known/security.txt`](https://prevailingwage.app/.well-known/security.txt) (machine-readable contact).*
