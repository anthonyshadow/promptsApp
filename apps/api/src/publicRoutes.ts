import { Hono } from "hono";
import { z } from "zod";
import { autoDraftQualityContract, costQualityFrontier, decideRecommendation } from "@promptopts/eval-core";
import { runEvalRun } from "@promptopts/eval-runner";
import { generateReportArtifacts } from "@promptopts/report-generator";
import {
  filterByCapability,
  type ModelCapabilityFilterInput,
  type ModelModality
} from "@promptopts/model-registry";
import {
  generateAggressiveCandidate,
  generateBalancedCandidate,
  generateConservativeCandidate,
  generateModelSpecificCandidate,
  generateOutputLiteCandidate,
  parsePrompt,
  runPromptModelAudit,
  type GeneratedPromptCandidate,
  type PromptCandidateGenerationInput
} from "@promptopts/prompt-core";
import {
  type CandidateStrategy,
  createHealthResponse,
  providerSchema,
  reportArtifactFormatSchema,
  stabilityStatusSchema,
  taskTypeSchema,
  type Account,
  type Contact,
  type EvalResult,
  type EvalRun,
  type FreeAudit,
  type FreeAuditCapture,
  type OptimizationCandidate,
  type Opportunity,
  type PromptAnalysis,
  type PromptProject,
  type PromptVersion,
  type PromptOptsRepository,
  type QualityContract,
  type RecommendationReport,
  type ReportArtifact,
  type TestCase
} from "@promptopts/shared";
import {
  auditRequestSchema,
  auditResponseSchema,
  evalRunCreateRequestSchema,
  evalRunDetailResponseSchema,
  modelsResponseSchema,
  promptCreateRequestSchema,
  promptCreateResponseSchema,
  promptOptimizeRequestSchema,
  promptOptimizeResponseSchema,
  qualityContractRequestSchema,
  qualityContractResponseSchema,
  reportCreateRequestSchema,
  reportDetailResponseSchema,
  reportExportResponseSchema,
  testCaseCreateRequestSchema,
  testCaseMutationResponseSchema,
  testCasePatchRequestSchema,
  workspaceDashboardResponseSchema,
  type WorkspaceDashboardResponse,
  type WorkspaceDashboardStatus
} from "./contracts";
import type { ApiEnv } from "./context";
import {
  createId,
  getEvalRunDetail,
  notFound,
  nowIso,
  redactedPreview,
  validateJson,
  validationProblem
} from "./http";

const modelModalitySchema = z.enum(["text", "image", "audio", "video"]) satisfies z.ZodType<ModelModality>;
const booleanQuerySchema = z.enum(["true", "false"]).transform((value) => value === "true");

