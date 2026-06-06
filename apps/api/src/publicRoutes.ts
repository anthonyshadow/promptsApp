import { Hono, type Context } from "hono";
import { autoDraftQualityContract, costQualityFrontier, decideRecommendation } from "@promptopts/eval-core";
import { runEvalRun } from "@promptopts/eval-runner";
import { generateReportArtifacts, persistGeneratedReportArtifacts } from "@promptopts/report-generator";
import {
  generateAggressiveCandidate,
  generateBalancedCandidate,
  generateConservativeCandidate,
  generateModelSpecificCandidate,
  generateOutputLiteCandidate,
  detectSensitiveContent,
  parsePrompt,
  runPromptModelAudit,
  type GeneratedPromptCandidate,
  type PromptCandidateGenerationInput
} from "@promptopts/prompt-core";
import {
  type CandidateStrategy,
  createHealthResponse,
  reportArtifactFormatSchema,
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
  type PromptProject,
  type PromptVersion,
  type ProviderConnection,
  type PromptOptsRepository,
  type QualityContract,
  type RecommendationReport,
  type SensitiveFinding,
  type TestCase,
  type UsageLedgerEntry
} from "@promptopts/shared";
import {
  encryptSecret,
  fingerprintSecret,
  writeProviderKeyAuditEvent
} from "@promptopts/shared/security";
import {
  auditRequestSchema,
  auditResponseSchema,
  errorResponseSchema,
  evalRunCreateRequestSchema,
  type EvalRunCreateRequest,
  evalRunDetailResponseSchema,
  modelsResponseSchema,
  promptCreateRequestSchema,
  promptCreateResponseSchema,
  promptOptimizeRequestSchema,
  promptOptimizeResponseSchema,
  providerConnectionCreateRequestSchema,
  providerConnectionMutationResponseSchema,
  providerConnectionRevokeRequestSchema,
  providerConnectionRotateRequestSchema,
  providerConnectionsResponseSchema,
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
  unitForFeature,
  validateJson,
  validationProblem
} from "./http";
import {
  checkWorkspaceEntitlement,
  createDraftQualityContract,
  createFallbackPromptAnalysis,
  createFreeAuditCapture,
  entitlementForbidden,
  generateCandidateForStrategy,
  getCandidatePreservedConstraints,
  getContractTestCases,
  getEvalResults,
  getLatestPromptAnalysis,
  getPersistedQualityContract,
  getProductionRecommendationState,
  getQualityContractState,
  getReportDetail,
  getWorkspaceDashboard,
  mapGeneratedCandidateToRecord,
  publicError,
  readPublicRequestMetadata,
  resolvePromptVersionId,
  toProviderConnectionMetadata,
  tryPrepareProviderKey,
  writeUsageLedger
} from "./public/helpers";
import { createPublicModelRoutes } from "./public/modelRoutes";

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
    .route("/", createPublicModelRoutes())
    .get("/provider-connections", async (c) => {
      const workspaceId = c.req.query("workspace_id");
      if (!workspaceId) {
        return publicError(c, 400, "validation_error", "workspace_id query parameter is required");
      }

      const connections = (await c.var.repository.provider_connections.list())
        .filter((connection) => connection.workspace_id === workspaceId)
        .map(toProviderConnectionMetadata);

      return c.json(
        providerConnectionsResponseSchema.parse({
          connections,
          redaction_note:
            "Provider keys are encrypted and never viewable after save; only metadata is returned."
        })
      );
    })
    .post("/provider-connections", async (c) => {
      const body = await validateJson(c, providerConnectionCreateRequestSchema);
      if (!body.success) {
        return body.response;
      }

      const workspace = await c.var.repository.workspaces.get(body.data.workspace_id);
      if (!workspace) {
        return notFound(c, "Workspace not found");
      }

      const existingActive = (await c.var.repository.provider_connections.list()).find(
        (connection) =>
          connection.workspace_id === body.data.workspace_id &&
          connection.provider === body.data.provider &&
          connection.status === "active" &&
          !connection.revoked_at
      );
      if (existingActive) {
        return publicError(
          c,
          409,
          "provider_connection_exists",
          "An active provider connection already exists; rotate it instead."
        );
      }

      const timestamp = nowIso();
      const encrypted = tryPrepareProviderKey(body.data.api_key);
      if (!encrypted) {
        return publicError(
          c,
          500,
          "provider_key_encryption_unavailable",
          "Provider-key encryption is not configured."
        );
      }
      const connection: ProviderConnection = {
        id: createId("provider_connection"),
        workspace_id: body.data.workspace_id,
        provider: body.data.provider,
        encrypted_key_blob: encrypted.encrypted_key_blob,
        encryption_key_id: encrypted.encryption_key_id,
        key_fingerprint: encrypted.key_fingerprint,
        status: "active",
        created_by: body.data.created_by ?? null,
        rotated_at: null,
        revoked_at: null,
        last_used_at: null,
        metadata: {
          storage: "encrypted_non_viewable",
          reveal_route: false
        },
        is_mock: false,
        created_at: timestamp,
        updated_at: timestamp
      };

      const created = await c.var.repository.provider_connections.create(connection);
      await writeProviderKeyAuditEvent(c.var.repository, {
        connection: created,
        action: "provider_key_created",
        actorId: body.data.created_by ?? "public_provider_key_actor",
        reasonCode: "provider_key_created",
        ...readPublicRequestMetadata(c)
      });

      return c.json(
        providerConnectionMutationResponseSchema.parse({
          connection: toProviderConnectionMetadata(created),
          redaction_note:
            "Provider key stored as encrypted ciphertext; plaintext is not returned or viewable."
        }),
        201
      );
    })
    .post("/provider-connections/:id/rotate", async (c) => {
      const body = await validateJson(c, providerConnectionRotateRequestSchema);
      if (!body.success) {
        return body.response;
      }

      const current = await c.var.repository.provider_connections.get(c.req.param("id"));
      if (!current) {
        return notFound(c, "Provider connection not found");
      }
      if (current.status === "revoked" || current.revoked_at) {
        return publicError(c, 400, "provider_connection_revoked", "Revoked connections cannot be rotated");
      }

      const timestamp = nowIso();
      const encrypted = tryPrepareProviderKey(body.data.api_key);
      if (!encrypted) {
        return publicError(
          c,
          500,
          "provider_key_encryption_unavailable",
          "Provider-key encryption is not configured."
        );
      }
      const rotated = await c.var.repository.provider_connections.update(current.id, {
        encrypted_key_blob: encrypted.encrypted_key_blob,
        encryption_key_id: encrypted.encryption_key_id,
        key_fingerprint: encrypted.key_fingerprint,
        status: "active",
        rotated_at: timestamp,
        updated_at: timestamp
      });

      if (!rotated) {
        return notFound(c, "Provider connection not found");
      }

      await writeProviderKeyAuditEvent(c.var.repository, {
        connection: rotated,
        action: "provider_key_rotated",
        actorId: body.data.rotated_by ?? rotated.created_by ?? "public_provider_key_actor",
        reasonCode: body.data.reason_code,
        ...readPublicRequestMetadata(c)
      });

      return c.json(
        providerConnectionMutationResponseSchema.parse({
          connection: toProviderConnectionMetadata(rotated),
          redaction_note:
            "Provider key rotated; only fingerprint and lifecycle metadata are returned."
        })
      );
    })
    .post("/provider-connections/:id/revoke", async (c) => {
      const body = await validateJson(c, providerConnectionRevokeRequestSchema);
      if (!body.success) {
        return body.response;
      }

      const current = await c.var.repository.provider_connections.get(c.req.param("id"));
      if (!current) {
        return notFound(c, "Provider connection not found");
      }

      const timestamp = nowIso();
      const revoked = await c.var.repository.provider_connections.update(current.id, {
        status: "revoked",
        revoked_at: current.revoked_at ?? timestamp,
        updated_at: timestamp
      });

      if (!revoked) {
        return notFound(c, "Provider connection not found");
      }

      await writeProviderKeyAuditEvent(c.var.repository, {
        connection: revoked,
        action: "provider_key_revoked",
        actorId: body.data.revoked_by ?? revoked.created_by ?? "public_provider_key_actor",
        reasonCode: body.data.reason_code,
        ...readPublicRequestMetadata(c)
      });

      return c.json(
        providerConnectionMutationResponseSchema.parse({
          connection: toProviderConnectionMetadata(revoked),
          redaction_note:
            "Provider connection revoked; plaintext key remains non-viewable and is not returned."
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

      const privacyDecision = await evaluateProviderCallPrivacy(
        c.var.repository,
        body.data,
        project.workspace_id
      );
      if (!privacyDecision.allowed) {
        return c.json(
          errorResponseSchema.parse({
            error: {
              code: privacyDecision.code,
              message: privacyDecision.message,
              details: {
                data_use_policy: privacyDecision.dataUsePolicy,
                provider_call_sensitive_data_policy: privacyDecision.providerCallSensitiveDataPolicy,
                findings: privacyDecision.findings
              }
            }
          }),
          403
        );
      }

      const entitlement = await checkWorkspaceEntitlement(
        c.var.repository,
        project.workspace_id,
        "hosted_eval_runs"
      );
      if (!entitlement.allowed) {
        return entitlementForbidden(c, entitlement.message);
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
      await writeUsageLedger(c.var.repository, {
        workspaceId: project.workspace_id,
        feature: "hosted_eval_runs",
        quantity: 1,
        sourceType: "eval_run",
        sourceId: evalRun.id,
        timestamp
      });
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
      const project = await c.var.repository.projects.get(report.project_id);
      if (!project) {
        return notFound(c, "Project not found");
      }
      await persistGeneratedReportArtifacts({
        repository: c.var.repository,
        storage: c.var.reportArtifactStorage,
        report,
        project,
        generated,
        createdAt: timestamp
      });

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

      const project = await c.var.repository.projects.get(report.project_id);
      if (!project) {
        return notFound(c, "Project not found");
      }

      const exportEntitlement = await checkWorkspaceEntitlement(
        c.var.repository,
        project.workspace_id,
        "report_exports"
      );
      if (!exportEntitlement.allowed) {
        return entitlementForbidden(c, exportEntitlement.message);
      }

      if (formatResult.data === "pdf") {
        const pdfEntitlement = await checkWorkspaceEntitlement(
          c.var.repository,
          project.workspace_id,
          "pdf_export"
        );
        if (!pdfEntitlement.allowed) {
          return entitlementForbidden(c, pdfEntitlement.message);
        }
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
      const artifacts = await persistGeneratedReportArtifacts({
        repository: c.var.repository,
        storage: c.var.reportArtifactStorage,
        report,
        project,
        generated
      });

      const content = generated.contents.find((item) => item.format === formatResult.data);
      const artifact = artifacts.find((item) => item.format === formatResult.data);

      if (!content || !artifact) {
        return notFound(c, "Report artifact not found");
      }

      await writeUsageLedger(c.var.repository, {
        workspaceId: project.workspace_id,
        feature: formatResult.data === "pdf" ? "pdf_export" : "report_exports",
        quantity: 1,
        sourceType: "report_export",
        sourceId: artifact.id,
        timestamp: nowIso()
      });

      return c.json(
        reportExportResponseSchema.parse({
          report,
          artifacts,
          export_package: {
            format: formatResult.data,
            download_url: artifact.storage_uri,
            redaction_state: artifact.redaction_state,
            filename: content.filename,
            content_type: content.content_type,
            content: content.content,
            redacted_share_package: generated.redacted_share_package,
            eval_snapshot: generated.eval_snapshot,
            todo: "Object storage signing is not implemented yet; MVP returns redacted generated content inline while storing artifact metadata."
          }
        })
      );
    });
}

async function evaluateProviderCallPrivacy(
  repository: PromptOptsRepository,
  request: EvalRunCreateRequest,
  workspaceId: string
): Promise<
  | {
      allowed: true;
    }
  | {
      allowed: false;
      code: "provider_call_blocked_sensitive_content" | "provider_call_confirmation_required";
      message: string;
      dataUsePolicy: string;
      providerCallSensitiveDataPolicy: string;
      findings: SensitiveFinding[];
    }
> {
  const workspace = await repository.workspaces.get(workspaceId);
  const dataUsePolicy = workspace?.data_use_policy ?? "no_training";
  const providerCallSensitiveDataPolicy =
    workspace?.provider_call_sensitive_data_policy ?? "require_confirmation";
  const findings = dedupeSensitiveFindings(
    (await collectProviderCallTexts(repository, request)).flatMap((text) =>
      detectSensitiveContent(text)
    )
  );

  if (findings.length === 0) {
    return { allowed: true };
  }

  const containsHardSecret = findings.some(
    (finding) =>
      ["api_key", "credential", "common_secret"].includes(finding.type) &&
      ["high", "critical"].includes(finding.severity)
  );

  if (providerCallSensitiveDataPolicy === "block" || containsHardSecret) {
    return {
      allowed: false,
      code: "provider_call_blocked_sensitive_content",
      message:
        "Provider call blocked because prompt, candidate, or test-case content contains secrets or a workspace block policy applies.",
      dataUsePolicy,
      providerCallSensitiveDataPolicy,
      findings
    };
  }

  if (!request.provider_call_acknowledged) {
    return {
      allowed: false,
      code: "provider_call_confirmation_required",
      message:
        "Provider call requires acknowledgement because prompt, candidate, or test-case content contains PII or proprietary policy signals.",
      dataUsePolicy,
      providerCallSensitiveDataPolicy,
      findings
    };
  }

  return { allowed: true };
}

async function collectProviderCallTexts(
  repository: PromptOptsRepository,
  request: EvalRunCreateRequest
): Promise<string[]> {
  const [baselineVersion, candidates, testCases] = await Promise.all([
    repository.prompt_versions.get(request.baseline_prompt_version_id),
    repository.optimization_candidates.list(),
    repository.test_cases.list()
  ]);
  const selectedCandidateIds = new Set(request.candidate_ids);
  const selectedTestCaseIds = new Set(request.test_case_ids ?? []);
  const contractTestCases = testCases.filter((testCase) =>
    selectedTestCaseIds.size > 0
      ? selectedTestCaseIds.has(testCase.id)
      : testCase.quality_contract_id === request.quality_contract_id
  );
  const selectedCandidates = candidates.filter((candidate) =>
    selectedCandidateIds.has(candidate.id)
  );

  return [
    baselineVersion?.prompt_text ?? "",
    ...selectedCandidates.map((candidate) => candidate.candidate_prompt_text),
    ...contractTestCases.flatMap((testCase) => [
      JSON.stringify(testCase.input_variables),
      JSON.stringify(testCase.expected_output)
    ])
  ].filter((text) => text.trim().length > 0);
}

function dedupeSensitiveFindings(findings: SensitiveFinding[]): SensitiveFinding[] {
  const seen = new Set<string>();
  const deduped: SensitiveFinding[] = [];

  for (const finding of findings) {
    const key = `${finding.type}:${finding.reasonCode}:${finding.redactedPreview}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(finding);
    }
  }

  return deduped;
}
