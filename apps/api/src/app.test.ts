import { describe, expect, test } from "bun:test";
import {
  DEMO_IDS,
  type AdminActionScope,
  type AdminRoleRecord,
  type AdminSessionRecord,
  type AdminUserRecord,
  type RepositorySeed,
  type SudoRequest,
  createDemoRepositorySeed,
  createMemoryRepository,
  healthResponseSchema
} from "@promptopts/shared";
import { createTotpCode, hashAdminSessionToken } from "@promptopts/admin-core";
import { createApp } from "./app";
import {
  adminEvalRunDetailResponseSchema,
  adminEvalRunsResponseSchema,
  adminModelRegistryResponseSchema,
  adminOverviewResponseSchema,
  adminReportsResponseSchema,
  billingCreditResponseSchema,
  billingResponseSchema,
  modelApproveResponseSchema,
  modelPatchResponseSchema,
  reportDeleteResponseSchema,
  reportExportActionResponseSchema
} from "./contracts";

const ADMIN_TEST_TOKENS = {
  owner: "admin_test_token_owner",
  ownerNoMfa: "admin_test_token_owner_no_mfa",
  ownerSudo: "admin_test_token_owner_sudo",
  support: "admin_test_token_support",
  supportSudo: "admin_test_token_support_sudo",
  readOnly: "admin_test_token_read_only",
  missingScope: "admin_test_token_missing_scope"
} as const;

type AdminRequestInput = {
  role?: "owner" | "ops" | "support" | "finance" | "read_only";
  mfa_verified?: boolean;
  sudo_grant?: { reason_code?: string } | null;
  missingScope?: boolean;
};

function createTestApp() {
  return createApp({
    repository: createAdminTestRepository()
  });
}

function createAdminTestRepository() {
  return createMemoryRepository(createAdminTestSeed());
}

