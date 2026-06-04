import { useEffect, useState } from "react";
import type { AuditResponse } from "@promptopts/shared";
import StatusBadge from "../../components/StatusBadge";
import StatusNotice from "../../components/StatusNotice";
import type { PromptOptsApiClient } from "../../apiClient";
import {
  formatAuditCostEstimate,
  formatModelFit,
  formatRiskLevel,
  formatSensitiveFinding,
  formatSuggestedRole
} from "../../formatters";
import { demoAudit, type PublicAppState } from "../../mockData";
import {
  cardTextStyle,
  contentStackStyle,
  heroBandStyle,
  listPanelStyle,
  metaGridStyle,
  panelTitleStyle,
  plainListStyle,
  primaryButtonStyle,
  sectionEyebrowStyle,
  sectionTextStyle,
  sectionTitleStyle,
  splitGridStyle
} from "../../styles";
import type { NavigateHandler } from "../../viewTypes";

function AuditScreen({
  apiClient,
  appState,
  onNavigate,
  projectId
}: {
  apiClient: PromptOptsApiClient | null;
  appState: PublicAppState;
  onNavigate: NavigateHandler;
  projectId: string;
}) {
  const [auditState, setAuditState] = useState<{
    audit: AuditResponse;
    message: string;
    status: "loading" | "ready" | "local" | "error";
  }>(() => ({
    audit: demoAudit,
    message: apiClient ? "Running deterministic prompt/model audit." : "Local demo audit; configure VITE_API_URL to run POST /audits.",
    status: apiClient ? "loading" : "local"
  }));
  const audit = auditState.audit;

  useEffect(() => {
    let isMounted = true;

    async function runAudit() {
      if (!apiClient) {
        setAuditState({
          audit: demoAudit,
          message: "Local demo audit; configure VITE_API_URL to run POST /audits.",
          status: "local"
        });
        return;
      }

      setAuditState((current) => ({
        ...current,
        message: "Running deterministic prompt/model audit. No live provider calls.",
        status: "loading"
      }));

      try {
        const response = await apiClient.runAudit({
          provider: appState.provider,
          modelId: appState.currentModelId,
          prompt: appState.promptText,
          taskType: appState.taskType,
          monthlyCalls: appState.monthlyCalls,
          priority: appState.priority,
          promptVersionId: appState.promptVersionId,
          constraints: {
            requiresJson: appState.requiresJson,
            usesTools: appState.usesTools,
            usesImages: appState.usesImages,
            needsStructuredOutput: appState.requiresJson,
            maxLatencyMs: appState.maxLatencyMs,
            minContextWindow: appState.minContextWindow
          }
        });

        if (isMounted) {
          setAuditState({
            audit: response,
            message: "Deterministic audit complete. Provider calls are still blocked until sensitive content is reviewed.",
            status: "ready"
          });
        }
      } catch {
        if (isMounted) {
          setAuditState({
            audit: demoAudit,
            message: "Audit API failed; showing local demo audit without making provider calls.",
            status: "error"
          });
        }
      }
    }

    void runAudit();

    return () => {
      isMounted = false;
    };
  }, [
    apiClient,
    appState.currentModelId,
    appState.maxLatencyMs,
    appState.minContextWindow,
    appState.monthlyCalls,
    appState.priority,
    appState.promptText,
    appState.promptVersionId,
    appState.provider,
    appState.requiresJson,
    appState.taskType,
    appState.usesImages,
    appState.usesTools
  ]);

  return (
    <div className={contentStackStyle}>
      <section className={heroBandStyle} aria-labelledby="audit-title">
        <div>
          <p className={sectionEyebrowStyle}>Prompt and model audit</p>
          <h2 className={sectionTitleStyle} id="audit-title">
            {formatRiskLevel(audit.riskLevel)} risk before savings
          </h2>
          <p className={sectionTextStyle}>
            Baseline: {appState.currentModelId}. Model fit: {formatModelFit(audit.modelFit)}.
          </p>
        </div>
        <button className={primaryButtonStyle} type="button" onClick={() => onNavigate(`/app/projects/${projectId}/success`)}>
          Define success
        </button>
      </section>

      <StatusNotice
        tone={auditState.status === "ready" ? "good" : "warn"}
        title="Audit status"
        body={auditState.message}
      />

      <StatusNotice
        tone={audit.sensitiveFindings.length === 0 ? "good" : "warn"}
        title="Secret and PII preflight"
        body={
          audit.sensitiveFindings.length === 0
            ? "No obvious secrets or PII detected by deterministic scanner. Review before any provider call."
            : "Sensitive content detected. Redact it before any provider call or eval run."
        }
      />

      {audit.sensitiveFindings.length > 0 ? (
        <section className={listPanelStyle} aria-label="Sensitive content findings">
          <h3 className={panelTitleStyle}>Sensitive content warnings</h3>
          <ul className={plainListStyle}>
            {audit.sensitiveFindings.map((finding) => (
              <li key={`${finding.reasonCode}-${finding.redactedPreview}`}>
                {formatSensitiveFinding(finding)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={metaGridStyle} aria-label="Audit metrics">
        <StatusBadge label="Risk level" value={formatRiskLevel(audit.riskLevel)} tone={audit.riskLevel === "low" ? "good" : "warn"} />
        <StatusBadge label="Model fit" value={formatModelFit(audit.modelFit)} tone={audit.modelFit === "appropriate" ? "good" : "attention"} />
        <StatusBadge label="Input tokens" value={audit.inputTokens.toLocaleString()} tone="neutral" />
        <StatusBadge label="Output estimate" value={audit.estimatedOutputTokens.toLocaleString()} tone="neutral" />
        <StatusBadge label="Spend estimate" value={formatAuditCostEstimate(audit)} tone={audit.monthlyCostEstimate.unverified ? "warn" : "good"} />
        <StatusBadge label="Registry" value={audit.registryFreshness} tone={audit.registryFreshness === "fresh" ? "good" : "warn"} />
      </section>

      <section className={splitGridStyle} aria-label="Audit detail">
        <section className={listPanelStyle}>
          <h3 className={panelTitleStyle}>Waste findings</h3>
          <ul className={plainListStyle}>
            {audit.wasteFindings.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section className={listPanelStyle}>
          <h3 className={panelTitleStyle}>Model-fit reasons</h3>
          <ul className={plainListStyle}>
            {audit.modelFitReasons.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </section>

      <section className={listPanelStyle} aria-label="Guardrails">
        <h3 className={panelTitleStyle}>Compression guardrails</h3>
        <ul className={plainListStyle}>
          {audit.compressionGuardrails.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className={splitGridStyle} aria-label="Audit next step and model roles">
        <section className={listPanelStyle}>
          <h3 className={panelTitleStyle}>Suggested next action</h3>
          <p className={cardTextStyle}>{audit.suggestedNextAction}</p>
        </section>
        <section className={listPanelStyle}>
          <h3 className={panelTitleStyle}>Suggested model roles</h3>
          <ul className={plainListStyle}>
            {audit.suggestedModelRoles.map((role) => (
              <li key={`${role.role}-${role.modelId}`}>
                {formatSuggestedRole(role)}. {role.reason}
              </li>
            ))}
          </ul>
        </section>
      </section>

      {audit.monthlyCostEstimate.metadataWarnings.length > 0 ? (
        <section className={listPanelStyle} aria-label="Registry estimate warnings">
          <h3 className={panelTitleStyle}>Registry estimate warnings</h3>
          <ul className={plainListStyle}>
            {audit.monthlyCostEstimate.metadataWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export default AuditScreen;
