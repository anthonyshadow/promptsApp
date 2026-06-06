import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  createDemoRepositorySeed,
  createMemoryRepository,
  type PromptOptsRepository
} from "@promptopts/shared";
import { createPostgresRepository } from "@promptopts/shared/postgres";
import { createAdminApiRoutes } from "./adminRoutes";
import { injectRepository, type ApiEnv, type AppDependencies } from "./context";
import { createPublicApiRoutes } from "./publicRoutes";

export function createApp(dependencies: AppDependencies = {}) {
  const repository = dependencies.repository ?? createRuntimeRepository();

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
  AdminSudoEndRequest,
  AdminSudoEndResponse,
  AdminSudoStartRequest,
  AdminSudoStartResponse,
  AdminSudoStatusResponse,
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

function createRuntimeRepository(): PromptOptsRepository {
  if (process.env.DATABASE_URL && process.env.PROMPTOPTS_REPOSITORY !== "memory") {
    return createPostgresRepository({ databaseUrl: process.env.DATABASE_URL });
  }

  return createMemoryRepository(createDemoRepositorySeed());
}
