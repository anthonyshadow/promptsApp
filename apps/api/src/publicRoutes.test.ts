import { describe, expect, test } from "bun:test";
import { runQueuedEvalRuns } from "@promptopts/eval-runner";
import { DEMO_IDS, healthResponseSchema } from "@promptopts/shared";
import { createTotpCode } from "@promptopts/admin-core";
import { createApp } from "./app";
import {
  adminEvalRunDetailResponseSchema,
  adminEvalRunsResponseSchema,
  adminModelRegistryResponseSchema,
  adminOverviewResponseSchema,
  adminProviderConnectionsResponseSchema,
  adminReportsResponseSchema,
  billingCreditResponseSchema,
  billingResponseSchema,
  modelApproveResponseSchema,
  modelPatchResponseSchema,
  reportDeleteResponseSchema,
  reportExportActionResponseSchema
} from "./contracts";
import {
  adminGetRequest,
  adminJsonRequest,
  adminPatchJsonRequest,
  createAdminTestRepository,
  createDeleteFailingStorage,
  createTestApp,
  expectOkJson,
  jsonRequest,
  patchJsonRequest
} from "./appTestHelpers";

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
    expect(imageModels.models.map((model: { model_id: string }) => model.model_id)).toEqual([
      "gpt-5.4",
      "gpt-5.4-mini",
      "gpt-5.4-nano"
    ]);

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

  test("provider connection routes encrypt keys, return metadata only, and audit lifecycle actions", async () => {
    const repository = createAdminTestRepository();
    const app = createApp({ repository });
    const rawKey = "sk-openai-test-provider-key-never-return";

    const created = await expectOkJson(
      await app.request(
        "/provider-connections",
        jsonRequest({
          workspace_id: DEMO_IDS.workspace,
          provider: "openai",
          api_key: rawKey,
          created_by: DEMO_IDS.user
        })
      )
    );
    const stored = await repository.provider_connections.get(created.connection.id);
    const listed = await expectOkJson(
      await app.request(`/provider-connections?workspace_id=${DEMO_IDS.workspace}`)
    );

    expect(created.connection.provider).toBe("openai");
    expect(JSON.stringify(created)).not.toContain(rawKey);
    expect(JSON.stringify(listed)).not.toContain(rawKey);
    expect(JSON.stringify(created)).not.toContain("encrypted_key_blob");
    expect(stored?.encrypted_key_blob).not.toContain(rawKey);
    expect(stored?.key_fingerprint).toBe(created.connection.key_fingerprint);

    const duplicate = await app.request(
      "/provider-connections",
      jsonRequest({
        workspace_id: DEMO_IDS.workspace,
        provider: "openai",
        api_key: "sk-duplicate",
        created_by: DEMO_IDS.user
      })
    );
    expect(duplicate.status).toBe(409);

    const rotated = await expectOkJson(
      await app.request(
        `/provider-connections/${created.connection.id}/rotate`,
        jsonRequest({
          api_key: "sk-openai-rotated-provider-key-never-return",
          rotated_by: DEMO_IDS.user,
          reason_code: "key_rotation_test"
        })
      )
    );
    expect(rotated.connection.rotated_at).not.toBeNull();
    expect(JSON.stringify(rotated)).not.toContain("sk-openai-rotated");

    const revoked = await expectOkJson(
      await app.request(
        `/provider-connections/${created.connection.id}/revoke`,
        jsonRequest({
          revoked_by: DEMO_IDS.user,
          reason_code: "key_revocation_test"
        })
      )
    );
    expect(revoked.connection.status).toBe("revoked");
    expect(revoked.connection.revoked_at).not.toBeNull();

    const reveal = await app.request(`/provider-connections/${created.connection.id}/reveal`);
    const auditActions = (await repository.admin_audit_logs.list()).map((log) => log.action);

    expect(reveal.status).toBe(404);
    expect(auditActions).toContain("provider_key_created");
    expect(auditActions).toContain("provider_key_rotated");
    expect(auditActions).toContain("provider_key_revoked");
  });

  test("admin provider connection metadata is redacted and audited", async () => {
    const repository = createAdminTestRepository();
    const app = createApp({ repository });
    const rawKey = "sk-anthropic-test-provider-key-never-return";
    const created = await expectOkJson(
      await app.request(
        "/provider-connections",
        jsonRequest({
          workspace_id: DEMO_IDS.workspace,
          provider: "anthropic",
          api_key: rawKey,
          created_by: DEMO_IDS.user
        })
      )
    );

    const rejected = await app.request("/admin-api/provider-connections");
    expect(rejected.status).toBe(401);

    const response = await app.request(
      "/admin-api/provider-connections",
      adminGetRequest()
    );
    const body = adminProviderConnectionsResponseSchema.parse(await expectOkJson(response));
    const auditLogs = await repository.admin_audit_logs.list();

    expect(body.connections.map((connection) => connection.id)).toContain(created.connection.id);
    expect(JSON.stringify(body)).not.toContain(rawKey);
    expect(JSON.stringify(body)).not.toContain("encrypted_key_blob");
    expect(body.redaction_note).toContain("metadata-only");
    expect(auditLogs.some((log) => log.target_type === "provider_connections")).toBe(true);
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

  test("POST and GET /eval-runs enqueue durable eval jobs and expose worker results", async () => {
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
    const queuedDetail = await expectOkJson(await app.request(`/eval-runs/${evalRun.id}`));

    expect(evalRun.status).toBe("queued");
    expect(await repository.eval_results.list()).toHaveLength(beforeResults.length);
    expect(queuedDetail.eval_run.id).toBe(evalRun.id);
    expect(queuedDetail.results).toHaveLength(0);
    expect(queuedDetail.queue.job.status).toBe("queued");
    expect(queuedDetail.retry_hints.join(" ")).toContain("poll for partial rows");

    const restartedApp = createApp({ repository });
    const afterRestartDetail = await expectOkJson(await restartedApp.request(`/eval-runs/${evalRun.id}`));
    expect(afterRestartDetail.queue.job.id).toBe(queuedDetail.queue.job.id);

    await runQueuedEvalRuns(repository, { maxRuns: 2, workerId: "api_route_test_worker" });

    const afterResults = await repository.eval_results.list();
    const detail = await expectOkJson(await restartedApp.request(`/eval-runs/${evalRun.id}`));

    expect(detail.eval_run.status).toBe("complete");
    expect(afterResults.length).toBeGreaterThan(beforeResults.length);
    expect(detail.queue.job.status).toBe("complete");
    expect(detail.queue.events.map((event: { status: string }) => event.status)).toContain("partial_result");
    expect(detail.queue.worker_heartbeats).toHaveLength(2);
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

  test("POST /eval-runs requires acknowledgement or blocks when provider-call inputs are sensitive", async () => {
    const repository = createAdminTestRepository();
    const app = createApp({ repository });
    const request = {
      project_id: DEMO_IDS.project,
      quality_contract_id: DEMO_IDS.qualityContract,
      baseline_prompt_version_id: DEMO_IDS.promptVersion,
      candidate_ids: ["candidate_support_classifier_balanced"],
      model_registry_record_ids: ["model_registry_openai_demo_balanced"],
      test_case_ids: ["test_case_support_classifier_billing"],
      pass_threshold: 0.95
    };

    await repository.prompt_versions.update(DEMO_IDS.promptVersion, {
      prompt_text: "Classify the message from buyer@example.com and return JSON."
    });
    const needsConfirmation = await app.request("/eval-runs", jsonRequest(request));
    const confirmationBody = await needsConfirmation.json();

    expect(needsConfirmation.status).toBe(403);
    expect(confirmationBody.error.code).toBe("provider_call_confirmation_required");
    expect(JSON.stringify(confirmationBody)).not.toContain("buyer@example.com");

    const acknowledged = await expectOkJson(
      await app.request(
        "/eval-runs",
        jsonRequest({
          ...request,
          provider_call_acknowledged: true
        })
      )
    );
    expect(acknowledged.status).toBe("queued");

    await repository.prompt_versions.update(DEMO_IDS.promptVersion, {
      prompt_text: "Classify the message. Secret key sk-test-secret-value-12345678901234567890."
    });
    const blockedSecret = await app.request(
      "/eval-runs",
      jsonRequest({
        ...request,
        provider_call_acknowledged: true
      })
    );
    const blockedBody = await blockedSecret.json();

    expect(blockedSecret.status).toBe(403);
    expect(blockedBody.error.code).toBe("provider_call_blocked_sensitive_content");
    expect(JSON.stringify(blockedBody)).not.toContain("sk-test-secret-value");
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
    expect(evalRun.status).toBe("queued");
    await runQueuedEvalRuns(repository, { maxRuns: 10, workerId: "no_test_report_worker" });
    const failedEvalRun = await repository.eval_runs.get(evalRun.id);
    expect(failedEvalRun?.status).toBe("failed");

    const report = await expectOkJson(
      await app.request(
        "/reports",
        jsonRequest({
          project_id: promptResponse.project.id,
          eval_run_id: failedEvalRun?.id ?? evalRun.id
        })
      )
    );

    expect(report.production_recommendation_allowed).toBe(false);
    expect(report.winner_result_id).toBeNull();
    expect(report.production_blockers.join(" ")).toContain("No test cases");
  });

  test("implements the public route map with seed or mock data", async () => {
    const repository = createAdminTestRepository();
    const app = createApp({ repository });

    const models = await expectOkJson(await app.request("/models?provider=openai"));
    expect(models.models.map((model: { model_id: string }) => model.model_id)).toEqual([
      "openai-demo-frontier",
      "openai-demo-balanced",
      "openai-demo-economy",
      "gpt-5.4",
      "gpt-5.4-mini",
      "gpt-5.4-nano"
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
    expect(evalRun.status).toBe("queued");
    await runQueuedEvalRuns(repository, { maxRuns: 10, workerId: "route_map_worker" });

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
    expect(report.production_recommendation_allowed).toBe(true);
    expect(report.winner_result_id).not.toBeNull();

    const exportResponse = await expectOkJson(
      await app.request(`/reports/${DEMO_IDS.report}/export?format=json`)
    );
    expect(exportResponse.export_package.redaction_state).toBe("redacted");
  });
});
