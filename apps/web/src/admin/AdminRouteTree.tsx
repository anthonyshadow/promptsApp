import { css } from "@emotion/css";
import { getAdminGateCopy, getAdminGateStateFromSearch } from "../adminGate";
import { normalizeApiUrl } from "../apiViewState";
import type { AdminGateState } from "../viewTypes";
import AdminAccountDetailScreen from "./AdminAccountDetailScreen";
import AdminAccountsScreen from "./AdminAccountsScreen";
import AdminEvalJobsScreen from "./AdminEvalJobsScreen";
import AdminModelRegistryScreen from "./AdminModelRegistryScreen";
import AdminOverviewScreen from "./AdminOverviewScreen";

function AdminRouteTree() {
  const gateState = getAdminGateStateFromSearch(window.location.search);
  const apiBaseUrl = normalizeApiUrl(import.meta.env.VITE_API_URL);
  const route = getAdminRoute(window.location.pathname);

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
          <AdminGateStateView state={gateState} />
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
    case "overview":
      return <AdminOverviewScreen apiBaseUrl={apiBaseUrl} />;
  }
}

function AdminInternalNav({ activeRoute }: { activeRoute: AdminRoute["kind"] }) {
  return (
    <nav className={navStyle} aria-label="Internal admin navigation">
      <a className={activeRoute === "overview" ? activeNavLinkStyle : navLinkStyle} href="/__admin/overview?state=authorized">
        Overview
      </a>
      <a
        className={activeRoute === "accounts" || activeRoute === "account-detail" ? activeNavLinkStyle : navLinkStyle}
        href="/__admin/accounts?state=authorized"
      >
        Accounts
      </a>
      <a className={activeRoute === "eval-jobs" ? activeNavLinkStyle : navLinkStyle} href="/__admin/eval-jobs?state=authorized">
        Eval jobs
      </a>
      <a className={activeRoute === "model-registry" ? activeNavLinkStyle : navLinkStyle} href="/__admin/model-registry?state=authorized">
        Model registry
      </a>
    </nav>
  );
}

function AdminGateStateView({ state }: { state: AdminGateState }) {
  const copy = getAdminGateCopy(state);

  return (
    <div className={gatePanelStyle}>
      <div className={gateHeaderStyle}>
        <span className={gateStatusStyle}>{copy.status}</span>
        <strong className={gateTitleStyle}>{copy.title}</strong>
      </div>
      <p className={gateBodyStyle}>{copy.body}</p>
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

  return {
    kind: "overview"
  };
}

const rootStyle = css({
  minHeight: "100vh",
  padding: "28px",
  background: "#111714",
  color: "#eef4ed",
  "@media (max-width: 720px)": {
    padding: "18px"
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
  marginTop: "18px"
});

const navLinkStyle = css({
  border: "1px solid #526a5d",
  borderRadius: "8px",
  color: "#dcebe0",
  padding: "8px 11px",
  textDecoration: "none",
  fontSize: "0.9rem",
  fontWeight: 800,
  ":hover": {
    background: "#17211d"
  }
});

const activeNavLinkStyle = css({
  border: "1px solid #b8d1c0",
  borderRadius: "8px",
  background: "#dcebe0",
  color: "#101713",
  padding: "8px 11px",
  textDecoration: "none",
  fontSize: "0.9rem",
  fontWeight: 800
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
