import { useEffect, useMemo, useState } from "react";
import { APP_NAME } from "@promptopts/shared";
import RouteLink from "../components/RouteLink";
import { createPromptOptsApiClient } from "../apiClient";
import { normalizeApiUrl } from "../apiViewState";
import {
  createInitialPublicAppState,
  demoModelRegistry,
  demoWorkspace,
  type PublicAppState
} from "../mockData";
import { parsePublicRoute } from "../routes";
import {
  appRootStyle,
  brandBlockStyle,
  brandEyebrowStyle,
  brandTitleStyle,
  mainStyle,
  navStyle,
  sidebarStyle
} from "../styles";
import type { ApiState, NavigateHandler } from "../viewTypes";
import ProductStepper from "./ProductStepper";
import PublicRouteScreen, { ExpertControls } from "./PublicRouteScreen";
import ShellHeader from "./ShellHeader";

function PublicShell({ path, onNavigate }: { path: string; onNavigate: NavigateHandler }) {
  const route = useMemo(() => parsePublicRoute(path), [path]);
  const [appState, setAppState] = useState(createInitialPublicAppState);
  const apiUrl = useMemo(() => normalizeApiUrl(import.meta.env.VITE_API_URL), []);
  const [apiState, setApiState] = useState<ApiState>(
    apiUrl ? { status: "checking" } : { status: "not-configured" }
  );

  useEffect(() => {
    if (!apiUrl) {
      return;
    }

    let isMounted = true;
    const client = createPromptOptsApiClient(apiUrl);

    async function checkApi() {
      try {
        const [health, registry] = await Promise.all([client.health(), client.models()]);

        if (isMounted) {
          setApiState({ status: "online", health, registry });
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

  function updateAppState(next: Partial<PublicAppState>) {
    setAppState((current) => ({ ...current, ...next }));
  }

  const registryModels = apiState.status === "online" ? apiState.registry.models : demoModelRegistry;

  return (
    <div className={appRootStyle}>
      <aside className={sidebarStyle} aria-label="Public navigation">
        <div className={brandBlockStyle}>
          <p className={brandEyebrowStyle}>{demoWorkspace.name}</p>
          <strong className={brandTitleStyle}>{APP_NAME}</strong>
        </div>
        <nav className={navStyle} aria-label="Primary">
          <RouteLink current={route.kind === "app-home"} onNavigate={onNavigate} to="/app">
            Workspace
          </RouteLink>
          <RouteLink current={route.kind === "free-audit"} onNavigate={onNavigate} to="/audit">
            Free audit
          </RouteLink>
        </nav>
        <ProductStepper activeStep={route.activeStep} onNavigate={onNavigate} />
      </aside>

      <main className={mainStyle}>
        <ShellHeader apiState={apiState} appState={appState} route={route} />
        <PublicRouteScreen
          apiState={apiState}
          appState={appState}
          onNavigate={onNavigate}
          registryModels={registryModels}
          route={route}
          updateAppState={updateAppState}
        />
        <ExpertControls appState={appState} updateAppState={updateAppState} />
      </main>
    </div>
  );
}

export default PublicShell;
