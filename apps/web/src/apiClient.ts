import { hc } from "hono/client";
import type {
  ApiApp,
  ModelsResponse,
  PromptCreateRequest,
  PromptCreateResponse
} from "@promptopts/api";
import type { HealthResponse, Provider, StabilityStatus, TaskType } from "@promptopts/shared";

export type RegistryResponse = ModelsResponse;

export type ModelRegistryFilters = {
  provider?: Provider;
  taskType?: TaskType;
  stability?: StabilityStatus[];
};

export type PromptOptsApiClient = {
  health: () => Promise<HealthResponse>;
  models: (filters?: ModelRegistryFilters) => Promise<RegistryResponse>;
  createPrompt: (request: PromptCreateRequest) => Promise<PromptCreateResponse>;
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
    async models(filters = {}) {
      const response = await fetch(`${baseUrl}/models${createModelQuery(filters)}`);

      if (!response.ok) {
        throw new Error(`Model registry returned ${response.status}`);
      }

      return (await response.json()) as RegistryResponse;
    },
    async createPrompt(request) {
      const response = await client.prompts.$post({ json: request });

      if (!response.ok) {
        throw new Error(`Prompt save returned ${response.status}`);
      }

      return (await response.json()) as unknown as PromptCreateResponse;
    }
  };
}

function createModelQuery(filters: ModelRegistryFilters): string {
  const params = new URLSearchParams();

  if (filters.provider) {
    params.set("provider", filters.provider);
  }

  if (filters.taskType) {
    params.set("task_type", filters.taskType);
  }

  if (filters.stability && filters.stability.length > 0) {
    params.set("stability", filters.stability.join(","));
  }

  const value = params.toString();

  return value ? `?${value}` : "";
}
