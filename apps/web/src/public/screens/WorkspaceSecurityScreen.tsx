import { useEffect, useMemo, useState } from "react";
import { css } from "@emotion/css";
import type { ProviderConnectionMetadata } from "@promptopts/api";
import type { Provider } from "@promptopts/shared";
import Field from "../../components/Field";
import StatusBadge from "../../components/StatusBadge";
import StatusNotice from "../../components/StatusNotice";
import type { PromptOptsApiClient } from "../../apiClient";
import { formatProvider } from "../../formatters";
import { demoWorkspace } from "../../mockData";
import {
  cardKickerStyle,
  contentStackStyle,
  heroBandStyle,
  primaryButtonStyle,
  sectionEyebrowStyle,
  sectionTextStyle,
  sectionTitleStyle,
  tableStyle,
  tableSubtextStyle,
  tableWrapStyle
} from "../../styles";

const providerOptions: Provider[] = ["openai", "anthropic", "gemini"];

function WorkspaceSecurityScreen({
  apiClient,
  workspaceSlug = demoWorkspace.slug
}: {
  apiClient: PromptOptsApiClient | null;
  workspaceSlug?: string;
}) {
  const [provider, setProvider] = useState<Provider>("openai");
  const [apiKey, setApiKey] = useState("");
  const [connections, setConnections] = useState<ProviderConnectionMetadata[]>([]);
  const [status, setStatus] = useState<{
    tone: "good" | "warn";
    title: string;
    body: string;
  }>({
    tone: apiClient ? "good" : "warn",
    title: apiClient ? "Loading provider connections" : "Local demo mode",
    body: apiClient
      ? "Fetching provider-key metadata."
      : "Configure VITE_API_URL to connect encrypted provider keys."
  });
  const workspaceId = demoWorkspace.id;
  const activeProviderConnection = useMemo(
    () =>
      connections.find(
        (connection) =>
          connection.provider === provider &&
          connection.status === "active" &&
          !connection.revoked_at
      ) ?? null,
    [connections, provider]
  );

  useEffect(() => {
    let isMounted = true;

    async function loadConnections() {
      if (!apiClient) {
        return;
      }

      try {
        const response = await apiClient.listProviderConnections(workspaceId);

        if (!isMounted) {
          return;
        }

        setConnections(response.connections);
        setStatus({
          tone: "good",
          title: "Provider keys are non-viewable",
          body: response.redaction_note
        });
      } catch (error) {
        if (isMounted) {
          setStatus({
            tone: "warn",
            title: "Provider-key metadata unavailable",
            body: error instanceof Error ? error.message : "Unknown provider-key API error."
          });
        }
      }
    }

    void loadConnections();

    return () => {
      isMounted = false;
    };
  }, [apiClient, workspaceId]);

  async function refreshConnections() {
    if (!apiClient) {
      return;
    }

    const response = await apiClient.listProviderConnections(workspaceId);
    setConnections(response.connections);
  }

  async function submitProviderKey() {
    if (!apiClient || !apiKey.trim()) {
      return;
    }

    try {
      const response = activeProviderConnection
        ? await apiClient.rotateProviderConnection(activeProviderConnection.id, {
            api_key: apiKey,
            rotated_by: null,
            reason_code: "workspace_provider_key_rotation"
          })
        : await apiClient.createProviderConnection({
            workspace_id: workspaceId,
            provider,
            api_key: apiKey,
            created_by: null
          });

      setApiKey("");
      setStatus({
        tone: "good",
        title: activeProviderConnection ? "Provider key rotated" : "Provider key connected",
        body: response.redaction_note
      });
      await refreshConnections();
    } catch (error) {
      setStatus({
        tone: "warn",
        title: "Provider key was not saved",
        body: error instanceof Error ? error.message : "Unknown provider-key save error."
      });
    }
  }

  async function revokeConnection(connectionId: string) {
    if (!apiClient) {
      return;
    }

    try {
      const response = await apiClient.revokeProviderConnection(connectionId, {
        revoked_by: null,
        reason_code: "workspace_provider_key_revoked"
      });

      setStatus({
        tone: "good",
        title: "Provider key revoked",
        body: response.redaction_note
      });
      await refreshConnections();
    } catch (error) {
      setStatus({
        tone: "warn",
        title: "Provider key was not revoked",
        body: error instanceof Error ? error.message : "Unknown provider-key revoke error."
      });
    }
  }

  return (
    <div className={contentStackStyle}>
      <section className={heroBandStyle} aria-labelledby="workspace-security-title">
        <div>
          <p className={sectionEyebrowStyle}>{workspaceSlug}</p>
          <h2 className={sectionTitleStyle} id="workspace-security-title">
            Provider keys
          </h2>
          <p className={sectionTextStyle}>
            Connect BYOK credentials for evals. Keys are encrypted at rest and never viewable after save.
          </p>
        </div>
        <StatusBadge label="Trust" value="Non-viewable" tone="good" />
      </section>

      <StatusNotice tone={status.tone} title={status.title} body={status.body} />

      <section className={formPanelStyle} aria-label="Connect provider key">
        <div>
          <p className={cardKickerStyle}>BYOK connection</p>
          <h3 className={panelTitleStyle}>Connect or rotate a provider key</h3>
          <p className={panelTextStyle}>
            The browser sends the raw key only on submit. The API returns fingerprint metadata, not the key.
          </p>
        </div>

        <div className={formGridStyle}>
          <Field label="Provider">
            <select
              className={inputStyle}
              id="provider-key-provider"
              value={provider}
              onChange={(event) => setProvider(event.target.value as Provider)}
            >
              {providerOptions.map((option) => (
                <option key={option} value={option}>
                  {formatProvider(option)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Provider key">
            <input
              className={inputStyle}
              id="provider-key-value"
              type="password"
              value={apiKey}
              autoComplete="off"
              placeholder="Paste key once"
              onChange={(event) => setApiKey(event.target.value)}
            />
          </Field>
        </div>

        <button
          className={primaryButtonStyle}
          type="button"
          disabled={!apiClient || apiKey.trim().length === 0}
          onClick={submitProviderKey}
        >
          {activeProviderConnection ? "Rotate key" : "Connect key"}
        </button>
      </section>

      <section className={tableSectionStyle} aria-label="Provider key metadata">
        <div className={tableHeaderStyle}>
          <div>
            <p className={sectionEyebrowStyle}>Stored metadata</p>
            <h3 className={panelTitleStyle}>Provider connections</h3>
          </div>
          <StatusBadge label="Connections" value={String(connections.length)} tone="neutral" />
        </div>
        <div className={tableWrapStyle}>
          <table className={tableStyle}>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Status</th>
                <th>Fingerprint</th>
                <th>Last used</th>
                <th>Created / rotated</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {connections.length === 0 ? (
                <tr>
                  <td colSpan={6}>No provider keys connected yet.</td>
                </tr>
              ) : (
                connections.map((connection) => (
                  <tr key={connection.id}>
                    <td>{formatProvider(connection.provider)}</td>
                    <td>{connection.status}</td>
                    <td>
                      <code className={fingerprintStyle}>{connection.key_fingerprint}</code>
                      <span className={tableSubtextStyle}>{connection.encryption_key_id}</span>
                    </td>
                    <td>{formatDate(connection.last_used_at)}</td>
                    <td>
                      {formatDate(connection.created_at)}
                      <span className={tableSubtextStyle}>
                        Rotated {formatDate(connection.rotated_at)}
                      </span>
                    </td>
                    <td>
                      <button
                        className={secondaryButtonStyle}
                        type="button"
                        disabled={!apiClient || connection.status === "revoked"}
                        onClick={() => revokeConnection(connection.id)}
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default WorkspaceSecurityScreen;

function formatDate(value: string | null): string {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

const formPanelStyle = css({
  display: "grid",
  gap: "18px",
  border: "1px solid #d7d6ca",
  borderRadius: "8px",
  background: "#fffef9",
  padding: "22px"
});

const formGridStyle = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 220px) minmax(0, 1fr)",
  gap: "14px",
  "@media (max-width: 720px)": {
    gridTemplateColumns: "1fr"
  }
});

const panelTitleStyle = css({
  margin: 0,
  color: "#121713",
  fontSize: "1.2rem",
  lineHeight: 1.25,
  letterSpacing: 0
});

const panelTextStyle = css({
  margin: "8px 0 0",
  color: "#58645d",
  lineHeight: 1.5
});

const inputStyle = css({
  width: "100%",
  minHeight: "42px",
  border: "1px solid #c9c8bc",
  borderRadius: "8px",
  background: "#ffffff",
  color: "#141914",
  padding: "0 12px",
  font: "inherit",
  ":focus-visible": {
    outline: "2px solid #477342",
    outlineOffset: "2px"
  }
});

const tableSectionStyle = css({
  display: "grid",
  gap: "14px"
});

const tableHeaderStyle = css({
  display: "flex",
  alignItems: "end",
  justifyContent: "space-between",
  gap: "16px",
  "@media (max-width: 620px)": {
    alignItems: "start",
    flexDirection: "column"
  }
});

const fingerprintStyle = css({
  display: "block",
  color: "#1d2a1f",
  fontSize: "0.86rem",
  overflowWrap: "anywhere"
});

const secondaryButtonStyle = css({
  minHeight: "38px",
  border: "1px solid #b9b8ad",
  borderRadius: "8px",
  background: "#ffffff",
  color: "#1b241c",
  padding: "0 12px",
  fontWeight: 700,
  whiteSpace: "nowrap",
  ":hover": {
    background: "#f2f4ed"
  },
  ":disabled": {
    cursor: "not-allowed",
    color: "#8d938e",
    background: "#f4f5f0"
  },
  ":focus-visible": {
    outline: "2px solid #477342",
    outlineOffset: "2px"
  }
});
