import { describe, expect, test } from "bun:test";
import { Hono, type MiddlewareHandler } from "hono";
import {
  DEMO_IDS,
  type AdminRoleRecord,
  type AdminSessionRecord,
  type AdminUserRecord,
  type RepositorySeed,
  type SudoRequest,
  createDemoRepositorySeed,
  createMemoryRepository,
  type PromptOptsRepository
} from "@promptopts/shared";
import {
  hashAdminSessionToken,
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

const ADMIN_TEST_TOKENS = {
  owner: "admin_core_token_owner",
  ownerNoMfa: "admin_core_token_owner_no_mfa",
  ownerSudo: "admin_core_token_owner_sudo",
  readOnly: "admin_core_token_read_only"
} as const;

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

function createSecurityTestRepository(): PromptOptsRepository {
  const seed = createDemoRepositorySeed();
  const timestamp = "2026-06-06T12:00:00.000Z";
  const expiresAt = "2030-01-01T00:00:00.000Z";
  const ownerRole: AdminRoleRecord = {
    id: "admin_core_role_owner",
    name: "owner",
    scopes: [
      "read_metadata",
      "reveal_prompt",
      "reveal_report",
      "manage_workspace",
      "manage_model_registry",
      "retry_eval",
      "delete_report",
      "issue_billing_credit",
      "impersonate_user",
      "revoke_user",
      "break_glass"
    ],
    is_system: true,
    created_at: timestamp
  };
  const readOnlyRole: AdminRoleRecord = {
    id: "admin_core_role_read_only",
    name: "read_only",
    scopes: ["read_metadata"],
    is_system: true,
    created_at: timestamp
  };
  const user = (id: string, roleIds: string[], email: string): AdminUserRecord => ({
    id,
    user_id: null,
    email,
    display_name: id,
    role_ids: roleIds,
    status: "active",
    password_hash: "sha256:3049b742957bf075de0f9cb0921707659065972bef873d86131f57f61d9a796e",
    mfa_secret: "JBSWY3DPEHPK3PXP",
    created_at: timestamp,
    updated_at: timestamp
  });
  const session = (
    id: string,
    adminUserId: string,
    token: string,
    mfaVerified = true
  ): AdminSessionRecord => ({
    id,
    admin_user_id: adminUserId,
    session_hash: hashAdminSessionToken(token),
    mfa_verified_at: mfaVerified ? timestamp : null,
    revoked_at: null,
    expires_at: expiresAt,
    ip_address: "127.0.0.1",
    user_agent: "admin-core test",
    created_at: timestamp
  });
  const sudo: SudoRequest = {
    id: "admin_core_sudo_delete_report",
    admin_user_id: "admin_core_user_owner_sudo",
    role: "owner",
    requested_action: "delete_report",
    target_type: null,
    target_id: null,
    action_scope: "delete_report",
    reason_code: "admin_core_delete_report",
    status: "active",
    approved_by_admin_user_id: "admin_core_user_owner_sudo",
    approved_at: timestamp,
    activated_at: timestamp,
    revoked_at: null,
    expires_at: expiresAt,
    ip_address: "127.0.0.1",
    user_agent: "admin-core test",
    created_at: timestamp
  };
  const authSeed: Required<RepositorySeed> = {
    ...seed,
    admin_roles: [...seed.admin_roles, ownerRole, readOnlyRole],
    admin_users: [
      ...seed.admin_users,
      user("admin_core_user_owner", [ownerRole.id], "owner.core@test.promptopts"),
      user("admin_core_user_owner_sudo", [ownerRole.id], "sudo.core@test.promptopts"),
      user("admin_core_user_read_only", [readOnlyRole.id], "readonly.core@test.promptopts")
    ],
    admin_sessions: [
      ...seed.admin_sessions,
      session("admin_core_session_owner", "admin_core_user_owner", ADMIN_TEST_TOKENS.owner),
      session(
        "admin_core_session_owner_no_mfa",
        "admin_core_user_owner",
        ADMIN_TEST_TOKENS.ownerNoMfa,
        false
      ),
      session(
        "admin_core_session_owner_sudo",
        "admin_core_user_owner_sudo",
        ADMIN_TEST_TOKENS.ownerSudo
      ),
      session("admin_core_session_read_only", "admin_core_user_read_only", ADMIN_TEST_TOKENS.readOnly)
    ],
    sudo_requests: [...seed.sudo_requests, sudo]
  };

  return createMemoryRepository(authSeed);
}

function bearer(token: string): HeadersInit {
  return {
    authorization: `Bearer ${token}`
  };
}

describe("admin security middleware", () => {
  test("requires session, MFA, admin role, action scope, and sudo", async () => {
    const repository = createSecurityTestRepository();
    const app = createSecurityTestApp(repository);

    expect((await app.request("/admin-api/overview")).status).toBe(401);
    expect(
      (await app.request("/admin-api/overview", {
        headers: {
          "x-admin-session-id": "admin_session_mock",
          "x-admin-user-id": "admin_user_mock",
          "x-admin-role": "owner",
          "x-admin-mfa": "true",
          "x-admin-action-scopes": "read_metadata"
        }
      })).status
    ).toBe(401);
    expect(
      (await app.request(
        "/admin-api/overview",
        { headers: bearer(ADMIN_TEST_TOKENS.ownerNoMfa) }
      )).status
    ).toBe(403);
    expect(
      (await app.request(
        "/admin-api/accounts",
        postRequest(bearer(ADMIN_TEST_TOKENS.readOnly))
      )).status
    ).toBe(403);
    expect(
      (await app.request(
        `/admin-api/reports/${DEMO_IDS.report}/delete`,
        postRequest(bearer(ADMIN_TEST_TOKENS.owner))
      )).status
    ).toBe(403);
    expect(
      (await app.request(
        `/admin-api/reports/${DEMO_IDS.report}/delete`,
        postRequest(bearer(ADMIN_TEST_TOKENS.ownerSudo))
      )).status
    ).toBe(200);
  });

  test("writes audit logs for mutations and sensitive reads only", async () => {
    const repository = createSecurityTestRepository();
    const app = createSecurityTestApp(repository);
    const headers = bearer(ADMIN_TEST_TOKENS.owner);
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
    expect(resolveAdminRoutePolicy("POST", "/admin-api/eval-runs/eval_1/retry")).toMatchObject({
      action_scope: "retry_eval",
      requires_sudo: false
    });
    expect(resolveAdminRoutePolicy("GET", "/admin-api/reports/report_1/reveal")).toMatchObject({
      action_scope: "reveal_report",
      requires_sudo: true,
      sensitive_read: true
    });
    expect(resolveAdminRoutePolicy("POST", "/admin-api/reports/report_1/retry-export")).toMatchObject({
      action_scope: "retry_eval",
      requires_sudo: false
    });
    expect(resolveAdminRoutePolicy("PATCH", "/admin-api/models/model_1")).toMatchObject({
      action_scope: "manage_model_registry",
      requires_sudo: true
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
