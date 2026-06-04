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
      modelFit: "overpowered",
      wasteFindings: ["Instruction repeats the JSON shape twice."],
      riskLevel: "medium",
      compressionGuardrails: ["Preserve required JSON keys."],
      suggestedModels: ["openai-demo-balanced"],
      registryFreshness: "unverified",
      createdAt: timestamp
    });

    expect(request.provider).toBe(providerSchema.parse("openai"));
    expect(response.riskLevel).toBe("medium");
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
