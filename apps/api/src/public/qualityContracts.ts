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

async function getQualityContractState(repository: PromptOptsRepository, project: PromptProject) {
  const persisted = await getPersistedQualityContract(repository, project.id);
  const contract = persisted ?? createDraftQualityContract(project, await getLatestPromptAnalysis(repository, project));
  const testCases = persisted ? await getContractTestCases(repository, persisted.id) : [];

  return {
    contract,
    test_cases: testCases,
    ...getProductionRecommendationState(testCases),
    source: persisted ? "persisted" : "auto_draft"
  };
}

async function getPersistedQualityContract(
  repository: PromptOptsRepository,
  projectId: string
): Promise<QualityContract | undefined> {
  const contracts = await repository.quality_contracts.list();

  return contracts.find((contract) => contract.project_id === projectId);
}

async function getContractTestCases(repository: PromptOptsRepository, contractId: string): Promise<TestCase[]> {
  const testCases = await repository.test_cases.list();

  return testCases.filter((testCase) => testCase.quality_contract_id === contractId);
}

async function getEvalResults(repository: PromptOptsRepository, evalRunId: string): Promise<EvalResult[]> {
  const results = await repository.eval_results.list();

  return results.filter((result) => result.eval_run_id === evalRunId);
}

async function getReportDetail(repository: PromptOptsRepository, reportId: string) {
  const report = await repository.reports.get(reportId);
  if (!report) {
    return null;
  }

  const evalRun = await repository.eval_runs.get(report.eval_run_id);
  if (!evalRun) {
    return null;
  }

  const results = await getEvalResults(repository, evalRun.id);
  const testCases = await getContractTestCases(repository, evalRun.quality_contract_id);
  const decision = decideRecommendation({
    evalRunId: evalRun.id,
    results,
    passThreshold: evalRun.pass_threshold,
    testCaseCount: testCases.length
  });

  return {
    report,
    eval_run: evalRun,
    results,
    frontier_points: costQualityFrontier(results, {
      evalRunId: evalRun.id,
      passThreshold: evalRun.pass_threshold
    }),
    decision
  };
}

async function getLatestPromptAnalysis(
  repository: PromptOptsRepository,
  project: PromptProject
): Promise<PromptAnalysis> {
  const prompts = (await repository.prompts.list()).filter((prompt) => prompt.project_id === project.id);
  const promptIds = new Set(prompts.map((prompt) => prompt.id));
  const versionIds = new Set(
    (await repository.prompt_versions.list())
      .filter((version) => promptIds.has(version.prompt_id))
      .map((version) => version.id)
  );
  const analyses = (await repository.prompt_analyses.list()).filter((analysis) =>
    versionIds.has(analysis.prompt_version_id)
  );

  return analyses.sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? createFallbackPromptAnalysis(project);
}

function createDraftQualityContract(project: PromptProject, analysis: PromptAnalysis): QualityContract {
  const timestamp = nowIso();
  const draft = autoDraftQualityContract(analysis);

  return {
    id: createId("quality_contract_draft"),
    project_id: project.id,
    ...draft,
    is_mock: true,
    created_at: timestamp,
    updated_at: timestamp
  };
}

function createFallbackPromptAnalysis(project: PromptProject): PromptAnalysis {
  const timestamp = nowIso();

  return {
    id: createId("analysis_draft"),
    prompt_version_id: "prompt_version_draft",
    provider: project.current_provider,
    model_id: project.current_model_id,
    task_type: project.task_type,
    input_tokens: 0,
    estimated_output_tokens: 0,
    model_fit: "appropriate",
    waste_findings: [],
    risk_level: "medium",
    compression_guardrails: ["Preserve required output format.", "Keep user-visible behavior stable."],
    registry_freshness: "unverified",
    is_mock: true,
    created_at: timestamp
  };
}

function getProductionRecommendationState(testCases: TestCase[]) {
  const blockers = ["Eval matrix has not passed threshold with zero must-pass failures."];

  if (testCases.length === 0) {
    blockers.unshift("No test cases exist; production recommendation is disabled until tests are added.");
  }

  return {
    production_recommendation_allowed: false,
    production_blockers: blockers
  };
}


export { createDraftQualityContract, createFallbackPromptAnalysis, getContractTestCases, getEvalResults, getLatestPromptAnalysis, getPersistedQualityContract, getProductionRecommendationState, getQualityContractState, getReportDetail };
