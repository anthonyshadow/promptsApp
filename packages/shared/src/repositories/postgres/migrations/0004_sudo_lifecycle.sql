BEGIN;

ALTER TABLE sudo_requests
  ADD COLUMN IF NOT EXISTS role TEXT;

ALTER TABLE sudo_requests
  ADD COLUMN IF NOT EXISTS requested_action TEXT;

ALTER TABLE sudo_requests
  ADD COLUMN IF NOT EXISTS target_type TEXT;

ALTER TABLE sudo_requests
  ADD COLUMN IF NOT EXISTS target_id TEXT;

ALTER TABLE sudo_requests
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

ALTER TABLE sudo_requests
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;

ALTER TABLE sudo_requests
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

ALTER TABLE sudo_requests
  ADD COLUMN IF NOT EXISTS ip_address TEXT;

ALTER TABLE sudo_requests
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

UPDATE sudo_requests
SET role = 'owner'
WHERE role IS NULL;

UPDATE sudo_requests
SET requested_action = action_scope
WHERE requested_action IS NULL;

UPDATE sudo_requests
SET approved_at = created_at
WHERE approved_at IS NULL AND status IN ('approved', 'used');

UPDATE sudo_requests
SET activated_at = created_at
WHERE activated_at IS NULL AND status IN ('approved', 'used');

UPDATE sudo_requests
SET ip_address = '127.0.0.1'
WHERE ip_address IS NULL;

UPDATE sudo_requests
SET user_agent = 'PromptOpts migration'
WHERE user_agent IS NULL;

ALTER TABLE sudo_requests
  DROP CONSTRAINT IF EXISTS sudo_requests_status_check;

ALTER TABLE sudo_requests
  ADD CONSTRAINT sudo_requests_status_check
  CHECK (status IN ('requested', 'active', 'approved', 'denied', 'expired', 'revoked', 'used'));

ALTER TABLE sudo_requests
  DROP CONSTRAINT IF EXISTS sudo_requests_role_check;

ALTER TABLE sudo_requests
  ADD CONSTRAINT sudo_requests_role_check
  CHECK (role IN ('owner', 'ops', 'support', 'finance', 'read_only'));

ALTER TABLE sudo_requests
  ALTER COLUMN role SET NOT NULL;

ALTER TABLE sudo_requests
  ALTER COLUMN requested_action SET NOT NULL;

ALTER TABLE sudo_requests
  ALTER COLUMN ip_address SET NOT NULL;

ALTER TABLE sudo_requests
  ALTER COLUMN user_agent SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sudo_requests_active_lookup
  ON sudo_requests(admin_user_id, requested_action, status, expires_at);

CREATE INDEX IF NOT EXISTS idx_sudo_requests_target
  ON sudo_requests(target_type, target_id);

COMMIT;
