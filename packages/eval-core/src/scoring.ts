import type { EvalResult, EvalVerdict } from "@promptopts/shared";
import type { EvalComboScore, EvalComboScoreInput, EvalRunAggregate } from "./types";
import { dedupeStrings, roundRate } from "./utils";

export function scoreEvalResult(input: EvalComboScoreInput): EvalComboScore {
  const testCaseCount = input.testCaseResults.length;

  if (testCaseCount === 0) {
    return {
      qualityScore: 0,
      passRate: 0,
      mustPassFailures: 0,
      failedCheckIds: [],
      unresolvedPlaceholderCheckIds: [],
      verdict: "blocked"
    };
  }

  const failedCheckIds = dedupeStrings(
    input.testCaseResults.flatMap((result) =>
      result.results
        .filter((check) => check.deterministic && check.passed === false)
        .map((check) => check.checkId)
    )
  );
  const unresolvedPlaceholderCheckIds = dedupeStrings(
    input.testCaseResults.flatMap((result) => result.unresolvedPlaceholders)
  );
  const mustPassFailureIds = dedupeStrings(
    input.testCaseResults.flatMap((result) => result.mustPassFailures)
  );
  const passedCases = input.testCaseResults.filter((result) => result.passed).length;
  const passRate = roundRate(passedCases / testCaseCount);
  const qualityScore = roundRate(
    input.testCaseResults.reduce((sum, result) => sum + result.deterministicPassRate, 0) /
      testCaseCount
  );

  return {
    qualityScore,
    passRate,
    mustPassFailures: mustPassFailureIds.length,
    failedCheckIds,
    unresolvedPlaceholderCheckIds,
    verdict: getEvalComboVerdict({
      passRate,
      passThreshold: input.passThreshold,
      mustPassFailures: mustPassFailureIds.length,
      blocked: false
    })
  };
}

// A must-pass failure always fails a combo, even when its aggregate pass rate looks acceptable.
export function getEvalComboVerdict(input: {
  passRate: number;
  passThreshold: number;
  mustPassFailures: number;
  blocked?: boolean;
}): EvalVerdict {
  if (input.blocked) {
    return "blocked";
  }

  if (input.mustPassFailures > 0) {
    return "fail";
  }

  return input.passRate >= input.passThreshold ? "pass" : "fail";
}

// Aggregate blockers protect the product from presenting eval-empty or partially failed runs as deployable proof.
export function aggregateEvalRun(input: {
  results: EvalResult[];
  testCaseCount: number;
  passThreshold: number;
}): EvalRunAggregate {
  const blockers: string[] = [];
  const passingResults = input.results.filter((result) => result.verdict === "pass");
  const failingResults = input.results.filter((result) => result.verdict === "fail");
  const blockedResults = input.results.filter((result) => result.verdict === "blocked");
  const bestResult = [...passingResults].sort((left, right) => {
    if (right.quality_score !== left.quality_score) {
      return right.quality_score - left.quality_score;
    }

    if (left.estimated_cost_usd === null) {
      return 1;
    }
    if (right.estimated_cost_usd === null) {
      return -1;
    }

    return left.estimated_cost_usd - right.estimated_cost_usd;
  })[0];

  if (input.testCaseCount === 0) {
    blockers.push("No test cases exist; production recommendation is disabled until tests are added.");
  }
  if (input.results.length === 0) {
    blockers.push("Eval matrix has no result rows yet.");
  }
  if (input.results.some((result) => result.must_pass_failures > 0)) {
    blockers.push("At least one combo has a must-pass failure.");
  }
  if (passingResults.length === 0 && input.results.length > 0) {
    blockers.push("No combo passed the configured eval threshold.");
  }
  if (input.passThreshold <= 0) {
    blockers.push("Eval pass threshold is not configured.");
  }

  return {
    totalResults: input.results.length,
    passingResults: passingResults.length,
    failingResults: failingResults.length,
    blockedResults: blockedResults.length,
    bestResultId: bestResult?.id ?? null,
    productionRecommendationAllowed: blockers.length === 0,
    blockers
  };
}
