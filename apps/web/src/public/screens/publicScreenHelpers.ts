import type {
  AuditRequest,
  AuditResponse,
  FreeAuditCta,
  ModelRegistryRecord,
  Priority,
  Provider,
  TaskType
} from "@promptopts/shared";
import { demoAudit } from "../../mockData";
import { estimatePromptTokens } from "../../promptView";

export const taskTypeOptions: TaskType[] = [
  "support",
  "summarization",
  "extraction",
  "coding",
  "rag",
  "agent",
  "classification",
  "other"
];

export type FreeAuditDraft = {
  provider: Provider;
  currentModelId: string;
  taskType: TaskType;
  monthlyCalls: number;
  priority: Priority;
  promptText: string;
  contactEmail: string;
  company: string;
};

export function filterModelsForSetup(
  registryModels: ModelRegistryRecord[],
  provider: Provider,
  taskType: TaskType
): ModelRegistryRecord[] {
  return registryModels.filter((model) => {
    return model.provider === provider && model.recommended_task_types.includes(taskType);
  });
}

export function formatPromptSaveState(state: "idle" | "saving" | "saved" | "error"): string {
  switch (state) {
    case "idle":
      return "Not saved";
    case "saving":
      return "Saving";
    case "saved":
      return "Saved";
    case "error":
      return "API required";
  }
}

export function createLocalFreeAuditPreview(promptText: string): AuditResponse {
  const inputTokens = estimatePromptTokens(promptText);

  return {
    ...demoAudit,
    inputTokens,
    estimatedOutputTokens: promptText.trim().length === 0 ? 0 : demoAudit.estimatedOutputTokens,
    createdAt: new Date().toISOString()
  };
}

export function createFreeAuditRequest(
  ctaClicked: FreeAuditCta,
  draft: FreeAuditDraft,
  selectedModelId: string
): AuditRequest {
  const contactEmail = draft.contactEmail.trim();

  return {
    provider: draft.provider,
    modelId: selectedModelId,
    prompt: draft.promptText,
    taskType: draft.taskType,
    monthlyCalls: draft.monthlyCalls,
    priority: draft.priority,
    source: "free_audit",
    contactEmail: /\S+@\S+\.\S+/.test(contactEmail) ? contactEmail : undefined,
    company: draft.company.trim() || undefined,
    ctaClicked,
    constraints: {
      requiresJson: false,
      usesTools: false,
      usesImages: false,
      needsStructuredOutput: false,
      maxLatencyMs: null,
      minContextWindow: null
    }
  };
}
