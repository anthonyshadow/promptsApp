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
import ExpertControls from "./ExpertControls";
import ProductStepper from "./ProductStepper";
import PublicRouteScreen from "./PublicRouteScreen";
import ShellHeader from "./ShellHeader";

function PublicShell({ path, onNavigate }: { path: string; onNavigate: NavigateHandler }) {
  const route = useMemo(() => parsePublicRoute(path), [path]);
  const [appState, setAppState] = useState(createInitialPublicAppState);
  const apiUrl = useMemo(() => normalizeApiUrl(import.meta.env.VITE_API_URL), []);
  const [apiState, setApiState] = useState<ApiState>(
    apiUrl ? { status: "checking" } : { status: "not-configured" }
  );
  const apiClient = useMemo(() => (apiUrl ? createPromptOptsApiClient(apiUrl) : null), [apiUrl]);

  useEffect(() => {
    if (!apiClient) {
      return;
    }

    let isMounted = true;
    const client = apiClient;

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
  }, [apiClient]);

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
          <RouteLink
            current={route.kind === "app-home" || route.kind === "workspace-dashboard"}
            onNavigate={onNavigate}
            to={`/app/workspace/${demoWorkspace.slug}`}
          >
            Workspace
          </RouteLink>
          <RouteLink
            current={route.kind === "workspace-security"}
            onNavigate={onNavigate}
            to={`/app/workspace/${demoWorkspace.slug}/security`}
          >
            Provider keys
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
          apiClient={apiClient}
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
