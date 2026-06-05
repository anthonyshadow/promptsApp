import type {
  EvalResult,
  EvalVerdict,
  PromptAnalysis,
  QualityCheckDefinition,
  QualityContract,
  TaskType,
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

export function validateQualityCheck(
  check: QualityCheckDefinition,
  actualOutput: unknown
): CheckValidationResult {
  if (check.type === "llm_judge" || check.type === "human") {
    return {
      checkId: check.id,
      checkType: check.type,
      deterministic: false,
      mustPass: check.must_pass,
      passed: null,
      failureReason: check.placeholder_note ?? "Placeholder check requires non-deterministic review."
    };
  }

  const selectedValue = selectValue(actualOutput, check.field_path);
  const selectedText = stringifyForCheck(selectedValue);

  switch (check.type) {
    case "exact": {
      const passed = valuesMatch(selectedValue, check.expected_value);

      return deterministicResult(check, passed, "Expected exact value did not match.");
    }
    case "json_schema": {
      const parsed = parseObjectOutput(actualOutput);
      const passed = parsed
        ? requiredKeysFromExpected(check.expected_value).every((key) => Object.prototype.hasOwnProperty.call(parsed, key))
        : false;

      return deterministicResult(check, passed, "Output is not valid JSON with the required keys.");
    }
    case "regex": {
      if (!check.pattern) {
        return deterministicResult(check, false, "Regex check is missing a pattern.");
      }

      try {
        return deterministicResult(check, new RegExp(check.pattern, "i").test(selectedText), "Regex pattern did not match.");
      } catch {
        return deterministicResult(check, false, "Regex pattern is invalid.");
      }
    }
    case "required_phrase": {
      const phrase = typeof check.expected_value === "string" ? check.expected_value : "";

      return deterministicResult(
        check,
        phrase.length > 0 && selectedText.toLowerCase().includes(phrase.toLowerCase()),
        "Required phrase was not present."
      );
    }
    case "forbidden_phrase": {
      const phrase = typeof check.expected_value === "string" ? check.expected_value : "";

      return deterministicResult(
        check,
        phrase.length > 0 && !selectedText.toLowerCase().includes(phrase.toLowerCase()),
        "Forbidden phrase was present."
      );
    }
  }
}

export function validateTestCaseChecks(
  testCase: TestCase,
  actualOutput: unknown
): TestCaseValidationResult {
  const results = testCase.checks.map((check) => validateQualityCheck(check, actualOutput));
  const deterministicResults = results.filter((result) => result.deterministic);
  const passedDeterministic = deterministicResults.filter((result) => result.passed).length;
  const mustPassFailures = results
    .filter((result) => result.mustPass && result.passed !== true)
    .map((result) => result.checkId);
  const unresolvedPlaceholders = results
    .filter((result) => !result.deterministic && result.passed === null)
    .map((result) => result.checkId);

  return {
    testCaseId: testCase.id,
    results,
    deterministicPassRate:
      deterministicResults.length === 0 ? 0 : passedDeterministic / deterministicResults.length,
    mustPassFailures,
    unresolvedPlaceholders,
    passed: mustPassFailures.length === 0 && deterministicResults.every((result) => result.passed === true)
  };
}

export function runDeterministicChecks(
  testCase: TestCase,
  actualOutput: unknown
): TestCaseValidationResult {
  return validateTestCaseChecks(testCase, actualOutput);
}

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

export function parseCsvTestCases(csvText: string): CsvTestCaseDraft[] {
  const rows = parseCsvRows(csvText).filter((row) => row.some((cell) => cell.trim().length > 0));

  if (rows.length < 2) {
    throw new Error("CSV must include a header row and 5-50 test cases.");
  }

  const headerRow = rows[0];

  if (!headerRow) {
    throw new Error("CSV must include a header row and 5-50 test cases.");
  }

  const headers = headerRow.map((header) => header.trim().toLowerCase());
  const nameIndex = headers.indexOf("name");
  const variablesIndex = headers.indexOf("input_variables");
  const expectedIndex = headers.indexOf("expected_output");

  if (nameIndex === -1 || variablesIndex === -1 || expectedIndex === -1) {
    throw new Error("CSV headers must include name,input_variables,expected_output.");
  }

  const drafts = rows.slice(1).map((row) => ({
    name: row[nameIndex]?.trim() || "CSV test case",
    inputVariables: parseJsonObjectCell(row[variablesIndex] ?? "{}"),
    expectedOutput: parseJsonCell(row[expectedIndex] ?? "null")
  }));

  if (drafts.length < 5 || drafts.length > 50) {
    throw new Error("CSV upload supports 5-50 test cases for MVP.");
  }

  return drafts;
}

function deterministicResult(
  check: QualityCheckDefinition,
  passed: boolean,
  failureReason: string
): CheckValidationResult {
  return {
    checkId: check.id,
    checkType: check.type,
    deterministic: true,
    mustPass: check.must_pass,
    passed,
    failureReason: passed ? null : failureReason
  };
}

function selectValue(output: unknown, fieldPath: string | null): unknown {
  if (!fieldPath) {
    return output;
  }

  const parsed = parseObjectOutput(output);

  if (!parsed) {
    return undefined;
  }

  return fieldPath.split(".").reduce<unknown>((current, segment) => {
    if (current && typeof current === "object" && segment in current) {
      return (current as Record<string, unknown>)[segment];
    }

    return undefined;
  }, parsed);
}

function parseObjectOutput(output: unknown): Record<string, unknown> | null {
  if (output && typeof output === "object" && !Array.isArray(output)) {
    return output as Record<string, unknown>;
  }

  if (typeof output !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(output);

    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function requiredKeysFromExpected(expectedValue: unknown): string[] {
  if (Array.isArray(expectedValue)) {
    return expectedValue.filter((item): item is string => typeof item === "string" && item.length > 0);
  }

  if (expectedValue && typeof expectedValue === "object" && "required" in expectedValue) {
    const required = (expectedValue as { required?: unknown }).required;

    return Array.isArray(required)
      ? required.filter((item): item is string => typeof item === "string" && item.length > 0)
      : [];
  }

  return [];
}

function stringifyForCheck(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (value === null || typeof value === "undefined") {
    return "";
  }

  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function roundRate(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function valuesMatch(actual: unknown, expected: unknown): boolean {
  if (typeof actual === "string" && typeof expected === "string") {
    return actual.trim() === expected.trim();
  }

  return JSON.stringify(actual) === JSON.stringify(expected);
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

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();

    if (trimmed && !seen.has(key)) {
      seen.add(key);
      deduped.push(trimmed);
    }
  }

  return deduped;
}

function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const nextChar = csvText[index + 1];

    if (char === "\"" && inQuotes && nextChar === "\"") {
      cell += "\"";
      index += 1;
      continue;
    }

    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);

  return rows;
}

function parseJsonObjectCell(value: string): Record<string, unknown> {
  const parsed = parseJsonCell(value);

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }

  throw new Error("input_variables must be a JSON object.");
}

function parseJsonCell(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
