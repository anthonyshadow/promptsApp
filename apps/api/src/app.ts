import { Hono, type Context, type MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import {
  createDemoRepositorySeed,
  createHealthResponse,
  createMemoryRepository,
  providerSchema,
  reportArtifactFormatSchema,
  type Account,
  type AdminActionContext,
  type AdminAuditLog,
  type AdminActionScope,
  type EvalRun,
  type ModelRegistryRecord,
  type OptimizationCandidate,
  type PromptOptsRepository,
  type PromptProject,
  type PromptVersion,
  type RecommendationReport,
  type UsageLedgerEntry,
  type Workspace
} from "@promptopts/shared";
import {
  accountCreateRequestSchema,
  accountPatchRequestSchema,
  adminAccountDetailResponseSchema,
  adminAccountsResponseSchema,
  adminEvalRunsResponseSchema,
  adminOverviewResponseSchema,
  adminReasonRequestSchema,
  adminReportsResponseSchema,
  adminUsersResponseSchema,
  auditLogsResponseSchema,
  auditRequestSchema,
  auditResponseSchema,
  billingCreditRequestSchema,
  billingCreditResponseSchema,
  billingResponseSchema,
  errorResponseSchema,
  evalRunActionResponseSchema,
  evalRunCreateRequestSchema,
  evalRunDetailResponseSchema,
  modelApproveRequestSchema,
  modelPatchRequestSchema,
  modelsResponseSchema,
  promptCreateRequestSchema,
  promptCreateResponseSchema,
  promptOptimizeRequestSchema,
  promptOptimizeResponseSchema,
  regenerateReportResponseSchema,
  reportCreateRequestSchema,
  reportDeleteRequestSchema,
  reportDeleteResponseSchema,
  reportExportResponseSchema,
  revokeSessionsResponseSchema,
  workspacePatchRequestSchema,
  workspaceSchema
} from "./contracts";

type ApiEnv = {
  Variables: {
    repository: PromptOptsRepository;
    adminActionContext: AdminActionContext;
  };
};

type AppDependencies = {
  repository?: PromptOptsRepository;
};

type ValidatedJson<TValue> =
  | {
      success: true;
      data: TValue;
    }
  | {
      success: false;
      response: Response;
    };

const MOCK_ADMIN_CONTEXT: AdminActionContext = {
  admin_user_id: "admin_user_mock",
  session_id: "admin_session_mock",
  workspace_id: null,
  account_id: null,
  action_scope: "read_metadata",
  reason_code: "mock_admin_middleware",
  sudo_request_id: null,
  ip_address: "127.0.0.1",
  user_agent: "PromptOpts API test harness",
  redaction_state: "redacted"
};

export function createApp(dependencies: AppDependencies = {}) {
  const repository = dependencies.repository ?? createMemoryRepository(createDemoRepositorySeed());
  const adminApi = createAdminApi();

  return new Hono<ApiEnv>()
    .use("*", cors())
    .use("*", injectRepository(repository))
    .get("/health", (c) => c.json(createHealthResponse("api")))
    .get("/models", async (c) => {
      const providerQuery = c.req.query("provider");
      const providerResult = providerQuery ? providerSchema.safeParse(providerQuery) : undefined;

      if (providerResult && !providerResult.success) {
        return validationProblem(c, providerResult.error);
      }

      const provider = providerResult?.data;
      const models = (await c.var.repository.model_registry.list()).filter((model) => {
        return provider ? model.provider === provider : true;
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
    })
    .route("/admin-api", adminApi);
}

function createAdminApi() {
  return new Hono<ApiEnv>()
    .use("*", requireSession)
    .use("*", requireMfa)
    .use("*", requireAdminRole)
    .use("*", requireActionScope)
    .use("*", requireSudoForDangerousAction)
    .use("*", writeAdminAuditEvent)
    .get("/overview", async (c) => {
      const [accounts, evalRuns, reports, models] = await Promise.all([
        c.var.repository.accounts.list(),
        c.var.repository.eval_runs.list(),
        c.var.repository.reports.list(),
        c.var.repository.model_registry.list()
      ]);

      return c.json(
        adminOverviewResponseSchema.parse({
          kpis: {
            accounts: accounts.length,
            eval_runs: evalRuns.length,
            reports: reports.length,
            unverified_models: models.filter((model) => model.freshness_status !== "fresh").length
          },
          live_risks: [
            "Admin auth is mocked for local skeleton only.",
            "Model registry records may be demo/unverified."
          ],
          system_health: {
            api: "ok",
            repository: "memory",
            admin_auth: "mocked"
          }
        })
      );
    })
    .get("/accounts", async (c) => {
      return c.json(
        adminAccountsResponseSchema.parse({
          accounts: await c.var.repository.accounts.list()
        })
      );
    })
    .post("/accounts", async (c) => {
      const body = await validateJson(c, accountCreateRequestSchema);
      if (!body.success) {
        return body.response;
      }

      const timestamp = nowIso();
      const account = {
        id: createId("account"),
        ...body.data,
        is_mock: true,
        created_at: timestamp,
        updated_at: timestamp
      };

      await c.var.repository.accounts.create(account);

      return c.json(account, 201);
    })
    .get("/accounts/:id", async (c) => {
      const account = await c.var.repository.accounts.get(c.req.param("id"));
      if (!account) {
        return notFound(c, "Account not found");
      }

      const [contacts, opportunities] = await Promise.all([
        c.var.repository.contacts.list(),
        c.var.repository.opportunities.list()
      ]);

      return c.json(
        adminAccountDetailResponseSchema.parse({
          account,
          contacts: contacts.filter((contact) => contact.account_id === account.id),
          opportunities: opportunities.filter((opportunity) => opportunity.account_id === account.id)
        })
      );
    })
    .patch("/accounts/:id", async (c) => {
      const body = await validateJson(c, accountPatchRequestSchema);
      if (!body.success) {
        return body.response;
      }

      const account = await c.var.repository.accounts.update(
        c.req.param("id"),
        stripUndefined({
          ...body.data,
          updated_at: nowIso()
        }) as Partial<Omit<Account, "id">>
      );

      if (!account) {
        return notFound(c, "Account not found");
      }

      return c.json(account);
    })
    .get("/users", async (c) => {
      return c.json(
        adminUsersResponseSchema.parse({
          users: await c.var.repository.users.list()
        })
      );
    })
    .post("/users/:id/revoke-sessions", async (c) => {
      const body = await validateJson(c, adminReasonRequestSchema);
      if (!body.success) {
        return body.response;
      }

      const user = await c.var.repository.users.get(c.req.param("id"));
      if (!user) {
        return notFound(c, "User not found");
      }

      return c.json(
        revokeSessionsResponseSchema.parse({
          user_id: user.id,
          revoked_sessions: 0,
          todo: `Session revocation is mocked. Reason: ${body.data.reason_code}`
        })
      );
    })
    .patch("/workspaces/:id", async (c) => {
      const body = await validateJson(c, workspacePatchRequestSchema);
      if (!body.success) {
        return body.response;
      }

      const workspace = await c.var.repository.workspaces.update(
        c.req.param("id"),
        stripUndefined({
          ...body.data,
          updated_at: nowIso()
        }) as Partial<Omit<Workspace, "id">>
      );

      if (!workspace) {
        return notFound(c, "Workspace not found");
      }

      return c.json(workspaceSchema.parse(workspace));
    })
    .get("/eval-runs", async (c) => {
      return c.json(
        adminEvalRunsResponseSchema.parse({
          eval_runs: await c.var.repository.eval_runs.list()
        })
      );
    })
    .get("/eval-runs/:id", async (c) => {
      const evalRun = await c.var.repository.eval_runs.get(c.req.param("id"));
      if (!evalRun) {
        return notFound(c, "Eval run not found");
      }

      return c.json(evalRunDetailResponseSchema.parse(await getEvalRunDetail(c.var.repository, evalRun)));
    })
    .post("/eval-runs/:id/retry", async (c) => {
      const body = await validateJson(c, adminReasonRequestSchema);
      if (!body.success) {
        return body.response;
      }

      return handleEvalRunStatusUpdate(c, "retrying", `Retry queueing is mocked. Reason: ${body.data.reason_code}`);
    })
    .post("/eval-runs/:id/cancel", async (c) => {
      const body = await validateJson(c, adminReasonRequestSchema);
      if (!body.success) {
        return body.response;
      }

      return handleEvalRunStatusUpdate(c, "failed", `Cancellation is mocked. Reason: ${body.data.reason_code}`);
    })
    .post("/eval-runs/:id/regenerate-report", async (c) => {
      const body = await validateJson(c, adminReasonRequestSchema);
      if (!body.success) {
        return body.response;
      }

      const evalRun = await c.var.repository.eval_runs.get(c.req.param("id"));
      if (!evalRun) {
        return notFound(c, "Eval run not found");
      }

      const timestamp = nowIso();
      const report: RecommendationReport = {
        id: createId("report"),
        project_id: evalRun.project_id,
        eval_run_id: evalRun.id,
        status: "blocked",
        winner_result_id: null,
        cheaper_alternative_result_id: null,
        stronger_fallback_result_id: null,
        risk_summary: ["Report regeneration is blocked until eval results pass decision rules."],
        savings_summary: null,
        production_recommendation_allowed: false,
        production_blockers: [`TODO: regenerate report through report-generator. Reason: ${body.data.reason_code}`],
        registry_freshness: "unverified",
        is_mock: true,
        generated_at: null,
        created_at: timestamp,
        updated_at: timestamp
      };

      await c.var.repository.reports.create(report);

      return c.json(
        regenerateReportResponseSchema.parse({
          report,
          todo: "Report regeneration is mocked until report-generator is implemented."
        })
      );
    })
    .get("/models", async (c) => {
      return c.json(
        modelsResponseSchema.parse({
          models: await c.var.repository.model_registry.list(),
          registry_note: "Admin model registry view is metadata-only and redacted by default."
        })
      );
    })
    .patch("/models/:id", async (c) => {
      const body = await validateJson(c, modelPatchRequestSchema);
      if (!body.success) {
        return body.response;
      }

      const model = await c.var.repository.model_registry.update(c.req.param("id"), {
        ...(body.data as Partial<Omit<ModelRegistryRecord, "id">>),
        updated_at: nowIso()
      });

      if (!model) {
        return notFound(c, "Model registry record not found");
      }

      return c.json(model);
    })
    .post("/models/:id/approve", async (c) => {
      const body = await validateJson(c, modelApproveRequestSchema);
      if (!body.success) {
        return body.response;
      }

      const model = await c.var.repository.model_registry.update(c.req.param("id"), {
        freshness_status: "fresh",
        source_url: body.data.source_url,
        last_verified_at: body.data.last_verified_at,
        verified_by: body.data.verified_by,
        updated_at: nowIso()
      });

      if (!model) {
        return notFound(c, "Model registry record not found");
      }

      return c.json(model);
    })
    .get("/reports", async (c) => {
      return c.json(
        adminReportsResponseSchema.parse({
          reports: await c.var.repository.reports.list()
        })
      );
    })
    .post("/reports/:id/delete", async (c) => {
      const body = await validateJson(c, reportDeleteRequestSchema);
      if (!body.success) {
        return body.response;
      }

      const report = await c.var.repository.reports.get(c.req.param("id"));
      if (!report) {
        return notFound(c, "Report not found");
      }

      return c.json(
        reportDeleteResponseSchema.parse({
          report_id: report.id,
          deletion_queued: true,
          todo: `Deletion lifecycle is mocked; object artifacts remain until storage is implemented. Reason: ${body.data.reason_code}`
        })
      );
    })
    .get("/billing", async (c) => {
      const [entitlements, usageLedger] = await Promise.all([
        c.var.repository.entitlements.list(),
        c.var.repository.usage_ledger.list()
      ]);

      return c.json(
        billingResponseSchema.parse({
          entitlements,
          usage_ledger: usageLedger
        })
      );
    })
    .post("/billing/:id/credit", async (c) => {
      const body = await validateJson(c, billingCreditRequestSchema);
      if (!body.success) {
        return body.response;
      }

      const workspace = await c.var.repository.workspaces.get(c.req.param("id"));
      if (!workspace) {
        return notFound(c, "Workspace not found");
      }

      const ledgerEntry: UsageLedgerEntry = {
        id: createId("usage_ledger"),
        workspace_id: workspace.id,
        feature: body.data.feature,
        quantity: body.data.quantity,
        unit: unitForFeature(body.data.feature),
        direction: "credit",
        source_type: "admin_credit",
        source_id: createId("admin_credit"),
        is_mock: true,
        created_at: nowIso()
      };

      await c.var.repository.usage_ledger.create(ledgerEntry);

      return c.json(
        billingCreditResponseSchema.parse({
          ledger_entry: ledgerEntry,
          todo: `Billing credits are mocked until billing events are implemented. Reason: ${body.data.reason_code}`
        })
      );
    })
    .get("/audit-logs", async (c) => {
      return c.json(
        auditLogsResponseSchema.parse({
          audit_logs: await c.var.repository.admin_audit_logs.list()
        })
      );
    });
}

const injectRepository =
  (repository: PromptOptsRepository): MiddlewareHandler<ApiEnv> =>
  async (c, next) => {
    c.set("repository", repository);
    await next();
  };

const requireSession: MiddlewareHandler<ApiEnv> = async (c, next) => {
  c.set("adminActionContext", MOCK_ADMIN_CONTEXT);
  await next();
};

const requireMfa: MiddlewareHandler<ApiEnv> = async (_c, next) => {
  await next();
};

const requireAdminRole: MiddlewareHandler<ApiEnv> = async (_c, next) => {
  await next();
};

const requireActionScope: MiddlewareHandler<ApiEnv> = async (c, next) => {
  c.set("adminActionContext", {
    ...c.var.adminActionContext,
    action_scope: scopeForAdminRequest(c.req.method, c.req.path)
  });
  await next();
};

const requireSudoForDangerousAction: MiddlewareHandler<ApiEnv> = async (c, next) => {
  if (isDangerousAdminAction(c.req.method, c.req.path)) {
    c.set("adminActionContext", {
      ...c.var.adminActionContext,
      sudo_request_id: "sudo_request_mock",
      redaction_state: "redacted"
    });
  }

  await next();
};

const writeAdminAuditEvent: MiddlewareHandler<ApiEnv> = async (c, next) => {
  await next();

  if (c.res.status >= 500) {
    return;
  }

  const adminContext = c.var.adminActionContext;
  const auditLog: AdminAuditLog = {
    id: createId("admin_audit_log"),
    admin_user_id: adminContext.admin_user_id,
    workspace_id: adminContext.workspace_id,
    account_id: adminContext.account_id,
    target_type: "admin_route",
    target_id: c.req.path,
    action: `${c.req.method.toLowerCase()} ${c.req.path}`,
    action_scope: adminContext.action_scope,
    reason_code: adminContext.reason_code,
    sudo_request_id: adminContext.sudo_request_id,
    ip_address: adminContext.ip_address,
    user_agent: adminContext.user_agent,
    redaction_state: "redacted",
    metadata: {
      status: c.res.status,
      mocked: true
    },
    is_mock: true,
    created_at: nowIso()
  };

  await c.var.repository.admin_audit_logs.append(auditLog);
};

async function validateJson<TSchema extends z.ZodTypeAny>(
  c: Context<ApiEnv>,
  schema: TSchema
): Promise<ValidatedJson<z.infer<TSchema>>> {
  const payload = await c.req.json().catch(() => undefined);
  const result = schema.safeParse(payload);

  if (!result.success) {
    return {
      success: false,
      response: validationProblem(c, result.error)
    };
  }

  return {
    success: true,
    data: result.data
  };
}

function validationProblem(c: Context<ApiEnv>, error: z.ZodError): Response {
  return c.json(
    errorResponseSchema.parse({
      error: {
        code: "validation_error",
        message: "Request validation failed",
        details: error.issues
      }
    }),
    400
  );
}

function notFound(c: Context<ApiEnv>, message: string): Response {
  return c.json(
    errorResponseSchema.parse({
      error: {
        code: "not_found",
        message
      }
    }),
    404
  );
}

async function getEvalRunDetail(repository: PromptOptsRepository, evalRun: EvalRun) {
  const results = (await repository.eval_results.list()).filter(
    (result) => result.eval_run_id === evalRun.id
  );

  return {
    eval_run: evalRun,
    results,
    todo: "Eval execution is mocked until eval-runner and provider adapters are implemented."
  };
}

async function handleEvalRunStatusUpdate(
  c: Context<ApiEnv>,
  status: EvalRun["status"],
  todo: string
): Promise<Response> {
  const evalRunId = c.req.param("id");
  if (!evalRunId) {
    return notFound(c, "Eval run not found");
  }

  const evalRun = await c.var.repository.eval_runs.update(evalRunId, {
    status,
    started_at: status === "retrying" ? nowIso() : null,
    completed_at: status === "failed" ? nowIso() : null
  });

  if (!evalRun) {
    return notFound(c, "Eval run not found");
  }

  return c.json(evalRunActionResponseSchema.parse({ eval_run: evalRun, todo }));
}

function scopeForAdminRequest(method: string, path: string): AdminActionScope {
  if (method === "GET") {
    return "read_metadata";
  }

  if (path.includes("/models")) {
    return "manage_model_registry";
  }

  if (path.includes("/eval-runs")) {
    return "retry_eval";
  }

  if (path.includes("/reports")) {
    return "delete_report";
  }

  if (path.includes("/billing")) {
    return "issue_billing_credit";
  }

  if (path.includes("/users")) {
    return "revoke_user";
  }

  return "manage_workspace";
}

function isDangerousAdminAction(method: string, path: string): boolean {
  return (
    method !== "GET" &&
    (path.includes("/reports") || path.includes("/billing") || path.includes("/models"))
  );
}

function unitForFeature(feature: UsageLedgerEntry["feature"]): UsageLedgerEntry["unit"] {
  switch (feature) {
    case "free_audits":
      return "audit";
    case "projects":
      return "project";
    case "eval_runs":
      return "eval_run";
    case "report_exports":
      return "report_export";
    case "admin_seats":
      return "seat";
  }
}

function stripUndefined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter((entry) => entry[1] !== undefined));
}

function estimateTokens(prompt: string): number {
  return Math.max(1, Math.ceil(prompt.trim().split(/\s+/).length * 1.4));
}

function redactedPreview(prompt: string): string {
  return prompt.replace(/\s+/g, " ").trim().slice(0, 140);
}

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export const app = createApp();
export type ApiApp = typeof app;

export default app;
