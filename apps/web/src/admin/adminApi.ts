type AdminRequestOptions = {
  actionScopes?: string;
  sudoReasonCode?: string;
};

const ADMIN_SESSION_STORAGE_KEY = "promptopts.admin.sessionToken";

export type AdminAuthMe = {
  authenticated: boolean;
  admin_user_id: string | null;
  role: "owner" | "ops" | "support" | "finance" | "read_only" | null;
  mfa_verified: boolean;
  action_scopes: string[];
  expires_at: string | null;
};

export class AdminApiError extends Error {
  constructor(
    readonly status: number,
    message: string
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

  if (options.sudoReasonCode) {
    // Sudo is server-side and durable; this option is preserved only so call sites can keep reason-coded bodies.
  }

  return readAdminResponse<TResponse>(response);
}

async function readAdminResponse<TResponse = unknown>(response: Response): Promise<TResponse> {
  if (!response.ok) {
    throw new AdminApiError(response.status, `Admin API returned ${response.status}`);
  }

  return (await response.json()) as TResponse;
}
