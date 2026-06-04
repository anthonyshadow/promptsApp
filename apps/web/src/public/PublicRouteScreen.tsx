import { useEffect, useMemo, useState } from "react";
import type { ModelRegistryRecord, Priority, Provider, TaskType } from "@promptopts/shared";
import DecisionCard from "../components/DecisionCard";
import EmptyState from "../components/EmptyState";
import Field from "../components/Field";
import ModelFitPanel, { RiskSummary, SavingsSummary } from "../components/SummaryPanels";
import StatusBadge from "../components/StatusBadge";
import StatusNotice from "../components/StatusNotice";
import type { PromptOptsApiClient } from "../apiClient";
import { getRegistryNotice } from "../apiViewState";
import {
  formatCandidateId,
  formatProvider,
  formatModelFit,
  formatStrategy,
  formatTaskType,
  getStepCardTitle
} from "../formatters";
import {
  demoAudit,
  demoCandidates,
  demoEvalResults,
  demoEvalRun,
  demoProject,
  demoPrompt,
  demoPromptVersion,
  demoQualityContract,
  demoWorkspace,
  demoReport,
  demoReportArtifacts,
  demoTestCases,
  type PublicAppState
} from "../mockData";
import { detectPromptVariables, estimatePromptTokens, splitPromptIntoSegments } from "../promptView";
import { stepperItems, type PublicRoute } from "../routes";
import {
  actionRowStyle,
  cardGridStyle,
  cardKickerStyle,
  cardTextStyle,
  cardTitleStyle,
  candidateCardStyle,
  candidateHeaderStyle,
  checkboxLabelStyle,
  checkboxGridStyle,
  checkboxStyle,
  chipListStyle,
  chipStyle,
  compactTitleStyle,
  contentStackStyle,
  decisionGridStyle,
  detailsPanelStyle,
  detailsSummaryStyle,
  emptyStateStyle,
  expertGridStyle,
  expertPanelStyle,
  fieldControlStyle,
  formGridStyle,
  heroBandStyle,
  listPanelStyle,
  loopCardLabelStyle,
  loopCardStyle,
  loopCardTitleStyle,
  metaGridStyle,
  metricLineStyle,
  panelTitleStyle,
  plainListStyle,
  primaryButtonStyle,
  promptEditorGridStyle,
  promptTextareaStyle,
  promptPreviewStyle,
  promptVariableStyle,
  riskPillStyle,
  sectionEyebrowStyle,
  sectionTextStyle,
  sectionTitleStyle,
  splitGridStyle,
  tableStyle,
  tableSubtextStyle,
  tableWrapStyle,
  testCardStyle
} from "../styles";
import type { ApiState, NavigateHandler } from "../viewTypes";

function PublicRouteScreen({
  apiClient,
  apiState,
  appState,
  onNavigate,
  registryModels,
  route,
  updateAppState
}: {
  apiClient: PromptOptsApiClient | null;
  apiState: ApiState;
  appState: PublicAppState;
  onNavigate: NavigateHandler;
  registryModels: ModelRegistryRecord[];
  route: PublicRoute;
  updateAppState: (next: Partial<PublicAppState>) => void;
}) {
  switch (route.kind) {
    case "app-home":
      return <WorkspaceScreen appState={appState} onNavigate={onNavigate} />;
    case "free-audit":
      return <FreeAuditScreen appState={appState} onNavigate={onNavigate} updateAppState={updateAppState} />;
    case "setup":
      return (
        <SetupScreen
          apiState={apiState}
          apiClient={apiClient}
          appState={appState}
          onNavigate={onNavigate}
          registryModels={registryModels}
          updateAppState={updateAppState}
        />
      );
    case "prompt":
      return (
        <PromptScreen
          apiClient={apiClient}
          appState={appState}
          onNavigate={onNavigate}
          updateAppState={updateAppState}
        />
      );
    case "audit":
      return <AuditScreen appState={appState} onNavigate={onNavigate} />;
    case "success":
      return <SuccessContractScreen appState={appState} updateAppState={updateAppState} />;
    case "candidates":
      return <CandidatesScreen appState={appState} updateAppState={updateAppState} />;
    case "models":
      return <ModelsScreen appState={appState} registryModels={registryModels} updateAppState={updateAppState} />;
    case "eval-run":
      return <EvalRunScreen onNavigate={onNavigate} />;
    case "report":
      return <ReportScreen onNavigate={onNavigate} />;
    case "report-export":
      return <ExportScreen />;
    case "not-found":
      return <NotFoundScreen onNavigate={onNavigate} path={route.path} />;
  }
}

