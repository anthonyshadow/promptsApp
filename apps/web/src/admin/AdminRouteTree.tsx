import { css } from "@emotion/css";
import { useEffect, useState } from "react";
import { getAdminGateCopy, getAdminGateStateFromSearch } from "../adminGate";
import { normalizeApiUrl } from "../apiViewState";
import type { AdminGateState } from "../viewTypes";
import AdminAccountDetailScreen from "./AdminAccountDetailScreen";
import AdminAccountsScreen from "./AdminAccountsScreen";
import AdminAuditLogsScreen from "./AdminAuditLogsScreen";
import AdminBillingScreen from "./AdminBillingScreen";
import AdminEvalJobsScreen from "./AdminEvalJobsScreen";
import AdminModelRegistryScreen from "./AdminModelRegistryScreen";
import AdminOverviewScreen from "./AdminOverviewScreen";
import AdminReportsVaultScreen from "./AdminReportsVaultScreen";
import {
  AdminApiError,
  clearAdminSessionToken,
  fetchAdminMe,
  getStoredAdminSessionToken,
  loginAdmin,
  verifyAdminMfa
} from "./adminApi";

function AdminRouteTree() {
  const apiBaseUrl = normalizeApiUrl(import.meta.env.VITE_API_URL);
  const route = getAdminRoute(window.location.pathname);
  const [gateState, setGateState] = useState<AdminGateState>(() =>
    apiBaseUrl ? "checking" : getAdminGateStateFromSearch(window.location.search)
  );
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!apiBaseUrl) {
      setGateState(getAdminGateStateFromSearch(window.location.search));
      return;
    }

    void refreshAdminSession(apiBaseUrl, setGateState, setAuthError);
  }, [apiBaseUrl]);

  async function handleLogin(input: { email: string; password: string }) {
    if (!apiBaseUrl) {
      setAuthError("Admin API URL is not configured.");
      return;
    }

    setAuthError(null);

    try {
      await loginAdmin(apiBaseUrl, input);
      setGateState("mfa-required");
    } catch {
      clearAdminSessionToken();
      setAuthError("Invalid admin credentials.");
      setGateState("not-signed-in");
    }
  }

  async function handleMfa(code: string) {
    if (!apiBaseUrl) {
      setAuthError("Admin API URL is not configured.");
      return;
    }

    setAuthError(null);

    try {
      await verifyAdminMfa(apiBaseUrl, code);
      await refreshAdminSession(apiBaseUrl, setGateState, setAuthError);
    } catch {
      setAuthError("Invalid MFA code.");
      setGateState("mfa-required");
    }
  }

  return (
    <main className={rootStyle}>
      <section className={shellStyle} aria-labelledby="admin-title">
        <p className={eyebrowStyle}>Internal only</p>
        <h1 className={titleStyle} id="admin-title">
          PromptOpts Admin
        </h1>
        {gateState === "authorized" ? <AdminInternalNav activeRoute={route.kind} /> : null}
        {gateState === "authorized" ? (
          renderAuthorizedAdminRoute(route, apiBaseUrl)
        ) : (
          <AdminGateStateView
            state={gateState}
            error={authError}
            onLogin={handleLogin}
            onMfa={handleMfa}
          />
        )}
      </section>
    </main>
  );
}

export default AdminRouteTree;

function renderAuthorizedAdminRoute(
  route: AdminRoute,
  apiBaseUrl: string | undefined
): JSX.Element {
  switch (route.kind) {
    case "accounts":
      return <AdminAccountsScreen apiBaseUrl={apiBaseUrl} />;
    case "account-detail":
      return <AdminAccountDetailScreen accountId={route.accountId} apiBaseUrl={apiBaseUrl} />;
    case "eval-jobs":
      return <AdminEvalJobsScreen apiBaseUrl={apiBaseUrl} />;
    case "model-registry":
      return <AdminModelRegistryScreen apiBaseUrl={apiBaseUrl} />;
    case "reports":
      return <AdminReportsVaultScreen apiBaseUrl={apiBaseUrl} />;
    case "billing":
      return <AdminBillingScreen apiBaseUrl={apiBaseUrl} />;
    case "audit-logs":
      return <AdminAuditLogsScreen apiBaseUrl={apiBaseUrl} />;
    case "overview":
      return <AdminOverviewScreen apiBaseUrl={apiBaseUrl} />;
  }
}

