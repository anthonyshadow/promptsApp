-- Provider-key lifecycle hardening.
-- Keys remain opaque ciphertext plus metadata; no migration models plaintext or reveal state.

BEGIN;

ALTER TABLE provider_keys
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS rotated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS is_mock BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'provider_keys_status_check'
  ) THEN
    ALTER TABLE provider_keys
      ADD CONSTRAINT provider_keys_status_check
      CHECK (status IN ('active', 'revoked', 'error'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_provider_keys_workspace_provider_status
  ON provider_keys (workspace_id, provider, status);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_provider_keys_active_workspace_provider
  ON provider_keys (workspace_id, provider)
  WHERE status = 'active' AND revoked_at IS NULL;

COMMIT;