export default PublicRouteScreen;

const taskTypeOptions: TaskType[] = [
  "support",
  "summarization",
  "extraction",
  "coding",
  "rag",
  "agent",
  "classification",
  "other"
];

function filterModelsForSetup(
  registryModels: ModelRegistryRecord[],
  provider: Provider,
  taskType: TaskType
): ModelRegistryRecord[] {
  return registryModels.filter((model) => {
    return model.provider === provider && model.recommended_task_types.includes(taskType);
  });
}

function formatPromptSaveState(state: "idle" | "saving" | "saved" | "error"): string {
  switch (state) {
    case "idle":
      return "Not saved";
    case "saving":
      return "Saving";
    case "saved":
      return "Saved";
    case "error":
      return "API required";
  }
}

function WorkspaceScreen({ appState, onNavigate }: { appState: PublicAppState; onNavigate: NavigateHandler }) {
  return (
    <div className={contentStackStyle}>
      <section className={heroBandStyle} aria-labelledby="workspace-title">
        <div>
          <p className={sectionEyebrowStyle}>{demoProject.name}</p>
          <h2 className={sectionTitleStyle} id="workspace-title">
            Same-provider optimization path
          </h2>
          <p className={sectionTextStyle}>
            {formatProvider(appState.provider)} baseline, current model {appState.currentModelId},{" "}
            {appState.monthlyCalls.toLocaleString()} monthly calls.
          </p>
        </div>
        <button className={primaryButtonStyle} type="button" onClick={() => onNavigate("/app/setup")}>
          Continue setup
        </button>
      </section>

      <section className={splitGridStyle} aria-label="Workspace health">
        <RiskSummary />
        <SavingsSummary />
      </section>

      <section className={cardGridStyle} aria-label="Product loop">
        {stepperItems.map((step) => (
          <button className={loopCardStyle} key={step.key} type="button" onClick={() => onNavigate(step.path)}>
            <span className={loopCardLabelStyle}>{step.label}</span>
            <strong className={loopCardTitleStyle}>{getStepCardTitle(step.key)}</strong>
          </button>
        ))}
      </section>
    </div>
  );
}

function FreeAuditScreen({
  appState,
  onNavigate,
  updateAppState
}: {
  appState: PublicAppState;
  onNavigate: NavigateHandler;
  updateAppState: (next: Partial<PublicAppState>) => void;
}) {
  return (
    <div className={contentStackStyle}>
      <section className={heroBandStyle} aria-labelledby="free-audit-title">
        <div>
          <p className={sectionEyebrowStyle}>Free LLM Model Fit Audit</p>
          <h2 className={sectionTitleStyle} id="free-audit-title">
            Model-fit badge first
          </h2>
          <p className={sectionTextStyle}>
            Current mock result: {formatModelFit(demoAudit.modelFit)} with {demoAudit.riskLevel} risk.
          </p>
        </div>
        <button className={primaryButtonStyle} type="button" onClick={() => onNavigate("/app/setup")}>
          Move into app
        </button>
      </section>

      <section className={formGridStyle} aria-label="Audit setup">
        <Field label="Provider">
          <select
            className={fieldControlStyle}
            value={appState.provider}
            onChange={(event) => updateAppState({ provider: event.target.value as Provider })}
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="gemini">Gemini</option>
          </select>
        </Field>
        <Field label="Monthly calls">
          <input
            className={fieldControlStyle}
            min={1}
            type="number"
            value={appState.monthlyCalls}
            onChange={(event) => updateAppState({ monthlyCalls: Number(event.target.value) })}
          />
        </Field>
        <Field label="Priority">
          <select
            className={fieldControlStyle}
            value={appState.priority}
            onChange={(event) => updateAppState({ priority: event.target.value as Priority })}
          >
            <option value="balanced">Balanced</option>
            <option value="cost">Cost</option>
            <option value="quality">Quality</option>
            <option value="latency">Latency</option>
          </select>
        </Field>
      </section>

      <section className={splitGridStyle} aria-label="Audit readout">
        <RiskSummary />
        <ModelFitPanel />
      </section>
    </div>
  );
}

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

