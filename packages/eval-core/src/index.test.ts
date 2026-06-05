import { describe, expect, test } from "bun:test";
import type { PromptAnalysis, QualityCheckDefinition, TestCase } from "@promptopts/shared";
import {
  aggregateEvalRun,
  autoDraftQualityContract,
  costQualityFrontier,
  decideRecommendation,
  getEvalComboVerdict,
  parseCsvTestCases,
  runDeterministicChecks,
  scoreEvalResult,
  validateQualityCheck,
  validateTestCaseChecks
} from "./index";

const baseAnalysis: PromptAnalysis = {
  id: "analysis_test",
  prompt_version_id: "prompt_version_test",
  provider: "openai",
  model_id: "openai-demo-balanced",
  task_type: "classification",
  input_tokens: 120,
  estimated_output_tokens: 80,
  model_fit: "appropriate",
  waste_findings: [],
  risk_level: "medium",
  compression_guardrails: ["Preserve strict JSON.", "Keep routing labels."],
  registry_freshness: "unverified",
  is_mock: true,
  created_at: "2026-06-03T12:00:00.000Z"
};

describe("quality contract auto-draft", () => {
  test("drafts must-pass checks and default threshold from prompt analysis", () => {
    const draft = autoDraftQualityContract(baseAnalysis);

    expect(draft.task).toBe("Classification");
    expect(draft.pass_threshold).toBe(0.95);
    expect(draft.must_preserve).toContain("Preserve strict JSON.");
    expect(draft.forbidden_behavior.join(" ")).toContain("Do not drop must-pass");
    expect(draft.check_definitions.some((check) => check.type === "llm_judge")).toBe(true);
    expect(draft.must_pass_check_ids).toContain("analysis_test_check_required_output");
  });

  test("raises threshold for high-risk analysis", () => {
    const draft = autoDraftQualityContract({ ...baseAnalysis, risk_level: "high" });

    expect(draft.pass_threshold).toBe(0.98);
  });
});

describe("deterministic check validators", () => {
  test("validates exact, JSON schema, regex, required phrase, and forbidden phrase checks", () => {
    const output = {
      label: "billing",
      summary: "Customer requests cancellation.",
      suggested_reply: "The account support team can help."
    };

    const checks: QualityCheckDefinition[] = [
      createCheck("exact", "label", "billing"),
      createCheck("json_schema", null, ["label", "summary"]),
      createCheck("regex", "summary", null, "cancel|cancellation"),
      createCheck("required_phrase", "suggested_reply", "support"),
      createCheck("forbidden_phrase", "suggested_reply", "internal policy")
    ];

    expect(checks.map((check) => validateQualityCheck(check, output).passed)).toEqual([
      true,
      true,
      true,
      true,
      true
    ]);
  });

  test("labels LLM judge and human checks as non-deterministic placeholders", () => {
    const llmResult = validateQualityCheck(
      {
        ...createCheck("llm_judge", null, "quality"),
        placeholder_note: "LLM judge placeholder."
      },
      "Looks good"
    );
    const humanResult = validateQualityCheck(
      {
        ...createCheck("human", null, "approval"),
        placeholder_note: "Human review placeholder."
      },
      "Looks good"
    );

    expect(llmResult.deterministic).toBe(false);
    expect(llmResult.passed).toBeNull();
    expect(humanResult.deterministic).toBe(false);
    expect(humanResult.passed).toBeNull();
  });

  test("must-pass failures reject a test case", () => {
    const testCase: TestCase = {
      id: "case_test",
      project_id: "project_test",
      quality_contract_id: "contract_test",
      name: "Billing label",
      input_variables: {},
      expected_output: { label: "billing" },
      checks: [
        {
          ...createCheck("exact", "label", "billing"),
          id: "check_label",
          must_pass: true
        }
      ],
      is_mock: true,
      created_at: "2026-06-03T12:00:00.000Z",
      updated_at: "2026-06-03T12:00:00.000Z"
    };

    const result = validateTestCaseChecks(testCase, { label: "sales" });

    expect(result.passed).toBe(false);
    expect(result.mustPassFailures).toEqual(["check_label"]);
  });
});

