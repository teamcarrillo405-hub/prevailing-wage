-- Phase 102: Enterprise SSO foundation (ENT-02)
-- Stores IdP configuration per enterprise tenant (one row per org).
-- provider: 'okta' | 'azure_ad' | 'google_workspace' | 'generic_saml'
-- status: 'pending' | 'active' | 'disabled'

CREATE TABLE IF NOT EXISTS sso_configs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  idp_entity_id TEXT,
  idp_sso_url TEXT,
  idp_certificate TEXT,
  sp_entity_id TEXT,
  sp_acs_url TEXT,
  domain TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_sso_configs_user_id ON sso_configs(user_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_sso_configs_domain ON sso_configs(domain) WHERE domain IS NOT NULL;
