ALTER TABLE model_registry
  ADD COLUMN IF NOT EXISTS approval_state TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS approved_by_admin_user_id TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

ALTER TABLE model_registry
  DROP CONSTRAINT IF EXISTS model_registry_freshness_status_check;

ALTER TABLE model_registry
  ADD CONSTRAINT model_registry_freshness_status_check
  CHECK (freshness_status IN (
    'fresh',
    'stale',
    'unverified',
    'deprecated',
    'preview',
    'experimental',
    'demo_unverified'
  ));

ALTER TABLE prompt_analyses
  DROP CONSTRAINT IF EXISTS prompt_analyses_registry_freshness_check;

ALTER TABLE prompt_analyses
  ADD CONSTRAINT prompt_analyses_registry_freshness_check
  CHECK (registry_freshness IN (
    'fresh',
    'stale',
    'unverified',
    'deprecated',
    'preview',
    'experimental',
    'demo_unverified'
  ));

ALTER TABLE reports
  DROP CONSTRAINT IF EXISTS reports_registry_freshness_check;

ALTER TABLE reports
  ADD CONSTRAINT reports_registry_freshness_check
  CHECK (registry_freshness IN (
    'fresh',
    'stale',
    'unverified',
    'deprecated',
    'preview',
    'experimental',
    'demo_unverified'
  ));

CREATE INDEX IF NOT EXISTS idx_model_registry_freshness_review
  ON model_registry(freshness_status, approval_state, last_verified_at);
