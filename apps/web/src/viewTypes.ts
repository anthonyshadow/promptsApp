import type { HealthResponse } from "@promptopts/shared";
import type { RegistryResponse } from "./apiClient";

export type ApiState =
  | { status: "not-configured" }
  | { status: "checking" }
  | { status: "online"; health: HealthResponse; registry: RegistryResponse }
  | { status: "offline"; message: string };

export type AdminGateState =
  | "not-signed-in"
  | "not-admin"
  | "mfa-required"
  | "authorized"
  | "sudo-required";

export type NavigateHandler = (path: string) => void;
