import { decideRecommendation } from "@promptopts/eval-core";
import { generateReportArtifacts, persistGeneratedReportArtifacts } from "@promptopts/report-generator";
import { redactProviderError, redactPromptPreview, writeAdminSecurityAuditEvent } from "@promptopts/admin-core";
import type {
  Account,
  AdminAuditLog,
  BillingEvent,
  Contact,
  Credit,
  CrmNote,
  CrmTask,
  DeletionRequest,
  Entitlement,
  EvalResult,
  EvalRun,
  EvalQueueJob,
  FeatureFlag,
  FreeAudit,
  Invoice,
  ModelRegistryRecord,
  ModelRegistryVersion,
  Opportunity,
  Plan,
  Prompt,
  PromptAnalysis,
  PromptProject,
  ProviderConnection,
  RecommendationReport,
  ReportArtifact,
  ReportArtifactStorage,
  UsageLedgerEntry,
  Workspace,
  WorkerHeartbeat
} from "@promptopts/shared";
import type {
  AdminAccountDetailResponse,
  AdminAccountsResponse,
  AdminOverviewResponse
} from "../contracts";
import type { ApiEnv } from "../context";
import { createId, getEvalRunDetail, nowIso, stripUndefined } from "../http";

function createAdminEvalRunsResponse(input: {
  evalRuns: EvalRun[];
  projects: PromptProject[];
  workspaces: Workspace[];
  models: ModelRegistryRecord[];
  results: EvalResult[];
  jobs: EvalQueueJob[];
  heartbeats: WorkerHeartbeat[];
}) {
  return {
    queue_summary: countEvalJobsWithRateLimits(input.evalRuns, input.jobs),
    worker_health: createWorkerHealth(input.evalRuns, input.heartbeats),
    jobs: input.evalRuns
      .map((evalRun) => {
        const queueJob = input.jobs.find((job) => job.eval_run_id === evalRun.id) ?? null;
        const project = input.projects.find((item) => item.id === evalRun.project_id) ?? null;
        const workspace = project
          ? input.workspaces.find((item) => item.id === project.workspace_id) ?? null
          : null;
        const model =
          input.models.find((item) => evalRun.model_registry_record_ids.includes(item.id)) ?? null;
        const results = input.results.filter((result) => result.eval_run_id === evalRun.id);

        return {
          id: evalRun.id,
          workspace: workspace?.name ?? "Workspace metadata unavailable",
          provider: model?.provider ?? project?.current_provider ?? "openai",
          status: queueJob?.status ?? evalRun.status,
          age_seconds: getAgeSeconds(evalRun.queued_at),
          progress: getEvalProgress(evalRun, results),
          action: getEvalJobAction(queueJob?.status ?? evalRun.status),
          redaction_state: "redacted" as const
        };
      })
      .sort((a, b) => b.age_seconds - a.age_seconds),
    notes: [
      "Eval job admin payloads are sanitized by default; raw prompts are not returned without sudo.",
      "Retry, cancel, and report regeneration actions are audited through the admin middleware."
    ]
  };
}

async function createAdminEvalRunDetail(
  repository: ApiEnv["Variables"]["repository"],
  evalRun: EvalRun
) {
  const [detail, models, testCases] = await Promise.all([
    getEvalRunDetail(repository, evalRun),
    repository.model_registry.list(),
    repository.test_cases.list()
  ]);
  const selectedModels = models.filter((model) => evalRun.model_registry_record_ids.includes(model.id));
  const providerErrorResult = detail.results.find((result) =>
    result.failed_check_ids.some((checkId) => checkId.startsWith("provider_error_"))
  );
  const sanitizedProviderError = providerErrorResult
    ? redactProviderError(
        `Provider error for ${providerErrorResult.provider}/${providerErrorResult.model_id}: token=provider-token-demo payload redacted.`
      )
    : null;

  return {
    detail,
    sanitized_payload: {
      eval_run_id: evalRun.id,
      project_id: evalRun.project_id,
      quality_contract_id: evalRun.quality_contract_id,
      baseline_prompt_version_id: evalRun.baseline_prompt_version_id,
      candidate_ids: evalRun.candidate_ids,
      model_registry_record_ids: evalRun.model_registry_record_ids,
      redaction_state: "redacted" as const
    },
    model_ids: selectedModels.map((model) => model.model_id),
    test_count: testCases.filter((testCase) => testCase.quality_contract_id === evalRun.quality_contract_id).length,
    failed_checks: detail.failures,
    sanitized_provider_error: sanitizedProviderError,
    retry_hints: detail.retry_hints,
    worker_health: createWorkerHealth([evalRun], detail.queue.worker_heartbeats)
  };
}

