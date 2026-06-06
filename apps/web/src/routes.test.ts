import { describe, expect, test } from "bun:test";
import { DEMO_IDS } from "@promptopts/shared";
import { parsePublicRoute, stepperItems } from "./routes";

describe("public route map", () => {
  test("recognizes every requested public shell route", () => {
    const paths = [
      "/app",
      "/app/workspace/acme-ai",
      "/app/setup",
      `/app/prompts/${DEMO_IDS.prompt}`,
      `/app/projects/${DEMO_IDS.project}/audit`,
      `/app/projects/${DEMO_IDS.project}/success`,
      `/app/projects/${DEMO_IDS.project}/candidates`,
      `/app/projects/${DEMO_IDS.project}/models`,
      `/app/eval-runs/${DEMO_IDS.evalRun}`,
      `/app/reports/${DEMO_IDS.report}`,
      `/app/reports/${DEMO_IDS.report}/export`,
      "/audit",
      "/free-audit"
    ];

    for (const path of paths) {
      expect(parsePublicRoute(path).kind).not.toBe("not-found");
    }

    expect(parsePublicRoute("/app/workspace/acme-ai")).toMatchObject({
      kind: "workspace-dashboard",
      workspaceSlug: "acme-ai"
    });
  });

  test("keeps the product stepper canonical", () => {
    expect(stepperItems.map((step) => step.label)).toEqual([
      "Setup",
      "Prompt",
      "Audit",
      "Success",
      "Candidates",
      "Evals",
      "Report",
      "Exports"
    ]);
  });

  test("normalizes legacy frontend demo ids to API seed ids", () => {
    expect(parsePublicRoute("/app/prompts/prompt_demo_support")).toMatchObject({
      kind: "prompt",
      promptId: DEMO_IDS.prompt
    });
    expect(parsePublicRoute("/app/projects/project_demo_support/success")).toMatchObject({
      kind: "success",
      projectId: DEMO_IDS.project
    });
    expect(parsePublicRoute("/app/eval-runs/eval_demo_support")).toMatchObject({
      kind: "eval-run",
      evalRunId: DEMO_IDS.evalRun
    });
    expect(parsePublicRoute("/app/reports/report_demo_support/export")).toMatchObject({
      kind: "report-export",
      reportId: DEMO_IDS.report
    });
  });

  test("does not treat admin paths as public routes", () => {
    expect(parsePublicRoute("/__admin/overview").kind).toBe("not-found");
  });
});