function AdminInternalNav({ activeRoute }: { activeRoute: AdminRoute["kind"] }) {
  return (
    <nav className={navStyle} aria-label="Internal admin navigation">
      <a className={activeRoute === "overview" ? activeNavLinkStyle : navLinkStyle} href="/__admin/overview">
        Overview
      </a>
      <a
        className={activeRoute === "accounts" || activeRoute === "account-detail" ? activeNavLinkStyle : navLinkStyle}
        href="/__admin/accounts"
      >
        Accounts
      </a>
      <a className={activeRoute === "eval-jobs" ? activeNavLinkStyle : navLinkStyle} href="/__admin/eval-jobs">
        Eval jobs
      </a>
      <a className={activeRoute === "model-registry" ? activeNavLinkStyle : navLinkStyle} href="/__admin/model-registry">
        Model registry
      </a>
      <a className={activeRoute === "reports" ? activeNavLinkStyle : navLinkStyle} href="/__admin/reports">
        Reports
      </a>
      <a className={activeRoute === "billing" ? activeNavLinkStyle : navLinkStyle} href="/__admin/billing">
        Billing
      </a>
      <a className={activeRoute === "audit-logs" ? activeNavLinkStyle : navLinkStyle} href="/__admin/audit-logs">
        Audit logs
      </a>
    </nav>
  );
}

function AdminGateStateView({
  state,
  error,
  onLogin,
  onMfa
}: {
  state: AdminGateState;
  error: string | null;
  onLogin: (input: { email: string; password: string }) => void;
  onMfa: (code: string) => void;
}) {
  const copy = getAdminGateCopy(state);
  const [email, setEmail] = useState("ops@acme-ai.example");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");

  return (
    <div className={gatePanelStyle}>
      <div className={gateHeaderStyle}>
        <span className={gateStatusStyle}>{copy.status}</span>
        <strong className={gateTitleStyle}>{copy.title}</strong>
      </div>
      <p className={gateBodyStyle}>{copy.body}</p>
      {error ? <p className={gateErrorStyle}>{error}</p> : null}
      {state === "not-signed-in" || state === "expired" ? (
        <form
          className={authFormStyle}
          onSubmit={(event) => {
            event.preventDefault();
            onLogin({ email, password });
          }}
        >
          <label className={sudoLabelStyle} htmlFor="admin-email">
            Email
          </label>
          <input
            className={sudoInputStyle}
            id="admin-email"
            name="admin-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
          />
          <label className={sudoLabelStyle} htmlFor="admin-password">
            Password
          </label>
          <input
            className={sudoInputStyle}
            id="admin-password"
            name="admin-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
          />
          <button className={sudoButtonStyle} type="submit">
            Sign in
          </button>
        </form>
      ) : null}
      {state === "mfa-required" ? (
        <form
          className={authFormStyle}
          onSubmit={(event) => {
            event.preventDefault();
            onMfa(mfaCode);
          }}
        >
          <label className={sudoLabelStyle} htmlFor="admin-mfa-code">
            MFA code
          </label>
          <input
            className={sudoInputStyle}
            id="admin-mfa-code"
            inputMode="numeric"
            maxLength={6}
            name="admin-mfa-code"
            type="text"
            value={mfaCode}
            onChange={(event) => setMfaCode(event.currentTarget.value)}
          />
          <button className={sudoButtonStyle} type="submit">
            Verify MFA
          </button>
        </form>
      ) : null}
      {state === "sudo-required" ? (
        <form className={sudoFormStyle}>
          <label className={sudoLabelStyle} htmlFor="sudo-reason">
            Reason code
          </label>
          <input
            className={sudoInputStyle}
            id="sudo-reason"
            name="sudo-reason"
            placeholder="required before dangerous action"
            type="text"
          />
          <button className={sudoButtonStyle} type="button">
            Request sudo
          </button>
        </form>
      ) : null}
    </div>
  );
}

async function refreshAdminSession(
  apiBaseUrl: string,
  setGateState: (state: AdminGateState) => void,
  setAuthError: (error: string | null) => void
) {
  if (!getStoredAdminSessionToken()) {
    setGateState("not-signed-in");
    return;
  }

  try {
    const session = await fetchAdminMe(apiBaseUrl);
    if (!session.authenticated) {
      setGateState("not-signed-in");
    } else if (!session.mfa_verified) {
      setGateState("mfa-required");
    } else if (!session.role) {
      setGateState("missing-role");
    } else if (!session.action_scopes.includes("read_metadata")) {
      setGateState("missing-scope");
    } else {
      setGateState("authorized");
    }
    setAuthError(null);
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      clearAdminSessionToken();
      setGateState("expired");
      return;
    }

    if (error instanceof AdminApiError && error.status === 403) {
      setGateState("not-admin");
      return;
    }

    setAuthError("Admin API is unavailable.");
    setGateState("not-signed-in");
  }
}

type AdminRoute =
  | {
      kind: "overview";
    }
  | {
      kind: "accounts";
    }
  | {
      kind: "account-detail";
      accountId: string;
    }
  | {
      kind: "eval-jobs";
    }
  | {
      kind: "model-registry";
    }
  | {
      kind: "reports";
    }
  | {
      kind: "billing";
    }
  | {
      kind: "audit-logs";
    };

