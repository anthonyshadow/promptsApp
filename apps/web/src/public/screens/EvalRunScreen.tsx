import StatusNotice from "../../components/StatusNotice";
import { formatCandidateId } from "../../formatters";
import { demoEvalResults, demoEvalRun } from "../../mockData";
import {
  contentStackStyle,
  heroBandStyle,
  primaryButtonStyle,
  sectionEyebrowStyle,
  sectionTextStyle,
  sectionTitleStyle,
  tableStyle,
  tableWrapStyle
} from "../../styles";
import type { NavigateHandler } from "../../viewTypes";

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

export default EvalRunScreen;
