import type { AdminGateState } from "./viewTypes";

export function getAdminGateStateFromSearch(search: string): AdminGateState {
  const state = new URLSearchParams(search).get("state");

  if (
    state === "not-admin" ||
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
    case "not-signed-in":
      return {
        status: "Blocked",
        title: "Admin session required",
        body: "This internal surface requires a valid server-side admin session before any admin data can load."
      };
    case "not-admin":
      return {
        status: "Blocked",
        title: "Admin role required",
        body: "The current session is signed in but does not have an admin role or action scopes."
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