function getAdminRoute(pathname: string): AdminRoute {
  const parts = pathname.split("/").filter(Boolean);

  if (parts[0] === "__admin" && parts[1] === "accounts" && parts[2]) {
    return {
      kind: "account-detail",
      accountId: decodeURIComponent(parts[2])
    };
  }

  if (parts[0] === "__admin" && parts[1] === "accounts") {
    return {
      kind: "accounts"
    };
  }

  if (parts[0] === "__admin" && parts[1] === "eval-jobs") {
    return {
      kind: "eval-jobs"
    };
  }

  if (parts[0] === "__admin" && parts[1] === "model-registry") {
    return {
      kind: "model-registry"
    };
  }

  if (parts[0] === "__admin" && parts[1] === "reports") {
    return {
      kind: "reports"
    };
  }

  if (parts[0] === "__admin" && parts[1] === "billing") {
    return {
      kind: "billing"
    };
  }

  if (parts[0] === "__admin" && parts[1] === "audit-logs") {
    return {
      kind: "audit-logs"
    };
  }

  return {
    kind: "overview"
  };
}

const rootStyle = css({
  minHeight: "100vh",
  padding: "28px",
  background: "#111714",
  color: "#eef4ed",
  overflowX: "clip",
  "@media (max-width: 720px)": {
    padding: "18px"
  },
  "@media (max-width: 420px)": {
    padding: "14px"
  }
});

const shellStyle = css({
  width: "min(100%, 1180px)",
  margin: "0 auto",
  paddingTop: "5vh"
});

const eyebrowStyle = css({
  margin: "0 0 12px",
  color: "#9fbaaa",
  fontSize: "0.78rem",
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: "uppercase"
});

const titleStyle = css({
  margin: 0,
  fontSize: "2.4rem",
  lineHeight: 1,
  letterSpacing: 0,
  "@media (max-width: 560px)": {
    fontSize: "2rem"
  }
});

const gatePanelStyle = css({
  marginTop: "28px",
  border: "1px solid #415149",
  borderRadius: "8px",
  background: "#17211d",
  padding: "24px"
});

const navStyle = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  marginTop: "18px",
  maxWidth: "100%",
  overflowX: "auto",
  paddingBottom: "4px",
  WebkitOverflowScrolling: "touch"
});

const navLinkStyle = css({
  minHeight: "40px",
  border: "1px solid #526a5d",
  borderRadius: "8px",
  color: "#dcebe0",
  padding: "8px 11px",
  textDecoration: "none",
  fontSize: "0.9rem",
  fontWeight: 800,
  whiteSpace: "nowrap",
  ":hover": {
    background: "#17211d"
  }
});

const activeNavLinkStyle = css({
  minHeight: "40px",
  border: "1px solid #b8d1c0",
  borderRadius: "8px",
  background: "#dcebe0",
  color: "#101713",
  padding: "8px 11px",
  textDecoration: "none",
  fontSize: "0.9rem",
  fontWeight: 800,
  whiteSpace: "nowrap"
});

const gateHeaderStyle = css({
  display: "grid",
  gap: "8px"
});

const gateStatusStyle = css({
  width: "fit-content",
  border: "1px solid #6f8878",
  borderRadius: "8px",
  padding: "4px 8px",
  color: "#c7ddcf",
  fontSize: "0.8rem"
});

const gateTitleStyle = css({
  color: "#ffffff",
  fontSize: "1.35rem",
  lineHeight: 1.25
});

const gateBodyStyle = css({
  maxWidth: "680px",
  margin: "16px 0 0",
  color: "#c7d6ce",
  lineHeight: 1.6
});

const gateErrorStyle = css({
  maxWidth: "680px",
  margin: "14px 0 0",
  color: "#ffd2c7",
  lineHeight: 1.5,
  fontWeight: 700
});

const authFormStyle = css({
  display: "grid",
  gridTemplateColumns: "minmax(220px, 1fr) minmax(220px, 1fr) auto",
  gap: "10px",
  marginTop: "20px",
  "@media (max-width: 760px)": {
    gridTemplateColumns: "1fr"
  }
});

const sudoFormStyle = css({
  display: "grid",
  gridTemplateColumns: "minmax(180px, 1fr) auto",
  gap: "10px",
  marginTop: "20px",
  "@media (max-width: 640px)": {
    gridTemplateColumns: "1fr"
  }
});

const sudoLabelStyle = css({
  gridColumn: "1 / -1",
  color: "#dfeae3",
  fontSize: "0.9rem"
});

const sudoInputStyle = css({
  minHeight: "42px",
  border: "1px solid #657b6e",
  borderRadius: "8px",
  background: "#101713",
  color: "#ffffff",
  padding: "0 12px"
});

const sudoButtonStyle = css({
  minHeight: "42px",
  border: "1px solid #b8d1c0",
  borderRadius: "8px",
  background: "#dcebe0",
  color: "#101713",
  padding: "0 14px",
  fontWeight: 700
});
