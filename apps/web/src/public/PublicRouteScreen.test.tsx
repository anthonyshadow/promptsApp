import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { createInitialPublicAppState, demoModelRegistry } from "../mockData";
import { parsePublicRoute } from "../routes";
import type { ApiState } from "../viewTypes";
import PublicRouteScreen from "./PublicRouteScreen";

describe("public route screens", () => {
  test("renders every public product-loop route without exposing admin navigation", () => {
    const apiState: ApiState = { status: "not-configured" };
    const routes = [
      ["/app", "Same-provider optimization path"],
      ["/app/setup", "Provider and model setup"],
      ["/app/prompts/prompt_demo_support", "Prompt baseline"],
      ["/app/projects/project_demo_support/audit", "Prompt and model audit"],
      ["/app/projects/project_demo_support/success", "Quality contract"],
      ["/app/projects/project_demo_support/candidates", "Prompt candidates"],
      ["/app/projects/project_demo_support/models", "Model shortlist"],
      ["/app/eval-runs/eval_demo_support", "Eval matrix"],
      ["/app/reports/report_demo_support", "Recommendation report"],
      ["/app/reports/report_demo_support/export", "Deploy package export"],
      ["/does-not-exist", "Route unavailable"]
    ] as const;

    for (const [path, expectedCopy] of routes) {
      const html = renderToString(
        <PublicRouteScreen
          apiClient={null}
          apiState={apiState}
          appState={createInitialPublicAppState()}
          registryModels={demoModelRegistry}
          route={parsePublicRoute(path)}
          updateAppState={() => undefined}
          onNavigate={() => undefined}
        />
      );

      expect(html).toContain(expectedCopy);
      expect(html).not.toContain("/__admin");
    }
  });

  test("renders the free model-fit audit acquisition screen", () => {
    const apiState: ApiState = { status: "not-configured" };
    const html = renderToString(
      <PublicRouteScreen
        apiClient={null}
        apiState={apiState}
        appState={createInitialPublicAppState()}
        registryModels={demoModelRegistry}
        route={parsePublicRoute("/audit")}
        updateAppState={() => undefined}
        onNavigate={() => undefined}
      />
    );

    expect(html).toContain("Free LLM Model Fit Audit");
    expect(html).toContain("risk before savings");
    expect(html).toContain("Instant preview");
    expect(html).toContain("Unverified savings opportunity");
    expect(html).toContain("Run evals before switching");
    expect(html).not.toContain("CRM");
    expect(html).not.toContain("admin");
  });

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

  test("renders the quality contract screen with manual and CSV test-case entry", () => {
    const apiState: ApiState = { status: "not-configured" };
    const html = renderToString(
      <PublicRouteScreen
        apiClient={null}
        apiState={apiState}
        appState={createInitialPublicAppState()}
        registryModels={demoModelRegistry}
        route={parsePublicRoute("/app/projects/project_demo_support/success")}
        updateAppState={() => undefined}
        onNavigate={() => undefined}
      />
    );

    expect(html).toContain("Quality contract");
    expect(html).toContain("Auto-drafted contract");
    expect(html).toContain("Add manual test case");
    expect(html).toContain("CSV upload");
    expect(html).toContain("LLM judge");
    expect(html).toContain("Production recommendation disabled");
    expect(html).toContain("Must-pass ready");
  });

  test("renders the prompt candidate diff viewer with provisional eval copy", () => {
    const apiState: ApiState = { status: "not-configured" };
    const html = renderToString(
      <PublicRouteScreen
        apiClient={null}
        apiState={apiState}
        appState={createInitialPublicAppState()}
        registryModels={demoModelRegistry}
        route={parsePublicRoute("/app/projects/project_demo_support/candidates")}
        updateAppState={() => undefined}
        onNavigate={() => undefined}
      />
    );

    expect(html).toContain("Prompt candidates");
    expect(html).toContain("Aggressive is an experiment");
    expect(html).toContain("Removed or compressed text");
    expect(html).toContain("Rewritten text");
    expect(html).toContain("Preserved constraints");
    expect(html).toContain("Send selected to model shortlist");
  });

  test("renders the model shortlist benchmark roles and registry health", () => {
    const apiState: ApiState = { status: "not-configured" };
    const html = renderToString(
      <PublicRouteScreen
        apiClient={null}
        apiState={apiState}
        appState={createInitialPublicAppState()}
        registryModels={demoModelRegistry}
        route={parsePublicRoute("/app/projects/project_demo_support/models")}
        updateAppState={() => undefined}
        onNavigate={() => undefined}
      />
    );

    expect(html).toContain("Benchmark set");
    expect(html).toContain("Baseline");
    expect(html).toContain("Cheaper");
    expect(html).toContain("Balanced");
    expect(html).toContain("Fallback");
    expect(html).toContain("Why included");
    expect(html).toContain("Registry health");
    expect(html).toContain("Stale/demo warning");
    expect(html).toContain("No exact savings claim");
  });

  test("renders eval setup, polling state, matrix, and cost-quality frontier", () => {
    const apiState: ApiState = { status: "not-configured" };
    const html = renderToString(
      <PublicRouteScreen
        apiClient={null}
        apiState={apiState}
        appState={createInitialPublicAppState()}
        registryModels={demoModelRegistry}
        route={parsePublicRoute("/app/eval-runs/eval_demo_support")}
        updateAppState={() => undefined}
        onNavigate={() => undefined}
      />
    );

    expect(html).toContain("Eval setup and polling");
    expect(html).toContain("Selected prompts");
    expect(html).toContain("Selected models");
    expect(html).toContain("Selected test cases");
    expect(html).toContain("Queue/cache state");
    expect(html).toContain("Cost-quality frontier");
    expect(html).toContain("Winner candidate");
    expect(html).toContain("Failed checks");
  });
});
