import type { EvalResult } from "@promptopts/shared";
import {
  decideRecommendation,
  getRejectedReason,
  isBaselineResult,
  isPassingRecommendationCombo
} from "./recommendation";
import type { CostQualityFrontierPoint } from "./types";

// Chart roles mirror the decision rules so failed combos stay visible instead of disappearing from the frontier.
export function costQualityFrontier(
  evalResults: EvalResult[],
  input: { evalRunId?: string; passThreshold?: number } = {}
): CostQualityFrontierPoint[] {
  const passThreshold = input.passThreshold ?? 0.95;
  const decision = decideRecommendation({
    evalRunId: input.evalRunId ?? "eval_run",
    results: evalResults,
    passThreshold
  });

  return evalResults.map((result) => {
    const isBaseline = isBaselineResult(result);
    const failed = !isPassingRecommendationCombo(result, passThreshold);

    return {
      result_id: result.id,
      candidate_id: result.candidate_id,
      model_id: result.model_id,
      label: getFrontierLabel(result, isBaseline),
      quality_score: result.quality_score,
      pass_rate: result.pass_rate,
      estimated_cost_usd: result.estimated_cost_usd,
      cost_estimate_status: result.cost_estimate_status,
      latency_ms: result.latency_ms,
      verdict: result.verdict,
      role: isBaseline
        ? "baseline"
        : failed
          ? "failed"
          : decision.winnerResultId === result.id
            ? "winner_candidate"
            : "safe",
      is_baseline: isBaseline,
      notes: getFrontierNotes(result, {
        isBaseline,
        isWinnerCandidate: decision.winnerResultId === result.id,
        passThreshold
      })
    };
  });
}

function getFrontierLabel(result: EvalResult, isBaseline: boolean): string {
  if (isBaseline) {
    return "Baseline";
  }

  return result.candidate_id
    .replace(/^candidate[_-]?/u, "")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function getFrontierNotes(
  result: EvalResult,
  input: {
    isBaseline: boolean;
    isWinnerCandidate: boolean;
    passThreshold: number;
  }
): string[] {
  const notes: string[] = [];

  if (input.isBaseline) {
    notes.push("Regression control: original prompt plus current model.");
  }

  if (!isPassingRecommendationCombo(result, input.passThreshold)) {
    notes.push(getRejectedReason(result, input.passThreshold));
  } else if (input.isWinnerCandidate) {
    notes.push("Best passing candidate after report decision ranking.");
  } else {
    notes.push("Passing combo remains available as a safe benchmark option.");
  }

  if (result.cost_estimate_status !== "verified") {
    notes.push("Cost metadata is not verified; exact savings claims stay disabled.");
  }

  return notes;
}
