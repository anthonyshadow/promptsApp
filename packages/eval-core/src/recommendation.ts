import type { EvalResult, RegistryFreshness, RiskLevel } from "@promptopts/shared";
import type {
  RecommendationDecision,
  RecommendationDecisionInput,
  RecommendationRejectedCombo
} from "./types";
import { dedupeStrings } from "./utils";

// The report decision makes one recommendation only after hard gates, then names a cheaper alternative and fallback.
export function decideRecommendation(input: RecommendationDecisionInput): RecommendationDecision {
  const baseline = findBaselineResult(input.results);
  const passingResults = input.results
    .filter((result) => isPassingRecommendationCombo(result, input.passThreshold))
    .sort(compareRecommendationResults);
  const passingRecommendationCandidates = passingResults.filter((result) => !isBaselineResult(result));
  const rejectedCombos = input.results
    .filter((result) => !isPassingRecommendationCombo(result, input.passThreshold))
    .map((result) => ({
      resultId: result.id,
      candidateId: result.candidate_id,
      modelId: result.model_id,
      reason: getRejectedReason(result, input.passThreshold),
      failedCheckIds: result.failed_check_ids,
      mustPassFailures: result.must_pass_failures
    }));
  const winner = passingRecommendationCandidates[0] ?? baseline ?? null;
  const cheaperAlternative = winner
    ? findCheaperAlternative(passingResults, winner)
    : null;
  const strongerFallback = passingResults.length === 0 && baseline
    ? baseline
    : winner
      ? findStrongerFallback(passingResults, winner, baseline)
      : baseline ?? null;
  const registryFreshness = classifyDecisionRegistryFreshness(input.results);
  const productionBlockers = getProductionBlockers(
    input,
    passingResults,
    passingRecommendationCandidates,
    winner
  );
  const riskNotes = getDecisionRiskNotes({
    results: input.results,
    winner,
    rejectedCombos,
    registryFreshness,
    productionBlockers
  });

  return {
    evalRunId: input.evalRunId,
    winnerResultId: winner?.id ?? null,
    cheaperAlternativeResultId: cheaperAlternative?.id ?? null,
    strongerFallbackResultId: strongerFallback?.id ?? null,
    rejectedCombos,
    riskNotes,
    productionRecommendationAllowed:
      productionBlockers.length === 0 && winner !== null && winner.verdict === "pass",
    productionBlockers,
    registryFreshness,
    savingsSummary: createSavingsSummary({ winner, baseline, registryFreshness }),
    rankedPassingResultIds: passingResults.map((result) => result.id)
  };
}

export function isPassingRecommendationCombo(result: EvalResult, passThreshold: number): boolean {
  return result.verdict === "pass" &&
    result.pass_rate >= passThreshold &&
    result.must_pass_failures === 0;
}

export function isBaselineResult(result: EvalResult): boolean {
  return result.candidate_id.toLowerCase().includes("baseline");
}

export function getRejectedReason(result: EvalResult, passThreshold: number): string {
  if (result.must_pass_failures > 0) {
    return "Must-pass failure rejects this combo.";
  }

  if (result.verdict === "blocked") {
    return "Combo is blocked until missing eval inputs or provider issues are resolved.";
  }

  if (result.pass_rate < passThreshold) {
    return "Pass rate is below the configured threshold.";
  }

  if (result.verdict !== "pass") {
    return "Combo did not pass the eval verdict.";
  }

  return "Combo was not eligible for recommendation.";
}

function compareRecommendationResults(left: EvalResult, right: EvalResult): number {
  const costDelta = comparableCost(left) - comparableCost(right);
  if (costDelta !== 0) {
    return costDelta;
  }

  const latencyDelta = comparableLatency(left) - comparableLatency(right);
  if (latencyDelta !== 0) {
    return latencyDelta;
  }

  if (right.pass_rate !== left.pass_rate) {
    return right.pass_rate - left.pass_rate;
  }

  if (right.quality_score !== left.quality_score) {
    return right.quality_score - left.quality_score;
  }

  return riskWeight(left.risk_level) - riskWeight(right.risk_level);
}

function comparableCost(result: EvalResult): number {
  return result.estimated_cost_usd ?? Number.POSITIVE_INFINITY;
}

function comparableLatency(result: EvalResult): number {
  return result.latency_ms ?? Number.POSITIVE_INFINITY;
}

function riskWeight(riskLevel: RiskLevel): number {
  switch (riskLevel) {
    case "low":
      return 0;
    case "medium":
      return 1;
    case "high":
      return 2;
    case "critical":
      return 3;
  }
}

