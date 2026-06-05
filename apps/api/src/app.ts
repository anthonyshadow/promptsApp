import { Hono } from "hono";
import { cors } from "hono/cors";
import { createDemoRepositorySeed, createMemoryRepository } from "@promptopts/shared";
import { createAdminApiRoutes } from "./adminRoutes";
import { injectRepository, type ApiEnv, type AppDependencies } from "./context";
import { createPublicApiRoutes } from "./publicRoutes";

export function createApp(dependencies: AppDependencies = {}) {
  const repository = dependencies.repository ?? createMemoryRepository(createDemoRepositorySeed());

  return new Hono<ApiEnv>()
    .use("*", cors())
    .use("*", injectRepository(repository))
    .route("/", createPublicApiRoutes())
    .route("/admin-api", createAdminApiRoutes());
}

export const app = createApp();
export type ApiApp = typeof app;
export type {
  AuditRequest,
  AuditResponse,
  AccountNoteCreateRequest,
  AccountNoteCreateResponse,
  AccountTaskCreateRequest,
  AccountTaskCreateResponse,
  AdminAccountDetailResponse,
  AdminAccountsResponse,
  AdminEvalRunDetailResponse,
  AdminEvalRunsResponse,
  AdminModelRegistryResponse,
  AdminOverviewResponse,
  ModelApproveResponse,
  ModelPatchResponse,
  ModelsResponse,
  ReportExportActionResponse,
  ReportDeleteResponse,
  ReportRevealResponse,
  ReportPrivacyState,
  EvalRunCreateRequest,
  EvalRunDetailResponse,
  RecommendationDecisionResponse,
  ReportCreateRequest,
  ReportDetailResponse,
  ReportExportResponse,
  AdminReportsResponse,
  AuditLogsResponse,
  BillingResponse,
  BillingCreditResponse,
  PromptOptimizeRequest,
  PromptOptimizeResponse,
  PromptCreateRequest,
  PromptCreateResponse,
  QualityContractRequest,
  QualityContractResponse,
  TestCaseCreateRequest,
  TestCaseMutationResponse,
  TestCasePatchRequest,
  WorkspaceDashboardResponse
} from "./contracts";

export default app;