describe("eval scoring", () => {
  test("scores passing combos at or above threshold", () => {
    const passedCase = {
      testCaseId: "case_pass",
      results: [deterministicCheckResult("check_pass", true, true)],
      deterministicPassRate: 1,
      mustPassFailures: [],
      unresolvedPlaceholders: [],
      passed: true
    };
    const score = scoreEvalResult({
      testCaseResults: [passedCase, passedCase],
      passThreshold: 0.95
    });

    expect(score.qualityScore).toBe(1);
    expect(score.passRate).toBe(1);
    expect(score.mustPassFailures).toBe(0);
    expect(score.verdict).toBe("pass");
  });

  test("must-pass failures reject combos even when pass rate would otherwise pass", () => {
    const score = scoreEvalResult({
      testCaseResults: [
        {
          testCaseId: "case_fail",
          results: [deterministicCheckResult("check_must_pass", true, false)],
          deterministicPassRate: 0,
          mustPassFailures: ["check_must_pass"],
          unresolvedPlaceholders: [],
          passed: false
        }
      ],
      passThreshold: 0.95
    });

    expect(score.verdict).toBe("fail");
    expect(score.mustPassFailures).toBe(1);
    expect(score.failedCheckIds).toEqual(["check_must_pass"]);
  });

  test("blocks empty eval input and aggregates run blockers", () => {
    expect(
      scoreEvalResult({
        testCaseResults: [],
        passThreshold: 0.95
      }).verdict
    ).toBe("blocked");
    expect(
      getEvalComboVerdict({
        passRate: 1,
        passThreshold: 0.95,
        mustPassFailures: 1
      })
    ).toBe("fail");

    const aggregate = aggregateEvalRun({
      results: [],
      testCaseCount: 0,
      passThreshold: 0.95
    });

    expect(aggregate.productionRecommendationAllowed).toBe(false);
    expect(aggregate.blockers.join(" ")).toContain("No test cases");
  });

  test("runDeterministicChecks delegates exact check validation", () => {
    const testCase = createTestCase([
      {
        ...createCheck("exact", "label", "billing"),
        id: "check_label",
        must_pass: true
      }
    ]);
    const result = runDeterministicChecks(testCase, { label: "billing" });

    expect(result.passed).toBe(true);
    expect(result.deterministicPassRate).toBe(1);
  });
});

describe("recommendation decision rules", () => {
  test("rejects must-pass failures and selects winner, cheaper alternative, and fallback from passing combos", () => {
    const baseline = createEvalResult("result_baseline", "candidate_baseline", 0.97, 0.04, 520, "low", "pass");
    const balanced = createEvalResult("result_balanced", "candidate_balanced", 0.96, 0.02, 430, "low", "pass");
    const conservative = createEvalResult("result_conservative", "candidate_conservative", 0.98, 0.03, 410, "low", "pass");
    const aggressive = createEvalResult("result_aggressive", "candidate_aggressive", 0.88, 0.01, 360, "high", "fail", 1);

    const decision = decideRecommendation({
      evalRunId: "eval_run_test",
      results: [baseline, balanced, conservative, aggressive],
      passThreshold: 0.95
    });

    expect(decision.winnerResultId).toBe("result_balanced");
    expect(decision.cheaperAlternativeResultId).toBe("result_conservative");
    expect(decision.strongerFallbackResultId).toBe("result_conservative");
    expect(decision.rejectedCombos).toHaveLength(1);
    expect(decision.rejectedCombos[0]?.reason).toContain("Must-pass failure");
    expect(decision.productionRecommendationAllowed).toBe(true);
  });

  test("returns no-switch fallback and blockers when no combo passes", () => {
    const baseline = createEvalResult("result_baseline", "candidate_baseline", 0.84, 0.05, 600, "medium", "fail", 0);
    const aggressive = createEvalResult("result_aggressive", "candidate_aggressive", 0.72, 0.01, 350, "high", "fail", 2);

    const decision = decideRecommendation({
      evalRunId: "eval_run_test",
      results: [baseline, aggressive],
      passThreshold: 0.95
    });

    expect(decision.productionRecommendationAllowed).toBe(false);
    expect(decision.productionBlockers.join(" ")).toContain("No combo passed");
    expect(decision.winnerResultId).toBe("result_baseline");
    expect(decision.strongerFallbackResultId).toBe("result_baseline");
    expect(decision.riskNotes.join(" ")).toContain("keep the current setup");
  });

  test("labels savings unverified when registry metadata is stale or demo", () => {
    const baseline = createEvalResult("result_baseline", "candidate_baseline", 0.97, 0.05, 600, "low", "pass", 0, "unverified");
    const balanced = createEvalResult("result_balanced", "candidate_balanced", 0.97, 0.02, 420, "low", "pass", 0, "unverified");

    const decision = decideRecommendation({
      evalRunId: "eval_run_test",
      results: [baseline, balanced],
      passThreshold: 0.95
    });

    expect(decision.registryFreshness).toBe("unverified");
    expect(decision.savingsSummary).toContain("unverified");
    expect(decision.riskNotes.join(" ")).toContain("not a verified claim");
  });

  test("builds chart-ready cost-quality frontier roles", () => {
    const points = costQualityFrontier(
      [
        createEvalResult("result_baseline", "candidate_baseline", 0.97, 0.05, 600, "low", "pass"),
        createEvalResult("result_balanced", "candidate_balanced", 0.97, 0.02, 420, "low", "pass"),
        createEvalResult("result_failed", "candidate_aggressive", 0.6, 0.01, 360, "high", "fail", 1)
      ],
      { evalRunId: "eval_run_test", passThreshold: 0.95 }
    );

    expect(points.map((point) => point.role)).toEqual(["baseline", "winner_candidate", "failed"]);
    expect(points[2]?.notes.join(" ")).toContain("Must-pass failure");
  });
});