function countEvalJobsWithRateLimits(evalRuns: EvalRun[], jobs: EvalQueueJob[]) {
  const statusFor = (evalRun: EvalRun) =>
    jobs.find((job) => job.eval_run_id === evalRun.id)?.status ?? evalRun.status;

  return {
    queued: evalRuns.filter((evalRun) => statusFor(evalRun) === "queued").length,
    running: evalRuns.filter((evalRun) => statusFor(evalRun) === "running").length,
    failed: evalRuns.filter((evalRun) => statusFor(evalRun) === "failed").length,
    retrying: evalRuns.filter((evalRun) => statusFor(evalRun) === "retrying").length,
    rate_limited: evalRuns.filter((evalRun) => statusFor(evalRun) === "rate_limited").length
  };
}

function createWorkerHealth(evalRuns: EvalRun[], heartbeats: WorkerHeartbeat[] = []) {
  const hasFailures = evalRuns.some((evalRun) => evalRun.status === "failed");
  const hasRateLimits = evalRuns.some((evalRun) => evalRun.status === "rate_limited");
  const evalRunnerHeartbeat = heartbeats
    .filter((heartbeat) => heartbeat.worker_name === "eval-runner")
    .sort((a, b) => b.last_heartbeat_at.localeCompare(a.last_heartbeat_at))[0];

  return [
    {
      component: "eval-runner" as const,
      status: evalRunnerHeartbeat
        ? evalRunnerHeartbeat.status === "healthy"
          ? "ok" as const
          : "degraded" as const
        : hasFailures
          ? "degraded" as const
          : "mocked" as const,
      redacted_summary: evalRunnerHeartbeat
        ? `Last durable heartbeat ${evalRunnerHeartbeat.last_heartbeat_at}; worker payloads are redacted.`
        : hasFailures
        ? "At least one eval job failed; inspect failed checks and retry hints."
        : "No live durable heartbeat is available; queue metadata is still persisted."
    },
    {
      component: "provider-adapter" as const,
      status: hasRateLimits ? "degraded" as const : "mocked" as const,
      redacted_summary: hasRateLimits
        ? "Provider adapter saw rate-limit metadata; raw provider payload is sanitized."
        : "Provider adapter is mocked; no live provider calls are shown."
    },
    {
      component: "scoring" as const,
      status: "mocked" as const,
      redacted_summary: "Deterministic scoring metadata is available from eval results."
    },
    {
      component: "report-generator" as const,
      status: "mocked" as const,
      redacted_summary: "Report regeneration is queued as a mocked operator action."
    }
  ];
}

function getEvalProgress(evalRun: EvalRun, results: EvalResult[]): number {
  const expectedRows = Math.max(1, evalRun.candidate_ids.length * evalRun.model_registry_record_ids.length);

  if (evalRun.status === "complete") {
    return 1;
  }

  return Math.min(1, results.length / expectedRows);
}

function getEvalJobAction(status: EvalRun["status"]) {
  if (status === "failed" || status === "rate_limited") {
    return "retry" as const;
  }

  if (status === "queued" || status === "running" || status === "retrying") {
    return "cancel" as const;
  }

  return "regenerate_report" as const;
}

function getAgeSeconds(isoTimestamp: string): number {
  const ageMs = Date.now() - Date.parse(isoTimestamp);

  return Number.isFinite(ageMs) ? Math.max(0, Math.floor(ageMs / 1000)) : 0;
}


export { createAdminEvalRunDetail, createAdminEvalRunsResponse };
