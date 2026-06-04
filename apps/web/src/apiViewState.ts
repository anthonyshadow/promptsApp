import type { ApiState } from "./viewTypes";

export function normalizeApiUrl(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.replace(/\/+$/, "");
}

export function renderApiStatus(apiState: ApiState): string {
  switch (apiState.status) {
    case "not-configured":
      return "Local mock";
    case "checking":
      return "Checking";
    case "online":
      return `${apiState.health.service} ${apiState.health.status}`;
    case "offline":
      return "Offline";
  }
}

export function getRegistryNotice(apiState: ApiState): string {
  switch (apiState.status) {
    case "online":
      return apiState.registry.registry_note;
    case "checking":
      return "Loading model registry rows from the API.";
    case "offline":
      return `Using mock registry rows. API error: ${apiState.message}`;
    case "not-configured":
      return "Using mock registry rows because VITE_API_URL is not configured.";
  }
}
