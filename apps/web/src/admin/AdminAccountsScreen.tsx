import { useEffect, useState } from "react";
import { css } from "@emotion/css";
import type {
  AccountNoteCreateResponse,
  AccountTaskCreateResponse,
  AdminAccountsResponse
} from "@promptopts/api";
import { fetchAdminJson, sendAdminJson } from "./adminApi";

function AdminAccountsScreen({ apiBaseUrl }: { apiBaseUrl?: string | undefined }) {
  const [pipelineState, setPipelineState] = useState<{
    response: AdminAccountsResponse;
    status: "local" | "loading" | "ready" | "error";
    message: string;
  }>(() => ({
    response: createLocalAccountsResponse(),
    status: apiBaseUrl ? "loading" : "local",
    message: apiBaseUrl
      ? "Loading redacted account pipeline metadata."
      : "Local redacted account pipeline; configure VITE_API_URL to read /admin-api/accounts."
  }));

  useEffect(() => {
    let isMounted = true;

    async function loadAccounts() {
      if (!apiBaseUrl) {
        setPipelineState({
          response: createLocalAccountsResponse(),
          status: "local",
          message: "Local redacted account pipeline; configure VITE_API_URL to read /admin-api/accounts."
        });
        return;
      }

      try {
        const response = await fetchAdminJson<AdminAccountsResponse>(`${apiBaseUrl}/admin-api/accounts`);
        if (!isMounted) {
          return;
        }

        setPipelineState({
          response,
          status: "ready",
          message: "Pipeline loaded through guarded admin API. Rows are metadata-only."
        });
      } catch {
        if (isMounted) {
          setPipelineState({
            response: createLocalAccountsResponse(),
            status: "error",
            message: "Account pipeline API failed; showing local redacted metadata."
          });
        }
      }
    }

    void loadAccounts();

    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl]);

  async function handleAssignOwner(accountId: string) {
    setPipelineState((current) => ({
      ...current,
      message: "Assigning owner metadata."
    }));

    if (apiBaseUrl) {
      await sendAdminJson(`${apiBaseUrl}/admin-api/accounts/${accountId}`, "PATCH", {
        owner_admin_user_id: "admin_user_mock"
      }).catch(() => undefined);
    }

    setPipelineState((current) => ({
      ...current,
      response: {
        ...current.response,
        accounts: current.response.accounts.map((account) =>
          account.account_id === accountId
            ? { ...account, owner_admin_user_id: "admin_user_mock" }
            : account
        )
      },
      message: "Owner assignment captured as metadata; mutation is audited by the API when configured."
    }));
  }

  async function handleCreateTask(accountId: string, opportunityId: string | null) {
    setPipelineState((current) => ({
      ...current,
      message: "Creating follow-up task."
    }));

    if (apiBaseUrl) {
      await sendAdminJson<AccountTaskCreateResponse>(
        `${apiBaseUrl}/admin-api/accounts/${accountId}/tasks`,
        "POST",
        {
          title: "Review free audit and invite eval run",
          opportunity_id: opportunityId,
          assignee_admin_user_id: "admin_user_mock"
        }
      ).catch(() => undefined);
    }

    setPipelineState((current) => ({
      ...current,
      message: "Task captured. This remains a manual operator action, not an automation sequence."
    }));
  }

  async function handleAddNote(accountId: string, opportunityId: string | null) {
    setPipelineState((current) => ({
      ...current,
      message: "Adding redacted CRM note."
    }));

    if (apiBaseUrl) {
      await sendAdminJson<AccountNoteCreateResponse>(
        `${apiBaseUrl}/admin-api/accounts/${accountId}/notes`,
        "POST",
        {
          body: "Manual operator note: follow up on eval readiness. No raw prompt content.",
          opportunity_id: opportunityId
        }
      ).catch(() => undefined);
    }

    setPipelineState((current) => ({
      ...current,
      message: "Redacted note captured. Raw prompts are not stored in CRM notes."
    }));
  }

  return (
    <div className={rootStyle}>
      <section className={headerPanelStyle} aria-labelledby="admin-accounts-title">
        <div>
          <p className={eyebrowStyle}>CRM pipeline</p>
          <h2 className={titleStyle} id="admin-accounts-title">
            Accounts
          </h2>
          <p className={bodyTextStyle}>
            Free-audit signals, eval readiness, and account ownership. No sequences, campaigns, forecasting, or raw prompt browsing.
          </p>
        </div>
        <span className={statePillStyle}>{pipelineState.status}</span>
      </section>

      <section className={noticeStyle} aria-label="Pipeline status">
        {pipelineState.message}
      </section>

      <section className={stageRailStyle} aria-label="Account stages">
        {pipelineState.response.stages.map((stage) => (
          <span className={stagePillStyle} key={stage}>
            {formatStage(stage)}
          </span>
        ))}
      </section>

      <section className={tableWrapStyle} aria-label="Account pipeline table">
        <table className={tableStyle}>
          <thead>
            <tr>
              <th>Account</th>
              <th>Provider</th>
              <th>Fit signal</th>
              <th>Volume</th>
              <th>Savings opportunity</th>
              <th>Stage</th>
              <th>Owner</th>
              <th>Last activity</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pipelineState.response.accounts.map((account) => (
              <tr key={account.account_id}>
                <td>
                  <strong>{account.account}</strong>
                  <span className={previewStyle}>{account.redacted_prompt_preview ?? "No prompt preview"}</span>
                </td>
                <td>{account.provider ?? "Unknown"}</td>
                <td>{account.fit_signal ?? "Pending"}</td>
                <td>{formatNumber(account.volume)}</td>
                <td>{formatMoney(account.savings_opportunity_usd)}</td>
                <td>
                  <span className={stageCellStyle}>{formatStage(account.stage)}</span>
                </td>
                <td>{account.owner_admin_user_id ?? "Unassigned"}</td>
                <td>{formatDate(account.last_activity_at)}</td>
                <td>
                  <div className={actionGroupStyle}>
                    <button className={smallButtonStyle} type="button" onClick={() => void handleAssignOwner(account.account_id)}>
                      Assign owner
                    </button>
                    <button className={smallButtonStyle} type="button" onClick={() => void handleCreateTask(account.account_id, account.opportunity_id)}>
                      Create task
                    </button>
                    <button className={smallButtonStyle} type="button" onClick={() => void handleAddNote(account.account_id, account.opportunity_id)}>
                      Add note
                    </button>
                    <a className={openLinkStyle} href={`/__admin/accounts/${account.account_id}`}>
                      Open account
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default AdminAccountsScreen;

function createLocalAccountsResponse(): AdminAccountsResponse {
  return {
    stages: ["new_audit", "qualified", "eval_ready", "trial", "paid", "needs_review"],
    accounts: [
      {
        account_id: "account_acme_ai",
        account: "Acme AI",
        provider: "openai",
        fit_signal: "overpowered",
        volume: 250000,
        savings_opportunity_usd: null,
        stage: "new_audit",
        owner_admin_user_id: null,
        last_activity_at: "2026-01-15T12:00:00.000Z",
        redacted_prompt_preview: "Support classifier prompt with variables only.",
        opportunity_id: "opportunity_acme_support_classifier",
        redaction_state: "redacted"
      }
    ]
  };
}

function formatStage(stage: AdminAccountsResponse["stages"][number]): string {
  return stage.replaceAll("_", " ");
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

function formatNumber(value: number | null): string {
  return value === null ? "Pending" : value.toLocaleString();
}

function formatDate(value: string | null): string {
  if (value === null) {
    return "Pending";
  }

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

const stageRailStyle = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "8px"
});

const stagePillStyle = css({
  border: "1px solid #526a5d",
  borderRadius: "8px",
  background: "#17211d",
  color: "#e4efe8",
  padding: "7px 10px",
  fontSize: "0.85rem",
  fontWeight: 750,
  textTransform: "capitalize"
});

const tableWrapStyle = css({
  overflowX: "auto",
  border: "1px solid #415149",
  borderRadius: "8px",
  background: "#17211d"
});

const tableStyle = css({
  width: "100%",
  minWidth: "1080px",
  borderCollapse: "collapse",
  color: "#e7f0ea",
  "th, td": {
    borderBottom: "1px solid #2e3a34",
    padding: "14px",
    textAlign: "left",
    verticalAlign: "top"
  },
  th: {
    color: "#a9bdb1",
    fontSize: "0.78rem",
    fontWeight: 800,
    textTransform: "uppercase"
  },
  "tbody tr:last-child td": {
    borderBottom: 0
  }
});

const previewStyle = css({
  display: "block",
  maxWidth: "260px",
  marginTop: "5px",
  color: "#aebfb5",
  fontSize: "0.84rem",
  lineHeight: 1.35
});

const stageCellStyle = css({
  display: "inline-block",
  border: "1px solid #5c7567",
  borderRadius: "8px",
  padding: "4px 8px",
  textTransform: "capitalize"
});

const actionGroupStyle = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "7px",
  minWidth: "250px"
});

const smallButtonStyle = css({
  minHeight: "34px",
  border: "1px solid #6f8878",
  borderRadius: "8px",
  background: "#111a16",
  color: "#e6f0ea",
  padding: "0 9px",
  fontWeight: 750,
  cursor: "pointer",
  ":hover": {
    background: "#1d2a24"
  }
});

const openLinkStyle = css({
  display: "inline-flex",
  alignItems: "center",
  minHeight: "34px",
  border: "1px solid #b8d1c0",
  borderRadius: "8px",
  background: "#dcebe0",
  color: "#101713",
  padding: "0 10px",
  fontWeight: 800,
  textDecoration: "none"
});
