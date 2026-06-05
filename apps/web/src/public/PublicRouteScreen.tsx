import type { ModelRegistryRecord } from "@promptopts/shared";
import type { PromptOptsApiClient } from "../apiClient";
import type { PublicAppState } from "../mockData";
import type { PublicRoute } from "../routes";
import AuditScreen from "./screens/AuditScreen";
import CandidatesScreen from "./screens/CandidatesScreen";
import EvalRunScreen from "./screens/EvalRunScreen";
import ExportScreen from "./screens/ExportScreen";
import FreeAuditScreen from "./screens/FreeAuditScreen";
import ModelsScreen from "./screens/ModelsScreen";
import NotFoundScreen from "./screens/NotFoundScreen";
import PromptScreen from "./screens/PromptScreen";
import ReportScreen from "./screens/ReportScreen";
import SetupScreen from "./screens/SetupScreen";
import SuccessContractScreen from "./screens/SuccessContractScreen";
import WorkspaceScreen from "./screens/WorkspaceScreen";
import type { ApiState, NavigateHandler } from "../viewTypes";

function PublicRouteScreen({
  apiClient,
  apiState,
  appState,
  onNavigate,
  registryModels,
  route,
  updateAppState
}: {
  apiClient: PromptOptsApiClient | null;
  apiState: ApiState;
  appState: PublicAppState;
  onNavigate: NavigateHandler;
  registryModels: ModelRegistryRecord[];
  route: PublicRoute;
  updateAppState: (next: Partial<PublicAppState>) => void;
}) {
  switch (route.kind) {
    case "app-home":
      return <WorkspaceScreen apiClient={apiClient} appState={appState} onNavigate={onNavigate} />;
    case "workspace-dashboard":
      return (
        <WorkspaceScreen
          apiClient={apiClient}
          appState={appState}
          onNavigate={onNavigate}
          workspaceSlug={route.workspaceSlug}
        />
      );
    case "free-audit":
      return (
        <FreeAuditScreen
          apiClient={apiClient}
          appState={appState}
          onNavigate={onNavigate}
          registryModels={registryModels}
          updateAppState={updateAppState}
        />
      );
    case "setup":
      return (
        <SetupScreen
          apiState={apiState}
          apiClient={apiClient}
          appState={appState}
          onNavigate={onNavigate}
          registryModels={registryModels}
          updateAppState={updateAppState}
        />
      );
    case "prompt":
      return (
        <PromptScreen
          apiClient={apiClient}
          appState={appState}
          onNavigate={onNavigate}
          updateAppState={updateAppState}
        />
      );
    case "audit":
      return (
        <AuditScreen
          apiClient={apiClient}
          appState={appState}
          onNavigate={onNavigate}
          projectId={route.projectId}
        />
      );
    case "success":
      return (
        <SuccessContractScreen
          apiClient={apiClient}
          projectId={route.projectId}
          updateAppState={updateAppState}
        />
      );
    case "candidates":
      return (
        <CandidatesScreen
          apiClient={apiClient}
          appState={appState}
          onNavigate={onNavigate}
          projectId={route.projectId}
          updateAppState={updateAppState}
        />
      );
    case "models":
      return <ModelsScreen appState={appState} registryModels={registryModels} updateAppState={updateAppState} />;
    case "eval-run":
      return (
        <EvalRunScreen
          apiClient={apiClient}
          appState={appState}
          evalRunId={route.evalRunId}
          onNavigate={onNavigate}
          registryModels={registryModels}
          updateAppState={updateAppState}
        />
      );
    case "report":
      return (
        <ReportScreen
          apiClient={apiClient}
          appState={appState}
          onNavigate={onNavigate}
          reportId={route.reportId}
        />
      );
    case "report-export":
      return <ExportScreen apiClient={apiClient} reportId={route.reportId} />;
    case "not-found":
      return <NotFoundScreen onNavigate={onNavigate} path={route.path} />;
  }
}

export default PublicRouteScreen;
