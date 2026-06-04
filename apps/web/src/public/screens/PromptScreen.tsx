import { useEffect, useMemo, useState } from "react";
import { css } from "@emotion/css";
import Field from "../../components/Field";
import StatusBadge from "../../components/StatusBadge";
import StatusNotice from "../../components/StatusNotice";
import type { PromptOptsApiClient } from "../../apiClient";
import { formatProvider, formatTaskType } from "../../formatters";
import {
  demoPrompt,
  demoPromptVersion,
  demoWorkspace,
  type PublicAppState
} from "../../mockData";
import { detectPromptVariables, estimatePromptTokens, splitPromptIntoSegments } from "../../promptView";
import {
  actionRowStyle,
  cardTextStyle,
  chipListStyle,
  chipStyle,
  contentStackStyle,
  heroBandStyle,
  listPanelStyle,
  metaGridStyle,
  panelTitleStyle,
  primaryButtonStyle,
  promptEditorGridStyle,
  promptTextareaStyle,
  sectionEyebrowStyle,
  sectionTextStyle,
  sectionTitleStyle
} from "../../styles";
import type { NavigateHandler } from "../../viewTypes";
import { formatPromptSaveState } from "./publicScreenHelpers";

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

export default PromptScreen;

const promptPreviewStyle = css({
  minHeight: "220px",
  overflow: "auto",
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  border: "1px solid #d7d6ca",
  borderRadius: "8px",
  background: "#fffef9",
  color: "#202722",
  padding: "14px",
  lineHeight: 1.55
});

const promptVariableStyle = css({
  borderRadius: "6px",
  background: "#e2f3d3",
  color: "#162015",
  padding: "1px 4px",
  fontWeight: 800
});
