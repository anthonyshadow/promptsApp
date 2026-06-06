import { describe, expect, test } from "bun:test";
import {
  createDemoRepositorySeed,
  createMemoryRepository,
  DEMO_IDS,
  type AdminAuditLog,
  type Workspace
} from "../index";

const createdAt = "2026-01-15T12:00:00.000Z";
const updatedAt = "2026-01-16T12:00:00.000Z";

describe("memory repository", () => {
  test("supports CRUD for swappable collection repositories", async () => {
    const repo = createMemoryRepository();
    const workspace: Workspace = {
      id: "workspace_test",
      name: "Test Workspace",
      slug: "test-workspace",
      prompts_private_by_default: true,
      data_use_policy: "no_training",
      provider_call_sensitive_data_policy: "require_confirmation",
      is_mock: true,
      created_at: createdAt,
      updated_at: createdAt
    };

    await expect(repo.workspaces.create(workspace)).resolves.toEqual(workspace);
    expect(await repo.workspaces.list()).toHaveLength(1);
    expect(await repo.workspaces.get(workspace.id)).toEqual(workspace);

    const updated = await repo.workspaces.update(workspace.id, {
      name: "Updated Workspace",
      updated_at: updatedAt
    });

    expect(updated?.name).toBe("Updated Workspace");
    expect(updated?.updated_at).toBe(updatedAt);
    expect(await repo.workspaces.delete(workspace.id)).toBe(true);
    expect(await repo.workspaces.get(workspace.id)).toBeUndefined();
  });

  test("loads demo seed across required domain collections", async () => {
    const repo = createMemoryRepository(createDemoRepositorySeed());

    expect(await repo.workspaces.get(DEMO_IDS.workspace)).toMatchObject({ name: "Acme AI" });
    expect(await repo.projects.get(DEMO_IDS.project)).toMatchObject({
      name: "Support classifier"
    });
    expect(await repo.test_cases.list()).toHaveLength(5);
    expect(await repo.model_registry.list()).toHaveLength(14);
    expect(await repo.model_registry_versions.get(DEMO_IDS.modelRegistryVersion)).toMatchObject({
      approval_state: "pending_review"
    });
    expect(await repo.crm_notes.get(DEMO_IDS.crmNote)).toMatchObject({
      redaction_state: "redacted"
    });
    expect(await repo.tasks.get(DEMO_IDS.task)).toMatchObject({
      status: "open"
    });
    expect(await repo.plans.get(DEMO_IDS.plan)).toMatchObject({
      name: "Demo Growth"
    });
    expect(await repo.invoices.get(DEMO_IDS.invoice)).toMatchObject({
      status: "open"
    });
    expect(await repo.credits.get(DEMO_IDS.credit)).toMatchObject({
      reason_code: "demo_seed"
    });
    expect(await repo.feature_flags.get(DEMO_IDS.featureFlagCliBeta)).toMatchObject({
      key: "cli_beta"
    });
    expect(await repo.reports.get(DEMO_IDS.report)).toMatchObject({
      status: "blocked",
      production_recommendation_allowed: false
    });
  });

  test("returns clones so caller mutation does not rewrite memory state", async () => {
    const repo = createMemoryRepository(createDemoRepositorySeed());
    const workspace = await repo.workspaces.get(DEMO_IDS.workspace);

    if (!workspace) {
      throw new Error("Expected demo workspace");
    }

    workspace.name = "Mutated outside repository";

    expect(await repo.workspaces.get(DEMO_IDS.workspace)).toMatchObject({ name: "Acme AI" });
  });

  test("admin audit logs are append-only", async () => {
    const repo = createMemoryRepository(createDemoRepositorySeed());
    const auditRepository = repo.admin_audit_logs as object;
    const startingLogs = await repo.admin_audit_logs.list();
    const log: AdminAuditLog = {
      id: "admin_audit_log_test_append",
      admin_user_id: "admin_user_demo",
      workspace_id: DEMO_IDS.workspace,
      account_id: DEMO_IDS.account,
      target_type: "report",
      target_id: DEMO_IDS.report,
      action: "view_redacted_report",
      action_scope: "read_metadata",
      reason_code: "test",
      sudo_request_id: null,
      ip_address: "127.0.0.1",
      user_agent: "PromptOpts test",
      redaction_state: "redacted",
      metadata: { test: true },
      is_mock: true,
      created_at: createdAt
    };

    expect("append" in auditRepository).toBe(true);
    expect("update" in auditRepository).toBe(false);
    expect("delete" in auditRepository).toBe(false);

    await expect(repo.admin_audit_logs.append(log)).resolves.toEqual(log);
    expect(await repo.admin_audit_logs.list()).toHaveLength(startingLogs.length + 1);
    await expect(repo.admin_audit_logs.append(log)).rejects.toThrow(
      "Audit log already exists"
    );
  });
});
