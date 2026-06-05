import { Hono } from "hono";
import {
  redactProviderError,
  redactPromptPreview,
  requireActionScope,
  requireAdminRole,
  requireMfa,
  requireSession,
  requireSudo,
  writeAdminAuditEvent
} from "@promptopts/admin-core";
import type {
  Account,
  AdminAuditLog,
  Contact,
  CrmNote,
  CrmTask,
  EvalResult,
  EvalRun,
  FreeAudit,
  ModelRegistryRecord,
  ModelRegistryVersion,
  Opportunity,
  Prompt,
  PromptAnalysis,
  PromptProject,
  RecommendationReport,
  ReportArtifact,
  UsageLedgerEntry,
  Workspace
} from "@promptopts/shared";
import {
  accountCreateRequestSchema,
  accountNoteCreateRequestSchema,
  accountNoteCreateResponseSchema,
  accountPatchRequestSchema,
  accountTaskCreateRequestSchema,
  accountTaskCreateResponseSchema,
  adminAccountDetailResponseSchema,
  adminAccountsResponseSchema,
  adminEvalRunDetailResponseSchema,
  type AdminAccountDetailResponse,
  type AdminAccountsResponse,
  adminEvalRunsResponseSchema,
  adminModelRegistryResponseSchema,
  adminOverviewResponseSchema,
  type AdminOverviewResponse,
  adminReasonRequestSchema,
  adminReportsResponseSchema,
  adminUsersResponseSchema,
  auditLogsResponseSchema,
  billingCreditRequestSchema,
  billingCreditResponseSchema,
  billingResponseSchema,
  breakGlassResponseSchema,
  impersonationResponseSchema,
  modelApproveRequestSchema,
  modelApproveResponseSchema,
  modelPatchRequestSchema,
  modelPatchResponseSchema,
  promptRevealResponseSchema,
  regenerateReportResponseSchema,
  reportDeleteRequestSchema,
  reportDeleteResponseSchema,
  revokeSessionsResponseSchema,
  workspacePatchRequestSchema,
  workspaceSchema
} from "./contracts";
import type { ApiEnv } from "./context";
import {
  createId,
  getEvalRunDetail,
  handleEvalRunStatusUpdate,
  notFound,
  nowIso,
  stripUndefined,
  unitForFeature,
  validateJson
} from "./http";

const ACCOUNT_PIPELINE_STAGES = [
  "new_audit",
  "qualified",
  "eval_ready",
  "trial",
  "paid",
  "needs_review"
] as const;

