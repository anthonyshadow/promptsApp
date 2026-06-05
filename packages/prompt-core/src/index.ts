import type {
  AuditConstraints,
  AuditRequest,
  CandidateStrategy,
  CostEstimateStatus,
  ModelFit,
  ModelRegistryRecord,
  MonthlyCostEstimate,
  Priority,
  Provider,
  RegistryFreshness,
  RiskLevel,
  SensitiveFinding,
  SuggestedModelRole,
  TaskType
} from "@promptopts/shared";

export type PromptParseResult = {
  detectedVariables: string[];
  repeatedInstructionFindings: string[];
  examplesDetected: boolean;
  constraintsDetected: string[];
  outputRequirements: string[];
  likelyTaskType: TaskType;
  approximateInputTokens: number;
  approximateOutputEstimate: number;
};

export type MonthlyCostInput = {
  inputTokens: number;
  outputTokens: number;
  monthlyCalls: number;
  modelRegistryRecord: ModelRegistryRecord | null;
};

export type ModelFitInput = {
  provider: Provider;
  modelId: string;
  modelRegistryRecord: ModelRegistryRecord | null;
  taskType: TaskType;
  priority: Priority;
  constraints: AuditConstraints;
  promptAnalysis: PromptParseResult;
};

export type ModelFitClassification = {
  fit: ModelFit;
  reasonCodes: string[];
};

export type PromptModelAuditInput = AuditRequest & {
  modelRegistryRecords: ModelRegistryRecord[];
};

export type PromptModelAuditResult = {
  inputTokens: number;
  estimatedOutputTokens: number;
  monthlyCostEstimate: MonthlyCostEstimate;
  promptAnalysis: PromptParseResult;
  sensitiveFindings: SensitiveFinding[];
  wasteFindings: string[];
  modelFit: ModelFit;
  modelFitReasons: string[];
  riskLevel: RiskLevel;
  compressionGuardrails: string[];
  suggestedModels: string[];
  suggestedModelRoles: SuggestedModelRole[];
  suggestedNextAction: string;
  registryFreshness: RegistryFreshness;
};

export type PromptCandidateGenerationInput = {
  id?: string;
  promptText: string;
  strategy?: CandidateStrategy;
  provider?: Provider;
  modelId?: string;
  preservedConstraints?: string[];
  requiredOutput?: string | null;
  outputRequirements?: string[];
};

export type GeneratedPromptCandidate = {
  id: string;
  label: string;
  strategy: CandidateStrategy;
  promptText: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  riskLabel: RiskLevel;
  rationale: string;
  preservedConstraints: string[];
  removedOrCompressedElements: string[];
};

