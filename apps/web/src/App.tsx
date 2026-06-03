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

export function App() {
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
    <main className="shell">
      <section className="panel" aria-labelledby="app-title">
        <p className="eyebrow">Bun + TypeScript monorepo</p>
        <h1 id="app-title">{APP_NAME}</h1>
        <p className="lede">
          LLM cost-quality optimization infrastructure is ready for the first
          product loop.
        </p>

        <div className="status-grid" aria-live="polite">
          <div>
            <span className="label">Web</span>
            <strong>React + Vite</strong>
          </div>
          <div>
            <span className="label">API</span>
            <strong>{apiUrl ?? "Not configured"}</strong>
          </div>
          <div>
            <span className="label">Connectivity</span>
            <strong>{renderApiStatus(apiState)}</strong>
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
