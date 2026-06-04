import { demoAudit, demoReport } from "../mockData";
import { formatModelFit } from "../formatters";
import {
  panelTitleStyle,
  plainListStyle,
  sectionEyebrowStyle,
  sectionTextStyle,
  summaryPanelStyle
} from "../styles";

export function RiskSummary() {
  return (
    <section className={summaryPanelStyle} aria-label="Risk summary">
      <p className={sectionEyebrowStyle}>Risk</p>
      <h3 className={panelTitleStyle}>{demoAudit.riskLevel} risk before savings</h3>
      <ul className={plainListStyle}>
        {demoReport.risk_summary.map((risk) => (
          <li key={risk}>{risk}</li>
        ))}
      </ul>
    </section>
  );
}

export function SavingsSummary() {
  return (
    <section className={summaryPanelStyle} aria-label="Savings summary">
      <p className={sectionEyebrowStyle}>Savings</p>
      <h3 className={panelTitleStyle}>Blocked until eval proof</h3>
      <p className={sectionTextStyle}>
        Savings estimates require verified registry metadata and passing eval results.
      </p>
    </section>
  );
}

function ModelFitPanel() {
  return (
    <section className={summaryPanelStyle} aria-label="Model fit">
      <p className={sectionEyebrowStyle}>Model fit</p>
      <h3 className={panelTitleStyle}>{formatModelFit(demoAudit.modelFit)}</h3>
      <p className={sectionTextStyle}>{demoAudit.wasteFindings[0]}</p>
    </section>
  );
}

export default ModelFitPanel;
