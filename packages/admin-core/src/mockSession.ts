import { roleActionScopes } from "./scopes";
import type { AdminSession, MockAdminSessionInput } from "./types";

export function createMockAdminSession(input: MockAdminSessionInput = {}): AdminSession {
  const role = input.role ?? "owner";
  const now = Date.now();
  const sudoGrant = input.sudo_grant
    ? {
        request_id: input.sudo_grant.request_id ?? "sudo_request_mock",
        reason_code: input.sudo_grant.reason_code ?? "mock_sudo_reason",
        expires_at: input.sudo_grant.expires_at ?? new Date(now + 15 * 60 * 1000).toISOString()
      }
    : null;

  return {
    session_id: input.session_id ?? "admin_session_mock",
    admin_user_id: input.admin_user_id ?? "admin_user_mock",
    role,
    mfa_verified: input.mfa_verified ?? true,
    action_scopes: input.action_scopes ?? roleActionScopes[role],
    sudo_grant: sudoGrant,
    ip_address: input.ip_address ?? "127.0.0.1",
    user_agent: input.user_agent ?? "PromptOpts admin test session",
    is_mock: input.is_mock ?? true
  };
}

export function createMockAdminHeaders(input: MockAdminSessionInput = {}): HeadersInit {
  const session = createMockAdminSession(input);
  const headers: Record<string, string> = {
    "x-admin-session-id": session.session_id,
    "x-admin-user-id": session.admin_user_id,
    "x-admin-role": session.role,
    "x-admin-mfa": String(session.mfa_verified),
    "x-admin-action-scopes": session.action_scopes.join(","),
    "x-admin-ip-address": session.ip_address,
    "x-admin-user-agent": session.user_agent
  };

  if (session.sudo_grant) {
    headers["x-admin-sudo-request-id"] = session.sudo_grant.request_id;
    headers["x-admin-sudo-reason-code"] = session.sudo_grant.reason_code;
    headers["x-admin-sudo-expires-at"] = session.sudo_grant.expires_at;
  }

  return headers;
}
