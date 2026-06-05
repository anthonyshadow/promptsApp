import { useEffect, useMemo, useState } from "react";
import { css } from "@emotion/css";
import type { WorkspaceDashboardResponse } from "@promptopts/api";
import StatusBadge from "../../components/StatusBadge";
import StatusNotice from "../../components/StatusNotice";
import type { PromptOptsApiClient } from "../../apiClient";
import { formatModelFit, formatProvider, getStepCardTitle } from "../../formatters";
import {
  demoAudit,
  demoEvalResults,
  demoEvalRun,
  demoPrompt,
  demoProject,
  demoReport,
  demoWorkspace,
  type PublicAppState
} from "../../mockData";
import { stepperItems } from "../../routes";
import {
  cardKickerStyle,
  contentStackStyle,
  heroBandStyle,
  loopCardLabelStyle,
  loopCardStyle,
  loopCardTitleStyle,
  primaryButtonStyle,
  sectionEyebrowStyle,
  sectionTextStyle,
  sectionTitleStyle,
  tableStyle,
  tableSubtextStyle,
  tableWrapStyle
} from "../../styles";
import type { NavigateHandler } from "../../viewTypes";

function WorkspaceScreen({
  apiClient,
  appState,
  onNavigate,
  workspaceSlug = demoWorkspace.slug
}: {
  apiClient: PromptOptsApiClient | null;
  appState: PublicAppState;
  onNavigate: NavigateHandler;
  workspaceSlug?: string;
}) {
  const localDashboard = useMemo(() => createLocalDashboard(appState), [appState]);
  const [dashboardState, setDashboardState] = useState<{
    dashboard: WorkspaceDashboardResponse;
    status: "local" | "loading" | "ready" | "error";
    message: string;
  }>(() => ({
    dashboard: localDashboard,
    status: apiClient ? "loading" : "local",
    message: apiClient
      ? "Loading workspace dashboard."
      : "Local demo dashboard; configure VITE_API_URL to aggregate persisted projects and evals."
  }));
  const dashboard = dashboardState.dashboard;

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      if (!apiClient) {
        setDashboardState({
          dashboard: localDashboard,
          status: "local",
          message: "Local demo dashboard; configure VITE_API_URL to aggregate persisted projects and evals."
        });
        return;
      }

      try {
        const nextDashboard = await apiClient.getWorkspaceDashboard(workspaceSlug);

        if (!isMounted) {
          return;
        }

        setDashboardState({
          dashboard: nextDashboard,
          status: "ready",
          message:
            "Workspace dashboard aggregates projects, prompt versions, evals, reports, and usage estimates."
        });
      } catch {
        if (isMounted) {
          setDashboardState({
            dashboard: localDashboard,
            status: "error",
            message: "Dashboard API failed; showing local demo aggregates."
          });
        }
      }
    }

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [apiClient, localDashboard, workspaceSlug]);

  return (
    <div className={contentStackStyle}>
      <section className={heroBandStyle} aria-labelledby="workspace-title">
        <div>
          <p className={sectionEyebrowStyle}>{dashboard.workspace.name}</p>
          <h2 className={sectionTitleStyle} id="workspace-title">
            Workspace dashboard
          </h2>
          <p className={sectionTextStyle}>
            Risk gates stay ahead of savings: only eval-backed reports with fresh registry metadata count as verified.
          </p>
        </div>
        <button className={primaryButtonStyle} type="button" onClick={() => onNavigate("/audit")}>
          New audit
        </button>
      </section>

      <StatusNotice
        tone={dashboardState.status === "error" ? "warn" : "good"}
        title="Dashboard scope"
        body={dashboardState.message}
      />

      <section className={metricGridStyle} aria-label="Workspace metrics">
        <article className={metricCardStyle}>
          <p className={cardKickerStyle}>Verified monthly savings</p>
          <strong className={metricValueStyle}>
            {formatSavings(dashboard.metrics.verified_monthly_savings_usd)}
          </strong>
          <span className={metricNoteStyle}>{dashboard.metrics.verified_savings_note}</span>
        </article>
        <article className={metricCardStyle}>
          <p className={cardKickerStyle}>Prompts optimized</p>
          <strong className={metricValueStyle}>{dashboard.metrics.prompts_optimized}</strong>
          <span className={metricNoteStyle}>Prompts with non-baseline candidates ready for eval review.</span>
        </article>
        <article className={metricCardStyle}>
          <p className={cardKickerStyle}>Eval pass average</p>
          <strong className={metricValueStyle}>{formatPercent(dashboard.metrics.eval_pass_average)}</strong>
          <span className={metricNoteStyle}>Average across visible eval rows, including failed combos.</span>
        </article>
        <article className={metricCardStyle}>
          <p className={cardKickerStyle}>Models flagged</p>
          <strong className={metricValueStyle}>{dashboard.metrics.models_flagged}</strong>
          <span className={metricNoteStyle}>Current models with overpowered or underpowered audit fit.</span>
        </article>
      </section>

      <section className={tableSectionStyle} aria-label="Recent projects">
        <div className={sectionHeaderStyle}>
          <div>
            <p className={sectionEyebrowStyle}>Recent projects</p>
            <h3 className={sectionTitleStyle}>Projects, evals, reports, and status</h3>
          </div>
          <StatusBadge label="Rows" value={String(dashboard.recent_projects.length)} tone="neutral" />
        </div>
        <div className={tableWrapStyle}>
          <table className={tableStyle}>
            <thead>
              <tr>
                <th>Prompt/project</th>
                <th>Provider</th>
                <th>Fit</th>
                <th>Savings</th>
                <th>Last eval</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.recent_projects.map((project) => (
                <tr key={project.project_id}>
                  <td>
                    <strong>{project.project_name}</strong>
                    <span className={tableSubtextStyle}>{project.prompt_name ?? "Prompt pending"}</span>
                  </td>
                  <td>
                    {formatProvider(project.provider)}
                    <span className={tableSubtextStyle}>{project.current_model_id}</span>
                  </td>
                  <td>{project.fit ? formatModelFit(project.fit) : "Pending"}</td>
                  <td>
                    {formatSavings(project.savings_usd)}
                    <span className={tableSubtextStyle}>{formatSavingsStatus(project.savings_status)}</span>
                  </td>
                  <td>{formatDate(project.last_eval_at)}</td>
                  <td>
                    <span className={getStatusPillStyle(project.status)}>{project.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={loopGridStyle} aria-label="Product loop">
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

function createLocalDashboard(appState: PublicAppState): WorkspaceDashboardResponse {
  const averagePassRate =
    demoEvalResults.length > 0
      ? demoEvalResults.reduce((sum, result) => sum + result.pass_rate, 0) / demoEvalResults.length
      : null;

  return {
    workspace: demoWorkspace,
    metrics: {
      verified_monthly_savings_usd: null,
      verified_savings_note:
        "No verified monthly savings yet; savings require passing evals and fresh registry metadata.",
      prompts_optimized: 1,
      eval_pass_average: averagePassRate,
      models_flagged: demoAudit.modelFit === "appropriate" ? 0 : 1
    },
    recent_projects: [
      {
        project_id: appState.projectId,
        project_name: appState.projectName || demoProject.name,
        prompt_id: appState.promptId,
        prompt_name: demoPrompt.name,
        provider: appState.provider,
        current_model_id: appState.currentModelId,
        fit: demoAudit.modelFit,
        savings_usd: null,
        savings_status: demoReport.production_recommendation_allowed ? "unverified" : "blocked",
        last_eval_at: demoEvalRun.completed_at ?? demoEvalRun.started_at ?? demoEvalRun.queued_at,
        status: "failed"
      }
    ],
    notes: [
      "Dashboard is limited to projects, prompt versions, evals, reports, usage estimates, and status.",
      "Unverified registry metadata blocks exact savings claims."
    ]
  };
}

function formatSavings(value: number | null): string {
  if (value === null) {
    return "Not verified";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function formatPercent(value: number | null): string {
  if (value === null) {
    return "Pending";
  }

  return `${Math.round(value * 100)}%`;
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Pending";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function formatSavingsStatus(status: WorkspaceDashboardResponse["recent_projects"][number]["savings_status"]) {
  switch (status) {
    case "verified":
      return "Verified by eval report";
    case "unverified":
      return "Unverified registry data";
    case "blocked":
      return "Blocked until eval proof";
    case "not_available":
      return "No estimate available";
  }
}

function getStatusColor(status: WorkspaceDashboardResponse["recent_projects"][number]["status"]) {
  switch (status) {
    case "deployed":
      return { border: "#88b078", background: "#edf8e8", color: "#1f4b1d" };
    case "ready":
      return { border: "#95b38d", background: "#f1faee", color: "#274724" };
    case "review":
      return { border: "#c8b76d", background: "#fff8d8", color: "#66520d" };
    case "fallback":
      return { border: "#b6a0cf", background: "#f4eefb", color: "#4b2f6e" };
    case "failed":
      return { border: "#d49b8e", background: "#fff0ec", color: "#7c2b1d" };
  }
}

const metricGridStyle = css({
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "12px",
  "@media (max-width: 1040px)": {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))"
  },
  "@media (max-width: 620px)": {
    gridTemplateColumns: "1fr"
  }
});

const metricCardStyle = css({
  minHeight: "156px",
  border: "1px solid #d7d6ca",
  borderRadius: "8px",
  background: "#fffef9",
  padding: "16px"
});

const metricValueStyle = css({
  display: "block",
  color: "#111713",
  fontSize: "1.7rem",
  lineHeight: 1.15
});

const metricNoteStyle = css({
  display: "block",
  marginTop: "10px",
  color: "#59615b",
  fontSize: "0.88rem",
  lineHeight: 1.45
});

const tableSectionStyle = css({
  display: "grid",
  gap: "12px"
});

const sectionHeaderStyle = css({
  display: "flex",
  justifyContent: "space-between",
  gap: "14px",
  alignItems: "end",
  "@media (max-width: 620px)": {
    display: "grid",
    alignItems: "start"
  }
});

const loopGridStyle = css({
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "12px",
  "@media (max-width: 1080px)": {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))"
  },
  "@media (max-width: 640px)": {
    gridTemplateColumns: "1fr"
  }
});

const getStatusPillStyle = (status: WorkspaceDashboardResponse["recent_projects"][number]["status"]) =>
  css({
    display: "inline-flex",
    alignItems: "center",
    minHeight: "26px",
    border: "1px solid",
    borderColor: getStatusColor(status).border,
    borderRadius: "999px",
    background: getStatusColor(status).background,
    color: getStatusColor(status).color,
    padding: "0 9px",
    fontSize: "0.78rem",
    fontWeight: 800,
    textTransform: "capitalize"
  });
