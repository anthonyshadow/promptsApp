-- PromptOpts initial durable schema.
-- Application code should reach durable data through repository interfaces; this file
-- defines the production Postgres shape without replacing the memory demo adapter.

BEGIN;

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  is_mock BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_mock BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  task_type TEXT NOT NULL CHECK (task_type IN (
    'support',
    'summarization',
    'extraction',
    'coding',
    'rag',
    'agent',
    'classification',
    'other'
  )),
  current_provider TEXT NOT NULL CHECK (current_provider IN ('openai', 'anthropic', 'gemini')),
  current_model_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'archived')),
  is_mock BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prompts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL,
  current_version_id TEXT,
  redacted_preview TEXT NOT NULL,
  is_mock BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prompt_versions (
  id TEXT PRIMARY KEY,
  prompt_id TEXT NOT NULL REFERENCES prompts(id),
  version INTEGER NOT NULL CHECK (version > 0),
  label TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'archived')),
  redacted_preview TEXT NOT NULL,
  is_mock BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_user_id TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (prompt_id, version)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'prompts_current_version_fk'
  ) THEN
    ALTER TABLE prompts
      ADD CONSTRAINT prompts_current_version_fk
      FOREIGN KEY (current_version_id) REFERENCES prompt_versions(id)
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS prompt_analyses (
  id TEXT PRIMARY KEY,
  prompt_version_id TEXT NOT NULL REFERENCES prompt_versions(id),
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'gemini')),
  model_id TEXT NOT NULL,
  task_type TEXT NOT NULL,
  input_tokens INTEGER NOT NULL CHECK (input_tokens >= 0),
  estimated_output_tokens INTEGER NOT NULL CHECK (estimated_output_tokens >= 0),
  model_fit TEXT NOT NULL CHECK (model_fit IN ('overpowered', 'appropriate', 'underpowered')),
  waste_findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  compression_guardrails JSONB NOT NULL DEFAULT '[]'::jsonb,
  registry_freshness TEXT NOT NULL CHECK (registry_freshness IN ('fresh', 'stale', 'unverified', 'deprecated')),
  is_mock BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quality_contracts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  task TEXT NOT NULL,
  required_output TEXT NOT NULL,
  must_preserve JSONB NOT NULL DEFAULT '[]'::jsonb,
  forbidden_behavior JSONB NOT NULL DEFAULT '[]'::jsonb,
  pass_threshold NUMERIC(5,4) NOT NULL CHECK (pass_threshold >= 0 AND pass_threshold <= 1),
  must_pass_check_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  check_definitions JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  is_mock BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS test_cases (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  quality_contract_id TEXT NOT NULL REFERENCES quality_contracts(id),
  name TEXT NOT NULL,
  input_variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  expected_output JSONB,
  checks JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_mock BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS optimization_candidates (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  prompt_version_id TEXT NOT NULL REFERENCES prompt_versions(id),
  analysis_id TEXT REFERENCES prompt_analyses(id),
  strategy TEXT NOT NULL CHECK (strategy IN (
    'baseline',
    'conservative',
    'balanced',
    'aggressive',
    'output_lite',
    'model_specific'
  )),
  candidate_prompt_text TEXT NOT NULL,
  estimated_input_tokens INTEGER NOT NULL CHECK (estimated_input_tokens >= 0),
  estimated_output_tokens INTEGER NOT NULL CHECK (estimated_output_tokens >= 0),
  rationale TEXT NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  expected_token_delta NUMERIC NOT NULL,
  preserved_constraints JSONB NOT NULL DEFAULT '[]'::jsonb,
  removed_or_compressed_elements JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_baseline BOOLEAN NOT NULL DEFAULT FALSE,
  is_mock BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS model_registry (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'gemini')),
  model_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  input_price_per_million_tokens NUMERIC(12,6) NOT NULL CHECK (input_price_per_million_tokens >= 0),
  output_price_per_million_tokens NUMERIC(12,6) NOT NULL CHECK (output_price_per_million_tokens >= 0),
  cached_input_price_per_million_tokens NUMERIC(12,6) CHECK (cached_input_price_per_million_tokens >= 0),
  context_window INTEGER NOT NULL CHECK (context_window > 0),
  max_output_tokens INTEGER NOT NULL CHECK (max_output_tokens > 0),
  supports_text BOOLEAN NOT NULL DEFAULT TRUE,
  supports_image BOOLEAN NOT NULL DEFAULT FALSE,
  supports_audio BOOLEAN NOT NULL DEFAULT FALSE,
  supports_video BOOLEAN NOT NULL DEFAULT FALSE,
  supports_tools BOOLEAN NOT NULL DEFAULT FALSE,
  supports_structured_output BOOLEAN NOT NULL DEFAULT FALSE,
  latency_tier TEXT NOT NULL CHECK (latency_tier IN ('low', 'standard', 'high', 'unknown')),
  quality_tier TEXT NOT NULL CHECK (quality_tier IN ('economy', 'balanced', 'frontier', 'unknown')),
  recommended_task_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  stability_status TEXT NOT NULL CHECK (stability_status IN (
    'stable',
    'preview',
    'latest',
    'experimental',
    'deprecated',
    'unverified'
  )),
  freshness_status TEXT NOT NULL CHECK (freshness_status IN ('fresh', 'stale', 'unverified', 'deprecated')),
  source_url TEXT,
  last_verified_at TIMESTAMPTZ,
  verified_by TEXT,
  pricing_note TEXT NOT NULL,
  is_mock BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, model_id)
);

