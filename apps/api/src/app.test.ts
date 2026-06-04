import { describe, expect, test } from "bun:test";
import {
  DEMO_IDS,
  createDemoRepositorySeed,
  createMemoryRepository,
  healthResponseSchema
} from "@promptopts/shared";
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

    await expectOkJson(await app.request("/admin-api/overview"));
    await expectOkJson(await app.request("/admin-api/accounts"));

    const account = await expectOkJson(
      await app.request(
        "/admin-api/accounts",
        jsonRequest({
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

    await expectOkJson(await app.request(`/admin-api/accounts/${DEMO_IDS.account}`));
    const patchedAccount = await expectOkJson(
      await app.request(
        `/admin-api/accounts/${DEMO_IDS.account}`,
        patchJsonRequest({
          stage: "trial"
        })
      )
    );
    expect(patchedAccount.stage).toBe("trial");

    await expectOkJson(await app.request("/admin-api/users"));
    const revoke = await expectOkJson(
      await app.request(
        `/admin-api/users/${DEMO_IDS.user}/revoke-sessions`,
        jsonRequest({ reason_code: "support_request" })
      )
    );
    expect(revoke.revoked_sessions).toBe(0);

    const workspace = await expectOkJson(
      await app.request(
        `/admin-api/workspaces/${DEMO_IDS.workspace}`,
        patchJsonRequest({ name: "Acme AI Ops" })
      )
    );
    expect(workspace.name).toBe("Acme AI Ops");

    await expectOkJson(await app.request("/admin-api/eval-runs"));
    await expectOkJson(await app.request(`/admin-api/eval-runs/${DEMO_IDS.evalRun}`));

    const retried = await expectOkJson(
      await app.request(
        `/admin-api/eval-runs/${DEMO_IDS.evalRun}/retry`,
        jsonRequest({ reason_code: "operator_retry" })
      )
    );
    expect(retried.eval_run.status).toBe("retrying");

    const cancelled = await expectOkJson(
      await app.request(
        `/admin-api/eval-runs/${DEMO_IDS.evalRun}/cancel`,
        jsonRequest({ reason_code: "operator_cancel" })
      )
    );
    expect(cancelled.eval_run.status).toBe("failed");

    const regenerated = await expectOkJson(
      await app.request(
        `/admin-api/eval-runs/${DEMO_IDS.evalRun}/regenerate-report`,
        jsonRequest({ reason_code: "operator_regenerate" })
      )
    );
    expect(regenerated.report.production_recommendation_allowed).toBe(false);

    await expectOkJson(await app.request("/admin-api/models"));
    const patchedModel = await expectOkJson(
      await app.request(
        "/admin-api/models/model_registry_openai_demo_balanced",
        patchJsonRequest({
          display_name: "OpenAI Demo Balanced Internal"
        })
      )
    );
    expect(patchedModel.display_name).toBe("OpenAI Demo Balanced Internal");

    const approvedModel = await expectOkJson(
      await app.request(
        "/admin-api/models/model_registry_openai_demo_balanced/approve",
        jsonRequest({
          verified_by: "admin_user_mock",
          source_url: "https://example.com/verified",
          last_verified_at: "2026-01-16T12:00:00.000Z",
          reason_code: "registry_review"
        })
      )
    );
    expect(approvedModel.freshness_status).toBe("fresh");

    await expectOkJson(await app.request("/admin-api/reports"));
    const deleteResponse = await expectOkJson(
      await app.request(
        `/admin-api/reports/${DEMO_IDS.report}/delete`,
        jsonRequest({
          reason_code: "customer_request",
          sudo_request_id: "sudo_request_mock"
        })
      )
    );
    expect(deleteResponse.deletion_queued).toBe(true);

    await expectOkJson(await app.request("/admin-api/billing"));
    const credit = await expectOkJson(
      await app.request(
        `/admin-api/billing/${DEMO_IDS.workspace}/credit`,
        jsonRequest({
          feature: "free_audits",
          quantity: 1,
          reason_code: "manual_adjustment"
        })
      )
    );
    expect(credit.ledger_entry.direction).toBe("credit");

    const auditLogs = await expectOkJson(await app.request("/admin-api/audit-logs"));
    expect(auditLogs.audit_logs.length).toBeGreaterThan(1);
  });

  test("does not expose raw prompt content in admin account responses", async () => {
    const accountDetail = await expectOkJson(
      await createTestApp().request(`/admin-api/accounts/${DEMO_IDS.account}`)
    );

    expect(JSON.stringify(accountDetail)).not.toContain("Classify the inbound support message");
    expect(accountDetail.account.redacted_prompt_preview).toContain("Support classifier");
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
        route.method === "PATCH" ? patchJsonRequest({}) : jsonRequest({})
      );
      expect(response.status).toBe(400);
    }
  });

  test("requires verification metadata for model metadata edits", async () => {
    const response = await createTestApp().request(
      "/admin-api/models/model_registry_openai_demo_balanced",
      patchJsonRequest({
        input_price_per_million_tokens: 2
      })
    );

    expect(response.status).toBe(400);
  });
});
