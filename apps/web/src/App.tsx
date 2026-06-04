import { css, injectGlobal } from "@emotion/css";
import { useEffect, useMemo, useState } from "react";
import { APP_NAME, type HealthResponse } from "@promptopts/shared";

type ApiState =
  | { status: "not-configured" }
  | { status: "checking" }
  | { status: "online"; health: HealthResponse }
  | { status: "offline"; message: string };

type AdminGateState =
  | "not-signed-in"
  | "not-admin"
  | "mfa-required"
  | "authorized"
  | "sudo-required";

function App() {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    function syncPath() {
      setPath(window.location.pathname);
    }

    window.addEventListener("popstate", syncPath);

    return () => {
      window.removeEventListener("popstate", syncPath);
    };
  }, []);

  if (path.startsWith("/__admin")) {
    return <AdminRouteTree />;
  }

  return <PublicShell />;
}

function PublicShell() {
  const apiUrl = useMemo(() => normalizeApiUrl(import.meta.env.VITE_API_URL), []);
  const [apiState, setApiState] = useState<ApiState>(
    apiUrl ? { status: "checking" } : { status: "not-configured" }
  );

  useEffect(() => {
    if (!apiUrl) {
      return;
    }

    let isMounted = true;

    async function checkApi() {
      try {
        const response = await fetch(`${apiUrl}/health`);

        if (!response.ok) {
          throw new Error(`Health check returned ${response.status}`);
        }

        const health = (await response.json()) as HealthResponse;

        if (isMounted) {
          setApiState({ status: "online", health });
        }
      } catch (error) {
        if (isMounted) {
          setApiState({
            status: "offline",
            message: error instanceof Error ? error.message : "Unknown API error"
          });
        }
      }
    }

    void checkApi();

    return () => {
      isMounted = false;
    };
  }, [apiUrl]);

  return (
    <main className={rootStyle}>
      <section className={panelStyle} aria-labelledby="app-title">
        <p className={eyebrowStyle}>Bun + TypeScript monorepo</p>
        <h1 className={titleStyle} id="app-title">
          {APP_NAME}
        </h1>
        <p className={ledeStyle}>
          LLM cost-quality optimization infrastructure is ready for the first
          product loop.
        </p>

        <div className={statusGridStyle} aria-live="polite">
          <div className={statusCardStyle}>
            <span className={labelStyle}>Web</span>
            <strong className={statusValueStyle}>React + Vite</strong>
          </div>
          <div className={statusCardStyle}>
            <span className={labelStyle}>API</span>
            <strong className={statusValueStyle}>{apiUrl ?? "Not configured"}</strong>
          </div>
          <div className={statusCardStyle}>
            <span className={labelStyle}>Connectivity</span>
            <strong className={statusValueStyle}>{renderApiStatus(apiState)}</strong>
          </div>
        </div>
      </section>
    </main>
  );
}

