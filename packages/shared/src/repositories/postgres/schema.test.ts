import { describe, expect, test } from "bun:test";
import {
  POSTGRES_DURABILITY_INVARIANTS,
  POSTGRES_MIGRATION_FILES,
  POSTGRES_SCHEMA_TABLES
} from "./schema";

async function readMigrations(): Promise<string> {
  return (
    await Promise.all(
      POSTGRES_MIGRATION_FILES.map((migrationPath) => Bun.file(migrationPath).text())
    )
  ).join("\n");
}

describe("postgres schema metadata", () => {
  test("declares all durable MVP and admin tables", async () => {
    const sql = await readMigrations();

    for (const table of POSTGRES_SCHEMA_TABLES) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }

    expect(POSTGRES_MIGRATION_FILES).toContain(
      "packages/shared/src/repositories/postgres/migrations/0001_initial.sql"
    );
    expect(POSTGRES_MIGRATION_FILES).toContain(
      "packages/shared/src/repositories/postgres/migrations/0007_model_registry_freshness_workflow.sql"
    );
    expect(POSTGRES_MIGRATION_FILES).toContain(
      "packages/shared/src/repositories/postgres/migrations/0008_rate_limits_logging_data_use_controls.sql"
    );
    expect(POSTGRES_MIGRATION_FILES).toContain(
      "packages/shared/src/repositories/postgres/migrations/0009_durable_eval_queue.sql"
    );
  });

  test("keeps admin audit logs append-only in durable storage", async () => {
    const sql = await readMigrations();

    expect(POSTGRES_DURABILITY_INVARIANTS.adminAuditLogsAppendOnly).toContain(
      "update/delete"
    );
    expect(sql).toContain("prevent_admin_audit_log_mutation");
    expect(sql).toContain("admin_audit_logs_no_update");
    expect(sql).toContain("admin_audit_logs_no_delete");
    expect(sql).toContain("RAISE EXCEPTION 'admin_audit_logs are append-only'");
  });

  test("models provider keys as opaque encrypted records only", async () => {
    const sql = await readMigrations();
    const providerKeySection = sql.slice(
      sql.indexOf("CREATE TABLE IF NOT EXISTS provider_keys"),
      sql.indexOf("CREATE TABLE IF NOT EXISTS eval_runs")
    );

    expect(providerKeySection).toContain("encrypted_key_ciphertext BYTEA NOT NULL");
    expect(providerKeySection).toContain("key_fingerprint TEXT NOT NULL");
    expect(providerKeySection).toContain("encryption_key_id TEXT NOT NULL");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS rotated_at TIMESTAMPTZ");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()");
    expect(providerKeySection).not.toContain("raw_key");
    expect(providerKeySection).not.toContain("plaintext");
    expect(sql).not.toContain("raw_key");
  });

  test("represents report deletion and model registry version approval state", async () => {
    const sql = await readMigrations();

    expect(sql).toContain("deleted_at TIMESTAMPTZ");
    expect(sql).toContain("retention_state TEXT NOT NULL DEFAULT 'active'");
    expect(sql).toContain("delete_reason_code TEXT");
    expect(sql).toContain("delete_requested_by_user_id TEXT REFERENCES users(id)");
    expect(sql).toContain("storage_delete_status TEXT NOT NULL DEFAULT 'active'");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS deletion_requests");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS storage_key TEXT");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS deletion_status TEXT NOT NULL DEFAULT 'active'");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS deletion_attempts INTEGER NOT NULL DEFAULT 0");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS last_deletion_error TEXT");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS model_registry_versions");
    expect(sql).toContain("source_url TEXT NOT NULL");
    expect(sql).toContain("last_verified_at TIMESTAMPTZ");
    expect(sql).toContain("verified_by TEXT");
    expect(sql).toContain("approval_state TEXT NOT NULL");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS approval_state TEXT NOT NULL DEFAULT 'draft'");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS approved_by_admin_user_id TEXT");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ");
    expect(sql).toContain("'demo_unverified'");
  });

  test("stores workspace data-use defaults for privacy controls", async () => {
    const sql = await readMigrations();

    expect(sql).toContain("ADD COLUMN IF NOT EXISTS prompts_private_by_default BOOLEAN NOT NULL DEFAULT TRUE");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS data_use_policy TEXT NOT NULL DEFAULT 'no_training'");
    expect(sql).toContain("provider_call_sensitive_data_policy TEXT NOT NULL DEFAULT 'require_confirmation'");
    expect(sql).toContain("CHECK (data_use_policy IN ('no_training', 'training_opt_in'))");
    expect(sql).toContain("CHECK (provider_call_sensitive_data_policy IN ('require_confirmation', 'block'))");
  });

  test("stores durable eval queue state and worker heartbeats", async () => {
    const sql = await readMigrations();

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS eval_queue_jobs");
    expect(sql).toContain("attempt_count INTEGER NOT NULL DEFAULT 0");
    expect(sql).toContain("rate_limited_until TIMESTAMPTZ");
    expect(sql).toContain("cancelled_at TIMESTAMPTZ");
    expect(sql).toContain("idx_eval_queue_jobs_status_next_attempt");
    expect(sql).toContain("idx_job_events_job_id_created_at");
    expect(sql).toContain("idx_worker_heartbeats_worker_instance");
  });
});
