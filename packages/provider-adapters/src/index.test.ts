import { describe, expect, test } from "bun:test";
import {
  MockProviderAdapter,
  OpenAIAdapter,
  normalizeProviderResponse,
  sanitizeProviderError
} from "./index";

describe("provider adapters", () => {
  test("normalizes mock provider responses with usage and parsed JSON", async () => {
    const adapter = new MockProviderAdapter("openai");
    const response = await adapter.generate({
      provider: "openai",
      modelId: "openai-demo-balanced",
      prompt: "Classify {{customer_message}} as JSON.",
      inputVariables: {
        customer_message: "I was charged twice."
      },
      testCase: {
        id: "case_billing",
        name: "Billing",
        expected_output: { category: "billing", urgency: "medium" }
      }
    });

    expect(response.error).toBeNull();
    expect(response.outputJson).toMatchObject({ category: "billing", urgency: "medium" });
    expect(response.usage.inputTokens).toBeGreaterThan(0);
    expect(response.usage.outputTokens).toBeGreaterThan(0);
  });

  test("sanitizes provider errors without leaking raw payloads", async () => {
    const adapter = new MockProviderAdapter("anthropic");
    const response = await adapter.generate({
      provider: "anthropic",
      modelId: "anthropic-demo-balanced",
      prompt: "[mock_rate_limit] Classify {{message}}.",
      inputVariables: { message: "hello" }
    });

    expect(response.error).toMatchObject({
      code: "rate_limited",
      retryable: true,
      statusCode: 429
    });
    expect(response.outputText).toBe("");
    expect(sanitizeProviderError({ status: 500, secret: "sk-test-secret" }).message).toBe(
      "Provider call failed."
    );
  });

  test("live placeholders do not call providers when keys are missing or TODO", async () => {
    const missing = await new OpenAIAdapter(undefined).generate({
      provider: "openai",
      modelId: "openai-demo-balanced",
      prompt: "Return JSON.",
      inputVariables: {}
    });
    const todo = await new OpenAIAdapter("configured-but-not-used").generate({
      provider: "openai",
      modelId: "openai-demo-balanced",
      prompt: "Return JSON.",
      inputVariables: {}
    });

    expect(missing.error?.code).toBe("missing_key");
    expect(todo.error?.code).toBe("not_implemented");
  });

  test("normalization parses JSON text responses", () => {
    const normalized = normalizeProviderResponse(
      {
        provider: "gemini",
        modelId: "gemini-demo-balanced",
        prompt: "Return JSON.",
        inputVariables: {}
      },
      {
        text: "{\"label\":\"support\"}",
        latencyMs: 99
      }
    );

    expect(normalized.outputJson).toEqual({ label: "support" });
    expect(normalized.latencyMs).toBe(99);
  });
});
