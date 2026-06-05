import { useEffect, useMemo, useState } from "react";
import { css } from "@emotion/css";
import type { ReportDetailResponse } from "@promptopts/api";
import { costQualityFrontier, decideRecommendation } from "@promptopts/eval-core";
import type { EvalResult } from "@promptopts/shared";
import DecisionCard from "../../components/DecisionCard";
import StatusBadge from "../../components/StatusBadge";
import StatusNotice from "../../components/StatusNotice";
import type { PromptOptsApiClient } from "../../apiClient";
import { formatCandidateId } from "../../formatters";
import {
  demoEvalResults,
  demoEvalRun,
  demoReport,
  demoTestCases,
  type PublicAppState
} from "../../mockData";
import {
  cardGridStyle,
  cardKickerStyle,
  cardTextStyle,
  cardTitleStyle,
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
  splitGridStyle,
  summaryPanelStyle,
  tableSubtextStyle
} from "../../styles";
import type { NavigateHandler } from "../../viewTypes";

function ReportScreen({
  apiClient,
  appState,
  onNavigate,
  reportId
}: {
  apiClient: PromptOptsApiClient | null;
  appState: PublicAppState;
  onNavigate: NavigateHandler;
  reportId: string;
}) {
  const [detailState, setDetailState] = useState<{
    detail: ReportDetailResponse;
    status: "local" | "loading" | "ready" | "error";
    message: string;
  }>(() => ({
    detail: createLocalReportDetail(),
    status: apiClient && reportId !== demoReport.id ? "loading" : "local",
    message:
      apiClient && reportId !== demoReport.id
        ? "Loading recommendation report."
        : "Local demo report; generate a persisted report from the eval matrix when VITE_API_URL is configured."
  }));
  const detail = detailState.detail;
  const winner = useMemo(
    () => findResult(detail.results, detail.report.winner_result_id),
    [detail.report.winner_result_id, detail.results]
  );
  const cheaper = useMemo(
    () => findResult(detail.results, detail.report.cheaper_alternative_result_id),
    [detail.report.cheaper_alternative_result_id, detail.results]
  );
  const fallback = useMemo(
    () => findResult(detail.results, detail.report.stronger_fallback_result_id),
    [detail.report.stronger_fallback_result_id, detail.results]
  );

  useEffect(() => {
    let isMounted = true;

    async function loadReport() {
      if (!apiClient || reportId === demoReport.id) {
        setDetailState({
          detail: createLocalReportDetail(),
          status: "local",
          message: "Local demo report; generate a persisted report from the eval matrix when VITE_API_URL is configured."
        });
        return;
      }

      try {
        const nextDetail = await apiClient.getReport(reportId);

        if (!isMounted) {
          return;
        }

        setDetailState({
          detail: nextDetail,
          status: "ready",
          message: nextDetail.report.production_recommendation_allowed
            ? "Report decision is ready; review risk notes before deployment."
            : "Report generated a no-switch or blocked decision."
        });
      } catch {
        if (isMounted) {
          setDetailState({
            detail: createLocalReportDetail(),
            status: "error",
            message: "Report API detail failed; showing local demo report."
          });
        }
      }
    }

    void loadReport();

    return () => {
      isMounted = false;
    };
  }, [apiClient, reportId]);

  return (
    <div className={contentStackStyle}>
      <section className={heroBandStyle} aria-labelledby="report-title">
        <div>
          <p className={sectionEyebrowStyle}>Recommendation report</p>
          <h2 className={sectionTitleStyle} id="report-title">
            {detail.report.production_recommendation_allowed ? "Decision ready" : "No-switch guardrails active"}
          </h2>
          <p className={sectionTextStyle}>
            The report makes the decision: one winner, one cheaper alternative, one stronger fallback, with risk before savings.
          </p>
        </div>
        <div className={heroActionsStyle}>
          <StatusBadge label="Report" value={detail.report.status} tone={detail.report.status === "ready" ? "good" : "warn"} />
          <button
            className={primaryButtonStyle}
            type="button"
            onClick={() => onNavigate(`/app/reports/${detail.report.id}/export`)}
          >
            Export package
          </button>
        </div>
      </section>

      <StatusNotice
        tone={detailState.status === "error" || !detail.report.production_recommendation_allowed ? "warn" : "good"}
        title="Report state"
        body={detailState.message}
      />

      <section className={listPanelStyle} aria-label="Risk notes">
        <h3 className={panelTitleStyle}>Risk notes</h3>
        <ul className={plainListStyle}>
          {detail.report.risk_summary.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>

      <section className={splitGridStyle} aria-label="Recommended setup">
        <section className={summaryPanelStyle}>
          <p className={cardKickerStyle}>Recommended setup</p>
          <h3 className={cardTitleStyle}>{formatResultTitle(winner)}</h3>
          <p className={cardTextStyle}>{formatResultMeta(winner)}</p>
        </section>
        <section className={summaryPanelStyle}>
          <p className={cardKickerStyle}>Pass rate</p>
          <h3 className={cardTitleStyle}>{formatPercent(winner?.pass_rate ?? 0)}</h3>
          <p className={cardTextStyle}>Threshold {formatPercent(detail.eval_run.pass_threshold)} with zero must-pass failures.</p>
        </section>
        <section className={summaryPanelStyle}>
          <p className={cardKickerStyle}>Savings estimate</p>
          <h3 className={cardTitleStyle}>{detail.report.registry_freshness === "fresh" ? "Verified estimate" : "Unverified estimate"}</h3>
          <p className={cardTextStyle}>{detail.report.savings_summary ?? "No verified savings estimate is available."}</p>
        </section>
        <section className={summaryPanelStyle}>
          <p className={cardKickerStyle}>Latency</p>
          <h3 className={cardTitleStyle}>{winner?.latency_ms === null || !winner ? "Pending" : `${winner.latency_ms}ms`}</h3>
          <p className={cardTextStyle}>Latency stays part of the route decision, not a hidden benchmark detail.</p>
        </section>
      </section>

      <section className={decisionGridStyle} aria-label="Decision slots">
        <DecisionCard title="Winner" body={formatDecisionBody(winner, "Default route after eval gates pass.")} />
        <DecisionCard title="Cheaper alternative" body={formatDecisionBody(cheaper, "Use only for low-risk traffic after review.")} />
        <DecisionCard title="Stronger fallback" body={formatDecisionBody(fallback, "Use for escalations, ambiguity, or low confidence.")} />
      </section>

      <section className={cardGridStyle} aria-label="Deployment routing">
        <article className={routeCardStyle}>
          <p className={cardKickerStyle}>Deployment routing</p>
          <h3 className={cardTitleStyle}>Default</h3>
          <p className={cardTextStyle}>{formatResultTitle(winner)}</p>
        </article>
        <article className={routeCardStyle}>
          <p className={cardKickerStyle}>Fallback</p>
          <h3 className={cardTitleStyle}>Escalations</h3>
          <p className={cardTextStyle}>{formatResultTitle(fallback)}</p>
        </article>
        <article className={routeCardStyle}>
          <p className={cardKickerStyle}>Rollback</p>
          <h3 className={cardTitleStyle}>Baseline remains</h3>
          <p className={cardTextStyle}>Keep original prompt and current model available until live monitoring exists.</p>
        </article>
        <article className={routeCardStyle}>
          <p className={cardKickerStyle}>Developer note</p>
          <h3 className={cardTitleStyle}>Eval snapshot</h3>
          <p className={cardTextStyle}>{detail.results.length} row(s) captured for report {detail.report.id}.</p>
        </article>
      </section>

      {detail.report.production_blockers.length > 0 ? (
        <section className={listPanelStyle} aria-label="Production blockers">
          <h3 className={panelTitleStyle}>Production blockers</h3>
          <ul className={plainListStyle}>
            {detail.report.production_blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={listPanelStyle} aria-label="Rejected combos">
        <h3 className={panelTitleStyle}>Rejected combos</h3>
        {detail.decision.rejectedCombos.length === 0 ? (
          <p className={tableSubtextStyle}>No rejected combos in the selected eval snapshot.</p>
        ) : (
          <ul className={plainListStyle}>
            {detail.decision.rejectedCombos.map((combo) => (
              <li key={combo.resultId}>
                {formatCandidateId(combo.candidateId)} on {combo.modelId}: {combo.reason}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={heroBandStyle} aria-label="Export actions">
        <div>
          <p className={sectionEyebrowStyle}>Exports</p>
          <h3 className={panelTitleStyle}>Redacted share package by default</h3>
          <p className={sectionTextStyle}>Markdown, JSON, and PDF stub exports preserve the eval snapshot and avoid raw prompt browsing.</p>
        </div>
        <button
          className={primaryButtonStyle}
          type="button"
          onClick={() => onNavigate(`/app/reports/${detail.report.id}/export`)}
        >
          Open exports
        </button>
      </section>
    </div>
  );
}

export default ReportScreen;

function createLocalReportDetail(): ReportDetailResponse {
  const decision = decideRecommendation({
    evalRunId: demoEvalRun.id,
    results: demoEvalResults,
    passThreshold: demoEvalRun.pass_threshold,
    testCaseCount: demoTestCases.length
  });

  return {
    report: {
      ...demoReport,
      status: decision.productionRecommendationAllowed ? "ready" : demoReport.status,
      winner_result_id: decision.winnerResultId,
      cheaper_alternative_result_id: decision.cheaperAlternativeResultId,
      stronger_fallback_result_id: decision.strongerFallbackResultId,
      risk_summary: decision.riskNotes,
      savings_summary: decision.savingsSummary,
      production_recommendation_allowed: decision.productionRecommendationAllowed,
      production_blockers: decision.productionBlockers,
      registry_freshness: decision.registryFreshness
    },
    eval_run: demoEvalRun,
    results: demoEvalResults,
    frontier_points: costQualityFrontier(demoEvalResults, {
      evalRunId: demoEvalRun.id,
      passThreshold: demoEvalRun.pass_threshold
    }),
    decision
  };
}

function findResult(results: EvalResult[], resultId: string | null): EvalResult | null {
  return resultId ? results.find((result) => result.id === resultId) ?? null : null;
}

function formatResultTitle(result: EvalResult | null): string {
  return result ? `${formatCandidateId(result.candidate_id)} on ${result.model_id}` : "No passing combo";
}

function formatResultMeta(result: EvalResult | null): string {
  if (!result) {
    return "Report recommends no switch until eval gates pass.";
  }

  return `${formatPercent(result.quality_score)} quality, ${formatCost(result)}, ${result.risk_level} risk.`;
}

function formatDecisionBody(result: EvalResult | null, fallbackCopy: string): string {
  if (!result) {
    return "No passing option is available for this slot yet.";
  }

  return `${formatResultTitle(result)}. ${fallbackCopy}`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatCost(result: EvalResult): string {
  if (result.estimated_cost_usd === null) {
    return result.cost_estimate_status === "unverified" ? "unverified cost" : "blocked cost";
  }

  const value = `$${result.estimated_cost_usd.toFixed(6)}`;

  return result.cost_estimate_status === "verified" ? value : `${value} unverified`;
}

const heroActionsStyle = css({
  display: "grid",
  gap: "10px",
  justifyItems: "end",
  "@media (max-width: 720px)": {
    justifyItems: "stretch"
  }
});

const routeCardStyle = css({
  minHeight: "150px",
  border: "1px solid #d7d6ca",
  borderRadius: "8px",
  background: "#fffef9",
  padding: "16px"
});
