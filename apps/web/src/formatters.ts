import type {
  AuditResponse,
  Provider,
  SensitiveFinding,
  SuggestedModelRole,
  TaskType
} from "@promptopts/shared";
import { demoWorkspace } from "./mockData";
import type { ProductStepKey, PublicRoute } from "./routes";

export function getRouteTitle(route: PublicRoute): string {
  switch (route.kind) {
    case "app-home":
    case "workspace-dashboard":
      return `${demoWorkspace.name} workspace`;
    case "free-audit":
      return "Free audit";
    case "setup":
      return "Setup";
    case "prompt":
      return "Prompt";
    case "audit":
      return "Audit";
    case "success":
      return "Success contract";
    case "candidates":
      return "Candidates";
    case "models":
      return "Model shortlist";
    case "eval-run":
      return "Eval matrix";
    case "report":
      return "Recommendation report";
    case "report-export":
      return "Export package";
    case "not-found":
      return "Not found";
  }
}

export function getStepCardTitle(step: ProductStepKey): string {
  switch (step) {
    case "setup":
      return "Provider/model setup";
    case "prompt":
      return "Prompt paste";
    case "audit":
      return "Risk and model fit";
    case "success":
      return "Quality contract";
    case "candidates":
      return "Prompt candidates";
    case "evals":
      return "Model shortlist and evals";
    case "report":
      return "One recommendation";
    case "exports":
      return "Deploy package";
  }
}

export function formatProvider(provider: Provider): string {
  switch (provider) {
    case "openai":
      return "OpenAI";
    case "anthropic":
      return "Anthropic";
    case "gemini":
      return "Gemini";
  }
}

export function formatTaskType(taskType: TaskType): string {
  switch (taskType) {
    case "support":
      return "Support";
    case "summarization":
      return "Summarization";
    case "extraction":
      return "Extraction";
    case "coding":
      return "Coding";
    case "rag":
      return "RAG";
    case "agent":
      return "Agent";
    case "classification":
      return "Classification";
    case "other":
      return "Other";
  }
}

export function formatModelFit(value: string): string {
  return value.replace(/^\w/, (letter) => letter.toUpperCase());
}

export function formatRiskLevel(riskLevel: AuditResponse["riskLevel"]): string {
  switch (riskLevel) {
    case "low":
      return "Low";
    case "medium":
      return "Medium";
    case "high":
      return "High";
    case "critical":
      return "Critical";
  }
}

export function formatAuditCostEstimate(audit: AuditResponse): string {
  const estimate = audit.monthlyCostEstimate.estimatedMonthlyCostUsd;

  if (estimate === null) {
    return "Blocked";
  }

  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(estimate);

  return audit.monthlyCostEstimate.unverified ? `${formatted} unverified` : formatted;
}

export function formatSensitiveFinding(finding: SensitiveFinding): string {
  return `${finding.label}: ${finding.redactedPreview}`;
}

export function formatSuggestedRole(role: SuggestedModelRole): string {
  switch (role.role) {
    case "baseline":
      return `Baseline: ${role.modelId}`;
    case "cheaper_candidate":
      return `Cheaper candidate: ${role.modelId}`;
    case "stronger_fallback":
      return `Stronger fallback: ${role.modelId}`;
    case "registry_verification":
      return `Registry verification: ${role.modelId}`;
  }
}

export function formatStrategy(strategy: string): string {
  return strategy
    .split("_")
    .map((part) => part.replace(/^\w/, (letter) => letter.toUpperCase()))
    .join(" ");
}

export function formatCandidateId(candidateId: string): string {
  return candidateId.replace("candidate_", "").replaceAll("_", " ");
}
