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
  "model_registry",
  "free_audits",
  "accounts",
  "contacts",
  "opportunities",
  "crm_notes",
  "tasks",
  "job_events",
  "provider_incidents",
  "model_registry_versions",
  "admin_users",
  "admin_roles",
  "admin_sessions",
  "sudo_requests",
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
  "packages/shared/src/repositories/postgres/migrations/0001_initial.sql"
] as const;

export const POSTGRES_DURABILITY_INVARIANTS = {
  adminAuditLogsAppendOnly:
    "admin_audit_logs have no update/delete repository helper and the Postgres schema blocks update/delete with triggers.",
  providerKeysOpaque:
    "provider_keys store encrypted ciphertext plus fingerprint metadata only; raw provider keys are not modeled.",
  reportDeletionRepresentable:
    "reports and report_artifacts include deletion state fields so deletes can be audited and artifact cleanup can be tracked.",
  modelRegistryVersioned:
    "model_registry_versions preserve source URL, last verification metadata, verifier identity, and approval state."
} as const;

