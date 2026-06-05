import { useEffect, useState } from "react";
import { css } from "@emotion/css";
import type { ReportExportResponse } from "@promptopts/api";
import StatusBadge from "../../components/StatusBadge";
import StatusNotice from "../../components/StatusNotice";
import type { PromptOptsApiClient } from "../../apiClient";
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

type ExportFormat = "markdown" | "json" | "pdf";

function ExportScreen({
  apiClient,
  reportId
}: {
  apiClient: PromptOptsApiClient | null;
  reportId: string;
}) {
  const [format, setFormat] = useState<ExportFormat>("json");
  const [exportState, setExportState] = useState<{
    response: ReportExportResponse;
    status: "local" | "loading" | "ready" | "error";
    message: string;
  }>(() => ({
    response: createLocalExportResponse("json"),
    status: apiClient && reportId !== demoReport.id ? "loading" : "local",
    message:
      apiClient && reportId !== demoReport.id
        ? "Loading export package."
        : "Local demo export package; generated API exports appear here after report creation."
  }));

  useEffect(() => {
    let isMounted = true;

    async function loadExport() {
      if (!apiClient || reportId === demoReport.id) {
        setExportState({
          response: createLocalExportResponse(format),
          status: "local",
          message: "Local demo export package; generated API exports appear here after report creation."
        });
        return;
      }

      setExportState((current) => ({ ...current, status: "loading", message: `Loading ${format} export.` }));

      try {
        const response = await apiClient.exportReport(reportId, format);

        if (!isMounted) {
          return;
        }

        setExportState({
          response,
          status: "ready",
          message: `${format.toUpperCase()} export generated with redacted share package.`
        });
      } catch {
        if (isMounted) {
          setExportState({
            response: createLocalExportResponse(format),
            status: "error",
            message: "Report export API failed; showing local demo package."
          });
        }
      }
    }

    void loadExport();

    return () => {
      isMounted = false;
    };
  }, [apiClient, format, reportId]);

  return (
    <div className={contentStackStyle}>
      <section className={heroBandStyle} aria-labelledby="export-title">
        <div>
          <p className={sectionEyebrowStyle}>Deploy package export</p>
          <h2 className={sectionTitleStyle} id="export-title">
            Redacted by default
          </h2>
          <p className={sectionTextStyle}>
            Markdown, JSON, and PDF-stub exports preserve the eval snapshot without exposing raw prompts.
          </p>
        </div>
        <StatusBadge label="Report" value={exportState.response.report.status} tone={exportState.response.report.status === "ready" ? "good" : "warn"} />
      </section>

      <StatusNotice
        tone={exportState.status === "error" ? "warn" : "good"}
        title="Export package"
        body={exportState.message}
      />

      <section className={formatButtonRowStyle} aria-label="Export format actions">
        {(["markdown", "json", "pdf"] as const).map((item) => (
          <button
            className={item === format ? selectedFormatButtonStyle : secondaryButtonStyle}
            key={item}
            type="button"
            onClick={() => setFormat(item)}
          >
            {item.toUpperCase()}
          </button>
        ))}
      </section>

      <section className={cardGridStyle} aria-label="Export artifacts">
        {exportState.response.artifacts.map((artifact) => (
          <article className={artifactCardStyle} key={artifact.id}>
            <p className={cardKickerStyle}>{artifact.redaction_state}</p>
            <h3 className={cardTitleStyle}>{artifact.format.toUpperCase()}</h3>
            <p className={cardTextStyle}>{artifact.storage_uri}</p>
          </article>
        ))}
      </section>

      <section className={artifactPreviewStyle} aria-label="Selected export preview">
        <div>
          <p className={cardKickerStyle}>Selected export</p>
          <h3 className={cardTitleStyle}>{exportState.response.export_package.filename}</h3>
          <p className={cardTextStyle}>
            {exportState.response.export_package.content_type} / {exportState.response.export_package.redaction_state}
          </p>
        </div>
        <pre className={contentPreviewStyle}>{exportState.response.export_package.content}</pre>
      </section>

      <section className={artifactPreviewStyle} aria-label="Redacted share package">
        <div>
          <p className={cardKickerStyle}>Share package</p>
          <h3 className={cardTitleStyle}>Redacted eval snapshot</h3>
          <p className={cardTextStyle}>Default sharing keeps prompts private and includes developer-ready implementation notes.</p>
        </div>
        <pre className={contentPreviewStyle}>
          {JSON.stringify(exportState.response.export_package.redacted_share_package, null, 2)}
        </pre>
      </section>
    </div>
  );
}

