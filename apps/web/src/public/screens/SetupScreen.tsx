import { useEffect, useState } from "react";
import type { ModelRegistryRecord, Priority, Provider, TaskType } from "@promptopts/shared";
import Field from "../../components/Field";
import StatusNotice from "../../components/StatusNotice";
import type { PromptOptsApiClient } from "../../apiClient";
import { getRegistryNotice } from "../../apiViewState";
import { formatTaskType } from "../../formatters";
import type { PublicAppState } from "../../mockData";
import {
  checkboxGridStyle,
  checkboxLabelStyle,
  checkboxStyle,
  contentStackStyle,
  detailsPanelStyle,
  detailsSummaryStyle,
  fieldControlStyle,
  formGridStyle,
  heroBandStyle,
  primaryButtonStyle,
  sectionEyebrowStyle,
  sectionTextStyle,
  sectionTitleStyle
} from "../../styles";
import type { ApiState, NavigateHandler } from "../../viewTypes";
import { filterModelsForSetup, taskTypeOptions } from "./publicScreenHelpers";

function SetupScreen({
  apiClient,
  apiState,
  appState,
  onNavigate,
  registryModels,
  updateAppState
}: {
  apiClient: PromptOptsApiClient | null;
  apiState: ApiState;
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
    requiresJson: appState.requiresJson,
    usesTools: appState.usesTools,
    usesImages: appState.usesImages,
    maxLatencyMs: appState.maxLatencyMs,
    minContextWindow: appState.minContextWindow
  });
  const [setupModels, setSetupModels] = useState<ModelRegistryRecord[]>(() =>
    filterModelsForSetup(registryModels, appState.provider, appState.taskType)
  );
  const [modelLoadState, setModelLoadState] = useState<"idle" | "loading" | "error">("idle");
  const selectedModelId = draft.currentModelId || setupModels[0]?.model_id || "";

  useEffect(() => {
    setDraft({
      provider: appState.provider,
      currentModelId: appState.currentModelId,
      taskType: appState.taskType,
      monthlyCalls: appState.monthlyCalls,
      priority: appState.priority,
      requiresJson: appState.requiresJson,
      usesTools: appState.usesTools,
      usesImages: appState.usesImages,
      maxLatencyMs: appState.maxLatencyMs,
      minContextWindow: appState.minContextWindow
    });
  }, [
    appState.currentModelId,
    appState.maxLatencyMs,
    appState.minContextWindow,
    appState.monthlyCalls,
    appState.priority,
    appState.provider,
    appState.requiresJson,
    appState.taskType,
    appState.usesImages,
    appState.usesTools
  ]);

  useEffect(() => {
    let isMounted = true;

    async function loadModels() {
      if (!apiClient) {
        setSetupModels(filterModelsForSetup(registryModels, draft.provider, draft.taskType));
        setModelLoadState("idle");
        return;
      }

      setModelLoadState("loading");

      try {
        const registry = await apiClient.models({
          provider: draft.provider,
          taskType: draft.taskType
        });

        if (!isMounted) {
          return;
        }

        setSetupModels(registry.models);
        setModelLoadState("idle");
        setDraft((current) => {
          if (current.provider !== draft.provider || current.taskType !== draft.taskType) {
            return current;
          }

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
          setSetupModels(filterModelsForSetup(registryModels, draft.provider, draft.taskType));
          setModelLoadState("error");
        }
      }
    }

    void loadModels();

    return () => {
      isMounted = false;
    };
  }, [apiClient, draft.provider, draft.taskType, registryModels]);

  function updateDraft(next: Partial<typeof draft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function commitSetup() {
    const nextSelectedModelIds = setupModels.map((model) => model.id).slice(0, 3);

    updateAppState({
      ...draft,
      currentModelId: selectedModelId,
      selectedModelIds: nextSelectedModelIds.length > 0 ? nextSelectedModelIds : appState.selectedModelIds,
      setupSavedAt: new Date().toISOString()
    });
    onNavigate(`/app/prompts/${appState.promptId}`);
  }

  return (
    <div className={contentStackStyle}>
      <section className={heroBandStyle} aria-labelledby="setup-title">
        <div>
          <p className={sectionEyebrowStyle}>Provider and model setup</p>
          <h2 className={sectionTitleStyle} id="setup-title">
            Same-provider MVP path
          </h2>
          <p className={sectionTextStyle}>
            OpenAI, Anthropic, and Gemini stay in scope; model metadata comes from the registry.
          </p>
        </div>
        <button className={primaryButtonStyle} disabled={!selectedModelId} type="button" onClick={commitSetup}>
          Continue to prompt
        </button>
      </section>

      <section className={formGridStyle} aria-label="Project setup">
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
            disabled={setupModels.length === 0}
            value={selectedModelId}
            onChange={(event) => updateDraft({ currentModelId: event.target.value })}
          >
            {setupModels.map((model) => (
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
            <option value="cost">Cost</option>
            <option value="quality">Quality</option>
            <option value="latency">Latency</option>
            <option value="balanced">Balanced</option>
          </select>
        </Field>
      </section>

      <details className={detailsPanelStyle}>
        <summary className={detailsSummaryStyle}>Advanced constraints</summary>
        <div className={checkboxGridStyle}>
          <label className={checkboxLabelStyle}>
            <input
              checked={draft.requiresJson}
              className={checkboxStyle}
              type="checkbox"
              onChange={(event) => updateDraft({ requiresJson: event.target.checked })}
            />
            JSON output
          </label>
          <label className={checkboxLabelStyle}>
            <input
              checked={draft.usesTools}
              className={checkboxStyle}
              type="checkbox"
              onChange={(event) => updateDraft({ usesTools: event.target.checked })}
            />
            Tools
          </label>
          <label className={checkboxLabelStyle}>
            <input
              checked={draft.usesImages}
              className={checkboxStyle}
              type="checkbox"
              onChange={(event) => updateDraft({ usesImages: event.target.checked })}
            />
            Images
          </label>
          <Field label="Latency target">
            <input
              className={fieldControlStyle}
              min={1}
              placeholder="Milliseconds"
              type="number"
              value={draft.maxLatencyMs ?? ""}
              onChange={(event) =>
                updateDraft({ maxLatencyMs: event.target.value ? Number(event.target.value) : null })
              }
            />
          </Field>
          <Field label="Context size">
            <input
              className={fieldControlStyle}
              min={1}
              placeholder="Minimum tokens"
              type="number"
              value={draft.minContextWindow ?? ""}
              onChange={(event) =>
                updateDraft({ minContextWindow: event.target.value ? Number(event.target.value) : null })
              }
            />
          </Field>
        </div>
      </details>

      <StatusNotice
        tone={apiState.status === "online" && modelLoadState !== "error" ? "good" : "warn"}
        title="Registry status"
        body={`${getRegistryNotice(apiState)} ${
          modelLoadState === "loading"
            ? "Loading filtered model rows."
            : `${setupModels.length} matching registry row${setupModels.length === 1 ? "" : "s"}.`
        }`}
      />
    </div>
  );
}

export default SetupScreen;