const VARIABLE_PATTERN = /{{\s*([A-Za-z_][A-Za-z0-9_]*)\s*}}/g;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g;
const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;
const CREDIT_CARD_PATTERN = /\b(?:\d[ -]*?){13,16}\b/g;
const OPENAI_KEY_PATTERN = /\bsk-[A-Za-z0-9_-]{20,}\b/g;
const AWS_KEY_PATTERN = /\bAKIA[0-9A-Z]{16}\b/g;
const GEMINI_KEY_PATTERN = /\bAIza[0-9A-Za-z_-]{20,}\b/g;
const TOKEN_PATTERN = /\b(?:api[_-]?key|access[_-]?token|bearer|secret[_-]?key)\s*[:=]\s*["']?[^"'\s]{8,}/gi;
const CREDENTIAL_PATTERN = /\b(?:password|passwd|pwd|username)\s*[:=]\s*["']?[^"'\s]{4,}/gi;
const PRIVATE_KEY_PATTERN = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g;
const PROPRIETARY_PATTERN = /\b(?:confidential|proprietary|internal policy|do not share|under nda|customer escalation policy)\b/gi;

// These parser heuristics are intentionally deterministic so the first audit value does not depend on an LLM call.
export function parsePrompt(prompt: string): PromptParseResult {
  const detectedVariables = detectVariables(prompt);
  const constraintsDetected = detectConstraints(prompt);
  const outputRequirements = detectOutputRequirements(prompt);
  const likelyTaskType = classifyLikelyTaskType(prompt);
  const approximateInputTokens = estimateTokens(prompt);

  return {
    detectedVariables,
    repeatedInstructionFindings: detectRepeatedInstructions(prompt),
    examplesDetected: /\b(?:example|examples|for example|few[-\s]?shot|input:|output:)\b/i.test(prompt),
    constraintsDetected,
    outputRequirements,
    likelyTaskType,
    approximateInputTokens,
    approximateOutputEstimate: estimateOutputTokens(likelyTaskType, outputRequirements, prompt)
  };
}

// Secret/PII warnings happen before provider calls; do not weaken these checks just to reduce false positives.
export function detectSensitiveContent(text: string): SensitiveFinding[] {
  const findings: SensitiveFinding[] = [];

  addPatternFindings(findings, text, OPENAI_KEY_PATTERN, "api_key", "critical", "Likely OpenAI-style API key", "api_key_openai");
  addPatternFindings(findings, text, AWS_KEY_PATTERN, "api_key", "critical", "Likely AWS access key", "api_key_aws");
  addPatternFindings(findings, text, GEMINI_KEY_PATTERN, "api_key", "critical", "Likely Gemini API key", "api_key_gemini");
  addPatternFindings(findings, text, TOKEN_PATTERN, "common_secret", "high", "Likely token or secret", "common_secret");
  addPatternFindings(findings, text, CREDENTIAL_PATTERN, "credential", "high", "Likely credential", "credential");
  addPatternFindings(findings, text, PRIVATE_KEY_PATTERN, "common_secret", "critical", "Private key material", "private_key");
  addPatternFindings(findings, text, EMAIL_PATTERN, "pii", "medium", "Email address", "pii_email");
  addPatternFindings(findings, text, PHONE_PATTERN, "pii", "medium", "Phone number", "pii_phone");
  addPatternFindings(findings, text, SSN_PATTERN, "pii", "high", "Likely SSN", "pii_ssn");
  addPatternFindings(findings, text, CREDIT_CARD_PATTERN, "pii", "high", "Likely payment card number", "pii_payment_card");
  addPatternFindings(
    findings,
    text,
    PROPRIETARY_PATTERN,
    "proprietary_policy",
    "medium",
    "Proprietary or internal policy",
    "proprietary_policy"
  );

  return dedupeFindings(findings);
}

// Cost estimates must come from the registry row supplied by the caller, never from provider constants in this package.
export function estimateMonthlyCost(input: MonthlyCostInput): MonthlyCostEstimate {
  const record = input.modelRegistryRecord;

  if (!record) {
    return {
      estimatedMonthlyCostUsd: null,
      inputCostUsd: null,
      outputCostUsd: null,
      estimateStatus: "blocked",
      unverified: true,
      registryFreshness: "unverified",
      metadataWarnings: ["Selected model is not present in the model registry."],
      pricingNote: "No registry row is available, so cost cannot be estimated."
    };
  }

  const inputCostUsd = costForTokens(
    input.inputTokens,
    input.monthlyCalls,
    record.input_price_per_million_tokens
  );
  const outputCostUsd = costForTokens(
    input.outputTokens,
    input.monthlyCalls,
    record.output_price_per_million_tokens
  );
  const metadataWarnings = getRegistryWarnings(record);
  const estimateStatus: CostEstimateStatus = metadataWarnings.length > 0 ? "unverified" : "verified";

  return {
    estimatedMonthlyCostUsd: roundCurrency(inputCostUsd + outputCostUsd),
    inputCostUsd: roundCurrency(inputCostUsd),
    outputCostUsd: roundCurrency(outputCostUsd),
    estimateStatus,
    unverified: estimateStatus !== "verified",
    registryFreshness: record.freshness_status,
    metadataWarnings,
    pricingNote: record.pricing_note
  };
}

// Fit labels are a preflight signal only; they guide eval setup and must not become production recommendations.
export function classifyModelFit(input: ModelFitInput): ModelFitClassification {
  const record = input.modelRegistryRecord;

  if (!record) {
    return {
      fit: "underpowered",
      reasonCodes: ["registry_missing"]
    };
  }

  const capabilityReasons = getCapabilityGaps(record, input.constraints);

  if (capabilityReasons.length > 0) {
    return {
      fit: "underpowered",
      reasonCodes: capabilityReasons
    };
  }

  const requiredContext = input.promptAnalysis.approximateInputTokens + input.promptAnalysis.approximateOutputEstimate;

  if (record.context_window < requiredContext) {
    return {
      fit: "underpowered",
      reasonCodes: ["context_window_too_small"]
    };
  }

  if (record.max_output_tokens < input.promptAnalysis.approximateOutputEstimate) {
    return {
      fit: "underpowered",
      reasonCodes: ["max_output_too_small"]
    };
  }

  const isSimpleTask = ["support", "classification", "extraction"].includes(input.taskType);
  const isComplexTask = ["coding", "rag", "agent"].includes(input.taskType);

  if (
    record.quality_tier === "frontier" &&
    isSimpleTask &&
    input.promptAnalysis.approximateInputTokens < 1500
  ) {
    return {
      fit: "overpowered",
      reasonCodes: ["frontier_model_for_bounded_task", "same_provider_benchmark_recommended"]
    };
  }

  if (record.quality_tier === "economy" && (isComplexTask || input.priority === "quality")) {
    return {
      fit: "underpowered",
      reasonCodes: ["economy_model_for_high_risk_task"]
    };
  }

  return {
    fit: "appropriate",
    reasonCodes: ["registry_capabilities_match_current_constraints"]
  };
}

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

export function generateConservativeCandidate(
  input: PromptCandidateGenerationInput
): GeneratedPromptCandidate {
  const preservedConstraints = buildPreservedConstraints(input);
  const normalizedPrompt = dedupeRepeatedLines(input.promptText);
  const promptText = appendPreservedConstraints(normalizedPrompt, preservedConstraints);

  return createGeneratedCandidate(input, {
    strategy: "conservative",
    label: "Conservative",
    promptText,
    outputTokenMultiplier: 0.95,
    riskLabel: "low",
    rationale: "Removes repetition and whitespace while preserving structure and quality-contract constraints.",
    removedOrCompressedElements: [
      "Duplicate line-level instructions where exact text repeated.",
      "Extra whitespace and long paragraph breaks."
    ]
  });
}

// Candidate generation preserves quality-contract constraints so later evals compare safe variants, not opaque rewrites.
export function generateBalancedCandidate(input: PromptCandidateGenerationInput): GeneratedPromptCandidate {
  const preservedConstraints = buildPreservedConstraints(input);
  const variables = detectVariables(input.promptText);
  const promptText = [
    "Task:",
    summarizePromptIntent(input.promptText),
    "",
    variables.length > 0 ? `Inputs: ${variables.map((variable) => `{{${variable}}}`).join(", ")}` : "Inputs: use the provided runtime variables.",
    input.requiredOutput ? `Required output: ${input.requiredOutput}` : "Required output: preserve the original output format.",
    "",
    "Must preserve:",
    ...preservedConstraints.map((constraint) => `- ${constraint}`),
    "",
    "Keep responses concise and avoid extra explanation unless the required output asks for it."
  ].join("\n");

  return createGeneratedCandidate(input, {
    strategy: "balanced",
    label: "Balanced",
    promptText,
    outputTokenMultiplier: 0.8,
    riskLabel: "medium",
    rationale: "Compacts the prompt into task, inputs, output, and must-preserve sections.",
    removedOrCompressedElements: [
      "Compressed narrative setup into a task summary.",
      "Moved scattered constraints into one must-preserve block."
    ]
  });
}

export function generateAggressiveCandidate(input: PromptCandidateGenerationInput): GeneratedPromptCandidate {
  const preservedConstraints = buildPreservedConstraints(input);
  const variables = detectVariables(input.promptText);
  const promptText = [
    "Compressed experiment. Do not ship without passing evals.",
    summarizePromptIntent(input.promptText),
    variables.length > 0 ? `Use: ${variables.map((variable) => `{{${variable}}}`).join(", ")}` : "Use the provided input.",
    input.requiredOutput ? `Output: ${input.requiredOutput}` : "Output: same format as baseline.",
    `Non-negotiables: ${preservedConstraints.join(" | ")}`
  ].join("\n");

  return createGeneratedCandidate(input, {
    strategy: "aggressive",
    label: "Aggressive",
    promptText,
    outputTokenMultiplier: 0.6,
    riskLabel: "high",
    rationale: "Aggressively compresses wording to find a lower-bound token profile; this is an experiment, not a recommendation.",
    removedOrCompressedElements: [
      "Removed most explanatory wording.",
      "Compressed constraints into a single non-negotiables line.",
      "Requires eval proof before any production consideration."
    ]
  });
}

export function generateOutputLiteCandidate(input: PromptCandidateGenerationInput): GeneratedPromptCandidate {
  const preservedConstraints = buildPreservedConstraints(input);
  const promptText = [
    dedupeRepeatedLines(input.promptText),
    "",
    "Output-lite guardrail:",
    "- Return only the required output.",
    "- No preamble, postscript, chain-of-thought, or optional explanation.",
    ...preservedConstraints.map((constraint) => `- Preserve: ${constraint}`)
  ].join("\n");

  return createGeneratedCandidate(input, {
    strategy: "output_lite",
    label: "Output-lite",
    promptText,
    outputTokenMultiplier: 0.5,
    riskLabel: "medium",
    rationale: "Keeps input intent stable while reducing unnecessary output length.",
    removedOrCompressedElements: [
      "Removed optional explanations from the response budget.",
      "Compressed output guidance around required fields only."
    ]
  });
}

export function generateModelSpecificCandidate(
  input: PromptCandidateGenerationInput
): GeneratedPromptCandidate {
  const preservedConstraints = buildPreservedConstraints(input);
  const providerLabel = formatProviderForPrompt(input.provider);
  const promptText = [
    `${providerLabel} tuning placeholder for ${input.modelId ?? "the selected model"}.`,
    "Provider-specific behavior is provisional until evals pass.",
    "",
    dedupeRepeatedLines(input.promptText),
    "",
    "Preserved quality-contract constraints:",
    ...preservedConstraints.map((constraint) => `- ${constraint}`)
  ].join("\n");

  return createGeneratedCandidate(input, {
    strategy: "model_specific",
    label: "Model-specific",
    promptText,
    outputTokenMultiplier: 0.9,
    riskLabel: "medium",
    rationale: "Adds a provider-tuning placeholder without claiming provider-specific quality until evals pass.",
    removedOrCompressedElements: [
      "No provider-specific optimization is trusted yet; this candidate is a labeled placeholder."
    ]
  });
}

function createGeneratedCandidate(
  input: PromptCandidateGenerationInput,
  candidate: {
    strategy: CandidateStrategy;
    label: string;
    promptText: string;
    outputTokenMultiplier: number;
    riskLabel: RiskLevel;
    rationale: string;
    removedOrCompressedElements: string[];
  }
): GeneratedPromptCandidate {
  const promptAnalysis = parsePrompt(candidate.promptText);
  const baselineAnalysis = parsePrompt(input.promptText);

  return {
    id: input.id ?? `candidate_${candidate.strategy}`,
    label: candidate.label,
    strategy: candidate.strategy,
    promptText: candidate.promptText,
    estimatedInputTokens: promptAnalysis.approximateInputTokens,
    estimatedOutputTokens: Math.max(
      1,
      Math.ceil(baselineAnalysis.approximateOutputEstimate * candidate.outputTokenMultiplier)
    ),
    riskLabel: candidate.riskLabel,
    rationale: candidate.rationale,
    preservedConstraints: buildPreservedConstraints(input),
    removedOrCompressedElements: candidate.removedOrCompressedElements
  };
}

function buildPreservedConstraints(input: PromptCandidateGenerationInput): string[] {
  const variableConstraints = detectVariables(input.promptText).map(
    (variable) => `Keep {{${variable}}} represented.`
  );
  const requiredOutput = input.requiredOutput ? [`Required output: ${input.requiredOutput}`] : [];
  const outputRequirements = input.outputRequirements?.map((requirement) => `Output requirement: ${requirement}`) ?? [];

  return dedupeStrings([
    ...(input.preservedConstraints ?? []),
    ...requiredOutput,
    ...outputRequirements,
    ...variableConstraints
  ]);
}

function appendPreservedConstraints(promptText: string, preservedConstraints: string[]): string {
  if (preservedConstraints.length === 0) {
    return promptText;
  }

  return [
    promptText,
    "",
    "Preserved quality-contract constraints:",
    ...preservedConstraints.map((constraint) => `- ${constraint}`)
  ].join("\n");
}

function dedupeRepeatedLines(promptText: string): string {
  const seen = new Set<string>();
  const lines = promptText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const deduped = lines.filter((line) => {
    const key = line.toLowerCase();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });

  return deduped.join("\n");
}

function summarizePromptIntent(promptText: string): string {
  const firstSentence = promptText
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .find((sentence) => sentence.trim().length > 0);

  if (!firstSentence) {
    return "Complete the requested task using the provided inputs.";
  }

  return firstSentence.length > 220 ? `${firstSentence.slice(0, 217).trim()}...` : firstSentence;
}

function formatProviderForPrompt(provider: Provider | undefined): string {
  switch (provider) {
    case "openai":
      return "OpenAI";
    case "anthropic":
      return "Anthropic";
    case "gemini":
      return "Gemini";
    default:
      return "Provider";
  }
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();

    if (!trimmed || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

function detectVariables(prompt: string): string[] {
  const variables = new Set<string>();

  for (const match of prompt.matchAll(VARIABLE_PATTERN)) {
    const variable = match[1];

    if (variable) {
      variables.add(variable);
    }
  }

  return Array.from(variables);
}

function estimateTokens(text: string): number {
  const normalized = text.trim();

  if (!normalized) {
    return 0;
  }

  return Math.max(1, Math.ceil(normalized.length / 4));
}

function estimateOutputTokens(taskType: TaskType, outputRequirements: string[], prompt: string): number {
  const taskBaseline: Record<TaskType, number> = {
    support: 140,
    summarization: 220,
    extraction: 160,
    coding: 360,
    rag: 260,
    agent: 320,
    classification: 110,
    other: 180
  };
  const hasConciseRequirement = /\b(?:brief|concise|short|one sentence|few words)\b/i.test(prompt);
  const hasRationale = outputRequirements.includes("rationale");
  const jsonAdjustment = outputRequirements.includes("json") ? 20 : 0;
  const rationaleAdjustment = hasRationale ? 60 : 0;
  const conciseAdjustment = hasConciseRequirement ? -40 : 0;

  return Math.max(48, taskBaseline[taskType] + jsonAdjustment + rationaleAdjustment + conciseAdjustment);
}

function classifyLikelyTaskType(prompt: string): TaskType {
  const text = prompt.toLowerCase();

  if (/\b(?:support|ticket|customer|urgency|routing|triage|escalat)/.test(text)) {
    return "support";
  }

  if (/\b(?:summarize|summary|tl;dr|recap)\b/.test(text)) {
    return "summarization";
  }

  if (/\b(?:extract|parse|fields|entities|invoice)\b/.test(text)) {
    return "extraction";
  }

  if (/\b(?:code|function|typescript|python|debug|compile)\b/.test(text)) {
    return "coding";
  }

  if (/\b(?:rag|retrieval|context|citations|source documents)\b/.test(text)) {
    return "rag";
  }

  if (/\b(?:agent|tool|plan|actions|workflow)\b/.test(text)) {
    return "agent";
  }

  if (/\b(?:classify|classification|label|category)\b/.test(text)) {
    return "classification";
  }

  return "other";
}

function detectConstraints(prompt: string): string[] {
  const checks: Array<[RegExp, string]> = [
    [/\bjson\b/i, "json_output"],
    [/\b(?:strict|valid) json\b/i, "strict_json"],
    [/\b(?:do not|never|must not)\b/i, "negative_constraint"],
    [/\b(?:must|always|required|preserve)\b/i, "must_preserve"],
    [/\b(?:schema|fields?|keys?)\b/i, "field_contract"],
    [/\b(?:max|under|less than)\s+\d+\s+(?:words?|tokens?|characters?)\b/i, "length_limit"],
    [/\b(?:exact label|allowed labels?|one of)\b/i, "label_set"]
  ];

  return uniqueMatches(prompt, checks);
}

function detectOutputRequirements(prompt: string): string[] {
  const checks: Array<[RegExp, string]> = [
    [/\bjson\b/i, "json"],
    [/\b(?:schema|fields?|keys?)\b/i, "structured_fields"],
    [/\b(?:label|category|classify)\b/i, "label"],
    [/\b(?:rationale|reason|explain)\b/i, "rationale"],
    [/\b(?:no prose|only json|nothing else)\b/i, "no_extra_text"],
    [/\b(?:summary|summarize)\b/i, "summary"]
  ];

  return uniqueMatches(prompt, checks);
}

function detectRepeatedInstructions(prompt: string): string[] {
  const checks: Array<[RegExp, string]> = [
    [/\breturn\s+(?:strict\s+)?json\b/gi, "Return JSON appears multiple times."],
    [/\bdo not\b/gi, "Negative constraints repeat and may be collapsible."],
    [/\bpreserve\b/gi, "Preservation instructions repeat and should be consolidated."],
    [/\bclassify\b/gi, "Classification instruction repeats."],
    [/\b(?:concise|brief|short)\b/gi, "Conciseness instruction repeats."]
  ];
  const findings: string[] = [];

  for (const [pattern, label] of checks) {
    const matches = prompt.match(pattern);

    if (matches && matches.length > 1) {
      findings.push(`${label} (${matches.length}x)`);
    }
  }

  return findings;
}

function uniqueMatches(text: string, checks: Array<[RegExp, string]>): string[] {
  const matches = new Set<string>();

  for (const [pattern, label] of checks) {
    if (pattern.test(text)) {
      matches.add(label);
    }
  }

  return Array.from(matches);
}

function addPatternFindings(
  findings: SensitiveFinding[],
  text: string,
  pattern: RegExp,
  type: SensitiveFinding["type"],
  severity: RiskLevel,
  label: string,
  reasonCode: string
) {
  for (const match of text.matchAll(pattern)) {
    const value = match[0];

    findings.push({
      type,
      severity,
      label,
      redactedPreview: redactSnippet(value),
      reasonCode
    });
  }
}

function redactSnippet(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim();

  if (compact.length <= 8) {
    return "[redacted]";
  }

  return `${compact.slice(0, 4)}...${compact.slice(-2)}`;
}

function dedupeFindings(findings: SensitiveFinding[]): SensitiveFinding[] {
  const seen = new Set<string>();
  const deduped: SensitiveFinding[] = [];

  for (const finding of findings) {
    const key = `${finding.type}:${finding.reasonCode}:${finding.redactedPreview}`;

    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(finding);
    }
  }

  return deduped;
}

function costForTokens(tokensPerCall: number, monthlyCalls: number, pricePerMillionTokens: number): number {
  return (tokensPerCall * monthlyCalls * pricePerMillionTokens) / 1_000_000;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function getRegistryWarnings(record: ModelRegistryRecord): string[] {
  const warnings: string[] = [];

  if (record.is_mock) {
    warnings.push("Registry row is demo/mock metadata.");
  }

  if (record.freshness_status !== "fresh") {
    warnings.push(`Registry freshness is ${record.freshness_status}.`);
  }

  if (record.stability_status === "unverified" || record.stability_status === "deprecated") {
    warnings.push(`Model stability is ${record.stability_status}.`);
  }

  if (!record.source_url || !record.last_verified_at) {
    warnings.push("Pricing metadata lacks current source verification.");
  }

  return warnings;
}

function getCapabilityGaps(record: ModelRegistryRecord, constraints: AuditConstraints): string[] {
  const gaps: string[] = [];

  if (constraints.usesImages && !record.supports_image) {
    gaps.push("image_input_not_supported");
  }

  if (constraints.usesTools && !record.supports_tools) {
    gaps.push("tool_use_not_supported");
  }

  if ((constraints.requiresJson || constraints.needsStructuredOutput) && !record.supports_structured_output) {
    gaps.push("structured_output_not_supported");
  }

  if (constraints.minContextWindow && record.context_window < constraints.minContextWindow) {
    gaps.push("minimum_context_not_met");
  }

  return gaps;
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
