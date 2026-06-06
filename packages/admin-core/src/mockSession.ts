import { roleActionScopes } from "./scopes";
import type { AdminSession, MockAdminSessionInput } from "./types";

export function createMockAdminSession(input: MockAdminSessionInput = {}): AdminSession {
  const role = input.role ?? "owner";
  const now = Date.now();
  const sudoGrant = input.sudo_grant
    ? {
        request_id: input.sudo_grant.request_id ?? "sudo_request_mock",
        reason_code: input.sudo_grant.reason_code ?? "mock_sudo_reason",
        expires_at: input.sudo_grant.expires_at ?? new Date(now + 15 * 60 * 1000).toISOString(),
        action_scope: input.sudo_grant.action_scope ?? "delete_report"
      }
    : null;

  return {
    session_id: input.session_id ?? "admin_session_mock",
    admin_user_id: input.admin_user_id ?? "admin_user_mock",
    role,
    mfa_verified: input.mfa_verified ?? true,
    mfa_verified_at: input.mfa_verified === false ? null : new Date(now).toISOString(),
    expires_at: input.expires_at ?? new Date(now + 8 * 60 * 60 * 1000).toISOString(),
    action_scopes: input.action_scopes ?? roleActionScopes[role],
    sudo_grant: sudoGrant,
    ip_address: input.ip_address ?? "127.0.0.1",
    user_agent: input.user_agent ?? "PromptOpts admin test session",
    is_mock: input.is_mock ?? true
  };
}
