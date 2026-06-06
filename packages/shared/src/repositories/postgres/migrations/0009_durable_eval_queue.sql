-- Durable eval queue state for worker claims, retries, provider rate limits,
-- cancellation, and admin inspection. Eval rows stay in eval_results.

BEGIN;

CREATE TABLE IF NOT EXISTS eval_queue_jobs (
  id TEXT PRIMARY KEY,
  eval_run_id TEXT NOT NULL REFERENCES eval_runs(id),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  project_id TEXT NOT NULL REFERENCES projects(id),
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'rate_limited', 'retrying', 'complete', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  locked_by TEXT,
  locked_until TIMESTAMPTZ,
  last_heartbeat_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ,
  rate_limited_until TIMESTAMPTZ,
  retry_after_seconds INTEGER CHECK (retry_after_seconds IS NULL OR retry_after_seconds > 0),
  retry_hint TEXT,
  sanitized_error JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_mock BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  UNIQUE (eval_run_id)
);

CREATE INDEX IF NOT EXISTS idx_eval_queue_jobs_status_next_attempt
  ON eval_queue_jobs(status, next_attempt_at);

CREATE INDEX IF NOT EXISTS idx_eval_queue_jobs_workspace_status
  ON eval_queue_jobs(workspace_id, status);

CREATE INDEX IF NOT EXISTS idx_eval_queue_jobs_locked_until
  ON eval_queue_jobs(locked_until)
  WHERE locked_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_job_events_eval_run_id ON job_events(eval_run_id);
CREATE INDEX IF NOT EXISTS idx_job_events_job_id_created_at ON job_events(job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_worker_heartbeats_worker_instance
  ON worker_heartbeats(worker_name, instance_id);

COMMIT;
