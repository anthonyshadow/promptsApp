import { useEffect, useState } from "react";
import { css } from "@emotion/css";
import type { CandidateStrategy, OptimizationCandidate, RiskLevel } from "@promptopts/shared";
import StatusBadge from "../../components/StatusBadge";
import StatusNotice from "../../components/StatusNotice";
import type { PromptOptsApiClient } from "../../apiClient";
import { formatStrategy } from "../../formatters";
import { demoCandidates, demoPromptVersion, type PublicAppState } from "../../mockData";
import {
  cardGridStyle,
  cardTextStyle,
  checkboxLabelStyle,
  checkboxStyle,
  contentStackStyle,
  heroBandStyle,
  listPanelStyle,
  panelTitleStyle,
  plainListStyle,
  primaryButtonStyle,
  sectionEyebrowStyle,
  sectionTextStyle,
  sectionTitleStyle,
  splitGridStyle
} from "../../styles";
import type { NavigateHandler } from "../../viewTypes";

function CandidatesScreen({
  apiClient,
  appState,
  onNavigate,
  projectId,
  updateAppState
}: {
  apiClient: PromptOptsApiClient | null;
  appState: PublicAppState;
  onNavigate: NavigateHandler;
  projectId: string;
  updateAppState: (next: Partial<PublicAppState>) => void;
}) {
  const [candidateState, setCandidateState] = useState<{
    candidates: CandidateView[];
    message: string;
    status: "loading" | "ready" | "local" | "error";
  }>(() => ({
    candidates: createDemoCandidateViews(),
    message: apiClient
      ? "Generating deterministic prompt candidates."
      : "Local demo candidates; configure VITE_API_URL to persist candidates.",
    status: apiClient ? "loading" : "local"
  }));
  const [activeCandidateId, setActiveCandidateId] = useState(candidateState.candidates[0]?.id ?? "");
  const activeCandidate =
    candidateState.candidates.find((candidate) => candidate.id === activeCandidateId) ??
    candidateState.candidates[0];

  useEffect(() => {
    let isMounted = true;

    async function loadCandidates() {
      if (!apiClient) {
        const candidates = createDemoCandidateViews();

        setCandidateState({
          candidates,
          message: "Local demo candidates; configure VITE_API_URL to persist candidates.",
          status: "local"
        });
        setActiveCandidateId(candidates[0]?.id ?? "");
        return;
      }

      setCandidateState((current) => ({
        ...current,
        message: "Generating deterministic candidate risk profiles.",
        status: "loading"
      }));

      try {
        const response = await apiClient.optimizePrompt(appState.promptId, {
          analysis_id: null,
          strategies: ["conservative", "balanced", "aggressive", "output_lite", "model_specific"]
        });

        if (!isMounted) {
          return;
        }

        const candidates = response.candidates.map(mapOptimizationCandidateToView);

        setCandidateState({
          candidates,
          message: "Candidates generated. Selected candidates remain provisional until evals pass.",
          status: "ready"
        });
        setActiveCandidateId(candidates[0]?.id ?? "");
        updateAppState({ selectedCandidateIds: candidates.map((candidate) => candidate.id) });
      } catch {
        if (isMounted) {
          const candidates = createDemoCandidateViews();

          setCandidateState({
            candidates,
            message: "Candidate API failed; showing local demo candidates.",
            status: "error"
          });
          setActiveCandidateId(candidates[0]?.id ?? "");
        }
      }
    }

    void loadCandidates();

    return () => {
      isMounted = false;
    };
  }, [apiClient, appState.promptId]);

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

      <StatusNotice
        tone={candidateState.status === "ready" || candidateState.status === "local" ? "good" : "warn"}
        title="Candidate status"
        body={`${candidateState.message} Aggressive is an experiment, not a recommendation.`}
      />

      <section className={cardGridStyle} aria-label="Candidate set">
        {candidateState.candidates.map((candidate) => {
          const checked = appState.selectedCandidateIds.includes(candidate.id);

          return (
            <article className={candidateCardStyle} key={candidate.id}>
              <div className={candidateHeaderStyle}>
                <span className={riskPillStyle}>{candidate.riskLabel} risk</span>
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
              <button className={candidateTitleButtonStyle} type="button" onClick={() => setActiveCandidateId(candidate.id)}>
                {candidate.label || formatStrategy(candidate.strategy)}
              </button>
              <p className={cardTextStyle}>{candidate.rationale}</p>
              <p className={metricLineStyle}>
                Input {candidate.estimatedInputTokens.toLocaleString()} tokens / output{" "}
                {candidate.estimatedOutputTokens.toLocaleString()} tokens / delta {candidate.tokenDelta}%
              </p>
            </article>
          );
        })}
      </section>

      {activeCandidate ? (
        <section className={splitGridStyle} aria-label="Candidate visual diff">
          <section className={listPanelStyle}>
            <h3 className={panelTitleStyle}>Removed or compressed text</h3>
            <ul className={plainListStyle}>
              {activeCandidate.removedOrCompressedElements.map((item) => (
                <li className={removedTextStyle} key={item}>
                  {item}
                </li>
              ))}
            </ul>
          </section>
          <section className={listPanelStyle}>
            <h3 className={panelTitleStyle}>Rewritten text</h3>
            <pre className={rewrittenTextStyle}>{activeCandidate.promptText}</pre>
          </section>
          <section className={listPanelStyle}>
            <h3 className={panelTitleStyle}>Preserved constraints</h3>
            <ul className={plainListStyle}>
              {activeCandidate.preservedConstraints.map((constraint) => (
                <li className={preservedTextStyle} key={constraint}>
                  {constraint}
                </li>
              ))}
            </ul>
          </section>
        </section>
      ) : null}

      <div className={actionRowStyle}>
        <button
          className={primaryButtonStyle}
          disabled={appState.selectedCandidateIds.length === 0}
          type="button"
          onClick={() => onNavigate(`/app/projects/${projectId}/models`)}
        >
          Send selected to model shortlist
        </button>
      </div>
    </div>
  );
}

