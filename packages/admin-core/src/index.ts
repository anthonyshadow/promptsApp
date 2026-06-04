import type { Context, MiddlewareHandler } from "hono";
import type {
  AdminActionScope as SharedAdminActionScope,
  AdminAuditLog,
  PromptOptsRepository,
  RedactionState
} from "@promptopts/shared";

export const adminRoles = ["owner", "ops", "support", "finance", "read_only"] as const;
export type AdminRole = (typeof adminRoles)[number];

export const adminActionScopes = [
  "read_metadata",
  "reveal_prompt",
  "manage_workspace",
  "manage_model_registry",
  "retry_eval",
  "delete_report",
  "issue_billing_credit",
  "impersonate_user",
  "revoke_user",
  "break_glass"
] as const satisfies readonly SharedAdminActionScope[];
export type AdminActionScope = (typeof adminActionScopes)[number];

export const adminRouteScopes = [
  "overview",
  "accounts",
  "users",
  "workspaces",
  "eval_runs",
  "models",
  "reports",
  "billing",
  "audit_logs",
  "prompt_reveal",
  "impersonation",
  "break_glass"
] as const;
export type AdminRouteScope = (typeof adminRouteScopes)[number];

export type AdminSudoGrant = {
  request_id: string;
  reason_code: string;
  expires_at: string;
};

export type AdminSession = {
  session_id: string;
  admin_user_id: string;
  role: AdminRole;
  mfa_verified: boolean;
  action_scopes: AdminActionScope[];
  sudo_grant: AdminSudoGrant | null;
  ip_address: string;
  user_agent: string;
  is_mock: boolean;
};

export type AdminActionContext = {
  admin_user_id: string;
  session_id: string;
  role: AdminRole;
  workspace_id: string | null;
  account_id: string | null;
  route_scope: AdminRouteScope;
  action_scope: AdminActionScope;
  reason_code: string;
  sudo_request_id: string | null;
  ip_address: string;
  user_agent: string;
  redaction_state: RedactionState;
  is_mock: boolean;
};

export type AdminRoutePolicy = {
  route_scope: AdminRouteScope;
  action_scope: AdminActionScope;
  sensitive_read: boolean;
  requires_sudo: boolean;
};

export type AdminSecurityVariables = {
  repository: PromptOptsRepository;
  adminSession: AdminSession;
  adminActionContext: AdminActionContext;
};

export type AdminSecurityHonoEnv = {
  Variables: AdminSecurityVariables;
};

export type MockAdminSessionInput = Partial<
  Omit<AdminSession, "sudo_grant" | "action_scopes">
> & {
  action_scopes?: AdminActionScope[];
  sudo_grant?: Partial<AdminSudoGrant> | null;
};

const roleActionScopes: Record<AdminRole, AdminActionScope[]> = {
  owner: [...adminActionScopes],
  ops: [
    "read_metadata",
    "manage_workspace",
    "manage_model_registry",
    "retry_eval",
    "delete_report",
    "revoke_user"
  ],
  support: ["read_metadata", "retry_eval", "revoke_user"],
  finance: ["read_metadata", "issue_billing_credit"],
  read_only: ["read_metadata"]
};

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

export function redactPromptPreview(prompt: string): string {
  const length = normalizeWhitespace(prompt).length;
  return `Prompt redacted (${length} chars)`;
}

export function redactReportPreview(report: string): string {
  const length = normalizeWhitespace(report).length;
  return `Report redacted (${length} chars)`;
}

