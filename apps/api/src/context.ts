import type { MiddlewareHandler } from "hono";
import type { z } from "zod";
import type { AdminSecurityHonoEnv } from "@promptopts/admin-core";
import type { PromptOptsRepository } from "@promptopts/shared";

export type ApiEnv = AdminSecurityHonoEnv;

export type AppDependencies = {
  repository?: PromptOptsRepository;
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
