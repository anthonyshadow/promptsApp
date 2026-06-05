import { useEffect, useState } from "react";
import { css } from "@emotion/css";
import type { AdminEvalRunDetailResponse, AdminEvalRunsResponse } from "@promptopts/api";
import { fetchAdminJson, sendAdminJson } from "./adminApi";

function AdminEvalJobsScreen({ apiBaseUrl }: { apiBaseUrl?: string | undefined }) {
  const [jobsState, setJobsState] = useState<{
    response: AdminEvalRunsResponse;
    detail: AdminEvalRunDetailResponse;
    status: "local" | "loading" | "ready" | "error";
    message: string;
  }>(() => ({
    response: createLocalEvalJobsResponse(),
    detail: createLocalEvalJobDetail(),
    status: apiBaseUrl ? "loading" : "local",
    message: apiBaseUrl
      ? "Loading sanitized eval job metadata."
      : "Local sanitized eval job control; configure VITE_API_URL to read /admin-api/eval-runs."
  }));
  const selectedJobId = jobsState.detail.detail.eval_run.id;

  useEffect(() => {
    let isMounted = true;

    async function loadEvalJobs() {
      if (!apiBaseUrl) {
        setJobsState({
          response: createLocalEvalJobsResponse(),
          detail: createLocalEvalJobDetail(),
          status: "local",
          message: "Local sanitized eval job control; configure VITE_API_URL to read /admin-api/eval-runs."
        });
        return;
      }

      try {
        const response = await fetchAdminJson<AdminEvalRunsResponse>(`${apiBaseUrl}/admin-api/eval-runs`);
        const firstJobId = response.jobs[0]?.id ?? "eval_run_support_classifier_demo";
        const detail = await fetchAdminJson<AdminEvalRunDetailResponse>(
          `${apiBaseUrl}/admin-api/eval-runs/${firstJobId}`
        );

        if (!isMounted) {
          return;
        }

        setJobsState({
          response,
          detail,
          status: "ready",
          message: "Eval job metadata loaded through guarded admin API; payloads are sanitized."
        });
      } catch {
        if (isMounted) {
          setJobsState({
            response: createLocalEvalJobsResponse(),
            detail: createLocalEvalJobDetail(),
            status: "error",
            message: "Eval job API failed; showing local sanitized queue metadata."
          });
        }
      }
    }

    void loadEvalJobs();

    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl]);

  async function loadJobDetail(jobId: string) {
    if (!apiBaseUrl) {
      setJobsState((current) => ({
        ...current,
        detail: createLocalEvalJobDetail(jobId),
        message: "Local detail loaded; raw prompts remain hidden."
      }));
      return;
    }

    try {
      const detail = await fetchAdminJson<AdminEvalRunDetailResponse>(
        `${apiBaseUrl}/admin-api/eval-runs/${jobId}`
      );
      setJobsState((current) => ({
        ...current,
        detail,
        message: "Sanitized eval job detail loaded."
      }));
    } catch {
      setJobsState((current) => ({
        ...current,
        message: "Eval job detail failed; retaining last sanitized detail."
      }));
    }
  }

  async function handleAction(action: "retry" | "cancel" | "regenerate-report") {
    const reason = `admin_eval_job_${action}`;

    if (apiBaseUrl) {
      await sendAdminJson(
        `${apiBaseUrl}/admin-api/eval-runs/${selectedJobId}/${action}`,
        "POST",
        { reason_code: reason },
        { actionScopes: "read_metadata,retry_eval" }
      ).catch(() => undefined);
    }

    setJobsState((current) => ({
      ...current,
      message: `${action.replaceAll("-", " ")} requested. Mutation is audited by the admin API when configured.`
    }));
  }

  return (
    <div className={rootStyle}>
      <section className={headerPanelStyle} aria-labelledby="admin-eval-jobs-title">
        <div>
          <p className={eyebrowStyle}>Eval operations</p>
          <h2 className={titleStyle} id="admin-eval-jobs-title">
            Eval job control
          </h2>
          <p className={bodyTextStyle}>
            Queue state, worker health, sanitized job detail, and audited operator actions. Raw prompt logs stay hidden without sudo.
          </p>
        </div>
        <span className={statePillStyle}>{jobsState.status}</span>
      </section>

      <section className={noticeStyle} aria-label="Eval job status">
        {jobsState.message}
      </section>

      <section className={summaryGridStyle} aria-label="Queue summary">
        {Object.entries(jobsState.response.queue_summary).map(([label, value]) => (
          <div className={metricCardStyle} key={label}>
            <span>{label.replaceAll("_", " ")}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>

      <section className={workerGridStyle} aria-label="Worker health">
        {jobsState.response.worker_health.map((worker) => (
          <article className={workerCardStyle} key={worker.component}>
            <span className={workerStatusStyle}>{worker.status}</span>
            <h3>{worker.component}</h3>
            <p>{worker.redacted_summary}</p>
          </article>
        ))}
      </section>

      <section className={tableWrapStyle} aria-label="Eval job table">
        <table className={tableStyle}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Workspace</th>
              <th>Provider</th>
              <th>Status</th>
              <th>Age</th>
              <th>Progress</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {jobsState.response.jobs.map((job) => (
              <tr key={job.id}>
                <td>
                  <button className={linkButtonStyle} type="button" onClick={() => void loadJobDetail(job.id)}>
                    {job.id}
                  </button>
                </td>
                <td>{job.workspace}</td>
                <td>{job.provider}</td>
                <td>
                  <span className={statusBadgeStyle}>{job.status}</span>
                </td>
                <td>{formatAge(job.age_seconds)}</td>
                <td>{formatPercent(job.progress)}</td>
                <td>{job.action.replaceAll("_", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={detailGridStyle} aria-label="Eval job detail">
        <article className={detailPanelStyle}>
          <h3>Job detail</h3>
          <dl className={detailListStyle}>
            <div>
              <dt>Models</dt>
              <dd>{jobsState.detail.model_ids.join(", ")}</dd>
            </div>
            <div>
              <dt>Test count</dt>
              <dd>{jobsState.detail.test_count}</dd>
            </div>
            <div>
              <dt>Failed checks</dt>
              <dd>{jobsState.detail.failed_checks.length}</dd>
            </div>
            <div>
              <dt>Provider error</dt>
              <dd>{jobsState.detail.sanitized_provider_error ?? "None visible"}</dd>
            </div>
          </dl>
          <div className={actionGroupStyle}>
            <button className={buttonStyle} type="button" onClick={() => void handleAction("retry")}>
              Retry
            </button>
            <button className={buttonStyle} type="button" onClick={() => void handleAction("cancel")}>
              Cancel
            </button>
            <button className={buttonStyle} type="button" onClick={() => void handleAction("regenerate-report")}>
              Regenerate report
            </button>
          </div>
        </article>

        <article className={detailPanelStyle}>
          <h3>Sanitized payload</h3>
          <pre className={payloadStyle}>{JSON.stringify(jobsState.detail.sanitized_payload, null, 2)}</pre>
          <h3>Retry hints</h3>
          <ul className={hintListStyle}>
            {jobsState.detail.retry_hints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  );
}

export default AdminEvalJobsScreen;

function createLocalEvalJobsResponse(): AdminEvalRunsResponse {
  return {
    queue_summary: {
      queued: 1,
      running: 0,
      failed: 0,
      retrying: 0,
      rate_limited: 0
    },
    worker_health: [
      {
        component: "eval-runner",
        status: "mocked",
        redacted_summary: "Memory-backed eval queue metadata is visible."
      },
      {
        component: "provider-adapter",
        status: "mocked",
        redacted_summary: "Provider adapter is mocked; no live provider payloads are shown."
      },
      {
        component: "scoring",
        status: "mocked",
        redacted_summary: "Deterministic score rows appear as they are written."
      },
      {
        component: "report-generator",
        status: "mocked",
        redacted_summary: "Report regeneration is a mocked operator action."
      }
    ],
    jobs: [
      {
        id: "eval_run_support_classifier_demo",
        workspace: "Acme AI",
        provider: "openai",
        status: "queued",
        age_seconds: 300,
        progress: 0,
        action: "cancel",
        redaction_state: "redacted"
      }
    ],
    notes: ["Local data is redacted and synthetic."]
  };
}

function createLocalEvalJobDetail(evalRunId = "eval_run_support_classifier_demo"): AdminEvalRunDetailResponse {
  return {
    detail: {
      eval_run: {
        id: evalRunId,
        project_id: "project_support_classifier",
        quality_contract_id: "quality_contract_support_classifier",
        baseline_prompt_version_id: "prompt_version_support_classifier_v1",
        candidate_ids: ["candidate_support_classifier_baseline", "candidate_support_classifier_balanced"],
        model_registry_record_ids: ["model_registry_openai_demo_balanced"],
        status: "queued",
        pass_threshold: 0.95,
        is_mock: true,
        queued_at: "2026-01-15T12:00:00.000Z",
        started_at: null,
        completed_at: null
      },
      results: [],
      frontier_points: [],
      failures: [],
      retry_hints: ["No eval rows are available yet; verify quality contract, candidates, and model shortlist."],
      status_note: "Eval run is queued; 0 partial row(s) are available."
    },
    sanitized_payload: {
      eval_run_id: evalRunId,
      project_id: "project_support_classifier",
      quality_contract_id: "quality_contract_support_classifier",
      baseline_prompt_version_id: "prompt_version_support_classifier_v1",
      candidate_ids: ["candidate_support_classifier_baseline", "candidate_support_classifier_balanced"],
      model_registry_record_ids: ["model_registry_openai_demo_balanced"],
      redaction_state: "redacted"
    },
    model_ids: ["openai-demo-balanced"],
    test_count: 5,
    failed_checks: [],
    sanitized_provider_error: null,
    retry_hints: ["No eval rows are available yet; verify quality contract, candidates, and model shortlist."],
    worker_health: createLocalEvalJobsResponse().worker_health
  };
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatAge(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m`;
  }

  return `${Math.floor(seconds / 3600)}h`;
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

const workerGridStyle = css({
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

const workerCardStyle = css({
  border: "1px solid #415149",
  borderRadius: "8px",
  background: "#17211d",
  padding: "14px",
  h3: {
    margin: "8px 0",
    color: "#ffffff",
    fontSize: "1rem"
  },
  p: {
    margin: 0,
    color: "#c7d6ce",
    lineHeight: 1.45
  }
});

const workerStatusStyle = css({
  display: "inline-block",
  border: "1px solid #6f8878",
  borderRadius: "8px",
  padding: "3px 7px",
  color: "#dcebe0",
  fontSize: "0.78rem"
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
  borderCollapse: "collapse",
  minWidth: "780px",
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

const linkButtonStyle = css({
  border: 0,
  background: "transparent",
  color: "#dcebe0",
  cursor: "pointer",
  fontWeight: 800,
  padding: 0,
  textAlign: "left",
  ":hover": {
    textDecoration: "underline"
  }
});

const statusBadgeStyle = css({
  display: "inline-block",
  border: "1px solid #526a5d",
  borderRadius: "8px",
  padding: "4px 8px",
  color: "#dcebe0"
});

const detailGridStyle = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.1fr)",
  gap: "12px",
  "@media (max-width: 900px)": {
    gridTemplateColumns: "1fr"
  }
});

const detailPanelStyle = css({
  border: "1px solid #415149",
  borderRadius: "8px",
  background: "#17211d",
  padding: "18px",
  h3: {
    margin: "0 0 12px",
    color: "#ffffff"
  }
});

const detailListStyle = css({
  display: "grid",
  gap: "12px",
  margin: 0,
  div: {
    display: "grid",
    gap: "4px"
  },
  dt: {
    color: "#9fbaaa",
    fontSize: "0.78rem",
    textTransform: "uppercase"
  },
  dd: {
    margin: 0,
    color: "#edf5ef"
  }
});

const actionGroupStyle = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  marginTop: "16px"
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

const payloadStyle = css({
  maxWidth: "100%",
  overflowX: "auto",
  WebkitOverflowScrolling: "touch",
  border: "1px solid #33463d",
  borderRadius: "8px",
  background: "#101713",
  color: "#dcebe0",
  padding: "12px",
  lineHeight: 1.45
});

const hintListStyle = css({
  margin: 0,
  paddingLeft: "18px",
  color: "#c7d6ce",
  lineHeight: 1.55
});
