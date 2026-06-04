import { describe, expect, test } from "bun:test";
import { parsePublicRoute, stepperItems } from "./routes";

describe("public route map", () => {
  test("recognizes every requested public shell route", () => {
    const paths = [
      "/app",
      "/app/setup",
      "/app/prompts/prompt_demo_support",
      "/app/projects/project_demo_support/audit",
      "/app/projects/project_demo_support/success",
      "/app/projects/project_demo_support/candidates",
      "/app/projects/project_demo_support/models",
      "/app/eval-runs/eval_demo_support",
      "/app/reports/report_demo_support",
      "/app/reports/report_demo_support/export",
      "/audit",
      "/free-audit"
    ];

    for (const path of paths) {
      expect(parsePublicRoute(path).kind).not.toBe("not-found");
    }
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

  test("does not treat admin paths as public routes", () => {
    expect(parsePublicRoute("/__admin/overview").kind).toBe("not-found");
  });
});
