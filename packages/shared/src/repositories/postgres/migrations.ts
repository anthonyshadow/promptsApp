import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createDemoRepositorySeed } from "../seed";
import type { PromptOptsRepository, RepositorySeed } from "../types";
import { createPostgresRepository } from "./repository";
import { POSTGRES_MIGRATION_FILES } from "./schema";
import { requireDatabaseUrl, runPsql, sqlTextLiteral } from "./psql";

export type MigrationResult = {
  applied: string[];
  skipped: string[];
};

export async function runPostgresMigrations(databaseUrl = process.env.DATABASE_URL): Promise<MigrationResult> {
  const resolvedDatabaseUrl = requireDatabaseUrl(databaseUrl);
  const applied: string[] = [];
  const skipped: string[] = [];

  await runPsql(
    `
      CREATE TABLE IF NOT EXISTS _promptopts_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `,
    { databaseUrl: resolvedDatabaseUrl }
  );

  for (const migrationPath of POSTGRES_MIGRATION_FILES) {
    const alreadyApplied = await runPsql(
      `
        SELECT id
        FROM _promptopts_migrations
        WHERE id = ${sqlTextLiteral(migrationPath)}
        LIMIT 1;
      `,
      { databaseUrl: resolvedDatabaseUrl }
    );

    if (alreadyApplied) {
      skipped.push(migrationPath);
      continue;
    }

    const sql = await readFile(migrationPath, "utf8");
    await runPsql(sql, { databaseUrl: resolvedDatabaseUrl });
    await runPsql(
      `
        INSERT INTO _promptopts_migrations (id)
        VALUES (${sqlTextLiteral(migrationPath)});
      `,
      { databaseUrl: resolvedDatabaseUrl }
    );
    applied.push(migrationPath);
  }

  return { applied, skipped };
}

export async function resetPostgresDatabase(databaseUrl = process.env.DATABASE_URL): Promise<void> {
  const resolvedDatabaseUrl = requireDatabaseUrl(databaseUrl);

  if (process.env.NODE_ENV === "production" || process.env.PROMPTOPTS_CONFIRM_DB_RESET !== "local-dev") {
    throw new Error(
      "db:reset is local-dev only. Set PROMPTOPTS_CONFIRM_DB_RESET=local-dev to confirm."
    );
  }

  await runPsql(
    `
      DROP SCHEMA IF EXISTS public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO public;
    `,
    { databaseUrl: resolvedDatabaseUrl }
  );
}

export async function rollbackPostgresMigration(): Promise<never> {
  throw new Error(
    "Postgres rollback is intentionally unsupported for MVP migrations. Use db:reset for local dev only."
  );
}

export async function seedPostgresDatabase(databaseUrl = process.env.DATABASE_URL): Promise<void> {
  const resolvedDatabaseUrl = requireDatabaseUrl(databaseUrl);
  const repository = createPostgresRepository({ databaseUrl: resolvedDatabaseUrl });

  await seedSystemAdminRows(resolvedDatabaseUrl);
  await seedRepository(repository, createDemoRepositorySeed());
}

