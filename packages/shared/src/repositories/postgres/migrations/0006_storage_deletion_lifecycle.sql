-- Report artifact object-storage lifecycle and scoped deletion requests.
-- Business rules live in application code; this migration only makes the
-- lifecycle durable and observable.

BEGIN;

ALTER TABLE report_artifacts
  ADD COLUMN IF NOT EXISTS workspace_id TEXT REFERENCES workspaces(id),
  ADD COLUMN IF NOT EXISTS project_id TEXT REFERENCES projects(id),
  ADD COLUMN IF NOT EXISTS privacy_state TEXT NOT NULL DEFAULT 'ready_redacted'
    CHECK (privacy_state IN ('ready_redacted', 'raw_locked', 'failed_export', 'deletion_pending', 'deleted')),
  ADD COLUMN IF NOT EXISTS storage_key TEXT,
  ADD COLUMN IF NOT EXISTS deletion_status TEXT NOT NULL DEFAULT 'active'
    CHECK (deletion_status IN ('active', 'delete_requested', 'deleted', 'failed')),
  ADD COLUMN IF NOT EXISTS deletion_attempts INTEGER NOT NULL DEFAULT 0
    CHECK (deletion_attempts >= 0),
  ADD COLUMN IF NOT EXISTS last_deletion_error TEXT;

UPDATE report_artifacts
SET storage_key = COALESCE(storage_key, storage_uri)
WHERE storage_key IS NULL;

UPDATE report_artifacts
SET deletion_status = storage_delete_status
WHERE deletion_status = 'active'
  AND storage_delete_status <> 'active';

CREATE TABLE IF NOT EXISTS deletion_requests (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  verified_by TEXT,
  status TEXT NOT NULL CHECK (status IN ('requested', 'processing', 'completed', 'failed')),
  reason_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_report_artifacts_deletion_status
  ON report_artifacts(deletion_status);

CREATE INDEX IF NOT EXISTS idx_report_artifacts_storage_key
  ON report_artifacts(storage_key);

CREATE INDEX IF NOT EXISTS idx_deletion_requests_target
  ON deletion_requests(target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_deletion_requests_status
  ON deletion_requests(status);

COMMIT;
