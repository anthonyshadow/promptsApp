import type { Context, MiddlewareHandler } from "hono";
import type { AdminAuditLog } from "@promptopts/shared";
import {
  canUseActionScope,
  isAdminActionScope,
  isAdminRole,
  roleActionScopes,
  type AdminActionScope
} from "./scopes";
import { resolveAdminRoutePolicy } from "./policies";
import type {
  AdminActionContext,
  AdminRoutePolicy,
  AdminSecurityHonoEnv,
  AdminSession
} from "./types";

export const requireSession: MiddlewareHandler<AdminSecurityHonoEnv> = async (c, next) => {
  const session = readAdminSession(c);

  if (!session) {
    return adminSecurityError(c, 401, "session_required", "Admin session required");
  }

  c.set("adminSession", session);
  await next();
};

export const requireMfa: MiddlewareHandler<AdminSecurityHonoEnv> = async (c, next) => {
  if (!c.var.adminSession.mfa_verified) {
    return adminSecurityError(c, 403, "mfa_required", "Admin MFA required");
  }

  await next();
};

export const requireAdminRole: MiddlewareHandler<AdminSecurityHonoEnv> = async (c, next) => {
  if (!isAdminRole(c.var.adminSession.role)) {
    return adminSecurityError(c, 403, "admin_role_required", "Admin role required");
  }

  await next();
};

export const requireActionScope: MiddlewareHandler<AdminSecurityHonoEnv> = async (c, next) => {
  const policy = resolveAdminRoutePolicy(c.req.method, c.req.path);
  const session = c.var.adminSession;

  if (!canUseActionScope(session, policy.action_scope)) {
    return adminSecurityError(c, 403, "action_scope_required", "Admin action scope required");
  }

  c.set("adminActionContext", createAdminActionContext(session, policy));
  await next();
};

export function requireSudo(action?: AdminActionScope): MiddlewareHandler<AdminSecurityHonoEnv> {
  return async (c, next) => {
    const policy = resolveAdminRoutePolicy(c.req.method, c.req.path);
    const requiredAction = action ?? policy.action_scope;

    if (!policy.requires_sudo && !action) {
      await next();
      return;
    }

    if (!canUseActionScope(c.var.adminSession, requiredAction)) {
      return adminSecurityError(c, 403, "action_scope_required", "Admin action scope required");
    }

    const sudoGrant = c.var.adminSession.sudo_grant;
    if (!sudoGrant || Date.parse(sudoGrant.expires_at) <= Date.now()) {
      return adminSecurityError(c, 403, "sudo_required", "Sudo authorization required");
    }

    if (!sudoGrant.reason_code) {
      return adminSecurityError(c, 400, "reason_code_required", "Reason code required");
    }

    c.set("adminActionContext", {
      ...c.var.adminActionContext,
      action_scope: requiredAction,
      reason_code: sudoGrant.reason_code,
      sudo_request_id: sudoGrant.request_id,
      redaction_state: "redacted"
    });

    await next();
  };
}

export function writeAdminAuditEvent(
  options: {
    createId?: () => string;
    now?: () => string;
  } = {}
): MiddlewareHandler<AdminSecurityHonoEnv> {
  return async (c, next) => {
    await next();

    const policy = resolveAdminRoutePolicy(c.req.method, c.req.path);
    if (!shouldWriteAuditEvent(c.req.method, policy) || c.res.status >= 500) {
      return;
    }

    const actionContext = c.var.adminActionContext;
    const auditLog: AdminAuditLog = {
      id: options.createId?.() ?? createAuditId(),
      admin_user_id: actionContext.admin_user_id,
      workspace_id: actionContext.workspace_id,
      account_id: actionContext.account_id,
      target_type: actionContext.route_scope,
      target_id: extractTargetId(c.req.path),
      action: `${c.req.method.toLowerCase()} ${c.req.path}`,
      action_scope: actionContext.action_scope,
      reason_code: actionContext.reason_code,
      sudo_request_id: actionContext.sudo_request_id,
      ip_address: actionContext.ip_address,
      user_agent: actionContext.user_agent,
      redaction_state: "redacted",
      metadata: {
        route_scope: actionContext.route_scope,
        status: c.res.status,
        sensitive_read: policy.sensitive_read,
        mocked: actionContext.is_mock
      },
      is_mock: actionContext.is_mock,
      created_at: options.now?.() ?? new Date().toISOString()
    };

    await c.var.repository.admin_audit_logs.append(auditLog);
  };
}

function readAdminSession(c: Context<AdminSecurityHonoEnv>): AdminSession | undefined {
  const adminUserId = c.req.header("x-admin-user-id");
  const sessionId = c.req.header("x-admin-session-id");
  const role = c.req.header("x-admin-role");

  if (!adminUserId || !sessionId || !isAdminRole(role)) {
    return undefined;
  }

  return {
    session_id: sessionId,
    admin_user_id: adminUserId,
    role,
    mfa_verified: c.req.header("x-admin-mfa") === "true",
    action_scopes: parseActionScopes(c.req.header("x-admin-action-scopes")) ?? roleActionScopes[role],
    sudo_grant: readSudoGrant(c),
    ip_address: c.req.header("x-admin-ip-address") ?? "127.0.0.1",
    user_agent: c.req.header("x-admin-user-agent") ?? c.req.header("user-agent") ?? "unknown",
    is_mock: true
  };
}

function readSudoGrant(c: Context<AdminSecurityHonoEnv>): AdminSession["sudo_grant"] {
  const requestId = c.req.header("x-admin-sudo-request-id");
  const reasonCode = c.req.header("x-admin-sudo-reason-code");
  const expiresAt = c.req.header("x-admin-sudo-expires-at");

  if (!requestId || !reasonCode || !expiresAt) {
    return null;
  }

  return {
    request_id: requestId,
    reason_code: reasonCode,
    expires_at: expiresAt
  };
}

function parseActionScopes(value: string | undefined): AdminActionScope[] | undefined {
  if (!value) {
    return undefined;
  }

  const scopes = value
    .split(",")
    .map((scope) => scope.trim())
    .filter((scope): scope is AdminActionScope => isAdminActionScope(scope));

  return scopes.length > 0 ? scopes : undefined;
}

function createAdminActionContext(
  session: AdminSession,
  policy: AdminRoutePolicy
): AdminActionContext {
  return {
    admin_user_id: session.admin_user_id,
    session_id: session.session_id,
    role: session.role,
    workspace_id: null,
    account_id: null,
    route_scope: policy.route_scope,
    action_scope: policy.action_scope,
    reason_code: session.sudo_grant?.reason_code ?? "admin_route_access",
    sudo_request_id: null,
    ip_address: session.ip_address,
    user_agent: session.user_agent,
    redaction_state: "redacted",
    is_mock: session.is_mock
  };
}

function shouldWriteAuditEvent(method: string, policy: AdminRoutePolicy): boolean {
  return method.toUpperCase() !== "GET" || policy.sensitive_read;
}

function adminSecurityError(
  c: Context<AdminSecurityHonoEnv>,
  status: 400 | 401 | 403,
  code: string,
  message: string
): Response {
  return c.json(
    {
      error: {
        code,
        message
      }
    },
    status
  );
}

function extractTargetId(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts.at(-1) ?? path;
}

function createAuditId(): string {
  return `admin_audit_log_${crypto.randomUUID().replaceAll("-", "")}`;
}
