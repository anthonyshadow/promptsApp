import type {
  AuditRequest,
  ModelFit,
  ModelRegistryRecord,
  MonthlyCostEstimate,
  RiskLevel,
  SensitiveFinding,
  SuggestedModelRole
} from "@promptopts/shared";
import { estimateMonthlyCost } from "./cost";
import { classifyModelFit } from "./modelFit";
import { parsePrompt } from "./parser";
import { detectSensitiveContent } from "./sensitiveContent";
import type {
  ModelFitClassification,
  PromptModelAuditInput,
  PromptModelAuditResult,
  PromptParseResult
} from "./types";

// The audit returns risk-first guidance and explicitly stops short of recommending a production switch.
export function runPromptModelAudit(input: PromptModelAuditInput): PromptModelAuditResult {
  const promptAnalysis = parsePrompt(input.prompt);
  const modelRegistryRecord =
    input.modelRegistryRecords.find(
      (record) => record.provider === input.provider && record.model_id === input.modelId
    ) ?? null;
  const monthlyCostEstimate = estimateMonthlyCost({
    inputTokens: promptAnalysis.approximateInputTokens,
    outputTokens: promptAnalysis.approximateOutputEstimate,
    monthlyCalls: input.monthlyCalls,
    modelRegistryRecord
  });
  const sensitiveFindings = detectSensitiveContent(input.prompt);
  const modelFit = classifyModelFit({
    provider: input.provider,
    modelId: input.modelId,
    modelRegistryRecord,
    taskType: input.taskType,
    priority: input.priority,
    constraints: input.constraints,
    promptAnalysis
  });
  const sameProviderModels = input.modelRegistryRecords.filter((record) => record.provider === input.provider);

  return {
    inputTokens: promptAnalysis.approximateInputTokens,
    estimatedOutputTokens: promptAnalysis.approximateOutputEstimate,
    monthlyCostEstimate,
    promptAnalysis,
    sensitiveFindings,
    wasteFindings: buildWasteFindings(promptAnalysis, modelFit, monthlyCostEstimate),
    modelFit: modelFit.fit,
    modelFitReasons: modelFit.reasonCodes,
    riskLevel: computeRiskLevel(sensitiveFindings, modelFit, promptAnalysis, monthlyCostEstimate),
    compressionGuardrails: buildCompressionGuardrails(input, promptAnalysis, sensitiveFindings, monthlyCostEstimate),
    suggestedModels: sameProviderModels.map((record) => record.model_id),
    suggestedModelRoles: buildSuggestedModelRoles(input.modelId, modelRegistryRecord, sameProviderModels),
    suggestedNextAction: getSuggestedNextAction(sensitiveFindings, modelFit.fit, monthlyCostEstimate),
    registryFreshness: modelRegistryRecord?.freshness_status ?? "unverified"
  };
}

function buildWasteFindings(
  promptAnalysis: PromptParseResult,
  modelFit: ModelFitClassification,
  costEstimate: MonthlyCostEstimate
): string[] {
  const findings = [...promptAnalysis.repeatedInstructionFindings];

  if (modelFit.fit === "overpowered") {
    findings.push("Current model appears high-capability for a bounded prompt; benchmark cheaper same-provider candidates.");
  }

  if (promptAnalysis.outputRequirements.length === 0) {
    findings.push("Output requirements are underspecified, which raises eval and compression risk.");
  }

  if (promptAnalysis.detectedVariables.length === 0) {
    findings.push("No template variables detected; confirm the prompt has a stable input boundary.");
  }

  if (costEstimate.unverified) {
    findings.push("Cost estimate is unverified because registry metadata is stale, demo, or missing verification.");
  }

  if (findings.length === 0) {
    findings.push("No obvious deterministic waste found; move to success contract before generating candidates.");
  }

  return findings;
}

function computeRiskLevel(
  sensitiveFindings: SensitiveFinding[],
  modelFit: ModelFitClassification,
  promptAnalysis: PromptParseResult,
  costEstimate: MonthlyCostEstimate
): RiskLevel {
  if (sensitiveFindings.some((finding) => finding.severity === "critical")) {
    return "critical";
  }

  if (sensitiveFindings.some((finding) => finding.severity === "high") || modelFit.fit === "underpowered") {
    return "high";
  }

  if (
    sensitiveFindings.length > 0 ||
    promptAnalysis.outputRequirements.length === 0 ||
    costEstimate.unverified
  ) {
    return "medium";
  }

  return "low";
}

