import { describe, expect, test } from "bun:test";
import {
  createMemoryRepository,
  type ProviderConnection
} from "@promptopts/shared";
import {
  decryptSecretForUse,
  encryptSecret,
  fingerprintSecret
} from "@promptopts/shared/security";
import {
  MockProviderAdapter,
  OpenAIAdapter,
  normalizeProviderResponse,
  sanitizeProviderError
} from "./index";

const cryptoOptions = {
  keyMaterial: "provider-adapter-test-key-material",
  keyId: "local:provider-adapter-test"
};

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

  test("live placeholders can resolve decrypted BYOK keys without returning them", async () => {
    const repository = createMemoryRepository({
      workspaces: [
        {
          id: "workspace_adapter_key",
          name: "Adapter Key Workspace",
          slug: "adapter-key",
          is_mock: true,
          created_at: "2026-06-06T12:00:00.000Z",
          updated_at: "2026-06-06T12:00:00.000Z"
        }
      ]
    });
    const encrypted = encryptSecret("sk-adapter-key-secret", cryptoOptions);
    const connection: ProviderConnection = {
      id: "provider_connection_adapter_key",
      workspace_id: "workspace_adapter_key",
      provider: "openai",
      encrypted_key_blob: encrypted.encrypted_key_blob,
      encryption_key_id: encrypted.encryption_key_id,
      key_fingerprint: fingerprintSecret("sk-adapter-key-secret", cryptoOptions),
      status: "active",
      created_by: null,
      rotated_at: null,
      revoked_at: null,
      last_used_at: null,
      metadata: {},
      is_mock: true,
      created_at: "2026-06-06T12:00:00.000Z",
      updated_at: "2026-06-06T12:00:00.000Z"
    };

    await repository.provider_connections.create(connection);

    const adapter = new OpenAIAdapter({
      keyResolver: (input) =>
        input.providerConnectionId
          ? decryptSecretForUse(input.providerConnectionId, {
              repository,
              actorId: "system_eval_runner",
              reasonCode: "provider_adapter_test",
              crypto: cryptoOptions
            })
          : Promise.resolve(null)
    });
    const response = await adapter.generate({
      provider: "openai",
      modelId: "openai-demo-balanced",
      providerConnectionId: connection.id,
      prompt: "Return JSON.",
      inputVariables: {}
    });
    const auditLogs = await repository.admin_audit_logs.list();

    expect(response.error?.code).toBe("not_implemented");
    expect(JSON.stringify(response)).not.toContain("sk-adapter-key-secret");
    expect(auditLogs.map((log) => log.action)).toContain("provider_key_used_for_eval");
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
