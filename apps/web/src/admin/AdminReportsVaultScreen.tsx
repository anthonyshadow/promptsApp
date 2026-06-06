import { useEffect, useState } from "react";
import { css } from "@emotion/css";
import type { AdminReportsResponse, ReportExportActionResponse, ReportDeleteResponse } from "@promptopts/api";
import { fetchAdminJson, requestAdminSudo, sendAdminJson } from "./adminApi";

function AdminReportsVaultScreen({ apiBaseUrl }: { apiBaseUrl?: string | undefined }) {
  const [vaultState, setVaultState] = useState<{
    response: AdminReportsResponse;
    status: "local" | "loading" | "ready" | "error";
    message: string;
  }>(() => ({
    response: createLocalReportsResponse(),
    status: apiBaseUrl ? "loading" : "local",
    message: apiBaseUrl
      ? "Loading redacted reports vault."
      : "Local reports vault; configure VITE_API_URL to read /admin-api/reports."
  }));

  useEffect(() => {
    let isMounted = true;

    async function loadReports() {
      if (!apiBaseUrl) {
        setVaultState({
          response: createLocalReportsResponse(),
          status: "local",
          message: "Local reports vault; configure VITE_API_URL to read /admin-api/reports."
        });
        return;
      }

      try {
        const response = await fetchAdminJson<AdminReportsResponse>(`${apiBaseUrl}/admin-api/reports`);
        if (!isMounted) {
          return;
        }

        setVaultState({
          response,
          status: "ready",
          message: "Reports vault loaded through guarded admin API. Redacted views are the default."
        });
      } catch {
        if (isMounted) {
          setVaultState({
            response: createLocalReportsResponse(),
            status: "error",
            message: "Reports API failed; showing local redacted report lifecycle metadata."
          });
        }
      }
    }

    void loadReports();

    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl]);

  async function handleAction(action: AdminReportsResponse["reports"][number]["action"], reportId: string) {
    if (action === "open_redacted") {
      setVaultState((current) => ({
        ...current,
        message: `Opened redacted metadata for ${reportId}. Raw report content remains locked.`
      }));
      return;
    }

    if (action === "request_sudo_for_raw") {
      requestAdminSudo({
        actionScope: "reveal_report",
        suggestedReasonCode: "raw_report_review",
        targetType: "reports",
        targetId: reportId,
        message: "Raw report reveal requires sudo and reason code."
      });
      setVaultState((current) => ({
        ...current,
        message: "Raw report reveal requires sudo and reason code; normal support view remains redacted."
      }));
      return;
    }

    if (apiBaseUrl) {
      const route =
        action === "retry_export"
          ? "retry-export"
          : action === "regenerate_export"
            ? "regenerate"
            : "delete";
      const options = action === "approve_deletion"
        ? {
            actionScopes: "read_metadata,delete_report",
            sudoReasonCode: "report_deletion_approval",
            targetType: "reports",
            targetId: reportId
          }
        : { actionScopes: "read_metadata,retry_eval" };

      await sendAdminJson<ReportExportActionResponse | ReportDeleteResponse>(
        `${apiBaseUrl}/admin-api/reports/${reportId}/${route}`,
        "POST",
        action === "approve_deletion"
          ? { reason_code: "report_deletion_approval" }
          : { reason_code: `report_${action}` },
        options
      ).catch(() => undefined);
    }

    setVaultState((current) => ({
      ...current,
      message: `${action.replaceAll("_", " ")} requested. Mutation is audited by the admin API when configured.`
    }));
  }

  return (
    <div className={rootStyle}>
      <section className={headerPanelStyle} aria-labelledby="reports-vault-title">
        <div>
          <p className={eyebrowStyle}>Privacy vault</p>
          <h2 className={titleStyle} id="reports-vault-title">
            Reports
          </h2>
          <p className={bodyTextStyle}>
            Redacted report metadata, raw locked state, failed export recovery, and deletion approval. Regeneration does not rerun evals.
          </p>
        </div>
        <span className={statePillStyle}>{vaultState.status}</span>
      </section>

      <section className={noticeStyle} aria-label="Reports vault status">
        {vaultState.message}
      </section>

      <section className={summaryGridStyle} aria-label="Report privacy states">
        {Object.entries(vaultState.response.summary).map(([label, value]) => (
          <div className={metricCardStyle} key={label}>
            <span>{label.replaceAll("_", " ")}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>

      <section className={tableWrapStyle} aria-label="Reports privacy vault table">
        <table className={tableStyle}>
          <thead>
            <tr>
              <th>Report ID</th>
              <th>Workspace</th>
              <th>Format</th>
              <th>Privacy state</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {vaultState.response.reports.map((report) => (
              <tr key={`${report.report_id}-${report.format}-${report.privacy_state}`}>
                <td>
                  <strong>{report.report_id}</strong>
                  <span className={subtleLineStyle}>{report.redacted_summary}</span>
                </td>
                <td>{report.workspace}</td>
                <td>{report.format}</td>
                <td>
                  <span className={statusBadgeStyle}>{report.privacy_state}</span>
                </td>
                <td>{report.status}</td>
                <td>
                  <button className={buttonStyle} type="button" onClick={() => void handleAction(report.action, report.report_id)}>
                    {report.action.replaceAll("_", " ")}
                  </button>
                  {report.deletion_note ? <span className={subtleLineStyle}>{report.deletion_note}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default AdminReportsVaultScreen;

function createLocalReportsResponse(): AdminReportsResponse {
  return {
    summary: {
      ready_redacted: 2,
      raw_locked: 1,
      failed_export: 1,
      deletion_pending: 1,
      deleted: 1
    },
    reports: [
      {
        report_id: "report_support_classifier_shell",
        workspace: "Acme AI",
        format: "json",
        privacy_state: "ready_redacted",
        status: "ready",
        action: "open_redacted",
        redacted_summary: "Redacted report metadata; eval-backed recommendation is available.",
        artifact_id: "report_artifact_ready",
        storage_uri: "memory://reports/report_support_classifier_shell.json",
        generated_at: "2026-01-15T12:00:00.000Z",
        deletion_note: null
      },
      {
        report_id: "report_support_classifier_shell",
        workspace: "Acme AI",
        format: "markdown",
        privacy_state: "ready_redacted",
        status: "ready",
        action: "regenerate_export",
        redacted_summary: "Redacted markdown export can be regenerated from the eval snapshot.",
        artifact_id: "report_artifact_regenerate",
        storage_uri: "memory://reports/report_support_classifier_shell.md",
        generated_at: "2026-01-15T12:00:00.000Z",
        deletion_note: null
      },
      {
        report_id: "report_support_classifier_shell",
        workspace: "Acme AI",
        format: "json",
        privacy_state: "raw_locked",
        status: "ready",
        action: "request_sudo_for_raw",
        redacted_summary: "Raw report content is locked behind sudo and reason code.",
        artifact_id: null,
        storage_uri: null,
        generated_at: "2026-01-15T12:00:00.000Z",
        deletion_note: null
      },
      {
        report_id: "report_failed_export_demo",
        workspace: "Acme AI",
        format: "markdown",
        privacy_state: "failed_export",
        status: "exported",
        action: "retry_export",
        redacted_summary: "Export failed checksum confirmation; retry is available.",
        artifact_id: "report_artifact_failed",
        storage_uri: "memory://reports/failed.markdown",
        generated_at: "2026-01-15T12:00:00.000Z",
        deletion_note: null
      },
      {
        report_id: "report_delete_pending_demo",
        workspace: "Acme AI",
        format: "json",
        privacy_state: "deletion_pending",
        status: "blocked",
        action: "approve_deletion",
        redacted_summary: "Deletion request is pending approval.",
        artifact_id: "report_artifact_pending_delete",
        storage_uri: "memory://reports/delete-pending.json",
        generated_at: null,
        deletion_note: "Scoped artifacts will be marked deleted; object storage cleanup is mocked."
      },
      {
        report_id: "report_deleted_demo",
        workspace: "Acme AI",
        format: "json",
        privacy_state: "deleted",
        status: "blocked",
        action: "open_redacted",
        redacted_summary: "Report artifact has been marked deleted.",
        artifact_id: "report_artifact_deleted",
        storage_uri: "deleted://report_artifact_deleted",
        generated_at: null,
        deletion_note: "Deleted artifacts are unavailable."
      }
    ],
    notes: ["Local reports are synthetic and redacted."]
  };
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
    color: "#a9b9b0",
    textTransform: "capitalize"
  },
  strong: {
    color: "#ffffff",
    fontSize: "1.5rem"
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
  minWidth: "900px",
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
    verticalAlign: "top"
  },
  td: {
    color: "#edf5ef",
    overflowWrap: "anywhere"
  }
});

const subtleLineStyle = css({
  display: "block",
  marginTop: "5px",
  color: "#9fbaaa",
  fontSize: "0.82rem"
});

const statusBadgeStyle = css({
  display: "inline-block",
  border: "1px solid #526a5d",
  borderRadius: "8px",
  padding: "4px 8px",
  color: "#dcebe0"
});

const buttonStyle = css({
  minHeight: "40px",
  border: "1px solid #b8d1c0",
  borderRadius: "8px",
  background: "#dcebe0",
  color: "#101713",
  cursor: "pointer",
  fontWeight: 800,
  marginTop: "4px",
  padding: "9px 11px"
});
