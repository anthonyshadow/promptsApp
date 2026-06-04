import { describe, expect, test } from "bun:test";
import { getAdminGateCopy, getAdminGateStateFromSearch } from "./adminGate";
import { getRegistryNotice, renderApiStatus } from "./apiViewState";
import { formatModelFit, formatProvider, getRouteTitle, getStepCardTitle } from "./formatters";
import { parsePublicRoute, stepperItems } from "./routes";
import type { ApiState } from "./viewTypes";

describe("web view helpers", () => {
  test("maps every public route to its stable shell title", () => {
    const expectedTitles = new Map([
      ["/app", "Acme AI workspace"],
      ["/audit", "Free audit"],
      ["/app/setup", "Setup"],
      ["/app/prompts/prompt_demo_support", "Prompt"],
      ["/app/projects/project_demo_support/audit", "Audit"],
      ["/app/projects/project_demo_support/success", "Success contract"],
      ["/app/projects/project_demo_support/candidates", "Candidates"],
      ["/app/projects/project_demo_support/models", "Model shortlist"],
      ["/app/eval-runs/eval_demo_support", "Eval matrix"],
      ["/app/reports/report_demo_support", "Recommendation report"],
      ["/app/reports/report_demo_support/export", "Export package"]
    ]);

    for (const [path, title] of expectedTitles) {
      expect(getRouteTitle(parsePublicRoute(path))).toBe(title);
    }
  });

  test("keeps step card and label copy aligned with the product loop", () => {
    expect(stepperItems.map((step) => getStepCardTitle(step.key))).toEqual([
      "Provider/model setup",
      "Prompt paste",
      "Risk and model fit",
      "Quality contract",
      "Prompt candidates",
      "Model shortlist and evals",
      "One recommendation",
      "Deploy package"
    ]);
  });

  test("normalizes display formatting", () => {
    expect(formatProvider("openai")).toBe("OpenAI");
    expect(formatProvider("anthropic")).toBe("Anthropic");
    expect(formatProvider("gemini")).toBe("Gemini");
    expect(formatModelFit("overpowered")).toBe("Overpowered");
  });

  test("maps admin gate query states to stable copy", () => {
    expect(getAdminGateStateFromSearch("")).toBe("not-signed-in");
    expect(getAdminGateStateFromSearch("?state=not-admin")).toBe("not-admin");
    expect(getAdminGateStateFromSearch("?state=mfa-required")).toBe("mfa-required");
    expect(getAdminGateStateFromSearch("?state=authorized")).toBe("authorized");
    expect(getAdminGateStateFromSearch("?state=sudo-required")).toBe("sudo-required");
    expect(getAdminGateCopy("sudo-required").title).toBe("Sudo required");
  });

  test("renders API status and registry notices without component state", () => {
    const online: ApiState = {
      status: "online",
      health: {
        service: "api",
        status: "ok",
        timestamp: "2026-01-15T12:00:00.000Z"
      },
      registry: {
        models: [],
        registry_note: "Registry metadata is current."
      }
    };

    expect(renderApiStatus({ status: "not-configured" })).toBe("Local mock");
    expect(renderApiStatus({ status: "checking" })).toBe("Checking");
    expect(renderApiStatus(online)).toBe("api ok");
    expect(renderApiStatus({ status: "offline", message: "failed" })).toBe("Offline");
    expect(getRegistryNotice(online)).toBe("Registry metadata is current.");
  });
});