export function createAdminApiRoutes() {
  return (
    new Hono<ApiEnv>()
      // Security-critical order: session -> MFA -> role -> action scope -> sudo -> audit.
      .use("*", requireSession)
      .use("*", requireMfa)
      .use("*", requireAdminRole)
      .use("*", requireActionScope)
      .use("*", requireSudo())
      .use("*", writeAdminAuditEvent())
      .get("/overview", async (c) => {
        const [
          accounts,
          freeAudits,
          opportunities,
          evalRuns,
          reports,
          reportArtifacts,
          models,
          usageLedger,
          promptAnalyses,
          auditLogs
        ] = await Promise.all([
          c.var.repository.accounts.list(),
          c.var.repository.free_audits.list(),
          c.var.repository.opportunities.list(),
          c.var.repository.eval_runs.list(),
          c.var.repository.reports.list(),
          c.var.repository.report_artifacts.list(),
          c.var.repository.model_registry.list(),
          c.var.repository.usage_ledger.list(),
          c.var.repository.prompt_analyses.list(),
          c.var.repository.admin_audit_logs.list()
        ]);
        const unverifiedModelCount = models.filter((model) => model.freshness_status !== "fresh").length;
        const convertedAccounts = new Set(
          opportunities
            .filter((opportunity) =>
              ["eval_ready", "recommended", "won"].includes(opportunity.stage)
            )
            .map((opportunity) => opportunity.account_id)
        ).size;
        const freeAuditConversionRate =
          freeAudits.length > 0 ? convertedAccounts / freeAudits.length : null;
        const failedExports = countFailedReportExports(reports, reportArtifacts);
        const secretScanWarnings = promptAnalyses.filter((analysis) =>
          analysis.risk_level === "high" || analysis.risk_level === "critical"
        ).length;

        return c.json(
          adminOverviewResponseSchema.parse({
            kpis: {
              mrr_usd: null,
              trials: accounts.filter((account) => account.stage === "trial").length,
              failed_payments: 0,
              free_audits: freeAudits.length,
              free_audit_conversion_rate: freeAuditConversionRate,
              converted_accounts: convertedAccounts,
              eval_jobs: countEvalJobs(evalRuns),
              provider_spend_usd: null,
              usage_ledger_events: usageLedger.length,
              reports: reports.length,
              unverified_models: unverifiedModelCount
            },
            health: {
              api: "ok",
              eval_worker: "mocked",
              report_worker: "mocked",
              queue: "mocked",
              storage: "mocked",
              repository: "memory",
              admin_auth: "mocked"
            },
            risk_queue: [
              {
                id: "risk_stale_model_prices",
                label: "Stale model prices",
                severity: unverifiedModelCount > 0 ? "high" : "low",
                count: unverifiedModelCount,
                link: "/__admin/model-registry",
                redacted_summary:
                  unverifiedModelCount > 0
                    ? "Model registry rows need source URL and verification before exact savings claims."
                    : "Model registry pricing metadata is currently fresh."
              },
              {
                id: "risk_failed_report_exports",
                label: "Failed report exports",
                severity: failedExports > 0 ? "medium" : "low",
                count: failedExports,
                link: "/__admin/reports",
                redacted_summary:
                  failedExports > 0
                    ? "Some report artifacts need storage/checksum confirmation."
                    : "No failed report export artifacts are visible in memory storage."
              },
              {
                id: "risk_secret_scan_warnings",
                label: "Secret-scan warnings",
                severity: secretScanWarnings > 0 ? "critical" : "low",
                count: secretScanWarnings,
                link: "/__admin/eval-jobs",
                redacted_summary:
                  secretScanWarnings > 0
                    ? "High-risk prompt analyses exist; overview shows counts only."
                    : "No high-risk prompt analysis warnings are visible in metadata."
              },
              {
                id: "risk_deletion_requests",
                label: "Deletion requests",
                severity: "low",
                count: 0,
                link: "/__admin/reports",
                redacted_summary: "Deletion request tracking is placeholder-only until durable lifecycle jobs are wired."
              }
            ],
            live_activity: createLiveActivityFeed({
              auditLogs,
              evalRuns,
              reports,
              freeAuditCount: freeAudits.length
            }),
            notes: [
              "Overview is redacted metadata only; raw prompts, provider keys, and raw reports are not returned.",
              "Revenue, provider spend, queue, worker, and storage health are placeholders until durable services are wired."
            ]
          })
        );
      })
      .post("/break-glass", async (c) => {
        const body = await validateJson(c, adminReasonRequestSchema);
        if (!body.success) {
          return body.response;
        }

        return c.json(
          breakGlassResponseSchema.parse({
            break_glass_started: false,
            todo: `Break-glass is a placeholder only. Reason captured: ${body.data.reason_code}`
          })
        );
      })
      .get("/accounts", async (c) => {
        const [accounts, opportunities, freeAudits, notes, tasks] = await Promise.all([
          c.var.repository.accounts.list(),
          c.var.repository.opportunities.list(),
          c.var.repository.free_audits.list(),
          c.var.repository.crm_notes.list(),
          c.var.repository.tasks.list()
        ]);

        return c.json(
          adminAccountsResponseSchema.parse({
            stages: ACCOUNT_PIPELINE_STAGES,
            accounts: createAccountPipelineRows({
              accounts,
              opportunities,
              freeAudits,
              notes,
              tasks
            })
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
          provider_preference: body.data.provider_preference ?? null,
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
          adminAccountDetailResponseSchema.parse(
            await createAccountDetail(c.var.repository, account, c.var.adminSession.role, {
              contacts,
              opportunities
            })
          )
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
      .post("/accounts/:id/notes", async (c) => {
        const body = await validateJson(c, accountNoteCreateRequestSchema);
        if (!body.success) {
          return body.response;
        }

        const account = await c.var.repository.accounts.get(c.req.param("id"));
        if (!account) {
          return notFound(c, "Account not found");
        }

        const timestamp = nowIso();
        const note: CrmNote = {
          id: createId("crm_note"),
          account_id: account.id,
          opportunity_id: body.data.opportunity_id ?? null,
          author_admin_user_id: c.var.adminSession.admin_user_id,
          body_redacted: redactCrmNoteBody(body.data.body),
          redaction_state: "redacted",
          metadata: {
            source: "admin_account_360",
            raw_length: body.data.body.length
          },
          is_mock: true,
          created_at: timestamp
        };

        await c.var.repository.crm_notes.create(note);

        return c.json(accountNoteCreateResponseSchema.parse({ note }), 201);
      })
      .post("/accounts/:id/tasks", async (c) => {
        const body = await validateJson(c, accountTaskCreateRequestSchema);
        if (!body.success) {
          return body.response;
        }

        const account = await c.var.repository.accounts.get(c.req.param("id"));
        if (!account) {
          return notFound(c, "Account not found");
        }

        const timestamp = nowIso();
        const task: CrmTask = {
          id: createId("task"),
          account_id: account.id,
          opportunity_id: body.data.opportunity_id ?? null,
          assignee_admin_user_id: body.data.assignee_admin_user_id ?? c.var.adminSession.admin_user_id,
          title: body.data.title,
          status: "open",
          due_at: body.data.due_at ?? null,
          metadata: {
            source: "admin_account_360"
          },
          is_mock: true,
          created_at: timestamp,
          updated_at: timestamp
        };

        await c.var.repository.tasks.create(task);

        return c.json(accountTaskCreateResponseSchema.parse({ task }), 201);
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
      .post("/users/:id/impersonate", async (c) => {
        const body = await validateJson(c, adminReasonRequestSchema);
        if (!body.success) {
          return body.response;
        }

        const user = await c.var.repository.users.get(c.req.param("id"));
        if (!user) {
          return notFound(c, "User not found");
        }

        return c.json(
          impersonationResponseSchema.parse({
            user_id: user.id,
            impersonation_started: false,
            todo: `User impersonation is a placeholder only. Reason captured: ${body.data.reason_code}`
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
        const [evalRuns, projects, workspaces, models, results] = await Promise.all([
          c.var.repository.eval_runs.list(),
          c.var.repository.projects.list(),
          c.var.repository.workspaces.list(),
          c.var.repository.model_registry.list(),
          c.var.repository.eval_results.list()
        ]);

        return c.json(
          adminEvalRunsResponseSchema.parse(
            createAdminEvalRunsResponse({
              evalRuns,
              projects,
              workspaces,
              models,
              results
            })
          )
        );
      })
      .get("/eval-runs/:id", async (c) => {
        const evalRun = await c.var.repository.eval_runs.get(c.req.param("id"));
        if (!evalRun) {
          return notFound(c, "Eval run not found");
        }

        return c.json(
          adminEvalRunDetailResponseSchema.parse(await createAdminEvalRunDetail(c.var.repository, evalRun))
        );
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
            todo: "Admin report regeneration is mocked until this route calls the report-generator worker."
          })
        );
      })
      .get("/prompts/:id/reveal", async (c) => {
        const prompt = await c.var.repository.prompts.get(c.req.param("id"));
        if (!prompt || !prompt.current_version_id) {
          return notFound(c, "Prompt not found");
        }

        const version = await c.var.repository.prompt_versions.get(prompt.current_version_id);
        if (!version) {
          return notFound(c, "Prompt version not found");
        }

        return c.json(
          promptRevealResponseSchema.parse({
            prompt_id: prompt.id,
            redacted_preview: redactPromptPreview(version.prompt_text),
            raw_prompt: null,
            todo: "Raw prompt reveal is gated by sudo and remains placeholder-only in this foundation."
          })
        );
      })
      .get("/models", async (c) => {
        const [models, versions] = await Promise.all([
          c.var.repository.model_registry.list(),
          c.var.repository.model_registry_versions.list()
        ]);

        return c.json(
          adminModelRegistryResponseSchema.parse(createAdminModelRegistryResponse(models, versions))
        );
      })
      .patch("/models/:id", async (c) => {
        const body = await validateJson(c, modelPatchRequestSchema);
        if (!body.success) {
          return body.response;
        }

        const model = await c.var.repository.model_registry.get(c.req.param("id"));
        if (!model) {
          return notFound(c, "Model registry record not found");
        }

        const versions = await c.var.repository.model_registry_versions.list();
        const timestamp = nowIso();
        const payload = stripRegistryPatchMetadata(body.data as Record<string, unknown>);
        const sourceUrl = body.data.source_url as string;
        const proposal: ModelRegistryVersion = {
          id: createId("model_registry_version"),
          model_registry_id: model.id,
          version_number: nextModelRegistryVersionNumber(versions, model.id),
          registry_payload: payload,
          source_url: sourceUrl,
          last_verified_at: body.data.last_verified_at ?? null,
          verified_by: body.data.verified_by ?? null,
          approval_state: "pending_review",
          approved_by_admin_user_id: null,
          approved_at: null,
          change_reason:
            typeof body.data.metadata?.change_reason === "string"
              ? body.data.metadata.change_reason
              : "Admin registry metadata proposal.",
          is_mock: true,
          created_at: timestamp
        };

        await c.var.repository.model_registry_versions.create(proposal);

        return c.json(
          modelPatchResponseSchema.parse({
            model,
            proposal,
            diff: createModelRegistryDiff(model, proposal),
            todo: "PATCH creates a pending registry proposal; public recommendations continue using the active record until approval."
          })
        );
      })
      .post("/models/:id/approve", async (c) => {
        const body = await validateJson(c, modelApproveRequestSchema);
        if (!body.success) {
          return body.response;
        }

        const currentModel = await c.var.repository.model_registry.get(c.req.param("id"));
        if (!currentModel) {
          return notFound(c, "Model registry record not found");
        }

        const versions = await c.var.repository.model_registry_versions.list();
        const pendingVersion = versions
          .filter(
            (version) =>
              version.model_registry_id === currentModel.id && version.approval_state === "pending_review"
          )
          .sort((a, b) => b.version_number - a.version_number)
          .at(0);
        const timestamp = nowIso();
        const model = await c.var.repository.model_registry.update(currentModel.id, {
          ...(pendingVersion?.registry_payload as Partial<Omit<ModelRegistryRecord, "id">> | undefined),
          freshness_status: "fresh",
          source_url: body.data.source_url,
          last_verified_at: body.data.last_verified_at,
          verified_by: body.data.verified_by,
          updated_at: timestamp
        });

        if (!model) {
          return notFound(c, "Model registry record not found");
        }

        const approvedVersion =
          pendingVersion
            ? await c.var.repository.model_registry_versions.update(pendingVersion.id, {
                approval_state: "approved",
                approved_by_admin_user_id: c.var.adminSession.admin_user_id,
                approved_at: timestamp,
                source_url: body.data.source_url,
                last_verified_at: body.data.last_verified_at,
                verified_by: body.data.verified_by
              })
            : await c.var.repository.model_registry_versions.create({
                id: createId("model_registry_version"),
                model_registry_id: model.id,
                version_number: nextModelRegistryVersionNumber(versions, model.id),
                registry_payload: {},
                source_url: body.data.source_url,
                last_verified_at: body.data.last_verified_at,
                verified_by: body.data.verified_by,
                approval_state: "approved",
                approved_by_admin_user_id: c.var.adminSession.admin_user_id,
                approved_at: timestamp,
                change_reason: `Approval without pending diff. Reason: ${body.data.reason_code}`,
                is_mock: true,
                created_at: timestamp
              });

        return c.json(
          modelApproveResponseSchema.parse({
            model,
            approved_version: approvedVersion,
            diff: approvedVersion ? createModelRegistryDiff(currentModel, approvedVersion) : [],
            registry_note:
              "Approved metadata is active for public recommendations; stale/demo savings warnings remain when any selected registry row is not fresh."
          })
        );
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
      })
  );
}

function createAdminEvalRunsResponse(input: {
  evalRuns: EvalRun[];
  projects: PromptProject[];
  workspaces: Workspace[];
  models: ModelRegistryRecord[];
  results: EvalResult[];
}) {
  return {
    queue_summary: countEvalJobsWithRateLimits(input.evalRuns),
    worker_health: createWorkerHealth(input.evalRuns),
    jobs: input.evalRuns
      .map((evalRun) => {
        const project = input.projects.find((item) => item.id === evalRun.project_id) ?? null;
        const workspace = project
          ? input.workspaces.find((item) => item.id === project.workspace_id) ?? null
          : null;
        const model =
          input.models.find((item) => evalRun.model_registry_record_ids.includes(item.id)) ?? null;
        const results = input.results.filter((result) => result.eval_run_id === evalRun.id);

        return {
          id: evalRun.id,
          workspace: workspace?.name ?? "Workspace metadata unavailable",
          provider: model?.provider ?? project?.current_provider ?? "openai",
          status: evalRun.status,
          age_seconds: getAgeSeconds(evalRun.queued_at),
          progress: getEvalProgress(evalRun, results),
          action: getEvalJobAction(evalRun),
          redaction_state: "redacted" as const
        };
      })
      .sort((a, b) => b.age_seconds - a.age_seconds),
    notes: [
      "Eval job admin payloads are sanitized by default; raw prompts are not returned without sudo.",
      "Retry, cancel, and report regeneration actions are audited through the admin middleware."
    ]
  };
}

async function createAdminEvalRunDetail(
  repository: ApiEnv["Variables"]["repository"],
  evalRun: EvalRun
) {
  const [detail, models, testCases] = await Promise.all([
    getEvalRunDetail(repository, evalRun),
    repository.model_registry.list(),
    repository.test_cases.list()
  ]);
  const selectedModels = models.filter((model) => evalRun.model_registry_record_ids.includes(model.id));
  const providerErrorResult = detail.results.find((result) =>
    result.failed_check_ids.some((checkId) => checkId.startsWith("provider_error_"))
  );
  const sanitizedProviderError = providerErrorResult
    ? redactProviderError(
        `Provider error for ${providerErrorResult.provider}/${providerErrorResult.model_id}: token=provider-token-demo payload redacted.`
      )
    : null;

  return {
    detail,
    sanitized_payload: {
      eval_run_id: evalRun.id,
      project_id: evalRun.project_id,
      quality_contract_id: evalRun.quality_contract_id,
      baseline_prompt_version_id: evalRun.baseline_prompt_version_id,
      candidate_ids: evalRun.candidate_ids,
      model_registry_record_ids: evalRun.model_registry_record_ids,
      redaction_state: "redacted" as const
    },
    model_ids: selectedModels.map((model) => model.model_id),
    test_count: testCases.filter((testCase) => testCase.quality_contract_id === evalRun.quality_contract_id).length,
    failed_checks: detail.failures,
    sanitized_provider_error: sanitizedProviderError,
    retry_hints: detail.retry_hints,
    worker_health: createWorkerHealth([evalRun])
  };
}

function countEvalJobsWithRateLimits(evalRuns: EvalRun[]) {
  return {
    queued: evalRuns.filter((evalRun) => evalRun.status === "queued").length,
    running: evalRuns.filter((evalRun) => evalRun.status === "running").length,
    failed: evalRuns.filter((evalRun) => evalRun.status === "failed").length,
    retrying: evalRuns.filter((evalRun) => evalRun.status === "retrying").length,
    rate_limited: evalRuns.filter((evalRun) => evalRun.status === "rate_limited").length
  };
}

function createWorkerHealth(evalRuns: EvalRun[]) {
  const hasFailures = evalRuns.some((evalRun) => evalRun.status === "failed");
  const hasRateLimits = evalRuns.some((evalRun) => evalRun.status === "rate_limited");

  return [
    {
      component: "eval-runner" as const,
      status: hasFailures ? "degraded" as const : "mocked" as const,
      redacted_summary: hasFailures
        ? "At least one eval job failed; inspect failed checks and retry hints."
        : "Memory-backed eval runner metadata is available."
    },
    {
      component: "provider-adapter" as const,
      status: hasRateLimits ? "degraded" as const : "mocked" as const,
      redacted_summary: hasRateLimits
        ? "Provider adapter saw rate-limit metadata; raw provider payload is sanitized."
        : "Provider adapter is mocked; no live provider calls are shown."
    },
    {
      component: "scoring" as const,
      status: "mocked" as const,
      redacted_summary: "Deterministic scoring metadata is available from eval results."
    },
    {
      component: "report-generator" as const,
      status: "mocked" as const,
      redacted_summary: "Report regeneration is queued as a mocked operator action."
    }
  ];
}

function getEvalProgress(evalRun: EvalRun, results: EvalResult[]): number {
  const expectedRows = Math.max(1, evalRun.candidate_ids.length * evalRun.model_registry_record_ids.length);

  if (evalRun.status === "complete") {
    return 1;
  }

  return Math.min(1, results.length / expectedRows);
}

function getEvalJobAction(evalRun: EvalRun) {
  if (evalRun.status === "failed" || evalRun.status === "rate_limited") {
    return "retry" as const;
  }

  if (evalRun.status === "queued" || evalRun.status === "running" || evalRun.status === "retrying") {
    return "cancel" as const;
  }

  return "regenerate_report" as const;
}

function getAgeSeconds(isoTimestamp: string): number {
  const ageMs = Date.now() - Date.parse(isoTimestamp);

  return Number.isFinite(ageMs) ? Math.max(0, Math.floor(ageMs / 1000)) : 0;
}

function createAdminModelRegistryResponse(
  models: ModelRegistryRecord[],
  versions: ModelRegistryVersion[]
) {
  const pendingVersions = versions.filter((version) => version.approval_state === "pending_review");

  return {
    freshness_summary: {
      fresh: models.filter((model) => model.freshness_status === "fresh").length,
      stale: models.filter((model) => model.freshness_status === "stale").length,
      deprecated: models.filter(
        (model) =>
          model.freshness_status === "deprecated" || model.stability_status === "deprecated"
      ).length,
      preview_experimental: models.filter((model) =>
        ["preview", "experimental"].includes(model.stability_status)
      ).length,
      unverified: models.filter((model) => model.freshness_status === "unverified").length
    },
    models: models.map((model) => {
      const pendingVersion =
        pendingVersions
          .filter((version) => version.model_registry_id === model.id)
          .sort((a, b) => b.version_number - a.version_number)
          .at(0) ?? null;

      return {
        id: model.id,
        provider: model.provider,
        model_id: model.model_id,
        display_name: model.display_name,
        input_price_per_million_tokens: model.input_price_per_million_tokens,
        output_price_per_million_tokens: model.output_price_per_million_tokens,
        cached_input_price_per_million_tokens: model.cached_input_price_per_million_tokens,
        context_window: model.context_window,
        capabilities: {
          text: model.supports_text,
          image: model.supports_image,
          audio: model.supports_audio,
          video: model.supports_video,
          tools: model.supports_tools,
          structured_output: model.supports_structured_output
        },
        stability_status: model.stability_status,
        freshness_status: model.freshness_status,
        source_url: model.source_url,
        last_verified_at: model.last_verified_at,
        verified_by: model.verified_by,
        pricing_note: model.pricing_note,
        active_for_public_recommendations:
          model.freshness_status === "fresh" &&
          model.stability_status !== "deprecated" &&
          !model.is_mock,
        pending_version_id: pendingVersion?.id ?? null
      };
    }),
    proposed_changes: pendingVersions.map((version) => {
      const model = models.find((item) => item.id === version.model_registry_id);

      return {
        version,
        model_id: model?.model_id ?? version.model_registry_id,
        display_name: model?.display_name ?? "Unknown model",
        diff: model ? createModelRegistryDiff(model, version) : [],
        approval_actions: {
          approve_enabled: Boolean(model),
          reject_enabled: false,
          note: "Approve is implemented; reject remains placeholder-only until a reject route is added."
        }
      };
    }),
    registry_note:
      "Admin registry rows are metadata only. PATCH creates pending proposals; approval publishes active metadata used by public recommendations."
  };
}

function stripRegistryPatchMetadata(patch: Record<string, unknown>): Record<string, unknown> {
  const { source_url: _sourceUrl, last_verified_at: _lastVerifiedAt, verified_by: _verifiedBy, ...payload } = patch;

  return stripUndefined(payload);
}

function nextModelRegistryVersionNumber(
  versions: ModelRegistryVersion[],
  modelRegistryId: string
): number {
  const latestVersion = versions
    .filter((version) => version.model_registry_id === modelRegistryId)
    .sort((a, b) => b.version_number - a.version_number)
    .at(0);

  return (latestVersion?.version_number ?? 0) + 1;
}

function createModelRegistryDiff(model: ModelRegistryRecord, version: ModelRegistryVersion) {
  return Object.entries(version.registry_payload)
    .filter(([field, after]) => (model as unknown as Record<string, unknown>)[field] !== after)
    .map(([field, after]) => ({
      field,
      before: (model as unknown as Record<string, unknown>)[field] ?? null,
      after
    }));
}

function createAccountPipelineRows(input: {
  accounts: Account[];
  opportunities: Opportunity[];
  freeAudits: FreeAudit[];
  notes: CrmNote[];
  tasks: CrmTask[];
}): AdminAccountsResponse["accounts"] {
  return input.accounts
    .map((account) => {
      const opportunity = latestBy(
        input.opportunities.filter((item) => item.account_id === account.id),
        (item) => item.updated_at
      );
      const lastActivityAt = maxIso([
        account.updated_at,
        opportunity?.updated_at ?? null,
        ...input.freeAudits
          .filter((item) => item.account_id === account.id)
          .map((item) => item.created_at),
        ...input.notes.filter((item) => item.account_id === account.id).map((item) => item.created_at),
        ...input.tasks.filter((item) => item.account_id === account.id).map((item) => item.updated_at)
      ]);

      return {
        account_id: account.id,
        account: account.name,
        provider: account.provider_preference ?? opportunity?.provider ?? null,
        fit_signal: opportunity?.fit_signal ?? null,
        volume: opportunity?.estimated_volume ?? opportunity?.estimated_monthly_calls ?? null,
        savings_opportunity_usd:
          opportunity?.estimated_savings ?? opportunity?.savings_opportunity_usd ?? null,
        stage: account.stage,
        owner_admin_user_id: account.owner_admin_user_id,
        last_activity_at: lastActivityAt,
        redacted_prompt_preview: account.redacted_prompt_preview,
        opportunity_id: opportunity?.id ?? null,
        redaction_state: "redacted" as const
      };
    })
    .sort((a, b) => (b.last_activity_at ?? "").localeCompare(a.last_activity_at ?? ""));
}

async function createAccountDetail(
  repository: ApiEnv["Variables"]["repository"],
  account: Account,
  role: ApiEnv["Variables"]["adminSession"]["role"],
  prefetched: {
    contacts: Contact[];
    opportunities: Opportunity[];
  }
): Promise<AdminAccountDetailResponse> {
  const [
    workspaces,
    projects,
    prompts,
    analyses,
    evalRuns,
    reports,
    entitlements,
    usageLedger,
    freeAudits,
    notes,
    tasks
  ] = await Promise.all([
    repository.workspaces.list(),
    repository.projects.list(),
    repository.prompts.list(),
    repository.prompt_analyses.list(),
    repository.eval_runs.list(),
    repository.reports.list(),
    repository.entitlements.list(),
    repository.usage_ledger.list(),
    repository.free_audits.list(),
    repository.crm_notes.list(),
    repository.tasks.list()
  ]);
  const shouldStrictlyRedact = role === "support";
  const contacts = prefetched.contacts
    .filter((contact) => contact.account_id === account.id)
    .map((contact) => redactContactForRole(contact, shouldStrictlyRedact));
  const opportunities = prefetched.opportunities.filter(
    (opportunity) => opportunity.account_id === account.id
  );
  const workspace = account.workspace_id
    ? workspaces.find((item) => item.id === account.workspace_id) ?? null
    : null;
  const projectIdsFromOpportunities = new Set(
    opportunities
      .map((opportunity) => opportunity.project_id)
      .filter((id): id is string => Boolean(id))
  );
  const accountProjects = projects.filter((project) => {
    if (account.workspace_id && project.workspace_id === account.workspace_id) {
      return true;
    }

    return projectIdsFromOpportunities.has(project.id);
  });
  const accountProjectIds = new Set(accountProjects.map((project) => project.id));
  const accountPrompts = prompts.filter((prompt) => accountProjectIds.has(prompt.project_id));
  const accountAnalyses = analyses.filter((analysis) => {
    const prompt = accountPrompts.find((item) => item.current_version_id === analysis.prompt_version_id);
    return Boolean(prompt);
  });
  const accountEvalRuns = evalRuns.filter((evalRun) => accountProjectIds.has(evalRun.project_id));
  const accountReports = reports.filter((report) => accountProjectIds.has(report.project_id));
  const accountEntitlements = entitlements.filter(
    (entitlement) => account.workspace_id && entitlement.workspace_id === account.workspace_id
  );
  const accountUsageLedger = usageLedger.filter(
    (entry) => account.workspace_id && entry.workspace_id === account.workspace_id
  );
  const accountFreeAudits = freeAudits.filter((freeAudit) => freeAudit.account_id === account.id);
  const accountNotes = notes.filter((note) => note.account_id === account.id);
  const accountTasks = tasks.filter((task) => task.account_id === account.id);
  const latestOpportunity = latestBy(opportunities, (opportunity) => opportunity.updated_at);
  const plan = accountEntitlements[0]?.plan_id ?? "placeholder";
  const seats =
    accountEntitlements.find((entitlement) => entitlement.feature === "admin_seats")?.limit ?? 1;
  const accountForRole = shouldStrictlyRedact
    ? {
        ...account,
        domain: account.domain ? "domain.redacted" : null,
        redacted_prompt_preview: redactPromptPreview(account.redacted_prompt_preview ?? account.name)
      }
    : account;

  return {
    account: accountForRole,
    header: {
      plan,
      seats,
      provider: account.provider_preference ?? latestOpportunity?.provider ?? null,
      byok_status: "unknown",
      usage:
        accountUsageLedger.length > 0
          ? `${accountUsageLedger.length} usage ledger event(s)`
          : "Usage ledger placeholder",
      estimated_savings_usd:
        latestOpportunity?.estimated_savings ?? latestOpportunity?.savings_opportunity_usd ?? null,
      stage: account.stage,
      owner_admin_user_id: account.owner_admin_user_id
    },
    workspace_health: {
      workspace_id: workspace?.id ?? null,
      workspace_name: workspace?.name ?? null,
      status: getWorkspaceHealthStatus(accountProjects, accountEvalRuns, accountReports),
      projects: accountProjects.length,
      eval_runs: accountEvalRuns.length,
      reports: accountReports.length,
      redacted_summary: getWorkspaceHealthSummary(accountProjects, accountEvalRuns, accountReports)
    },
    projects: accountProjects.map((project) => {
      const prompt = accountPrompts.find((item) => item.project_id === project.id) ?? null;

      return {
        project_id: project.id,
        name: project.name,
        provider: project.current_provider,
        current_model_id: project.current_model_id,
        status: project.status,
        prompt_id: prompt?.id ?? null,
        redacted_prompt_preview: prompt
          ? redactPreviewForRole(prompt.redacted_preview, shouldStrictlyRedact)
          : null
      };
    }),
    reports: accountReports.map((report) => ({
      report_id: report.id,
      project_id: report.project_id,
      status: report.status,
      production_recommendation_allowed: report.production_recommendation_allowed,
      generated_at: report.generated_at,
      redacted_summary: report.production_recommendation_allowed
        ? "Report metadata shows an eval-backed recommendation exists."
        : "Report metadata shows production recommendation is blocked or pending."
    })),
    billing: {
      plan,
      seats,
      usage_ledger_events: accountUsageLedger.length,
      placeholder: "Billing tab is placeholder-only until billing events, invoices, and credits are durable."
    },
    support_timeline: createSupportTimeline({
      notes: accountNotes,
      tasks: accountTasks,
      freeAudits: accountFreeAudits,
      opportunities,
      reports: accountReports
    }),
    redacted_previews: createRedactedPreviews({
      projects: accountProjects,
      prompts: accountPrompts,
      analyses: accountAnalyses,
      reports: accountReports,
      freeAudits: accountFreeAudits,
      strict: shouldStrictlyRedact
    }),
    contacts,
    opportunities,
    notes: accountNotes,
    tasks: accountTasks
  };
}

function redactContactForRole(contact: Contact, strict: boolean): Contact {
  if (!strict) {
    return contact;
  }

  return {
    ...contact,
    name: "Contact redacted",
    email: `redacted-${contact.id.replace(/[^a-z0-9]/gi, "").slice(-8) || "contact"}@promptopts.invalid`,
    role: contact.role ? "Role redacted" : null
  };
}

function getWorkspaceHealthStatus(
  projects: PromptProject[],
  evalRuns: EvalRun[],
  reports: RecommendationReport[]
): AdminAccountDetailResponse["workspace_health"]["status"] {
  if (projects.length === 0) {
    return "unknown";
  }

  if (reports.some((report) => report.production_recommendation_allowed)) {
    return "healthy";
  }

  if (evalRuns.length === 0 || evalRuns.some((evalRun) => evalRun.status !== "complete")) {
    return "needs_eval";
  }

  return "needs_review";
}

function getWorkspaceHealthSummary(
  projects: PromptProject[],
  evalRuns: EvalRun[],
  reports: RecommendationReport[]
): string {
  if (projects.length === 0) {
    return "No workspace project metadata is attached to this account.";
  }

  if (reports.some((report) => report.production_recommendation_allowed)) {
    return "At least one report has eval-backed recommendation metadata.";
  }

  if (evalRuns.length === 0) {
    return "Projects exist, but no eval run metadata is attached yet.";
  }

  return "Workspace has eval/report metadata, but operator review is still needed.";
}

function createSupportTimeline(input: {
  notes: CrmNote[];
  tasks: CrmTask[];
  freeAudits: FreeAudit[];
  opportunities: Opportunity[];
  reports: RecommendationReport[];
}): AdminAccountDetailResponse["support_timeline"] {
  const noteEvents = input.notes.map((note) => ({
    id: note.id,
    type: "note" as const,
    label: note.body_redacted,
    timestamp: note.created_at,
    actor: note.author_admin_user_id ? redactIdentifier(note.author_admin_user_id, "admin") : "system",
    redaction_state: note.redaction_state
  }));
  const taskEvents = input.tasks.map((task) => ({
    id: task.id,
    type: "task" as const,
    label: `${task.status}: ${task.title}`,
    timestamp: task.updated_at,
    actor: task.assignee_admin_user_id ? redactIdentifier(task.assignee_admin_user_id, "admin") : "unassigned",
    redaction_state: "redacted" as const
  }));
  const freeAuditEvents = input.freeAudits.map((freeAudit) => ({
    id: freeAudit.id,
    type: "free_audit" as const,
    label: `Free audit captured ${freeAudit.model_fit} fit; run evals before switching.`,
    timestamp: freeAudit.created_at,
    actor: "system",
    redaction_state: "redacted" as const
  }));
  const opportunityEvents = input.opportunities.map((opportunity) => ({
    id: opportunity.id,
    type: "opportunity" as const,
    label: `${opportunity.stage} opportunity for ${opportunity.provider}/${opportunity.current_model_id}`,
    timestamp: opportunity.updated_at,
    actor: "system",
    redaction_state: "redacted" as const
  }));
  const reportEvents = input.reports.map((report) => ({
    id: report.id,
    type: "report" as const,
    label: `Report ${report.status}; raw report content remains hidden.`,
    timestamp: report.updated_at,
    actor: "system",
    redaction_state: "redacted" as const
  }));

  return [...noteEvents, ...taskEvents, ...freeAuditEvents, ...opportunityEvents, ...reportEvents]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 12);
}

function createRedactedPreviews(input: {
  projects: PromptProject[];
  prompts: Prompt[];
  analyses: PromptAnalysis[];
  reports: RecommendationReport[];
  freeAudits: FreeAudit[];
  strict: boolean;
}): AdminAccountDetailResponse["redacted_previews"] {
  const promptPreviews = input.prompts.map((prompt) => {
    const analysis = input.analyses.find((item) => item.prompt_version_id === prompt.current_version_id);

    return {
      id: prompt.id,
      type: "prompt" as const,
      label: prompt.name,
      redacted_preview: redactPreviewForRole(prompt.redacted_preview, input.strict),
      risk_level: analysis?.risk_level ?? null
    };
  });
  const projectPreviews = input.projects.map((project) => ({
    id: project.id,
    type: "project" as const,
    label: project.name,
    redacted_preview: `Project metadata only: ${project.current_provider}/${project.current_model_id}.`,
    risk_level: null
  }));
  const reportPreviews = input.reports.map((report) => ({
    id: report.id,
    type: "report" as const,
    label: `Report ${report.status}`,
    redacted_preview: report.production_recommendation_allowed
      ? "Eval-backed recommendation metadata is available; raw report is hidden."
      : "Report is blocked or pending; raw report is hidden.",
    risk_level: null
  }));
  const freeAuditPreviews = input.freeAudits.map((freeAudit) => ({
    id: freeAudit.id,
    type: "free_audit" as const,
    label: "Free audit",
    redacted_preview: redactPreviewForRole(freeAudit.redacted_prompt_preview, input.strict),
    risk_level: null
  }));

  return [...promptPreviews, ...projectPreviews, ...reportPreviews, ...freeAuditPreviews];
}

function redactPreviewForRole(preview: string, strict: boolean): string {
  return strict ? redactPromptPreview(preview) : preview;
}

function redactCrmNoteBody(body: string): string {
  return `Admin note redacted (${body.replace(/\s+/g, " ").trim().length} chars)`;
}

function latestBy<TItem>(items: TItem[], getTimestamp: (item: TItem) => string): TItem | null {
  return (
    items
      .slice()
      .sort((a, b) => getTimestamp(b).localeCompare(getTimestamp(a)))
      .at(0) ?? null
  );
}

function maxIso(values: Array<string | null>): string | null {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => b.localeCompare(a))
    .at(0) ?? null;
}

function countEvalJobs(evalRuns: EvalRun[]): AdminOverviewResponse["kpis"]["eval_jobs"] {
  return {
    queued: evalRuns.filter((evalRun) => evalRun.status === "queued").length,
    running: evalRuns.filter((evalRun) => evalRun.status === "running").length,
    failed: evalRuns.filter((evalRun) => evalRun.status === "failed").length,
    retrying: evalRuns.filter((evalRun) => evalRun.status === "retrying").length
  };
}

function countFailedReportExports(
  reports: RecommendationReport[],
  artifacts: ReportArtifact[]
): number {
  return reports.filter((report) => {
    const reportArtifacts = artifacts.filter((artifact) => artifact.report_id === report.id);

    if (report.status === "exported" && reportArtifacts.length === 0) {
      return true;
    }

    return reportArtifacts.some((artifact) => artifact.checksum === null && artifact.size_bytes === null);
  }).length;
}

function createLiveActivityFeed(input: {
  auditLogs: AdminAuditLog[];
  evalRuns: EvalRun[];
  reports: RecommendationReport[];
  freeAuditCount: number;
}): AdminOverviewResponse["live_activity"] {
  const auditActivity = input.auditLogs
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5)
    .map((log) => ({
      id: `activity_${log.id}`,
      label: formatAuditLogActivity(log),
      actor: redactIdentifier(log.admin_user_id, "admin"),
      target: `${log.target_type}:${redactIdentifier(log.target_id, "target")}`,
      timestamp: log.created_at,
      link: getAdminActivityLink(log.target_type),
      redaction_state: "redacted" as const
    }));
  const evalActivity = input.evalRuns.slice(0, 2).map((evalRun) => ({
    id: `activity_${evalRun.id}`,
    label: `Eval job ${evalRun.status}`,
    actor: "system",
    target: `eval:${redactIdentifier(evalRun.id, "target")}`,
    timestamp: evalRun.completed_at ?? evalRun.started_at ?? evalRun.queued_at,
    link: "/__admin/eval-jobs",
    redaction_state: "redacted" as const
  }));
  const reportActivity = input.reports.slice(0, 2).map((report) => ({
    id: `activity_${report.id}`,
    label: `Report ${report.status}`,
    actor: "system",
    target: `report:${redactIdentifier(report.id, "target")}`,
    timestamp: report.updated_at,
    link: "/__admin/reports",
    redaction_state: "redacted" as const
  }));
  const freeAuditActivity =
    input.freeAuditCount > 0
      ? [
          {
            id: "activity_free_audit_rollup",
            label: `${input.freeAuditCount} free audit signal(s) captured`,
            actor: "system",
            target: "account:rollup",
            timestamp: new Date(0).toISOString(),
            link: "/__admin/accounts",
            redaction_state: "redacted" as const
          }
        ]
      : [];

  return [...auditActivity, ...evalActivity, ...reportActivity, ...freeAuditActivity]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 8);
}

function formatAuditLogActivity(log: AdminAuditLog): string {
  if (log.action.includes("/overview")) {
    return "Overview metadata read";
  }

  return `${log.target_type} ${log.action_scope}`;
}

function getAdminActivityLink(targetType: string): string {
  switch (targetType) {
    case "accounts":
      return "/__admin/accounts";
    case "users":
      return "/__admin/users";
    case "eval_runs":
      return "/__admin/eval-jobs";
    case "models":
    case "model_registry":
      return "/__admin/model-registry";
    case "reports":
      return "/__admin/reports";
    case "billing":
      return "/__admin/billing";
    case "audit_logs":
      return "/__admin/audit-logs";
    default:
      return "/__admin/overview";
  }
}

function redactIdentifier(id: string, prefix: string): string {
  const suffix = id.replace(/[^a-zA-Z0-9]/g, "").slice(-6);

  return `${prefix}_${suffix || "redacted"}`;
}