export function redactProviderError(error: string): string {
  return normalizeWhitespace(error)
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/sk-[A-Za-z0-9_-]{6,}/gi, "sk-[redacted]")
    .replace(/(api[_-]?key|token|secret)\s*[=:]\s*["']?[^"',\s]+/gi, "$1=[redacted]")
    .slice(0, 240);
}

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

export function resolveAdminRoutePolicy(method: string, path: string): AdminRoutePolicy {
  const normalizedMethod = method.toUpperCase();
  const normalizedPath = path.replace(/\/+$/, "");

  if (normalizedPath.match(/^\/admin-api\/prompts\/[^/]+\/reveal$/)) {
    return {
      route_scope: "prompt_reveal",
      action_scope: "reveal_prompt",
      sensitive_read: true,
      requires_sudo: true
    };
  }

  if (normalizedPath.match(/^\/admin-api\/users\/[^/]+\/impersonate$/)) {
    return {
      route_scope: "impersonation",
      action_scope: "impersonate_user",
      sensitive_read: false,
      requires_sudo: true
    };
  }

  if (normalizedPath === "/admin-api/break-glass") {
    return {
      route_scope: "break_glass",
      action_scope: "break_glass",
      sensitive_read: false,
      requires_sudo: true
    };
  }

  if (normalizedPath.includes("/reports/") && normalizedPath.endsWith("/delete")) {
    return {
      route_scope: "reports",
      action_scope: "delete_report",
      sensitive_read: false,
      requires_sudo: true
    };
  }

  if (normalizedPath.includes("/billing/") && normalizedPath.endsWith("/credit")) {
    return {
      route_scope: "billing",
      action_scope: "issue_billing_credit",
      sensitive_read: false,
      requires_sudo: true
    };
  }

  if (normalizedPath.includes("/models/") && normalizedMethod !== "GET") {
    return {
      route_scope: "models",
      action_scope: "manage_model_registry",
      sensitive_read: false,
      requires_sudo: true
    };
  }

  if (normalizedPath.includes("/eval-runs/") && normalizedMethod === "POST") {
    return {
      route_scope: "eval_runs",
      action_scope: "retry_eval",
      sensitive_read: false,
      requires_sudo: false
    };
  }

  if (normalizedPath.includes("/users/") && normalizedMethod === "POST") {
    return {
      route_scope: "users",
      action_scope: "revoke_user",
      sensitive_read: false,
      requires_sudo: false
    };
  }

  if (normalizedPath.includes("/accounts") && normalizedMethod !== "GET") {
    return {
      route_scope: "accounts",
      action_scope: "manage_workspace",
      sensitive_read: false,
      requires_sudo: false
    };
  }

  if (normalizedPath.includes("/workspaces") && normalizedMethod !== "GET") {
    return {
      route_scope: "workspaces",
      action_scope: "manage_workspace",
      sensitive_read: false,
      requires_sudo: false
    };
  }

  if (normalizedPath === "/admin-api/audit-logs") {
    return {
      route_scope: "audit_logs",
      action_scope: "read_metadata",
      sensitive_read: true,
      requires_sudo: false
    };
  }

  if (normalizedPath.includes("/billing")) {
    return readPolicy("billing");
  }

  if (normalizedPath.includes("/reports")) {
    return readPolicy("reports");
  }

  if (normalizedPath.includes("/models")) {
    return readPolicy("models");
  }

  if (normalizedPath.includes("/eval-runs")) {
    return {
      ...readPolicy("eval_runs"),
      sensitive_read: normalizedPath !== "/admin-api/eval-runs"
    };
  }

  if (normalizedPath.includes("/users")) {
    return readPolicy("users");
  }

  if (normalizedPath.includes("/accounts")) {
    return readPolicy("accounts");
  }

  return readPolicy("overview");
}

export function canUseActionScope(session: AdminSession, actionScope: AdminActionScope): boolean {
  return roleActionScopes[session.role].includes(actionScope) && session.action_scopes.includes(actionScope);
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

function readSudoGrant(c: Context<AdminSecurityHonoEnv>): AdminSudoGrant | null {
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

function readPolicy(route_scope: AdminRouteScope): AdminRoutePolicy {
  return {
    route_scope,
    action_scope: "read_metadata",
    sensitive_read: false,
    requires_sudo: false
  };
}

function extractTargetId(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts.at(-1) ?? path;
}

function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && (adminRoles as readonly string[]).includes(value);
}

function isAdminActionScope(value: unknown): value is AdminActionScope {
  return typeof value === "string" && (adminActionScopes as readonly string[]).includes(value);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function createAuditId(): string {
  return `admin_audit_log_${crypto.randomUUID().replaceAll("-", "")}`;
}
