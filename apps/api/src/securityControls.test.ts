import { describe, expect, test } from "bun:test";
import { DEMO_IDS } from "@promptopts/shared";
import { createApp } from "./app";
import {
  createMemoryRateLimitStore,
  redactLogPayload,
  type SafeRequestLogEvent
} from "./securityControls";
import {
  createAdminTestRepository,
  jsonRequest
} from "./appTestHelpers";

describe("API security controls", () => {
  test("redacts prompt, provider-key, report, token, and test-case payload fields", () => {
    const redacted = redactLogPayload({
      prompt_text: "Classify buyer@example.com with sk-test-secret-value",
      api_key: "sk-openai-provider-key-never-log",
      report_body: "Raw recommendation body",
      input_variables: { customer_message: "buyer@example.com" },
      key_fingerprint: "fp_safe_metadata",
      nested: {
        token: "bearer secret",
        content: "raw report content"
      }
    });
    const serialized = JSON.stringify(redacted);

    expect(serialized).not.toContain("buyer@example.com");
    expect(serialized).not.toContain("sk-openai-provider-key-never-log");
    expect(serialized).not.toContain("Raw recommendation body");
    expect(serialized).toContain("fp_safe_metadata");
    expect(redacted.prompt_text).toBe("[redacted]");
    expect(redacted.api_key).toBe("[redacted]");
    expect(redacted.nested.token).toBe("[redacted]");
  });

  test("rate limit middleware rejects over-limit public audit requests", async () => {
    const app = createApp({
      repository: createAdminTestRepository(),
      rateLimitStore: createMemoryRateLimitStore(),
      rateLimitPolicies: {
        public_audit: { limit: 1, windowMs: 60_000 }
      }
    });
    const request = jsonRequest({
      provider: "openai",
      modelId: "openai-demo-balanced",
      prompt: "Classify {{message}}.",
      taskType: "support",
      monthlyCalls: 1000,
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

    expect((await app.request("/audits", request)).status).toBe(200);
    const limited = await app.request("/audits", request);
    const body = await limited.json();

    expect(limited.status).toBe(429);
    expect(limited.headers.get("x-ratelimit-policy")).toBe("public_audit");
    expect(body.error.code).toBe("rate_limit_exceeded");
  });

  test("safe request logs omit raw prompts and provider keys", async () => {
    process.env.PROMPTOPTS_SECRET_ENCRYPTION_KEY ??= "api-security-controls-test-key-material";
    const events: SafeRequestLogEvent[] = [];
    const app = createApp({
      repository: createAdminTestRepository(),
      rateLimitStore: createMemoryRateLimitStore(),
      requestLogger: {
        write(event) {
          events.push(event);
        }
      }
    });
    const rawPrompt = "Classify buyer@example.com and return JSON.";
    const rawKey = "sk-openai-provider-key-never-log-123456";

    await app.request(
      "/prompts",
      jsonRequest({
        workspace_id: DEMO_IDS.workspace,
        name: "Log redaction prompt",
        task_type: "support",
        provider: "openai",
        model_id: "openai-demo-balanced",
        prompt_text: rawPrompt,
        variables: []
      })
    );
    await app.request(
      "/provider-connections",
      jsonRequest({
        workspace_id: DEMO_IDS.workspace,
        provider: "gemini",
        api_key: rawKey,
        created_by: DEMO_IDS.user
      })
    );

    const serialized = JSON.stringify(events);

    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(serialized).not.toContain(rawPrompt);
    expect(serialized).not.toContain(rawKey);
    expect(serialized).not.toContain("buyer@example.com");
    expect(events.map((event) => event.route)).toContain("/prompts");
    expect(events.map((event) => event.route)).toContain("/provider-connections");
    expect(events.every((event) => event.request_id.startsWith("req_"))).toBe(true);
  });

  test("admin login failures are rate limited", async () => {
    const app = createApp({
      repository: createAdminTestRepository(),
      rateLimitStore: createMemoryRateLimitStore(),
      rateLimitPolicies: {
        admin_login: { limit: 1, windowMs: 60_000 }
      }
    });
    const request = jsonRequest({
      email: "owner.admin@test.promptopts",
      password: "wrong-password"
    });

    expect((await app.request("/admin-api/auth/login", request)).status).toBe(401);
    const limited = await app.request("/admin-api/auth/login", request);

    expect(limited.status).toBe(429);
    expect(limited.headers.get("x-ratelimit-policy")).toBe("admin_login");
  });
});
