-- Phase 103: AI Classification Assist audit trail (AI-02)
-- Every call to POST /api/ai/classify is logged here for SOC 2 / IL AI Act compliance.

CREATE TABLE IF NOT EXISTS ai_classifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  job_description TEXT NOT NULL,
  -- Claude's primary response
  trade_code TEXT NOT NULL,
  trade_description TEXT NOT NULL,
  confidence REAL NOT NULL,
  reasoning TEXT,
  -- Raw alternatives JSON array: [{tradeCode, tradeDescription, confidence}]
  alternatives_json TEXT,
  -- Claude model used (for auditability across model upgrades)
  model_used TEXT NOT NULL,
  -- Latency in ms
  latency_ms INTEGER,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_classifications_user_id ON ai_classifications(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_classifications_project_id ON ai_classifications(project_id);
