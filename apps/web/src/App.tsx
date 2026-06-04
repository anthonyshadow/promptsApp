import { css, injectGlobal } from "@emotion/css";
import { useEffect, useMemo, useState } from "react";
import { APP_NAME, type HealthResponse } from "@promptopts/shared";

type ApiState =
  | { status: "not-configured" }
  | { status: "checking" }
  | { status: "online"; health: HealthResponse }
  | { status: "offline"; message: string };

function normalizeApiUrl(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.replace(/\/+$/, "");
}

function App() {
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

export default App;

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
