import { hc } from "hono/client";
import type {
  ApiApp,
  AuditRequest,
  AuditResponse,
  EvalRunCreateRequest,
  EvalRunDetailResponse,
  ModelsResponse,
  PromptCreateRequest,
  PromptCreateResponse,
  PromptOptimizeRequest,
  PromptOptimizeResponse,
  QualityContractRequest,
  QualityContractResponse,
  ReportCreateRequest,
  ReportDetailResponse,
  ReportExportResponse,
  TestCaseCreateRequest,
  TestCaseMutationResponse,
  TestCasePatchRequest,
  WorkspaceDashboardResponse
} from "@promptopts/api";
import type { ModelModality } from "@promptopts/model-registry";
import type { EvalRun, HealthResponse, Provider, StabilityStatus, TaskType } from "@promptopts/shared";

export type RegistryResponse = ModelsResponse;

export type ModelRegistryFilters = {
  provider?: Provider;
  taskType?: TaskType;
  modality?: ModelModality;
  stability?: StabilityStatus[];
  supportsStructuredOutput?: boolean;
  supportsTools?: boolean;
};

export type PromptOptsApiClient = {
  health: () => Promise<HealthResponse>;
  models: (filters?: ModelRegistryFilters) => Promise<RegistryResponse>;
  getWorkspaceDashboard: (workspaceSlug: string) => Promise<WorkspaceDashboardResponse>;
  createPrompt: (request: PromptCreateRequest) => Promise<PromptCreateResponse>;
  optimizePrompt: (
    promptId: string,
    request: PromptOptimizeRequest
  ) => Promise<PromptOptimizeResponse>;
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
  createEvalRun: (request: EvalRunCreateRequest) => Promise<EvalRun>;
  getEvalRun: (evalRunId: string) => Promise<EvalRunDetailResponse>;
  createReport: (request: ReportCreateRequest) => Promise<ReportDetailResponse["report"]>;
  getReport: (reportId: string) => Promise<ReportDetailResponse>;
  exportReport: (reportId: string, format: "markdown" | "json" | "pdf") => Promise<ReportExportResponse>;
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
    async getWorkspaceDashboard(workspaceSlug) {
      const response = await fetch(
        `${baseUrl}/workspaces/${encodeURIComponent(workspaceSlug)}/dashboard`
      );

      if (!response.ok) {
        throw new Error(`Workspace dashboard returned ${response.status}`);
      }

      return (await response.json()) as WorkspaceDashboardResponse;
    },
    async createPrompt(request) {
      const response = await client.prompts.$post({ json: request });

      if (!response.ok) {
        throw new Error(`Prompt save returned ${response.status}`);
      }

      return (await response.json()) as unknown as PromptCreateResponse;
    },
    async optimizePrompt(promptId, request) {
      const response = await fetch(`${baseUrl}/prompts/${encodeURIComponent(promptId)}/optimize`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`Prompt optimize returned ${response.status}`);
      }

      return (await response.json()) as PromptOptimizeResponse;
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
    },
    async createEvalRun(request) {
      const response = await client["eval-runs"].$post({ json: request });

      if (!response.ok) {
        throw new Error(`Eval run create returned ${response.status}`);
      }

      return (await response.json()) as unknown as EvalRun;
    },
    async getEvalRun(evalRunId) {
      const response = await fetch(`${baseUrl}/eval-runs/${encodeURIComponent(evalRunId)}`);

      if (!response.ok) {
        throw new Error(`Eval run detail returned ${response.status}`);
      }

      return (await response.json()) as EvalRunDetailResponse;
    },
    async createReport(request) {
      const response = await fetch(`${baseUrl}/reports`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`Report create returned ${response.status}`);
      }

      return (await response.json()) as ReportDetailResponse["report"];
    },
    async getReport(reportId) {
      const response = await fetch(`${baseUrl}/reports/${encodeURIComponent(reportId)}`);

      if (!response.ok) {
        throw new Error(`Report detail returned ${response.status}`);
      }

      return (await response.json()) as ReportDetailResponse;
    },
    async exportReport(reportId, format) {
      const response = await fetch(
        `${baseUrl}/reports/${encodeURIComponent(reportId)}/export?format=${encodeURIComponent(format)}`
      );

      if (!response.ok) {
        throw new Error(`Report export returned ${response.status}`);
      }

      return (await response.json()) as ReportExportResponse;
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

  if (filters.modality) {
    params.set("modality", filters.modality);
  }

  if (filters.supportsStructuredOutput !== undefined) {
    params.set("supportsStructuredOutput", String(filters.supportsStructuredOutput));
  }

  if (filters.supportsTools !== undefined) {
    params.set("supportsTools", String(filters.supportsTools));
  }

  const value = params.toString();

  return value ? `?${value}` : "";
}
