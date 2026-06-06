-- PromptOpts operational durable tables and compatibility hardening.
-- This migration keeps route logic unchanged while making deletion, worker,
-- support, and break-glass state representable in Postgres.

BEGIN;

ALTER TABLE prompts
  DROP CONSTRAINT IF EXISTS prompts_current_version_fk;

ALTER TABLE prompts
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delete_reason_code TEXT,
  ADD COLUMN IF NOT EXISTS retention_state TEXT NOT NULL DEFAULT 'active'
    CHECK (retention_state IN ('active', 'delete_requested', 'deleted'));

ALTER TABLE prompt_versions
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delete_reason_code TEXT,
  ADD COLUMN IF NOT EXISTS retention_state TEXT NOT NULL DEFAULT 'active'
    CHECK (retention_state IN ('active', 'delete_requested', 'deleted'));

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS is_mock BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE billing_events
  ADD COLUMN IF NOT EXISTS is_mock BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS is_mock BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE credits
  ADD COLUMN IF NOT EXISTS is_mock BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE feature_flags
  ADD COLUMN IF NOT EXISTS is_mock BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  account_id TEXT REFERENCES accounts(id),
  workspace_id TEXT REFERENCES workspaces(id),
  subject_redacted TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'pending', 'resolved', 'closed')),
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  assignee_admin_user_id TEXT,
  redaction_state TEXT NOT NULL DEFAULT 'redacted'
    CHECK (redaction_state IN ('redacted', 'revealed', 'not_sensitive')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_mock BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS worker_heartbeats (
  id TEXT PRIMARY KEY,
  worker_name TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('starting', 'healthy', 'degraded', 'stopped')),
  last_heartbeat_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (worker_name, instance_id)
);

CREATE TABLE IF NOT EXISTS break_glass_events (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL REFERENCES admin_users(id),
  sudo_request_id TEXT REFERENCES sudo_requests(id),
  reason_code TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('opened', 'closed', 'expired')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_mock BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_account_id ON support_tickets(account_id);
CREATE INDEX IF NOT EXISTS idx_worker_heartbeats_worker_name ON worker_heartbeats(worker_name);
CREATE INDEX IF NOT EXISTS idx_break_glass_events_admin_user_id ON break_glass_events(admin_user_id);

COMMIT;
