import { describe, expect, test } from "bun:test";
import { DEMO_IDS } from "@promptopts/shared";
import type { TestCase } from "@promptopts/shared";
import { demoQualityContract } from "../../mockData";
import {
  createCsvTestCaseRequest,
  createManualCheckDescription,
  createManualTestCaseRequest,
  formatExpectedOutput,
  formatTestCaseStatus,
  parseJsonObjectText,
  parseJsonText
} from "./qualityContractHelpers";

describe("quality contract screen helpers", () => {
  test("parses JSON object text with text fallback behavior", () => {
    expect(parseJsonObjectText('{"ticket":"one"}')).toEqual({ ticket: "one" });
    expect(parseJsonObjectText("[1,2,3]")).toEqual({});
    expect(parseJsonText("plain text")).toBe("plain text");
    expect(parseJsonText("")).toBeNull();
  });

  test("creates manual test case requests with deterministic and placeholder checks", () => {
    const exact = createManualTestCaseRequest({
      name: " Billing ",
      inputVariablesText: '{"ticket":"billing"}',
      expectedOutputText: '{"urgency":"medium"}',
      checkType: "exact",
      fieldPath: " urgency ",
      expectedValue: "medium",
      pattern: "",
      mustPass: true
    });
    const judge = createManualTestCaseRequest({
      name: "",
      inputVariablesText: "{}",
      expectedOutputText: "Looks helpful",
      checkType: "llm_judge",
      fieldPath: "",
      expectedValue: "quality",
      pattern: "",
      mustPass: false
    });

    expect(exact.name).toBe("Billing");
    expect(exact.input_variables).toEqual({ ticket: "billing" });
    expect(exact.expected_output).toEqual({ urgency: "medium" });
    expect(exact.checks[0]?.field_path).toBe("urgency");
    expect(exact.checks[0]?.must_pass).toBe(true);
    expect(judge.name).toBe("Manual test case");
    expect(judge.checks[0]?.placeholder_note).toContain("LLM judge placeholder");
  });

  test("creates CSV test case requests from the first must-pass contract check", () => {
    const request = createCsvTestCaseRequest(
      {
        name: "CSV case",
        inputVariables: { ticket: "csv" },
        expectedOutput: { urgency: "medium" }
      },
      demoQualityContract,
      0
    );

    expect(request.name).toBe("CSV case");
    expect(request.input_variables).toEqual({ ticket: "csv" });
    expect(request.checks[0]?.must_pass).toBe(true);
    expect(request.checks[0]?.description).toContain("CSV case 1");
  });

  test("formats descriptions, statuses, and expected output", () => {
    const placeholderCase = createCase("case_placeholder", true, "human");
    const trackedCase = createCase("case_tracked", false, "required_phrase");

    expect(createManualCheckDescription("regex", "cancel")).toContain("cancel");
    expect(formatTestCaseStatus(placeholderCase)).toBe("Must-pass with review placeholder");
    expect(formatTestCaseStatus(trackedCase)).toBe("Tracked");
    expect(formatExpectedOutput({ label: "support" })).toBe('{"label":"support"}');
    expect(formatExpectedOutput(null)).toBe("Not set");
  });
});

function createCase(
  id: string,
  mustPass: boolean,
  type: TestCase["checks"][number]["type"]
): TestCase {
  return {
    id,
    project_id: DEMO_IDS.project,
    quality_contract_id: DEMO_IDS.qualityContract,
    name: id,
    input_variables: {},
    expected_output: null,
    checks: [
      {
        id: `${id}_check`,
        type,
        description: "Check",
        must_pass: mustPass,
        field_path: null,
        expected_value: null,
        pattern: null,
        placeholder_note: null
      }
    ],
    is_mock: true,
    created_at: "2026-06-03T12:00:00.000Z",
    updated_at: "2026-06-03T12:00:00.000Z"
  };
}
