import type { AdminActionScope as SharedAdminActionScope } from "@promptopts/shared";
import type { AdminSession } from "./types";

export const adminRoles = ["owner", "ops", "support", "finance", "read_only"] as const;
export type AdminRole = (typeof adminRoles)[number];

export const adminActionScopes = [
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
  "provider_connections",
  "prompt_reveal",
  "impersonation",
  "break_glass"
] as const;
export type AdminRouteScope = (typeof adminRouteScopes)[number];

export const roleActionScopes: Record<AdminRole, AdminActionScope[]> = {
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

export function canUseActionScope(session: AdminSession, actionScope: AdminActionScope): boolean {
  return roleActionScopes[session.role].includes(actionScope) && session.action_scopes.includes(actionScope);
}

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && (adminRoles as readonly string[]).includes(value);
}

export function isAdminActionScope(value: unknown): value is AdminActionScope {
  return typeof value === "string" && (adminActionScopes as readonly string[]).includes(value);
}
