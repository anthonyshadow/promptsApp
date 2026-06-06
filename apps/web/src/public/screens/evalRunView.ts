import type { EvalRunDetailResponse } from "@promptopts/api";
import type { EvalResult, EvalRun } from "@promptopts/shared";
import { formatCandidateId } from "../../formatters";
import { demoEvalResults, demoEvalRun } from "../../mockData";

export type FrontierPoint = EvalRunDetailResponse["frontier_points"][number];

export function createLocalEvalDetail(
  status: EvalRun["status"] = demoEvalRun.status
): EvalRunDetailResponse {
  const evalRun = {
    ...demoEvalRun,
    status
  };

  return {
    eval_run: evalRun,
    results: demoEvalResults,
    frontier_points: createLocalFrontierPoints(evalRun, demoEvalResults),
    failures: demoEvalResults
      .filter((result) => result.verdict !== "pass" || result.must_pass_failures > 0)
      .map((result) => ({
        result_id: result.id,
        candidate_id: result.candidate_id,
        model_id: result.model_id,
        failed_check_ids: result.failed_check_ids,
        must_pass_failures: result.must_pass_failures,
        reason:
          result.must_pass_failures > 0
            ? "Must-pass failure rejects this prompt/model combo."
            : "Combo did not meet the configured pass threshold."
    })),
    retry_hints: ["Local demo registry data is unverified; exact savings claims remain disabled."],
    queue: {
      job: {
        id: "eval_queue_job_local_demo",
        eval_run_id: evalRun.id,
        workspace_id: "workspace_acme_ai",
        project_id: evalRun.project_id,
        status,
        attempt_count: status === "queued" ? 0 : 1,
        max_attempts: 3,
        locked_by: status === "running" ? "local-demo-worker" : null,
        locked_until: null,
        last_heartbeat_at: null,
        next_attempt_at: evalRun.queued_at,
        rate_limited_until: null,
        retry_after_seconds: null,
        retry_hint: "Local demo queue metadata; run the worker to process durable jobs.",
        sanitized_error: null,
        metadata: { payload_redacted: true, source: "local_demo" },
        is_mock: true,
        created_at: evalRun.queued_at,
        updated_at: evalRun.queued_at,
        completed_at: status === "complete" ? evalRun.completed_at : null,
        cancelled_at: null
      },
      events: [],
      worker_heartbeats: [],
      retry_hints: ["Local demo queue metadata; run the worker to process durable jobs."]
    },
    status_note: "Local demo eval matrix shows queue/cache state, failures, and cost-quality frontier."
  };
}

export function createLocalFrontierPoints(
  evalRun: EvalRun,
  results: EvalResult[]
): FrontierPoint[] {
  const passingNonBaseline = results.filter(
    (result) => result.verdict === "pass" && !isBaselineResult(evalRun, result)
  );
  const winnerId = passingNonBaseline.sort(compareEvalResults)[0]?.id ?? null;

  return results.map((result) => {
    const isBaseline = isBaselineResult(evalRun, result);
    const failed = result.verdict !== "pass" || result.must_pass_failures > 0;

    return {
      result_id: result.id,
      candidate_id: result.candidate_id,
      model_id: result.model_id,
      label: isBaseline ? "Baseline" : formatCandidateId(result.candidate_id),
      quality_score: result.quality_score,
      pass_rate: result.pass_rate,
      estimated_cost_usd: result.estimated_cost_usd,
      cost_estimate_status: result.cost_estimate_status,
      latency_ms: result.latency_ms,
      verdict: result.verdict,
      role: isBaseline ? "baseline" : failed ? "failed" : winnerId === result.id ? "winner_candidate" : "safe",
      is_baseline: isBaseline,
      notes: failed
        ? ["Failed combos remain visible for regression review."]
        : ["Passing combo is provisional until report decision rules run."]
    };
  });
}

export function compareEvalResults(left: EvalResult, right: EvalResult): number {
  if (left.verdict !== right.verdict) {
    return left.verdict === "pass" ? -1 : 1;
  }

  if (right.quality_score !== left.quality_score) {
    return right.quality_score - left.quality_score;
  }

  return getCostProxy(left) - getCostProxy(right);
}

export function isBaselineResult(evalRun: EvalRun, result: EvalResult): boolean {
  void evalRun;
  return result.candidate_id.includes("baseline");
}

export function shouldPollStatus(status: EvalRun["status"]): boolean {
  return status === "queued" || status === "running" || status === "retrying" || status === "rate_limited";
}

export function getStatusTone(status: EvalRun["status"]): "good" | "warn" {
  if (status === "complete") {
    return "good";
  }

  return "warn";
}

export function formatEvalStatus(status: EvalRun["status"]): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "rate_limited":
      return "Rate limited";
    case "retrying":
      return "Retrying";
    case "failed":
      return "Failed";
    case "complete":
      return "Complete";
  }
}

export function formatFrontierRole(role: FrontierPoint["role"]): string {
  switch (role) {
    case "baseline":
      return "Baseline";
    case "safe":
      return "Safe";
    case "winner_candidate":
      return "Winner";
    case "failed":
      return "Failed";
  }
}

export function formatCost(result: EvalResult): string {
  if (result.estimated_cost_usd === null) {
    return result.cost_estimate_status === "unverified" ? "unverified" : "blocked";
  }

  return `$${result.estimated_cost_usd.toFixed(4)}`;
}

export function getCostProxy(result: EvalResult): number {
  return result.estimated_cost_usd ?? (result.input_tokens + result.output_tokens) / 1_000_000;
}