function AdminRouteTree() {
  const gateState = getAdminGateState();

  return (
    <main className={adminRootStyle}>
      <section className={adminShellStyle} aria-labelledby="admin-title">
        <p className={adminEyebrowStyle}>Internal only</p>
        <h1 className={adminTitleStyle} id="admin-title">
          PromptOpts Admin
        </h1>
        <AdminGateStateView state={gateState} />
      </section>
    </main>
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

export default App;

function normalizeApiUrl(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.replace(/\/+$/, "");
}

function renderApiStatus(apiState: ApiState): string {
  switch (apiState.status) {
    case "not-configured":
      return "Set VITE_API_URL to check /health";
    case "checking":
      return "Checking /health";
    case "online":
      return `${apiState.health.service} ${apiState.health.status}`;
    case "offline":
      return `Offline: ${apiState.message}`;
  }
}

function getAdminGateState(): AdminGateState {
  const state = new URLSearchParams(window.location.search).get("state");

  if (
    state === "not-admin" ||
    state === "mfa-required" ||
    state === "authorized" ||
    state === "sudo-required"
  ) {
    return state;
  }

  return "not-signed-in";
}

function getAdminGateCopy(state: AdminGateState): {
  status: string;
  title: string;
  body: string;
} {
  switch (state) {
    case "not-signed-in":
      return {
        status: "Blocked",
        title: "Admin session required",
        body: "This internal surface requires a valid server-side admin session before any admin data can load."
      };
    case "not-admin":
      return {
        status: "Blocked",
        title: "Admin role required",
        body: "The current session is signed in but does not have an admin role or action scopes."
      };
    case "mfa-required":
      return {
        status: "Step-up",
        title: "MFA required",
        body: "Admin access requires MFA before the API will authorize internal routes."
      };
    case "authorized":
      return {
        status: "Authorized",
        title: "Redacted admin view",
        body: "Admin metadata can load, but prompts, provider keys, and report contents remain redacted by default."
      };
    case "sudo-required":
      return {
        status: "Step-up",
        title: "Sudo required",
        body: "Dangerous actions require a reason code and time-boxed sudo before the API will proceed."
      };
  }
}

injectGlobal({
  ":root": {
    color: "#17211a",
    background: "#eef2ec",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSynthesis: "none",
    textRendering: "optimizeLegibility"
  },
  "*": {
    boxSizing: "border-box"
  },
  body: {
    margin: 0,
    minWidth: "320px",
    minHeight: "100vh"
  },
  "button, input, textarea, select": {
    font: "inherit"
  }
});

const rootStyle = css({
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: "32px",
  "@media (max-width: 720px)": {
    padding: "18px"
  }
});

const panelStyle = css({
  width: "min(100%, 760px)",
  border: "1px solid #cad4c8",
  borderRadius: "8px",
  background: "#fbfcf8",
  padding: "32px",
  boxShadow: "0 16px 40px rgb(30 45 32 / 10%)",
  "@media (max-width: 720px)": {
    padding: "22px"
  }
});

const eyebrowStyle = css({
  margin: "0 0 12px",
  color: "#496852",
  fontSize: "0.78rem",
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: "uppercase"
});

const titleStyle = css({
  margin: 0,
  color: "#101610",
  fontSize: "clamp(2rem, 6vw, 3.25rem)",
  lineHeight: 1,
  letterSpacing: 0
});

const ledeStyle = css({
  maxWidth: "620px",
  margin: "20px 0 0",
  color: "#334237",
  fontSize: "1.08rem",
  lineHeight: 1.6
});

const statusGridStyle = css({
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "12px",
  marginTop: "28px",
  "@media (max-width: 720px)": {
    gridTemplateColumns: "1fr"
  }
});

const statusCardStyle = css({
  minHeight: "92px",
  border: "1px solid #d8dfd4",
  borderRadius: "8px",
  background: "#f4f7f0",
  padding: "16px"
});

const labelStyle = css({
  display: "block",
  marginBottom: "8px",
  color: "#5d6f60",
  fontSize: "0.82rem"
});

const statusValueStyle = css({
  display: "block",
  overflowWrap: "anywhere",
  color: "#18201a",
  fontSize: "0.98rem",
  lineHeight: 1.35
});

const adminRootStyle = css({
  minHeight: "100vh",
  padding: "28px",
  background: "#111714",
  color: "#eef4ed",
  "@media (max-width: 720px)": {
    padding: "18px"
  }
});

const adminShellStyle = css({
  width: "min(100%, 880px)",
  margin: "0 auto",
  paddingTop: "8vh"
});

const adminEyebrowStyle = css({
  margin: "0 0 12px",
  color: "#9fbaaa",
  fontSize: "0.78rem",
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: "uppercase"
});

const adminTitleStyle = css({
  margin: 0,
  fontSize: "clamp(2rem, 6vw, 3rem)",
  lineHeight: 1,
  letterSpacing: 0
});

const gatePanelStyle = css({
  marginTop: "28px",
  border: "1px solid #415149",
  borderRadius: "8px",
  background: "#17211d",
  padding: "24px"
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
