import { describe, expect, test } from "bun:test";
import type { EvalResult, EvalRun, RecommendationReport } from "@promptopts/shared";
import type { RecommendationDecision } from "@promptopts/eval-core";
import { generateReportArtifacts } from "./index";

const generatedAt = "2026-06-05T12:00:00.000Z";

describe("report artifact generator", () => {
  test("generates markdown, JSON, and PDF-stub export artifacts", () => {
    const generated = generateReportArtifacts({
      report: createReport(),
      evalRun: createEvalRun(),
      results: [createResult("result_winner", "candidate_balanced", "pass")],
      decision: createDecision(),
      generatedAt
    });

    expect(generated.artifacts.map((artifact) => artifact.format)).toEqual(["markdown", "json", "pdf"]);
    expect(generated.contents.map((content) => content.content_type)).toEqual([
      "text/markdown",
      "application/json",
      "application/pdf"
    ]);
    expect(generated.eval_snapshot.result_count).toBe(1);
  });

  test("pins the markdown export snapshot", () => {
    const generated = generateReportArtifacts({
      report: createReport(),
      evalRun: createEvalRun(),
      results: [createResult("result_winner", "candidate_balanced", "pass")],
      decision: createDecision(),
      generatedAt
    });
    const markdown = generated.contents.find((content) => content.format === "markdown")?.content;

    expect(markdown).toBe([
      "# PromptOpts Recommendation Report",
      "",
      "## Recommended Setup",
      "- Winner result: result_winner",
      "- Cheaper alternative: result_cheaper",
      "- Stronger fallback: result_fallback",
      "",
      "## Risk Notes",
      "- Registry metadata is stale/demo/unverified; savings are an opportunity, not a verified claim.",
      "",
      "## Quality And Performance",
      "- Production recommendation allowed: true",
      "- Pass threshold: 95%",
      "- Rejected combos: 0",
      "- Registry freshness: unverified",
      "",
      "## Savings Estimate",
      "- Savings opportunity is unverified because registry metadata is stale/demo.",
      "",
      "## Deployment Routing",
      "- Route production traffic only to the winner after final review.",
      "- Keep baseline available as rollback until live monitoring exists.",
      "- Use stronger fallback for escalations, ambiguity, or low confidence.",
      "",
      "## Developer Implementation Notes",
      "- Use the winner as the default route only after eval gates are reviewed.",
      "- Keep baseline routing available as rollback.",
      "- Failed combos remain visible and must not receive production traffic.",
      "- Route high-risk, ambiguous, or escalation traffic to the stronger fallback.",
      "- Verify model registry sources before publishing exact savings claims.",
      "",
      "## Eval Snapshot",
      "- Eval run: eval_run_test",
      "- Status: complete",
      "- Rows captured: 1"
    ].join("\n"));
  });

  test("pins the JSON export snapshot and redacts share package by default", () => {
    const generated = generateReportArtifacts({
      report: createReport(),
      evalRun: createEvalRun(),
      results: [createResult("result_winner", "candidate_balanced", "pass")],
      decision: createDecision(),
      generatedAt
    });
    const json = generated.contents.find((content) => content.format === "json")?.content ?? "";
    const parsed = JSON.parse(json) as { redaction_state: string; eval_snapshot: { result_count: number } };

    expect(parsed.redaction_state).toBe("redacted");
    expect(parsed.eval_snapshot.result_count).toBe(1);
    expect(generated.redacted_share_package.redaction_state).toBe("redacted");
    expect(JSON.stringify(generated.redacted_share_package)).not.toContain("{{ticket_text}}");
  });
});

function createReport(): RecommendationReport {
  return {
    id: "report_test",
    project_id: "project_test",
    eval_run_id: "eval_run_test",
    status: "ready",
    winner_result_id: "result_winner",
    cheaper_alternative_result_id: "result_cheaper",
    stronger_fallback_result_id: "result_fallback",
    risk_summary: [
      "Registry metadata is stale/demo/unverified; savings are an opportunity, not a verified claim."
    ],
    savings_summary: "Savings opportunity is unverified because registry metadata is stale/demo.",
    production_recommendation_allowed: true,
    production_blockers: [],
    registry_freshness: "unverified",
    is_mock: true,
    generated_at: generatedAt,
    created_at: generatedAt,
    updated_at: generatedAt
  };
}

function createDecision(): RecommendationDecision {
  return {
    evalRunId: "eval_run_test",
    winnerResultId: "result_winner",
    cheaperAlternativeResultId: "result_cheaper",
    strongerFallbackResultId: "result_fallback",
    rejectedCombos: [],
    riskNotes: [
      "Registry metadata is stale/demo/unverified; savings are an opportunity, not a verified claim."
    ],
    productionRecommendationAllowed: true,
    productionBlockers: [],
    registryFreshness: "unverified",
    savingsSummary: "Savings opportunity is unverified because registry metadata is stale/demo.",
    rankedPassingResultIds: ["result_winner", "result_cheaper", "result_fallback"]
  };
}

function createEvalRun(): EvalRun {
  return {
    id: "eval_run_test",
    project_id: "project_test",
    quality_contract_id: "quality_contract_test",
    baseline_prompt_version_id: "prompt_version_baseline",
    candidate_ids: ["candidate_baseline", "candidate_balanced"],
    model_registry_record_ids: ["model_record_balanced"],
    status: "complete",
    pass_threshold: 0.95,
    is_mock: true,
    queued_at: generatedAt,
    started_at: generatedAt,
    completed_at: generatedAt
  };
}

function createResult(id: string, candidateId: string, verdict: EvalResult["verdict"]): EvalResult {
  return {
    id,
    eval_run_id: "eval_run_test",
    candidate_id: candidateId,
    prompt_version_id: "prompt_version_baseline",
    model_registry_record_id: "model_record_balanced",
    provider: "openai",
    model_id: "openai-demo-balanced",
    quality_score: 0.97,
    pass_rate: 0.97,
    must_pass_failures: 0,
    input_tokens: 120,
    output_tokens: 80,
    estimated_cost_usd: 0.02,
    cost_estimate_status: "unverified",
    latency_ms: 420,
    risk_level: "low",
    verdict,
    failed_check_ids: [],
    is_mock: true,
    created_at: generatedAt
  };
}
