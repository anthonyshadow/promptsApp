import { Hono } from "hono";
import {
  createHealthResponse,
  providerSchema,
  reportArtifactFormatSchema,
  stabilityStatusSchema,
  taskTypeSchema,
  type EvalRun,
  type OptimizationCandidate,
  type PromptProject,
  type PromptVersion,
  type RecommendationReport
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
  reportCreateRequestSchema,
  reportExportResponseSchema
} from "./contracts";
import type { ApiEnv } from "./context";
import {
  createId,
  estimateTokens,
  getEvalRunDetail,
  notFound,
  nowIso,
  redactedPreview,
  validateJson,
  validationProblem
} from "./http";

export function createPublicApiRoutes() {
  return new Hono<ApiEnv>()
    .get("/health", (c) => c.json(createHealthResponse("api")))
    .get("/models", async (c) => {
      const providerQuery = c.req.query("provider");
      const providerResult = providerQuery ? providerSchema.safeParse(providerQuery) : undefined;
      const taskTypeQuery = c.req.query("task_type") ?? c.req.query("task");
      const taskTypeResult = taskTypeQuery ? taskTypeSchema.safeParse(taskTypeQuery) : undefined;
      const stabilityQuery = c.req.query("stability") ?? c.req.query("stability_status");
      const stabilityValues = stabilityQuery ? stabilityQuery.split(",").filter(Boolean) : [];
      const stabilityResults = stabilityValues.map((value) => stabilityStatusSchema.safeParse(value));

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

      const provider = providerResult?.data;
      const taskType = taskTypeResult?.data;
      const stabilityStatuses = stabilityValues.map((value) => stabilityStatusSchema.parse(value));
      const models = (await c.var.repository.model_registry.list()).filter((model) => {
        const providerMatches = provider ? model.provider === provider : true;
        const taskMatches = taskType ? model.recommended_task_types.includes(taskType) : true;
        const stabilityMatches =
          stabilityStatuses.length > 0 ? stabilityStatuses.includes(model.stability_status) : true;

        return providerMatches && taskMatches && stabilityMatches;
      });

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

      const suggestedModels = (await c.var.repository.model_registry.list())
        .filter((model) => model.provider === body.data.provider)
        .map((model) => model.model_id);

      const response = auditResponseSchema.parse({
        id: createId("audit"),
        inputTokens: estimateTokens(body.data.prompt),
        estimatedOutputTokens: Math.max(64, Math.ceil(estimateTokens(body.data.prompt) * 0.8)),
        modelFit: "appropriate",
        wasteFindings: ["TODO: run prompt audit heuristics before provider calls."],
        riskLevel: "medium",
        compressionGuardrails: ["Preserve task semantics and output contract before claiming savings."],
        suggestedModels,
        registryFreshness: suggestedModels.length > 0 ? "unverified" : "stale",
        createdAt: nowIso()
      });

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

      const timestamp = nowIso();
      const candidates: OptimizationCandidate[] = [];

      for (const strategy of body.data.strategies) {
        const candidate: OptimizationCandidate = {
          id: createId("candidate"),
          prompt_version_id: version.id,
          analysis_id: body.data.analysis_id,
          strategy,
          candidate_prompt_text:
            strategy === "baseline"
              ? version.prompt_text
              : `TODO mock ${strategy} candidate. Preserve the quality contract before optimizing: ${version.prompt_text}`,
          rationale: "TODO: generate candidates with prompt-core once optimization logic is built.",
          risk_level: strategy === "aggressive" ? "high" : "medium",
          expected_token_delta: strategy === "baseline" ? 0 : -25,
          is_baseline: strategy === "baseline",
          is_mock: true,
          created_at: timestamp
        };
        await c.var.repository.optimization_candidates.create(candidate);
        candidates.push(candidate);
      }

      return c.json(
        promptOptimizeResponseSchema.parse({
          candidates,
          todo: "Candidate generation is mocked; prompt-core will implement real transformations later."
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

      return c.json(evalRun, 201);
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
      const report: RecommendationReport = {
        id: createId("report"),
        project_id: body.data.project_id,
        eval_run_id: body.data.eval_run_id,
        status: "blocked",
        winner_result_id: null,
        cheaper_alternative_result_id: null,
        stronger_fallback_result_id: null,
        risk_summary: ["No production recommendation until eval threshold passes with zero must-pass failures."],
        savings_summary: null,
        production_recommendation_allowed: false,
        production_blockers: [
          "TODO: eval-core must score the matrix before report generation.",
          "TODO: model registry rows must be verified before exact savings claims."
        ],
        registry_freshness: "unverified",
        is_mock: true,
        generated_at: null,
        created_at: timestamp,
        updated_at: timestamp
      };

      await c.var.repository.reports.create(report);

      return c.json(report, 201);
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

      const artifacts = (await c.var.repository.report_artifacts.list()).filter(
        (artifact) => artifact.report_id === report.id
      );
      const artifact = artifacts.find((item) => item.format === formatResult.data) ?? artifacts[0];

      if (!artifact) {
        return notFound(c, "Report artifact not found");
      }

      return c.json(
        reportExportResponseSchema.parse({
          report,
          artifacts,
          export_package: {
            format: formatResult.data,
            download_url: artifact.storage_uri,
            redaction_state: artifact.redaction_state,
            todo: "Object storage download signing is not implemented yet."
          }
        })
      );
    });
}
