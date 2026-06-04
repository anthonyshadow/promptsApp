import type { QualityCheckDefinition, QualityContract, TestCase } from "@promptopts/shared";
import type { PromptOptsApiClient } from "../../apiClient";

type TestCaseCreateRequest = Parameters<PromptOptsApiClient["createTestCase"]>[1];

export type ManualTestCaseInput = {
  name: string;
  inputVariablesText: string;
  expectedOutputText: string;
  checkType: QualityCheckDefinition["type"];
  fieldPath: string;
  expectedValue: string;
  pattern: string;
  mustPass: boolean;
};

export type CsvTestCaseDraftInput = {
  name: string;
  inputVariables: Record<string, unknown>;
  expectedOutput: unknown;
};

export function createManualTestCaseRequest(input: ManualTestCaseInput): TestCaseCreateRequest {
  const checkType = input.checkType;
  const placeholderNote =
    checkType === "llm_judge"
      ? "LLM judge placeholder; distinct from deterministic checks."
      : checkType === "human"
        ? "Human review placeholder; distinct from deterministic checks."
        : null;

  return {
    name: input.name.trim() || "Manual test case",
    input_variables: parseJsonObjectText(input.inputVariablesText),
    expected_output: parseJsonText(input.expectedOutputText),
    checks: [
      {
        id: `check_manual_${Date.now()}`,
        type: checkType,
        description: createManualCheckDescription(checkType, input.expectedValue),
        must_pass: input.mustPass,
        field_path: input.fieldPath.trim() || null,
        expected_value: input.expectedValue.trim() || null,
        pattern: checkType === "regex" ? input.pattern.trim() || input.expectedValue.trim() || null : null,
        placeholder_note: placeholderNote
      }
    ]
  };
}

export function createCsvTestCaseRequest(
  draft: CsvTestCaseDraftInput,
  contract: QualityContract,
  index: number
): TestCaseCreateRequest {
  const baseCheck =
    contract.check_definitions.find((check) => check.must_pass) ??
    contract.check_definitions[0] ??
    createFallbackQualityCheck(index);

  return {
    name: draft.name || `CSV case ${index + 1}`,
    input_variables: draft.inputVariables,
    expected_output: draft.expectedOutput,
    checks: [
      {
        ...baseCheck,
        id: `check_csv_${Date.now()}_${index}`,
        description: `${baseCheck.description} (CSV case ${index + 1})`
      }
    ]
  };
}

export function createFallbackQualityCheck(index: number): QualityCheckDefinition {
  return {
    id: `check_csv_fallback_${index}`,
    type: "json_schema",
    description: "Output includes expected fields.",
    must_pass: true,
    field_path: null,
    expected_value: [],
    pattern: null,
    placeholder_note: null
  };
}

export function createManualCheckDescription(
  checkType: QualityCheckDefinition["type"],
  expectedValue: string
): string {
  switch (checkType) {
    case "exact":
      return `Exact value matches ${expectedValue || "expected output"}.`;
    case "json_schema":
      return "Output includes required JSON schema fields.";
    case "regex":
      return `Regex matches ${expectedValue || "expected pattern"}.`;
    case "required_phrase":
      return `Includes required phrase ${expectedValue || "from contract"}.`;
    case "forbidden_phrase":
      return `Excludes forbidden phrase ${expectedValue || "from contract"}.`;
    case "llm_judge":
      return "LLM judge placeholder for nuanced quality review.";
    case "human":
      return "Human placeholder for manual acceptance review.";
  }
}

export function parseJsonObjectText(value: string): Record<string, unknown> {
  const parsed = parseJsonText(value);

  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}

export function parseJsonText(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value.trim() || null;
  }
}

export function formatTestCaseStatus(testCase: TestCase): string {
  const mustPassCount = testCase.checks.filter((check) => check.must_pass).length;
  const placeholderCount = testCase.checks.filter(
    (check) => check.type === "llm_judge" || check.type === "human"
  ).length;

  if (mustPassCount > 0) {
    return placeholderCount > 0 ? "Must-pass with review placeholder" : "Must-pass ready";
  }

  return placeholderCount > 0 ? "Review placeholder" : "Tracked";
}

export function formatExpectedOutput(value: unknown): string {
  if (value === null || typeof value === "undefined") {
    return "Not set";
  }

  return typeof value === "string" ? value : JSON.stringify(value);
}
