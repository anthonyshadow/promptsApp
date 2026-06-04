import { useEffect, useState } from "react";
import { parseCsvTestCases } from "@promptopts/eval-core";
import type { QualityCheckDefinition, QualityContract, TestCase } from "@promptopts/shared";
import Field from "../../components/Field";
import StatusBadge from "../../components/StatusBadge";
import StatusNotice from "../../components/StatusNotice";
import type { PromptOptsApiClient } from "../../apiClient";
import { demoQualityContract, demoTestCases, type PublicAppState } from "../../mockData";
import {
  cardTextStyle,
  checkboxLabelStyle,
  checkboxStyle,
  contentStackStyle,
  detailsPanelStyle,
  fieldControlStyle,
  formGridStyle,
  heroBandStyle,
  listPanelStyle,
  panelTitleStyle,
  plainListStyle,
  primaryButtonStyle,
  promptTextareaStyle,
  sectionEyebrowStyle,
  sectionTextStyle,
  sectionTitleStyle,
  splitGridStyle,
  tableStyle,
  tableSubtextStyle,
  tableWrapStyle
} from "../../styles";
import {
  createCsvTestCaseRequest,
  createManualTestCaseRequest,
  formatExpectedOutput,
  formatTestCaseStatus
} from "./qualityContractHelpers";

