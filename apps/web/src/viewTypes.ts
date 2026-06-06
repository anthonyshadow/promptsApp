import type { HealthResponse } from "@promptopts/shared";
import type { RegistryResponse } from "./apiClient";

export type ApiState =
  | { status: "not-configured" }
  | { status: "checking" }
  | { status: "online"; health: HealthResponse; registry: RegistryResponse }
  | { status: "offline"; message: string };

export type AdminGateState =
  | "checking"
  | "not-signed-in"
  | "expired"
  | "not-admin"
  | "missing-role"
  | "missing-scope"
  | "mfa-required"
  | "authorized"
  | "sudo-required";

export type NavigateHandler = (path: string) => void;
