import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { css } from "@emotion/css";
import type { BillingCreditResponse, BillingResponse } from "@promptopts/api";
import { fetchAdminJson, sendAdminJson } from "./adminApi";

function AdminBillingScreen({ apiBaseUrl }: { apiBaseUrl?: string | undefined }) {
  const [billingState, setBillingState] = useState<{
    response: BillingResponse;
    status: "local" | "loading" | "ready" | "error";
    message: string;
  }>(() => ({
    response: createLocalBillingResponse(),
    status: apiBaseUrl ? "loading" : "local",
    message: apiBaseUrl
      ? "Loading billing and entitlement metadata."
      : "Local billing metadata; configure VITE_API_URL to read /admin-api/billing."
  }));
  const workspaceId = billingState.response.entitlements[0]?.workspace_id ?? "workspace_acme_ai";

  useEffect(() => {
    let isMounted = true;

    async function loadBilling() {
      if (!apiBaseUrl) {
        setBillingState({
          response: createLocalBillingResponse(),
          status: "local",
          message: "Local billing metadata; configure VITE_API_URL to read /admin-api/billing."
        });
        return;
      }

      try {
        const response = await fetchAdminJson<BillingResponse>(`${apiBaseUrl}/admin-api/billing`);
        if (!isMounted) {
          return;
        }

        setBillingState({
          response,
          status: "ready",
          message: "Billing metadata loaded through guarded admin API."
        });
      } catch {
        if (isMounted) {
          setBillingState({
            response: createLocalBillingResponse(),
            status: "error",
            message: "Billing API failed; showing local entitlement and usage metadata."
          });
        }
      }
    }

    void loadBilling();

    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl]);

  async function issueCredit() {
    if (apiBaseUrl) {
      await sendAdminJson<BillingCreditResponse>(
        `${apiBaseUrl}/admin-api/billing/${workspaceId}/credit`,
        "POST",
        {
          feature: "report_exports",
          quantity: 1,
          reason_code: "admin_goodwill_credit"
        },
        {
          actionScopes: "read_metadata,issue_billing_credit",
          sudoReasonCode: "admin_goodwill_credit"
        }
      ).catch(() => undefined);
    }

    setBillingState((current) => ({
      ...current,
      message: "Credit requested. Finance/owner scope, sudo, reason, ledger write, and audit are required by the API."
    }));
  }

  return (
    <div className={rootStyle}>
      <section className={headerPanelStyle} aria-labelledby="admin-billing-title">
        <div>
          <p className={eyebrowStyle}>Billing operations</p>
          <h2 className={titleStyle} id="admin-billing-title">
            Billing
          </h2>
          <p className={bodyTextStyle}>
            Plans, entitlements, usage ledger, invoices, credits, and feature flags. Credits require finance or owner authorization.
          </p>
        </div>
        <span className={statePillStyle}>{billingState.status}</span>
      </section>

      <section className={noticeStyle} aria-label="Billing status">
        {billingState.message}
      </section>

      <section className={summaryGridStyle} aria-label="Plan summary">
        <Metric label="Plan" value={billingState.response.plan?.name ?? "No plan"} />
        <Metric label="Trial state" value={billingState.response.trial_state} />
        <Metric label="Seats" value={`${billingState.response.seats.used}/${billingState.response.seats.limit}`} />
        <Metric label="Invoices" value={String(billingState.response.invoices.length)} />
        <Metric label="Credits" value={String(billingState.response.credits.length)} />
      </section>

      <section className={panelStyle} aria-labelledby="entitlements-title">
        <h3 id="entitlements-title">Entitlements</h3>
        <div className={entitlementGridStyle}>
          {billingState.response.entitlement_checks.map((check) => (
            <article className={entitlementCardStyle} key={check.feature}>
              <span className={statusBadgeStyle}>{check.enabled ? "enabled" : "disabled"}</span>
              <strong>{check.label}</strong>
              <p>
                {check.used}/{check.limit} used, {check.remaining} remaining
              </p>
              <span className={subtleLineStyle}>
                {check.enforced_on_public_routes ? "Enforced on public routes" : "Admin-visible entitlement"}
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className={splitGridStyle}>
        <TablePanel title="Invoices">
          {billingState.response.invoices.map((invoice) => (
            <tr key={invoice.id}>
              <td>{invoice.id}</td>
              <td>{invoice.status}</td>
              <td>{formatCents(invoice.amount_due_cents)}</td>
              <td>{invoice.due_at ?? "No due date"}</td>
            </tr>
          ))}
        </TablePanel>
        <TablePanel title="Credits">
          {billingState.response.credits.map((credit) => (
            <tr key={credit.id}>
              <td>{credit.id}</td>
              <td>{formatCents(credit.amount_cents)}</td>
              <td>{credit.reason_code}</td>
              <td>{credit.issued_by_admin_user_id ?? "system"}</td>
            </tr>
          ))}
        </TablePanel>
      </section>

      <section className={splitGridStyle}>
        <TablePanel title="Usage ledger">
          {billingState.response.usage_ledger.map((entry) => (
            <tr key={entry.id}>
              <td>{entry.feature}</td>
              <td>{entry.quantity}</td>
              <td>{entry.direction}</td>
              <td>{entry.source_type}</td>
            </tr>
          ))}
        </TablePanel>
        <TablePanel title="Feature flags">
          {billingState.response.feature_flags.map((flag) => (
            <tr key={flag.id}>
              <td>{flag.key}</td>
              <td>{flag.enabled ? "enabled" : "disabled"}</td>
              <td>{JSON.stringify(flag.rollout)}</td>
              <td>{flag.updated_by_admin_user_id ?? "system"}</td>
            </tr>
          ))}
        </TablePanel>
      </section>

      <section className={panelStyle} aria-label="Billing actions">
        <h3>Actions</h3>
        <button className={buttonStyle} type="button" onClick={() => void issueCredit()}>
          Issue report export credit
        </button>
        <p className={bodyTextStyle}>
          Plan, credit, and limit changes require a reason code and write append-only admin audit events.
        </p>
      </section>
    </div>
  );
}

export default AdminBillingScreen;

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={metricCardStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TablePanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={panelStyle} aria-label={title}>
      <h3>{title}</h3>
      <div className={tableWrapStyle}>
        <table className={tableStyle}>
          <tbody>{children}</tbody>
        </table>
      </div>
    </section>
  );
}

function createLocalBillingResponse(): BillingResponse {
  return {
    plans: [
      {
        id: "plan_demo_growth",
        name: "Demo Growth",
        billing_period: "month",
        price_cents: 4900,
        feature_limits: { hosted_eval_runs: 25, report_exports: 25, seats: 3 },
        is_active: true,
        is_mock: true,
        created_at: "2026-01-15T12:00:00.000Z"
      }
    ],
    plan: {
      id: "plan_demo_growth",
      name: "Demo Growth",
      billing_period: "month",
      price_cents: 4900,
      feature_limits: { hosted_eval_runs: 25, report_exports: 25, seats: 3 },
      is_active: true,
      is_mock: true,
      created_at: "2026-01-15T12:00:00.000Z"
    },
    trial_state: "trialing",
    seats: { limit: 3, used: 1 },
    entitlement_checks: [
      createLocalCheck("hosted_eval_runs", "Hosted eval run limit", true, 25, 1),
      createLocalCheck("prompt_history", "Prompt history entitlement", false, 100, 1),
      createLocalCheck("report_exports", "Report export entitlement", true, 25, 1),
      createLocalCheck("csv_upload", "CSV upload", false, 1, 0),
      createLocalCheck("byok", "BYOK", false, 1, 0),
      createLocalCheck("pdf_export", "PDF export", true, 1, 0),
      createLocalCheck("cli_beta", "CLI beta", false, 1, 0),
      createLocalCheck("seats", "Seats", false, 3, 1)
    ],
    entitlements: [
      {
        id: "entitlement_acme_hosted_eval_runs",
        workspace_id: "workspace_acme_ai",
        plan_id: "plan_demo_growth",
        feature: "hosted_eval_runs",
        limit: 25,
        used: 1,
        is_mock: true,
        starts_at: "2026-01-15T12:00:00.000Z",
        ends_at: null,
        created_at: "2026-01-15T12:00:00.000Z"
      }
    ],
    usage_ledger: [
      {
        id: "usage_ledger_acme_free_audit",
        workspace_id: "workspace_acme_ai",
        feature: "free_audits",
        quantity: 1,
        unit: "audit",
        direction: "debit",
        source_type: "free_audit",
        source_id: "free_audit_acme_support_classifier",
        is_mock: true,
        created_at: "2026-01-15T12:00:00.000Z"
      }
    ],
    invoices: [
      {
        id: "invoice_acme_demo_open",
        workspace_id: "workspace_acme_ai",
        status: "open",
        amount_due_cents: 4900,
        currency: "usd",
        issued_at: "2026-01-15T12:00:00.000Z",
        due_at: "2026-02-15T12:00:00.000Z",
        paid_at: null,
        external_reference: "demo-invoice-001",
        metadata: { plan_id: "plan_demo_growth" },
        is_mock: true,
        created_at: "2026-01-15T12:00:00.000Z"
      }
    ],
    credits: [
      {
        id: "credit_acme_demo",
        workspace_id: "workspace_acme_ai",
        amount_cents: 1000,
        currency: "usd",
        reason_code: "demo_seed",
        issued_by_admin_user_id: "admin_user_demo",
        sudo_request_id: null,
        billing_event_id: "billing_event_acme_demo_credit",
        is_mock: true,
        created_at: "2026-01-15T12:00:00.000Z"
      }
    ],
    billing_events: [
      {
        id: "billing_event_acme_demo_credit",
        workspace_id: "workspace_acme_ai",
        event_type: "credit_issued",
        amount_cents: 1000,
        currency: "usd",
        external_reference: null,
        metadata: { reason_code: "demo_seed" },
        is_mock: true,
        created_at: "2026-01-15T12:00:00.000Z"
      }
    ],
    feature_flags: [
      {
        id: "feature_flag_cli_beta",
        key: "cli_beta",
        enabled: true,
        rollout: { workspaces: ["workspace_acme_ai"] },
        created_by_admin_user_id: "admin_user_demo",
        updated_by_admin_user_id: "admin_user_demo",
        is_mock: true,
        created_at: "2026-01-15T12:00:00.000Z",
        updated_at: "2026-01-15T12:00:00.000Z"
      }
    ],
    notes: ["Local billing rows are synthetic and memory-backed."]
  };
}

function createLocalCheck(
  feature: BillingResponse["entitlement_checks"][number]["feature"],
  label: string,
  enforced: boolean,
  limit: number,
  used: number
): BillingResponse["entitlement_checks"][number] {
  return {
    feature,
    label,
    enabled: limit > 0,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    enforced_on_public_routes: enforced
  };
}

function formatCents(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value / 100);
}

const rootStyle = css({
  display: "grid",
  gap: "18px",
  marginTop: "28px",
  minWidth: 0
});

const headerPanelStyle = css({
  display: "flex",
  justifyContent: "space-between",
  gap: "18px",
  border: "1px solid #415149",
  borderRadius: "8px",
  background: "#17211d",
  padding: "22px",
  "@media (max-width: 740px)": {
    flexDirection: "column"
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
  fontSize: "1.45rem",
  lineHeight: 1.2,
  letterSpacing: 0
});

const bodyTextStyle = css({
  maxWidth: "760px",
  margin: "10px 0 0",
  color: "#c7d6ce",
  lineHeight: 1.6
});

const statePillStyle = css({
  height: "fit-content",
  border: "1px solid #6f8878",
  borderRadius: "8px",
  padding: "5px 9px",
  color: "#dcebe0",
  fontSize: "0.8rem",
  fontWeight: 800
});

const noticeStyle = css({
  border: "1px solid #33463d",
  borderRadius: "8px",
  background: "#101713",
  color: "#dcebe0",
  padding: "12px 14px"
});

const summaryGridStyle = css({
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: "10px",
  "@media (max-width: 820px)": {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))"
  },
  "@media (max-width: 560px)": {
    gridTemplateColumns: "1fr"
  }
});

