import type { Context } from "hono";
import { z } from "zod";
import type { EvalRun, PromptOptsRepository, UsageLedgerEntry } from "@promptopts/shared";
import { errorResponseSchema, evalRunActionResponseSchema } from "./contracts";
import type { ApiEnv, ValidatedJson } from "./context";

export async function validateJson<TSchema extends z.ZodTypeAny>(
  c: Context<ApiEnv>,
  schema: TSchema
): Promise<ValidatedJson<z.infer<TSchema>>> {
  const payload = await c.req.json().catch(() => undefined);
  const result = schema.safeParse(payload);

  if (!result.success) {
    return {
      success: false,
      response: validationProblem(c, result.error)
    };
  }

  return {
    success: true,
    data: result.data
  };
}

export function validationProblem(c: Context<ApiEnv>, error: z.ZodError): Response {
  return c.json(
    errorResponseSchema.parse({
      error: {
        code: "validation_error",
        message: "Request validation failed",
        details: error.issues
      }
    }),
    400
  );
}

export function notFound(c: Context<ApiEnv>, message: string): Response {
  return c.json(
    errorResponseSchema.parse({
      error: {
        code: "not_found",
        message
      }
    }),
    404
  );
}

export async function getEvalRunDetail(repository: PromptOptsRepository, evalRun: EvalRun) {
  const results = (await repository.eval_results.list()).filter(
    (result) => result.eval_run_id === evalRun.id
  );

  return {
    eval_run: evalRun,
    results,
    todo: "Eval execution is mocked until eval-runner and provider adapters are implemented."
  };
}

export async function handleEvalRunStatusUpdate(
  c: Context<ApiEnv>,
  status: EvalRun["status"],
  todo: string
): Promise<Response> {
  const evalRunId = c.req.param("id");
  if (!evalRunId) {
    return notFound(c, "Eval run not found");
  }

  const evalRun = await c.var.repository.eval_runs.update(evalRunId, {
    status,
    started_at: status === "retrying" ? nowIso() : null,
    completed_at: status === "failed" ? nowIso() : null
  });

  if (!evalRun) {
    return notFound(c, "Eval run not found");
  }

  return c.json(evalRunActionResponseSchema.parse({ eval_run: evalRun, todo }));
}

export function unitForFeature(feature: UsageLedgerEntry["feature"]): UsageLedgerEntry["unit"] {
  switch (feature) {
    case "free_audits":
      return "audit";
    case "projects":
      return "project";
    case "eval_runs":
      return "eval_run";
    case "report_exports":
      return "report_export";
    case "admin_seats":
      return "seat";
  }
}

export function stripUndefined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter((entry) => entry[1] !== undefined));
}

export function estimateTokens(prompt: string): number {
  return Math.max(1, Math.ceil(prompt.trim().split(/\s+/).length * 1.4));
}

export function redactedPreview(prompt: string): string {
  return prompt.replace(/\s+/g, " ").trim().slice(0, 140);
}

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
