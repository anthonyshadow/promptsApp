import type { MiddlewareHandler } from "hono";
import type { z } from "zod";
import type { AdminSecurityHonoEnv } from "@promptopts/admin-core";
import type { PromptOptsRepository, ReportArtifactStorage } from "@promptopts/shared";
import type {
  RateLimitPolicyOverrides,
  RateLimitStore,
  RequestLogger,
  SafeRequestLogEvent
} from "./securityControls";

export type ApiEnv = {
  Variables: AdminSecurityHonoEnv["Variables"] & {
    requestId: string;
    rateLimitPolicy: string | null;
    rateLimitStore: RateLimitStore;
    requestLogger: RequestLogger;
  };
};

export type AppDependencies = {
  repository?: PromptOptsRepository;
  reportArtifactStorage?: ReportArtifactStorage;
  rateLimitStore?: RateLimitStore;
  rateLimitPolicies?: RateLimitPolicyOverrides;
  requestLogger?: RequestLogger;
};

export type ValidatedJson<TValue> =
  | {
      success: true;
      data: TValue;
    }
  | {
      success: false;
      response: Response;
    };

export type InferValidated<TSchema extends z.ZodTypeAny> = z.infer<TSchema>;

export const injectRepository =
  (repository: PromptOptsRepository): MiddlewareHandler<ApiEnv> =>
  async (c, next) => {
    c.set("repository", repository);
    await next();
  };

export const injectReportArtifactStorage =
  (reportArtifactStorage: ReportArtifactStorage): MiddlewareHandler<ApiEnv> =>
  async (c, next) => {
    c.set("reportArtifactStorage", reportArtifactStorage);
    await next();
  };

export const injectSecurityControls =
  (input: {
    rateLimitStore: RateLimitStore;
    requestLogger: RequestLogger;
  }): MiddlewareHandler<ApiEnv> =>
  async (c, next) => {
    c.set("rateLimitStore", input.rateLimitStore);
    c.set("requestLogger", input.requestLogger);
    c.set("rateLimitPolicy", null);
    await next();
  };

export type { RateLimitStore, RequestLogger, SafeRequestLogEvent };
