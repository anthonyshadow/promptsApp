import { css } from "@emotion/css";
import Field from "../components/Field";
import type { PublicAppState } from "../mockData";
import {
  compactTitleStyle,
  fieldControlStyle,
  sectionEyebrowStyle
} from "../styles";

function ExpertControls({
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

export default ExpertControls;

const expertPanelStyle = css({
  display: "grid",
  gap: "16px",
  marginTop: "48px",
  borderTop: "1px solid #d7d6ca",
  paddingTop: "22px"
});

const expertGridStyle = css({
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "12px",
  "@media (max-width: 820px)": {
    gridTemplateColumns: "1fr"
  }
});
