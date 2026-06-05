import type { Context } from "hono";
import { z } from "zod";
import type { EvalResult, EvalRun, PromptOptsRepository, UsageLedgerEntry } from "@promptopts/shared";
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
  const failures = results
    .filter((result) => result.verdict !== "pass" || result.must_pass_failures > 0)
    .map((result) => ({
      result_id: result.id,
      candidate_id: result.candidate_id,
      model_id: result.model_id,
      failed_check_ids: result.failed_check_ids,
      must_pass_failures: result.must_pass_failures,
      reason: getEvalFailureReason(result)
    }));

  return {
    eval_run: evalRun,
    results,
    failures,
    retry_hints: getEvalRetryHints(evalRun, results, failures.length),
    status_note: getEvalStatusNote(evalRun, results)
  };
}

function getEvalFailureReason(result: EvalResult): string {
  if (result.failed_check_ids.some((checkId) => checkId.startsWith("provider_error_rate_limited"))) {
    return "Provider rate limit encountered; provider payload was sanitized.";
  }

  if (result.failed_check_ids.some((checkId) => checkId.startsWith("provider_error_"))) {
    return "Provider error encountered; raw provider payload was sanitized.";
  }

  if (result.must_pass_failures > 0) {
    return "Must-pass failure rejects this prompt/model combo.";
  }

  if (result.verdict === "blocked") {
    return "Combo is blocked until missing eval inputs are resolved.";
  }

  return "Combo did not meet the configured pass threshold.";
}

function getEvalRetryHints(
  evalRun: EvalRun,
  results: EvalResult[],
  failureCount: number
): string[] {
  const hints = new Set<string>();

  if (evalRun.status === "queued" || evalRun.status === "running") {
    hints.add("Eval run is still in progress; poll for partial rows.");
  }
  if (evalRun.status === "rate_limited") {
    hints.add("Provider rate limit encountered; retry after backoff.");
  }
  if (results.length === 0) {
    hints.add("No eval rows are available yet; verify quality contract, candidates, and model shortlist.");
  }
  if (failureCount > 0) {
    hints.add("Review failed checks before considering any production recommendation.");
  }
  if (results.some((result) => result.cost_estimate_status === "unverified")) {
    hints.add("Registry metadata is stale/demo; exact savings claims remain disabled.");
  }

  return Array.from(hints);
}

function getEvalStatusNote(evalRun: EvalRun, results: EvalResult[]): string {
  if (evalRun.status === "complete") {
    return "Mock eval runner completed with deterministic checks; production recommendation still requires pass threshold and zero must-pass failures.";
  }

  if (evalRun.status === "failed") {
    return "Eval run failed before completing the matrix.";
  }

  if (evalRun.status === "rate_limited") {
    return "Eval run paused on sanitized provider rate-limit signal.";
  }

  return `Eval run is ${evalRun.status}; ${results.length} partial row(s) are available.`;
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
