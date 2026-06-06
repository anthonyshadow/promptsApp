import type {
  EvalResult,
  EvalVerdict,
  QualityCheckDefinition,
  QualityContract,
  RegistryFreshness,
  TestCase
} from "@promptopts/shared";

export type QualityContractDraft = Pick<
  QualityContract,
  | "task"
  | "required_output"
  | "must_preserve"
  | "forbidden_behavior"
  | "pass_threshold"
  | "must_pass_check_ids"
  | "check_definitions"
  | "notes"
>;

export type CheckValidationResult = {
  checkId: string;
  checkType: QualityCheckDefinition["type"];
  deterministic: boolean;
  mustPass: boolean;
  passed: boolean | null;
  failureReason: string | null;
};

export type TestCaseValidationResult = {
  testCaseId: string;
  results: CheckValidationResult[];
  deterministicPassRate: number;
  mustPassFailures: string[];
  unresolvedPlaceholders: string[];
  passed: boolean;
};

export type CsvTestCaseDraft = {
  name: string;
  inputVariables: Record<string, unknown>;
  expectedOutput: unknown;
};

export type LlmJudgeInput = {
  check: QualityCheckDefinition;
  prompt: string;
  actualOutput: unknown;
  expectedOutput: unknown;
};

export type LlmJudgeResult = {
  checkId: string;
  passed: boolean;
  score: number;
  rationale: string;
};

export interface LlmJudgeAdapter {
  judge(input: LlmJudgeInput): Promise<LlmJudgeResult>;
}

export type EvalComboScoreInput = {
  testCaseResults: TestCaseValidationResult[];
  passThreshold: number;
};

export type EvalComboScore = {
  qualityScore: number;
  passRate: number;
  mustPassFailures: number;
  failedCheckIds: string[];
  unresolvedPlaceholderCheckIds: string[];
  verdict: EvalVerdict;
};

export type EvalRunAggregate = {
  totalResults: number;
  passingResults: number;
  failingResults: number;
  blockedResults: number;
  bestResultId: string | null;
  productionRecommendationAllowed: boolean;
  blockers: string[];
};

export type CostQualityFrontierRole = "baseline" | "safe" | "winner_candidate" | "failed";

export type CostQualityFrontierPoint = {
  result_id: string;
  candidate_id: string;
  model_id: string;
  label: string;
  quality_score: number;
  pass_rate: number;
  estimated_cost_usd: number | null;
  cost_estimate_status: EvalResult["cost_estimate_status"];
  latency_ms: number | null;
  verdict: EvalVerdict;
  role: CostQualityFrontierRole;
  is_baseline: boolean;
  notes: string[];
};

export type RecommendationRejectedCombo = {
  resultId: string;
  candidateId: string;
  modelId: string;
  reason: string;
  failedCheckIds: string[];
  mustPassFailures: number;
};

export type RecommendationDecisionInput = {
  evalRunId: string;
  results: EvalResult[];
  passThreshold: number;
  testCaseCount?: number;
};

export type RecommendationDecision = {
  evalRunId: string;
  winnerResultId: string | null;
  cheaperAlternativeResultId: string | null;
  strongerFallbackResultId: string | null;
  rejectedCombos: RecommendationRejectedCombo[];
  riskNotes: string[];
  productionRecommendationAllowed: boolean;
  productionBlockers: string[];
  registryFreshness: RegistryFreshness;
  savingsSummary: string | null;
  rankedPassingResultIds: string[];
};
