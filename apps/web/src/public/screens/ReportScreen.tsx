import DecisionCard from "../../components/DecisionCard";
import { RiskSummary, SavingsSummary } from "../../components/SummaryPanels";
import { demoReport } from "../../mockData";
import {
  contentStackStyle,
  decisionGridStyle,
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

export default ReportScreen;
