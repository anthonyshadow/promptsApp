import { describe, expect, test } from "bun:test";
import {
  POSTGRES_DURABILITY_INVARIANTS,
  POSTGRES_MIGRATION_FILES,
  POSTGRES_SCHEMA_TABLES
} from "./schema";

const migrationUrl = new URL("./migrations/0001_initial.sql", import.meta.url);

async function readMigration(): Promise<string> {
  return Bun.file(migrationUrl).text();
}

describe("postgres schema metadata", () => {
  test("declares all durable MVP and admin tables", async () => {
    const sql = await readMigration();

    for (const table of POSTGRES_SCHEMA_TABLES) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }

    expect(POSTGRES_MIGRATION_FILES).toContain(
      "packages/shared/src/repositories/postgres/migrations/0001_initial.sql"
    );
  });

  test("keeps admin audit logs append-only in durable storage", async () => {
    const sql = await readMigration();

    expect(POSTGRES_DURABILITY_INVARIANTS.adminAuditLogsAppendOnly).toContain(
      "update/delete"
    );
    expect(sql).toContain("prevent_admin_audit_log_mutation");
    expect(sql).toContain("admin_audit_logs_no_update");
    expect(sql).toContain("admin_audit_logs_no_delete");
    expect(sql).toContain("RAISE EXCEPTION 'admin_audit_logs are append-only'");
  });

  test("models provider keys as opaque encrypted records only", async () => {
    const sql = await readMigration();
    const providerKeySection = sql.slice(
      sql.indexOf("CREATE TABLE IF NOT EXISTS provider_keys"),
      sql.indexOf("CREATE TABLE IF NOT EXISTS eval_runs")
    );

    expect(providerKeySection).toContain("encrypted_key_ciphertext BYTEA NOT NULL");
    expect(providerKeySection).toContain("key_fingerprint TEXT NOT NULL");
    expect(providerKeySection).toContain("encryption_key_id TEXT NOT NULL");
    expect(providerKeySection).not.toContain("raw_key");
    expect(providerKeySection).not.toContain("plaintext");
  });

  test("represents report deletion and model registry version approval state", async () => {
    const sql = await readMigration();

    expect(sql).toContain("deleted_at TIMESTAMPTZ");
    expect(sql).toContain("delete_requested_by_user_id TEXT REFERENCES users(id)");
    expect(sql).toContain("storage_delete_status TEXT NOT NULL DEFAULT 'active'");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS model_registry_versions");
    expect(sql).toContain("source_url TEXT NOT NULL");
    expect(sql).toContain("last_verified_at TIMESTAMPTZ");
    expect(sql).toContain("verified_by TEXT");
    expect(sql).toContain("approval_state TEXT NOT NULL");
  });
});
