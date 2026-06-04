import type { Provider } from "@promptopts/shared";
import { demoWorkspace } from "./mockData";
import type { ProductStepKey, PublicRoute } from "./routes";

export function getRouteTitle(route: PublicRoute): string {
  switch (route.kind) {
    case "app-home":
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

export function formatModelFit(value: string): string {
  return value.replace(/^\w/, (letter) => letter.toUpperCase());
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
