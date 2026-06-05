import { useEffect, useState } from "react";
import { css } from "@emotion/css";
import type { AuditLogsResponse } from "@promptopts/api";
import { fetchAdminJson } from "./adminApi";

function AdminAuditLogsScreen({ apiBaseUrl }: { apiBaseUrl?: string | undefined }) {
  const [auditState, setAuditState] = useState<{
    response: AuditLogsResponse;
    status: "local" | "loading" | "ready" | "error";
    message: string;
  }>(() => ({
    response: createLocalAuditLogsResponse(),
    status: apiBaseUrl ? "loading" : "local",
    message: apiBaseUrl
      ? "Loading append-only admin audit trail."
      : "Local audit trail; configure VITE_API_URL to read /admin-api/audit-logs."
  }));

  useEffect(() => {
    let isMounted = true;

    async function loadAuditLogs() {
      if (!apiBaseUrl) {
        setAuditState({
          response: createLocalAuditLogsResponse(),
          status: "local",
          message: "Local audit trail; configure VITE_API_URL to read /admin-api/audit-logs."
        });
        return;
      }

      try {
        const response = await fetchAdminJson<AuditLogsResponse>(`${apiBaseUrl}/admin-api/audit-logs`);
        if (!isMounted) {
          return;
        }

        setAuditState({
          response,
          status: "ready",
          message: "Audit logs loaded through guarded admin API. Entries are append-only metadata."
        });
      } catch {
        if (isMounted) {
          setAuditState({
            response: createLocalAuditLogsResponse(),
            status: "error",
            message: "Audit log API failed; showing local redacted audit metadata."
          });
        }
      }
    }

    void loadAuditLogs();

    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl]);

  const sortedLogs = [...auditState.response.audit_logs].sort((left, right) =>
    right.created_at.localeCompare(left.created_at)
  );

  return (
    <div className={rootStyle}>
      <section className={headerPanelStyle} aria-labelledby="audit-logs-title">
        <div>
          <p className={eyebrowStyle}>Append-only trust trail</p>
          <h2 className={titleStyle} id="audit-logs-title">
            Audit logs
          </h2>
          <p className={bodyTextStyle}>
            Sensitive reads and admin mutations are recorded as redacted metadata. This view is for review, not raw prompt browsing.
          </p>
        </div>
        <span className={statePillStyle}>{auditState.status}</span>
      </section>

      <section className={noticeStyle} aria-label="Audit log status">
        {auditState.message}
      </section>

      <section className={summaryGridStyle} aria-label="Audit log summary">
        <Metric label="Entries" value={String(sortedLogs.length)} />
        <Metric label="Sensitive reads" value={String(sortedLogs.filter((log) => log.metadata.sensitive_read).length)} />
        <Metric label="Sudo actions" value={String(sortedLogs.filter((log) => log.sudo_request_id).length)} />
      </section>

      <section className={tableWrapStyle} aria-label="Admin audit log table">
        <table className={tableStyle}>
          <thead>
            <tr>
              <th>Created</th>
              <th>Admin</th>
              <th>Scope</th>
              <th>Action</th>
              <th>Target</th>
              <th>Reason</th>
              <th>Redaction</th>
            </tr>
          </thead>
          <tbody>
            {sortedLogs.map((log) => (
              <tr key={log.id}>
                <td>{formatDate(log.created_at)}</td>
                <td>{log.admin_user_id}</td>
                <td>
                  <span className={statusBadgeStyle}>{log.action_scope}</span>
                </td>
                <td>{log.action}</td>
                <td>
                  <strong>{log.target_type}</strong>
                  <span className={subtleLineStyle}>{log.target_id}</span>
                </td>
                <td>{log.reason_code}</td>
                <td>{log.redaction_state}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default AdminAuditLogsScreen;

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={metricCardStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function createLocalAuditLogsResponse(): AuditLogsResponse {
  return {
    audit_logs: [
      {
        id: "admin_audit_log_overview_read_demo",
        admin_user_id: "admin_user_mock",
        workspace_id: "workspace_acme_ai",
        account_id: "account_acme_ai",
        target_type: "admin_overview",
        target_id: "admin_overview",
        action: "GET /admin-api/overview",
        action_scope: "read_metadata",
        reason_code: "request",
        sudo_request_id: null,
        ip_address: "127.0.0.1",
        user_agent: "PromptOpts admin CRM local mock",
        redaction_state: "redacted",
        metadata: { sensitive_read: true },
        is_mock: true,
        created_at: "2026-01-15T12:00:00.000Z"
      },
      {
        id: "admin_audit_log_report_delete_demo",
        admin_user_id: "admin_user_mock",
        workspace_id: "workspace_acme_ai",
        account_id: "account_acme_ai",
        target_type: "report",
        target_id: "report_delete_pending_demo",
        action: "POST /admin-api/reports/:id/delete",
        action_scope: "delete_report",
        reason_code: "report_deletion_approval",
        sudo_request_id: "sudo_request_mock",
        ip_address: "127.0.0.1",
        user_agent: "PromptOpts admin CRM local mock",
        redaction_state: "redacted",
        metadata: { mutation: true },
        is_mock: true,
        created_at: "2026-01-15T12:05:00.000Z"
      }
    ]
  };
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
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "10px",
  "@media (max-width: 700px)": {
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
    fontSize: "1.4rem"
  }
});

const tableWrapStyle = css({
  maxWidth: "100%",
  overflowX: "auto",
  WebkitOverflowScrolling: "touch",
  border: "1px solid #415149",
  borderRadius: "8px",
  background: "#17211d"
});

const tableStyle = css({
  width: "100%",
  minWidth: "940px",
  borderCollapse: "collapse",
  th: {
    color: "#9fbaaa",
    fontSize: "0.78rem",
    textAlign: "left",
    textTransform: "uppercase"
  },
  "th, td": {
    borderBottom: "1px solid #33463d",
    padding: "12px",
    verticalAlign: "top",
    overflowWrap: "anywhere"
  },
  td: {
    color: "#edf5ef"
  }
});

const statusBadgeStyle = css({
  display: "inline-block",
  border: "1px solid #526a5d",
  borderRadius: "8px",
  padding: "4px 8px",
  color: "#dcebe0"
});

const subtleLineStyle = css({
  display: "block",
  marginTop: "5px",
  color: "#9fbaaa",
  fontSize: "0.82rem"
});
