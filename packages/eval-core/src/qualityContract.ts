import type { PromptAnalysis, QualityCheckDefinition, TaskType } from "@promptopts/shared";
import type { QualityContractDraft } from "./types";
import { dedupeStrings } from "./utils";

// Auto-draft gives users a starting contract; manual review still owns the final quality bar.
export function autoDraftQualityContract(promptAnalysis: PromptAnalysis): QualityContractDraft {
  const primaryCheckId = `${promptAnalysis.id}_check_required_output`;
  const exactCheckId = `${promptAnalysis.id}_check_expected_value`;
  const forbiddenCheckId = `${promptAnalysis.id}_check_no_private_policy`;
  const judgeCheckId = `${promptAnalysis.id}_check_llm_judge_placeholder`;
  const taskLabel = formatTask(promptAnalysis.task_type);
  const mustPreserve = dedupeStrings([
    ...promptAnalysis.compression_guardrails,
    ...defaultMustPreserve(promptAnalysis.task_type)
  ]);
  const checkDefinitions: QualityCheckDefinition[] = [
    {
      id: primaryCheckId,
      type: requiredOutputCheckType(promptAnalysis.task_type),
      description: requiredOutputCheckDescription(promptAnalysis.task_type),
      must_pass: true,
      field_path: null,
      expected_value: requiredOutputExpectedValue(promptAnalysis.task_type),
      pattern: null,
      placeholder_note: null
    },
    {
      id: exactCheckId,
      type: "exact",
      description: "Representative expected field value is preserved exactly.",
      must_pass: promptAnalysis.task_type === "classification" || promptAnalysis.task_type === "extraction",
      field_path: defaultExactFieldPath(promptAnalysis.task_type),
      expected_value: defaultExactExpectedValue(promptAnalysis.task_type),
      pattern: null,
      placeholder_note: null
    },
    {
      id: forbiddenCheckId,
      type: "forbidden_phrase",
      description: "Output does not expose internal policy or private instructions.",
      must_pass: true,
      field_path: null,
      expected_value: "internal policy",
      pattern: null,
      placeholder_note: null
    },
    {
      id: judgeCheckId,
      type: "llm_judge",
      description: "Nuanced quality, tone, and relevance review.",
      must_pass: false,
      field_path: null,
      expected_value: "meets_quality_contract",
      pattern: null,
      placeholder_note: "LLM judge placeholder; distinct from deterministic checks."
    }
  ];

  return {
    task: taskLabel,
    required_output: defaultRequiredOutput(promptAnalysis.task_type),
    must_preserve: mustPreserve,
    forbidden_behavior: [
      "Do not drop must-pass requirements to reduce tokens.",
      "Do not invent facts that are not present in the input.",
      "Do not expose secrets, private policy text, or internal chain-of-thought."
    ],
    pass_threshold: promptAnalysis.risk_level === "high" || promptAnalysis.risk_level === "critical" ? 0.98 : 0.95,
    must_pass_check_ids: checkDefinitions.filter((check) => check.must_pass).map((check) => check.id),
    check_definitions: checkDefinitions,
    notes:
      "Auto-drafted from deterministic prompt analysis. Review must-pass checks before generating candidates."
  };
}

function formatTask(taskType: TaskType): string {
  return taskType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function defaultRequiredOutput(taskType: TaskType): string {
  switch (taskType) {
    case "classification":
      return "A stable label or JSON object with the expected classification fields.";
    case "extraction":
      return "Structured output with all required extracted fields present.";
    case "support":
      return "Support-ready response that preserves urgency, routing, and customer context.";
    case "summarization":
      return "Concise summary that preserves key facts, decisions, and risks.";
    case "coding":
      return "Correct, scoped code or code guidance matching the requested constraints.";
    case "rag":
      return "Answer grounded in provided context with unsupported claims avoided.";
    case "agent":
      return "Action plan or tool-use output that respects required constraints.";
    case "other":
      return "Output that preserves the prompt's stated success criteria.";
  }
}

function defaultMustPreserve(taskType: TaskType): string[] {
  switch (taskType) {
    case "classification":
      return ["Label set", "Output field names", "Tie-breaking rules"];
    case "extraction":
      return ["Required fields", "Null/unknown handling", "Structured output shape"];
    case "support":
      return ["Urgency", "Routing group", "Customer intent"];
    case "summarization":
      return ["Key facts", "Risks", "Decisions"];
    case "coding":
      return ["Runtime constraints", "API contracts", "Edge cases"];
    case "rag":
      return ["Grounding in retrieved context", "Citation requirements", "Unknown-answer behavior"];
    case "agent":
      return ["Tool constraints", "Safety boundaries", "Stop conditions"];
    case "other":
      return ["User intent", "Required output format", "Safety constraints"];
  }
}

function requiredOutputCheckType(taskType: TaskType): QualityCheckDefinition["type"] {
  return taskType === "classification" || taskType === "extraction" ? "json_schema" : "required_phrase";
}

function requiredOutputCheckDescription(taskType: TaskType): string {
  return taskType === "classification" || taskType === "extraction"
    ? "Output includes required structured fields."
    : "Output includes the required success signal.";
}

function requiredOutputExpectedValue(taskType: TaskType): unknown {
  switch (taskType) {
    case "classification":
      return ["label", "confidence"];
    case "extraction":
      return ["fields"];
    case "support":
      return "support";
    case "summarization":
      return "summary";
    default:
      return "success";
  }
}

function defaultExactFieldPath(taskType: TaskType): string | null {
  if (taskType === "classification") {
    return "label";
  }

  if (taskType === "extraction") {
    return "fields.status";
  }

  return null;
}

function defaultExactExpectedValue(taskType: TaskType): unknown {
  if (taskType === "classification") {
    return "__expected_label__";
  }

  if (taskType === "extraction") {
    return "__expected_value__";
  }

  return "__expected_output__";
}