function PromptScreen({
  apiClient,
  appState,
  onNavigate,
  updateAppState
}: {
  apiClient: PromptOptsApiClient | null;
  appState: PublicAppState;
  onNavigate: NavigateHandler;
  updateAppState: (next: Partial<PublicAppState>) => void;
}) {
  const [promptText, setPromptText] = useState(appState.promptText);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const detectedVariables = useMemo(() => detectPromptVariables(promptText), [promptText]);
  const promptSegments = useMemo(() => splitPromptIntoSegments(promptText), [promptText]);
  const tokenEstimate = estimatePromptTokens(promptText);

  useEffect(() => {
    setPromptText(appState.promptText);
  }, [appState.promptText]);

  async function runAudit() {
    const variables = detectedVariables;

    updateAppState({
      promptText,
      promptVariables: variables
    });

    if (!apiClient) {
      setSaveState("error");
      return;
    }

    setSaveState("saving");

    try {
      const response = await apiClient.createPrompt({
        workspace_id: demoWorkspace.id,
        name: appState.projectName || demoPrompt.name,
        task_type: appState.taskType,
        provider: appState.provider,
        model_id: appState.currentModelId,
        prompt_text: promptText,
        variables
      });

      updateAppState({
        projectId: response.project.id,
        promptId: response.prompt.id,
        promptVersionId: response.version.id,
        projectName: response.project.name,
        taskType: response.project.task_type,
        provider: response.project.current_provider,
        currentModelId: response.project.current_model_id,
        promptText: response.version.prompt_text,
        promptVariables: response.version.variables
      });
      setSaveState("saved");
      onNavigate(`/app/projects/${response.project.id}/audit`);
    } catch {
      setSaveState("error");
    }
  }

  return (
    <div className={contentStackStyle}>
      <section className={heroBandStyle} aria-labelledby="prompt-title">
        <div>
          <p className={sectionEyebrowStyle}>{demoPromptVersion.label}</p>
          <h2 className={sectionTitleStyle} id="prompt-title">
            Prompt baseline
          </h2>
          <p className={sectionTextStyle}>
            Current provider/model: {formatProvider(appState.provider)} / {appState.currentModelId}
          </p>
        </div>
        <StatusBadge label="Current model" value={appState.currentModelId} tone="neutral" />
      </section>

      <section className={promptEditorGridStyle} aria-label="Prompt editor">
        <Field label="Prompt editor">
          <textarea
            className={promptTextareaStyle}
            value={promptText}
            onChange={(event) => {
              setPromptText(event.target.value);
              setSaveState("idle");
            }}
          />
        </Field>
        <section className={promptPreviewStyle} aria-label="Variable-highlighted prompt preview">
          {promptSegments.map((segment, index) =>
            segment.kind === "variable" ? (
              <mark className={promptVariableStyle} key={`${segment.text}-${index}`}>
                {segment.text}
              </mark>
            ) : (
              <span key={`text-${index}`}>{segment.text}</span>
            )
          )}
        </section>
      </section>

      <section className={metaGridStyle} aria-label="Prompt estimates and warnings">
        <StatusBadge label="Input estimate" value={`${tokenEstimate.toLocaleString()} tokens`} tone="neutral" />
        <StatusBadge label="Output estimate" value="Pending audit" tone="warn" />
        <StatusBadge label="Task type" value={formatTaskType(appState.taskType)} tone="neutral" />
        <StatusBadge
          label="Save state"
          value={formatPromptSaveState(saveState)}
          tone={saveState === "saved" ? "good" : saveState === "error" ? "warn" : "neutral"}
        />
      </section>

      <section className={listPanelStyle} aria-label="Detected variables">
        <h3 className={panelTitleStyle}>Detected variables</h3>
        {detectedVariables.length === 0 ? (
          <p className={cardTextStyle}>No variable patterns detected yet.</p>
        ) : (
          <div className={chipListStyle}>
            {detectedVariables.map((variable) => (
              <span className={chipStyle} key={variable}>
                {`{{${variable}}}`}
              </span>
            ))}
          </div>
        )}
      </section>

      <StatusNotice
        tone="warn"
        title="Secret and PII warning"
        body="Placeholder scanner only: treat pasted prompts as sensitive. Admin views remain redacted by default, and provider calls are not live yet."
      />

      <div className={actionRowStyle}>
        <button
          className={primaryButtonStyle}
          disabled={promptText.trim().length === 0 || saveState === "saving"}
          type="button"
          onClick={() => void runAudit()}
        >
          {saveState === "saving" ? "Saving prompt" : "Run audit"}
        </button>
      </div>
    </div>
  );
}