function buildCompressionGuardrails(
  input: AuditRequest,
  promptAnalysis: PromptParseResult,
  sensitiveFindings: SensitiveFinding[],
  costEstimate: MonthlyCostEstimate
): string[] {
  const guardrails = [
    "Keep the current prompt and model as the eval baseline.",
    "Audit findings are preflight only; do not make a production switch without passing evals."
  ];

  if (promptAnalysis.detectedVariables.length > 0) {
    guardrails.push(`Preserve detected variables: ${promptAnalysis.detectedVariables.map((item) => `{{${item}}}`).join(", ")}.`);
  }

  if (input.constraints.requiresJson || promptAnalysis.outputRequirements.includes("json")) {
    guardrails.push("Preserve JSON or structured output shape before attempting compression.");
  }

  if (sensitiveFindings.length > 0) {
    guardrails.push("Redact or remove secrets and PII before any provider call.");
  }

  if (costEstimate.unverified) {
    guardrails.push("Do not claim exact savings until registry pricing and freshness are verified.");
  }

  return guardrails;
}

function buildSuggestedModelRoles(
  currentModelId: string,
  currentRecord: ModelRegistryRecord | null,
  sameProviderModels: ModelRegistryRecord[]
): SuggestedModelRole[] {
  const roles: SuggestedModelRole[] = [];
  const baselineRecord = currentRecord ?? sameProviderModels.find((record) => record.model_id === currentModelId);

  roles.push({
    role: "baseline",
    modelId: currentModelId,
    registryRecordId: baselineRecord?.id ?? null,
    reason: "Current prompt and model remain the regression baseline."
  });

  const currentPrice = currentRecord ? modelPriceScore(currentRecord) : Number.POSITIVE_INFINITY;
  const cheaper = sameProviderModels
    .filter((record) => record.model_id !== currentModelId)
    .sort((a, b) => modelPriceScore(a) - modelPriceScore(b))
    .find((record) => modelPriceScore(record) <= currentPrice);

  if (cheaper) {
    roles.push({
      role: "cheaper_candidate",
      modelId: cheaper.model_id,
      registryRecordId: cheaper.id,
      reason: "Same-provider candidate for eval benchmarking, not a production switch recommendation."
    });
  }

  const stronger = sameProviderModels
    .filter((record) => record.model_id !== currentModelId)
    .sort((a, b) => qualityScore(b) - qualityScore(a))
    .find((record) => currentRecord ? qualityScore(record) >= qualityScore(currentRecord) : true);

  if (stronger) {
    roles.push({
      role: "stronger_fallback",
      modelId: stronger.model_id,
      registryRecordId: stronger.id,
      reason: "Fallback role for quality risk evaluation."
    });
  }

  if (roles.length === 1) {
    roles.push({
      role: "registry_verification",
      modelId: currentModelId,
      registryRecordId: baselineRecord?.id ?? null,
      reason: "Add verified same-provider alternatives before claiming savings."
    });
  }

  return roles;
}

function modelPriceScore(record: ModelRegistryRecord): number {
  return record.input_price_per_million_tokens + record.output_price_per_million_tokens;
}

function qualityScore(record: ModelRegistryRecord): number {
  const scores: Record<ModelRegistryRecord["quality_tier"], number> = {
    economy: 1,
    balanced: 2,
    frontier: 3,
    unknown: 0
  };

  return scores[record.quality_tier];
}

function getSuggestedNextAction(
  sensitiveFindings: SensitiveFinding[],
  modelFit: ModelFit,
  costEstimate: MonthlyCostEstimate
): string {
  if (sensitiveFindings.length > 0) {
    return "Redact sensitive content before provider calls, then define the success contract.";
  }

  if (modelFit === "underpowered") {
    return "Treat quality risk first: define must-pass tests and include a stronger same-provider fallback.";
  }

  if (modelFit === "overpowered") {
    return "Define the success contract, then benchmark cheaper same-provider candidates through evals.";
  }

  if (costEstimate.unverified) {
    return "Verify registry metadata before making any exact savings claim.";
  }

  return "Define the success contract before generating candidates.";
}
