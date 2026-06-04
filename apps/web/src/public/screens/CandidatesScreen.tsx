import { css } from "@emotion/css";
import StatusBadge from "../../components/StatusBadge";
import { formatStrategy } from "../../formatters";
import { demoCandidates, type PublicAppState } from "../../mockData";
import {
  cardGridStyle,
  cardTextStyle,
  cardTitleStyle,
  checkboxLabelStyle,
  checkboxStyle,
  contentStackStyle,
  heroBandStyle,
  sectionEyebrowStyle,
  sectionTextStyle,
  sectionTitleStyle
} from "../../styles";

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

export default CandidatesScreen;

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