function SuccessContractScreen({
  apiClient,
  projectId,
  updateAppState
}: {
  apiClient: PromptOptsApiClient | null;
  projectId: string;
  updateAppState: (next: Partial<PublicAppState>) => void;
}) {
  const [contractState, setContractState] = useState<{
    contract: QualityContract;
    testCases: TestCase[];
    status: "loading" | "ready" | "local" | "saving" | "error";
    message: string;
    productionBlockers: string[];
    source: "persisted" | "auto_draft" | "local";
  }>(() => ({
    contract: demoQualityContract,
    testCases: demoTestCases,
    status: apiClient ? "loading" : "local",
    message: apiClient
      ? "Loading auto-drafted quality contract from prompt analysis."
      : "Local demo contract; configure VITE_API_URL to persist test cases.",
    productionBlockers: ["Eval matrix has not passed threshold with zero must-pass failures."],
    source: "local"
  }));
  const [manualCase, setManualCase] = useState({
    name: "New regression case",
    inputVariablesText: "{\n  \"ticket_text\": \"Customer asks for help.\"\n}",
    expectedOutputText: "{\n  \"urgency\": \"medium\"\n}",
    checkType: "exact" as QualityCheckDefinition["type"],
    fieldPath: "urgency",
    expectedValue: "medium",
    pattern: "",
    mustPass: true
  });
  const [csvMessage, setCsvMessage] = useState("CSV headers: name,input_variables,expected_output. Supports 5-50 cases.");

  useEffect(() => {
    let isMounted = true;

    async function loadContract() {
      if (!apiClient) {
        setContractState({
          contract: demoQualityContract,
          testCases: demoTestCases,
          status: "local",
          message: "Local demo contract; configure VITE_API_URL to persist test cases.",
          productionBlockers: ["Eval matrix has not passed threshold with zero must-pass failures."],
          source: "local"
        });
        return;
      }

      try {
        const response = await apiClient.getQualityContract(projectId);

        if (isMounted) {
          setContractState({
            contract: response.contract,
            testCases: response.test_cases,
            status: "ready",
            message:
              response.source === "auto_draft"
                ? "Auto-drafted from prompt analysis. Review before generating candidates."
                : "Persisted quality contract loaded.",
            productionBlockers: response.production_blockers,
            source: response.source
          });
          updateAppState({ passThreshold: response.contract.pass_threshold });
        }
      } catch {
        if (isMounted) {
          setContractState({
            contract: demoQualityContract,
            testCases: demoTestCases,
            status: "error",
            message: "Quality contract API failed; showing local demo contract.",
            productionBlockers: ["Eval matrix has not passed threshold with zero must-pass failures."],
            source: "local"
          });
        }
      }
    }

    void loadContract();

    return () => {
      isMounted = false;
    };
  }, [apiClient, projectId]);

  const contract = contractState.contract;
  const deterministicChecks = contract.check_definitions.filter(
    (check) => check.type !== "llm_judge" && check.type !== "human"
  );
  const placeholderChecks = contract.check_definitions.filter(
    (check) => check.type === "llm_judge" || check.type === "human"
  );

  function updateContract(patch: Partial<QualityContract>) {
    setContractState((current) => ({
      ...current,
      contract: {
        ...current.contract,
        ...patch,
        updated_at: new Date().toISOString()
      }
    }));
  }

  async function saveContract() {
    const nextContract = contractState.contract;
    updateAppState({ passThreshold: nextContract.pass_threshold });

    if (!apiClient) {
      setContractState((current) => ({
        ...current,
        status: "local",
        message: "Contract updated locally. API persistence is not configured."
      }));
      return;
    }

    setContractState((current) => ({ ...current, status: "saving", message: "Saving quality contract." }));

    try {
      const response = await apiClient.saveQualityContract(projectId, {
        task: nextContract.task,
        required_output: nextContract.required_output,
        must_preserve: nextContract.must_preserve,
        forbidden_behavior: nextContract.forbidden_behavior,
        pass_threshold: nextContract.pass_threshold,
        must_pass_check_ids: nextContract.must_pass_check_ids,
        check_definitions: nextContract.check_definitions,
        notes: nextContract.notes
      });

      setContractState({
        contract: response.contract,
        testCases: response.test_cases,
        status: "ready",
        message: "Quality contract saved. Add test cases before evals.",
        productionBlockers: response.production_blockers,
        source: response.source
      });
    } catch {
      setContractState((current) => ({
        ...current,
        status: "error",
        message: "Quality contract save failed. Local edits remain visible."
      }));
    }
  }

  async function addManualTestCase() {
    const request = createManualTestCaseRequest(manualCase);

    if (!apiClient) {
      const timestamp = new Date().toISOString();
      const testCase: TestCase = {
        id: `test_case_local_${contractState.testCases.length + 1}`,
        project_id: projectId,
        quality_contract_id: contract.id,
        name: request.name,
        input_variables: request.input_variables,
        expected_output: request.expected_output,
        checks: request.checks,
        is_mock: true,
        created_at: timestamp,
        updated_at: timestamp
      };

      setContractState((current) => ({
        ...current,
        testCases: [...current.testCases, testCase],
        message: "Manual test case added locally."
      }));
      return;
    }

    try {
      const response = await apiClient.createTestCase(contract.id, request);

      setContractState((current) => ({
        ...current,
        testCases: [...current.testCases, response.test_case],
        productionBlockers: response.production_blockers,
        status: "ready",
        message: "Manual test case saved."
      }));
    } catch {
      setContractState((current) => ({
        ...current,
        status: "error",
        message: "Manual test case save failed."
      }));
    }
  }

  async function importCsvCases(file: File | null) {
    if (!file) {
      return;
    }

    try {
      const drafts = parseCsvTestCases(await file.text());
      const timestamp = new Date().toISOString();
      const requests = drafts.map((draft, index) => createCsvTestCaseRequest(draft, contract, index));

      if (apiClient) {
        const created: TestCase[] = [];

        for (const request of requests) {
          const response = await apiClient.createTestCase(contract.id, request);
          created.push(response.test_case);
        }

        setContractState((current) => ({
          ...current,
          testCases: [...current.testCases, ...created],
          message: `${created.length} CSV test cases saved.`,
          status: "ready"
        }));
      } else {
        const created = requests.map((request, index): TestCase => ({
          id: `test_case_csv_${Date.now()}_${index}`,
          project_id: projectId,
          quality_contract_id: contract.id,
          name: request.name,
          input_variables: request.input_variables,
          expected_output: request.expected_output,
          checks: request.checks,
          is_mock: true,
          created_at: timestamp,
          updated_at: timestamp
        }));

        setContractState((current) => ({
          ...current,
          testCases: [...current.testCases, ...created],
          message: `${created.length} CSV test cases imported locally.`
        }));
      }

      setCsvMessage(`${drafts.length} CSV test cases parsed. Review statuses before evals.`);
    } catch (error) {
      setCsvMessage(error instanceof Error ? error.message : "CSV import failed.");
    }
  }

  return (
    <div className={contentStackStyle}>
      <section className={heroBandStyle} aria-labelledby="success-title">
        <div>
          <p className={sectionEyebrowStyle}>Quality contract</p>
          <h2 className={sectionTitleStyle} id="success-title">
            Pass threshold {Math.round(contract.pass_threshold * 100)}%
          </h2>
          <p className={sectionTextStyle}>{contract.notes}</p>
        </div>
        <StatusBadge label="Must-pass checks" value={String(contract.must_pass_check_ids.length)} tone="warn" />
      </section>

      <StatusNotice
        tone={contractState.status === "ready" || contractState.status === "local" ? "good" : "warn"}
        title="Contract status"
        body={`${contractState.message} Source: ${contractState.source.replace("_", " ")}.`}
      />

      <StatusNotice
        tone="warn"
        title="Production recommendation disabled"
        body={contractState.productionBlockers.join(" ")}
      />

      <section className={splitGridStyle} aria-label="Auto-drafted quality contract">
        <section className={listPanelStyle}>
          <h3 className={panelTitleStyle}>Auto-drafted contract</h3>
          <Field label="Task">
            <input
              className={fieldControlStyle}
              type="text"
              value={contract.task}
              onChange={(event) => updateContract({ task: event.target.value })}
            />
          </Field>
          <Field label="Required output">
            <textarea
              className={promptTextareaStyle}
              rows={4}
              value={contract.required_output}
              onChange={(event) => updateContract({ required_output: event.target.value })}
            />
          </Field>
          <Field label="Pass threshold">
            <input
              className={fieldControlStyle}
              max={1}
              min={0}
              step={0.01}
              type="number"
              value={contract.pass_threshold}
              onChange={(event) => updateContract({ pass_threshold: Number(event.target.value) })}
            />
          </Field>
          <button className={primaryButtonStyle} type="button" onClick={() => void saveContract()}>
            Save contract
          </button>
        </section>

        <section className={listPanelStyle}>
          <h3 className={panelTitleStyle}>Must preserve</h3>
          <ul className={plainListStyle}>
            {contract.must_preserve.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h3 className={panelTitleStyle}>Forbidden behavior</h3>
          <ul className={plainListStyle}>
            {contract.forbidden_behavior.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </section>

      <section className={splitGridStyle} aria-label="Check definitions">
        <section className={listPanelStyle}>
          <h3 className={panelTitleStyle}>Deterministic checks</h3>
          <ul className={plainListStyle}>
            {deterministicChecks.map((check) => (
              <li key={check.id}>
                {check.must_pass ? "Must-pass" : "Tracked"}: {check.description}
              </li>
            ))}
          </ul>
        </section>
        <section className={listPanelStyle}>
          <h3 className={panelTitleStyle}>Judge placeholders</h3>
          <ul className={plainListStyle}>
            {placeholderChecks.map((check) => (
              <li key={check.id}>
                {check.type === "llm_judge" ? "LLM judge" : "Human review"}: {check.description}.{" "}
                {check.placeholder_note}
              </li>
            ))}
          </ul>
        </section>
      </section>

      <section className={detailsPanelStyle} aria-label="Manual test case entry">
        <h3 className={panelTitleStyle}>Add manual test case</h3>
        <div className={formGridStyle}>
          <Field label="Case name">
            <input
              className={fieldControlStyle}
              type="text"
              value={manualCase.name}
              onChange={(event) => setManualCase((current) => ({ ...current, name: event.target.value }))}
            />
          </Field>
          <Field label="Check type">
            <select
              className={fieldControlStyle}
              value={manualCase.checkType}
              onChange={(event) =>
                setManualCase((current) => ({
                  ...current,
                  checkType: event.target.value as QualityCheckDefinition["type"]
                }))
              }
            >
              <option value="exact">Exact</option>
              <option value="json_schema">JSON schema</option>
              <option value="regex">Regex</option>
              <option value="required_phrase">Required phrase</option>
              <option value="forbidden_phrase">Forbidden phrase</option>
              <option value="llm_judge">LLM judge placeholder</option>
              <option value="human">Human placeholder</option>
            </select>
          </Field>
          <Field label="Field path">
            <input
              className={fieldControlStyle}
              type="text"
              value={manualCase.fieldPath}
              onChange={(event) => setManualCase((current) => ({ ...current, fieldPath: event.target.value }))}
            />
          </Field>
          <Field label="Expected phrase/value">
            <input
              className={fieldControlStyle}
              type="text"
              value={manualCase.expectedValue}
              onChange={(event) => setManualCase((current) => ({ ...current, expectedValue: event.target.value }))}
            />
          </Field>
        </div>
        <div className={splitGridStyle}>
          <Field label="Input variables JSON">
            <textarea
              className={promptTextareaStyle}
              rows={5}
              value={manualCase.inputVariablesText}
              onChange={(event) =>
                setManualCase((current) => ({ ...current, inputVariablesText: event.target.value }))
              }
            />
          </Field>
          <Field label="Expected output JSON or text">
            <textarea
              className={promptTextareaStyle}
              rows={5}
              value={manualCase.expectedOutputText}
              onChange={(event) =>
                setManualCase((current) => ({ ...current, expectedOutputText: event.target.value }))
              }
            />
          </Field>
        </div>
        <label className={checkboxLabelStyle}>
          <input
            checked={manualCase.mustPass}
            className={checkboxStyle}
            type="checkbox"
            onChange={(event) => setManualCase((current) => ({ ...current, mustPass: event.target.checked }))}
          />
          Must-pass check
        </label>
        <button className={primaryButtonStyle} type="button" onClick={() => void addManualTestCase()}>
          Add test case
        </button>
      </section>

      <section className={detailsPanelStyle} aria-label="CSV test case upload">
        <h3 className={panelTitleStyle}>CSV upload</h3>
        <p className={cardTextStyle}>{csvMessage}</p>
        <input
          className={fieldControlStyle}
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => void importCsvCases(event.target.files?.[0] ?? null)}
        />
      </section>

      <section className={tableWrapStyle} aria-label="Test case table">
        <table className={tableStyle}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Checks</th>
              <th>Expected output</th>
            </tr>
          </thead>
          <tbody>
            {contractState.testCases.map((testCase) => (
              <tr key={testCase.id}>
                <td>{testCase.name}</td>
                <td>{formatTestCaseStatus(testCase)}</td>
                <td>
                  <span className={tableSubtextStyle}>
                    {testCase.checks.map((check) => check.description).join(" / ")}
                  </span>
                </td>
                <td>
                  <span className={tableSubtextStyle}>{formatExpectedOutput(testCase.expected_output)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default SuccessContractScreen;
