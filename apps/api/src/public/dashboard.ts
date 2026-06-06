import { type Context } from "hono";
import { autoDraftQualityContract, costQualityFrontier, decideRecommendation } from "@promptopts/eval-core";
import {
  generateAggressiveCandidate,
  generateBalancedCandidate,
  generateConservativeCandidate,
  generateModelSpecificCandidate,
  generateOutputLiteCandidate,
  type GeneratedPromptCandidate,
  type PromptCandidateGenerationInput
} from "@promptopts/prompt-core";
import {
  type CandidateStrategy,
  type Account,
  type Contact,
  type CrmNote,
  type CrmTask,
  type Entitlement,
  type EvalResult,
  type EvalRun,
  type FreeAudit,
  type FreeAuditCapture,
  type OptimizationCandidate,
  type Opportunity,
  type PromptAnalysis,
  type PromptOptsRepository,
  type PromptProject,
  type PromptVersion,
  type ProviderConnection,
  type QualityContract,
  type RecommendationReport,
  type TestCase,
  type UsageLedgerEntry
} from "@promptopts/shared";
import { encryptSecret, fingerprintSecret } from "@promptopts/shared/security";
import { errorResponseSchema, type WorkspaceDashboardResponse, type WorkspaceDashboardStatus } from "../contracts";
import type { ApiEnv } from "../context";
import { createId, nowIso, unitForFeature } from "../http";

async function getWorkspaceDashboard(
  repository: PromptOptsRepository,
  workspaceSlugOrId: string
): Promise<WorkspaceDashboardResponse | null> {
  const [workspaces, projects, prompts, promptVersions, analyses, candidates, evalRuns, evalResults, reports, opportunities] =
    await Promise.all([
      repository.workspaces.list(),
      repository.projects.list(),
      repository.prompts.list(),
      repository.prompt_versions.list(),
      repository.prompt_analyses.list(),
      repository.optimization_candidates.list(),
      repository.eval_runs.list(),
      repository.eval_results.list(),
      repository.reports.list(),
      repository.opportunities.list()
    ]);
  const workspace = workspaces.find(
    (item) => item.slug === workspaceSlugOrId || item.id === workspaceSlugOrId
  );

  if (!workspace) {
    return null;
  }

  const workspaceProjects = projects.filter((project) => project.workspace_id === workspace.id);
  const projectIds = new Set(workspaceProjects.map((project) => project.id));
  const projectPrompts = prompts.filter((prompt) => projectIds.has(prompt.project_id));
  const promptIds = new Set(projectPrompts.map((prompt) => prompt.id));
  const workspacePromptVersions = promptVersions.filter((version) => promptIds.has(version.prompt_id));
  const promptVersionIds = new Set(workspacePromptVersions.map((version) => version.id));
  const workspaceCandidates = candidates.filter((candidate) =>
    promptVersionIds.has(candidate.prompt_version_id)
  );
  const optimizedPromptIds = new Set(
    workspaceCandidates
      .filter((candidate) => !candidate.is_baseline)
      .map((candidate) =>
        workspacePromptVersions.find((version) => version.id === candidate.prompt_version_id)?.prompt_id
      )
      .filter((promptId): promptId is string => Boolean(promptId))
  );
  const workspaceEvalRuns = evalRuns.filter((evalRun) => projectIds.has(evalRun.project_id));
  const evalRunIds = new Set(workspaceEvalRuns.map((evalRun) => evalRun.id));
  const workspaceEvalResults = evalResults.filter((result) => evalRunIds.has(result.eval_run_id));
  const workspaceReports = reports.filter((report) => projectIds.has(report.project_id));
  const workspaceOpportunities = opportunities.filter((opportunity) =>
    opportunity.project_id ? projectIds.has(opportunity.project_id) : false
  );
  const flaggedModels = new Set(
    workspaceProjects
      .map((project) => {
        const analysis = getLatestAnalysisForProject(project, projectPrompts, promptVersions, analyses);

        return analysis && analysis.model_fit !== "appropriate"
          ? `${project.current_provider}:${project.current_model_id}`
          : null;
      })
      .filter((modelId): modelId is string => Boolean(modelId))
  );
  const averagePassRate =
    workspaceEvalResults.length > 0
      ? workspaceEvalResults.reduce((sum, result) => sum + result.pass_rate, 0) / workspaceEvalResults.length
      : null;
  const recentProjects = workspaceProjects
    .map((project) =>
      createDashboardProjectRow({
        project,
        prompts: projectPrompts,
        promptVersions,
        analyses,
        evalRuns: workspaceEvalRuns,
        evalResults: workspaceEvalResults,
        reports: workspaceReports,
        opportunities: workspaceOpportunities
      })
    )
    .sort((a, b) => getNullableTimestampValue(b.last_eval_at) - getNullableTimestampValue(a.last_eval_at));
  const verifiedSavings = recentProjects
    .filter((project) => project.savings_status === "verified" && project.savings_usd !== null)
    .reduce((sum, project) => sum + (project.savings_usd ?? 0), 0);

  return {
    workspace,
    metrics: {
      verified_monthly_savings_usd: verifiedSavings > 0 ? verifiedSavings : null,
      verified_savings_note:
        verifiedSavings > 0
          ? "Verified savings only include reports with passing eval gates and fresh registry metadata."
          : "No verified monthly savings yet; savings require passing evals and fresh registry metadata.",
      prompts_optimized: optimizedPromptIds.size,
      eval_pass_average: averagePassRate,
      models_flagged: flaggedModels.size
    },
    recent_projects: recentProjects,
    notes: [
      "Dashboard is limited to projects, prompt versions, evals, reports, usage estimates, and status.",
      "Unverified registry metadata blocks exact savings claims."
    ]
  };
}

