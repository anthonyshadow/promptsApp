import { describe, expect, test } from "bun:test";
import {
  createMemoryRepository,
  type AdminAuditLog,
  type PromptOptsRepository,
  type Workspace
} from "../index";
import { createPostgresRepository, runPostgresMigrations } from "./postgres";
import { runPsql } from "./postgres/psql";

const createdAt = "2026-01-15T12:00:00.000Z";
const updatedAt = "2026-01-16T12:00:00.000Z";

function uniqueId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

async function exerciseRepositoryContract(repository: PromptOptsRepository) {
  const workspace: Workspace = {
    id: uniqueId("workspace_contract"),
    name: "Contract Workspace",
    slug: uniqueId("contract-workspace"),
    is_mock: true,
    created_at: createdAt,
    updated_at: createdAt
  };

  await expect(repository.workspaces.create(workspace)).resolves.toEqual(workspace);
  expect(await repository.workspaces.get(workspace.id)).toEqual(workspace);
  expect((await repository.workspaces.list()).some((item) => item.id === workspace.id)).toBe(true);

  const updated = await repository.workspaces.update(workspace.id, {
    name: "Updated Contract Workspace",
    updated_at: updatedAt
  });

  expect(updated).toMatchObject({
    id: workspace.id,
    name: "Updated Contract Workspace",
    updated_at: updatedAt
  });

  expect(await repository.workspaces.delete(workspace.id)).toBe(true);
  expect(await repository.workspaces.get(workspace.id)).toBeUndefined();
}

async function appendAuditLog(repository: PromptOptsRepository): Promise<AdminAuditLog> {
  const log: AdminAuditLog = {
    id: uniqueId("admin_audit_log_contract"),
    admin_user_id: "admin_user_contract",
    workspace_id: null,
    account_id: null,
    target_type: "repository_contract",
    target_id: "repository_contract",
    action: "append_contract_audit_log",
    action_scope: "read_metadata",
    reason_code: "repository_contract",
    sudo_request_id: null,
    ip_address: "127.0.0.1",
    user_agent: "PromptOpts repository contract test",
    redaction_state: "not_sensitive",
    metadata: { contract: true },
    is_mock: true,
    created_at: createdAt
  };

  await expect(repository.admin_audit_logs.append(log)).resolves.toEqual(log);
  expect(await repository.admin_audit_logs.get(log.id)).toEqual(log);
  await expect(repository.admin_audit_logs.append(log)).rejects.toThrow();
  return log;
}

describe("repository contract", () => {
  test("memory adapter supports CRUD and append-only audit logs", async () => {
    const repository = createMemoryRepository();

    expect(repository.backend).toBe("memory");
    await exerciseRepositoryContract(repository);

    const auditRepository = repository.admin_audit_logs as object;

    expect("append" in auditRepository).toBe(true);
    expect("update" in auditRepository).toBe(false);
    expect("delete" in auditRepository).toBe(false);

    await appendAuditLog(repository);
  });

  test("postgres adapter supports CRUD, append-only audit logs, and durable deletion state when DATABASE_URL is present", async () => {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      console.warn(
        "Skipping Postgres repository contract integration test because DATABASE_URL is not set."
      );
      expect(Boolean(databaseUrl)).toBe(false);
      return;
    }

    await runPostgresMigrations(databaseUrl);
    const repository = createPostgresRepository({ databaseUrl });

    expect(repository.backend).toBe("postgres");
    await exerciseRepositoryContract(repository);

    const auditRepository = repository.admin_audit_logs as object;

    expect("append" in auditRepository).toBe(true);
    expect("update" in auditRepository).toBe(false);
    expect("delete" in auditRepository).toBe(false);

    const log = await appendAuditLog(repository);

    await expect(
      runPsql(
        `
          UPDATE admin_audit_logs
          SET reason_code = 'mutated'
          WHERE id = '${log.id}';
        `,
        { databaseUrl }
      )
    ).rejects.toThrow("psql exited");

    await runPsql(
      `
        INSERT INTO workspaces (id, name, slug, is_mock, created_at, updated_at)
        VALUES ('workspace_deletion_contract', 'Deletion Contract', 'deletion-contract', TRUE, '${createdAt}', '${createdAt}')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO projects (
          id, workspace_id, name, task_type, current_provider, current_model_id,
          status, is_mock, created_at, updated_at
        )
        VALUES (
          'project_deletion_contract', 'workspace_deletion_contract', 'Deletion Contract',
          'support', 'openai', 'openai-demo-balanced', 'active', TRUE, '${createdAt}', '${createdAt}'
        )
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO prompts (
          id, project_id, name, current_version_id, redacted_preview, is_mock,
          created_at, updated_at
        )
        VALUES (
          'prompt_deletion_contract', 'project_deletion_contract', 'Deletion Contract',
          NULL, 'Redacted deletion contract prompt.', TRUE, '${createdAt}', '${createdAt}'
        )
        ON CONFLICT (id) DO NOTHING;

        UPDATE prompts
        SET retention_state = 'delete_requested',
            delete_reason_code = 'repository_contract'
        WHERE id = 'prompt_deletion_contract';

        SELECT retention_state
        FROM prompts
        WHERE id = 'prompt_deletion_contract';
      `,
      { databaseUrl }
    ).then((stdout) => expect(stdout.split("\n").at(-1)).toBe("delete_requested"));
  });
});
