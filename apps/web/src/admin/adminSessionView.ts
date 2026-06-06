import type { AdminSudoStatusResponse } from "@promptopts/api";
import type { AdminGateState } from "../viewTypes";
import {
  AdminApiError,
  clearAdminSessionToken,
  fetchAdminMe,
  fetchAdminSudoStatus,
  getStoredAdminSessionToken
} from "./adminApi";

export async function refreshAdminSession(
  apiBaseUrl: string,
  setGateState: (state: AdminGateState) => void,
  setAuthError: (error: string | null) => void
) {
  if (!getStoredAdminSessionToken()) {
    setGateState("not-signed-in");
    return;
  }

  try {
    const session = await fetchAdminMe(apiBaseUrl);
    if (!session.authenticated) {
      setGateState("not-signed-in");
    } else if (!session.mfa_verified) {
      setGateState("mfa-required");
    } else if (!session.role) {
      setGateState("missing-role");
    } else if (!session.action_scopes.includes("read_metadata")) {
      setGateState("missing-scope");
    } else {
      setGateState("authorized");
    }
    setAuthError(null);
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      clearAdminSessionToken();
      setGateState("expired");
      return;
    }

    if (error instanceof AdminApiError && error.status === 403) {
      setGateState("not-admin");
      return;
    }

    setAuthError("Admin API is unavailable.");
    setGateState("not-signed-in");
  }
}

export async function refreshSudoStatus(
  apiBaseUrl: string,
  setSudoStatus: (status: AdminSudoStatusResponse | null) => void,
  setSudoMessage: (message: string | null) => void
) {
  try {
    const status = await fetchAdminSudoStatus(apiBaseUrl);
    setSudoStatus(status);
    if (status.expired_count > 0) {
      setSudoMessage("Expired sudo was rejected and marked expired.");
    }
  } catch {
    setSudoStatus(null);
  }
}
