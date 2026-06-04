import { RiskSummary, SavingsSummary } from "../../components/SummaryPanels";
import { formatProvider, getStepCardTitle } from "../../formatters";
import { demoProject, type PublicAppState } from "../../mockData";
import { stepperItems } from "../../routes";
import {
  cardGridStyle,
  contentStackStyle,
  heroBandStyle,
  loopCardLabelStyle,
  loopCardStyle,
  loopCardTitleStyle,
  primaryButtonStyle,
  sectionEyebrowStyle,
  sectionTextStyle,
  sectionTitleStyle,
  splitGridStyle
} from "../../styles";
import type { NavigateHandler } from "../../viewTypes";

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

export default WorkspaceScreen;
