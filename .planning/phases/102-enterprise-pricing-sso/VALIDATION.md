# Phase 102 Validation — Enterprise Pricing + SSO Foundation

## Requirements Covered
- ENT-01: Enterprise tier card on PricingPage reflects SSO as a real feature
- ENT-02: sso_configs table migration (0062) + Okta/Azure AD connect UI stub on IntegrationsPage

## Plan 01 — Database Migration

### Automated
```bash
cd /c/Users/glcar/prevailing-wage && node -e "const j=require('./src/server/db/migrations/meta/_journal.json'); console.log(JSON.stringify(j.entries.find(e=>e.idx===62)))"
```
Expected: `{"idx":62,"version":"6","when":...,"tag":"0062_sso_configs","breakpoints":true}`

```bash
cd /c/Users/glcar/prevailing-wage && grep "CREATE TABLE" src/server/db/migrations/0062_sso_configs.sql
```
Expected: `CREATE TABLE IF NOT EXISTS sso_configs`

```bash
cd /c/Users/glcar/prevailing-wage && grep "ssoConfigs" src/server/db/schema.ts
```
Expected: exports ssoConfigs table definition.

## Plan 02 — UI Updates

### PricingPage
- [ ] Visit http://localhost:5173/pricing
- [ ] Enterprise card shows "SSO / SAML" (no "(roadmap)" suffix)
- [ ] Feature comparison table has SSO row with checkmark under Enterprise column

### IntegrationsPage
- [ ] Visit http://localhost:5173/settings/integrations (requires login)
- [ ] SSO section is visible with "Single Sign-On (SSO)" heading
- [ ] Two cards: "Okta" and "Azure Active Directory"
- [ ] Each card shows "Enterprise" badge
- [ ] "Contact Sales" link navigates to /contact

## TypeScript Check
```bash
cd /c/Users/glcar/prevailing-wage && npx tsc --noEmit 2>&1 | grep -v "workers.ts" | grep "error" | wc -l
```
Expected: 0 new errors beyond pre-existing workers.ts errors.
