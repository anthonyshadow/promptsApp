import { describe, expect, test } from "bun:test";
import { DEMO_IDS } from "@promptopts/shared";
import { getAdminGateCopy, getAdminGateStateFromSearch } from "./adminGate";
import { getRegistryNotice, renderApiStatus } from "./apiViewState";
import {
  formatAuditCostEstimate,
  formatModelFit,
  formatProvider,
  formatSensitiveFinding,
  formatSuggestedRole,
  formatTaskType,
  getRouteTitle,
  getStepCardTitle
} from "./formatters";
import { demoAudit } from "./mockData";
import { detectPromptVariables, estimatePromptTokens, splitPromptIntoSegments } from "./promptView";
import { parsePublicRoute, stepperItems } from "./routes";
import type { ApiState } from "./viewTypes";

describe("web view helpers", () => {
  test("maps every public route to its stable shell title", () => {
    const expectedTitles = new Map([
      ["/app", "Acme AI workspace"],
      ["/app/workspace/acme-ai", "Acme AI workspace"],
      ["/audit", "Free audit"],
      ["/app/setup", "Setup"],
      [`/app/prompts/${DEMO_IDS.prompt}`, "Prompt"],
      [`/app/projects/${DEMO_IDS.project}/audit`, "Audit"],
      [`/app/projects/${DEMO_IDS.project}/success`, "Success contract"],
      [`/app/projects/${DEMO_IDS.project}/candidates`, "Candidates"],
      [`/app/projects/${DEMO_IDS.project}/models`, "Model shortlist"],
      [`/app/eval-runs/${DEMO_IDS.evalRun}`, "Eval matrix"],
      [`/app/reports/${DEMO_IDS.report}`, "Recommendation report"],
      [`/app/reports/${DEMO_IDS.report}/export`, "Export package"]
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
    expect(formatTaskType("rag")).toBe("RAG");
    expect(formatTaskType("classification")).toBe("Classification");
    expect(formatAuditCostEstimate(demoAudit)).toBe("Blocked");
    expect(
      formatSensitiveFinding({
        type: "pii",
        severity: "medium",
        label: "Email address",
        redactedPreview: "ops@...om",
        reasonCode: "pii_email"
      })
    ).toBe("Email address: ops@...om");
    const firstSuggestedRole = demoAudit.suggestedModelRoles[0];

    expect(firstSuggestedRole).toBeDefined();

    if (firstSuggestedRole) {
      expect(formatSuggestedRole(firstSuggestedRole)).toBe("Baseline: openai-demo-balanced");
    }
  });

  test("detects prompt variables and creates highlight segments", () => {
    const prompt = "Summarize {{ticket_text}} for {{ account_tier }}. Route {{ticket_text}}.";

    expect(detectPromptVariables(prompt)).toEqual(["ticket_text", "account_tier"]);
    expect(splitPromptIntoSegments(prompt).filter((segment) => segment.kind === "variable")).toEqual([
      { kind: "variable", text: "{{ticket_text}}", variable: "ticket_text" },
      { kind: "variable", text: "{{ account_tier }}", variable: "account_tier" },
      { kind: "variable", text: "{{ticket_text}}", variable: "ticket_text" }
    ]);
    expect(estimatePromptTokens(prompt)).toBe(Math.ceil(prompt.length / 4));
    expect(estimatePromptTokens("   ")).toBe(0);
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
