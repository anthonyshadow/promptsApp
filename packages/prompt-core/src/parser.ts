import type { TaskType } from "@promptopts/shared";
import type { PromptParseResult } from "./types";

const VARIABLE_PATTERN = /{{\s*([A-Za-z_][A-Za-z0-9_]*)\s*}}/g;

// These parser heuristics are intentionally deterministic so the first audit value does not depend on an LLM call.
export function parsePrompt(prompt: string): PromptParseResult {
  const detectedVariables = detectPromptVariables(prompt);
  const constraintsDetected = detectConstraints(prompt);
  const outputRequirements = detectOutputRequirements(prompt);
  const likelyTaskType = classifyLikelyTaskType(prompt);
  const approximateInputTokens = estimatePromptTokens(prompt);

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

export function detectPromptVariables(prompt: string): string[] {
  const variables = new Set<string>();

  for (const match of prompt.matchAll(VARIABLE_PATTERN)) {
    const variable = match[1];

    if (variable) {
      variables.add(variable);
    }
  }

  return Array.from(variables);
}

function estimatePromptTokens(text: string): number {
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
