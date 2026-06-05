import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { css } from "@emotion/css";
import type { AdminAccountDetailResponse } from "@promptopts/api";
import { fetchAdminJson } from "./adminApi";

function AdminAccountDetailScreen({
  accountId,
  apiBaseUrl
}: {
  accountId: string;
  apiBaseUrl?: string | undefined;
}) {
  const [detailState, setDetailState] = useState<{
    detail: AdminAccountDetailResponse;
    status: "local" | "loading" | "ready" | "error";
    message: string;
  }>(() => ({
    detail: createLocalAccountDetail(accountId),
    status: apiBaseUrl ? "loading" : "local",
    message: apiBaseUrl
      ? "Loading redacted Account 360 metadata."
      : "Local redacted Account 360; configure VITE_API_URL to read /admin-api/accounts/:id."
  }));
  const detail = detailState.detail;

  useEffect(() => {
    let isMounted = true;

    async function loadAccount() {
      if (!apiBaseUrl) {
        setDetailState({
          detail: createLocalAccountDetail(accountId),
          status: "local",
          message: "Local redacted Account 360; configure VITE_API_URL to read /admin-api/accounts/:id."
        });
        return;
      }

      try {
        const response = await fetchAdminJson<AdminAccountDetailResponse>(
          `${apiBaseUrl}/admin-api/accounts/${accountId}`
        );
        if (!isMounted) {
          return;
        }

        setDetailState({
          detail: response,
          status: "ready",
          message: "Account opened through guarded admin API. Sensitive read is audited server-side."
        });
      } catch {
        if (isMounted) {
          setDetailState({
            detail: createLocalAccountDetail(accountId),
            status: "error",
            message: "Account API failed; showing local redacted Account 360 metadata."
          });
        }
      }
    }

    void loadAccount();

    return () => {
      isMounted = false;
    };
  }, [accountId, apiBaseUrl]);

  return (
    <div className={rootStyle}>
      <section className={headerPanelStyle} aria-labelledby="account-360-title">
        <div>
          <p className={eyebrowStyle}>Account 360</p>
          <h2 className={titleStyle} id="account-360-title">
            {detail.account.name}
          </h2>
          <p className={bodyTextStyle}>
            Redacted workspace, project, report, and support metadata. Raw prompts and provider keys are never visible here.
          </p>
        </div>
        <span className={statePillStyle}>{detailState.status}</span>
      </section>

      <section className={noticeStyle} aria-label="Account status">
        {detailState.message}
      </section>

      <section className={summaryGridStyle} aria-label="Account header">
        <Metric label="Plan" value={detail.header.plan} />
        <Metric label="Seats" value={String(detail.header.seats)} />
        <Metric label="Provider" value={detail.header.provider ?? "Unknown"} />
        <Metric label="BYOK status" value={detail.header.byok_status.replaceAll("_", " ")} />
        <Metric label="Usage" value={detail.header.usage} />
        <Metric label="Estimated savings" value={formatMoney(detail.header.estimated_savings_usd)} />
        <Metric label="Stage" value={detail.header.stage.replaceAll("_", " ")} />
        <Metric label="Owner" value={detail.header.owner_admin_user_id ?? "Unassigned"} />
      </section>

      <section className={healthPanelStyle} aria-label="Workspace health">
        <div>
          <p className={eyebrowStyle}>Workspace health</p>
          <strong className={panelTitleStyle}>{detail.workspace_health.status.replaceAll("_", " ")}</strong>
          <p className={bodyTextStyle}>{detail.workspace_health.redacted_summary}</p>
        </div>
        <div className={miniStatGridStyle}>
          <Metric label="Projects" value={String(detail.workspace_health.projects)} />
          <Metric label="Eval runs" value={String(detail.workspace_health.eval_runs)} />
          <Metric label="Reports" value={String(detail.workspace_health.reports)} />
        </div>
      </section>

      <section className={tabGridStyle} aria-label="Account 360 tabs">
        <SectionPanel title="Projects tab">
          {detail.projects.map((project) => (
            <article className={listItemStyle} key={project.project_id}>
              <strong>{project.name}</strong>
              <span>{project.provider}/{project.current_model_id}</span>
              <p>{project.redacted_prompt_preview ?? "No prompt preview metadata"}</p>
            </article>
          ))}
        </SectionPanel>

        <SectionPanel title="Reports tab">
          {detail.reports.map((report) => (
            <article className={listItemStyle} key={report.report_id}>
              <strong>{report.status}</strong>
              <span>{report.production_recommendation_allowed ? "Eval-backed" : "Blocked or pending"}</span>
              <p>{report.redacted_summary}</p>
            </article>
          ))}
        </SectionPanel>

        <SectionPanel title="Billing tab placeholder">
          <article className={listItemStyle}>
            <strong>{detail.billing.plan}</strong>
            <span>{detail.billing.usage_ledger_events} ledger event(s)</span>
            <p>{detail.billing.placeholder}</p>
          </article>
        </SectionPanel>

        <SectionPanel title="Support timeline">
          {detail.support_timeline.map((event) => (
            <article className={listItemStyle} key={event.id}>
              <strong>{event.type.replaceAll("_", " ")}</strong>
              <span>{event.actor} · {formatDate(event.timestamp)}</span>
              <p>{event.label}</p>
            </article>
          ))}
        </SectionPanel>
      </section>

      <section className={previewPanelStyle} aria-label="Redacted project and prompt previews">
        <p className={eyebrowStyle}>Redacted previews</p>
        <div className={previewGridStyle}>
          {detail.redacted_previews.map((preview) => (
            <article className={previewCardStyle} key={`${preview.type}-${preview.id}`}>
              <span>{preview.type}</span>
              <strong>{preview.label}</strong>
              <p>{preview.redacted_preview}</p>
              <small>{preview.risk_level ? `${preview.risk_level} risk` : "metadata only"}</small>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export default AdminAccountDetailScreen;

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className={metricStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function SectionPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={panelStyle}>
      <p className={eyebrowStyle}>{title}</p>
      <div className={panelListStyle}>{children}</div>
    </section>
  );
}

function createLocalAccountDetail(accountId: string): AdminAccountDetailResponse {
  return {
    account: {
      id: accountId,
      name: "Acme AI",
      workspace_id: "workspace_acme_ai",
      stage: "new_audit",
      provider_preference: "openai",
      owner_admin_user_id: null,
      domain: "acme-ai.example",
      redacted_prompt_preview: "Support classifier prompt with variables only.",
      is_mock: true,
      created_at: "2026-01-15T12:00:00.000Z",
      updated_at: "2026-01-15T12:00:00.000Z"
    },
    header: {
      plan: "demo",
      seats: 1,
      provider: "openai",
      byok_status: "unknown",
      usage: "1 usage ledger event(s)",
      estimated_savings_usd: null,
      stage: "new_audit",
      owner_admin_user_id: null
    },
    workspace_health: {
      workspace_id: "workspace_acme_ai",
      workspace_name: "Acme AI",
      status: "needs_eval",
      projects: 1,
      eval_runs: 1,
      reports: 1,
      redacted_summary: "Workspace has eval/report metadata, but operator review is still needed."
    },
    projects: [
      {
        project_id: "project_support_classifier",
        name: "Support classifier",
        provider: "openai",
        current_model_id: "openai-demo-balanced",
        status: "active",
        prompt_id: "prompt_support_classifier",
        redacted_prompt_preview: "Classifies an inbound support message and returns redacted JSON fields."
      }
    ],
    reports: [
      {
        report_id: "report_support_classifier_shell",
        project_id: "project_support_classifier",
        status: "blocked",
        production_recommendation_allowed: false,
        generated_at: null,
        redacted_summary: "Report metadata shows production recommendation is blocked or pending."
      }
    ],
    billing: {
      plan: "demo",
      seats: 1,
      usage_ledger_events: 1,
      placeholder: "Billing tab is placeholder-only until billing events, invoices, and credits are durable."
    },
    support_timeline: [
      {
        id: "crm_note_acme_free_audit",
        type: "note",
        label: "Free audit captured overpowered fit; prompt details remain redacted.",
        timestamp: "2026-01-15T12:00:00.000Z",
        actor: "admin_redacted",
        redaction_state: "redacted"
      },
      {
        id: "task_acme_eval_followup",
        type: "task",
        label: "open: Invite Acme AI to run evals before switching",
        timestamp: "2026-01-15T12:00:00.000Z",
        actor: "unassigned",
        redaction_state: "redacted"
      }
    ],
    redacted_previews: [
      {
        id: "prompt_support_classifier",
        type: "prompt",
        label: "Inbound support classifier",
        redacted_preview: "Classifies an inbound support message and returns redacted JSON fields.",
        risk_level: "medium"
      }
    ],
    contacts: [
      {
        id: "contact_acme_ops",
        account_id: accountId,
        name: "Acme Ops",
        email: "ops@acme-ai.example",
        role: "Operations",
        is_mock: true,
        created_at: "2026-01-15T12:00:00.000Z",
        updated_at: "2026-01-15T12:00:00.000Z"
      }
    ],
    opportunities: [
      {
        id: "opportunity_acme_support_classifier",
        account_id: accountId,
        project_id: "project_support_classifier",
        stage: "eval_ready",
        provider: "openai",
        current_model_id: "openai-demo-balanced",
        current_model: "openai-demo-balanced",
        fit_signal: "overpowered",
        estimated_monthly_calls: 250000,
        estimated_volume: 250000,
        savings_opportunity_usd: null,
        estimated_savings: null,
        use_case: "support",
        cta_clicked: "run_evals",
        eval_readiness: "eval_ready",
        is_mock: true,
        created_at: "2026-01-15T12:00:00.000Z",
        updated_at: "2026-01-15T12:00:00.000Z"
      }
    ],
    notes: [
      {
        id: "crm_note_acme_free_audit",
        account_id: accountId,
        opportunity_id: "opportunity_acme_support_classifier",
        author_admin_user_id: "admin_user_demo",
        body_redacted: "Free audit captured overpowered fit; prompt details remain redacted.",
        redaction_state: "redacted",
        metadata: { source: "free_audit" },
        is_mock: true,
        created_at: "2026-01-15T12:00:00.000Z"
      }
    ],
    tasks: [
      {
        id: "task_acme_eval_followup",
        account_id: accountId,
        opportunity_id: "opportunity_acme_support_classifier",
        assignee_admin_user_id: null,
        title: "Invite Acme AI to run evals before switching",
        status: "open",
        due_at: null,
        metadata: { source: "free_audit" },
        is_mock: true,
        created_at: "2026-01-15T12:00:00.000Z",
        updated_at: "2026-01-15T12:00:00.000Z"
      }
    ]
  };
}

function formatMoney(value: number | null): string {
  if (value === null) {
    return "Unverified";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
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
  lineHeight: 1.15
});

const bodyTextStyle = css({
  maxWidth: "760px",
  margin: "10px 0 0",
  color: "#c7d6ce",
  lineHeight: 1.55
});

const statePillStyle = css({
  border: "1px solid #6f8878",
  borderRadius: "8px",
  padding: "6px 10px",
  color: "#dcebe0",
  fontSize: "0.82rem",
  fontWeight: 800
});

const noticeStyle = css({
  border: "1px solid #4f6258",
  borderRadius: "8px",
  background: "#111a16",
  color: "#dcebe0",
  padding: "12px 14px",
  lineHeight: 1.45
});

const summaryGridStyle = css({
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "10px",
  "@media (max-width: 900px)": {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))"
  },
  "@media (max-width: 560px)": {
    gridTemplateColumns: "1fr"
  }
});

const metricStyle = css({
  minHeight: "82px",
  border: "1px solid #415149",
  borderRadius: "8px",
  background: "#17211d",
  padding: "14px",
  display: "grid",
  alignContent: "space-between",
  gap: "10px",
  span: {
    color: "#a9bdb1",
    fontSize: "0.78rem",
    fontWeight: 800,
    textTransform: "uppercase"
  },
  strong: {
    color: "#ffffff",
    fontSize: "1rem",
    lineHeight: 1.25,
    textTransform: "capitalize"
  }
});

const healthPanelStyle = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(260px, 420px)",
  gap: "18px",
  border: "1px solid #415149",
  borderRadius: "8px",
  background: "#17211d",
  padding: "20px",
  "@media (max-width: 840px)": {
    gridTemplateColumns: "1fr"
  }
});