export async function seedRepository(
  repository: PromptOptsRepository,
  seed: Required<RepositorySeed>
): Promise<void> {
  await upsertMany(repository.workspaces, seed.workspaces);
  await upsertMany(repository.users, seed.users);
  await upsertMany(repository.provider_connections, seed.provider_connections);
  await upsertMany(repository.projects, seed.projects);
  await upsertMany(repository.prompts, seed.prompts);
  await upsertMany(repository.prompt_versions, seed.prompt_versions);
  await upsertMany(repository.prompt_analyses, seed.prompt_analyses);
  await upsertMany(repository.quality_contracts, seed.quality_contracts);
  await upsertMany(repository.test_cases, seed.test_cases);
  await upsertMany(repository.optimization_candidates, seed.optimization_candidates);
  await upsertMany(repository.model_registry, seed.model_registry);
  await upsertMany(repository.model_registry_versions, seed.model_registry_versions);
  await upsertMany(repository.eval_runs, seed.eval_runs);
  await upsertMany(repository.eval_results, seed.eval_results);
  await upsertMany(repository.reports, seed.reports);
  await upsertMany(repository.report_artifacts, seed.report_artifacts);
  await upsertMany(repository.deletion_requests, seed.deletion_requests);
  await upsertMany(repository.accounts, seed.accounts);
  await upsertMany(repository.contacts, seed.contacts);
  await upsertMany(repository.opportunities, seed.opportunities);
  await upsertMany(repository.free_audits, seed.free_audits);
  await upsertMany(repository.crm_notes, seed.crm_notes);
  await upsertMany(repository.tasks, seed.tasks);
  await upsertMany(repository.admin_roles, seed.admin_roles);
  await upsertMany(repository.admin_users, seed.admin_users);
  await upsertMany(repository.admin_sessions, seed.admin_sessions);
  await upsertMany(repository.sudo_requests, seed.sudo_requests);
  await upsertAuditLogs(repository, seed.admin_audit_logs);
  await upsertMany(repository.plans, seed.plans);
  await upsertMany(repository.entitlements, seed.entitlements);
  await upsertMany(repository.usage_ledger, seed.usage_ledger);
  await upsertMany(repository.billing_events, seed.billing_events);
  await upsertMany(repository.invoices, seed.invoices);
  await upsertMany(repository.credits, seed.credits);
  await upsertMany(repository.feature_flags, seed.feature_flags);
}

async function upsertMany<TRecord extends { id: string }>(
  repository: {
    get(id: string): Promise<TRecord | undefined>;
    create(record: TRecord): Promise<TRecord>;
    update(id: string, patch: Partial<Omit<TRecord, "id">>): Promise<TRecord | undefined>;
  },
  records: TRecord[]
): Promise<void> {
  for (const record of records) {
    const existing = await repository.get(record.id);

    if (existing) {
      const { id: _id, ...patch } = record;
      await repository.update(record.id, patch);
    } else {
      await repository.create(record);
    }
  }
}

async function upsertAuditLogs(
  repository: PromptOptsRepository,
  records: Required<RepositorySeed>["admin_audit_logs"]
): Promise<void> {
  for (const record of records) {
    if (!(await repository.admin_audit_logs.get(record.id))) {
      await repository.admin_audit_logs.append(record);
    }
  }
}

async function seedSystemAdminRows(databaseUrl: string): Promise<void> {
  const passwordHash = `sha256:${createHash("sha256")
    .update(process.env.PROMPTOPTS_ADMIN_DEV_PASSWORD ?? "promptopts-admin-dev")
    .digest("hex")}`;
  const mfaSecret = process.env.PROMPTOPTS_ADMIN_DEV_MFA_SECRET ?? "JBSWY3DPEHPK3PXP";

  await runPsql(
    `
      INSERT INTO admin_roles (id, name, scopes, is_system)
      VALUES
        ('admin_role_owner_demo', 'owner', '["read_metadata","manage_workspace","manage_model_registry","retry_eval","delete_report","issue_billing_credit","impersonate_user","revoke_user","break_glass"]'::jsonb, TRUE)
      ON CONFLICT (id) DO UPDATE
      SET scopes = EXCLUDED.scopes;

      INSERT INTO admin_users (
        id,
        user_id,
        email,
        display_name,
        role_ids,
        status,
        password_hash,
        mfa_secret
      )
      VALUES (
        'admin_user_demo',
        NULL,
        'ops@acme-ai.example',
        'Acme Ops Admin',
        '["admin_role_owner_demo"]'::jsonb,
        'active',
        ${sqlTextLiteral(passwordHash)},
        ${sqlTextLiteral(mfaSecret)}
      )
      ON CONFLICT (id) DO UPDATE
      SET role_ids = EXCLUDED.role_ids,
          status = EXCLUDED.status,
          password_hash = EXCLUDED.password_hash,
          mfa_secret = EXCLUDED.mfa_secret,
          updated_at = now();
    `,
    { databaseUrl }
  );
}