function AuditScreen({ appState, onNavigate }: { appState: PublicAppState; onNavigate: NavigateHandler }) {
  return (
    <div className={contentStackStyle}>
      <section className={heroBandStyle} aria-labelledby="audit-title">
        <div>
          <p className={sectionEyebrowStyle}>Prompt and model audit</p>
          <h2 className={sectionTitleStyle} id="audit-title">
            {formatModelFit(demoAudit.modelFit)}
          </h2>
          <p className={sectionTextStyle}>
            Baseline: {appState.currentModelId}. Registry freshness: {demoAudit.registryFreshness}.
          </p>
        </div>
        <button className={primaryButtonStyle} type="button" onClick={() => onNavigate("/app/projects/project_demo_support/success")}>
          Define success
        </button>
      </section>

      <section className={splitGridStyle} aria-label="Audit findings">
        <RiskSummary />
        <SavingsSummary />
      </section>

      <section className={listPanelStyle} aria-label="Guardrails">
        <h3 className={panelTitleStyle}>Compression guardrails</h3>
        <ul className={plainListStyle}>
          {demoAudit.compressionGuardrails.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function SuccessContractScreen({
  appState,
  updateAppState
}: {
  appState: PublicAppState;
  updateAppState: (next: Partial<PublicAppState>) => void;
}) {
  return (
    <div className={contentStackStyle}>
      <section className={heroBandStyle} aria-labelledby="success-title">
        <div>
          <p className={sectionEyebrowStyle}>Quality contract</p>
          <h2 className={sectionTitleStyle} id="success-title">
            Pass threshold {Math.round(appState.passThreshold * 100)}%
          </h2>
          <p className={sectionTextStyle}>{demoQualityContract.notes}</p>
        </div>
        <StatusBadge label="Must-pass checks" value={String(demoQualityContract.must_pass_check_ids.length)} tone="warn" />
      </section>

      <Field label="Pass threshold">
        <input
          className={fieldControlStyle}
          max={1}
          min={0}
          step={0.01}
          type="number"
          value={appState.passThreshold}
          onChange={(event) => updateAppState({ passThreshold: Number(event.target.value) })}
        />
      </Field>

      <section className={cardGridStyle} aria-label="Test cases">
        {demoTestCases.map((testCase) => (
          <article className={testCardStyle} key={testCase.id}>
            <p className={cardKickerStyle}>{testCase.checks.some((check) => check.must_pass) ? "Must-pass" : "Review"}</p>
            <h3 className={cardTitleStyle}>{testCase.name}</h3>
            <p className={cardTextStyle}>{testCase.checks.map((check) => check.description).join(" / ")}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

function CandidatesScreen({
  appState,
  updateAppState
}: {
  appState: PublicAppState;
  updateAppState: (next: Partial<PublicAppState>) => void;
}) {
  function toggleCandidate(candidateId: string) {
    const selected = appState.selectedCandidateIds.includes(candidateId)
      ? appState.selectedCandidateIds.filter((id) => id !== candidateId)
      : [...appState.selectedCandidateIds, candidateId];

    updateAppState({ selectedCandidateIds: selected });
  }

  return (
    <div className={contentStackStyle}>
      <section className={heroBandStyle} aria-labelledby="candidates-title">
        <div>
          <p className={sectionEyebrowStyle}>Prompt candidates</p>
          <h2 className={sectionTitleStyle} id="candidates-title">
            Risk profiles before token deltas
          </h2>
          <p className={sectionTextStyle}>Baseline remains included for regression proof.</p>
        </div>
        <StatusBadge label="Selected" value={String(appState.selectedCandidateIds.length)} tone="neutral" />
      </section>

      <section className={cardGridStyle} aria-label="Candidate set">
        {demoCandidates.map((candidate) => {
          const checked = appState.selectedCandidateIds.includes(candidate.id);

          return (
            <article className={candidateCardStyle} key={candidate.id}>
              <div className={candidateHeaderStyle}>
                <span className={riskPillStyle}>{candidate.risk} risk</span>
                <label className={checkboxLabelStyle}>
                  <input
                    checked={checked}
                    className={checkboxStyle}
                    type="checkbox"
                    onChange={() => toggleCandidate(candidate.id)}
                  />
                  Include
                </label>
              </div>
              <h3 className={cardTitleStyle}>{formatStrategy(candidate.strategy)}</h3>
              <p className={cardTextStyle}>{candidate.summary}</p>
              <p className={metricLineStyle}>Expected token delta: {candidate.tokenDelta}%</p>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function ModelsScreen({
  appState,
  registryModels,
  updateAppState
}: {
  appState: PublicAppState;
  registryModels: ModelRegistryRecord[];
  updateAppState: (next: Partial<PublicAppState>) => void;
}) {
  const sameProviderModels = registryModels.filter((model) => model.provider === appState.provider);

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
        <StatusBadge label="Selected models" value={String(appState.selectedModelIds.length)} tone="neutral" />
      </section>

      {sameProviderModels.length === 0 ? (
        <EmptyState title="No registry rows" body="No same-provider models are available in the current registry payload." />
      ) : (
        <section className={tableWrapStyle} aria-label="Model shortlist table">
          <table className={tableStyle}>
            <thead>
              <tr>
                <th scope="col">Run</th>
                <th scope="col">Model</th>
                <th scope="col">Risk</th>
                <th scope="col">Freshness</th>
                <th scope="col">Source</th>
              </tr>
            </thead>
            <tbody>
              {sameProviderModels.map((model) => (
                <tr key={model.id}>
                  <td>
                    <input
                      checked={appState.selectedModelIds.includes(model.id)}
                      className={checkboxStyle}
                      type="checkbox"
                      onChange={() => toggleModel(model.id)}
                    />
                  </td>
                  <td>
                    <strong>{model.display_name}</strong>
                    <span className={tableSubtextStyle}>{model.model_id}</span>
                  </td>
                  <td>{model.stability_status}</td>
                  <td>{model.freshness_status}</td>
                  <td>{model.source_url ?? "demo/unverified"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function EvalRunScreen({ onNavigate }: { onNavigate: NavigateHandler }) {
  return (
    <div className={contentStackStyle}>
      <section className={heroBandStyle} aria-labelledby="eval-title">
        <div>
          <p className={sectionEyebrowStyle}>Eval matrix</p>
          <h2 className={sectionTitleStyle} id="eval-title">
            {demoEvalRun.status}
          </h2>
          <p className={sectionTextStyle}>
            Threshold {Math.round(demoEvalRun.pass_threshold * 100)}%, zero must-pass failures required.
          </p>
        </div>
        <button className={primaryButtonStyle} type="button" onClick={() => onNavigate("/app/reports/report_demo_support")}>
          Review report
        </button>
      </section>

      <section className={tableWrapStyle} aria-label="Eval matrix results">
        <table className={tableStyle}>
          <thead>
            <tr>
              <th scope="col">Candidate</th>
              <th scope="col">Model</th>
              <th scope="col">Risk</th>
              <th scope="col">Pass rate</th>
              <th scope="col">Must-pass failures</th>
              <th scope="col">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {demoEvalResults.map((result) => (
              <tr key={result.id}>
                <td>{formatCandidateId(result.candidate_id)}</td>
                <td>{result.model_id}</td>
                <td>{result.risk_level}</td>
                <td>{Math.round(result.pass_rate * 100)}%</td>
                <td>{result.must_pass_failures}</td>
                <td>{result.verdict}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <StatusNotice
        tone="warn"
        title="Recommendation gate"
        body="Production recommendation remains blocked until the threshold passes and must-pass failures are zero."
      />
    </div>
  );
}

function ReportScreen({ onNavigate }: { onNavigate: NavigateHandler }) {
  return (
    <div className={contentStackStyle}>
      <section className={heroBandStyle} aria-labelledby="report-title">
        <div>
          <p className={sectionEyebrowStyle}>Recommendation report</p>
          <h2 className={sectionTitleStyle} id="report-title">
            Production blocked
          </h2>
          <p className={sectionTextStyle}>
            The report reserves one winner, one cheaper alternative, and one stronger fallback after eval proof.
          </p>
        </div>
        <button className={primaryButtonStyle} type="button" onClick={() => onNavigate("/app/reports/report_demo_support/export")}>
          Export
        </button>
      </section>

      <section className={splitGridStyle} aria-label="Report summary">
        <RiskSummary />
        <SavingsSummary />
      </section>

      <section className={decisionGridStyle} aria-label="Decision slots">
        <DecisionCard title="Winner" body="Pending until eval threshold passes." />
        <DecisionCard title="Cheaper alternative" body="Pending verified costs and zero must-pass failures." />
        <DecisionCard title="Stronger fallback" body="Pending quality proof against the baseline." />
      </section>

      <section className={listPanelStyle} aria-label="Production blockers">
        <h3 className={panelTitleStyle}>Production blockers</h3>
        <ul className={plainListStyle}>
          {demoReport.production_blockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ExportScreen() {
  return (
    <div className={contentStackStyle}>
      <section className={heroBandStyle} aria-labelledby="export-title">
        <div>
          <p className={sectionEyebrowStyle}>Deploy package export</p>
          <h2 className={sectionTitleStyle} id="export-title">
            Redacted by default
          </h2>
          <p className={sectionTextStyle}>Exports stay blocked from production claims until the report decision is allowed.</p>
        </div>
        <StatusBadge label="Report" value={demoReport.status} tone="warn" />
      </section>

      <section className={cardGridStyle} aria-label="Export artifacts">
        {demoReportArtifacts.map((artifact) => (
          <article className={testCardStyle} key={artifact.id}>
            <p className={cardKickerStyle}>{artifact.redaction_state}</p>
            <h3 className={cardTitleStyle}>{artifact.format.toUpperCase()}</h3>
            <p className={cardTextStyle}>{artifact.storage_uri}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

export function ExpertControls({
  appState,
  updateAppState
}: {
  appState: PublicAppState;
  updateAppState: (next: Partial<PublicAppState>) => void;
}) {
  return (
    <section className={expertPanelStyle} aria-label="Expert controls">
      <div>
        <p className={sectionEyebrowStyle}>Expert controls</p>
        <h2 className={compactTitleStyle}>Constraints and guardrails</h2>
      </div>
      <div className={expertGridStyle}>
        <Field label="Max latency">
          <input className={fieldControlStyle} placeholder="unset" type="text" />
        </Field>
        <Field label="Structured output">
          <select className={fieldControlStyle} defaultValue="required">
            <option value="required">Required</option>
            <option value="optional">Optional</option>
          </select>
        </Field>
        <Field label="Pass threshold">
          <input
            className={fieldControlStyle}
            max={1}
            min={0}
            step={0.01}
            type="number"
            value={appState.passThreshold}
            onChange={(event) => updateAppState({ passThreshold: Number(event.target.value) })}
          />
        </Field>
      </div>
    </section>
  );
}

function NotFoundScreen({ onNavigate, path }: { onNavigate: NavigateHandler; path: string }) {
  return (
    <section className={emptyStateStyle}>
      <h2 className={sectionTitleStyle}>Route unavailable</h2>
      <p className={sectionTextStyle}>{path} is not part of the current public shell.</p>
      <button className={primaryButtonStyle} type="button" onClick={() => onNavigate("/app")}>
        Return to app
      </button>
    </section>
  );
}
