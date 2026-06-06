import { expect } from "bun:test";
import {
  DEMO_IDS,
  type AdminActionScope,
  type AdminRoleRecord,
  type AdminSessionRecord,
  type AdminUserRecord,
  type ReportArtifactStorage,
  type RepositorySeed,
  type SudoRequest,
  createDemoRepositorySeed,
  createMemoryReportArtifactStorage,
  createMemoryRepository,
  healthResponseSchema
} from "@promptopts/shared";
import { createTotpCode, hashAdminSessionToken } from "@promptopts/admin-core";
import { createApp } from "./app";
import {
  adminEvalRunDetailResponseSchema,
  adminEvalRunsResponseSchema,
  adminModelRegistryResponseSchema,
  adminOverviewResponseSchema,
  adminProviderConnectionsResponseSchema,
  adminReportsResponseSchema,
  billingCreditResponseSchema,
  billingResponseSchema,
  modelApproveResponseSchema,
  modelPatchResponseSchema,
  reportDeleteResponseSchema,
  reportExportActionResponseSchema
} from "./contracts";

export const ADMIN_TEST_TOKENS = {
  owner: "admin_test_token_owner",
  ownerNoMfa: "admin_test_token_owner_no_mfa",
  ownerSudo: "admin_test_token_owner_sudo",
  support: "admin_test_token_support",
  supportSudo: "admin_test_token_support_sudo",
  readOnly: "admin_test_token_read_only",
  missingScope: "admin_test_token_missing_scope"
} as const;

process.env.PROMPTOPTS_SECRET_ENCRYPTION_KEY ??= "api-route-test-provider-key-material";

export type AdminRequestInput = {
  role?: "owner" | "ops" | "support" | "finance" | "read_only";
  mfa_verified?: boolean;
  sudo_grant?: { reason_code?: string } | null;
  missingScope?: boolean;
};

export function createTestApp() {
  return createApp({
    repository: createAdminTestRepository()
  });
}

export function createDeleteFailingStorage(): ReportArtifactStorage {
  const storage = createMemoryReportArtifactStorage();

  return {
    put: storage.put.bind(storage),
    putObject: storage.putObject.bind(storage),
    get: storage.get.bind(storage),
    getObject: storage.getObject.bind(storage),
    getObjectMetadata: storage.getObjectMetadata.bind(storage),
    list: storage.list.bind(storage),
    objectExists: storage.objectExists.bind(storage),
    calculateChecksum: storage.calculateChecksum.bind(storage),
    delete: async () => undefined,
    deleteObject: async () => undefined
  };
}

export function createAdminTestRepository() {
  return createMemoryRepository(createAdminTestSeed());
}