function createDashboardProjectRow(input: {
  project: PromptProject;
  prompts: Array<{ id: string; project_id: string; name: string }>;
  promptVersions: PromptVersion[];
  analyses: PromptAnalysis[];
  evalRuns: EvalRun[];
  evalResults: EvalResult[];
  reports: RecommendationReport[];
  opportunities: Opportunity[];
}): WorkspaceDashboardResponse["recent_projects"][number] {
  const prompt = input.prompts.find((item) => item.project_id === input.project.id) ?? null;
  const latestAnalysis = getLatestAnalysisForProject(
    input.project,
    input.prompts,
    input.promptVersions,
    input.analyses
  );
  const projectEvalRuns = input.evalRuns.filter((evalRun) => evalRun.project_id === input.project.id);
  const latestEvalRun = getLatestByTimestamp(projectEvalRuns, getEvalRunTimestamp);
  const projectReports = input.reports.filter((report) => report.project_id === input.project.id);
  const latestReport = getLatestByTimestamp(projectReports, getReportTimestamp);
  const projectEvalResults = latestEvalRun
    ? input.evalResults.filter((result) => result.eval_run_id === latestEvalRun.id)
    : [];
  const savings = getDashboardSavings(latestReport, input.opportunities, input.project.id);

  return {
    project_id: input.project.id,
    project_name: input.project.name,
    prompt_id: prompt?.id ?? null,
    prompt_name: prompt?.name ?? null,
    provider: input.project.current_provider,
    current_model_id: input.project.current_model_id,
    fit: latestAnalysis?.model_fit ?? null,
    savings_usd: savings.value,
    savings_status: savings.status,
    last_eval_at: latestEvalRun ? getEvalRunTimestamp(latestEvalRun) : null,
    status: getDashboardStatus(latestReport, latestEvalRun, projectEvalResults)
  };
}

function getDashboardSavings(
  report: RecommendationReport | undefined,
  opportunities: Opportunity[],
  projectId: string
): { value: number | null; status: WorkspaceDashboardResponse["recent_projects"][number]["savings_status"] } {
  if (!report) {
    return { value: null, status: "not_available" };
  }

  if (!report.production_recommendation_allowed) {
    return { value: null, status: "blocked" };
  }

  const opportunity = opportunities.find((item) => item.project_id === projectId);
  const value = opportunity?.estimated_savings ?? opportunity?.savings_opportunity_usd ?? null;

  if (report.registry_freshness !== "fresh") {
    return { value, status: "unverified" };
  }

  return { value, status: value === null ? "not_available" : "verified" };
}

function getDashboardStatus(
  report: RecommendationReport | undefined,
  evalRun: EvalRun | undefined,
  results: EvalResult[]
): WorkspaceDashboardStatus {
  if (report?.status === "exported" && report.production_recommendation_allowed) {
    return "deployed";
  }

  if (report?.production_recommendation_allowed) {
    return "ready";
  }

  if (report?.stronger_fallback_result_id && !report.winner_result_id) {
    return "fallback";
  }

  if (
    evalRun?.status === "failed" ||
    (results.length > 0 && results.every((result) => result.verdict !== "pass"))
  ) {
    return "failed";
  }

  return "review";
}

function getLatestAnalysisForProject(
  project: PromptProject,
  prompts: Array<{ id: string; project_id: string }>,
  promptVersions: PromptVersion[],
  analyses: PromptAnalysis[]
): PromptAnalysis | undefined {
  const projectPromptIds = new Set(
    prompts.filter((prompt) => prompt.project_id === project.id).map((prompt) => prompt.id)
  );
  const projectVersionIds = new Set(
    promptVersions.filter((version) => projectPromptIds.has(version.prompt_id)).map((version) => version.id)
  );

  return getLatestByTimestamp(
    analyses.filter((analysis) => projectVersionIds.has(analysis.prompt_version_id)),
    (analysis) => analysis.created_at
  );
}

function getLatestByTimestamp<TItem>(
  items: TItem[],
  getTimestamp: (item: TItem) => string | null
): TItem | undefined {
  return [...items].sort(
    (a, b) => getNullableTimestampValue(getTimestamp(b)) - getNullableTimestampValue(getTimestamp(a))
  )[0];
}

function getNullableTimestampValue(value: string | null): number {
  return value ? Date.parse(value) : 0;
}

function getEvalRunTimestamp(evalRun: EvalRun): string {
  return evalRun.completed_at ?? evalRun.started_at ?? evalRun.queued_at;
}

function getReportTimestamp(report: RecommendationReport): string {
  return report.generated_at ?? report.updated_at ?? report.created_at;
}


export { getWorkspaceDashboard };
