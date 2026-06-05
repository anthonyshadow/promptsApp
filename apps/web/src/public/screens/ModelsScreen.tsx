import { css } from "@emotion/css";
import {
  shortlistModels,
  type FailureCost,
  type ModelShortlistEntry
} from "@promptopts/model-registry";
import type { ModelRegistryRecord } from "@promptopts/shared";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { formatProvider } from "../../formatters";
import { demoAudit, type PublicAppState } from "../../mockData";
import { estimatePromptTokens } from "../../promptView";
import {
  checkboxStyle,
  contentStackStyle,
  plainListStyle,
  heroBandStyle,
  sectionEyebrowStyle,
  sectionTextStyle,
  sectionTitleStyle,
  tableStyle,
  tableSubtextStyle,
  tableWrapStyle
} from "../../styles";

function ModelsScreen({
  appState,
  registryModels,
  updateAppState
}: {
  appState: PublicAppState;
  registryModels: ModelRegistryRecord[];
  updateAppState: (next: Partial<PublicAppState>) => void;
}) {
  const promptTokenEstimate = estimatePromptTokens(appState.promptText);
  const outputEstimate = appState.promptText.trim().length > 0 ? demoAudit.estimatedOutputTokens : 0;
  const contextNeeds = appState.minContextWindow ?? promptTokenEstimate + outputEstimate;
  const shortlist = shortlistModels({
    models: registryModels,
    provider: appState.provider,
    currentModelId: appState.currentModelId,
    taskType: appState.taskType,
    promptTokenEstimate,
    outputEstimate,
    contextNeeds,
    structuredOutput: appState.requiresJson,
    tools: appState.usesTools,
    modality: appState.usesImages ? "image" : "text",
    latencyTargetMs: appState.maxLatencyMs,
    priority: appState.priority,
    failureCost: getFailureCost(appState.taskType)
  });
  const selectedCount = new Set(appState.selectedModelIds).size;

  function toggleModel(recordId: string) {
    const selected = appState.selectedModelIds.includes(recordId)
      ? appState.selectedModelIds.filter((id) => id !== recordId)
      : [...appState.selectedModelIds, recordId];

    updateAppState({ selectedModelIds: selected });
  }

  return (
    <div className={contentStackStyle}>
      <section className={heroBandStyle} aria-labelledby="models-title">
        <div>
          <p className={sectionEyebrowStyle}>Model shortlist</p>
          <h2 className={sectionTitleStyle} id="models-title">
            Same-provider comparison
          </h2>
          <p className={sectionTextStyle}>
            {formatProvider(appState.provider)} registry rows only. Freshness and stability are read from model metadata.
          </p>
        </div>
        <StatusBadge label="Selected models" value={String(selectedCount)} tone="neutral" />
      </section>

      {shortlist.entries.length === 0 ? (
        <EmptyState
          title="No same-provider benchmark set"
          body="No same-provider models are available in the current registry payload."
        />
      ) : (
        <>
          <section className={benchmarkGridStyle} aria-label="Benchmark set">
            {shortlist.entries.map((entry) => (
              <article className={benchmarkCardStyle} key={`${entry.role}-${entry.model.id}`}>
                <div className={roleHeaderStyle}>
                  <label className={modelSelectLabelStyle}>
                    <input
                      checked={appState.selectedModelIds.includes(entry.model.id)}
                      className={checkboxStyle}
                      type="checkbox"
                      onChange={() => toggleModel(entry.model.id)}
                    />
                    <span>{formatRole(entry.role)}</span>
                  </label>
                  <span className={getHealthPillStyle(entry)}>
                    {entry.productionEligible ? "production eligible" : "verify first"}
                  </span>
                </div>
                <h3 className={modelTitleStyle}>{entry.model.display_name}</h3>
                <p className={modelSubtextStyle}>{entry.model.model_id}</p>
                <div className={modelMetaGridStyle}>
                  <StatusBadge
                    label="Input tokens"
                    value={String(promptTokenEstimate)}
                    tone="neutral"
                  />
                  <StatusBadge
                    label="Output estimate"
                    value={String(outputEstimate)}
                    tone="neutral"
                  />
                  <StatusBadge
                    label="Quality tier"
                    value={entry.model.quality_tier}
                    tone="neutral"
                  />
                </div>
                <div>
                  <p className={whyTitleStyle}>Why included</p>
                  <ul className={compactListStyle}>
                    {entry.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
                {entry.warnings.length > 0 ? (
                  <div className={warningPanelStyle}>
                    <p className={whyTitleStyle}>Stale/demo warning</p>
                    <p className={warningTextStyle}>{entry.warnings[0]}</p>
                  </div>
                ) : null}
              </article>
            ))}
          </section>

          <section className={tableWrapStyle} aria-label="Registry health">
            <table className={tableStyle}>
              <thead>
                <tr>
                  <th scope="col">Role</th>
                  <th scope="col">Model</th>
                  <th scope="col">Stability</th>
                  <th scope="col">Freshness</th>
                  <th scope="col">Source</th>
                  <th scope="col">Last verified</th>
                </tr>
              </thead>
              <tbody>
                {shortlist.entries.map((entry) => (
                  <tr key={`health-${entry.role}-${entry.model.id}`}>
                    <td>{formatRole(entry.role)}</td>
                    <td>
                      <strong>{entry.model.display_name}</strong>
                      <span className={tableSubtextStyle}>{entry.model.model_id}</span>
                    </td>
                    <td>{entry.model.stability_status}</td>
                    <td>{entry.freshness}</td>
                    <td>{entry.model.source_url ?? "demo/unverified"}</td>
                    <td>{entry.model.last_verified_at ?? "not verified"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {shortlist.warnings.length > 0 ? (
            <section className={warningPanelStyle} aria-label="Registry shortlist warnings">
              <h3 className={warningHeadingStyle}>Registry health warnings</h3>
              <ul className={plainListStyle}>
                {shortlist.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {shortlist.rejected.length > 0 ? (
            <section className={tableWrapStyle} aria-label="Filtered registry rows">
              <table className={tableStyle}>
                <thead>
                  <tr>
                    <th scope="col">Filtered model</th>
                    <th scope="col">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {shortlist.rejected.map((item) => (
                    <tr key={item.model.id}>
                      <td>
                        <strong>{item.model.display_name}</strong>
                        <span className={tableSubtextStyle}>{item.model.model_id}</span>
                      </td>
                      <td>{item.reasons.join(" ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

export default ModelsScreen;

function getFailureCost(taskType: PublicAppState["taskType"]): FailureCost {
  return ["agent", "coding", "rag", "extraction"].includes(taskType) ? "high" : "medium";
}

function formatRole(role: ModelShortlistEntry["role"]): string {
  switch (role) {
    case "baseline":
      return "Baseline";
    case "cheaper":
      return "Cheaper";
    case "balanced":
      return "Balanced";
    case "fallback":
      return "Fallback";
  }
}

function getHealthPillStyle(entry: ModelShortlistEntry): string {
  return `${healthPillBaseStyle} ${entry.productionEligible ? healthPillGoodStyle : healthPillWarnStyle}`;
}

const benchmarkGridStyle = css({
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "12px",
  "@media (max-width: 1080px)": {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))"
  },
  "@media (max-width: 620px)": {
    gridTemplateColumns: "1fr"
  }
});

const benchmarkCardStyle = css({
  display: "grid",
  gap: "14px",
  minHeight: "360px",
  border: "1px solid #d7d6ca",
  borderRadius: "8px",
  background: "#fffef9",
  padding: "16px"
});

const roleHeaderStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px"
});

const modelSelectLabelStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  color: "#283228",
  fontSize: "0.82rem",
  fontWeight: 800,
  textTransform: "uppercase"
});

const modelTitleStyle = css({
  margin: 0,
  color: "#131914",
  fontSize: "1.05rem",
  lineHeight: 1.3
});

const modelSubtextStyle = css({
  margin: "-8px 0 0",
  color: "#657069",
  overflowWrap: "anywhere",
  fontSize: "0.86rem"
});

const modelMetaGridStyle = css({
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: "8px"
});

const whyTitleStyle = css({
  margin: "0 0 8px",
  color: "#576259",
  fontSize: "0.75rem",
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: "uppercase"
});

const compactListStyle = css({
  margin: 0,
  paddingLeft: "18px",
  color: "#465049",
  fontSize: "0.9rem",
  lineHeight: 1.45
});

const warningPanelStyle = css({
  border: "1px solid #e1c98f",
  borderRadius: "8px",
  background: "#fff8e4",
  padding: "14px"
});

const warningHeadingStyle = css({
  margin: 0,
  color: "#2b2412",
  fontSize: "1rem",
  lineHeight: 1.3
});

const warningTextStyle = css({
  margin: 0,
  color: "#5e4c19",
  fontSize: "0.88rem",
  lineHeight: 1.45
});

const healthPillBaseStyle = css({
  borderRadius: "999px",
  padding: "5px 8px",
  fontSize: "0.72rem",
  fontWeight: 800,
  whiteSpace: "nowrap"
});

const healthPillGoodStyle = css({
  border: "1px solid #9bbf82",
  background: "#eff8e9",
  color: "#263b1e"
});

const healthPillWarnStyle = css({
  border: "1px solid #e0c276",
  background: "#fff5d6",
  color: "#49370e"
});
