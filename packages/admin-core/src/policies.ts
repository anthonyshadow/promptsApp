import type { AdminRoutePolicy } from "./types";
import type { AdminRouteScope } from "./scopes";

// Server-side route policies are the source of truth for sudo and sensitive-read audit behavior.
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

function readPolicy(route_scope: AdminRouteScope): AdminRoutePolicy {
  return {
    route_scope,
    action_scope: "read_metadata",
    sensitive_read: false,
    requires_sudo: false
  };
}
