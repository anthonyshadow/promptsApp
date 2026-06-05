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
  ModelsResponse,
  EvalRunCreateRequest,
  EvalRunDetailResponse,
  PromptOptimizeRequest,
  PromptOptimizeResponse,
  PromptCreateRequest,
  PromptCreateResponse,
  QualityContractRequest,
  QualityContractResponse,
  TestCaseCreateRequest,
  TestCaseMutationResponse,
  TestCasePatchRequest
} from "./contracts";

export default app;
