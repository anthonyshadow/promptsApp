import { useEffect, useState } from "react";
import type { AuditResponse, ModelRegistryRecord, Priority, Provider, TaskType } from "@promptopts/shared";
import Field from "../../components/Field";
import StatusBadge from "../../components/StatusBadge";
import StatusNotice from "../../components/StatusNotice";
import type { PromptOptsApiClient } from "../../apiClient";
import {
  formatAuditCostEstimate,
  formatModelFit,
  formatProvider,
  formatRiskLevel,
  formatTaskType
} from "../../formatters";
import { demoAudit, type PublicAppState } from "../../mockData";
import { detectPromptVariables, estimatePromptTokens } from "../../promptView";
import {
  actionRowStyle,
  cardTextStyle,
  contentStackStyle,
  fieldControlStyle,
  formGridStyle,
  heroBandStyle,
  listPanelStyle,
  metaGridStyle,
  panelTitleStyle,
  plainListStyle,
  primaryButtonStyle,
  promptEditorGridStyle,
  promptTextareaStyle,
  sectionEyebrowStyle,
  sectionTextStyle,
  sectionTitleStyle,
  splitGridStyle
} from "../../styles";
import type { NavigateHandler } from "../../viewTypes";
import {
  createFreeAuditRequest,
  createLocalFreeAuditPreview,
  filterModelsForSetup,
  taskTypeOptions
} from "./publicScreenHelpers";