export default CandidatesScreen;

type CandidateView = {
  id: string;
  label: string;
  strategy: CandidateStrategy;
  promptText: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  riskLabel: RiskLevel;
  tokenDelta: number;
  rationale: string;
  preservedConstraints: string[];
  removedOrCompressedElements: string[];
};

function mapOptimizationCandidateToView(candidate: OptimizationCandidate): CandidateView {
  return {
    id: candidate.id,
    label: candidate.label,
    strategy: candidate.strategy,
    promptText: candidate.candidate_prompt_text,
    estimatedInputTokens: candidate.estimated_input_tokens,
    estimatedOutputTokens: candidate.estimated_output_tokens,
    riskLabel: candidate.risk_level,
    tokenDelta: candidate.expected_token_delta,
    rationale: candidate.rationale,
    preservedConstraints: candidate.preserved_constraints,
    removedOrCompressedElements: candidate.removed_or_compressed_elements
  };
}

function createDemoCandidateViews(): CandidateView[] {
  return demoCandidates.map((candidate): CandidateView => ({
    id: candidate.id,
    label: formatStrategy(candidate.strategy),
    strategy: candidate.strategy,
    promptText: demoPromptVersion.prompt_text,
    estimatedInputTokens: 38 + Math.abs(candidate.tokenDelta),
    estimatedOutputTokens: Math.max(40, 140 + candidate.tokenDelta),
    riskLabel: candidate.risk,
    tokenDelta: candidate.tokenDelta,
    rationale: candidate.summary,
    preservedConstraints: [
      "Preserve exact urgency labels.",
      "Return JSON with category, urgency, summary, and suggested_reply.",
      "Keep {{customer_message}} represented."
    ],
    removedOrCompressedElements:
      candidate.strategy === "baseline"
        ? ["None; baseline remains unchanged for regression proof."]
        : ["Compressed repeated wording while preserving quality-contract constraints."]
  }));
}

const candidateCardStyle = css({
  minHeight: "190px",
  border: "1px solid #d7d6ca",
  borderRadius: "8px",
  background: "#fffef9",
  padding: "16px"
});

const candidateHeaderStyle = css({
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "center",
  marginBottom: "14px"
});

const riskPillStyle = css({
  border: "1px solid #caa463",
  borderRadius: "999px",
  background: "#fff4dc",
  color: "#6d4a11",
  padding: "4px 8px",
  fontSize: "0.78rem",
  fontWeight: 700
});

const metricLineStyle = css({
  margin: "14px 0 0",
  color: "#263128",
  fontWeight: 700
});

const candidateTitleButtonStyle = css({
  margin: 0,
  border: 0,
  background: "transparent",
  color: "#141915",
  padding: 0,
  fontSize: "1.05rem",
  fontWeight: 800,
  lineHeight: 1.3,
  textAlign: "left",
  ":focus-visible": {
    outline: "2px solid #6b8cff",
    outlineOffset: "3px"
  }
});

const actionRowStyle = css({
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  "@media (max-width: 640px)": {
    display: "grid"
  }
});

const removedTextStyle = css({
  color: "#7b351d",
  textDecoration: "line-through",
  textDecorationThickness: "2px"
});

const rewrittenTextStyle = css({
  margin: 0,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  color: "#1f2421",
  lineHeight: 1.55,
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
});

const preservedTextStyle = css({
  color: "#235229",
  fontWeight: 700
});