export function createPublicApiRoutes() {
  return new Hono<ApiEnv>()
    .get("/health", (c) => c.json(createHealthResponse("api")))
    .get("/workspaces/:slug/dashboard", async (c) => {
      const dashboard = await getWorkspaceDashboard(c.var.repository, c.req.param("slug"));

      if (!dashboard) {
        return notFound(c, "Workspace not found");
      }

      return c.json(workspaceDashboardResponseSchema.parse(dashboard));
    })
    .get("/models", async (c) => {
      const providerQuery = c.req.query("provider");
      const providerResult = providerQuery ? providerSchema.safeParse(providerQuery) : undefined;
      const taskTypeQuery = c.req.query("task_type") ?? c.req.query("taskType") ?? c.req.query("task");
      const taskTypeResult = taskTypeQuery ? taskTypeSchema.safeParse(taskTypeQuery) : undefined;
      const stabilityQuery = c.req.query("stability") ?? c.req.query("stability_status");
      const stabilityValues = stabilityQuery ? stabilityQuery.split(",").filter(Boolean) : [];
      const stabilityResults = stabilityValues.map((value) => stabilityStatusSchema.safeParse(value));
      const modalityQuery = c.req.query("modality");
      const modalityResult = modalityQuery ? modelModalitySchema.safeParse(modalityQuery) : undefined;
      const structuredQuery =
        c.req.query("supportsStructuredOutput") ?? c.req.query("supports_structured_output");
      const structuredResult = structuredQuery ? booleanQuerySchema.safeParse(structuredQuery) : undefined;
      const toolsQuery = c.req.query("supportsTools") ?? c.req.query("supports_tools");
      const toolsResult = toolsQuery ? booleanQuerySchema.safeParse(toolsQuery) : undefined;

      if (providerResult && !providerResult.success) {
        return validationProblem(c, providerResult.error);
      }
      if (taskTypeResult && !taskTypeResult.success) {
        return validationProblem(c, taskTypeResult.error);
      }
      for (const result of stabilityResults) {
        if (!result.success) {
          return validationProblem(c, result.error);
        }
      }
      if (modalityResult && !modalityResult.success) {
        return validationProblem(c, modalityResult.error);
      }
      if (structuredResult && !structuredResult.success) {
        return validationProblem(c, structuredResult.error);
      }
      if (toolsResult && !toolsResult.success) {
        return validationProblem(c, toolsResult.error);
      }

      const provider = providerResult?.data;
      const taskType = taskTypeResult?.data;
      const stabilityStatuses = stabilityValues.map((value) => stabilityStatusSchema.parse(value));
      const modelFilter: ModelCapabilityFilterInput = {
        models: await c.var.repository.model_registry.list(),
        stability: stabilityStatuses
      };

      if (provider) {
        modelFilter.provider = provider;
      }
      if (taskType) {
        modelFilter.taskType = taskType;
      }
      if (modalityResult?.data) {
        modelFilter.modality = modalityResult.data;
      }
      if (structuredResult?.data !== undefined) {
        modelFilter.supportsStructuredOutput = structuredResult.data;
      }
      if (toolsResult?.data !== undefined) {
        modelFilter.supportsTools = toolsResult.data;
      }

      const models = filterByCapability(modelFilter);

      return c.json(
        modelsResponseSchema.parse({
          models,
          registry_note:
            "Model metadata is served from the registry; demo rows are mock/unverified until approved."
        })
      );
    })
    .post("/audits", async (c) => {
      const body = await validateJson(c, auditRequestSchema);
      if (!body.success) {
        return body.response;
      }

      const modelRegistryRecords = await c.var.repository.model_registry.list();
      const audit = runPromptModelAudit({
        ...body.data,
        modelRegistryRecords
      });
      const promptVersionId = await resolvePromptVersionId(
        c.var.repository,
        body.data.prompt,
        body.data.promptVersionId
      );

      const response = auditResponseSchema.parse({
        id: createId("audit"),
        inputTokens: audit.inputTokens,
        estimatedOutputTokens: audit.estimatedOutputTokens,
        monthlyCostEstimate: audit.monthlyCostEstimate,
        modelFit: audit.modelFit,
        modelFitReasons: audit.modelFitReasons,
        wasteFindings: audit.wasteFindings,
        riskLevel: audit.riskLevel,
        sensitiveFindings: audit.sensitiveFindings,
        compressionGuardrails: audit.compressionGuardrails,
        suggestedModels: audit.suggestedModels,
        suggestedModelRoles: audit.suggestedModelRoles,
        suggestedNextAction: audit.suggestedNextAction,
        registryFreshness: audit.registryFreshness,
        freeAudit:
          body.data.source === "free_audit"
            ? await createFreeAuditCapture(c.var.repository, {
                auditId: createId("free_audit"),
                provider: body.data.provider,
                modelId: body.data.modelId,
                taskType: body.data.taskType,
                monthlyCalls: body.data.monthlyCalls,
                modelFit: audit.modelFit,
                savingsOpportunityUsd: null,
                contactEmail: body.data.contactEmail ?? null,
                company: body.data.company ?? null,
                ctaClicked: body.data.ctaClicked ?? "preview",
                prompt: body.data.prompt,
                timestamp: nowIso()
              })
            : undefined,
        createdAt: nowIso()
      });

      if (promptVersionId) {
        const analysis: PromptAnalysis = {
          id: response.id,
          prompt_version_id: promptVersionId,
          provider: body.data.provider,
          model_id: body.data.modelId,
          task_type: body.data.taskType,
          input_tokens: response.inputTokens,
          estimated_output_tokens: response.estimatedOutputTokens,
          model_fit: response.modelFit,
          waste_findings: response.wasteFindings,
          risk_level: response.riskLevel,
          compression_guardrails: response.compressionGuardrails,
          registry_freshness: response.registryFreshness,
          is_mock: true,
          created_at: response.createdAt
        };

        await c.var.repository.prompt_analyses.create(analysis);
      }

      return c.json(response);
    })
    .post("/prompts", async (c) => {
      const body = await validateJson(c, promptCreateRequestSchema);
      if (!body.success) {
        return body.response;
      }

      const workspace = await c.var.repository.workspaces.get(body.data.workspace_id);
      if (!workspace) {
        return notFound(c, "Workspace not found");
      }

      const timestamp = nowIso();
      const projectId = createId("project");
      const promptId = createId("prompt");
      const versionId = createId("prompt_version");
      const project: PromptProject = {
        id: projectId,
        workspace_id: body.data.workspace_id,
        name: body.data.name,
        task_type: body.data.task_type,
        current_provider: body.data.provider,
        current_model_id: body.data.model_id,
        status: "active",
        is_mock: true,
        created_at: timestamp,
        updated_at: timestamp
      };
      const prompt = {
        id: promptId,
        project_id: projectId,
        name: body.data.name,
        current_version_id: versionId,
        redacted_preview: redactedPreview(body.data.prompt_text),
        is_mock: true,
        created_at: timestamp,
        updated_at: timestamp
      };
      const version: PromptVersion = {
        id: versionId,
        prompt_id: promptId,
        version: 1,
        label: "Initial prompt",
        prompt_text: body.data.prompt_text,
        variables: body.data.variables,
        status: "active",
        redacted_preview: redactedPreview(body.data.prompt_text),
        is_mock: true,
        created_by_user_id: null,
        created_at: timestamp
      };

      await c.var.repository.projects.create(project);
      await c.var.repository.prompts.create(prompt);
      await c.var.repository.prompt_versions.create(version);

      return c.json(promptCreateResponseSchema.parse({ project, prompt, version }), 201);
    })
    .post("/prompts/:id/optimize", async (c) => {
      const body = await validateJson(c, promptOptimizeRequestSchema);
      if (!body.success) {
        return body.response;
      }

      const prompt = await c.var.repository.prompts.get(c.req.param("id"));
      if (!prompt || !prompt.current_version_id) {
        return notFound(c, "Prompt not found");
      }

      const version = await c.var.repository.prompt_versions.get(prompt.current_version_id);
      if (!version) {
        return notFound(c, "Prompt version not found");
      }

      const project = await c.var.repository.projects.get(prompt.project_id);
      const qualityContract = project
        ? await getPersistedQualityContract(c.var.repository, project.id)
        : undefined;
      const preservedConstraints = getCandidatePreservedConstraints(qualityContract);
      const baselineAnalysis = parsePrompt(version.prompt_text);
      const timestamp = nowIso();
      const candidates: OptimizationCandidate[] = [];

      for (const strategy of body.data.strategies) {
        const generated =
          strategy === "baseline"
            ? null
            : generateCandidateForStrategy(strategy, {
                id: createId("candidate"),
                promptText: version.prompt_text,
                preservedConstraints,
                requiredOutput: qualityContract?.required_output ?? null,
                outputRequirements: qualityContract ? ["quality_contract"] : [],
                ...(project
                  ? {
                      provider: project.current_provider,
                      modelId: project.current_model_id
                    }
                  : {})
              });
        const candidate: OptimizationCandidate = generated
          ? mapGeneratedCandidateToRecord(
              generated,
              version.id,
              body.data.analysis_id,
              baselineAnalysis.approximateInputTokens,
              timestamp
            )
          : {
          id: createId("candidate"),
          label: "Baseline",
          prompt_version_id: version.id,
          analysis_id: body.data.analysis_id,
          strategy,
          candidate_prompt_text: version.prompt_text,
          estimated_input_tokens: baselineAnalysis.approximateInputTokens,
          estimated_output_tokens: baselineAnalysis.approximateOutputEstimate,
          rationale: "Baseline regression control; unchanged prompt and current model remain the comparison anchor.",
          risk_level: "low",
          expected_token_delta: 0,
          preserved_constraints: preservedConstraints.length > 0 ? preservedConstraints : ["Baseline prompt remains unchanged."],
          removed_or_compressed_elements: ["None; baseline is unchanged."],
          is_baseline: true,
          is_mock: true,
          created_at: timestamp
        };
        await c.var.repository.optimization_candidates.create(candidate);
        candidates.push(candidate);
      }

      return c.json(
        promptOptimizeResponseSchema.parse({
          candidates,
          todo: "Candidates are deterministic MVP drafts and remain provisional until evals pass."
        })
      );
    })
    .get("/projects/:id/quality-contract", async (c) => {
      const project = await c.var.repository.projects.get(c.req.param("id"));
      if (!project) {
        return notFound(c, "Project not found");
      }

      const result = await getQualityContractState(c.var.repository, project);

      return c.json(qualityContractResponseSchema.parse(result));
    })
    .post("/projects/:id/quality-contract", async (c) => {
      const body = await validateJson(c, qualityContractRequestSchema);
      if (!body.success) {
        return body.response;
      }

      const project = await c.var.repository.projects.get(c.req.param("id"));
      if (!project) {
        return notFound(c, "Project not found");
      }

      const timestamp = nowIso();
      const existing = await getPersistedQualityContract(c.var.repository, project.id);
      const contract =
        existing
          ? await c.var.repository.quality_contracts.update(existing.id, {
              ...body.data,
              updated_at: timestamp
            })
          : await c.var.repository.quality_contracts.create({
              id: createId("quality_contract"),
              project_id: project.id,
              ...body.data,
              is_mock: true,
              created_at: timestamp,
              updated_at: timestamp
            });

      if (!contract) {
        return notFound(c, "Quality contract not found");
      }

      const testCases = await getContractTestCases(c.var.repository, contract.id);

      return c.json(
        qualityContractResponseSchema.parse({
          contract,
          test_cases: testCases,
          ...getProductionRecommendationState(testCases),
          source: "persisted"
        }),
        existing ? 200 : 201
      );
    })
    .post("/quality-contracts/:id/test-cases", async (c) => {
      const body = await validateJson(c, testCaseCreateRequestSchema);
      if (!body.success) {
        return body.response;
      }

      const contract = await c.var.repository.quality_contracts.get(c.req.param("id"));
      if (!contract) {
        return notFound(c, "Quality contract not found");
      }

      const timestamp = nowIso();
      const testCase: TestCase = {
        id: createId("test_case"),
        project_id: contract.project_id,
        quality_contract_id: contract.id,
        name: body.data.name,
        input_variables: body.data.input_variables,
        expected_output: body.data.expected_output,
        checks: body.data.checks,
        is_mock: true,
        created_at: timestamp,
        updated_at: timestamp
      };

      await c.var.repository.test_cases.create(testCase);

      const testCases = await getContractTestCases(c.var.repository, contract.id);

      return c.json(
        testCaseMutationResponseSchema.parse({
          test_case: testCase,
          ...getProductionRecommendationState(testCases)
        }),
        201
      );
    })
    .patch("/test-cases/:id", async (c) => {
      const body = await validateJson(c, testCasePatchRequestSchema);
      if (!body.success) {
        return body.response;
      }

      const existing = await c.var.repository.test_cases.get(c.req.param("id"));
      if (!existing) {
        return notFound(c, "Test case not found");
      }

      const patch: Partial<Omit<TestCase, "id">> = { updated_at: nowIso() };

      if (body.data.name !== undefined) {
        patch.name = body.data.name;
      }
      if (body.data.input_variables !== undefined) {
        patch.input_variables = body.data.input_variables;
      }
      if (body.data.expected_output !== undefined) {
        patch.expected_output = body.data.expected_output;
      }
      if (body.data.checks !== undefined) {
        patch.checks = body.data.checks;
      }

      const testCase = await c.var.repository.test_cases.update(existing.id, patch);
      if (!testCase) {
        return notFound(c, "Test case not found");
      }
      const testCases = await getContractTestCases(c.var.repository, existing.quality_contract_id);

      return c.json(
        testCaseMutationResponseSchema.parse({
          test_case: testCase,
          ...getProductionRecommendationState(testCases)
        })
      );
    })
    .post("/eval-runs", async (c) => {
      const body = await validateJson(c, evalRunCreateRequestSchema);
      if (!body.success) {
        return body.response;
      }

      const project = await c.var.repository.projects.get(body.data.project_id);
      if (!project) {
        return notFound(c, "Project not found");
      }

      const timestamp = nowIso();
      const evalRun: EvalRun = {
        id: createId("eval_run"),
        project_id: body.data.project_id,
        quality_contract_id: body.data.quality_contract_id,
        baseline_prompt_version_id: body.data.baseline_prompt_version_id,
        candidate_ids: body.data.candidate_ids,
        model_registry_record_ids: body.data.model_registry_record_ids,
        status: "queued",
        pass_threshold: body.data.pass_threshold,
        is_mock: true,
        queued_at: timestamp,
        started_at: null,
        completed_at: null
      };

      await c.var.repository.eval_runs.create(evalRun);
      const runResult = await runEvalRun(
        c.var.repository,
        evalRun,
        body.data.test_case_ids ? { testCaseIds: body.data.test_case_ids } : {}
      );

      return c.json(runResult.evalRun, 201);
    })
    .get("/eval-runs/:id", async (c) => {
      const evalRun = await c.var.repository.eval_runs.get(c.req.param("id"));
      if (!evalRun) {
        return notFound(c, "Eval run not found");
      }

      return c.json(evalRunDetailResponseSchema.parse(await getEvalRunDetail(c.var.repository, evalRun)));
    })
    .post("/reports", async (c) => {
      const body = await validateJson(c, reportCreateRequestSchema);
      if (!body.success) {
        return body.response;
      }

      const evalRun = await c.var.repository.eval_runs.get(body.data.eval_run_id);
      if (!evalRun) {
        return notFound(c, "Eval run not found");
      }

      const timestamp = nowIso();
      const results = await getEvalResults(c.var.repository, evalRun.id);
      const testCases = await getContractTestCases(c.var.repository, evalRun.quality_contract_id);
      const decision = decideRecommendation({
        evalRunId: evalRun.id,
        results,
        passThreshold: evalRun.pass_threshold,
        testCaseCount: testCases.length
      });
      const report: RecommendationReport = {
        id: createId("report"),
        project_id: body.data.project_id,
        eval_run_id: body.data.eval_run_id,
        status: decision.productionRecommendationAllowed ? "ready" : "blocked",
        winner_result_id: decision.winnerResultId,
        cheaper_alternative_result_id: decision.cheaperAlternativeResultId,
        stronger_fallback_result_id: decision.strongerFallbackResultId,
        risk_summary: decision.riskNotes,
        savings_summary: decision.savingsSummary,
        production_recommendation_allowed: decision.productionRecommendationAllowed,
        production_blockers: decision.productionBlockers,
        registry_freshness: decision.registryFreshness,
        is_mock: true,
        generated_at: timestamp,
        created_at: timestamp,
        updated_at: timestamp
      };
      const generated = generateReportArtifacts({ report, evalRun, results, decision, generatedAt: timestamp });

      await c.var.repository.reports.create(report);
      await persistReportArtifacts(c.var.repository, generated.artifacts);

      return c.json(report, 201);
    })
    .get("/reports/:id", async (c) => {
      const reportDetail = await getReportDetail(c.var.repository, c.req.param("id"));
      if (!reportDetail) {
        return notFound(c, "Report not found");
      }

      return c.json(reportDetailResponseSchema.parse(reportDetail));
    })
    .get("/reports/:id/export", async (c) => {
      const report = await c.var.repository.reports.get(c.req.param("id"));
      if (!report) {
        return notFound(c, "Report not found");
      }

      const formatResult = reportArtifactFormatSchema.safeParse(c.req.query("format") ?? "json");
      if (!formatResult.success) {
        return validationProblem(c, formatResult.error);
      }

      const evalRun = await c.var.repository.eval_runs.get(report.eval_run_id);
      if (!evalRun) {
        return notFound(c, "Eval run not found");
      }

      const results = await getEvalResults(c.var.repository, evalRun.id);
      const testCases = await getContractTestCases(c.var.repository, evalRun.quality_contract_id);
      const decision = decideRecommendation({
        evalRunId: evalRun.id,
        results,
        passThreshold: evalRun.pass_threshold,
        testCaseCount: testCases.length
      });
      const generated = generateReportArtifacts({ report, evalRun, results, decision });
      await persistReportArtifacts(c.var.repository, generated.artifacts);

      const content = generated.contents.find((item) => item.format === formatResult.data);
      const artifact = generated.artifacts.find((item) => item.format === formatResult.data);

      if (!content || !artifact) {
        return notFound(c, "Report artifact not found");
      }

      return c.json(
        reportExportResponseSchema.parse({
          report,
          artifacts: generated.artifacts,
          export_package: {
            format: formatResult.data,
            download_url: artifact.storage_uri,
            redaction_state: artifact.redaction_state,
            filename: content.filename,
            content_type: content.content_type,
            content: content.content,
            redacted_share_package: generated.redacted_share_package,
            eval_snapshot: generated.eval_snapshot,
            todo: "Object storage download signing is not implemented yet; MVP returns generated content inline."
          }
        })
      );
    });
}

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

