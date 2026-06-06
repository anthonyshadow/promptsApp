import { useEffect, useMemo, useState } from "react";
import { css } from "@emotion/css";
import type { EvalRunDetailResponse } from "@promptopts/api";
import type { EvalResult, EvalRun, ModelRegistryRecord, TestCase } from "@promptopts/shared";
import Field from "../../components/Field";
import StatusBadge from "../../components/StatusBadge";
import StatusNotice from "../../components/StatusNotice";
import type { PromptOptsApiClient } from "../../apiClient";
import { formatCandidateId } from "../../formatters";
import {
  demoEvalRun,
  demoQualityContract,
  demoReport,
  demoTestCases,
  type PublicAppState
} from "../../mockData";
import {
  checkboxLabelStyle,
  checkboxStyle,
  contentStackStyle,
  fieldControlStyle,
  heroBandStyle,
  listPanelStyle,
  panelTitleStyle,
  plainListStyle,
  primaryButtonStyle,
  sectionEyebrowStyle,
  sectionTextStyle,
  sectionTitleStyle,
  splitGridStyle,
  tableSubtextStyle,
  tableWrapStyle
} from "../../styles";
import type { NavigateHandler } from "../../viewTypes";
import {
  compareEvalResults,
  createLocalEvalDetail,
  formatCost,
  formatEvalStatus,
  formatFrontierRole,
  getCostProxy,
  getStatusTone,
  shouldPollStatus,
  type FrontierPoint
} from "./evalRunView";

