import { hc } from "hono/client";
import type { ApiApp } from "@promptopts/api";
import type { HealthResponse, ModelRegistryRecord } from "@promptopts/shared";

export type RegistryResponse = {
  models: ModelRegistryRecord[];
  registry_note: string;
};

export type PromptOptsApiClient = {
  health: () => Promise<HealthResponse>;
  models: () => Promise<RegistryResponse>;
};

export function createPromptOptsApiClient(baseUrl: string): PromptOptsApiClient {
  const client = hc<ApiApp>(baseUrl);

  return {
    async health() {
      const response = await client.health.$get();

      if (!response.ok) {
        throw new Error(`Health check returned ${response.status}`);
      }

      return response.json();
    },
    async models() {
      const response = await client.models.$get();

      if (!response.ok) {
        throw new Error(`Model registry returned ${response.status}`);
      }

      return (await response.json()) as unknown as RegistryResponse;
    }
  };
}