function createAdminTestSeed(): Required<RepositorySeed> {
  const seed = createDemoRepositorySeed();
  const timestamp = "2026-06-06T12:00:00.000Z";
  const expiresAt = "2030-01-01T00:00:00.000Z";
  const role = (name: AdminRoleRecord["name"], scopes: AdminActionScope[]): AdminRoleRecord => ({
    id: `admin_role_test_${name}_${scopes.length}`,
    name,
    scopes,
    is_system: true,
    created_at: timestamp
  });
  const ownerRole = role("owner", [
    "read_metadata",
    "reveal_prompt",
    "reveal_report",
    "manage_workspace",
    "manage_model_registry",
    "retry_eval",
    "delete_report",
    "issue_billing_credit",
    "impersonate_user",
    "revoke_user",
    "break_glass"
  ]);
  const ownerNoScopeRole = role("owner", []);
  const supportRole = role("support", ["read_metadata", "retry_eval", "revoke_user"]);
  const readOnlyRole = role("read_only", ["read_metadata"]);
  const adminUser = (
    id: string,
    roleIds: string[],
    email: string
  ): AdminUserRecord => ({
    id,
    user_id: null,
    email,
    display_name: id,
    role_ids: roleIds,
    status: "active",
    password_hash: "sha256:3049b742957bf075de0f9cb0921707659065972bef873d86131f57f61d9a796e",
    mfa_secret: "JBSWY3DPEHPK3PXP",
    created_at: timestamp,
    updated_at: timestamp
  });
  const session = (
    id: string,
    adminUserId: string,
    token: string,
    mfaVerified = true
  ): AdminSessionRecord => ({
    id,
    admin_user_id: adminUserId,
    session_hash: hashAdminSessionToken(token),
    mfa_verified_at: mfaVerified ? timestamp : null,
    revoked_at: null,
    expires_at: expiresAt,
    ip_address: "127.0.0.1",
    user_agent: "PromptOpts admin route test",
    created_at: timestamp
  });
  const sudo = (
    id: string,
    adminUserId: string,
    actionScope: AdminActionScope
  ): SudoRequest => ({
    id,
    admin_user_id: adminUserId,
    role: adminUserId.includes("support") ? "support" : "owner",
    requested_action: actionScope,
    target_type: null,
    target_id: null,
    action_scope: actionScope,
    reason_code: "route_test_sudo",
    status: "active",
    approved_by_admin_user_id: adminUserId,
    approved_at: timestamp,
    activated_at: timestamp,
    revoked_at: null,
    expires_at: expiresAt,
    ip_address: "127.0.0.1",
    user_agent: "PromptOpts admin route test",
    created_at: timestamp
  });

  return {
    ...seed,
    admin_roles: [
      ...seed.admin_roles,
      ownerRole,
      ownerNoScopeRole,
      supportRole,
      readOnlyRole
    ],
    admin_users: [
      ...seed.admin_users,
      adminUser("admin_user_test_owner", [ownerRole.id], "owner.admin@test.promptopts"),
      adminUser("admin_user_test_owner_sudo", [ownerRole.id], "owner.sudo@test.promptopts"),
      adminUser("admin_user_test_support", [supportRole.id], "support.admin@test.promptopts"),
      adminUser("admin_user_test_support_sudo", [supportRole.id], "support.sudo@test.promptopts"),
      adminUser("admin_user_test_read_only", [readOnlyRole.id], "readonly.admin@test.promptopts"),
      adminUser("admin_user_test_missing_scope", [ownerNoScopeRole.id], "missing.scope@test.promptopts")
    ],
    admin_sessions: [
      ...seed.admin_sessions,
      session("admin_session_test_owner", "admin_user_test_owner", ADMIN_TEST_TOKENS.owner),
      session(
        "admin_session_test_owner_no_mfa",
        "admin_user_test_owner",
        ADMIN_TEST_TOKENS.ownerNoMfa,
        false
      ),
      session(
        "admin_session_test_owner_sudo",
        "admin_user_test_owner_sudo",
        ADMIN_TEST_TOKENS.ownerSudo
      ),
      session("admin_session_test_support", "admin_user_test_support", ADMIN_TEST_TOKENS.support),
      session(
        "admin_session_test_support_sudo",
        "admin_user_test_support_sudo",
        ADMIN_TEST_TOKENS.supportSudo
      ),
      session("admin_session_test_read_only", "admin_user_test_read_only", ADMIN_TEST_TOKENS.readOnly),
      session(
        "admin_session_test_missing_scope",
        "admin_user_test_missing_scope",
        ADMIN_TEST_TOKENS.missingScope
      )
    ],
    sudo_requests: [
      ...seed.sudo_requests,
      sudo("sudo_request_test_reveal_prompt", "admin_user_test_owner_sudo", "reveal_prompt"),
      sudo("sudo_request_test_reveal_report", "admin_user_test_owner_sudo", "reveal_report"),
      sudo("sudo_request_test_delete_report", "admin_user_test_owner_sudo", "delete_report"),
      sudo("sudo_request_test_billing_credit", "admin_user_test_owner_sudo", "issue_billing_credit"),
      sudo("sudo_request_test_model_registry", "admin_user_test_owner_sudo", "manage_model_registry"),
      sudo("sudo_request_test_impersonate", "admin_user_test_owner_sudo", "impersonate_user"),
      sudo("sudo_request_test_break_glass", "admin_user_test_owner_sudo", "break_glass"),
      sudo("sudo_request_test_support_credit", "admin_user_test_support_sudo", "issue_billing_credit")
    ]
  };
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

function adminGetRequest(input: AdminRequestInput = {}): RequestInit {
  return {
    headers: {
      authorization: `Bearer ${adminTokenFor(input)}`
    }
  };
}

function adminJsonRequest(
  body: unknown,
  input: AdminRequestInput = {}
): RequestInit {
  return {
    method: "POST",
    headers: {
      authorization: `Bearer ${adminTokenFor(input)}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  };
}

function adminPatchJsonRequest(
  body: unknown,
  input: AdminRequestInput = {}
): RequestInit {
  return {
    ...adminJsonRequest(body, input),
    method: "PATCH"
  };
}

function adminTokenFor(input: AdminRequestInput): string {
  if (input.missingScope) {
    return ADMIN_TEST_TOKENS.missingScope;
  }

  if (input.mfa_verified === false) {
    return ADMIN_TEST_TOKENS.ownerNoMfa;
  }

  if (input.sudo_grant) {
    return input.role === "support" ? ADMIN_TEST_TOKENS.supportSudo : ADMIN_TEST_TOKENS.ownerSudo;
  }

  if (input.role === "support") {
    return ADMIN_TEST_TOKENS.support;
  }

  if (input.role === "read_only") {
    return ADMIN_TEST_TOKENS.readOnly;
  }

  return ADMIN_TEST_TOKENS.owner;
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

  test("GET /models filters registry rows by provider, task, stability, and capabilities", async () => {
    const app = createTestApp();

    const supportModels = await expectOkJson(
      await app.request(
        "/models?provider=openai&task_type=support&stability=unverified&supportsStructuredOutput=true&supportsTools=true"
      )
    );
    expect(supportModels.models.map((model: { model_id: string }) => model.model_id)).toEqual([
      "openai-demo-frontier",
      "openai-demo-balanced",
      "openai-demo-economy"
    ]);

    const codingModels = await expectOkJson(
      await app.request("/models?provider=openai&task_type=coding&stability=unverified")
    );
    expect(codingModels.models).toHaveLength(0);

    const imageModels = await expectOkJson(
      await app.request("/models?provider=openai&taskType=support&modality=image")
    );
    expect(imageModels.models).toHaveLength(0);

    expect((await app.request("/models?provider=openai&task_type=unknown")).status).toBe(400);
    expect((await app.request("/models?provider=openai&stability=retired")).status).toBe(400);
    expect((await app.request("/models?provider=openai&modality=telepathy")).status).toBe(400);
    expect((await app.request("/models?provider=openai&supportsTools=maybe")).status).toBe(400);
  });

  test("GET /workspaces/:slug/dashboard aggregates seeded project value state", async () => {
    const app = createTestApp();
    const dashboard = await expectOkJson(await app.request("/workspaces/acme-ai/dashboard"));

    expect(dashboard.workspace.slug).toBe("acme-ai");
    expect(dashboard.metrics.verified_monthly_savings_usd).toBeNull();
    expect(dashboard.metrics.prompts_optimized).toBe(1);
    expect(dashboard.metrics.eval_pass_average).toBeNull();
    expect(dashboard.metrics.models_flagged).toBe(1);
    expect(dashboard.metrics.verified_savings_note).toContain("No verified monthly savings");
    expect(dashboard.recent_projects).toHaveLength(1);
    expect(dashboard.recent_projects[0]).toMatchObject({
      project_name: "Support classifier",
      provider: "openai",
      fit: "overpowered",
      savings_status: "blocked",
      status: "review"
    });
    expect(dashboard.notes.join(" ")).toContain("Unverified registry metadata");
  });

  test("GET /workspaces/:slug/dashboard returns 404 for unknown workspaces", async () => {
    const response = await createTestApp().request("/workspaces/missing/dashboard");

    expect(response.status).toBe(404);
  });

  test("POST /prompts persists project, prompt, and raw prompt version records", async () => {
    const repository = createAdminTestRepository();
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
    const repository = createAdminTestRepository();
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
    const repository = createAdminTestRepository();
    const app = createApp({ repository });
    const beforeFreeAudits = await repository.free_audits.list();
    const beforeAccounts = await repository.accounts.list();
    const beforeContacts = await repository.contacts.list();
    const beforeOpportunities = await repository.opportunities.list();
    const beforeNotes = await repository.crm_notes.list();
    const beforeTasks = await repository.tasks.list();

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
    const afterNotes = await repository.crm_notes.list();
    const afterTasks = await repository.tasks.list();
    const freeAudit = await repository.free_audits.get(audit.freeAudit.id);
    const account = await repository.accounts.get(audit.freeAudit.accountId);
    const contact = await repository.contacts.get(audit.freeAudit.contactId);
    const opportunity = await repository.opportunities.get(audit.freeAudit.opportunityId);
    const note = afterNotes.find((item) => !beforeNotes.some((existing) => existing.id === item.id));
    const task = afterTasks.find((item) => !beforeTasks.some((existing) => existing.id === item.id));

    expect(afterFreeAudits).toHaveLength(beforeFreeAudits.length + 1);
    expect(afterAccounts).toHaveLength(beforeAccounts.length + 1);
    expect(afterContacts).toHaveLength(beforeContacts.length + 1);
    expect(afterOpportunities).toHaveLength(beforeOpportunities.length + 1);
    expect(afterNotes).toHaveLength(beforeNotes.length + 1);
    expect(afterTasks).toHaveLength(beforeTasks.length + 1);
    expect(audit.freeAudit.shareableSummary).toContain("Run evals before switching");
    expect(audit.freeAudit.redactedPromptPreview).not.toContain("refund threats");
    expect(freeAudit?.redacted_prompt_preview).not.toContain("Internal policy");
    expect(account?.stage).toBe("new_audit");
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
    expect(note?.body_redacted).toContain("Prompt redacted");
    expect(JSON.stringify(note)).not.toContain("Internal policy");
    expect(task?.title).toContain("run evals");
  });

  test("POST /audits stores free audit records without CRM mapping when no lead exists", async () => {
    const repository = createAdminTestRepository();
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

  test("GET and POST /projects/:id/quality-contract support auto-draft and persistence", async () => {
    const repository = createAdminTestRepository();
    const app = createApp({ repository });
    const promptResponse = await expectOkJson(
      await app.request(
        "/prompts",
        jsonRequest({
          workspace_id: DEMO_IDS.workspace,
          name: "Contract draft project",
          task_type: "classification",
          provider: "openai",
          model_id: "openai-demo-balanced",
          prompt_text: "Classify {{message}} into label and confidence JSON.",
          variables: ["message"]
        })
      )
    );

    const autoDraft = await expectOkJson(
      await app.request(`/projects/${promptResponse.project.id}/quality-contract`)
    );
    expect(autoDraft.source).toBe("auto_draft");
    expect(autoDraft.contract.task).toBe("Classification");
    expect(autoDraft.production_recommendation_allowed).toBe(false);
    expect(autoDraft.production_blockers.join(" ")).toContain("No test cases");

    const saved = await expectOkJson(
      await app.request(
        `/projects/${promptResponse.project.id}/quality-contract`,
        jsonRequest({
          task: autoDraft.contract.task,
          required_output: autoDraft.contract.required_output,
          must_preserve: autoDraft.contract.must_preserve,
          forbidden_behavior: autoDraft.contract.forbidden_behavior,
          pass_threshold: 0.95,
          must_pass_check_ids: autoDraft.contract.must_pass_check_ids,
          check_definitions: autoDraft.contract.check_definitions,
          notes: "Reviewed contract."
        })
      )
    );

    expect(saved.source).toBe("persisted");
    expect(saved.contract.notes).toBe("Reviewed contract.");
    expect(await repository.quality_contracts.get(saved.contract.id)).toBeDefined();
  });

  test("POST /prompts/:id/optimize generates persisted candidate risk profiles", async () => {
    const repository = createAdminTestRepository();
    const app = createApp({ repository });
    const beforeCandidates = await repository.optimization_candidates.list();

    const optimize = await expectOkJson(
      await app.request(
        `/prompts/${DEMO_IDS.prompt}/optimize`,
        jsonRequest({
          analysis_id: DEMO_IDS.promptAnalysis,
          strategies: ["conservative", "balanced", "aggressive", "output_lite", "model_specific"]
        })
      )
    );
    const afterCandidates = await repository.optimization_candidates.list();

    expect(optimize.candidates).toHaveLength(5);
    expect(afterCandidates).toHaveLength(beforeCandidates.length + 5);
    expect(optimize.candidates.map((candidate: { label: string }) => candidate.label)).toEqual([
      "Conservative",
      "Balanced",
      "Aggressive",
      "Output-lite",
      "Model-specific"
    ]);
    expect(
      optimize.candidates.find((candidate: { strategy: string }) => candidate.strategy === "aggressive")
        ?.risk_level
    ).toBe("high");
    expect(
      optimize.candidates.every(
        (candidate: { estimated_input_tokens: number }) => candidate.estimated_input_tokens > 0
      )
    ).toBe(true);
    expect(
      optimize.candidates.every((candidate: { preserved_constraints: string[] }) =>
        candidate.preserved_constraints.join(" ").includes("Must-pass check")
      )
    ).toBe(true);
    expect(optimize.todo).toContain("provisional until evals pass");
  });

  test("test case creation and update keep production recommendation blocked until eval proof", async () => {
    const repository = createAdminTestRepository();
    const app = createApp({ repository });
    const beforeCases = await repository.test_cases.list();

    const created = await expectOkJson(
      await app.request(
        `/quality-contracts/${DEMO_IDS.qualityContract}/test-cases`,
        jsonRequest({
          name: "New exact label",
          input_variables: { customer_message: "Need billing help" },
          expected_output: { category: "billing" },
          checks: [
            {
              id: "check_new_exact",
              type: "exact",
              description: "Category remains billing.",
              must_pass: true,
              field_path: "category",
              expected_value: "billing",
              pattern: null,
              placeholder_note: null
            }
          ]
        })
      )
    );

    expect(await repository.test_cases.list()).toHaveLength(beforeCases.length + 1);
    expect(created.test_case.name).toBe("New exact label");
    expect(created.production_recommendation_allowed).toBe(false);
    expect(created.production_blockers.join(" ")).toContain("Eval matrix");

    const updated = await expectOkJson(
      await app.request(
        `/test-cases/${created.test_case.id}`,
        patchJsonRequest({
          name: "Updated exact label"
        })
      )
    );

    expect(updated.test_case.name).toBe("Updated exact label");
  });

  test("POST and GET /eval-runs execute the mocked eval matrix with failures and retry hints", async () => {
    const repository = createAdminTestRepository();
    const app = createApp({ repository });
    const beforeResults = await repository.eval_results.list();

    const evalRun = await expectOkJson(
      await app.request(
        "/eval-runs",
        jsonRequest({
          project_id: DEMO_IDS.project,
          quality_contract_id: DEMO_IDS.qualityContract,
          baseline_prompt_version_id: DEMO_IDS.promptVersion,
          candidate_ids: ["candidate_support_classifier_balanced"],
          model_registry_record_ids: ["model_registry_openai_demo_balanced"],
          test_case_ids: [
            "test_case_support_classifier_billing",
            "test_case_support_classifier_outage"
          ],
          pass_threshold: 0.95
        })
      )
    );
    const afterResults = await repository.eval_results.list();
    const detail = await expectOkJson(await app.request(`/eval-runs/${evalRun.id}`));

    expect(evalRun.status).toBe("complete");
    expect(afterResults.length).toBeGreaterThan(beforeResults.length);
    expect(detail.eval_run.id).toBe(evalRun.id);
    expect(detail.results).toHaveLength(2);
    expect(detail.frontier_points).toHaveLength(2);
    expect(detail.frontier_points.map((point: { role: string }) => point.role)).toEqual([
      "baseline",
      "winner_candidate"
    ]);
    expect(detail.results.map((result: { verdict: string }) => result.verdict)).toEqual([
      "pass",
      "pass"
    ]);
    expect(detail.failures).toHaveLength(0);
    expect(detail.retry_hints.join(" ")).toContain("Registry metadata");
    expect(detail.status_note).toContain("Mock eval runner completed");

    const report = await expectOkJson(
      await app.request(
        "/reports",
        jsonRequest({
          project_id: DEMO_IDS.project,
          eval_run_id: evalRun.id
        })
      )
    );
    const reportDetail = await expectOkJson(await app.request(`/reports/${report.id}`));
    const exportResponse = await expectOkJson(await app.request(`/reports/${report.id}/export?format=markdown`));

    expect(report.status).toBe("ready");
    expect(report.winner_result_id).not.toBeNull();
    expect(report.cheaper_alternative_result_id).not.toBeNull();
    expect(report.stronger_fallback_result_id).not.toBeNull();
    expect(report.production_recommendation_allowed).toBe(true);
    expect(report.savings_summary).toContain("unverified");
    expect(reportDetail.decision.winnerResultId).toBe(report.winner_result_id);
    expect(reportDetail.frontier_points.map((point: { role: string }) => point.role)).toContain("winner_candidate");
    expect(exportResponse.export_package.content).toContain("PromptOpts Recommendation Report");
    expect(exportResponse.export_package.redacted_share_package.redaction_state).toBe("redacted");
    expect(exportResponse.export_package.eval_snapshot.result_count).toBe(2);
  });

  test("public eval and export routes enforce billing entitlements", async () => {
    const repository = createAdminTestRepository();
    const app = createApp({ repository });
    const entitlements = await repository.entitlements.list();
    const hostedEvalEntitlement = entitlements.find(
      (entitlement) => entitlement.feature === "hosted_eval_runs"
    );
    const reportExportEntitlement = entitlements.find(
      (entitlement) => entitlement.feature === "report_exports"
    );

    if (!hostedEvalEntitlement || !reportExportEntitlement) {
      throw new Error("Expected demo entitlements");
    }

    await repository.entitlements.update(hostedEvalEntitlement.id, {
      used: hostedEvalEntitlement.limit
    });
    const blockedEval = await app.request(
      "/eval-runs",
      jsonRequest({
        project_id: DEMO_IDS.project,
        quality_contract_id: DEMO_IDS.qualityContract,
        baseline_prompt_version_id: DEMO_IDS.promptVersion,
        candidate_ids: ["candidate_support_classifier_baseline"],
        model_registry_record_ids: ["model_registry_openai_demo_balanced"],
        test_case_ids: ["test_case_support_classifier_billing"],
        pass_threshold: 0.95
      })
    );
    expect(blockedEval.status).toBe(403);

    await repository.entitlements.update(hostedEvalEntitlement.id, {
      used: 1
    });
    await repository.entitlements.update(reportExportEntitlement.id, {
      used: reportExportEntitlement.limit
    });
    const blockedExport = await app.request(`/reports/${DEMO_IDS.report}/export?format=json`);
    expect(blockedExport.status).toBe(403);
  });

  test("POST /reports includes no-test blocker when quality contract has no cases", async () => {
    const repository = createAdminTestRepository();
    const app = createApp({ repository });
    const promptResponse = await expectOkJson(
      await app.request(
        "/prompts",
        jsonRequest({
          workspace_id: DEMO_IDS.workspace,
          name: "No-test report project",
          task_type: "support",
          provider: "openai",
          model_id: "openai-demo-balanced",
          prompt_text: "Route {{message}} to the right team.",
          variables: ["message"]
        })
      )
    );
    const contractResponse = await expectOkJson(
      await app.request(`/projects/${promptResponse.project.id}/quality-contract`)
    );
    const savedContract = await expectOkJson(
      await app.request(
        `/projects/${promptResponse.project.id}/quality-contract`,
        jsonRequest({
          task: contractResponse.contract.task,
          required_output: contractResponse.contract.required_output,
          must_preserve: contractResponse.contract.must_preserve,
          forbidden_behavior: contractResponse.contract.forbidden_behavior,
          pass_threshold: contractResponse.contract.pass_threshold,
          must_pass_check_ids: contractResponse.contract.must_pass_check_ids,
          check_definitions: contractResponse.contract.check_definitions,
          notes: contractResponse.contract.notes
        })
      )
    );
    const evalRun = await expectOkJson(
      await app.request(
        "/eval-runs",
        jsonRequest({
          project_id: promptResponse.project.id,
          quality_contract_id: savedContract.contract.id,
          baseline_prompt_version_id: promptResponse.version.id,
          candidate_ids: [],
          model_registry_record_ids: [],
          pass_threshold: savedContract.contract.pass_threshold
        })
      )
    );
    expect(evalRun.status).toBe("failed");

    const report = await expectOkJson(
      await app.request(
        "/reports",
        jsonRequest({
          project_id: promptResponse.project.id,
          eval_run_id: evalRun.id
        })
      )
    );

    expect(report.production_recommendation_allowed).toBe(false);
    expect(report.production_blockers.join(" ")).toContain("No test cases");
  });

  test("implements the public route map with seed or mock data", async () => {
    const app = createTestApp();

    const models = await expectOkJson(await app.request("/models?provider=openai"));
    expect(models.models.map((model: { model_id: string }) => model.model_id)).toEqual([
      "openai-demo-frontier",
      "openai-demo-balanced",
      "openai-demo-economy"
    ]);

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
    expect(optimize.candidates.map((candidate: { label: string }) => candidate.label)).toEqual([
      "Baseline",
      "Balanced"
    ]);
    expect(optimize.candidates[1].candidate_prompt_text).toContain("Urgency labels");
    expect(optimize.candidates[1].estimated_input_tokens).toBeGreaterThan(0);
    expect(optimize.candidates[1].estimated_output_tokens).toBeGreaterThan(0);
    expect(optimize.candidates[1].preserved_constraints.join(" ")).toContain("Must-pass check");
    expect(optimize.candidates[1].removed_or_compressed_elements.length).toBeGreaterThan(0);

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
    expect(evalRun.status).toBe("complete");

    const evalDetail = await expectOkJson(await app.request(`/eval-runs/${evalRun.id}`));
    expect(evalDetail.eval_run.id).toBe(evalRun.id);
    expect(evalDetail.results.length).toBeGreaterThan(0);
    expect(evalDetail.frontier_points.length).toBe(evalDetail.results.length);
    expect(evalDetail.status_note).toContain("Mock eval runner completed");

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
  test("issues stored admin sessions and rotates them after MFA", async () => {
    const repository = createAdminTestRepository();
    const app = createApp({ repository });

    const login = await expectOkJson(
      await app.request(
        "/admin-api/auth/login",
        jsonRequest({
          email: "ops@acme-ai.example",
          password: "promptopts-admin-dev"
        })
      )
    );
    expect(login.session.mfa_required).toBe(true);
    expect(login.session.mfa_verified).toBe(false);
    expect(login.token).toMatch(/^pa_/);

    const preMfaOverview = await app.request("/admin-api/overview", {
      headers: {
        authorization: `Bearer ${login.token}`
      }
    });
    expect(preMfaOverview.status).toBe(403);

    const mfa = await expectOkJson(
      await app.request("/admin-api/auth/mfa/verify", {
        method: "POST",
        headers: {
          authorization: `Bearer ${login.token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          code: createTotpCode("JBSWY3DPEHPK3PXP")
        })
      })
    );
    expect(mfa.session.mfa_required).toBe(false);
    expect(mfa.session.mfa_verified).toBe(true);
    expect(mfa.token).not.toBe(login.token);

    const overview = await app.request("/admin-api/overview", {
      headers: {
        authorization: `Bearer ${mfa.token}`
      }
    });
    expect(overview.status).toBe(200);

    const revokedOldSession = await app.request("/admin-api/auth/me", {
      headers: {
        authorization: `Bearer ${login.token}`
      }
    });
    expect(revokedOldSession.status).toBe(401);
  });

  test("mock admin headers do not bypass stored session auth", async () => {
    const app = createTestApp();
    const response = await app.request("/admin-api/overview", {
      headers: {
        "x-admin-session-id": "admin_session_mock",
        "x-admin-user-id": "admin_user_mock",
        "x-admin-role": "owner",
        "x-admin-mfa": "true",
        "x-admin-action-scopes": "read_metadata,manage_workspace"
      }
    });

    expect(response.status).toBe(401);
  });

  test("starts, reports, and ends sudo with MFA recheck and audit events", async () => {
    const repository = createAdminTestRepository();
    const app = createApp({ repository });
    const before = await repository.admin_audit_logs.list();

    const missingReason = await app.request(
      "/admin-api/sudo/start",
      adminJsonRequest({
        action_scope: "issue_billing_credit",
        reason_code: "",
        mfa_code: createTotpCode("JBSWY3DPEHPK3PXP")
      })
    );
    expect(missingReason.status).toBe(400);

    const started = await expectOkJson(
      await app.request(
        "/admin-api/sudo/start",
        adminJsonRequest({
          action_scope: "issue_billing_credit",
          reason_code: "billing_credit_test",
          mfa_code: createTotpCode("JBSWY3DPEHPK3PXP"),
          target_type: "billing",
          target_id: DEMO_IDS.workspace
        })
      )
    );
    expect(started.sudo_request.status).toBe("active");
    expect(started.sudo_request.reason_code).toBe("billing_credit_test");
    expect(started.status.active).toHaveLength(1);

    const credit = await expectOkJson(
      await app.request(
        `/admin-api/billing/${DEMO_IDS.workspace}/credit`,
        adminJsonRequest({
          feature: "report_exports",
          quantity: 1,
          reason_code: "billing_credit_test"
        })
      )
    );
    expect(credit.credit.sudo_request_id).toBe(started.sudo_request.id);

    const status = await expectOkJson(
      await app.request("/admin-api/sudo/status", adminGetRequest())
    );
    expect(status.active[0].id).toBe(started.sudo_request.id);

    const ended = await expectOkJson(
      await app.request(
        "/admin-api/sudo/end",
        adminJsonRequest({
          action_scope: "issue_billing_credit",
          reason_code: "operator_done"
        })
      )
    );
    expect(ended.revoked[0].status).toBe("revoked");
    expect(ended.status.active).toHaveLength(0);

    const afterEndCredit = await app.request(
      `/admin-api/billing/${DEMO_IDS.workspace}/credit`,
      adminJsonRequest({
        feature: "report_exports",
        quantity: 1,
        reason_code: "billing_credit_after_end"
      })
    );
    expect(afterEndCredit.status).toBe(403);

    const after = await repository.admin_audit_logs.list();
    const actions = after.slice(before.length).map((log) => log.action);
    expect(actions).toContain("sudo_start");
    expect(actions).toContain("sudo_required_action_allowed");
    expect(actions).toContain("sudo_end");
    expect(actions).toContain("sudo_required_action_denied");
  });

  test("rejects expired and wrong-action sudo grants with audit events", async () => {
    const repository = createAdminTestRepository();
    const app = createApp({ repository });
    const timestamp = "2026-06-06T12:00:00.000Z";
    await repository.sudo_requests.create({
      id: "sudo_request_test_expired_delete",
      admin_user_id: "admin_user_test_owner",
      role: "owner",
      requested_action: "delete_report",
      target_type: "reports",
      target_id: DEMO_IDS.report,
      action_scope: "delete_report",
      reason_code: "expired_delete_test",
      status: "active",
      approved_by_admin_user_id: "admin_user_test_owner",
      approved_at: timestamp,
      activated_at: timestamp,
      revoked_at: null,
      expires_at: "2026-06-06T12:01:00.000Z",
      ip_address: "127.0.0.1",
      user_agent: "PromptOpts admin route test",
      created_at: timestamp
    });
    const beforeExpired = await repository.admin_audit_logs.list();

    const expiredDelete = await app.request(
      `/admin-api/reports/${DEMO_IDS.report}/delete`,
      adminJsonRequest({
        reason_code: "expired_delete_test",
        sudo_request_id: "sudo_request_test_expired_delete"
      })
    );
    expect(expiredDelete.status).toBe(403);
    expect((await repository.sudo_requests.get("sudo_request_test_expired_delete"))?.status).toBe("expired");
    expect((await repository.admin_audit_logs.list()).slice(beforeExpired.length).map((log) => log.action)).toContain(
      "sudo_expired_rejection"
    );

    const started = await expectOkJson(
      await app.request(
        "/admin-api/sudo/start",
        adminJsonRequest({
          action_scope: "reveal_report",
          reason_code: "raw_report_review",
          mfa_code: createTotpCode("JBSWY3DPEHPK3PXP"),
          target_type: "reports",
          target_id: DEMO_IDS.report
        })
      )
    );
    expect(started.sudo_request.requested_action).toBe("reveal_report");

    const wrongActionDelete = await app.request(
      `/admin-api/reports/${DEMO_IDS.report}/delete`,
      adminJsonRequest({
        reason_code: "wrong_action_delete",
        sudo_request_id: started.sudo_request.id
      })
    );
    expect(wrongActionDelete.status).toBe(403);
    expect((await repository.admin_audit_logs.list()).map((log) => log.action)).toContain(
      "sudo_required_action_denied"
    );
  });

  test("GET /admin-api/overview returns redacted command-center metadata and writes audit", async () => {
    const repository = createAdminTestRepository();
    const app = createApp({ repository });
    const before = await repository.admin_audit_logs.list();
    const overview = adminOverviewResponseSchema.parse(
      await expectOkJson(await app.request("/admin-api/overview", adminGetRequest()))
    );
    const after = await repository.admin_audit_logs.list();
    const serialized = JSON.stringify(overview);

    expect(overview.kpis.free_audits).toBe(1);
    expect(overview.kpis.eval_jobs.queued).toBe(1);
    expect(overview.kpis.unverified_models).toBeGreaterThan(0);
    expect(overview.health.api).toBe("ok");
    expect(overview.health.queue).toBe("mocked");
    expect(overview.risk_queue.map((risk) => risk.label)).toEqual([
      "Stale model prices",
      "Failed report exports",
      "Secret-scan warnings",
      "Deletion requests"
    ]);
    expect(overview.live_activity.length).toBeGreaterThan(0);
    expect(serialized).not.toContain("Classify the inbound support message");
    expect(serialized).not.toContain("{{customer_message}}");
    expect(serialized).not.toContain("prompt_text");
    expect(after.length).toBe(before.length + 1);
    expect(after.at(-1)?.target_type).toBe("overview");
  });

  test("implements the admin route map behind placeholder admin middleware", async () => {
    const app = createTestApp();

    await expectOkJson(await app.request("/admin-api/overview", adminGetRequest()));
    const accounts = await expectOkJson(await app.request("/admin-api/accounts", adminGetRequest()));
    expect(accounts.stages).toEqual([
      "new_audit",
      "qualified",
      "eval_ready",
      "trial",
      "paid",
      "needs_review"
    ]);
    expect(accounts.accounts[0]).toMatchObject({
      account: "Acme AI",
      provider: "openai",
      fit_signal: "overpowered",
      stage: "new_audit"
    });

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
    const accountDetail = await expectOkJson(
      await app.request(`/admin-api/accounts/${DEMO_IDS.account}`, adminGetRequest())
    );
    expect(accountDetail.header.provider).toBe("openai");
    expect(accountDetail.workspace_health.projects).toBe(1);
    expect(accountDetail.projects[0].redacted_prompt_preview).toContain("Classifies");
    expect(accountDetail.reports[0].redacted_summary).toContain("Report metadata");
    expect(accountDetail.billing.placeholder).toContain("Billing tab is placeholder-only");
    expect(accountDetail.support_timeline.map((event: { type: string }) => event.type)).toContain("task");
    expect(accountDetail.redacted_previews[0].redacted_preview).not.toContain("{{customer_message}}");

    const noteResponse = await expectOkJson(
      await app.request(
        `/admin-api/accounts/${DEMO_IDS.account}/notes`,
        adminJsonRequest({
          body: "Manual note without raw prompt content.",
          opportunity_id: DEMO_IDS.opportunity
        })
      )
    );
    expect(noteResponse.note.body_redacted).toContain("Admin note redacted");

    const taskResponse = await expectOkJson(
      await app.request(
        `/admin-api/accounts/${DEMO_IDS.account}/tasks`,
        adminJsonRequest({
          title: "Schedule eval-readiness follow-up",
          opportunity_id: DEMO_IDS.opportunity,
          assignee_admin_user_id: "admin_user_mock"
        })
      )
    );
    expect(taskResponse.task.status).toBe("open");

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

    const evalJobs = adminEvalRunsResponseSchema.parse(
      await expectOkJson(await app.request("/admin-api/eval-runs", adminGetRequest()))
    );
    expect(evalJobs.queue_summary.queued).toBe(1);
    expect(evalJobs.queue_summary.rate_limited).toBe(0);
    expect(evalJobs.worker_health.map((item) => item.component)).toEqual([
      "eval-runner",
      "provider-adapter",
      "scoring",
      "report-generator"
    ]);
    expect(evalJobs.jobs[0]).toMatchObject({
      id: DEMO_IDS.evalRun,
      workspace: "Acme AI Ops",
      provider: "openai",
      action: "cancel",
      redaction_state: "redacted"
    });

    const evalJobDetail = adminEvalRunDetailResponseSchema.parse(
      await expectOkJson(
        await app.request(`/admin-api/eval-runs/${DEMO_IDS.evalRun}`, adminGetRequest())
      )
    );
    expect(evalJobDetail.sanitized_payload.candidate_ids).toHaveLength(2);
    expect(evalJobDetail.model_ids).toEqual(["openai-demo-balanced"]);
    expect(evalJobDetail.test_count).toBe(5);
    expect(JSON.stringify(evalJobDetail)).not.toContain("{{customer_message}}");

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

    const registry = adminModelRegistryResponseSchema.parse(
      await expectOkJson(await app.request("/admin-api/models", adminGetRequest()))
    );
    expect(registry.freshness_summary.unverified).toBeGreaterThan(0);
    const firstProposal = registry.proposed_changes.at(0);
    expect(firstProposal).toBeDefined();
    expect(firstProposal?.approval_actions.approve_enabled).toBe(true);
    expect(firstProposal?.diff.length).toBeGreaterThan(0);

    const patchedModel = modelPatchResponseSchema.parse(
      await expectOkJson(
        await app.request(
          "/admin-api/models/model_registry_openai_demo_balanced",
          adminPatchJsonRequest(
            {
              display_name: "OpenAI Demo Balanced Internal",
              source_url: "https://example.com/verified"
            },
            { sudo_grant: { reason_code: "registry_edit" } }
          )
        )
      )
    );
    expect(patchedModel.model.display_name).toBe("OpenAI Demo Balanced");
    expect(patchedModel.proposal.approval_state).toBe("pending_review");
    expect(patchedModel.diff.map((entry) => entry.field)).toContain("display_name");

    const approvedModel = modelApproveResponseSchema.parse(
      await expectOkJson(
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
      )
    );
    expect(approvedModel.model.display_name).toBe("OpenAI Demo Balanced Internal");
    expect(approvedModel.model.freshness_status).toBe("fresh");
    expect(approvedModel.approved_version.approval_state).toBe("approved");

    const reportsVault = adminReportsResponseSchema.parse(
      await expectOkJson(await app.request("/admin-api/reports", adminGetRequest()))
    );
    expect(reportsVault.summary.failed_export).toBeGreaterThan(0);
    expect(reportsVault.summary.raw_locked).toBeGreaterThan(0);
    expect(reportsVault.reports.map((report: { action: string }) => report.action)).toContain("request_sudo_for_raw");

    const reportReveal = await expectOkJson(
      await app.request(
        `/admin-api/reports/${DEMO_IDS.report}/reveal`,
        adminGetRequest({ sudo_grant: { reason_code: "raw_report_reveal_test" } })
      )
    );
    expect(reportReveal.raw_report).toBeNull();

    const retriedExport = reportExportActionResponseSchema.parse(
      await expectOkJson(
        await app.request(
          `/admin-api/reports/${DEMO_IDS.report}/retry-export`,
          adminJsonRequest({ reason_code: "retry_failed_export" })
        )
      )
    );
    expect(retriedExport.redaction_state).toBe("redacted");

    const regeneratedExport = reportExportActionResponseSchema.parse(
      await expectOkJson(
        await app.request(
          `/admin-api/reports/${DEMO_IDS.report}/regenerate`,
          adminJsonRequest({ reason_code: "regenerate_redacted_exports" })
        )
      )
    );
    expect(regeneratedExport.todo).toContain("evals were not rerun");

    const deleteResponse = reportDeleteResponseSchema.parse(
      await expectOkJson(
        await app.request(
          `/admin-api/reports/${DEMO_IDS.report}/delete`,
          adminJsonRequest(
            {
              reason_code: "customer_request"
            },
            { sudo_grant: { reason_code: "customer_request" } }
          )
        )
      )
    );
    expect(deleteResponse.deletion_queued).toBe(true);
    expect(deleteResponse.deletion_status).toBe("deleted");
    expect(deleteResponse.scoped_records_marked).toContain("report_artifacts.storage_uri");

    const billing = billingResponseSchema.parse(
      await expectOkJson(await app.request("/admin-api/billing", adminGetRequest()))
    );
    expect(billing.plan?.name).toBe("Demo Growth");
    expect(billing.entitlement_checks.map((check) => check.feature)).toContain("hosted_eval_runs");
    expect(billing.entitlement_checks.map((check) => check.feature)).toContain("pdf_export");
    expect(billing.invoices).toHaveLength(1);
    expect(billing.credits).toHaveLength(1);
    expect(billing.feature_flags.map((flag) => flag.key)).toContain("cli_beta");

    const credit = billingCreditResponseSchema.parse(
      await expectOkJson(
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
      )
    );
    expect(credit.ledger_entry.direction).toBe("credit");
    expect(credit.credit.reason_code).toBe("manual_adjustment");
    expect(credit.billing_event.event_type).toBe("credit_issued");

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

  test("redacts Account 360 contact and prompt metadata for support role", async () => {
    const accountDetail = await expectOkJson(
      await createTestApp().request(
        `/admin-api/accounts/${DEMO_IDS.account}`,
        adminGetRequest({ role: "support" })
      )
    );
    const serialized = JSON.stringify(accountDetail);

    expect(serialized).not.toContain("ops@acme-ai.example");
    expect(serialized).not.toContain("Support classifier prompt with variables only.");
    expect(accountDetail.contacts[0].email).toContain("@promptopts.invalid");
    expect(accountDetail.account.redacted_prompt_preview).toContain("Prompt redacted");
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

    const missingScope = await app.request(
      "/admin-api/overview",
      adminGetRequest({ missingScope: true })
    );
    expect(missingScope.status).toBe(403);

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

    const noSudoRawReport = await app.request(
      `/admin-api/reports/${DEMO_IDS.report}/reveal`,
      adminGetRequest({ sudo_grant: null })
    );
    expect(noSudoRawReport.status).toBe(403);

    const sudoReveal = await app.request(
      `/admin-api/prompts/${DEMO_IDS.prompt}/reveal`,
      adminGetRequest({ sudo_grant: { reason_code: "prompt_reveal_test" } })
    );
    expect(sudoReveal.status).toBe(200);

    const supportCredit = await app.request(
      `/admin-api/billing/${DEMO_IDS.workspace}/credit`,
      adminJsonRequest(
        {
          feature: "report_exports",
          quantity: 1,
          reason_code: "support_credit_denied"
        },
        {
          role: "support",
          sudo_grant: { reason_code: "support_credit_denied" }
        }
      )
    );
    expect(supportCredit.status).toBe(403);
  });

  test("writes audit logs for mutations and sensitive reads", async () => {
    const repository = createAdminTestRepository();
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

  test("audits Account 360 sensitive reads and CRM mutations", async () => {
    const repository = createAdminTestRepository();
    const app = createApp({ repository });
    const before = await repository.admin_audit_logs.list();

    await app.request(`/admin-api/accounts/${DEMO_IDS.account}`, adminGetRequest());
    await app.request(
      `/admin-api/accounts/${DEMO_IDS.account}/notes`,
      adminJsonRequest({ body: "Follow up on eval readiness.", opportunity_id: DEMO_IDS.opportunity })
    );
    await app.request(
      `/admin-api/accounts/${DEMO_IDS.account}/tasks`,
      adminJsonRequest({ title: "Invite eval run", opportunity_id: DEMO_IDS.opportunity })
    );

    const after = await repository.admin_audit_logs.list();
    expect(after.length).toBe(before.length + 3);
    expect(after.slice(-3).map((log) => log.target_type)).toEqual([
      "accounts",
      "accounts",
      "accounts"
    ]);
  });

  test("returns sanitized eval job detail and audits retry/cancel actions", async () => {
    const repository = createAdminTestRepository();
    const app = createApp({ repository });
    const timestamp = "2026-01-16T12:00:00.000Z";
    await repository.eval_runs.update(DEMO_IDS.evalRun, {
      status: "failed",
      started_at: timestamp,
      completed_at: timestamp
    });
    await repository.eval_results.create({
      id: "eval_result_provider_error_demo",
      eval_run_id: DEMO_IDS.evalRun,
      candidate_id: "candidate_support_classifier_balanced",
      prompt_version_id: DEMO_IDS.promptVersion,
      model_registry_record_id: "model_registry_openai_demo_balanced",
      provider: "openai",
      model_id: "openai-demo-balanced",
      quality_score: 0,
      pass_rate: 0,
      must_pass_failures: 1,
      input_tokens: 22,
      output_tokens: 0,
      estimated_cost_usd: null,
      cost_estimate_status: "blocked",
      latency_ms: null,
      risk_level: "high",
      verdict: "blocked",
      failed_check_ids: ["provider_error_rate_limited_demo"],
      is_mock: true,
      created_at: timestamp
    });

    const before = await repository.admin_audit_logs.list();
    const detail = adminEvalRunDetailResponseSchema.parse(
      await expectOkJson(
        await app.request(`/admin-api/eval-runs/${DEMO_IDS.evalRun}`, adminGetRequest())
      )
    );
    expect(detail.failed_checks).toHaveLength(1);
    expect(detail.sanitized_provider_error).toContain("[redacted]");
    expect(JSON.stringify(detail)).not.toContain("sk-demo-secret");
    expect(JSON.stringify(detail)).not.toContain("Classify the inbound support message");

    await app.request(
      `/admin-api/eval-runs/${DEMO_IDS.evalRun}/retry`,
      adminJsonRequest({ reason_code: "retry_failed_provider_error" })
    );
    await app.request(
      `/admin-api/eval-runs/${DEMO_IDS.evalRun}/cancel`,
      adminJsonRequest({ reason_code: "cancel_stuck_job" })
    );

    const after = await repository.admin_audit_logs.list();
    expect(after.length).toBe(before.length + 3);
    expect(after.slice(-2).map((log) => log.target_type)).toEqual(["eval_runs", "eval_runs"]);
    expect(after.slice(-2).map((log) => log.action_scope)).toEqual(["retry_eval", "retry_eval"]);
  });

  test("audits reports vault and billing mutations plus raw report sensitive reads", async () => {
    const repository = createAdminTestRepository();
    const app = createApp({ repository });
    const before = await repository.admin_audit_logs.list();

    await app.request(
      `/admin-api/reports/${DEMO_IDS.report}/reveal`,
      adminGetRequest({ sudo_grant: { reason_code: "raw_report_reveal_test" } })
    );
    await app.request(
      `/admin-api/reports/${DEMO_IDS.report}/retry-export`,
      adminJsonRequest({ reason_code: "retry_failed_export" })
    );
    await app.request(
      `/admin-api/reports/${DEMO_IDS.report}/regenerate`,
      adminJsonRequest({ reason_code: "regenerate_export" })
    );
    await app.request(
      `/admin-api/reports/${DEMO_IDS.report}/delete`,
      adminJsonRequest(
        { reason_code: "customer_delete" },
        { sudo_grant: { reason_code: "customer_delete" } }
      )
    );
    await app.request(
      `/admin-api/billing/${DEMO_IDS.workspace}/credit`,
      adminJsonRequest(
        { feature: "report_exports", quantity: 1, reason_code: "billing_credit_test" },
        { sudo_grant: { reason_code: "billing_credit_test" } }
      )
    );

    const after = await repository.admin_audit_logs.list();
    const added = after.slice(before.length);
    expect(added).toHaveLength(8);
    expect(added.filter((log) => log.action === "sudo_required_action_allowed")).toHaveLength(3);
    expect(added.filter((log) => log.action !== "sudo_required_action_allowed").map((log) => log.target_type)).toEqual([
      "reports",
      "reports",
      "reports",
      "reports",
      "billing"
    ]);
    expect(added.filter((log) => log.action !== "sudo_required_action_allowed").map((log) => log.action_scope)).toEqual([
      "reveal_report",
      "retry_eval",
      "retry_eval",
      "delete_report",
      "issue_billing_credit"
    ]);
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
      { method: "POST", path: `/admin-api/accounts/${DEMO_IDS.account}/notes` },
      { method: "POST", path: `/admin-api/accounts/${DEMO_IDS.account}/tasks` },
      { method: "POST", path: `/admin-api/users/${DEMO_IDS.user}/revoke-sessions` },
      { method: "PATCH", path: `/admin-api/workspaces/${DEMO_IDS.workspace}` },
      { method: "POST", path: `/admin-api/eval-runs/${DEMO_IDS.evalRun}/retry` },
      { method: "POST", path: `/admin-api/eval-runs/${DEMO_IDS.evalRun}/cancel` },
      { method: "POST", path: `/admin-api/eval-runs/${DEMO_IDS.evalRun}/regenerate-report` },
      { method: "PATCH", path: "/admin-api/models/model_registry_openai_demo_balanced" },
      { method: "POST", path: "/admin-api/models/model_registry_openai_demo_balanced/approve" },
      { method: "POST", path: `/admin-api/reports/${DEMO_IDS.report}/retry-export` },
      { method: "POST", path: `/admin-api/reports/${DEMO_IDS.report}/regenerate` },
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

  test("requires a reason code for billing and entitlement workspace changes", async () => {
    const response = await createTestApp().request(
      `/admin-api/workspaces/${DEMO_IDS.workspace}`,
      adminPatchJsonRequest(
        {
          plan_id: DEMO_IDS.plan
        },
        { sudo_grant: { reason_code: "plan_change" } }
      )
    );

    expect(response.status).toBe(400);
  });

  test("requires verification metadata for model metadata edits", async () => {
    const response = await createTestApp().request(
      "/admin-api/models/model_registry_openai_demo_balanced",
      adminPatchJsonRequest(
        {
          input_price_per_million_tokens: 2,
          source_url: "https://example.com/verified"
        },
        { sudo_grant: { reason_code: "registry_validation" } }
      )
    );

    expect(response.status).toBe(400);
  });

  test("requires official source URL for any model registry change", async () => {
    const response = await createTestApp().request(
      "/admin-api/models/model_registry_openai_demo_balanced",
      adminPatchJsonRequest(
        {
          display_name: "Missing Source"
        },
        { sudo_grant: { reason_code: "registry_validation" } }
      )
    );

    expect(response.status).toBe(400);
  });
});
