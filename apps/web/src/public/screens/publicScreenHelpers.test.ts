import { describe, expect, test } from "bun:test";
import { demoModelRegistry } from "../../mockData";
import {
  createFreeAuditRequest,
  createLocalFreeAuditPreview,
  filterModelsForSetup,
  formatPromptSaveState,
  taskTypeOptions
} from "./publicScreenHelpers";

describe("public screen helpers", () => {
  test("filters registry models by provider and task", () => {
    const models = filterModelsForSetup(demoModelRegistry, "openai", "support");

    expect(models.length).toBeGreaterThan(0);
    expect(models.every((model) => model.provider === "openai")).toBe(true);
    expect(models.every((model) => model.recommended_task_types.includes("support"))).toBe(true);
    expect(taskTypeOptions).toContain("classification");
  });

  test("formats prompt save state copy", () => {
    expect(formatPromptSaveState("idle")).toBe("Not saved");
    expect(formatPromptSaveState("saving")).toBe("Saving");
    expect(formatPromptSaveState("saved")).toBe("Saved");
    expect(formatPromptSaveState("error")).toBe("API required");
  });

  test("creates local free audit previews and request payloads", () => {
    const preview = createLocalFreeAuditPreview("Classify {{ticket_text}}");
    const emptyPreview = createLocalFreeAuditPreview("");
    const request = createFreeAuditRequest(
      "run_evals",
      {
        provider: "openai",
        currentModelId: "openai-demo-balanced",
        taskType: "support",
        monthlyCalls: 1000,
        priority: "balanced",
        promptText: "Classify {{ticket_text}}",
        contactEmail: " buyer@example.com ",
        company: " Acme AI "
      },
      "openai-demo-balanced"
    );

    expect(preview.inputTokens).toBeGreaterThan(0);
    expect(emptyPreview.estimatedOutputTokens).toBe(0);
    expect(request.source).toBe("free_audit");
    expect(request.contactEmail).toBe("buyer@example.com");
    expect(request.company).toBe("Acme AI");
    expect(request.constraints.requiresJson).toBe(false);
  });
});