export default ExportScreen;

function createLocalExportResponse(format: ExportFormat): ReportExportResponse {
  const artifact = demoReportArtifacts.find((item) => item.format === format) ?? demoReportArtifacts[0];

  return {
    report: demoReport,
    artifacts: demoReportArtifacts,
    export_package: {
      format,
      download_url: artifact?.storage_uri ?? `mock://reports/${demoReport.id}/${format}`,
      redaction_state: "redacted",
      filename: `${demoReport.id}.${format === "markdown" ? "md" : format}`,
      content_type: format === "json" ? "application/json" : format === "pdf" ? "application/pdf" : "text/markdown",
      content: createLocalExportContent(format),
      redacted_share_package: {
        report_id: demoReport.id,
        redaction_state: "redacted",
        summary: "Local demo export. Run evals before switching.",
        implementation_notes: ["Keep baseline available as rollback.", "Verify model registry sources before exact savings claims."]
      },
      eval_snapshot: {
        eval_run_id: demoReport.eval_run_id,
        result_count: 0,
        status: "queued"
      },
      todo: "Local demo package; API export returns generated content inline."
    }
  };
}

function createLocalExportContent(format: ExportFormat): string {
  if (format === "markdown") {
    return "# PromptOpts Recommendation Report\n\nRedacted local demo export. Run evals before switching.";
  }

  if (format === "pdf") {
    return "%PDF-1.4\n% PromptOpts local PDF export stub\n%%EOF";
  }

  return JSON.stringify(
    {
      report_id: demoReport.id,
      redaction_state: "redacted",
      production_recommendation_allowed: demoReport.production_recommendation_allowed
    },
    null,
    2
  );
}

const formatButtonRowStyle = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "10px"
});

const secondaryButtonStyle = css({
  minHeight: "40px",
  border: "1px solid #bfc3b8",
  borderRadius: "8px",
  background: "#fffef9",
  color: "#1e2a20",
  padding: "0 14px",
  fontWeight: 700,
  ":hover": {
    borderColor: "#83907f",
    background: "#f7fbf0"
  },
  ":focus-visible": {
    outline: "2px solid #6b8cff",
    outlineOffset: "2px"
  }
});

const selectedFormatButtonStyle = css({
  minHeight: "40px",
  border: "1px solid #1e2a20",
  borderRadius: "8px",
  background: "#1e2a20",
  color: "#ffffff",
  padding: "0 14px",
  fontWeight: 700,
  ":focus-visible": {
    outline: "2px solid #6b8cff",
    outlineOffset: "2px"
  }
});

const artifactCardStyle = css({
  minHeight: "150px",
  border: "1px solid #d7d6ca",
  borderRadius: "8px",
  background: "#fffef9",
  padding: "16px"
});

const artifactPreviewStyle = css({
  display: "grid",
  gap: "14px",
  border: "1px solid #d7d6ca",
  borderRadius: "8px",
  background: "#fffef9",
  padding: "18px"
});

const contentPreviewStyle = css({
  maxHeight: "360px",
  overflow: "auto",
  margin: 0,
  border: "1px solid #d7d6ca",
  borderRadius: "8px",
  background: "#171b18",
  color: "#eef1e9",
  padding: "14px",
  fontSize: "0.84rem",
  lineHeight: 1.5,
  whiteSpace: "pre-wrap"
});
