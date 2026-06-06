import { useEffect, useState } from "react";
import { css } from "@emotion/css";
import type { AdminOverviewResponse } from "@promptopts/api";
import { fetchAdminJson } from "./adminApi";

function AdminOverviewScreen({ apiBaseUrl }: { apiBaseUrl?: string | undefined }) {
  const [overviewState, setOverviewState] = useState<{
    overview: AdminOverviewResponse;
    status: "local" | "loading" | "ready" | "error";
    message: string;
  }>(() => ({
    overview: createLocalAdminOverview(),
    status: apiBaseUrl ? "loading" : "local",
    message: apiBaseUrl
      ? "Loading redacted command-center metadata."
      : "Local redacted admin overview; configure VITE_API_URL to read /admin-api/overview."
  }));
  const overview = overviewState.overview;

  useEffect(() => {
    let isMounted = true;

    async function loadOverview() {
      if (!apiBaseUrl) {
        setOverviewState({
          overview: createLocalAdminOverview(),
          status: "local",
          message: "Local redacted admin overview; configure VITE_API_URL to read /admin-api/overview."
        });
        return;
      }

      try {
        const overview = await fetchAdminJson<AdminOverviewResponse>(
          `${apiBaseUrl}/admin-api/overview`
        );

        if (!isMounted) {
          return;
        }

        setOverviewState({
          overview,
          status: "ready",
          message: "Overview loaded through the guarded admin API with redacted metadata only."
        });
      } catch {
        if (isMounted) {
          setOverviewState({
            overview: createLocalAdminOverview(),
            status: "error",
            message: "Admin overview API failed; showing local redacted command-center metadata."
          });
        }
      }
    }

    void loadOverview();

    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl]);

  return (
    <div className={rootStyle}>
      <section className={headerPanelStyle} aria-labelledby="admin-overview-title">
        <div>
          <p className={eyebrowStyle}>Command center</p>
          <h2 className={titleStyle} id="admin-overview-title">
            Admin overview
          </h2>
          <p className={bodyTextStyle}>
            Operator metadata only: prompts, provider keys, and raw reports stay redacted.
          </p>
        </div>
        <span className={statePillStyle}>{overviewState.status}</span>
      </section>

      <section className={noticeStyle} aria-label="Overview status">
        {overviewState.message}
      </section>

      <section className={widgetGridStyle} aria-label="Admin KPI widgets">
        <article className={widgetStyle}>
          <p className={widgetLabelStyle}>MRR / trials / failed payments</p>
          <strong className={widgetValueStyle}>{formatMoney(overview.kpis.mrr_usd)}</strong>
          <span className={widgetMetaStyle}>
            {overview.kpis.trials} trial(s), {overview.kpis.failed_payments} failed payment(s)
          </span>
        </article>
        <article className={widgetStyle}>
          <p className={widgetLabelStyle}>Free audits and conversion</p>
          <strong className={widgetValueStyle}>{overview.kpis.free_audits}</strong>
          <span className={widgetMetaStyle}>
            {formatPercent(overview.kpis.free_audit_conversion_rate)} conversion, {overview.kpis.converted_accounts} converted account(s)
          </span>
        </article>
        <article className={widgetStyle}>
          <p className={widgetLabelStyle}>Eval jobs queued/running/failed/retrying</p>
          <strong className={widgetValueStyle}>
            {overview.kpis.eval_jobs.queued}/{overview.kpis.eval_jobs.running}/{overview.kpis.eval_jobs.failed}/{overview.kpis.eval_jobs.retrying}
          </strong>
          <span className={widgetMetaStyle}>Queue state is an operator surface.</span>
        </article>
        <article className={widgetStyle}>
          <p className={widgetLabelStyle}>Provider spend / usage ledger</p>
          <strong className={widgetValueStyle}>{formatMoney(overview.kpis.provider_spend_usd)}</strong>
          <span className={widgetMetaStyle}>{overview.kpis.usage_ledger_events} usage ledger event(s)</span>
        </article>
      </section>

      <section className={healthGridStyle} aria-label="API worker queue storage health">
        <HealthItem label="API" value={overview.health.api} />
        <HealthItem label="Eval worker" value={overview.health.eval_worker} />
        <HealthItem label="Report worker" value={overview.health.report_worker} />
        <HealthItem label="Queue" value={overview.health.queue} />
        <HealthItem label="Storage" value={overview.health.storage} />
        <HealthItem label="Admin auth" value={overview.health.admin_auth} />
      </section>

      <section className={twoColumnStyle}>
        <section className={panelStyle} aria-label="Risk queue">
          <div className={panelHeaderStyle}>
            <p className={eyebrowStyle}>Risk queue</p>
            <strong className={panelTitleStyle}>Needs operator review</strong>
          </div>
          <div className={riskListStyle}>
            {overview.risk_queue.map((risk) => (
              <a className={riskItemStyle} href={risk.link} key={risk.id}>
                <span className={riskSeverityStyle}>{risk.severity}</span>
                <strong>{risk.label}</strong>
                <span className={riskCountStyle}>{risk.count}</span>
                <span className={riskSummaryStyle}>{risk.redacted_summary}</span>
              </a>
            ))}
          </div>
        </section>

        <section className={panelStyle} aria-label="Live activity feed">
          <div className={panelHeaderStyle}>
            <p className={eyebrowStyle}>Live activity feed</p>
            <strong className={panelTitleStyle}>Redacted admin events</strong>
          </div>
          <div className={activityListStyle}>
            {overview.live_activity.map((activity) => (
              <a className={activityItemStyle} href={activity.link} key={activity.id}>
                <strong>{activity.label}</strong>
                <span>{activity.actor} · {activity.target}</span>
                <time dateTime={activity.timestamp}>{formatDate(activity.timestamp)}</time>
              </a>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}

export default AdminOverviewScreen;

function HealthItem({ label, value }: { label: string; value: string }) {
  return (
    <article className={healthItemStyle}>
      <span className={widgetLabelStyle}>{label}</span>
      <strong className={healthValueStyle}>{value}</strong>
    </article>
  );
}

function createLocalAdminOverview(): AdminOverviewResponse {
  return {
    kpis: {
      mrr_usd: null,
      trials: 0,
      failed_payments: 0,
      free_audits: 1,
      free_audit_conversion_rate: 1,
      converted_accounts: 1,
      eval_jobs: {
        queued: 1,
        running: 0,
        failed: 0,
        retrying: 0
      },
      provider_spend_usd: null,
      usage_ledger_events: 1,
      unverified_models: 5,
      reports: 1
    },
    health: {
      api: "ok",
      eval_worker: "mocked",
      report_worker: "mocked",
      queue: "mocked",
      storage: "mocked",
      repository: "memory",
      admin_auth: "mocked"
    },
    risk_queue: [
      {
        id: "risk_stale_model_prices",
        label: "Stale model prices",
        severity: "high",
        count: 5,
        link: "/__admin/model-registry",
        redacted_summary: "Model registry rows need verification before exact savings claims."
      },
      {
        id: "risk_failed_report_exports",
        label: "Failed report exports",
        severity: "medium",
        count: 1,
        link: "/__admin/reports",
        redacted_summary: "Report artifacts need storage/checksum confirmation."
      },
      {
        id: "risk_secret_scan_warnings",
        label: "Secret-scan warnings",
        severity: "low",
        count: 0,
        link: "/__admin/eval-jobs",
        redacted_summary: "No high-risk prompt analysis warnings are visible in metadata."
      },
      {
        id: "risk_deletion_requests",
        label: "Deletion requests",
        severity: "low",
        count: 0,
        link: "/__admin/reports",
        redacted_summary: "Deletion lifecycle jobs are not wired yet."
      }
    ],
    live_activity: [
      {
        id: "activity_registry_seed",
        label: "Model registry metadata seeded",
        actor: "admin_redacted",
        target: "model:target_redacted",
        timestamp: "2026-01-15T12:00:00.000Z",
        link: "/__admin/model-registry",
        redaction_state: "redacted"
      },
      {
        id: "activity_free_audit",
        label: "1 free audit signal captured",
        actor: "system",
        target: "account:rollup",
        timestamp: "2026-01-15T12:00:00.000Z",
        link: "/__admin/accounts",
        redaction_state: "redacted"
      }
    ],
    notes: [
      "Overview is redacted metadata only.",
      "Revenue, provider spend, queue, worker, and storage health are placeholders."
    ]
  };
}

function formatMoney(value: number | null): string {
  if (value === null) {
    return "Placeholder";
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

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

const rootStyle = css({
  display: "grid",
  gap: "18px",
  marginTop: "24px"
});

const headerPanelStyle = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: "18px",
  alignItems: "start",
  border: "1px solid #415149",
  borderRadius: "8px",
  background: "#17211d",
  padding: "22px",
  "@media (max-width: 720px)": {
    gridTemplateColumns: "1fr"
  }
});

const eyebrowStyle = css({
  margin: "0 0 8px",
  color: "#9fbaaa",
  fontSize: "0.76rem",
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: "uppercase"
});

const titleStyle = css({
  margin: 0,
  color: "#ffffff",
  fontSize: "1.75rem",
  lineHeight: 1.15,
  letterSpacing: 0
});

const bodyTextStyle = css({
  margin: "10px 0 0",
  color: "#c7d6ce",
  lineHeight: 1.55
});

const statePillStyle = css({
  border: "1px solid #6f8878",
  borderRadius: "999px",
  color: "#d8eadf",
  padding: "6px 10px",
  fontSize: "0.78rem",
  fontWeight: 800,
  textTransform: "capitalize"
});

const noticeStyle = css({
  border: "1px solid #3d4c43",
  borderRadius: "8px",
  background: "#111a16",
  color: "#cad9d0",
  padding: "14px 16px",
  lineHeight: 1.5
});

const widgetGridStyle = css({
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "12px",
  "@media (max-width: 1100px)": {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))"
  },
  "@media (max-width: 640px)": {
    gridTemplateColumns: "1fr"
  }
});

const widgetStyle = css({
  minHeight: "144px",
  border: "1px solid #3d4c43",
  borderRadius: "8px",
  background: "#101713",
  padding: "16px"
});

const widgetLabelStyle = css({
  display: "block",
  margin: "0 0 10px",
  color: "#9fbaaa",
  fontSize: "0.72rem",
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: "uppercase"
});

const widgetValueStyle = css({
  display: "block",
  color: "#ffffff",
  fontSize: "1.55rem",
  lineHeight: 1.2,
  overflowWrap: "anywhere"
});

const widgetMetaStyle = css({
  display: "block",
  marginTop: "10px",
  color: "#c0d1c7",
  lineHeight: 1.45
});

const healthGridStyle = css({
  display: "grid",
  gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
  gap: "10px",
  "@media (max-width: 1100px)": {
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))"
  },
  "@media (max-width: 640px)": {
    gridTemplateColumns: "1fr"
  }
});

