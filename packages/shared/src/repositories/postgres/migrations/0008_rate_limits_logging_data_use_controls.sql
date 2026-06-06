-- PromptOpts abuse/privacy controls.
-- Workspace data-use defaults are durable; request logs remain structured and
-- body-free at the API layer rather than storing raw prompts in Postgres.

BEGIN;

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS prompts_private_by_default BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS data_use_policy TEXT NOT NULL DEFAULT 'no_training'
    CHECK (data_use_policy IN ('no_training', 'training_opt_in')),
  ADD COLUMN IF NOT EXISTS provider_call_sensitive_data_policy TEXT NOT NULL DEFAULT 'require_confirmation'
    CHECK (provider_call_sensitive_data_policy IN ('require_confirmation', 'block'));

CREATE INDEX IF NOT EXISTS idx_workspaces_data_use_policy ON workspaces(data_use_policy);

COMMIT;
