import { type Context } from "hono";
import { autoDraftQualityContract, costQualityFrontier, decideRecommendation } from "@promptopts/eval-core";
import {
  generateAggressiveCandidate,
  generateBalancedCandidate,
  generateConservativeCandidate,
  generateModelSpecificCandidate,
  generateOutputLiteCandidate,
  type GeneratedPromptCandidate,
  type PromptCandidateGenerationInput
} from "@promptopts/prompt-core";
import {
  type CandidateStrategy,
  type Account,
  type Contact,
  type CrmNote,
  type CrmTask,
  type Entitlement,
  type EvalResult,
  type EvalRun,
  type FreeAudit,
  type FreeAuditCapture,
  type OptimizationCandidate,
  type Opportunity,
  type PromptAnalysis,
  type PromptOptsRepository,
  type PromptProject,
  type PromptVersion,
  type ProviderConnection,
  type QualityContract,
  type RecommendationReport,
  type TestCase,
  type UsageLedgerEntry
} from "@promptopts/shared";
import { encryptSecret, fingerprintSecret } from "@promptopts/shared/security";
import { errorResponseSchema, type WorkspaceDashboardResponse, type WorkspaceDashboardStatus } from "../contracts";
import type { ApiEnv } from "../context";
import { createId, nowIso, unitForFeature } from "../http";

function generateCandidateForStrategy(
  strategy: CandidateStrategy,
  input: PromptCandidateGenerationInput & { id: string }
): GeneratedPromptCandidate {
  switch (strategy) {
    case "conservative":
      return generateConservativeCandidate(input);
    case "balanced":
      return generateBalancedCandidate(input);
    case "aggressive":
      return generateAggressiveCandidate(input);
    case "output_lite":
      return generateOutputLiteCandidate(input);
    case "model_specific":
      return generateModelSpecificCandidate(input);
    case "baseline":
      throw new Error("Baseline candidates are mapped without prompt-core generation.");
  }
}

function mapGeneratedCandidateToRecord(
  generated: GeneratedPromptCandidate,
  promptVersionId: string,
  analysisId: string | null,
  baselineInputTokens: number,
  timestamp: string
): OptimizationCandidate {
  return {
    id: generated.id,
    label: generated.label,
    prompt_version_id: promptVersionId,
    analysis_id: analysisId,
    strategy: generated.strategy,
    candidate_prompt_text: generated.promptText,
    estimated_input_tokens: generated.estimatedInputTokens,
    estimated_output_tokens: generated.estimatedOutputTokens,
    rationale: generated.rationale,
    risk_level: generated.riskLabel,
    expected_token_delta: calculateTokenDelta(generated.estimatedInputTokens, baselineInputTokens),
    preserved_constraints: generated.preservedConstraints,
    removed_or_compressed_elements: generated.removedOrCompressedElements,
    is_baseline: false,
    is_mock: true,
    created_at: timestamp
  };
}

function calculateTokenDelta(candidateInputTokens: number, baselineInputTokens: number): number {
  if (baselineInputTokens <= 0) {
    return 0;
  }

  return Math.round(((candidateInputTokens - baselineInputTokens) / baselineInputTokens) * 100);
}

function getCandidatePreservedConstraints(contract: QualityContract | undefined): string[] {
  if (!contract) {
    return ["Preserve baseline variables, required output shape, and user-provided constraints."];
  }

  return [
    ...contract.must_preserve,
    ...contract.forbidden_behavior.map((item) => `Forbidden behavior: ${item}`),
    ...contract.check_definitions
      .filter((check) => check.must_pass)
      .map((check) => `Must-pass check: ${check.description}`)
  ];
}


export { generateCandidateForStrategy, getCandidatePreservedConstraints, mapGeneratedCandidateToRecord };
