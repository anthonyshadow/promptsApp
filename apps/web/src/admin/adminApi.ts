export function createLocalMockAdminHeaders(
  actionScopes = "read_metadata,manage_workspace"
): HeadersInit {
  return {
    "x-admin-session-id": "admin_session_mock",
    "x-admin-user-id": "admin_user_mock",
    "x-admin-role": "owner",
    "x-admin-mfa": "true",
    "x-admin-action-scopes": actionScopes,
    "x-admin-ip-address": "127.0.0.1",
    "x-admin-user-agent": "PromptOpts admin CRM local mock"
  };
}

export async function fetchAdminJson<TResponse>(url: string): Promise<TResponse> {
  const response = await fetch(url, {
    headers: createLocalMockAdminHeaders()
  });

  if (!response.ok) {
    throw new Error(`Admin API returned ${response.status}`);
  }

  return (await response.json()) as TResponse;
}

export async function sendAdminJson<TResponse>(
  url: string,
  method: "POST" | "PATCH",
  body: unknown
): Promise<TResponse> {
  const response = await fetch(url, {
    method,
    headers: {
      ...createLocalMockAdminHeaders(),
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Admin API returned ${response.status}`);
  }

  return (await response.json()) as TResponse;
}