function FreeAuditScreen({
  apiClient,
  appState,
  onNavigate,
  registryModels,
  updateAppState
}: {
  apiClient: PromptOptsApiClient | null;
  appState: PublicAppState;
  onNavigate: NavigateHandler;
  registryModels: ModelRegistryRecord[];
  updateAppState: (next: Partial<PublicAppState>) => void;
}) {
  const [draft, setDraft] = useState({
    provider: appState.provider,
    currentModelId: appState.currentModelId,
    taskType: appState.taskType,
    monthlyCalls: appState.monthlyCalls,
    priority: appState.priority,
    promptText: appState.promptText,
    contactEmail: "",
    company: ""
  });
  const [auditState, setAuditState] = useState<{
    audit: AuditResponse;
    message: string;
    status: "local" | "loading" | "ready" | "error";
  }>({
    audit: demoAudit,
    message: apiClient
      ? "Preparing deterministic preview. No live provider calls."
      : "Local preview; configure VITE_API_URL to persist the free audit.",
    status: apiClient ? "loading" : "local"
  });
  const [freeAuditModels, setFreeAuditModels] = useState<ModelRegistryRecord[]>(() =>
    filterModelsForSetup(registryModels, appState.provider, appState.taskType)
  );
  const selectedModelId = draft.currentModelId || freeAuditModels[0]?.model_id || "";
  const promptTokenPreview = estimatePromptTokens(draft.promptText);
  const audit = auditState.audit;

  useEffect(() => {
    let isMounted = true;

    async function loadModels() {
      if (!apiClient) {
        setFreeAuditModels(filterModelsForSetup(registryModels, draft.provider, draft.taskType));
        return;
      }

      try {
        const registry = await apiClient.models({
          provider: draft.provider,
          taskType: draft.taskType
        });

        if (!isMounted) {
          return;
        }

        setFreeAuditModels(registry.models);
        setDraft((current) => {
          const hasCurrentModel = registry.models.some((model) => model.model_id === current.currentModelId);

          return hasCurrentModel
            ? current
            : {
                ...current,
                currentModelId: registry.models[0]?.model_id ?? ""
              };
        });
      } catch {
        if (isMounted) {
          setFreeAuditModels(filterModelsForSetup(registryModels, draft.provider, draft.taskType));
        }
      }
    }

    void loadModels();

    return () => {
      isMounted = false;
    };
  }, [apiClient, draft.provider, draft.taskType, registryModels]);

  useEffect(() => {
    if (!apiClient || draft.promptText.trim().length === 0 || !selectedModelId) {
      setAuditState({
        audit: createLocalFreeAuditPreview(draft.promptText),
        message: "Instant local preview. Add API configuration to persist a redacted free audit.",
        status: "local"
      });
      return;
    }

    let isMounted = true;
    const client = apiClient;
    const timeout = setTimeout(() => {
      async function runPreview() {
        setAuditState((current) => ({
          ...current,
          message: "Running deterministic free audit preview. No live provider calls.",
          status: "loading"
        }));

        try {
          const response = await client.runAudit(createFreeAuditRequest("preview", draft, selectedModelId));

          if (isMounted) {
            setAuditState({
              audit: response,
              message: "Preview captured with redacted shareable output. Run evals before switching.",
              status: "ready"
            });
          }
        } catch {
          if (isMounted) {
            setAuditState({
              audit: createLocalFreeAuditPreview(draft.promptText),
              message: "Free audit API failed; showing local preview only.",
              status: "error"
            });
          }
        }
      }

      void runPreview();
    }, 350);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [
    apiClient,
    draft.company,
    draft.contactEmail,
    draft.currentModelId,
    draft.monthlyCalls,
    draft.priority,
    draft.promptText,
    draft.provider,
    draft.taskType,
    selectedModelId
  ]);

  function updateDraft(next: Partial<typeof draft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  async function handleCta(ctaClicked: "preview" | "get_audit_report" | "create_project" | "run_evals") {
    updateAppState({
      provider: draft.provider,
      currentModelId: selectedModelId,
      taskType: draft.taskType,
      monthlyCalls: draft.monthlyCalls,
      priority: draft.priority,
      promptText: draft.promptText,
      promptVariables: detectPromptVariables(draft.promptText)
    });

    if (apiClient && draft.promptText.trim().length > 0 && selectedModelId) {
      try {
        const response = await apiClient.runAudit(createFreeAuditRequest(ctaClicked, draft, selectedModelId));

        setAuditState({
          audit: response,
          message: "Redacted audit report captured. Run evals before switching.",
          status: "ready"
        });
      } catch {
        setAuditState((current) => ({
          ...current,
          message: "CTA capture failed; local app state was still updated.",
          status: "error"
        }));
      }
    }

    if (ctaClicked === "create_project") {
      onNavigate("/app/setup");
    }

    if (ctaClicked === "run_evals") {
      onNavigate(`/app/projects/${appState.projectId}/success`);
    }
  }

  return (
    <div className={contentStackStyle}>
      <section className={heroBandStyle} aria-labelledby="free-audit-title">
        <div>
          <p className={sectionEyebrowStyle}>Free LLM Model Fit Audit</p>
          <h2 className={sectionTitleStyle} id="free-audit-title">
            {formatRiskLevel(audit.riskLevel)} risk before savings
          </h2>
          <p className={sectionTextStyle}>
            Free preflight for {formatProvider(draft.provider)} / {selectedModelId || "select a model"}. Run evals before switching.
          </p>
        </div>
        <button
          className={primaryButtonStyle}
          disabled={draft.promptText.trim().length === 0 || !selectedModelId}
          type="button"
          onClick={() => void handleCta("get_audit_report")}
        >
          Get audit report
        </button>
      </section>

      <section className={formGridStyle} aria-label="Free audit setup">
        <Field label="Provider">
          <select
            className={fieldControlStyle}
            value={draft.provider}
            onChange={(event) => {
              const provider = event.target.value as Provider;
              const nextModel = filterModelsForSetup(registryModels, provider, draft.taskType)[0]?.model_id ?? "";

              updateDraft({ provider, currentModelId: nextModel });
            }}
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="gemini">Gemini</option>
          </select>
        </Field>
        <Field label="Current model">
          <select
            className={fieldControlStyle}
            disabled={freeAuditModels.length === 0}
            value={selectedModelId}
            onChange={(event) => updateDraft({ currentModelId: event.target.value })}
          >
            {freeAuditModels.map((model) => (
              <option key={model.id} value={model.model_id}>
                {model.display_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Task type">
          <select
            className={fieldControlStyle}
            value={draft.taskType}
            onChange={(event) => {
              const taskType = event.target.value as TaskType;
              const nextModel = filterModelsForSetup(registryModels, draft.provider, taskType)[0]?.model_id ?? "";

              updateDraft({ taskType, currentModelId: nextModel });
            }}
          >
            {taskTypeOptions.map((taskType) => (
              <option key={taskType} value={taskType}>
                {formatTaskType(taskType)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Monthly calls">
          <input
            className={fieldControlStyle}
            min={1}
            type="number"
            value={draft.monthlyCalls}
            onChange={(event) => updateDraft({ monthlyCalls: Number(event.target.value) })}
          />
        </Field>
        <Field label="Priority">
          <select
            className={fieldControlStyle}
            value={draft.priority}
            onChange={(event) => updateDraft({ priority: event.target.value as Priority })}
          >
            <option value="balanced">Balanced</option>
            <option value="cost">Cost</option>
            <option value="quality">Quality</option>
            <option value="latency">Latency</option>
          </select>
        </Field>
        <Field label="Email">
          <input
            className={fieldControlStyle}
            placeholder="optional"
            type="email"
            value={draft.contactEmail}
            onChange={(event) => updateDraft({ contactEmail: event.target.value })}
          />
        </Field>
        <Field label="Company">
          <input
            className={fieldControlStyle}
            placeholder="optional"
            type="text"
            value={draft.company}
            onChange={(event) => updateDraft({ company: event.target.value })}
          />
        </Field>
      </section>

      <section className={promptEditorGridStyle} aria-label="Free audit prompt">
        <Field label="Prompt paste">
          <textarea
            className={promptTextareaStyle}
            value={draft.promptText}
            onChange={(event) => updateDraft({ promptText: event.target.value })}
          />
        </Field>
        <section className={listPanelStyle} aria-label="Instant preview">
          <h3 className={panelTitleStyle}>Instant preview</h3>
          <p className={cardTextStyle}>
            Input tokens: {promptTokenPreview.toLocaleString()}. Model fit: {formatModelFit(audit.modelFit)}. Risk:{" "}
            {formatRiskLevel(audit.riskLevel)}.
          </p>
          <p className={cardTextStyle}>
            Unverified savings opportunity: {formatAuditCostEstimate(audit)}. No automatic savings promise.
          </p>
          <p className={cardTextStyle}>Run evals before switching.</p>
        </section>
      </section>

      <StatusNotice
        tone={auditState.status === "ready" ? "good" : "warn"}
        title="Free audit status"
        body={auditState.message}
      />

      <StatusNotice
        tone={audit.sensitiveFindings.length === 0 ? "good" : "warn"}
        title="Secret and PII preflight"
        body={
          audit.sensitiveFindings.length === 0
            ? "No obvious secrets or PII detected by deterministic scanner."
            : "Sensitive content detected. Shareable output stays redacted by default."
        }
      />

      <section className={metaGridStyle} aria-label="Free audit metrics">
        <StatusBadge label="Input tokens" value={audit.inputTokens.toLocaleString()} tone="neutral" />
        <StatusBadge label="Potential waste" value={`${audit.wasteFindings.length} findings`} tone="warn" />
        <StatusBadge label="Model fit" value={formatModelFit(audit.modelFit)} tone={audit.modelFit === "appropriate" ? "good" : "attention"} />
        <StatusBadge label="Risk" value={formatRiskLevel(audit.riskLevel)} tone={audit.riskLevel === "low" ? "good" : "warn"} />
        <StatusBadge label="Savings opportunity" value={formatAuditCostEstimate(audit)} tone="warn" />
      </section>

      <section className={splitGridStyle} aria-label="Free audit findings">
        <section className={listPanelStyle}>
          <h3 className={panelTitleStyle}>Risk and waste</h3>
          <ul className={plainListStyle}>
            {audit.wasteFindings.map((finding) => (
              <li key={finding}>{finding}</li>
            ))}
          </ul>
        </section>
        <section className={listPanelStyle}>
          <h3 className={panelTitleStyle}>Shareable output</h3>
          <p className={cardTextStyle}>
            {audit.freeAudit?.shareableSummary ??
              "Prompt redacted by default. The shareable audit summarizes fit, risk, and eval readiness without raw prompt text."}
          </p>
        </section>
      </section>

      <section className={actionRowStyle} aria-label="Free audit actions">
        <button
          className={primaryButtonStyle}
          disabled={draft.promptText.trim().length === 0 || !selectedModelId}
          type="button"
          onClick={() => void handleCta("create_project")}
        >
          Create project
        </button>
        <button
          className={primaryButtonStyle}
          disabled={draft.promptText.trim().length === 0 || !selectedModelId}
          type="button"
          onClick={() => void handleCta("run_evals")}
        >
          Run evals
        </button>
      </section>
    </div>
  );
}

export default FreeAuditScreen;