function EvalRunScreen({
  apiClient,
  appState,
  evalRunId,
  onNavigate,
  registryModels,
  updateAppState
}: {
  apiClient: PromptOptsApiClient | null;
  appState: PublicAppState;
  evalRunId: string;
  onNavigate: NavigateHandler;
  registryModels: ModelRegistryRecord[];
  updateAppState: (next: Partial<PublicAppState>) => void;
}) {
  const [detailState, setDetailState] = useState<{
    detail: EvalRunDetailResponse;
    status: "local" | "loading" | "ready" | "error" | "starting";
    message: string;
  }>(() => ({
    detail: createLocalEvalDetail(),
    status: apiClient && evalRunId !== demoEvalRun.id ? "loading" : "local",
    message:
      apiClient && evalRunId !== demoEvalRun.id
        ? "Loading eval run detail."
        : "Local demo matrix; configure VITE_API_URL to run and poll persisted evals."
  }));
  const [testCases, setTestCases] = useState<TestCase[]>(demoTestCases);
  const [qualityContractId, setQualityContractId] = useState(demoQualityContract.id);
  const [reportState, setReportState] = useState<"idle" | "creating" | "error">("idle");
  const [providerCallAcknowledged, setProviderCallAcknowledged] = useState(false);
  const selectedTestCaseIds = appState.selectedTestCaseIds.length > 0
    ? appState.selectedTestCaseIds
    : testCases.map((testCase) => testCase.id);
  const selectedModels = useMemo(
    () => registryModels.filter((model) => appState.selectedModelIds.includes(model.id)),
    [appState.selectedModelIds, registryModels]
  );
  const canStartEval =
    detailState.status !== "starting" &&
    appState.selectedModelIds.length > 0 &&
    selectedTestCaseIds.length > 0;
  const detail = detailState.detail;
  const sortedResults = [...detail.results].sort(compareEvalResults);
  const statusTone = getStatusTone(detail.eval_run.status);

  useEffect(() => {
    let isMounted = true;

    async function loadContractTestCases() {
      if (!apiClient) {
        setTestCases(demoTestCases);
        return;
      }

      try {
        const response = await apiClient.getQualityContract(appState.projectId);

        if (!isMounted) {
          return;
        }

        setTestCases(response.test_cases);
        setQualityContractId(response.contract.id);

        const selected = response.test_cases
          .map((testCase) => testCase.id)
          .filter((id) => selectedTestCaseIds.includes(id));

        updateAppState({
          passThreshold: response.contract.pass_threshold,
          selectedTestCaseIds:
            selected.length > 0 ? selected : response.test_cases.map((testCase) => testCase.id)
        });
      } catch {
        if (isMounted) {
          setTestCases(demoTestCases);
        }
      }
    }

    void loadContractTestCases();

    return () => {
      isMounted = false;
    };
  }, [apiClient, appState.projectId]);

  useEffect(() => {
    let isMounted = true;
    let timer: number | null = null;

    async function pollEvalRun() {
      if (!apiClient || evalRunId === demoEvalRun.id) {
        setDetailState({
          detail: createLocalEvalDetail(),
          status: "local",
          message: "Local demo matrix; configure VITE_API_URL to run and poll persisted evals."
        });
        return;
      }

      try {
        const nextDetail = await apiClient.getEvalRun(evalRunId);

        if (!isMounted) {
          return;
        }

        setDetailState({
          detail: nextDetail,
          status: "ready",
          message: nextDetail.status_note
        });

        if (shouldPollStatus(nextDetail.eval_run.status)) {
          timer = window.setTimeout(() => void pollEvalRun(), 1800);
        }
      } catch {
        if (isMounted) {
          setDetailState({
            detail: createLocalEvalDetail(),
            status: "error",
            message: "Eval API detail failed; showing local demo matrix. Start a new run after setup is saved."
          });
        }
      }
    }

    void pollEvalRun();

    return () => {
      isMounted = false;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [apiClient, evalRunId]);

  function toggleTestCase(testCaseId: string) {
    const selected = selectedTestCaseIds.includes(testCaseId)
      ? selectedTestCaseIds.filter((id) => id !== testCaseId)
      : [...selectedTestCaseIds, testCaseId];

    updateAppState({ selectedTestCaseIds: selected });
  }

  async function startEvalRun() {
    if (!canStartEval) {
      return;
    }

    if (!apiClient) {
      setDetailState({
        detail: createLocalEvalDetail("complete"),
        status: "local",
        message: "Local demo eval run displayed. Persisted queue polling requires VITE_API_URL."
      });
      return;
    }

    setDetailState((current) => ({
      ...current,
      status: "starting",
      message: "Queueing mock eval matrix."
    }));

    try {
      const evalRun = await apiClient.createEvalRun({
        project_id: appState.projectId,
        quality_contract_id: qualityContractId,
        baseline_prompt_version_id: appState.promptVersionId,
        candidate_ids: appState.selectedCandidateIds,
        model_registry_record_ids: appState.selectedModelIds,
        test_case_ids: selectedTestCaseIds,
        pass_threshold: appState.passThreshold,
        provider_call_acknowledged: providerCallAcknowledged
      });

      updateAppState({ activeEvalRunId: evalRun.id });
      onNavigate(`/app/eval-runs/${evalRun.id}`);
    } catch {
      setDetailState((current) => ({
        ...current,
        status: "error",
        message: "Eval run creation failed. Check saved project, candidates, model shortlist, and test cases."
      }));
    }
  }

  async function createReportAndNavigate() {
    if (!apiClient) {
      onNavigate(`/app/reports/${demoReport.id}`);
      return;
    }

    setReportState("creating");

    try {
      const report = await apiClient.createReport({
        project_id: appState.projectId,
        eval_run_id: detail.eval_run.id
      });

      updateAppState({ activeReportId: report.id });
      setReportState("idle");
      onNavigate(`/app/reports/${report.id}`);
    } catch {
      setReportState("error");
    }
  }

  return (
    <div className={contentStackStyle}>
      <section className={heroBandStyle} aria-labelledby="eval-title">
        <div>
          <p className={sectionEyebrowStyle}>Eval matrix</p>
          <h2 className={sectionTitleStyle} id="eval-title">
            Eval setup and polling
          </h2>
          <p className={sectionTextStyle}>
            Queue state and failed combos stay visible. Threshold {Math.round(appState.passThreshold * 100)}%, zero must-pass failures required.
          </p>
        </div>
        <button className={primaryButtonStyle} type="button" onClick={() => void createReportAndNavigate()}>
          {reportState === "creating" ? "Creating report" : "Review report"}
        </button>
      </section>

      {reportState === "error" ? (
        <StatusNotice tone="warn" title="Report generation failed" body="Run or refresh the eval matrix before generating the recommendation report." />
      ) : null}

      <section className={splitGridStyle} aria-label="Eval setup">
        <section className={listPanelStyle}>
          <h3 className={panelTitleStyle}>Selected prompts</h3>
          <ul className={plainListStyle}>
            <li>Baseline: {appState.promptVersionId}</li>
            {appState.selectedCandidateIds.map((candidateId) => (
              <li key={candidateId}>{formatCandidateId(candidateId)}</li>
            ))}
          </ul>
        </section>

        <section className={listPanelStyle}>
          <h3 className={panelTitleStyle}>Selected models</h3>
          {selectedModels.length === 0 ? (
            <p className={emptyTextStyle}>No model shortlist selections yet.</p>
          ) : (
            <ul className={plainListStyle}>
              {selectedModels.map((model) => (
                <li key={model.id}>
                  {model.display_name}
                  <span className={tableSubtextStyle}>{model.model_id}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={listPanelStyle}>
          <h3 className={panelTitleStyle}>Selected test cases</h3>
          <div className={checklistStyle}>
            {testCases.map((testCase) => (
              <label className={checkboxLabelStyle} key={testCase.id}>
                <input
                  checked={selectedTestCaseIds.includes(testCase.id)}
                  className={checkboxStyle}
                  type="checkbox"
                  onChange={() => toggleTestCase(testCase.id)}
                />
                {testCase.name}
              </label>
            ))}
          </div>
        </section>

        <section className={listPanelStyle}>
          <h3 className={panelTitleStyle}>Run controls</h3>
          <Field label="Queue/cache state">
            <input className={fieldControlStyle} readOnly value={formatEvalStatus(detail.eval_run.status)} />
          </Field>
          <label className={providerAckStyle}>
            <input
              checked={providerCallAcknowledged}
              className={checkboxStyle}
              type="checkbox"
              onChange={(event) => setProviderCallAcknowledged(event.target.checked)}
            />
            Confirm provider-call consent for selected prompts and test cases if sensitive content is detected.
          </label>
          <button
            className={primaryButtonStyle}
            disabled={!canStartEval}
            type="button"
            onClick={() => void startEvalRun()}
          >
            {detailState.status === "starting" ? "Queueing eval" : "Run eval"}
          </button>
        </section>
      </section>

      <StatusNotice tone={statusTone} title="Eval run state" body={detailState.message} />

      {detail.retry_hints.length > 0 ? (
        <StatusNotice tone="warn" title="Retry hints" body={detail.retry_hints.join(" ")} />
      ) : null}

      <section className={frontierPanelStyle} aria-label="Cost-quality frontier">
        <div>
          <p className={sectionEyebrowStyle}>Cost-quality frontier</p>
          <h3 className={panelTitleStyle}>Baseline, safe points, winner candidate, failed combos</h3>
          <p className={frontierCopyStyle}>
            X-axis uses verified cost when available, otherwise a token proxy. Unverified registry metadata keeps savings claims disabled.
          </p>
        </div>
        <div className={frontierPlotStyle}>
          <span className={frontierYAxisStyle}>Higher quality</span>
          <span className={frontierXAxisStyle}>Lower cost / token proxy</span>
          {detail.frontier_points.map((point) => (
            <div className={getFrontierPointStyle(point, detail.results)} key={point.result_id}>
              <span className={frontierPointLabelStyle}>{formatFrontierRole(point.role)}</span>
              <span className={frontierPointMetaStyle}>{Math.round(point.quality_score * 100)}%</span>
            </div>
          ))}
        </div>
        <div className={frontierLegendStyle} aria-label="Frontier legend">
          <span className={legendBaselineStyle}>Baseline</span>
          <span className={legendSafeStyle}>Safe</span>
          <span className={legendWinnerStyle}>Winner candidate</span>
          <span className={legendFailedStyle}>Failed</span>
        </div>
      </section>

      <section className={tableWrapStyle} aria-label="Eval matrix results">
        <table className={matrixTableStyle}>
          <thead>
            <tr>
              <th scope="col">Combo</th>
              <th scope="col">Quality score</th>
              <th scope="col">Pass rate</th>
              <th scope="col">Input tokens</th>
              <th scope="col">Output tokens</th>
              <th scope="col">Estimated cost</th>
              <th scope="col">Latency</th>
              <th scope="col">Verdict</th>
              <th scope="col">Failed checks</th>
            </tr>
          </thead>
          <tbody>
            {sortedResults.map((result) => (
              <tr className={result.verdict === "pass" ? undefined : failedRowStyle} key={result.id}>
                <td>
                  <strong>{formatCandidateId(result.candidate_id)}</strong>
                  <span className={tableSubtextStyle}>{result.model_id}</span>
                </td>
                <td>{Math.round(result.quality_score * 100)}%</td>
                <td>{Math.round(result.pass_rate * 100)}%</td>
                <td>{result.input_tokens.toLocaleString()}</td>
                <td>{result.output_tokens.toLocaleString()}</td>
                <td>{formatCost(result)}</td>
                <td>{result.latency_ms === null ? "pending" : `${result.latency_ms}ms`}</td>
                <td>
                  <span className={getVerdictPillStyle(result.verdict)}>{result.verdict}</span>
                </td>
                <td>
                  {result.failed_check_ids.length === 0 ? (
                    "None"
                  ) : (
                    <ul className={failedCheckListStyle}>
                      {result.failed_check_ids.map((checkId) => (
                        <li key={checkId}>{checkId}</li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default EvalRunScreen;

function getFrontierPointStyle(point: FrontierPoint, results: EvalResult[]): string {
  const result = results.find((item) => item.id === point.result_id);
  const costs = results.map(getCostProxy);
  const minCost = Math.min(...costs);
  const maxCost = Math.max(...costs);
  const cost = result ? getCostProxy(result) : minCost;
  const x = maxCost === minCost ? 48 : 12 + ((cost - minCost) / (maxCost - minCost)) * 76;
  const y = 88 - point.quality_score * 76;

  return `${frontierPointBaseStyle} ${getFrontierRoleStyle(point.role)} ${css({
    left: `${Math.max(8, Math.min(88, x))}%`,
    top: `${Math.max(10, Math.min(86, y))}%`
  })}`;
}

function getFrontierRoleStyle(role: FrontierPoint["role"]): string {
  switch (role) {
    case "baseline":
      return frontierPointBaselineStyle;
    case "safe":
      return frontierPointSafeStyle;
    case "winner_candidate":
      return frontierPointWinnerStyle;
    case "failed":
      return frontierPointFailedStyle;
  }
}

function getVerdictPillStyle(verdict: EvalResult["verdict"]): string {
  switch (verdict) {
    case "pass":
      return `${verdictPillStyle} ${verdictPassStyle}`;
    case "fail":
      return `${verdictPillStyle} ${verdictFailStyle}`;
    case "blocked":
      return `${verdictPillStyle} ${verdictBlockedStyle}`;
  }
}

const checklistStyle = css({
  display: "grid",
  gap: "10px",
  marginTop: "12px"
});

const emptyTextStyle = css({
  margin: "12px 0 0",
  color: "#69726b",
  lineHeight: 1.5
});

const providerAckStyle = css({
  display: "flex",
  alignItems: "flex-start",
  gap: "8px",
  color: "#4c5650",
  fontSize: "0.86rem",
  lineHeight: 1.45
});

const frontierPanelStyle = css({
  display: "grid",
  gap: "16px",
  border: "1px solid #d7d6ca",
  borderRadius: "8px",
  background: "#fffef9",
  padding: "18px"
});

const frontierCopyStyle = css({
  margin: "8px 0 0",
  color: "#4c5650",
  lineHeight: 1.5
});

const frontierPlotStyle = css({
  position: "relative",
  minHeight: "320px",
  border: "1px solid #d1d4c8",
  borderRadius: "8px",
  background:
    "linear-gradient(90deg, rgba(31,42,32,0.06) 1px, transparent 1px), linear-gradient(0deg, rgba(31,42,32,0.06) 1px, transparent 1px), #f8faf3",
  backgroundSize: "25% 25%",
  overflow: "hidden"
});

const frontierYAxisStyle = css({
  position: "absolute",
  left: "12px",
  top: "12px",
  color: "#4d594f",
  fontSize: "0.78rem",
  fontWeight: 800,
  textTransform: "uppercase"
});

const frontierXAxisStyle = css({
  position: "absolute",
  right: "12px",
  bottom: "12px",
  color: "#4d594f",
  fontSize: "0.78rem",
  fontWeight: 800,
  textTransform: "uppercase"
});

const frontierPointBaseStyle = css({
  position: "absolute",
  display: "grid",
  placeItems: "center",
  width: "86px",
  minHeight: "48px",
  transform: "translate(-50%, -50%)",
  border: "2px solid #1f2a20",
  borderRadius: "8px",
  padding: "6px",
  textAlign: "center",
  boxShadow: "0 8px 18px rgba(17, 23, 19, 0.14)"
});

const frontierPointLabelStyle = css({
  color: "#111713",
  fontSize: "0.72rem",
  fontWeight: 900,
  textTransform: "uppercase"
});

const frontierPointMetaStyle = css({
  color: "#2d362f",
  fontSize: "0.78rem",
  fontWeight: 800
});

const frontierPointBaselineStyle = css({
  background: "#e9edf4",
  borderColor: "#5e6b80"
});

const frontierPointSafeStyle = css({
  background: "#eff8e9",
  borderColor: "#6a9659"
});

const frontierPointWinnerStyle = css({
  background: "#e2f3d3",
  borderColor: "#1f6f32"
});

const frontierPointFailedStyle = css({
  background: "#fff0e9",
  borderColor: "#b95d3b"
});

const frontierLegendStyle = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "8px"
});

const legendBaselineStyle = css({
  borderRadius: "999px",
  padding: "6px 10px",
  fontSize: "0.78rem",
  fontWeight: 800,
  background: "#e9edf4",
  color: "#334158"
});

const legendSafeStyle = css({
  borderRadius: "999px",
  padding: "6px 10px",
  fontSize: "0.78rem",
  fontWeight: 800,
  background: "#eff8e9",
  color: "#2a5125"
});

const legendWinnerStyle = css({
  borderRadius: "999px",
  padding: "6px 10px",
  fontSize: "0.78rem",
  fontWeight: 800,
  background: "#e2f3d3",
  color: "#184c23"
});

const legendFailedStyle = css({
  borderRadius: "999px",
  padding: "6px 10px",
  fontSize: "0.78rem",
  fontWeight: 800,
  background: "#fff0e9",
  color: "#733419"
});

const matrixTableStyle = css({
  width: "100%",
  minWidth: "1120px",
  borderCollapse: "collapse",
  color: "#1f2421",
  th: {
    background: "#ecefe6",
    color: "#475149",
    fontSize: "0.78rem",
    letterSpacing: 0,
    padding: "12px",
    textAlign: "left",
    textTransform: "uppercase"
  },
  td: {
    borderTop: "1px solid #e2e1d8",
    padding: "12px",
    verticalAlign: "top"
  }
});

const failedRowStyle = css({
  background: "#fff8f3"
});

const verdictPillStyle = css({
  display: "inline-flex",
  borderRadius: "999px",
  padding: "4px 8px",
  fontSize: "0.76rem",
  fontWeight: 900,
  textTransform: "uppercase"
});

const verdictPassStyle = css({
  background: "#e5f5dc",
  color: "#245229"
});

const verdictFailStyle = css({
  background: "#ffe9de",
  color: "#803817"
});

const verdictBlockedStyle = css({
  background: "#eceef4",
  color: "#394457"
});

const failedCheckListStyle = css({
  margin: 0,
  paddingLeft: "18px",
  color: "#733419",
  lineHeight: 1.45
});
