import { describe, expect, test } from "bun:test";
import {
  DEMO_IDS,
  createDemoRepositorySeed,
  createMemoryRepository,
  healthResponseSchema
} from "@promptopts/shared";
import { createMockAdminHeaders } from "@promptopts/admin-core";
import { createApp } from "./app";

function createTestApp() {
  return createApp({
    repository: createMemoryRepository(createDemoRepositorySeed())
  });
}

function jsonRequest(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  };
}

function patchJsonRequest(body: unknown): RequestInit {
  return {
    ...jsonRequest(body),
    method: "PATCH"
  };
}

function adminGetRequest(input: Parameters<typeof createMockAdminHeaders>[0] = {}): RequestInit {
  return {
    headers: createMockAdminHeaders(input)
  };
}

function adminJsonRequest(
  body: unknown,
  input: Parameters<typeof createMockAdminHeaders>[0] = {}
): RequestInit {
  return {
    method: "POST",
    headers: {
      ...createMockAdminHeaders(input),
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  };
}

function adminPatchJsonRequest(
  body: unknown,
  input: Parameters<typeof createMockAdminHeaders>[0] = {}
): RequestInit {
  return {
    ...adminJsonRequest(body, input),
    method: "PATCH"
  };
}

async function expectOkJson(response: Response) {
  expect(response.status).toBeGreaterThanOrEqual(200);
  expect(response.status).toBeLessThan(300);
  return response.json();
}

describe("public API routes", () => {
  test("GET /health returns API health", async () => {
    const response = await createTestApp().request("/health");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(healthResponseSchema.parse(body).status).toBe("ok");
  });

  test("GET /models filters registry rows by provider, task, and stability", async () => {
    const app = createTestApp();

    const supportModels = await expectOkJson(
      await app.request("/models?provider=openai&task_type=support&stability=unverified")
    );
    expect(supportModels.models.map((model: { model_id: string }) => model.model_id)).toEqual([
      "openai-demo-balanced"
    ]);

    const codingModels = await expectOkJson(
      await app.request("/models?provider=openai&task_type=coding&stability=unverified")
    );
    expect(codingModels.models).toHaveLength(0);

    expect((await app.request("/models?provider=openai&task_type=unknown")).status).toBe(400);
    expect((await app.request("/models?provider=openai&stability=retired")).status).toBe(400);
  });

  test("POST /prompts persists project, prompt, and raw prompt version records", async () => {
    const repository = createMemoryRepository(createDemoRepositorySeed());
    const app = createApp({ repository });
    const beforeProjects = await repository.projects.list();
    const beforePrompts = await repository.prompts.list();
    const beforeVersions = await repository.prompt_versions.list();

    const promptResponse = await expectOkJson(
      await app.request(
        "/prompts",
        jsonRequest({
          workspace_id: DEMO_IDS.workspace,
          name: "Extraction prompt",
          task_type: "extraction",
          provider: "gemini",
          model_id: "gemini-demo-balanced",
          prompt_text: "Extract invoice fields from {{invoice_text}} as JSON.",
          variables: ["invoice_text"]
        })
      )
    );

    const afterProjects = await repository.projects.list();
    const afterPrompts = await repository.prompts.list();
    const afterVersions = await repository.prompt_versions.list();
    const storedVersion = await repository.prompt_versions.get(promptResponse.version.id);

    expect(afterProjects).toHaveLength(beforeProjects.length + 1);
    expect(afterPrompts).toHaveLength(beforePrompts.length + 1);
    expect(afterVersions).toHaveLength(beforeVersions.length + 1);
    expect(storedVersion?.prompt_text).toBe("Extract invoice fields from {{invoice_text}} as JSON.");
    expect(promptResponse.project.current_provider).toBe("gemini");
    expect(promptResponse.version.variables).toEqual(["invoice_text"]);
  });

  test("POST /audits runs prompt-core audit and persists an analysis for saved prompts", async () => {
    const repository = createMemoryRepository(createDemoRepositorySeed());
    const app = createApp({ repository });
    const promptResponse = await expectOkJson(
      await app.request(
        "/prompts",
        jsonRequest({
          workspace_id: DEMO_IDS.workspace,
          name: "Sensitive support triage",
          task_type: "support",
          provider: "openai",
          model_id: "openai-demo-balanced",
          prompt_text:
            "Classify {{customer_message}}. Return JSON. Return JSON only. Customer email: ops@example.com.",
          variables: ["customer_message"]
        })
      )
    );
    const beforeAnalyses = await repository.prompt_analyses.list();

    const audit = await expectOkJson(
      await app.request(
        "/audits",
        jsonRequest({
          provider: "openai",
          modelId: "openai-demo-balanced",
          prompt:
            "Classify {{customer_message}}. Return JSON. Return JSON only. Customer email: ops@example.com.",
          taskType: "support",
          monthlyCalls: 250000,
          priority: "balanced",
          promptVersionId: promptResponse.version.id,
          constraints: {
            requiresJson: true,
            usesTools: false,
            usesImages: false,
            needsStructuredOutput: true,
            maxLatencyMs: null,
            minContextWindow: null
          }
        })
      )
    );
    const afterAnalyses = await repository.prompt_analyses.list();
    const storedAnalysis = await repository.prompt_analyses.get(audit.id);

    expect(audit.inputTokens).toBeGreaterThan(0);
    expect(audit.estimatedOutputTokens).toBeGreaterThan(0);
    expect(audit.monthlyCostEstimate.estimateStatus).toBe("unverified");
    expect(audit.sensitiveFindings.map((finding: { type: string }) => finding.type)).toContain("pii");
    expect(audit.compressionGuardrails.join(" ")).toContain("provider call");
    expect(audit.suggestedNextAction).toContain("Redact");
    expect(afterAnalyses).toHaveLength(beforeAnalyses.length + 1);
    expect(storedAnalysis?.prompt_version_id).toBe(promptResponse.version.id);
    expect(storedAnalysis?.risk_level).toBe(audit.riskLevel);
  });

  test("POST /audits captures free audits with redacted output and CRM signals", async () => {
    const repository = createMemoryRepository(createDemoRepositorySeed());
    const app = createApp({ repository });
    const beforeFreeAudits = await repository.free_audits.list();
    const beforeAccounts = await repository.accounts.list();
    const beforeContacts = await repository.contacts.list();
    const beforeOpportunities = await repository.opportunities.list();

    const audit = await expectOkJson(
      await app.request(
        "/audits",
        jsonRequest({
          provider: "openai",
          modelId: "openai-demo-balanced",
          prompt:
            "Classify {{customer_message}}. Internal policy: route refund threats to retention. Customer email: buyer@newco.example.",
          taskType: "support",
          monthlyCalls: 50000,
          priority: "cost",
          source: "free_audit",
          contactEmail: "buyer@newco.example",
          company: "NewCo AI",
          ctaClicked: "run_evals",
          constraints: {
            requiresJson: true,
            usesTools: false,
            usesImages: false,
            needsStructuredOutput: true,
            maxLatencyMs: null,
            minContextWindow: null
          }
        })
      )
    );
    const afterFreeAudits = await repository.free_audits.list();
    const afterAccounts = await repository.accounts.list();
    const afterContacts = await repository.contacts.list();
    const afterOpportunities = await repository.opportunities.list();
    const freeAudit = await repository.free_audits.get(audit.freeAudit.id);
    const account = await repository.accounts.get(audit.freeAudit.accountId);
    const contact = await repository.contacts.get(audit.freeAudit.contactId);
    const opportunity = await repository.opportunities.get(audit.freeAudit.opportunityId);

    expect(afterFreeAudits).toHaveLength(beforeFreeAudits.length + 1);
    expect(afterAccounts).toHaveLength(beforeAccounts.length + 1);
    expect(afterContacts).toHaveLength(beforeContacts.length + 1);
    expect(afterOpportunities).toHaveLength(beforeOpportunities.length + 1);
    expect(audit.freeAudit.shareableSummary).toContain("Run evals before switching");
    expect(audit.freeAudit.redactedPromptPreview).not.toContain("refund threats");
    expect(freeAudit?.redacted_prompt_preview).not.toContain("Internal policy");
    expect(account?.provider_preference).toBe("openai");
    expect(account?.domain).toBe("newco.example");
    expect(contact?.email).toBe("buyer@newco.example");
    expect(opportunity?.current_model).toBe("openai-demo-balanced");
    expect(opportunity?.fit_signal).toBe(audit.modelFit);
    expect(opportunity?.estimated_volume).toBe(50000);
    expect(opportunity?.estimated_savings).toBeNull();
    expect(opportunity?.use_case).toBe("support");
    expect(opportunity?.stage).toBe("eval_ready");
    expect(opportunity?.cta_clicked).toBe("run_evals");
  });

  test("POST /audits stores free audit records without CRM mapping when no lead exists", async () => {
    const repository = createMemoryRepository(createDemoRepositorySeed());
    const app = createApp({ repository });
    const beforeAccounts = await repository.accounts.list();

    const audit = await expectOkJson(
      await app.request(
        "/audits",
        jsonRequest({
          provider: "gemini",
          modelId: "gemini-demo-balanced",
          prompt: "Summarize {{document}} in five bullet points.",
          taskType: "summarization",
          monthlyCalls: 1000,
          priority: "balanced",
          source: "free_audit",
          ctaClicked: "get_audit_report",
          constraints: {
            requiresJson: false,
            usesTools: false,
            usesImages: false,
            needsStructuredOutput: false,
            maxLatencyMs: null,
            minContextWindow: null
          }
        })
      )
    );
    const freeAudit = await repository.free_audits.get(audit.freeAudit.id);

    expect(await repository.accounts.list()).toHaveLength(beforeAccounts.length);
    expect(audit.freeAudit.accountId).toBeNull();
    expect(freeAudit?.account_id).toBeNull();
    expect(freeAudit?.contact_email).toBeNull();
    expect(freeAudit?.shareable_summary).toContain("Run evals before switching");
  });

  test("implements the public route map with seed or mock data", async () => {
    const app = createTestApp();

    const models = await expectOkJson(await app.request("/models?provider=openai"));
    expect(models.models).toHaveLength(1);

    const audit = await expectOkJson(
      await app.request(
        "/audits",
        jsonRequest({
          provider: "openai",
          modelId: "openai-demo-balanced",
          prompt: "Classify {{customer_message}} into a support queue.",
          taskType: "support",
          monthlyCalls: 250000,
          priority: "balanced",
          constraints: {
            requiresJson: true,
            usesTools: false,
            usesImages: false,
            needsStructuredOutput: true,
            maxLatencyMs: null,
            minContextWindow: null
          }
        })
      )
    );
    expect(audit.riskLevel).toBe("medium");
    expect(audit.monthlyCostEstimate.estimateStatus).toBe("unverified");
    expect(audit.suggestedNextAction).toContain("Verify registry metadata");

    const promptResponse = await expectOkJson(
      await app.request(
        "/prompts",
        jsonRequest({
          workspace_id: DEMO_IDS.workspace,
          name: "Triage classifier",
          task_type: "support",
          provider: "openai",
          model_id: "openai-demo-balanced",
          prompt_text: "Return JSON for {{customer_message}}.",
          variables: ["customer_message"]
        })
      )
    );
    expect(promptResponse.project.name).toBe("Triage classifier");

    const optimize = await expectOkJson(
      await app.request(
        `/prompts/${DEMO_IDS.prompt}/optimize`,
        jsonRequest({
          analysis_id: DEMO_IDS.promptAnalysis,
          strategies: ["baseline", "balanced"]
        })
      )
    );
    expect(optimize.candidates).toHaveLength(2);

    const evalRun = await expectOkJson(
      await app.request(
        "/eval-runs",
        jsonRequest({
          project_id: DEMO_IDS.project,
          quality_contract_id: DEMO_IDS.qualityContract,
          baseline_prompt_version_id: DEMO_IDS.promptVersion,
          candidate_ids: ["candidate_support_classifier_baseline"],
          model_registry_record_ids: ["model_registry_openai_demo_balanced"],
          pass_threshold: 0.95
        })
      )
    );
    expect(evalRun.status).toBe("queued");

    const evalDetail = await expectOkJson(await app.request(`/eval-runs/${evalRun.id}`));
    expect(evalDetail.eval_run.id).toBe(evalRun.id);

    const report = await expectOkJson(
      await app.request(
        "/reports",
        jsonRequest({
          project_id: DEMO_IDS.project,
          eval_run_id: DEMO_IDS.evalRun
        })
      )
    );
    expect(report.production_recommendation_allowed).toBe(false);

    const exportResponse = await expectOkJson(
      await app.request(`/reports/${DEMO_IDS.report}/export?format=json`)
    );
    expect(exportResponse.export_package.redaction_state).toBe("redacted");
  });
});

describe("admin API routes", () => {
  test("implements the admin route map behind placeholder admin middleware", async () => {
    const app = createTestApp();

    await expectOkJson(await app.request("/admin-api/overview", adminGetRequest()));
    await expectOkJson(await app.request("/admin-api/accounts", adminGetRequest()));

    const account = await expectOkJson(
      await app.request(
        "/admin-api/accounts",
        adminJsonRequest({
          name: "Beta AI",
          workspace_id: null,
          stage: "qualified",
          owner_admin_user_id: null,
          domain: "beta-ai.example",
          redacted_prompt_preview: "No raw prompt in admin CRM."
        })
      )
    );
    expect(account.redacted_prompt_preview).toBe("No raw prompt in admin CRM.");

    await expectOkJson(
      await app.request(`/admin-api/accounts/${DEMO_IDS.account}`, adminGetRequest())
    );
    const patchedAccount = await expectOkJson(
      await app.request(
        `/admin-api/accounts/${DEMO_IDS.account}`,
        adminPatchJsonRequest({
          stage: "trial"
        })
      )
    );
    expect(patchedAccount.stage).toBe("trial");

    await expectOkJson(await app.request("/admin-api/users", adminGetRequest()));
    const revoke = await expectOkJson(
      await app.request(
        `/admin-api/users/${DEMO_IDS.user}/revoke-sessions`,
        adminJsonRequest({ reason_code: "support_request" })
      )
    );
    expect(revoke.revoked_sessions).toBe(0);

    const impersonation = await expectOkJson(
      await app.request(
        `/admin-api/users/${DEMO_IDS.user}/impersonate`,
        adminJsonRequest(
          { reason_code: "support_escalation" },
          { sudo_grant: { reason_code: "support_escalation" } }
        )
      )
    );
    expect(impersonation.impersonation_started).toBe(false);

    const workspace = await expectOkJson(
      await app.request(
        `/admin-api/workspaces/${DEMO_IDS.workspace}`,
        adminPatchJsonRequest({ name: "Acme AI Ops" })
      )
    );
    expect(workspace.name).toBe("Acme AI Ops");

    await expectOkJson(await app.request("/admin-api/eval-runs", adminGetRequest()));
    await expectOkJson(
      await app.request(`/admin-api/eval-runs/${DEMO_IDS.evalRun}`, adminGetRequest())
    );

    const retried = await expectOkJson(
      await app.request(
        `/admin-api/eval-runs/${DEMO_IDS.evalRun}/retry`,
        adminJsonRequest({ reason_code: "operator_retry" })
      )
    );
    expect(retried.eval_run.status).toBe("retrying");

    const cancelled = await expectOkJson(
      await app.request(
        `/admin-api/eval-runs/${DEMO_IDS.evalRun}/cancel`,
        adminJsonRequest({ reason_code: "operator_cancel" })
      )
    );
    expect(cancelled.eval_run.status).toBe("failed");

    const regenerated = await expectOkJson(
      await app.request(
        `/admin-api/eval-runs/${DEMO_IDS.evalRun}/regenerate-report`,
        adminJsonRequest({ reason_code: "operator_regenerate" })
      )
    );
    expect(regenerated.report.production_recommendation_allowed).toBe(false);

    const reveal = await expectOkJson(
      await app.request(
        `/admin-api/prompts/${DEMO_IDS.prompt}/reveal`,
        adminGetRequest({ sudo_grant: { reason_code: "prompt_reveal_test" } })
      )
    );
    expect(reveal.raw_prompt).toBeNull();

    await expectOkJson(await app.request("/admin-api/models", adminGetRequest()));
    const patchedModel = await expectOkJson(
      await app.request(
        "/admin-api/models/model_registry_openai_demo_balanced",
        adminPatchJsonRequest(
          {
            display_name: "OpenAI Demo Balanced Internal"
          },
          { sudo_grant: { reason_code: "registry_edit" } }
        )
      )
    );
    expect(patchedModel.display_name).toBe("OpenAI Demo Balanced Internal");

    const approvedModel = await expectOkJson(
      await app.request(
        "/admin-api/models/model_registry_openai_demo_balanced/approve",
        adminJsonRequest(
          {
            verified_by: "admin_user_mock",
            source_url: "https://example.com/verified",
            last_verified_at: "2026-01-16T12:00:00.000Z",
            reason_code: "registry_review"
          },
          { sudo_grant: { reason_code: "registry_review" } }
        )
      )
    );
    expect(approvedModel.freshness_status).toBe("fresh");

    await expectOkJson(await app.request("/admin-api/reports", adminGetRequest()));
    const deleteResponse = await expectOkJson(
      await app.request(
        `/admin-api/reports/${DEMO_IDS.report}/delete`,
        adminJsonRequest(
          {
            reason_code: "customer_request",
            sudo_request_id: "sudo_request_mock"
          },
          { sudo_grant: { reason_code: "customer_request" } }
        )
      )
    );
    expect(deleteResponse.deletion_queued).toBe(true);

    await expectOkJson(await app.request("/admin-api/billing", adminGetRequest()));
    const credit = await expectOkJson(
      await app.request(
        `/admin-api/billing/${DEMO_IDS.workspace}/credit`,
        adminJsonRequest(
          {
            feature: "free_audits",
            quantity: 1,
            reason_code: "manual_adjustment"
          },
          { sudo_grant: { reason_code: "manual_adjustment" } }
        )
      )
    );
    expect(credit.ledger_entry.direction).toBe("credit");

    const breakGlass = await expectOkJson(
      await app.request(
        "/admin-api/break-glass",
        adminJsonRequest(
          { reason_code: "owner_emergency_test" },
          { sudo_grant: { reason_code: "owner_emergency_test" } }
        )
      )
    );
    expect(breakGlass.break_glass_started).toBe(false);

    const auditLogs = await expectOkJson(await app.request("/admin-api/audit-logs", adminGetRequest()));
    expect(auditLogs.audit_logs.length).toBeGreaterThan(1);
  });

  test("does not expose raw prompt content in admin account responses", async () => {
    const accountDetail = await expectOkJson(
      await createTestApp().request(`/admin-api/accounts/${DEMO_IDS.account}`, adminGetRequest())
    );

    expect(JSON.stringify(accountDetail)).not.toContain("Classify the inbound support message");
    expect(accountDetail.account.redacted_prompt_preview).toContain("Support classifier");
  });

  test("enforces session, MFA, action scope, and sudo on admin routes", async () => {
    const app = createTestApp();

    const noSession = await app.request("/admin-api/overview");
    expect(noSession.status).toBe(401);

    const noMfa = await app.request(
      "/admin-api/overview",
      adminGetRequest({ mfa_verified: false })
    );
    expect(noMfa.status).toBe(403);

    const readOnlyGet = await app.request(
      "/admin-api/accounts",
      adminGetRequest({ role: "read_only" })
    );
    expect(readOnlyGet.status).toBe(200);

    const readOnlyMutation = await app.request(
      "/admin-api/accounts",
      adminJsonRequest(
        {
          name: "Blocked AI",
          workspace_id: null,
          stage: "qualified",
          owner_admin_user_id: null,
          domain: "blocked.example",
          redacted_prompt_preview: null
        },
        { role: "read_only" }
      )
    );
    expect(readOnlyMutation.status).toBe(403);

    const noSudo = await app.request(
      `/admin-api/reports/${DEMO_IDS.report}/delete`,
      adminJsonRequest(
        {
          reason_code: "customer_request",
          sudo_request_id: null
        },
        { sudo_grant: null }
      )
    );
    expect(noSudo.status).toBe(403);

    const sudoReveal = await app.request(
      `/admin-api/prompts/${DEMO_IDS.prompt}/reveal`,
      adminGetRequest({ sudo_grant: { reason_code: "prompt_reveal_test" } })
    );
    expect(sudoReveal.status).toBe(200);
  });

  test("writes audit logs for mutations and sensitive reads", async () => {
    const repository = createMemoryRepository(createDemoRepositorySeed());
    const app = createApp({ repository });
    const before = await repository.admin_audit_logs.list();

    await app.request(
      `/admin-api/accounts/${DEMO_IDS.account}`,
      adminPatchJsonRequest({ stage: "trial" })
    );
    await app.request("/admin-api/audit-logs", adminGetRequest());

    const after = await repository.admin_audit_logs.list();
    expect(after.length).toBe(before.length + 2);
    expect(after.at(-1)?.target_type).toBe("audit_logs");
  });

  test("keeps public and admin namespaces separated", async () => {
    const app = createTestApp();

    expect((await app.request("/admin-api/health", adminGetRequest())).status).toBe(404);
    expect((await app.request("/accounts")).status).toBe(404);
    expect((await app.request("/models")).status).toBe(200);
    expect((await app.request("/admin-api/models", adminGetRequest())).status).toBe(200);
  });
});

describe("route request validation", () => {
  test("rejects invalid bodies on every POST and PATCH skeleton route", async () => {
    const app = createTestApp();
    const invalidRoutes: Array<{ method: "POST" | "PATCH"; path: string }> = [
      { method: "POST", path: "/audits" },
      { method: "POST", path: "/prompts" },
      { method: "POST", path: `/prompts/${DEMO_IDS.prompt}/optimize` },
      { method: "POST", path: "/eval-runs" },
      { method: "POST", path: "/reports" },
      { method: "POST", path: "/admin-api/accounts" },
      { method: "PATCH", path: `/admin-api/accounts/${DEMO_IDS.account}` },
      { method: "POST", path: `/admin-api/users/${DEMO_IDS.user}/revoke-sessions` },
      { method: "PATCH", path: `/admin-api/workspaces/${DEMO_IDS.workspace}` },
      { method: "POST", path: `/admin-api/eval-runs/${DEMO_IDS.evalRun}/retry` },
      { method: "POST", path: `/admin-api/eval-runs/${DEMO_IDS.evalRun}/cancel` },
      { method: "POST", path: `/admin-api/eval-runs/${DEMO_IDS.evalRun}/regenerate-report` },
      { method: "PATCH", path: "/admin-api/models/model_registry_openai_demo_balanced" },
      { method: "POST", path: "/admin-api/models/model_registry_openai_demo_balanced/approve" },
      { method: "POST", path: `/admin-api/reports/${DEMO_IDS.report}/delete` },
      { method: "POST", path: `/admin-api/billing/${DEMO_IDS.workspace}/credit` }
    ];

    for (const route of invalidRoutes) {
      const response = await app.request(
        route.path,
        route.method === "PATCH"
          ? adminPatchJsonRequest({}, { sudo_grant: { reason_code: "validation_test" } })
          : adminJsonRequest({}, { sudo_grant: { reason_code: "validation_test" } })
      );
      expect(response.status).toBe(400);
    }
  });

  test("requires verification metadata for model metadata edits", async () => {
    const response = await createTestApp().request(
      "/admin-api/models/model_registry_openai_demo_balanced",
      adminPatchJsonRequest(
        {
          input_price_per_million_tokens: 2
        },
        { sudo_grant: { reason_code: "registry_validation" } }
      )
    );

    expect(response.status).toBe(400);
  });
});
