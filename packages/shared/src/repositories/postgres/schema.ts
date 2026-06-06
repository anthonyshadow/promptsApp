export const POSTGRES_SCHEMA_TABLES = [
  "users",
  "workspaces",
  "projects",
  "prompts",
  "prompt_versions",
  "prompt_analyses",
  "quality_contracts",
  "test_cases",
  "eval_runs",
  "eval_results",
  "optimization_candidates",
  "reports",
  "report_artifacts",
  "deletion_requests",
  "model_registry",
  "free_audits",
  "accounts",
  "contacts",
  "opportunities",
  "crm_notes",
  "tasks",
  "support_tickets",
  "job_events",
  "provider_incidents",
  "worker_heartbeats",
  "model_registry_versions",
  "admin_users",
  "admin_roles",
  "admin_sessions",
  "sudo_requests",
  "break_glass_events",
  "admin_audit_logs",
  "plans",
  "entitlements",
  "usage_ledger",
  "billing_events",
  "invoices",
  "credits",
  "feature_flags",
  "provider_keys"
] as const;

export type PostgresSchemaTable = (typeof POSTGRES_SCHEMA_TABLES)[number];

export const POSTGRES_MIGRATION_FILES = [
  "packages/shared/src/repositories/postgres/migrations/0001_initial.sql",
  "packages/shared/src/repositories/postgres/migrations/0002_operational_tables.sql",
  "packages/shared/src/repositories/postgres/migrations/0003_admin_auth.sql",
  "packages/shared/src/repositories/postgres/migrations/0004_sudo_lifecycle.sql",
  "packages/shared/src/repositories/postgres/migrations/0005_provider_key_lifecycle.sql",
  "packages/shared/src/repositories/postgres/migrations/0006_storage_deletion_lifecycle.sql",
  "packages/shared/src/repositories/postgres/migrations/0007_model_registry_freshness_workflow.sql"
] as const;

export const POSTGRES_DURABILITY_INVARIANTS = {
  adminAuditLogsAppendOnly:
    "admin_audit_logs have no update/delete repository helper and the Postgres schema blocks update/delete with triggers.",
  providerKeysOpaque:
    "provider_keys store encrypted ciphertext plus fingerprint metadata only; raw provider keys are not modeled.",
  reportDeletionRepresentable:
    "prompts, prompt_versions, reports, report_artifacts, and deletion_requests include deletion state fields so deletes can be audited and artifact cleanup can be tracked.",
  modelRegistryVersioned:
    "model_registry active rows and versions preserve source URL, last verification metadata, verifier identity, approval state, approver, and approval timestamp."
} as const;
