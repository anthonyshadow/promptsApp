import { css } from "@emotion/css";
import StatusBadge from "../../components/StatusBadge";
import { demoReport, demoReportArtifacts } from "../../mockData";
import {
  cardGridStyle,
  cardKickerStyle,
  cardTextStyle,
  cardTitleStyle,
  contentStackStyle,
  heroBandStyle,
  sectionEyebrowStyle,
  sectionTextStyle,
  sectionTitleStyle
} from "../../styles";

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

export default ExportScreen;

const testCardStyle = css({
  minHeight: "150px",
  border: "1px solid #d7d6ca",
  borderRadius: "8px",
  background: "#fffef9",
  padding: "16px"
});
