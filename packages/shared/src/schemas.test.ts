import { describe, expect, test } from "bun:test";
import {
  adminActionContextSchema,
  auditRequestSchema,
  auditResponseSchema,
  createDemoRepositorySeed,
  providerSchema
} from "./index";

const timestamp = "2026-01-15T12:00:00.000Z";

describe("shared domain schemas", () => {
  test("parse canonical public audit payloads", () => {
    const request = auditRequestSchema.parse({
      provider: "openai",
      modelId: "openai-demo-balanced",
      prompt: "Classify {{customer_message}} into support labels.",
      taskType: "support",
      monthlyCalls: 10000,
      priority: "balanced",
      source: "free_audit",
      contactEmail: "ops@example.com",
      company: "Example AI",
      ctaClicked: "get_audit_report",
      constraints: {
        requiresJson: true,
        usesTools: false,
        usesImages: false,
        needsStructuredOutput: true,
        maxLatencyMs: null,
        minContextWindow: null
      }
    });

    const response = auditResponseSchema.parse({
      id: "audit_response_demo",
      inputTokens: 42,
      estimatedOutputTokens: 80,
      monthlyCostEstimate: {
        estimatedMonthlyCostUsd: 4.2,
        inputCostUsd: 1.2,
        outputCostUsd: 3,
        estimateStatus: "unverified",
        unverified: true,
        registryFreshness: "unverified",
        metadataWarnings: ["Registry row is demo/mock metadata."],
        pricingNote: "Demo placeholder pricing only."
      },
      modelFit: "overpowered",
      modelFitReasons: ["frontier_model_for_bounded_task"],
      wasteFindings: ["Instruction repeats the JSON shape twice."],
      riskLevel: "medium",
      sensitiveFindings: [],
      compressionGuardrails: ["Preserve required JSON keys."],
      suggestedModels: ["openai-demo-balanced"],
      suggestedModelRoles: [
        {
          role: "baseline",
          modelId: "openai-demo-frontier",
          registryRecordId: "model_registry_openai_frontier",
          reason: "Current prompt and model remain the regression baseline."
        }
      ],
      suggestedNextAction: "Define the success contract before generating candidates.",
      registryFreshness: "unverified",
      freeAudit: {
        id: "free_audit_response_demo",
        accountId: "account_example_ai",
        contactId: "contact_example_ops",
        opportunityId: "opportunity_example_ai",
        ctaClicked: "get_audit_report",
        redactedPromptPreview: "Prompt redacted (48 chars)",
        shareableSummary: "Redacted free audit summary. Run evals before switching."
      },
      createdAt: timestamp
    });

    expect(request.provider).toBe(providerSchema.parse("openai"));
    expect(request.source).toBe("free_audit");
    expect(response.riskLevel).toBe("medium");
    expect(response.freeAudit?.shareableSummary).toContain("Run evals");
  });

  test("parse admin action context with explicit scope and redaction state", () => {
    const context = adminActionContextSchema.parse({
      admin_user_id: "admin_user_demo",
      session_id: "admin_session_demo",
      workspace_id: "workspace_acme_ai",
      account_id: "account_acme_ai",
      action_scope: "manage_model_registry",
      reason_code: "demo_review",
      sudo_request_id: null,
      ip_address: "127.0.0.1",
      user_agent: "PromptOpts test",
      redaction_state: "redacted"
    });

    expect(context.action_scope).toBe("manage_model_registry");
    expect(context.redaction_state).toBe("redacted");
  });

  test("demo seed is synthetic and keeps model metadata unverified", () => {
    const seed = createDemoRepositorySeed();

    expect(seed.workspaces[0]?.name).toBe("Acme AI");
    expect(seed.projects[0]?.name).toBe("Support classifier");
    expect(seed.accounts[0]?.stage).toBe("new_audit");
    expect(seed.plans[0]?.name).toBe("Demo Growth");
    const entitlementFeatures = seed.entitlements.map((entitlement) => entitlement.feature);
    const expectedEntitlementFeatures = [
      "hosted_eval_runs",
      "prompt_history",
      "report_exports",
      "csv_upload",
      "byok",
      "pdf_export",
      "seats",
      "cli_beta"
    ] as const;

    for (const feature of expectedEntitlementFeatures) {
      expect(entitlementFeatures).toContain(feature);
    }
    expect(seed.invoices[0]?.status).toBe("open");
    expect(seed.credits[0]?.reason_code).toBe("demo_seed");
    expect(seed.feature_flags[0]?.key).toBe("cli_beta");
    expect(seed.model_registry_versions[0]?.approval_state).toBe("pending_review");
    expect(seed.model_registry_versions[0]?.source_url).toContain("https://");
    expect(seed.model_registry_versions[0]?.verified_by).toBe("admin_user_demo");
    expect(seed.crm_notes[0]?.body_redacted).toContain("prompt details remain redacted");
    expect(seed.tasks[0]?.title).toContain("run evals");
    expect(seed.test_cases).toHaveLength(5);
    expect(seed.reports[0]?.production_recommendation_allowed).toBe(false);

    for (const model of seed.model_registry) {
      expect(model.is_mock).toBe(true);
      expect(model.stability_status).toBe("unverified");
      expect(model.freshness_status).toBe("unverified");
      expect(model.last_verified_at).toBeNull();
      expect(model.pricing_note).toContain("Demo placeholder");
    }
  });
});