describe("CSV test case parser", () => {
  test("parses 5-50 CSV test cases", () => {
    const csv = [
      "name,input_variables,expected_output",
      "Case 1,\"{\"\"ticket\"\":\"\"one\"\"}\",\"{\"\"label\"\":\"\"billing\"\"}\"",
      "Case 2,\"{\"\"ticket\"\":\"\"two\"\"}\",\"{\"\"label\"\":\"\"support\"\"}\"",
      "Case 3,\"{\"\"ticket\"\":\"\"three\"\"}\",\"{\"\"label\"\":\"\"sales\"\"}\"",
      "Case 4,\"{\"\"ticket\"\":\"\"four\"\"}\",\"{\"\"label\"\":\"\"incident\"\"}\"",
      "Case 5,\"{\"\"ticket\"\":\"\"five\"\"}\",\"{\"\"label\"\":\"\"account\"\"}\""
    ].join("\n");

    const cases = parseCsvTestCases(csv);

    expect(cases).toHaveLength(5);
    expect(cases.at(0)?.inputVariables).toEqual({ ticket: "one" });
    expect(cases.at(4)?.expectedOutput).toEqual({ label: "account" });
  });

  test("rejects CSV uploads outside the MVP case count", () => {
    const csv = [
      "name,input_variables,expected_output",
      "Case 1,\"{}\",\"{}\"",
      "Case 2,\"{}\",\"{}\""
    ].join("\n");

    expect(() => parseCsvTestCases(csv)).toThrow("5-50");
  });
});

function createCheck(
  type: QualityCheckDefinition["type"],
  fieldPath: string | null,
  expectedValue: unknown,
  pattern: string | null = null
): QualityCheckDefinition {
  return {
    id: `check_${type}_${fieldPath ?? "root"}`,
    type,
    description: `${type} check`,
    must_pass: false,
    field_path: fieldPath,
    expected_value: expectedValue,
    pattern,
    placeholder_note: null
  };
}

function createTestCase(checks: QualityCheckDefinition[]): TestCase {
  return {
    id: "case_scoring",
    project_id: "project_test",
    quality_contract_id: "contract_test",
    name: "Scoring case",
    input_variables: {},
    expected_output: {},
    checks,
    is_mock: true,
    created_at: "2026-06-03T12:00:00.000Z",
    updated_at: "2026-06-03T12:00:00.000Z"
  };
}

function deterministicCheckResult(
  checkId: string,
  mustPass: boolean,
  passed: boolean
) {
  return {
    checkId,
    checkType: "exact" as const,
    deterministic: true,
    mustPass,
    passed,
    failureReason: passed ? null : "failed"
  };
}

function createEvalResult(
  id: string,
  candidateId: string,
  passRate: number,
  estimatedCostUsd: number,
  latencyMs: number,
  riskLevel: "low" | "medium" | "high" | "critical",
  verdict: "pass" | "fail" | "blocked",
  mustPassFailures = 0,
  costEstimateStatus: "verified" | "unverified" | "blocked" = "verified"
) {
  return {
    id,
    eval_run_id: "eval_run_test",
    candidate_id: candidateId,
    prompt_version_id: "prompt_version_test",
    model_registry_record_id: `model_${id}`,
    provider: "openai" as const,
    model_id: `openai-${id}`,
    quality_score: passRate,
    pass_rate: passRate,
    must_pass_failures: mustPassFailures,
    input_tokens: 120,
    output_tokens: 80,
    estimated_cost_usd: estimatedCostUsd,
    cost_estimate_status: costEstimateStatus,
    latency_ms: latencyMs,
    risk_level: riskLevel,
    verdict,
    failed_check_ids: mustPassFailures > 0 ? ["check_must_pass"] : [],
    is_mock: true,
    created_at: "2026-06-03T12:00:00.000Z"
  };
}