function generateCandidateForStrategy(
  strategy: CandidateStrategy,
  input: PromptCandidateGenerationInput & { id: string }
): GeneratedPromptCandidate {
  switch (strategy) {
    case "conservative":
      return generateConservativeCandidate(input);
    case "balanced":
      return generateBalancedCandidate(input);
    case "aggressive":
      return generateAggressiveCandidate(input);
    case "output_lite":
      return generateOutputLiteCandidate(input);
    case "model_specific":
      return generateModelSpecificCandidate(input);
    case "baseline":
      throw new Error("Baseline candidates are mapped without prompt-core generation.");
  }
}

function mapGeneratedCandidateToRecord(
  generated: GeneratedPromptCandidate,
  promptVersionId: string,
  analysisId: string | null,
  baselineInputTokens: number,
  timestamp: string
): OptimizationCandidate {
  return {
    id: generated.id,
    label: generated.label,
    prompt_version_id: promptVersionId,
    analysis_id: analysisId,
    strategy: generated.strategy,
    candidate_prompt_text: generated.promptText,
    estimated_input_tokens: generated.estimatedInputTokens,
    estimated_output_tokens: generated.estimatedOutputTokens,
    rationale: generated.rationale,
    risk_level: generated.riskLabel,
    expected_token_delta: calculateTokenDelta(generated.estimatedInputTokens, baselineInputTokens),
    preserved_constraints: generated.preservedConstraints,
    removed_or_compressed_elements: generated.removedOrCompressedElements,
    is_baseline: false,
    is_mock: true,
    created_at: timestamp
  };
}

