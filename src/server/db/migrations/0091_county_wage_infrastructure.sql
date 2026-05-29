CREATE TABLE IF NOT EXISTS county_wage_determinations (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  county TEXT NOT NULL,
  city TEXT,
  trade_code TEXT NOT NULL,
  labor_type TEXT NOT NULL DEFAULT 'journeyworker',
  base_rate REAL NOT NULL,
  fringe_rate REAL NOT NULL DEFAULT 0,
  effective_date TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('dir','dol','lni','manual')),
  synced_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_county_wd_state_county ON county_wage_determinations(state, county);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_county_wd_state_county_trade ON county_wage_determinations(state, county, trade_code);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS state_wage_sources (
  state TEXT PRIMARY KEY,
  source_type TEXT NOT NULL DEFAULT 'manual' CHECK(source_type IN ('api','pdf','csv','manual')),
  api_url TEXT,
  scrape_path TEXT,
  last_synced_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('ok','error','pending'))
);
