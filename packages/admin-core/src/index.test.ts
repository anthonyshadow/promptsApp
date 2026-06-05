import { describe, expect, test } from "bun:test";
import { Hono, type MiddlewareHandler } from "hono";
import {
  DEMO_IDS,
  createDemoRepositorySeed,
  createMemoryRepository,
  type PromptOptsRepository
} from "@promptopts/shared";
import {
  createMockAdminHeaders,
  redactPromptPreview,
  redactProviderError,
  redactReportPreview,
  requireActionScope,
  requireAdminRole,
  requireMfa,
  requireSession,
  requireSudo,
  resolveAdminRoutePolicy,
  writeAdminAuditEvent,
  type AdminSecurityHonoEnv
} from "./index";

function createSecurityTestApp(repository: PromptOptsRepository) {
  const injectRepository: MiddlewareHandler<AdminSecurityHonoEnv> = async (c, next) => {
    c.set("repository", repository);
    await next();
  };

  return new Hono<AdminSecurityHonoEnv>()
    .use("*", injectRepository)
    .use("*", requireSession)
    .use("*", requireMfa)
    .use("*", requireAdminRole)
    .use("*", requireActionScope)
    .use("*", requireSudo())
    .use(
      "*",
      writeAdminAuditEvent({
        createId: () => `admin_audit_log_test_${crypto.randomUUID().replaceAll("-", "")}`,
        now: () => "2026-01-20T12:00:00.000Z"
      })
    )
    .get("/admin-api/overview", (c) => c.json({ ok: true }))
    .get("/admin-api/audit-logs", (c) => c.json({ ok: true }))
    .post("/admin-api/accounts", (c) => c.json({ ok: true }))
    .post("/admin-api/reports/:id/delete", (c) => c.json({ ok: true }))
    .get("/admin-api/prompts/:id/reveal", (c) => c.json({ ok: true }));
}

function postRequest(headers: HeadersInit): RequestInit {
  return {
    method: "POST",
    headers
  };
}

describe("admin security middleware", () => {
  test("requires session, MFA, admin role, action scope, and sudo", async () => {
    const repository = createMemoryRepository(createDemoRepositorySeed());
    const app = createSecurityTestApp(repository);

    expect((await app.request("/admin-api/overview")).status).toBe(401);
    expect(
      (await app.request(
        "/admin-api/overview",
        { headers: createMockAdminHeaders({ mfa_verified: false }) }
      )).status
    ).toBe(403);
    expect(
      (await app.request(
        "/admin-api/accounts",
        postRequest(createMockAdminHeaders({ role: "read_only" }))
      )).status
    ).toBe(403);
    expect(
      (await app.request(
        `/admin-api/reports/${DEMO_IDS.report}/delete`,
        postRequest(createMockAdminHeaders({ sudo_grant: null }))
      )).status
    ).toBe(403);
    expect(
      (await app.request(
        `/admin-api/reports/${DEMO_IDS.report}/delete`,
        postRequest(createMockAdminHeaders({ sudo_grant: {} }))
      )).status
    ).toBe(200);
  });

  test("writes audit logs for mutations and sensitive reads only", async () => {
    const repository = createMemoryRepository(createDemoRepositorySeed());
    const app = createSecurityTestApp(repository);
    const headers = createMockAdminHeaders();
    const before = await repository.admin_audit_logs.list();

    await app.request("/admin-api/overview", { headers });
    await app.request("/admin-api/accounts", postRequest(headers));
    await app.request("/admin-api/audit-logs", { headers });

    const after = await repository.admin_audit_logs.list();
    expect(after.length).toBe(before.length + 3);
    expect(after.at(-3)?.target_type).toBe("overview");
    expect(after.at(-2)?.target_type).toBe("accounts");
    expect(after.at(-1)?.target_type).toBe("audit_logs");
  });
});

describe("admin route policies", () => {
  test("marks dangerous and sensitive routes", () => {
    expect(resolveAdminRoutePolicy("GET", "/admin-api/prompts/prompt_1/reveal")).toMatchObject({
      action_scope: "reveal_prompt",
      requires_sudo: true,
      sensitive_read: true
    });
    expect(resolveAdminRoutePolicy("POST", "/admin-api/billing/workspace_1/credit")).toMatchObject({
      action_scope: "issue_billing_credit",
      requires_sudo: true
    });
    expect(resolveAdminRoutePolicy("POST", "/admin-api/break-glass")).toMatchObject({
      action_scope: "break_glass",
      requires_sudo: true
    });
    expect(resolveAdminRoutePolicy("GET", "/admin-api/overview")).toMatchObject({
      action_scope: "read_metadata",
      sensitive_read: true
    });
    expect(resolveAdminRoutePolicy("GET", "/admin-api/accounts/account_1")).toMatchObject({
      action_scope: "read_metadata",
      sensitive_read: true
    });
  });
});

describe("admin redaction helpers", () => {
  test("redacts prompts, reports, and provider errors by default", () => {
    expect(redactPromptPreview("Classify this customer message exactly")).not.toContain("Classify");
    expect(redactReportPreview("Winner: model-x with confidential savings")).not.toContain("model-x");

    const providerError = redactProviderError(
      "Provider failed with Bearer token-abc and api_key=sk-secret123456"
    );
    expect(providerError).not.toContain("token-abc");
    expect(providerError).not.toContain("sk-secret123456");
  });
});
