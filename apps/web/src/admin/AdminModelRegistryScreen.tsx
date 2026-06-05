import { useEffect, useState } from "react";
import { css } from "@emotion/css";
import type { AdminModelRegistryResponse, ModelApproveResponse } from "@promptopts/api";
import { fetchAdminJson, sendAdminJson } from "./adminApi";

function AdminModelRegistryScreen({ apiBaseUrl }: { apiBaseUrl?: string | undefined }) {
  const [registryState, setRegistryState] = useState<{
    response: AdminModelRegistryResponse;
    status: "local" | "loading" | "ready" | "error";
    message: string;
  }>(() => ({
    response: createLocalRegistryResponse(),
    status: apiBaseUrl ? "loading" : "local",
    message: apiBaseUrl
      ? "Loading model registry metadata."
      : "Local model registry metadata; configure VITE_API_URL to read /admin-api/models."
  }));

  useEffect(() => {
    let isMounted = true;

    async function loadRegistry() {
      if (!apiBaseUrl) {
        setRegistryState({
          response: createLocalRegistryResponse(),
          status: "local",
          message: "Local model registry metadata; configure VITE_API_URL to read /admin-api/models."
        });
        return;
      }

      try {
        const response = await fetchAdminJson<AdminModelRegistryResponse>(`${apiBaseUrl}/admin-api/models`);
        if (!isMounted) {
          return;
        }

        setRegistryState({
          response,
          status: "ready",
          message: "Registry loaded through guarded admin API. Public recommendations use active rows only."
        });
      } catch {
        if (isMounted) {
          setRegistryState({
            response: createLocalRegistryResponse(),
            status: "error",
            message: "Model registry API failed; showing local metadata and pending proposal."
          });
        }
      }
    }

    void loadRegistry();

    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl]);

  async function handleApprove(modelId: string, sourceUrl: string) {
    if (apiBaseUrl) {
      const approved = await sendAdminJson<ModelApproveResponse>(
        `${apiBaseUrl}/admin-api/models/${modelId}/approve`,
        "POST",
        {
          verified_by: "admin_user_mock",
          source_url: sourceUrl,
          last_verified_at: new Date().toISOString(),
          reason_code: "registry_admin_approval"
        },
        {
          actionScopes: "read_metadata,manage_model_registry",
          sudoReasonCode: "registry_admin_approval"
        }
      ).catch(() => null);

      if (approved) {
        setRegistryState((current) => ({
          ...current,
          message: "Registry proposal approved. Active metadata is now available for public recommendation logic."
        }));
        return;
      }
    }

    setRegistryState((current) => ({
      ...current,
      message: "Local approval simulated. Real approval requires sudo and writes admin audit logs."
    }));
  }

  return (
    <div className={rootStyle}>
      <section className={headerPanelStyle} aria-labelledby="admin-model-registry-title">
        <div>
          <p className={eyebrowStyle}>Registry operations</p>
          <h2 className={titleStyle} id="admin-model-registry-title">
            Model registry
          </h2>
          <p className={bodyTextStyle}>
            Model metadata, freshness, pending diffs, and approval controls. Stale or demo rows block exact savings claims.
          </p>
        </div>
        <span className={statePillStyle}>{registryState.status}</span>
      </section>

      <section className={noticeStyle} aria-label="Registry status">
        {registryState.message}
      </section>

      <section className={summaryGridStyle} aria-label="Freshness summary">
        {Object.entries(registryState.response.freshness_summary).map(([label, value]) => (
          <div className={metricCardStyle} key={label}>
            <span>{label.replaceAll("_", " ")}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>

      <section className={tableWrapStyle} aria-label="Model registry table">
        <table className={tableStyle}>
          <thead>
            <tr>
              <th>Provider</th>
              <th>Model ID</th>
              <th>Display name</th>
              <th>Input / output / cached</th>
              <th>Context</th>
              <th>Capabilities</th>
              <th>Stability</th>
              <th>Source</th>
              <th>Verified</th>
            </tr>
          </thead>
          <tbody>
            {registryState.response.models.map((model) => (
              <tr key={model.id}>
                <td>{model.provider}</td>
                <td>{model.model_id}</td>
                <td>
                  <strong>{model.display_name}</strong>
                  <span className={subtleLineStyle}>
                    {model.active_for_public_recommendations ? "active metadata" : "not active for exact claims"}
                  </span>
                </td>
                <td>
                  {formatPrice(model.input_price_per_million_tokens)} / {formatPrice(model.output_price_per_million_tokens)} /{" "}
                  {model.cached_input_price_per_million_tokens === null ? "none" : formatPrice(model.cached_input_price_per_million_tokens)}
                </td>
                <td>{formatNumber(model.context_window)}</td>
                <td>{formatCapabilities(model.capabilities)}</td>
                <td>
                  {model.stability_status}
                  <span className={subtleLineStyle}>{model.freshness_status}</span>
                </td>
                <td>
                  {model.source_url ? (
                    <a className={sourceLinkStyle} href={model.source_url}>
                      Official source
                    </a>
                  ) : (
                    "Missing"
                  )}
                </td>
                <td>
                  {model.last_verified_at ?? "Unverified"}
                  <span className={subtleLineStyle}>{model.verified_by ?? "No verifier"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={diffGridStyle} aria-label="Registry diff viewer">
        {registryState.response.proposed_changes.map((proposal) => (
          <article className={diffPanelStyle} key={proposal.version.id}>
            <div className={diffHeaderStyle}>
              <div>
                <h3>{proposal.display_name}</h3>
                <p>{proposal.model_id}</p>
              </div>
              <span className={statePillStyle}>{proposal.version.approval_state}</span>
            </div>
            <dl className={proposalMetaStyle}>
              <div>
                <dt>Source URL</dt>
                <dd>{proposal.version.source_url}</dd>
              </div>
              <div>
                <dt>Verified by</dt>
                <dd>{proposal.version.verified_by ?? "Pending"}</dd>
              </div>
              <div>
                <dt>Last verified</dt>
                <dd>{proposal.version.last_verified_at ?? "Pending"}</dd>
              </div>
            </dl>
            <table className={diffTableStyle}>
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Before</th>
                  <th>After</th>
                </tr>
              </thead>
              <tbody>
                {proposal.diff.map((entry) => (
                  <tr key={entry.field}>
                    <td>{entry.field}</td>
                    <td>{String(entry.before)}</td>
                    <td>{String(entry.after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={actionGroupStyle}>
              <button
                className={buttonStyle}
                type="button"
                onClick={() => void handleApprove(proposal.version.model_registry_id, proposal.version.source_url)}
              >
                Approve
              </button>
              <button className={disabledButtonStyle} type="button" disabled>
                Reject
              </button>
              <span className={actionNoteStyle}>{proposal.approval_actions.note}</span>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

export default AdminModelRegistryScreen;

function createLocalRegistryResponse(): AdminModelRegistryResponse {
  return {
    freshness_summary: {
      fresh: 0,
      stale: 0,
      deprecated: 0,
      preview_experimental: 0,
      unverified: 1
    },
    models: [
      {
        id: "model_registry_openai_demo_balanced",
        provider: "openai",
        model_id: "openai-demo-balanced",
        display_name: "OpenAI Demo Balanced",
        input_price_per_million_tokens: 1,
        output_price_per_million_tokens: 4,
        cached_input_price_per_million_tokens: null,
        context_window: 128000,
        capabilities: {
          text: true,
          image: false,
          audio: false,
          video: false,
          tools: true,
          structured_output: true
        },
        stability_status: "unverified",
        freshness_status: "unverified",
        source_url: "https://example.com/promptopts/demo-model-registry",
        last_verified_at: null,
        verified_by: null,
        pricing_note: "Demo placeholder pricing only; not production model metadata.",
        active_for_public_recommendations: false,
        pending_version_id: "model_registry_version_openai_balanced_pending"
      }
    ],
    proposed_changes: [
      {
        version: {
          id: "model_registry_version_openai_balanced_pending",
          model_registry_id: "model_registry_openai_demo_balanced",
          version_number: 1,
          registry_payload: {
            display_name: "OpenAI Demo Balanced Verified Draft",
            freshness_status: "fresh",
            stability_status: "stable"
          },
          source_url: "https://example.com/promptopts/demo-model-registry",
          last_verified_at: "2026-01-16T12:00:00.000Z",
          verified_by: "admin_user_demo",
          approval_state: "pending_review",
          approved_by_admin_user_id: null,
          approved_at: null,
          change_reason: "Demo pending source verification proposal.",
          is_mock: true,
          created_at: "2026-01-15T12:00:00.000Z"
        },
        model_id: "openai-demo-balanced",
        display_name: "OpenAI Demo Balanced",
        diff: [
          {
            field: "display_name",
            before: "OpenAI Demo Balanced",
            after: "OpenAI Demo Balanced Verified Draft"
          },
          {
            field: "freshness_status",
            before: "unverified",
            after: "fresh"
          }
        ],
        approval_actions: {
          approve_enabled: true,
          reject_enabled: false,
          note: "Approve is implemented; reject remains placeholder-only until a reject route is added."
        }
      }
    ],
    registry_note:
      "Admin registry rows are metadata only. PATCH creates pending proposals; approval publishes active metadata used by public recommendations."
  };
}

function formatPrice(value: number): string {
  return `$${value.toFixed(2)}/1M`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatCapabilities(capabilities: AdminModelRegistryResponse["models"][number]["capabilities"]): string {
  return Object.entries(capabilities)
    .filter((entry) => entry[1])
    .map((entry) => entry[0].replaceAll("_", " "))
    .join(", ");
}

const rootStyle = css({
  display: "grid",
  gap: "18px",
  marginTop: "28px"
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
  }
});

const metricCardStyle = css({
  border: "1px solid #415149",
  borderRadius: "8px",
  background: "#17211d",
  padding: "14px",
  display: "grid",
  gap: "8px",
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
  overflowX: "auto",
  border: "1px solid #415149",
  borderRadius: "8px",
  background: "#17211d"
});

const tableStyle = css({
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "1080px",
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
    color: "#edf5ef"
  }
});

const subtleLineStyle = css({
  display: "block",
  marginTop: "5px",
  color: "#9fbaaa",
  fontSize: "0.82rem"
});

const sourceLinkStyle = css({
  color: "#dcebe0",
  fontWeight: 800
});

const diffGridStyle = css({
  display: "grid",
  gap: "12px"
});

const diffPanelStyle = css({
  border: "1px solid #415149",
  borderRadius: "8px",
  background: "#17211d",
  padding: "18px"
});

const diffHeaderStyle = css({
  display: "flex",
  alignItems: "start",
  justifyContent: "space-between",
  gap: "12px",
  h3: {
    margin: 0,
    color: "#ffffff"
  },
  p: {
    margin: "6px 0 0",
    color: "#9fbaaa"
  }
});

const proposalMetaStyle = css({
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "10px",
  margin: "16px 0",
  "@media (max-width: 760px)": {
    gridTemplateColumns: "1fr"
  },
  dt: {
    color: "#9fbaaa",
    fontSize: "0.78rem",
    textTransform: "uppercase"
  },
  dd: {
    margin: "4px 0 0",
    color: "#edf5ef",
    overflowWrap: "anywhere"
  }
});

const diffTableStyle = css({
  width: "100%",
  borderCollapse: "collapse",
  th: {
    color: "#9fbaaa",
    fontSize: "0.78rem",
    textAlign: "left",
    textTransform: "uppercase"
  },
  "th, td": {
    borderTop: "1px solid #33463d",
    padding: "10px",
    verticalAlign: "top"
  },
  td: {
    color: "#edf5ef"
  }
});

const actionGroupStyle = css({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "8px",
  marginTop: "16px"
});

const buttonStyle = css({
  border: "1px solid #b8d1c0",
  borderRadius: "8px",
  background: "#dcebe0",
  color: "#101713",
  cursor: "pointer",
  fontWeight: 800,
  padding: "9px 11px"
});

const disabledButtonStyle = css({
  border: "1px solid #526a5d",
  borderRadius: "8px",
  background: "#26352e",
  color: "#9fbaaa",
  cursor: "not-allowed",
  fontWeight: 800,
  padding: "9px 11px"
});

const actionNoteStyle = css({
  color: "#c7d6ce",
  fontSize: "0.9rem"
});
