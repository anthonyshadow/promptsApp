import type { PromptOptsRepository, RedactionState, ReportArtifactStorage } from "@promptopts/shared";
import type { AdminActionScope, AdminRole, AdminRouteScope } from "./scopes";

export type AdminSudoGrant = {
  request_id: string;
  reason_code: string;
  expires_at: string;
  action_scope: AdminActionScope;
};

export type AdminSession = {
  session_id: string;
  admin_user_id: string;
  role: AdminRole;
  mfa_verified: boolean;
  mfa_verified_at: string | null;
  expires_at: string;
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
  reportArtifactStorage: ReportArtifactStorage;
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
