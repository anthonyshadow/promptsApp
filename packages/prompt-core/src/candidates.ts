import type { CandidateStrategy, Provider, RiskLevel } from "@promptopts/shared";
import { detectPromptVariables, parsePrompt } from "./parser";
import type {
  GeneratedPromptCandidate,
  PromptCandidateGenerationInput
} from "./types";

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
  const variables = detectPromptVariables(input.promptText);
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
  const variables = detectPromptVariables(input.promptText);
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
  const variableConstraints = detectPromptVariables(input.promptText).map(
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
