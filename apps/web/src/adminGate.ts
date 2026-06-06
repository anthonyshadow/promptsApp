import type { AdminGateState } from "./viewTypes";

export function getAdminGateStateFromSearch(search: string): AdminGateState {
  const state = new URLSearchParams(search).get("state");

  if (
    state === "checking" ||
    state === "expired" ||
    state === "not-admin" ||
    state === "missing-role" ||
    state === "missing-scope" ||
    state === "mfa-required" ||
    state === "authorized" ||
    state === "sudo-required"
  ) {
    return state;
  }

  return "not-signed-in";
}

export function getAdminGateCopy(state: AdminGateState): {
  status: string;
  title: string;
  body: string;
} {
  switch (state) {
    case "checking":
      return {
        status: "Checking",
        title: "Checking admin session",
        body: "The admin UI is verifying the server-side session before loading internal metadata."
      };
    case "not-signed-in":
      return {
        status: "Blocked",
        title: "Admin session required",
        body: "This internal surface requires a valid server-side admin session before any admin data can load."
      };
    case "expired":
      return {
        status: "Expired",
        title: "Admin session expired",
        body: "Sign in again to create a fresh admin session."
      };
    case "not-admin":
      return {
        status: "Blocked",
        title: "Admin role required",
        body: "The current session is signed in but does not have an admin role or action scopes."
      };
    case "missing-role":
      return {
        status: "Blocked",
        title: "Missing admin role",
        body: "The session is valid, but the stored admin user has no active admin role."
      };
    case "missing-scope":
      return {
        status: "Blocked",
        title: "Missing action scope",
        body: "The session has an admin role but lacks the scope required to read internal metadata."
      };
    case "mfa-required":
      return {
        status: "Step-up",
        title: "MFA required",
        body: "Admin access requires MFA before the API will authorize internal routes."
      };
    case "authorized":
      return {
        status: "Authorized",
        title: "Redacted admin view",
        body: "Admin metadata can load, but prompts, provider keys, and report contents remain redacted by default."
      };
    case "sudo-required":
      return {
        status: "Step-up",
        title: "Sudo required",
        body: "Dangerous actions require a reason code and time-boxed sudo before the API will proceed."
      };
  }
}
