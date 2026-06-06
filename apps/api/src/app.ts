import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  createDemoRepositorySeed,
  createMemoryReportArtifactStorage,
  createMemoryRepository,
  type PromptOptsRepository
} from "@promptopts/shared";
import { createPostgresRepository } from "@promptopts/shared/postgres";
import { createLocalFileSystemReportArtifactStorage } from "@promptopts/shared/storage/local";
import { createAdminApiRoutes } from "./adminRoutes";
import {
  injectReportArtifactStorage,
  injectRepository,
  injectSecurityControls,
  type ApiEnv,
  type AppDependencies
} from "./context";
import { createPublicApiRoutes } from "./publicRoutes";
import {
  createConsoleRequestLogger,
  createRateLimitMiddleware,
  createRateLimitStoreFromEnv,
  createRequestIdMiddleware,
  createSafeRequestLoggerMiddleware
} from "./securityControls";

export function createApp(dependencies: AppDependencies = {}) {
  const repository = dependencies.repository ?? createRuntimeRepository();
  const reportArtifactStorage =
    dependencies.reportArtifactStorage ?? createRuntimeReportArtifactStorage(Boolean(dependencies.repository));
  const rateLimitStore = dependencies.rateLimitStore ?? createRateLimitStoreFromEnv();
  const requestLogger = dependencies.requestLogger ?? createConsoleRequestLogger();

  return new Hono<ApiEnv>()
    .use("*", cors())
    .use("*", createRequestIdMiddleware())
    .use("*", injectRepository(repository))
    .use("*", injectReportArtifactStorage(reportArtifactStorage))
    .use("*", injectSecurityControls({ rateLimitStore, requestLogger }))
    .use("*", createSafeRequestLoggerMiddleware())
    .use("*", createRateLimitMiddleware(dependencies.rateLimitPolicies))
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
  AdminProviderConnectionsResponse,
  AdminSudoEndRequest,
  AdminSudoEndResponse,
  AdminSudoStartRequest,
  AdminSudoStartResponse,
  AdminSudoStatusResponse,
  ModelApproveResponse,
  ModelPatchResponse,
  ModelRejectResponse,
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
  ProviderConnectionCreateRequest,
  ProviderConnectionMutationResponse,
  ProviderConnectionMetadata,
  ProviderConnectionRevokeRequest,
  ProviderConnectionRotateRequest,
  ProviderConnectionsResponse,
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

function createRuntimeReportArtifactStorage(repositoryInjected: boolean) {
  if (process.env.PROMPTOPTS_REPORT_STORAGE_DRIVER === "memory" || repositoryInjected) {
    return createMemoryReportArtifactStorage();
  }

  return createLocalFileSystemReportArtifactStorage();
}