function findBaselineResult(results: EvalResult[]): EvalResult | null {
  return results.find(isBaselineResult) ?? null;
}

function findCheaperAlternative(
  passingResults: EvalResult[],
  winner: EvalResult
): EvalResult | null {
  const winnerCost = comparableCost(winner);
  const cheaper = passingResults.find(
    (result) => result.id !== winner.id && comparableCost(result) < winnerCost
  );

  return cheaper ?? passingResults.find((result) => result.id !== winner.id) ?? null;
}

function findStrongerFallback(
  passingResults: EvalResult[],
  winner: EvalResult,
  baseline: EvalResult | null
): EvalResult | null {
  const stronger = [...passingResults]
    .filter((result) => result.id !== winner.id)
    .sort((left, right) => {
      if (right.quality_score !== left.quality_score) {
        return right.quality_score - left.quality_score;
      }

      if (right.pass_rate !== left.pass_rate) {
        return right.pass_rate - left.pass_rate;
      }

      return riskWeight(left.risk_level) - riskWeight(right.risk_level);
    })[0];

  return stronger ?? (baseline && baseline.id !== winner.id ? baseline : null);
}

function classifyDecisionRegistryFreshness(results: EvalResult[]): RegistryFreshness {
  if (results.length === 0) {
    return "unverified";
  }

  return results.every((result) => result.cost_estimate_status === "verified")
    ? "fresh"
    : "unverified";
}

function getProductionBlockers(
  input: RecommendationDecisionInput,
  passingResults: EvalResult[],
  passingRecommendationCandidates: EvalResult[],
  winner: EvalResult | null
): string[] {
  const blockers: string[] = [];

  if (input.passThreshold <= 0) {
    blockers.push("Eval pass threshold is not configured.");
  }

  if (input.testCaseCount === 0) {
    blockers.push("No test cases exist; production recommendation is disabled until tests are added.");
  }

  if (input.results.length === 0) {
    blockers.push("Eval matrix has no result rows yet.");
  }

  if (passingResults.length === 0) {
    blockers.push("No combo passed the configured eval threshold.");
  }

  if (passingResults.length > 0 && passingRecommendationCandidates.length === 0) {
    blockers.push("No optimized combo passed; report recommends no switch from the baseline.");
  }

  if (!winner || winner.verdict !== "pass") {
    blockers.push("No production-ready winner is available; keep the current setup or run more evals.");
  }

  return dedupeStrings(blockers);
}

function getDecisionRiskNotes(input: {
  results: EvalResult[];
  winner: EvalResult | null;
  rejectedCombos: RecommendationRejectedCombo[];
  registryFreshness: RegistryFreshness;
  productionBlockers: string[];
}): string[] {
  const notes: string[] = [];

  if (input.productionBlockers.length > 0) {
    notes.push(...input.productionBlockers);
  }

  if (input.rejectedCombos.length > 0) {
    notes.push(`${input.rejectedCombos.length} combo(s) rejected; failed combos remain visible in the matrix.`);
  }

  if (input.rejectedCombos.some((combo) => combo.mustPassFailures > 0)) {
    notes.push("Must-pass failures reject only the affected combo; do not route production traffic to those rows.");
  }

  if (input.winner && input.winner.risk_level !== "low") {
    notes.push(`Winner carries ${input.winner.risk_level} operational risk; deploy with routing guardrails.`);
  }

  if (input.registryFreshness !== "fresh") {
    notes.push("Registry metadata is stale/demo/unverified; savings are an opportunity, not a verified claim.");
  }

  if (input.results.length === 0) {
    notes.push("No eval snapshot is available for a recommendation.");
  }

  return dedupeStrings(notes);
}

function createSavingsSummary(input: {
  winner: EvalResult | null;
  baseline: EvalResult | null;
  registryFreshness: RegistryFreshness;
}): string | null {
  if (!input.winner || !input.baseline) {
    return "No savings estimate is available until the eval matrix contains a winner and baseline.";
  }

  if (input.registryFreshness !== "fresh") {
    return "Savings opportunity is unverified because registry metadata is stale/demo.";
  }

  if (input.winner.estimated_cost_usd === null || input.baseline.estimated_cost_usd === null) {
    return "Savings estimate is blocked because at least one cost estimate is unavailable.";
  }

  const delta = input.baseline.estimated_cost_usd - input.winner.estimated_cost_usd;

  if (delta <= 0) {
    return "Winner is not cheaper than baseline; the decision prioritizes quality, latency, or fallback safety.";
  }

  return `Estimated per-eval-row cost is ${formatUsd(delta)} lower than baseline.`;
}

function formatUsd(value: number): string {
  return `$${value.toFixed(6)}`;
}
