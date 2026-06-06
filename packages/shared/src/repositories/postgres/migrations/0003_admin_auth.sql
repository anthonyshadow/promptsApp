BEGIN;

ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS mfa_secret TEXT;

UPDATE admin_users
SET password_hash = 'sha256:3049b742957bf075de0f9cb0921707659065972bef873d86131f57f61d9a796e'
WHERE password_hash IS NULL;

UPDATE admin_users
SET mfa_secret = 'JBSWY3DPEHPK3PXP'
WHERE mfa_secret IS NULL;

ALTER TABLE admin_users
  ALTER COLUMN password_hash SET NOT NULL;

ALTER TABLE admin_users
  ALTER COLUMN mfa_secret SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_sessions_session_hash
  ON admin_sessions(session_hash);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_user_id
  ON admin_sessions(admin_user_id);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at
  ON admin_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_sudo_requests_admin_user_action_status
  ON sudo_requests(admin_user_id, action_scope, status);

COMMIT;
