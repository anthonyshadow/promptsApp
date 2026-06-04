import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { createInitialPublicAppState, demoModelRegistry } from "../mockData";
import { parsePublicRoute } from "../routes";
import type { ApiState } from "../viewTypes";
import PublicRouteScreen from "./PublicRouteScreen";

describe("public route screens", () => {
  test("renders the prompt and model audit screen with risk-first fallback copy", () => {
    const apiState: ApiState = { status: "not-configured" };
    const html = renderToString(
      <PublicRouteScreen
        apiClient={null}
        apiState={apiState}
        appState={createInitialPublicAppState()}
        registryModels={demoModelRegistry}
        route={parsePublicRoute("/app/projects/project_demo_support/audit")}
        updateAppState={() => undefined}
        onNavigate={() => undefined}
      />
    );

    expect(html).toContain("Prompt and model audit");
    expect(html).toContain("risk before savings");
    expect(html).toContain("Secret and PII preflight");
    expect(html).toContain("Spend estimate");
    expect(html).toContain("Suggested next action");
  });
});