function createAdminTestSeed(): Required<RepositorySeed> {
  const seed = createDemoRepositorySeed();
  const timestamp = "2026-06-06T12:00:00.000Z";
  const expiresAt = "2030-01-01T00:00:00.000Z";
  const role = (name: AdminRoleRecord["name"], scopes: AdminActionScope[]): AdminRoleRecord => ({
    id: `admin_role_test_${name}_${scopes.length}`,
    name,
    scopes,
    is_system: true,
    created_at: timestamp
  });
  const ownerRole = role("owner", [
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
  ]);
  const ownerNoScopeRole = role("owner", []);
  const supportRole = role("support", ["read_metadata", "retry_eval", "revoke_user"]);
  const readOnlyRole = role("read_only", ["read_metadata"]);
  const adminUser = (
    id: string,
    roleIds: string[],
    email: string
  ): AdminUserRecord => ({
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
    user_agent: "PromptOpts admin route test",
    created_at: timestamp
  });
  const sudo = (
    id: string,
    adminUserId: string,
    actionScope: AdminActionScope
  ): SudoRequest => ({
    id,
    admin_user_id: adminUserId,
    role: adminUserId.includes("support") ? "support" : "owner",
    requested_action: actionScope,
    target_type: null,
    target_id: null,
    action_scope: actionScope,
    reason_code: "route_test_sudo",
    status: "active",
    approved_by_admin_user_id: adminUserId,
    approved_at: timestamp,
    activated_at: timestamp,
    revoked_at: null,
    expires_at: expiresAt,
    ip_address: "127.0.0.1",
    user_agent: "PromptOpts admin route test",
    created_at: timestamp
  });

  return {
    ...seed,
    admin_roles: [
      ...seed.admin_roles,
      ownerRole,
      ownerNoScopeRole,
      supportRole,
      readOnlyRole
    ],
    admin_users: [
      ...seed.admin_users,
      adminUser("admin_user_test_owner", [ownerRole.id], "owner.admin@test.promptopts"),
      adminUser("admin_user_test_owner_sudo", [ownerRole.id], "owner.sudo@test.promptopts"),
      adminUser("admin_user_test_support", [supportRole.id], "support.admin@test.promptopts"),
      adminUser("admin_user_test_support_sudo", [supportRole.id], "support.sudo@test.promptopts"),
      adminUser("admin_user_test_read_only", [readOnlyRole.id], "readonly.admin@test.promptopts"),
      adminUser("admin_user_test_missing_scope", [ownerNoScopeRole.id], "missing.scope@test.promptopts")
    ],
    admin_sessions: [
      ...seed.admin_sessions,
      session("admin_session_test_owner", "admin_user_test_owner", ADMIN_TEST_TOKENS.owner),
      session(
        "admin_session_test_owner_no_mfa",
        "admin_user_test_owner",
        ADMIN_TEST_TOKENS.ownerNoMfa,
        false
      ),
      session(
        "admin_session_test_owner_sudo",
        "admin_user_test_owner_sudo",
        ADMIN_TEST_TOKENS.ownerSudo
      ),
      session("admin_session_test_support", "admin_user_test_support", ADMIN_TEST_TOKENS.support),
      session(
        "admin_session_test_support_sudo",
        "admin_user_test_support_sudo",
        ADMIN_TEST_TOKENS.supportSudo
      ),
      session("admin_session_test_read_only", "admin_user_test_read_only", ADMIN_TEST_TOKENS.readOnly),
      session(
        "admin_session_test_missing_scope",
        "admin_user_test_missing_scope",
        ADMIN_TEST_TOKENS.missingScope
      )
    ],
    sudo_requests: [
      ...seed.sudo_requests,
      sudo("sudo_request_test_reveal_prompt", "admin_user_test_owner_sudo", "reveal_prompt"),
      sudo("sudo_request_test_reveal_report", "admin_user_test_owner_sudo", "reveal_report"),
      sudo("sudo_request_test_delete_report", "admin_user_test_owner_sudo", "delete_report"),
      sudo("sudo_request_test_billing_credit", "admin_user_test_owner_sudo", "issue_billing_credit"),
      sudo("sudo_request_test_model_registry", "admin_user_test_owner_sudo", "manage_model_registry"),
      sudo("sudo_request_test_impersonate", "admin_user_test_owner_sudo", "impersonate_user"),
      sudo("sudo_request_test_break_glass", "admin_user_test_owner_sudo", "break_glass"),
      sudo("sudo_request_test_support_credit", "admin_user_test_support_sudo", "issue_billing_credit")
    ]
  };
}

export function jsonRequest(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  };
}

export function patchJsonRequest(body: unknown): RequestInit {
  return {
    ...jsonRequest(body),
    method: "PATCH"
  };
}

export function adminGetRequest(input: AdminRequestInput = {}): RequestInit {
  return {
    headers: {
      authorization: `Bearer ${adminTokenFor(input)}`
    }
  };
}

export function adminJsonRequest(
  body: unknown,
  input: AdminRequestInput = {}
): RequestInit {
  return {
    method: "POST",
    headers: {
      authorization: `Bearer ${adminTokenFor(input)}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  };
}

export function adminPatchJsonRequest(
  body: unknown,
  input: AdminRequestInput = {}
): RequestInit {
  return {
    ...adminJsonRequest(body, input),
    method: "PATCH"
  };
}

export function adminTokenFor(input: AdminRequestInput): string {
  if (input.missingScope) {
    return ADMIN_TEST_TOKENS.missingScope;
  }

  if (input.mfa_verified === false) {
    return ADMIN_TEST_TOKENS.ownerNoMfa;
  }

  if (input.sudo_grant) {
    return input.role === "support" ? ADMIN_TEST_TOKENS.supportSudo : ADMIN_TEST_TOKENS.ownerSudo;
  }

  if (input.role === "support") {
    return ADMIN_TEST_TOKENS.support;
  }

  if (input.role === "read_only") {
    return ADMIN_TEST_TOKENS.readOnly;
  }

  return ADMIN_TEST_TOKENS.owner;
}

export async function expectOkJson(response: Response) {
  expect(response.status).toBeGreaterThanOrEqual(200);
  expect(response.status).toBeLessThan(300);
  return response.json();
}