const miniStatGridStyle = css({
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "10px",
  "@media (max-width: 520px)": {
    gridTemplateColumns: "1fr"
  }
});

const tabGridStyle = css({
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "14px",
  "@media (max-width: 900px)": {
    gridTemplateColumns: "1fr"
  }
});

const panelStyle = css({
  border: "1px solid #415149",
  borderRadius: "8px",
  background: "#17211d",
  padding: "18px"
});

const panelTitleStyle = css({
  color: "#ffffff",
  fontSize: "1.15rem",
  textTransform: "capitalize"
});

const panelListStyle = css({
  display: "grid",
  gap: "10px"
});

const listItemStyle = css({
  borderTop: "1px solid #2e3a34",
  paddingTop: "10px",
  display: "grid",
  gap: "5px",
  strong: {
    color: "#ffffff"
  },
  span: {
    color: "#aebfb5",
    fontSize: "0.86rem"
  },
  p: {
    margin: 0,
    color: "#cbd9d0",
    lineHeight: 1.45
  }
});

const previewPanelStyle = css({
  border: "1px solid #415149",
  borderRadius: "8px",
  background: "#17211d",
  padding: "18px"
});

const previewGridStyle = css({
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "10px",
  "@media (max-width: 900px)": {
    gridTemplateColumns: "1fr"
  }
});

const previewCardStyle = css({
  border: "1px solid #33433b",
  borderRadius: "8px",
  background: "#111a16",
  padding: "14px",
  display: "grid",
  gap: "7px",
  span: {
    color: "#9fbaaa",
    fontSize: "0.75rem",
    fontWeight: 800,
    textTransform: "uppercase"
  },
  strong: {
    color: "#ffffff"
  },
  p: {
    margin: 0,
    color: "#c7d6ce",
    lineHeight: 1.45
  },
  small: {
    color: "#aebfb5",
    textTransform: "capitalize"
  }
});
