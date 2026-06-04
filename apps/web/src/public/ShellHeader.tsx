import { demoAudit } from "../mockData";
import type { PublicAppState } from "../mockData";
import { formatModelFit, formatProvider, getRouteTitle } from "../formatters";
import { renderApiStatus } from "../apiViewState";
import type { PublicRoute } from "../routes";
import {
  headerEyebrowStyle,
  headerStatusGridStyle,
  headerTitleStyle,
  shellHeaderStyle
} from "../styles";
import StatusBadge from "../components/StatusBadge";
import type { ApiState } from "../viewTypes";

function ShellHeader({
  apiState,
  appState,
  route
}: {
  apiState: ApiState;
  appState: PublicAppState;
  route: PublicRoute;
}) {
  return (
    <header className={shellHeaderStyle}>
      <div>
        <p className={headerEyebrowStyle}>LLM cost-quality optimization</p>
        <h1 className={headerTitleStyle}>{getRouteTitle(route)}</h1>
      </div>
      <div className={headerStatusGridStyle} aria-live="polite">
        <StatusBadge label="Model fit" value={formatModelFit(demoAudit.modelFit)} tone="attention" />
        <StatusBadge label="Provider" value={formatProvider(appState.provider)} tone="neutral" />
        <StatusBadge label="API" value={renderApiStatus(apiState)} tone={apiState.status === "online" ? "good" : "warn"} />
      </div>
    </header>
  );
}

export default ShellHeader;
