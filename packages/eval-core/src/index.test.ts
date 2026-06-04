import { describe, expect, test } from "bun:test";
import type { PromptAnalysis, QualityCheckDefinition, TestCase } from "@promptopts/shared";
import {
  autoDraftQualityContract,
  parseCsvTestCases,
  validateQualityCheck,
  validateTestCaseChecks
} from "./index";

const baseAnalysis: PromptAnalysis = {
  id: "analysis_test",
  prompt_version_id: "prompt_version_test",
  provider: "openai",
  model_id: "openai-demo-balanced",
  task_type: "classification",
  input_tokens: 120,
  estimated_output_tokens: 80,
  model_fit: "appropriate",
  waste_findings: [],
  risk_level: "medium",
  compression_guardrails: ["Preserve strict JSON.", "Keep routing labels."],
  registry_freshness: "unverified",
  is_mock: true,
  created_at: "2026-06-03T12:00:00.000Z"
};

describe("quality contract auto-draft", () => {
  test("drafts must-pass checks and default threshold from prompt analysis", () => {
    const draft = autoDraftQualityContract(baseAnalysis);

    expect(draft.task).toBe("Classification");
    expect(draft.pass_threshold).toBe(0.95);
    expect(draft.must_preserve).toContain("Preserve strict JSON.");
    expect(draft.forbidden_behavior.join(" ")).toContain("Do not drop must-pass");
    expect(draft.check_definitions.some((check) => check.type === "llm_judge")).toBe(true);
    expect(draft.must_pass_check_ids).toContain("analysis_test_check_required_output");
  });

  test("raises threshold for high-risk analysis", () => {
    const draft = autoDraftQualityContract({ ...baseAnalysis, risk_level: "high" });

    expect(draft.pass_threshold).toBe(0.98);
  });
});

describe("deterministic check validators", () => {
  test("validates exact, JSON schema, regex, required phrase, and forbidden phrase checks", () => {
    const output = {
      label: "billing",
      summary: "Customer requests cancellation.",
      suggested_reply: "The account support team can help."
    };

    const checks: QualityCheckDefinition[] = [
      createCheck("exact", "label", "billing"),
      createCheck("json_schema", null, ["label", "summary"]),
      createCheck("regex", "summary", null, "cancel|cancellation"),
      createCheck("required_phrase", "suggested_reply", "support"),
      createCheck("forbidden_phrase", "suggested_reply", "internal policy")
    ];

    expect(checks.map((check) => validateQualityCheck(check, output).passed)).toEqual([
      true,
      true,
      true,
      true,
      true
    ]);
  });

  test("labels LLM judge and human checks as non-deterministic placeholders", () => {
    const llmResult = validateQualityCheck(
      {
        ...createCheck("llm_judge", null, "quality"),
        placeholder_note: "LLM judge placeholder."
      },
      "Looks good"
    );
    const humanResult = validateQualityCheck(
      {
        ...createCheck("human", null, "approval"),
        placeholder_note: "Human review placeholder."
      },
      "Looks good"
    );

    expect(llmResult.deterministic).toBe(false);
    expect(llmResult.passed).toBeNull();
    expect(humanResult.deterministic).toBe(false);
    expect(humanResult.passed).toBeNull();
  });

  test("must-pass failures reject a test case", () => {
    const testCase: TestCase = {
      id: "case_test",
      project_id: "project_test",
      quality_contract_id: "contract_test",
      name: "Billing label",
      input_variables: {},
      expected_output: { label: "billing" },
      checks: [
        {
          ...createCheck("exact", "label", "billing"),
          id: "check_label",
          must_pass: true
        }
      ],
      is_mock: true,
      created_at: "2026-06-03T12:00:00.000Z",
      updated_at: "2026-06-03T12:00:00.000Z"
    };

    const result = validateTestCaseChecks(testCase, { label: "sales" });

    expect(result.passed).toBe(false);
    expect(result.mustPassFailures).toEqual(["check_label"]);
  });
});

describe("CSV test case parser", () => {
  test("parses 5-50 CSV test cases", () => {
    const csv = [
      "name,input_variables,expected_output",
      "Case 1,\"{\"\"ticket\"\":\"\"one\"\"}\",\"{\"\"label\"\":\"\"billing\"\"}\"",
      "Case 2,\"{\"\"ticket\"\":\"\"two\"\"}\",\"{\"\"label\"\":\"\"support\"\"}\"",
      "Case 3,\"{\"\"ticket\"\":\"\"three\"\"}\",\"{\"\"label\"\":\"\"sales\"\"}\"",
      "Case 4,\"{\"\"ticket\"\":\"\"four\"\"}\",\"{\"\"label\"\":\"\"incident\"\"}\"",
      "Case 5,\"{\"\"ticket\"\":\"\"five\"\"}\",\"{\"\"label\"\":\"\"account\"\"}\""
    ].join("\n");

    const cases = parseCsvTestCases(csv);

    expect(cases).toHaveLength(5);
    expect(cases.at(0)?.inputVariables).toEqual({ ticket: "one" });
    expect(cases.at(4)?.expectedOutput).toEqual({ label: "account" });
  });

  test("rejects CSV uploads outside the MVP case count", () => {
    const csv = [
      "name,input_variables,expected_output",
      "Case 1,\"{}\",\"{}\"",
      "Case 2,\"{}\",\"{}\""
    ].join("\n");

    expect(() => parseCsvTestCases(csv)).toThrow("5-50");
  });
});

function createCheck(
  type: QualityCheckDefinition["type"],
  fieldPath: string | null,
  expectedValue: unknown,
  pattern: string | null = null
): QualityCheckDefinition {
  return {
    id: `check_${type}_${fieldPath ?? "root"}`,
    type,
    description: `${type} check`,
    must_pass: false,
    field_path: fieldPath,
    expected_value: expectedValue,
    pattern,
    placeholder_note: null
  };
}