const healthItemStyle = css({
  border: "1px solid #3d4c43",
  borderRadius: "8px",
  background: "#17211d",
  padding: "12px"
});

const healthValueStyle = css({
  display: "block",
  color: "#ffffff",
  fontSize: "1rem",
  textTransform: "capitalize"
});

const twoColumnStyle = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
  gap: "14px",
  "@media (max-width: 900px)": {
    gridTemplateColumns: "1fr"
  }
});

const panelStyle = css({
  border: "1px solid #3d4c43",
  borderRadius: "8px",
  background: "#101713",
  padding: "16px"
});

const panelHeaderStyle = css({
  display: "grid",
  gap: "2px",
  marginBottom: "12px"
});

const panelTitleStyle = css({
  color: "#ffffff",
  fontSize: "1.08rem",
  lineHeight: 1.3
});

const riskListStyle = css({
  display: "grid",
  gap: "10px"
});

const riskItemStyle = css({
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr) auto",
  gap: "8px",
  alignItems: "center",
  border: "1px solid #334039",
  borderRadius: "8px",
  color: "#eef4ed",
  padding: "12px",
  textDecoration: "none",
  ":hover": {
    background: "#17211d"
  }
});

const riskSeverityStyle = css({
  border: "1px solid #667d70",
  borderRadius: "999px",
  color: "#d8eadf",
  padding: "3px 8px",
  fontSize: "0.72rem",
  fontWeight: 800,
  textTransform: "capitalize"
});

const riskCountStyle = css({
  color: "#ffffff",
  fontWeight: 900
});

const riskSummaryStyle = css({
  gridColumn: "1 / -1",
  color: "#b8c9bf",
  lineHeight: 1.45
});

const activityListStyle = css({
  display: "grid",
  gap: "10px"
});

const activityItemStyle = css({
  display: "grid",
  gap: "4px",
  border: "1px solid #334039",
  borderRadius: "8px",
  color: "#eef4ed",
  padding: "12px",
  textDecoration: "none",
  span: {
    color: "#b8c9bf"
  },
  time: {
    color: "#91a99a",
    fontSize: "0.84rem"
  },
  ":hover": {
    background: "#17211d"
  }
});