CREATE TABLE IF NOT EXISTS model_registry_versions (
  id TEXT PRIMARY KEY,
  model_registry_id TEXT NOT NULL REFERENCES model_registry(id),
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  registry_payload JSONB NOT NULL,
  source_url TEXT NOT NULL,
  last_verified_at TIMESTAMPTZ,
  verified_by TEXT,
  approval_state TEXT NOT NULL CHECK (approval_state IN (
    'draft',
    'pending_review',
    'approved',
    'rejected',
    'superseded'
  )),
  approved_by_admin_user_id TEXT,
  approved_at TIMESTAMPTZ,
  change_reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (model_registry_id, version_number)
);

CREATE TABLE IF NOT EXISTS provider_keys (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'gemini')),
  key_fingerprint TEXT NOT NULL,
  encrypted_key_ciphertext BYTEA NOT NULL CHECK (octet_length(encrypted_key_ciphertext) > 0),
  encryption_key_id TEXT NOT NULL,
  created_by_user_id TEXT REFERENCES users(id),
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS eval_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  quality_contract_id TEXT NOT NULL REFERENCES quality_contracts(id),
  baseline_prompt_version_id TEXT NOT NULL REFERENCES prompt_versions(id),
  candidate_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  model_registry_record_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'rate_limited', 'retrying', 'complete', 'failed')),
  pass_threshold NUMERIC(5,4) NOT NULL CHECK (pass_threshold >= 0 AND pass_threshold <= 1),
  is_mock BOOLEAN NOT NULL DEFAULT FALSE,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS eval_results (
  id TEXT PRIMARY KEY,
  eval_run_id TEXT NOT NULL REFERENCES eval_runs(id),
  candidate_id TEXT NOT NULL,
  prompt_version_id TEXT REFERENCES prompt_versions(id),
  model_registry_record_id TEXT NOT NULL REFERENCES model_registry(id),
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'gemini')),
  model_id TEXT NOT NULL,
  quality_score NUMERIC(5,4) NOT NULL CHECK (quality_score >= 0 AND quality_score <= 1),
  pass_rate NUMERIC(5,4) NOT NULL CHECK (pass_rate >= 0 AND pass_rate <= 1),
  must_pass_failures INTEGER NOT NULL CHECK (must_pass_failures >= 0),
  input_tokens INTEGER NOT NULL CHECK (input_tokens >= 0),
  output_tokens INTEGER NOT NULL CHECK (output_tokens >= 0),
  estimated_cost_usd NUMERIC(14,8),
  cost_estimate_status TEXT NOT NULL CHECK (cost_estimate_status IN ('verified', 'unverified', 'blocked')),
  latency_ms INTEGER CHECK (latency_ms >= 0),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  verdict TEXT NOT NULL CHECK (verdict IN ('pass', 'fail', 'blocked')),
  failed_check_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_mock BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  eval_run_id TEXT NOT NULL REFERENCES eval_runs(id),
  status TEXT NOT NULL CHECK (status IN ('draft', 'blocked', 'ready', 'exported')),
  winner_result_id TEXT REFERENCES eval_results(id),
  cheaper_alternative_result_id TEXT REFERENCES eval_results(id),
  stronger_fallback_result_id TEXT REFERENCES eval_results(id),
  risk_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
  savings_summary TEXT,
  production_recommendation_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  production_blockers JSONB NOT NULL DEFAULT '[]'::jsonb,
  registry_freshness TEXT NOT NULL CHECK (registry_freshness IN ('fresh', 'stale', 'unverified', 'deprecated')),
  is_mock BOOLEAN NOT NULL DEFAULT FALSE,
  generated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  delete_requested_by_user_id TEXT REFERENCES users(id),
  delete_reason_code TEXT,
  retention_state TEXT NOT NULL DEFAULT 'active' CHECK (retention_state IN ('active', 'delete_requested', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report_artifacts (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES reports(id),
  format TEXT NOT NULL CHECK (format IN ('markdown', 'json', 'pdf')),
  storage_uri TEXT NOT NULL,
  checksum TEXT,
  size_bytes INTEGER CHECK (size_bytes >= 0),
  redaction_state TEXT NOT NULL CHECK (redaction_state IN ('redacted', 'revealed', 'not_sensitive')),
  storage_delete_status TEXT NOT NULL DEFAULT 'active' CHECK (storage_delete_status IN ('active', 'delete_requested', 'deleted', 'failed')),
  deleted_at TIMESTAMPTZ,
  is_mock BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS free_audits (
  id TEXT PRIMARY KEY,
  account_id TEXT,
  project_id TEXT REFERENCES projects(id),
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'gemini')),
  current_model_id TEXT NOT NULL,
  task_type TEXT NOT NULL,
  monthly_calls INTEGER NOT NULL CHECK (monthly_calls > 0),
  model_fit TEXT NOT NULL CHECK (model_fit IN ('overpowered', 'appropriate', 'underpowered')),
  savings_opportunity_usd NUMERIC(14,6),
  eval_readiness TEXT NOT NULL CHECK (eval_readiness IN ('not_ready', 'needs_tests', 'eval_ready', 'complete')),
  contact_email TEXT,
  company TEXT,
  cta_clicked TEXT NOT NULL CHECK (cta_clicked IN ('preview', 'get_audit_report', 'create_project', 'run_evals')),
  redacted_prompt_preview TEXT NOT NULL,
  shareable_summary TEXT NOT NULL,
  is_mock BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  workspace_id TEXT REFERENCES workspaces(id),
  stage TEXT NOT NULL CHECK (stage IN ('new_audit', 'qualified', 'eval_ready', 'trial', 'paid', 'needs_review')),
  provider_preference TEXT CHECK (provider_preference IN ('openai', 'anthropic', 'gemini')),
  owner_admin_user_id TEXT,
  domain TEXT,
  redacted_prompt_preview TEXT,
  is_mock BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT,
  is_mock BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  project_id TEXT REFERENCES projects(id),
  stage TEXT NOT NULL CHECK (stage IN ('new', 'evaluating', 'eval_ready', 'recommended', 'won', 'lost')),
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'gemini')),
  current_model_id TEXT NOT NULL,
  fit_signal TEXT CHECK (fit_signal IN ('overpowered', 'appropriate', 'underpowered')),
  estimated_monthly_calls INTEGER NOT NULL DEFAULT 0 CHECK (estimated_monthly_calls >= 0),
  savings_opportunity_usd NUMERIC(14,6),
  use_case TEXT,
  cta_clicked TEXT,
  eval_readiness TEXT NOT NULL CHECK (eval_readiness IN ('not_ready', 'needs_tests', 'eval_ready', 'complete')),
  is_mock BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'free_audits_account_fk'
  ) THEN
    ALTER TABLE free_audits
      ADD CONSTRAINT free_audits_account_fk
      FOREIGN KEY (account_id) REFERENCES accounts(id)
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS crm_notes (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  opportunity_id TEXT REFERENCES opportunities(id),
  author_admin_user_id TEXT,
  body_redacted TEXT NOT NULL,
  redaction_state TEXT NOT NULL DEFAULT 'redacted' CHECK (redaction_state IN ('redacted', 'revealed', 'not_sensitive')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_mock BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  account_id TEXT REFERENCES accounts(id),
  opportunity_id TEXT REFERENCES opportunities(id),
  assignee_admin_user_id TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'done', 'cancelled')),
  due_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_mock BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_events (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  job_id TEXT NOT NULL,
  status TEXT NOT NULL,
  workspace_id TEXT REFERENCES workspaces(id),
  eval_run_id TEXT REFERENCES eval_runs(id),
  report_id TEXT REFERENCES reports(id),
  sanitized_error JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provider_incidents (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'gemini')),
  model_id TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL CHECK (status IN ('open', 'monitoring', 'resolved')),
  sanitized_summary TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE CHECK (name IN ('owner', 'ops', 'support', 'finance', 'read_only')),
  scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_system BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL REFERENCES admin_users(id),
  session_hash TEXT NOT NULL,
  mfa_verified_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sudo_requests (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL REFERENCES admin_users(id),
  action_scope TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('requested', 'approved', 'denied', 'expired', 'used')),
  approved_by_admin_user_id TEXT REFERENCES admin_users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL,
  workspace_id TEXT,
  account_id TEXT,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  action TEXT NOT NULL,
  action_scope TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  sudo_request_id TEXT,
  ip_address TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  redaction_state TEXT NOT NULL CHECK (redaction_state IN ('redacted', 'revealed', 'not_sensitive')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_mock BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION prevent_admin_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_logs are append-only';
END;
$$;

DROP TRIGGER IF EXISTS admin_audit_logs_no_update ON admin_audit_logs;
CREATE TRIGGER admin_audit_logs_no_update
BEFORE UPDATE ON admin_audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_admin_audit_log_mutation();

DROP TRIGGER IF EXISTS admin_audit_logs_no_delete ON admin_audit_logs;
CREATE TRIGGER admin_audit_logs_no_delete
BEFORE DELETE ON admin_audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_admin_audit_log_mutation();

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  billing_period TEXT NOT NULL CHECK (billing_period IN ('month', 'year', 'custom')),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  feature_limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS entitlements (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  plan_id TEXT NOT NULL REFERENCES plans(id),
  feature TEXT NOT NULL,
  limit_value INTEGER NOT NULL CHECK (limit_value >= 0),
  used INTEGER NOT NULL DEFAULT 0 CHECK (used >= 0),
  is_mock BOOLEAN NOT NULL DEFAULT FALSE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usage_ledger (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  feature TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('debit', 'credit')),
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  is_mock BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  event_type TEXT NOT NULL,
  amount_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'usd',
  external_reference TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  status TEXT NOT NULL CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
  amount_due_cents INTEGER NOT NULL CHECK (amount_due_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  issued_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  external_reference TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS credits (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  reason_code TEXT NOT NULL,
  issued_by_admin_user_id TEXT REFERENCES admin_users(id),
  sudo_request_id TEXT REFERENCES sudo_requests(id),
  billing_event_id TEXT REFERENCES billing_events(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feature_flags (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  rollout JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_admin_user_id TEXT REFERENCES admin_users(id),
  updated_by_admin_user_id TEXT REFERENCES admin_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_workspace_id ON projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_prompt_id ON prompt_versions(prompt_id);
CREATE INDEX IF NOT EXISTS idx_eval_results_eval_run_id ON eval_results(eval_run_id);
CREATE INDEX IF NOT EXISTS idx_report_artifacts_report_id ON report_artifacts(report_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_workspace_id ON usage_ledger(workspace_id);
CREATE INDEX IF NOT EXISTS idx_model_registry_provider_model ON model_registry(provider, model_id);

COMMIT;
