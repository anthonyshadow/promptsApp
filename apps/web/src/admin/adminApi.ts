import type {
  AdminSudoEndResponse,
  AdminSudoStartResponse,
  AdminSudoStatusResponse
} from "@promptopts/api";
import type { AdminActionScope } from "@promptopts/shared";

type AdminRequestOptions = {
  actionScopes?: string;
  sudoReasonCode?: string;
  targetType?: string | null;
  targetId?: string | null;
};

const ADMIN_SESSION_STORAGE_KEY = "promptopts.admin.sessionToken";
export const ADMIN_SUDO_REQUIRED_EVENT = "promptopts:admin-sudo-required";

export type AdminAuthMe = {
  authenticated: boolean;
  admin_user_id: string | null;
  role: "owner" | "ops" | "support" | "finance" | "read_only" | null;
  mfa_verified: boolean;
  action_scopes: string[];
  expires_at: string | null;
};

export type AdminSudoRequiredEventDetail = {
  actionScope: AdminActionScope;
  suggestedReasonCode: string;
  targetType: string | null;
  targetId: string | null;
  message: string;
};

export class AdminApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string | null = null
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

export function getStoredAdminSessionToken(): string | null {
  return window.localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
}

export function storeAdminSessionToken(token: string): void {
  window.localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, token);
}

export function clearAdminSessionToken(): void {
  window.localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
}

export function createAdminAuthHeaders(): HeadersInit {
  const token = getStoredAdminSessionToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

export async function loginAdmin(apiBaseUrl: string, input: { email: string; password: string }) {
  const response = await fetch(`${apiBaseUrl}/admin-api/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });

  const body = await readAdminResponse<{ token: string }>(response);
  storeAdminSessionToken(body.token);
  return body;
}

export async function verifyAdminMfa(apiBaseUrl: string, code: string) {
  const response = await fetch(`${apiBaseUrl}/admin-api/auth/mfa/verify`, {
    method: "POST",
    headers: {
      ...createAdminAuthHeaders(),
      "content-type": "application/json"
    },
    body: JSON.stringify({ code })
  });

  const body = await readAdminResponse<{ token: string }>(response);
  storeAdminSessionToken(body.token);
  return body;
}

export async function fetchAdminMe(apiBaseUrl: string): Promise<AdminAuthMe> {
  const response = await fetch(`${apiBaseUrl}/admin-api/auth/me`, {
    headers: createAdminAuthHeaders()
  });

  return readAdminResponse<AdminAuthMe>(response);
}

export async function logoutAdmin(apiBaseUrl: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/admin-api/auth/logout`, {
    method: "POST",
    headers: createAdminAuthHeaders()
  });

  await readAdminResponse(response);
  clearAdminSessionToken();
}

export async function fetchAdminSudoStatus(apiBaseUrl: string): Promise<AdminSudoStatusResponse> {
  const response = await fetch(`${apiBaseUrl}/admin-api/sudo/status`, {
    headers: createAdminAuthHeaders()
  });

  return readAdminResponse<AdminSudoStatusResponse>(response);
}

export async function startAdminSudo(
  apiBaseUrl: string,
  input: {
    actionScope: AdminActionScope;
    reasonCode: string;
    mfaCode: string;
    targetType: string | null;
    targetId: string | null;
  }
): Promise<AdminSudoStartResponse> {
  const response = await fetch(`${apiBaseUrl}/admin-api/sudo/start`, {
    method: "POST",
    headers: {
      ...createAdminAuthHeaders(),
      "content-type": "application/json"
    },
    body: JSON.stringify({
      action_scope: input.actionScope,
      reason_code: input.reasonCode,
      mfa_code: input.mfaCode,
      target_type: input.targetType,
      target_id: input.targetId
    })
  });

  return readAdminResponse<AdminSudoStartResponse>(response);
}

export async function endAdminSudo(
  apiBaseUrl: string,
  input: { actionScope?: AdminActionScope; reasonCode: string }
): Promise<AdminSudoEndResponse> {
  const response = await fetch(`${apiBaseUrl}/admin-api/sudo/end`, {
    method: "POST",
    headers: {
      ...createAdminAuthHeaders(),
      "content-type": "application/json"
    },
    body: JSON.stringify({
      action_scope: input.actionScope,
      reason_code: input.reasonCode
    })
  });

  return readAdminResponse<AdminSudoEndResponse>(response);
}

export async function fetchAdminJson<TResponse>(url: string): Promise<TResponse> {
  const response = await fetch(url, {
    headers: createAdminAuthHeaders()
  });
  return readAdminResponse<TResponse>(response);
}

export async function sendAdminJson<TResponse>(
  url: string,
  method: "POST" | "PATCH",
  body: unknown,
  options: AdminRequestOptions = {}
): Promise<TResponse> {
  const response = await fetch(url, {
    method,
    headers: {
      ...createAdminAuthHeaders(),
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  try {
    return await readAdminResponse<TResponse>(response);
  } catch (error) {
    if (error instanceof AdminApiError && error.code === "sudo_required") {
      requestAdminSudo({
        actionScope: parsePrimaryActionScope(options.actionScopes),
        suggestedReasonCode: options.sudoReasonCode ?? "admin_step_up",
        targetType: options.targetType ?? null,
        targetId: options.targetId ?? null,
        message: error.message
      });
    }

    throw error;
  }
}

export function requestAdminSudo(detail: AdminSudoRequiredEventDetail): void {
  window.dispatchEvent(new CustomEvent<AdminSudoRequiredEventDetail>(ADMIN_SUDO_REQUIRED_EVENT, { detail }));
}

async function readAdminResponse<TResponse = unknown>(response: Response): Promise<TResponse> {
  const body = await readJsonBody(response);

  if (!response.ok) {
    const errorBody = parseAdminErrorBody(body);
    throw new AdminApiError(
      response.status,
      errorBody.message ?? `Admin API returned ${response.status}`,
      errorBody.code
    );
  }

  return body as TResponse;
}

async function readJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}

function parseAdminErrorBody(body: unknown): { code: string | null; message: string | null } {
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    body.error &&
    typeof body.error === "object"
  ) {
    const error = body.error as { code?: unknown; message?: unknown };
    return {
      code: typeof error.code === "string" ? error.code : null,
      message: typeof error.message === "string" ? error.message : null
    };
  }

  return { code: null, message: null };
}

function parsePrimaryActionScope(actionScopes: string | undefined): AdminActionScope {
  const scopes = (actionScopes ?? "")
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
  const primaryScope = scopes.find((scope) => scope !== "read_metadata") ?? scopes[0];

  return isAdminActionScope(primaryScope) ? primaryScope : "break_glass";
}

function isAdminActionScope(value: unknown): value is AdminActionScope {
  return (
    value === "read_metadata" ||
    value === "reveal_prompt" ||
    value === "reveal_report" ||
    value === "manage_workspace" ||
    value === "manage_model_registry" ||
    value === "retry_eval" ||
    value === "delete_report" ||
    value === "issue_billing_credit" ||
    value === "impersonate_user" ||
    value === "revoke_user" ||
    value === "break_glass"
  );
}