function calculateTokenDelta(candidateInputTokens: number, baselineInputTokens: number): number {
  if (baselineInputTokens <= 0) {
    return 0;
  }

  return Math.round(((candidateInputTokens - baselineInputTokens) / baselineInputTokens) * 100);
}

function getCandidatePreservedConstraints(contract: QualityContract | undefined): string[] {
  if (!contract) {
    return ["Preserve baseline variables, required output shape, and user-provided constraints."];
  }

  return [
    ...contract.must_preserve,
    ...contract.forbidden_behavior.map((item) => `Forbidden behavior: ${item}`),
    ...contract.check_definitions
      .filter((check) => check.must_pass)
      .map((check) => `Must-pass check: ${check.description}`)
  ];
}

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

async function persistReportArtifacts(
  repository: PromptOptsRepository,
  artifacts: ReportArtifact[]
): Promise<void> {
  for (const artifact of artifacts) {
    const existing = await repository.report_artifacts.get(artifact.id);

    if (!existing) {
      await repository.report_artifacts.create(artifact);
    }
  }
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

async function createFreeAuditCapture(
  repository: PromptOptsRepository,
  input: {
    auditId: string;
    provider: FreeAudit["provider"];
    modelId: string;
    taskType: FreeAudit["task_type"];
    monthlyCalls: number;
    modelFit: FreeAudit["model_fit"];
    savingsOpportunityUsd: number | null;
    contactEmail: string | null;
    company: string | null;
    ctaClicked: FreeAudit["cta_clicked"];
    prompt: string;
    timestamp: string;
  }
): Promise<FreeAuditCapture> {
  const redactedPromptPreview = redactShareablePromptPreview(input.prompt);
  const shareableSummary = createShareableFreeAuditSummary({
    provider: input.provider,
    modelId: input.modelId,
    modelFit: input.modelFit,
    ctaClicked: input.ctaClicked
  });
  const leadDomain = inferLeadDomain(input.contactEmail, input.company);
  const account =
    leadDomain || input.contactEmail || input.company
      ? await upsertFreeAuditAccount(repository, {
          provider: input.provider,
          company: input.company,
          domain: leadDomain,
          redactedPromptPreview,
          timestamp: input.timestamp
        })
      : null;
  const contact =
    account && input.contactEmail
      ? await upsertFreeAuditContact(repository, {
          accountId: account.id,
          email: input.contactEmail,
          company: input.company,
          timestamp: input.timestamp
        })
      : null;
  const opportunity = account
    ? await upsertFreeAuditOpportunity(repository, {
        accountId: account.id,
        provider: input.provider,
        modelId: input.modelId,
        taskType: input.taskType,
        monthlyCalls: input.monthlyCalls,
        modelFit: input.modelFit,
        savingsOpportunityUsd: input.savingsOpportunityUsd,
        ctaClicked: input.ctaClicked,
        timestamp: input.timestamp
      })
    : null;
  const freeAudit: FreeAudit = {
    id: input.auditId,
    account_id: account?.id ?? null,
    project_id: null,
    provider: input.provider,
    current_model_id: input.modelId,
    task_type: input.taskType,
    monthly_calls: Math.round(input.monthlyCalls),
    model_fit: input.modelFit,
    savings_opportunity_usd: input.savingsOpportunityUsd,
    eval_readiness: input.ctaClicked === "run_evals" ? "eval_ready" : "needs_tests",
    contact_email: input.contactEmail,
    company: input.company,
    cta_clicked: input.ctaClicked,
    redacted_prompt_preview: redactedPromptPreview,
    shareable_summary: shareableSummary,
    is_mock: true,
    created_at: input.timestamp
  };

  await repository.free_audits.create(freeAudit);

  return {
    id: freeAudit.id,
    accountId: account?.id ?? null,
    contactId: contact?.id ?? null,
    opportunityId: opportunity?.id ?? null,
    ctaClicked: input.ctaClicked,
    redactedPromptPreview,
    shareableSummary
  };
}

async function upsertFreeAuditAccount(
  repository: PromptOptsRepository,
  input: {
    provider: Account["provider_preference"];
    company: string | null;
    domain: string | null;
    redactedPromptPreview: string;
    timestamp: string;
  }
): Promise<Account> {
  const accounts = await repository.accounts.list();
  const existing = accounts.find((account) => {
    if (input.domain && account.domain === input.domain) {
      return true;
    }

    return input.company ? account.name.toLowerCase() === input.company.toLowerCase() : false;
  });

  if (existing) {
    return (
      (await repository.accounts.update(existing.id, {
        provider_preference: input.provider,
        redacted_prompt_preview: input.redactedPromptPreview,
        updated_at: input.timestamp
      })) ?? existing
    );
  }

  const account: Account = {
    id: createId("account"),
    name: input.company ?? input.domain ?? "Free audit lead",
    workspace_id: null,
    stage: "free_audit",
    provider_preference: input.provider,
    owner_admin_user_id: null,
    domain: input.domain,
    redacted_prompt_preview: input.redactedPromptPreview,
    is_mock: true,
    created_at: input.timestamp,
    updated_at: input.timestamp
  };

  await repository.accounts.create(account);

  return account;
}

async function upsertFreeAuditContact(
  repository: PromptOptsRepository,
  input: {
    accountId: string;
    email: string;
    company: string | null;
    timestamp: string;
  }
): Promise<Contact> {
  const existing = (await repository.contacts.list()).find((contact) => contact.email === input.email);
  const name = input.email.split("@")[0]?.replace(/[._-]+/g, " ") || input.company || "Free audit contact";

  if (existing) {
    return (
      (await repository.contacts.update(existing.id, {
        account_id: input.accountId,
        updated_at: input.timestamp
      })) ?? existing
    );
  }

  const contact: Contact = {
    id: createId("contact"),
    account_id: input.accountId,
    name,
    email: input.email,
    role: null,
    is_mock: true,
    created_at: input.timestamp,
    updated_at: input.timestamp
  };

  await repository.contacts.create(contact);

  return contact;
}

async function upsertFreeAuditOpportunity(
  repository: PromptOptsRepository,
  input: {
    accountId: string;
    provider: Opportunity["provider"];
    modelId: string;
    taskType: NonNullable<Opportunity["use_case"]>;
    monthlyCalls: number;
    modelFit: NonNullable<Opportunity["fit_signal"]>;
    savingsOpportunityUsd: number | null;
    ctaClicked: NonNullable<Opportunity["cta_clicked"]>;
    timestamp: string;
  }
): Promise<Opportunity> {
  const opportunities = await repository.opportunities.list();
  const existing = opportunities.find(
    (opportunity) =>
      opportunity.account_id === input.accountId &&
      opportunity.provider === input.provider &&
      opportunity.current_model_id === input.modelId &&
      opportunity.use_case === input.taskType
  );
  const patch = {
    stage: stageForFreeAuditCta(input.ctaClicked),
    current_model: input.modelId,
    fit_signal: input.modelFit,
    estimated_monthly_calls: Math.round(input.monthlyCalls),
    estimated_volume: Math.round(input.monthlyCalls),
    savings_opportunity_usd: input.savingsOpportunityUsd,
    estimated_savings: input.savingsOpportunityUsd,
    use_case: input.taskType,
    cta_clicked: input.ctaClicked,
    eval_readiness: input.ctaClicked === "run_evals" ? "eval_ready" : "needs_tests",
    updated_at: input.timestamp
  } satisfies Partial<Omit<Opportunity, "id">>;

  if (existing) {
    return (await repository.opportunities.update(existing.id, patch)) ?? existing;
  }

  const opportunity: Opportunity = {
    id: createId("opportunity"),
    account_id: input.accountId,
    project_id: null,
    provider: input.provider,
    current_model_id: input.modelId,
    ...patch,
    is_mock: true,
    created_at: input.timestamp
  };

  await repository.opportunities.create(opportunity);

  return opportunity;
}

function stageForFreeAuditCta(ctaClicked: FreeAudit["cta_clicked"]): Opportunity["stage"] {
  switch (ctaClicked) {
    case "run_evals":
      return "eval_ready";
    case "create_project":
      return "evaluating";
    case "get_audit_report":
    case "preview":
      return "new";
  }
}

function inferLeadDomain(email: string | null, company: string | null): string | null {
  const emailDomain = email?.split("@")[1]?.toLowerCase();

  if (emailDomain) {
    return emailDomain;
  }

  const normalizedCompany = company?.trim().toLowerCase();

  if (normalizedCompany && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(normalizedCompany)) {
    return normalizedCompany;
  }

  return null;
}

function redactShareablePromptPreview(prompt: string): string {
  return `Prompt redacted (${prompt.replace(/\s+/g, " ").trim().length} chars)`;
}

function createShareableFreeAuditSummary(input: {
  provider: FreeAudit["provider"];
  modelId: string;
  modelFit: FreeAudit["model_fit"];
  ctaClicked: FreeAudit["cta_clicked"];
}): string {
  return [
    `Redacted free audit for ${input.provider}/${input.modelId}.`,
    `Model fit: ${input.modelFit}.`,
    "Savings opportunity is unverified until registry metadata and eval results pass.",
    "Run evals before switching."
  ].join(" ");
}

async function resolvePromptVersionId(
  repository: PromptOptsRepository,
  promptText: string,
  requestedPromptVersionId: string | undefined
): Promise<string | null> {
  if (requestedPromptVersionId) {
    const requested = await repository.prompt_versions.get(requestedPromptVersionId);

    return requested?.id ?? null;
  }

  const matchingVersion = (await repository.prompt_versions.list()).find(
    (version) => version.prompt_text === promptText
  );

  return matchingVersion?.id ?? null;
}
