-- 0075_local_wage_ordinances.sql
-- Stores county/municipal prevailing wage ordinance metadata.
-- Each row represents one locality's wage schedule, linked to wage_determinations via locality_name+state.
CREATE TABLE IF NOT EXISTS local_wage_ordinances (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  locality_name TEXT NOT NULL,   -- e.g. "NYC", "Cook County", "DC", "LA County"
  jurisdiction_type TEXT NOT NULL, -- 'county' | 'local'
  administering_agency TEXT NOT NULL, -- e.g. "NYC DCAS", "Cook County DOL"
  effective_date TEXT NOT NULL,
  expiration_date TEXT,
  source_url TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_local_wage_ordinances_state_locality
  ON local_wage_ordinances(state, locality_name);
