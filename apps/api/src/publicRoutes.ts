import { Hono } from "hono";
import { runPromptModelAudit } from "@promptopts/prompt-core";
import {
  createHealthResponse,
  providerSchema,
  reportArtifactFormatSchema,
  stabilityStatusSchema,
  taskTypeSchema,
  type Account,
  type Contact,
  type EvalRun,
  type FreeAudit,
  type FreeAuditCapture,
  type OptimizationCandidate,
  type Opportunity,
  type PromptAnalysis,
  type PromptProject,
  type PromptVersion,
  type PromptOptsRepository,
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