const metricCardStyle = css({
  border: "1px solid #415149",
  borderRadius: "8px",
  background: "#17211d",
  padding: "14px",
  display: "grid",
  gap: "8px",
  overflowWrap: "anywhere",
  span: {
    color: "#a9b9b0"
  },
  strong: {
    color: "#ffffff",
    fontSize: "1.15rem"
  }
});

const panelStyle = css({
  border: "1px solid #415149",
  borderRadius: "8px",
  background: "#17211d",
  padding: "18px",
  h3: {
    margin: "0 0 14px",
    color: "#ffffff"
  }
});

const entitlementGridStyle = css({
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "10px",
  "@media (max-width: 980px)": {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))"
  },
  "@media (max-width: 560px)": {
    gridTemplateColumns: "1fr"
  }
});

const entitlementCardStyle = css({
  border: "1px solid #33463d",
  borderRadius: "8px",
  background: "#101713",
  padding: "14px",
  display: "grid",
  gap: "8px",
  strong: {
    color: "#ffffff"
  },
  p: {
    margin: 0,
    color: "#c7d6ce"
  }
});

const statusBadgeStyle = css({
  width: "fit-content",
  border: "1px solid #526a5d",
  borderRadius: "8px",
  padding: "4px 8px",
  color: "#dcebe0"
});

const subtleLineStyle = css({
  color: "#9fbaaa",
  fontSize: "0.82rem"
});

const splitGridStyle = css({
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "12px",
  "@media (max-width: 900px)": {
    gridTemplateColumns: "1fr"
  }
});

const tableWrapStyle = css({
  maxWidth: "100%",
  overflowX: "auto",
  WebkitOverflowScrolling: "touch"
});

const tableStyle = css({
  width: "100%",
  minWidth: "520px",
  borderCollapse: "collapse",
  "td, th": {
    borderTop: "1px solid #33463d",
    color: "#edf5ef",
    padding: "10px",
    textAlign: "left",
    verticalAlign: "top",
    overflowWrap: "anywhere"
  }
});

const buttonStyle = css({
  minHeight: "40px",
  border: "1px solid #b8d1c0",
  borderRadius: "8px",
  background: "#dcebe0",
  color: "#101713",
  cursor: "pointer",
  fontWeight: 800,
  padding: "9px 11px"
});
