import { describe, expect, test } from "bun:test";
import type { ModelRegistryRecord } from "@promptopts/shared";
import {
  classifyModelFit,
  detectSensitiveContent,
  estimateMonthlyCost,
  parsePrompt,
  runPromptModelAudit
} from ".";

const timestamp = "2026-01-15T12:00:00.000Z";

describe("prompt parser", () => {
  test("detects variables, repeated instructions, constraints, output requirements, and likely task", () => {
    const result = parsePrompt(
      "Classify the support ticket {{ticket_text}}. Return JSON with category. Return JSON only. Preserve urgency labels."
    );

    expect(result.detectedVariables).toEqual(["ticket_text"]);
    expect(result.repeatedInstructionFindings).toContain("Return JSON appears multiple times. (2x)");
    expect(result.constraintsDetected).toContain("json_output");
    expect(result.outputRequirements).toContain("json");
    expect(result.likelyTaskType).toBe("support");
    expect(result.approximateInputTokens).toBeGreaterThan(0);
    expect(result.approximateOutputEstimate).toBeGreaterThan(0);
  });
});

describe("secret and sensitive content scanner", () => {
  test("flags likely API keys, credentials, PII, and proprietary policy text", () => {
    const findings = detectSensitiveContent(
      "Use sk-1234567890abcdefghijklmnop for testing. password=supersecret. Email ops@example.com. Internal policy: do not share."
    );

    expect(findings.map((finding) => finding.type)).toContain("api_key");
    expect(findings.map((finding) => finding.type)).toContain("credential");
    expect(findings.map((finding) => finding.type)).toContain("pii");
    expect(findings.map((finding) => finding.type)).toContain("proprietary_policy");
    expect(findings.some((finding) => finding.severity === "critical")).toBe(true);
  });
});

describe("monthly cost estimator", () => {
  test("uses registry metadata and marks stale or demo pricing as unverified", () => {
    const estimate = estimateMonthlyCost({
      inputTokens: 100,
      outputTokens: 200,
      monthlyCalls: 10_000,
      modelRegistryRecord: createRegistryRecord({
        freshness_status: "stale",
        is_mock: true,
        last_verified_at: null
      })
    });

    expect(estimate.estimatedMonthlyCostUsd).toBe(9);
    expect(estimate.estimateStatus).toBe("unverified");
    expect(estimate.unverified).toBe(true);
    expect(estimate.metadataWarnings.length).toBeGreaterThan(0);
  });

  test("blocks cost estimates when the model is absent from the registry", () => {
    const estimate = estimateMonthlyCost({
      inputTokens: 100,
      outputTokens: 200,
      monthlyCalls: 10_000,
      modelRegistryRecord: null
    });

    expect(estimate.estimatedMonthlyCostUsd).toBeNull();
    expect(estimate.estimateStatus).toBe("blocked");
  });
});

describe("model fit classifier", () => {
  test("labels frontier models overpowered for bounded support classification", () => {
    const promptAnalysis = parsePrompt("Classify {{ticket_text}}. Return JSON with urgency.");
    const fit = classifyModelFit({
      provider: "openai",
      modelId: "frontier",
      modelRegistryRecord: createRegistryRecord({ quality_tier: "frontier" }),
      taskType: "support",
      priority: "balanced",
      constraints: createConstraints(),
      promptAnalysis
    });

    expect(fit.fit).toBe("overpowered");
    expect(fit.reasonCodes).toContain("frontier_model_for_bounded_task");
  });

  test("labels economy models underpowered for high-risk coding work", () => {
    const promptAnalysis = parsePrompt("Write TypeScript code for {{requirements}} and debug failures.");
    const fit = classifyModelFit({
      provider: "openai",
      modelId: "economy",
      modelRegistryRecord: createRegistryRecord({ quality_tier: "economy" }),
      taskType: "coding",
      priority: "quality",
      constraints: createConstraints(),
      promptAnalysis
    });

    expect(fit.fit).toBe("underpowered");
    expect(fit.reasonCodes).toContain("economy_model_for_high_risk_task");
  });

  test("labels matching balanced models appropriate", () => {
    const promptAnalysis = parsePrompt("Extract fields from {{invoice_text}} as JSON.");
    const fit = classifyModelFit({
      provider: "openai",
      modelId: "balanced",
      modelRegistryRecord: createRegistryRecord({ quality_tier: "balanced" }),
      taskType: "extraction",
      priority: "balanced",
      constraints: createConstraints(),
      promptAnalysis
    });

    expect(fit.fit).toBe("appropriate");
  });
});

describe("prompt model audit", () => {
  test("returns risk-first preflight output without production switch recommendation", () => {
    const audit = runPromptModelAudit({
      provider: "openai",
      modelId: "openai-demo-frontier",
      prompt: "Classify {{ticket_text}}. Return JSON. Return JSON only.",
      taskType: "support",
      monthlyCalls: 250_000,
      priority: "cost",
      constraints: createConstraints(),
      modelRegistryRecords: [
        createRegistryRecord({
          id: "frontier",
          model_id: "openai-demo-frontier",
          quality_tier: "frontier",
          input_price_per_million_tokens: 4,
          output_price_per_million_tokens: 12
        }),
        createRegistryRecord({
          id: "balanced",
          model_id: "openai-demo-balanced",
          quality_tier: "balanced",
          input_price_per_million_tokens: 1,
          output_price_per_million_tokens: 4
        })
      ]
    });

    expect(audit.modelFit).toBe("overpowered");
    expect(audit.suggestedModelRoles.map((role) => role.role)).toContain("cheaper_candidate");
    expect(audit.compressionGuardrails.join(" ")).toContain("not make a production switch");
  });
});

function createConstraints() {
  return {
    requiresJson: true,
    usesTools: false,
    usesImages: false,
    needsStructuredOutput: true,
    maxLatencyMs: null,
    minContextWindow: null
  };
}

function createRegistryRecord(patch: Partial<ModelRegistryRecord> = {}): ModelRegistryRecord {
  return {
    id: "model_registry_openai_balanced",
    provider: "openai",
    model_id: "openai-demo-balanced",
    display_name: "OpenAI Demo Balanced",
    input_price_per_million_tokens: 1,
    output_price_per_million_tokens: 4,
    cached_input_price_per_million_tokens: null,
    context_window: 128000,
    max_output_tokens: 4096,
    supports_text: true,
    supports_image: false,
    supports_audio: false,
    supports_video: false,
    supports_tools: false,
    supports_structured_output: true,
    latency_tier: "unknown",
    quality_tier: "balanced",
    recommended_task_types: ["support", "classification", "extraction", "coding"],
    stability_status: "stable",
    freshness_status: "fresh",
    source_url: "https://example.com/models",
    last_verified_at: timestamp,
    verified_by: "test",
    pricing_note: "Verified test metadata.",
    is_mock: false,
    metadata: {},
    created_at: timestamp,
    updated_at: timestamp,
    ...patch
  };
}
