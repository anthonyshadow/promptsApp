import { describe, expect, test } from "bun:test";
import type { ModelRegistryRecord } from "@promptopts/shared";
import {
  classifyRegistryFreshness,
  filterByCapability,
  shortlistModels
} from "./index";

const createdAt = "2026-06-01T12:00:00.000Z";

describe("model registry shortlist", () => {
  test("returns baseline, cheaper, balanced, and fallback roles for same-provider models", () => {
    const models = [
      createModel({
        id: "frontier",
        model_id: "openai-frontier",
        display_name: "OpenAI frontier",
        quality_tier: "frontier",
        input_price_per_million_tokens: 12,
        output_price_per_million_tokens: 36
      }),
      createModel({
        id: "balanced",
        model_id: "openai-balanced",
        display_name: "OpenAI balanced",
        quality_tier: "balanced",
        input_price_per_million_tokens: 3,
        output_price_per_million_tokens: 9
      }),
      createModel({
        id: "economy",
        model_id: "openai-economy",
        display_name: "OpenAI economy",
        quality_tier: "economy",
        input_price_per_million_tokens: 1,
        output_price_per_million_tokens: 2
      }),
      createModel({
        id: "anthropic-balanced",
        provider: "anthropic",
        model_id: "anthropic-balanced",
        display_name: "Anthropic balanced",
        quality_tier: "balanced"
      })
    ];

    const shortlist = shortlistModels({
      models,
      provider: "openai",
      currentModelId: "openai-frontier",
      taskType: "support",
      promptTokenEstimate: 400,
      outputEstimate: 160,
      contextNeeds: 1200,
      structuredOutput: true,
      tools: true,
      modality: "text",
      latencyTargetMs: 2000,
      priority: "balanced",
      failureCost: "high"
    });

    expect(shortlist.entries.map((entry) => entry.role)).toEqual([
      "baseline",
      "cheaper",
      "balanced",
      "fallback"
    ]);
    expect(shortlist.entries.find((entry) => entry.role === "baseline")?.model.model_id).toBe(
      "openai-frontier"
    );
    expect(shortlist.entries.find((entry) => entry.role === "cheaper")?.model.model_id).toBe(
      "openai-economy"
    );
    expect(shortlist.entries.find((entry) => entry.role === "balanced")?.model.model_id).toBe(
      "openai-balanced"
    );
    expect(shortlist.entries.find((entry) => entry.role === "fallback")?.model.model_id).toBe(
      "openai-frontier"
    );
    expect(shortlist.entries.every((entry) => entry.model.provider === "openai")).toBe(true);
  });

  test("classifies stale and demo registry metadata as unsafe for exact savings claims", () => {
    const demoModel = createModel({
      id: "demo",
      freshness_status: "stale",
      stability_status: "unverified",
      source_url: null,
      last_verified_at: null,
      is_mock: true
    });
    const verifiedModel = createModel({
      id: "verified",
      freshness_status: "fresh",
      stability_status: "stable",
      source_url: "https://example.com/verified-model",
      last_verified_at: createdAt,
      is_mock: false
    });

    const demoHealth = classifyRegistryFreshness(demoModel);
    const verifiedHealth = classifyRegistryFreshness(verifiedModel);

    expect(demoHealth.freshness).toBe("demo_unverified");
    expect(demoHealth.exactSavingsAllowed).toBe(false);
    expect(demoHealth.productionEligible).toBe(false);
    expect(demoHealth.warnings.join(" ")).toContain("Demo registry row");
    expect(demoHealth.warnings.join(" ")).toContain("stale");
    expect(verifiedHealth.exactSavingsAllowed).toBe(true);
    expect(verifiedHealth.productionEligible).toBe(true);
  });

  test("ages approved rows into stale review state without changing registry prices", () => {
    const staleByAge = createModel({
      id: "aged",
      last_verified_at: "2026-04-01T12:00:00.000Z"
    });

    const health = classifyRegistryFreshness(staleByAge, {
      now: new Date("2026-06-06T12:00:00.000Z")
    });

    expect(health.freshness).toBe("stale");
    expect(health.exactSavingsAllowed).toBe(false);
    expect(health.warnings.join(" ")).toContain("older than 30 days");
  });

  test("blocks exact savings when active rows are not approved", () => {
    const pending = createModel({
      id: "pending",
      approval_state: "pending_review",
      approved_by_admin_user_id: null,
      approved_at: null
    });

    const health = classifyRegistryFreshness(pending);

    expect(health.exactSavingsAllowed).toBe(false);
    expect(health.productionEligible).toBe(false);
    expect(health.warnings.join(" ")).toContain("pending_review");
  });

  test("filters models by capability, stability, modality, context, and output needs", () => {
    const capable = createModel({ id: "capable" });
    const noStructuredOutput = createModel({
      id: "no-structured-output",
      supports_structured_output: false
    });
    const noTools = createModel({ id: "no-tools", supports_tools: false });
    const noImage = createModel({ id: "no-image", supports_image: false });
    const smallContext = createModel({ id: "small-context", context_window: 700 });
    const smallOutput = createModel({ id: "small-output", max_output_tokens: 100 });
    const preview = createModel({ id: "preview", stability_status: "preview" });

    const models = filterByCapability({
      models: [capable, noStructuredOutput, noTools, noImage, smallContext, smallOutput, preview],
      provider: "openai",
      taskType: "support",
      promptTokenEstimate: 500,
      outputEstimate: 200,
      contextNeeds: 800,
      structuredOutput: true,
      tools: true,
      modality: "image",
      stability: ["stable"]
    });

    expect(models.map((model) => model.id)).toEqual(["capable"]);
  });

  test("uses registry row prices instead of model-name assumptions for cheaper role", () => {
    const baseline = createModel({
      id: "baseline",
      model_id: "expensive-name-that-sounds-small",
      input_price_per_million_tokens: 10,
      output_price_per_million_tokens: 20,
      quality_tier: "frontier"
    });
    const cheaperByRegistry = createModel({
      id: "cheap",
      model_id: "premium-name-that-registry-prices-cheaply",
      input_price_per_million_tokens: 0.5,
      output_price_per_million_tokens: 1,
      quality_tier: "economy"
    });

    const shortlist = shortlistModels({
      models: [baseline, cheaperByRegistry],
      provider: "openai",
      currentModelId: baseline.model_id,
      taskType: "support",
      promptTokenEstimate: 300,
      outputEstimate: 100,
      contextNeeds: 1000,
      structuredOutput: false,
      tools: false,
      modality: "text",
      latencyTargetMs: null,
      priority: "cost",
      failureCost: "medium"
    });

    expect(shortlist.entries.find((entry) => entry.role === "cheaper")?.model.id).toBe("cheap");
  });
});

function createModel(patch: Partial<ModelRegistryRecord> = {}): ModelRegistryRecord {
  return {
    id: "model",
    provider: "openai",
    model_id: "openai-model",
    display_name: "OpenAI model",
    input_price_per_million_tokens: 2,
    output_price_per_million_tokens: 8,
    cached_input_price_per_million_tokens: null,
    context_window: 128000,
    max_output_tokens: 4096,
    supports_text: true,
    supports_image: true,
    supports_audio: false,
    supports_video: false,
    supports_tools: true,
    supports_structured_output: true,
    latency_tier: "standard",
    quality_tier: "balanced",
    recommended_task_types: ["support", "classification"],
    stability_status: "stable",
    freshness_status: "fresh",
    source_url: "https://example.com/model",
    last_verified_at: createdAt,
    verified_by: "PromptOpts demo",
    approval_state: "approved",
    approved_by_admin_user_id: "admin_user_test",
    approved_at: createdAt,
    pricing_note: "Synthetic verified row for registry unit tests.",
    is_mock: false,
    metadata: {},
    created_at: createdAt,
    updated_at: createdAt,
    ...patch
  };
}
