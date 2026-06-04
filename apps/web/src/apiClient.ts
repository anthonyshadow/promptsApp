import { hc } from "hono/client";
import type {
  ApiApp,
  AuditRequest,
  AuditResponse,
  ModelsResponse,
  PromptCreateRequest,
  PromptCreateResponse,
  QualityContractRequest,
  QualityContractResponse,
  TestCaseCreateRequest,
  TestCaseMutationResponse,
  TestCasePatchRequest
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
  runAudit: (request: AuditRequest) => Promise<AuditResponse>;
  getQualityContract: (projectId: string) => Promise<QualityContractResponse>;
  saveQualityContract: (
    projectId: string,
    request: QualityContractRequest
  ) => Promise<QualityContractResponse>;
  createTestCase: (
    qualityContractId: string,
    request: TestCaseCreateRequest
  ) => Promise<TestCaseMutationResponse>;
  updateTestCase: (
    testCaseId: string,
    request: TestCasePatchRequest
  ) => Promise<TestCaseMutationResponse>;
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
    },
    async runAudit(request) {
      const response = await client.audits.$post({ json: request });

      if (!response.ok) {
        throw new Error(`Audit returned ${response.status}`);
      }

      return (await response.json()) as unknown as AuditResponse;
    },
    async getQualityContract(projectId) {
      const response = await fetch(`${baseUrl}/projects/${encodeURIComponent(projectId)}/quality-contract`);

      if (!response.ok) {
        throw new Error(`Quality contract returned ${response.status}`);
      }

      return (await response.json()) as QualityContractResponse;
    },
    async saveQualityContract(projectId, request) {
      const response = await fetch(`${baseUrl}/projects/${encodeURIComponent(projectId)}/quality-contract`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`Quality contract save returned ${response.status}`);
      }

      return (await response.json()) as QualityContractResponse;
    },
    async createTestCase(qualityContractId, request) {
      const response = await fetch(
        `${baseUrl}/quality-contracts/${encodeURIComponent(qualityContractId)}/test-cases`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(request)
        }
      );

      if (!response.ok) {
        throw new Error(`Test case create returned ${response.status}`);
      }

      return (await response.json()) as TestCaseMutationResponse;
    },
    async updateTestCase(testCaseId, request) {
      const response = await fetch(`${baseUrl}/test-cases/${encodeURIComponent(testCaseId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`Test case update returned ${response.status}`);
      }

      return (await response.json()) as TestCaseMutationResponse;
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
