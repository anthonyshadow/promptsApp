import type { QualityCheckDefinition, TestCase } from "@promptopts/shared";
import type { CheckValidationResult, TestCaseValidationResult } from "./types";

// Deterministic checks form the hard MVP gate; LLM/human checks stay explicit placeholders until adapters exist.
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

function valuesMatch(actual: unknown, expected: unknown): boolean {
  if (typeof actual === "string" && typeof expected === "string") {
    return actual.trim() === expected.trim();
  }

  return JSON.stringify(actual) === JSON.stringify(expected);
}
