export type ProductStepKey =
  | "setup"
  | "prompt"
  | "audit"
  | "success"
  | "candidates"
  | "evals"
  | "report"
  | "exports";

export type ProductStep = {
  key: ProductStepKey;
  label: string;
  path: string;
};

export type PublicRoute =
  | { kind: "app-home"; activeStep: ProductStepKey; path: string }
  | { kind: "workspace-dashboard"; activeStep: ProductStepKey; path: string; workspaceSlug: string }
  | { kind: "setup"; activeStep: ProductStepKey; path: string }
  | { kind: "prompt"; activeStep: ProductStepKey; path: string; promptId: string }
  | { kind: "audit"; activeStep: ProductStepKey; path: string; projectId: string }
  | { kind: "success"; activeStep: ProductStepKey; path: string; projectId: string }
  | { kind: "candidates"; activeStep: ProductStepKey; path: string; projectId: string }
  | { kind: "models"; activeStep: ProductStepKey; path: string; projectId: string }
  | { kind: "eval-run"; activeStep: ProductStepKey; path: string; evalRunId: string }
  | { kind: "report"; activeStep: ProductStepKey; path: string; reportId: string }
  | { kind: "report-export"; activeStep: ProductStepKey; path: string; reportId: string }
  | { kind: "free-audit"; activeStep: ProductStepKey; path: string }
  | { kind: "not-found"; activeStep: null; path: string };

export const stepperItems: ProductStep[] = [
  { key: "setup", label: "Setup", path: "/app/setup" },
  { key: "prompt", label: "Prompt", path: "/app/prompts/prompt_demo_support" },
  { key: "audit", label: "Audit", path: "/app/projects/project_demo_support/audit" },
  { key: "success", label: "Success", path: "/app/projects/project_demo_support/success" },
  { key: "candidates", label: "Candidates", path: "/app/projects/project_demo_support/candidates" },
  { key: "evals", label: "Evals", path: "/app/eval-runs/eval_demo_support" },
  { key: "report", label: "Report", path: "/app/reports/report_demo_support" },
  { key: "exports", label: "Exports", path: "/app/reports/report_demo_support/export" }
];

export function parsePublicRoute(pathname: string): PublicRoute {
  const path = normalizePath(pathname);

  if (path === "/" || path === "/app") {
    return { kind: "app-home", activeStep: "setup", path: "/app" };
  }

  if (path === "/audit" || path === "/free-audit") {
    return { kind: "free-audit", activeStep: "setup", path };
  }

  if (path === "/app/setup") {
    return { kind: "setup", activeStep: "setup", path };
  }

  const segments = path.split("/").filter(Boolean);

  if (segments[0] === "app" && segments[1] === "prompts" && segments[2] && segments.length === 3) {
    return {
      kind: "prompt",
      activeStep: "prompt",
      path,
      promptId: decodeURIComponent(segments[2])
    };
  }

  if (segments[0] === "app" && segments[1] === "workspace" && segments[2] && segments.length === 3) {
    return {
      kind: "workspace-dashboard",
      activeStep: "setup",
      path,
      workspaceSlug: decodeURIComponent(segments[2])
    };
  }

  if (segments[0] === "app" && segments[1] === "projects" && segments[2] && segments[3]) {
    const projectId = decodeURIComponent(segments[2]);

    if (segments[3] === "audit" && segments.length === 4) {
      return { kind: "audit", activeStep: "audit", path, projectId };
    }

    if (segments[3] === "success" && segments.length === 4) {
      return { kind: "success", activeStep: "success", path, projectId };
    }

    if (segments[3] === "candidates" && segments.length === 4) {
      return { kind: "candidates", activeStep: "candidates", path, projectId };
    }

    if (segments[3] === "models" && segments.length === 4) {
      return { kind: "models", activeStep: "evals", path, projectId };
    }
  }

  if (segments[0] === "app" && segments[1] === "eval-runs" && segments[2] && segments.length === 3) {
    return {
      kind: "eval-run",
      activeStep: "evals",
      path,
      evalRunId: decodeURIComponent(segments[2])
    };
  }

  if (segments[0] === "app" && segments[1] === "reports" && segments[2]) {
    const reportId = decodeURIComponent(segments[2]);

    if (segments.length === 3) {
      return { kind: "report", activeStep: "report", path, reportId };
    }

    if (segments[3] === "export" && segments.length === 4) {
      return { kind: "report-export", activeStep: "exports", path, reportId };
    }
  }

  return { kind: "not-found", activeStep: null, path };
}

function normalizePath(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, "");

  return normalized.length > 0 ? normalized : "/";
}
