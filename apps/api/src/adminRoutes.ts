import { Hono, type Context } from "hono";
import { decideRecommendation } from "@promptopts/eval-core";
import { classifyRegistryFreshness } from "@promptopts/model-registry";
import { generateReportArtifacts, persistGeneratedReportArtifacts } from "@promptopts/report-generator";
import {
  ADMIN_SESSION_COOKIE_NAME,
  authenticateAdminPassword,
  canUseActionScope,
  createStoredAdminSession,
  endSudoRequests,
  getSudoStatus,
  redactProviderError,
  redactPromptPreview,
  requireActionScope,
  requireAdminRole,
  requireMfa,
  requireSession,
  requireSudo,
  revokeAdminSession,
  rotateAdminSessionAfterMfa,
  startSudoRequest,
  verifyAdminTotp,
  writeAdminSecurityAuditEvent,
  writeAdminAuditEvent
} from "@promptopts/admin-core";
import type {
  Account,
  AdminAuditLog,
  BillingEvent,
  Contact,
  Credit,
  CrmNote,
  CrmTask,
  DeletionRequest,
  Entitlement,
  EvalResult,
  EvalRun,
  FeatureFlag,
  FreeAudit,
  Invoice,
  ModelRegistryRecord,
  ModelRegistryVersion,
  Opportunity,
  Plan,
  Prompt,
  PromptAnalysis,
  PromptProject,
  ProviderConnection,
  RecommendationReport,
  ReportArtifact,
  ReportArtifactStorage,
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
  adminAuthLoginRequestSchema,
  adminAuthLogoutResponseSchema,
  adminAuthMeResponseSchema,
  adminAuthMfaRequestSchema,
  adminAuthSessionResponseSchema,
  adminSudoEndRequestSchema,
  adminSudoEndResponseSchema,
  adminSudoStartRequestSchema,
  adminSudoStartResponseSchema,
  adminSudoStatusResponseSchema,
  adminAccountDetailResponseSchema,
  adminAccountsResponseSchema,
  adminEvalRunDetailResponseSchema,
  type AdminAccountDetailResponse,
  type AdminAccountsResponse,
  adminEvalRunsResponseSchema,
  adminModelRegistryResponseSchema,
  adminOverviewResponseSchema,
  type AdminOverviewResponse,
  adminProviderConnectionsResponseSchema,
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
  modelRejectRequestSchema,
  modelRejectResponseSchema,
  promptRevealResponseSchema,
  regenerateReportResponseSchema,
  reportDeleteRequestSchema,
  reportDeleteResponseSchema,
  reportExportActionResponseSchema,
  reportRevealResponseSchema,
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
import {
  countEvalJobs,
  countFailedReportExports,
  createAccountDetail,
  createAccountPipelineRows,
  createAdminEvalRunDetail,
  createAdminEvalRunsResponse,
  createAdminModelRegistryResponse,
  createAdminReportsVault,
  createBillingAdminResponse,
  createLiveActivityFeed,
  createModelRegistryDiff,
  markReportDeleted,
  nextModelRegistryVersionNumber,
  redactCrmNoteBody,
  regenerateReportExports,
  retryReportExport,
  stripRegistryPatchMetadata,
  toAdminProviderConnectionMetadata,
  upsertFeatureFlags,
  upsertWorkspaceEntitlements
} from "./admin/helpers";
import { createAdminAuthRoutes } from "./admin/authRoutes";

const ACCOUNT_PIPELINE_STAGES = [
  "new_audit",
  "qualified",
  "eval_ready",
  "trial",
  "paid",
  "needs_review"
] as const;

function adminAuthError(
  c: Context<ApiEnv>,
  status: 401 | 403,
  code: string,
  message: string
): Response {
  return c.json(
    {
      error: {
        code,
        message
      }
    },
    status
  );
}

function readAdminRequestMetadata(c: Context<ApiEnv>) {
  return {
    ipAddress:
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("cf-connecting-ip") ??
      "127.0.0.1",
    userAgent: c.req.header("user-agent") ?? "unknown"
  };
}

function writeAdminSessionCookie(c: Context<ApiEnv>, token: string, expiresAt: string): void {
  c.header(
    "set-cookie",
    serializeAdminSessionCookie(token, {
      expiresAt,
      expired: false
    })
  );
}

function expireAdminSessionCookie(c: Context<ApiEnv>): void {
  c.header(
    "set-cookie",
    serializeAdminSessionCookie("", {
      expiresAt: new Date(0).toISOString(),
      expired: true
    })
  );
}

function serializeAdminSessionCookie(
  token: string,
  options: {
    expiresAt: string;
    expired: boolean;
  }
): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const maxAge = options.expired ? 0 : Math.max(0, Math.floor((Date.parse(options.expiresAt) - Date.now()) / 1000));

  return [
    `${ADMIN_SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    `Expires=${new Date(options.expiresAt).toUTCString()}${secure}`
  ].join("; ");
}

function formatSudoStatus(status: Awaited<ReturnType<typeof getSudoStatus>>) {
  const activeUntil = status.active
    .map((request) => request.expires_at)
    .sort()
    .at(-1) ?? null;

  return {
    ...status,
    active_until: activeUntil
  };
}

export function createAdminApiRoutes() {
  return (
    new Hono<ApiEnv>()
      .route("/", createAdminAuthRoutes())
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
          auditLogs,
          deletionRequests
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
          c.var.repository.admin_audit_logs.list(),
          c.var.repository.deletion_requests.list()
        ]);
        const modelsNeedingReview = models.filter(
          (model) => !classifyRegistryFreshness(model).exactSavingsAllowed
        );
        const unverifiedModelCount = modelsNeedingReview.length;
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
              repository: c.var.repository.backend,
              admin_auth: "session"
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
                severity: deletionRequests.some((request) => request.status === "failed") ? "high" : deletionRequests.length > 0 ? "medium" : "low",
                count: deletionRequests.filter((request) => request.status !== "completed").length,
                link: "/__admin/reports",
                redacted_summary: deletionRequests.length > 0
                  ? "Deletion requests are tracked with durable status and retry evidence."
                  : "No active deletion requests are visible."
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
      .get("/provider-connections", async (c) => {
        const [connections, workspaces] = await Promise.all([
          c.var.repository.provider_connections.list(),
          c.var.repository.workspaces.list()
        ]);

        return c.json(
          adminProviderConnectionsResponseSchema.parse({
            connections: connections.map((connection) =>
              toAdminProviderConnectionMetadata(connection, workspaces)
            ),
            redaction_note:
              "Admin provider-key views are metadata-only; ciphertext and plaintext are never returned."
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
            todo: `User-session revocation remains product-auth work. Admin logout/revocation is handled by /admin-api/auth/logout. Reason: ${body.data.reason_code}`
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

        const workspaceId = c.req.param("id");
        const existingWorkspace = await c.var.repository.workspaces.get(workspaceId);
        if (!existingWorkspace) {
          return notFound(c, "Workspace not found");
        }

        if (body.data.entitlements || body.data.plan_id) {
          await upsertWorkspaceEntitlements(c.var.repository, {
            workspaceId,
            planId: body.data.plan_id ?? "manual",
            entitlements: body.data.entitlements ?? [],
            timestamp: nowIso()
          });
        }

        if (body.data.feature_flags) {
          await upsertFeatureFlags(c.var.repository, {
            flags: body.data.feature_flags,
            adminUserId: c.var.adminSession.admin_user_id,
            timestamp: nowIso()
          });
        }

        const workspace = await c.var.repository.workspaces.update(
          workspaceId,
          stripUndefined({
            name: body.data.name,
            slug: body.data.slug,
            prompts_private_by_default: body.data.prompts_private_by_default,
            data_use_policy: body.data.data_use_policy,
            provider_call_sensitive_data_policy: body.data.provider_call_sensitive_data_policy,
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
          is_mock: false,
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
          approval_state: "approved",
          approved_by_admin_user_id: c.var.adminSession.admin_user_id,
          approved_at: timestamp,
          is_mock: false,
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
                is_mock: false,
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
      .post("/models/:id/reject", async (c) => {
        const body = await validateJson(c, modelRejectRequestSchema);
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

        if (!pendingVersion) {
          return notFound(c, "Pending model registry proposal not found");
        }

        const rejectedVersion = await c.var.repository.model_registry_versions.update(
          pendingVersion.id,
          {
            approval_state: "rejected",
            change_reason: `${pendingVersion.change_reason} Rejected: ${body.data.reason_code}`
          }
        );

        if (!rejectedVersion) {
          return notFound(c, "Pending model registry proposal not found");
        }

        return c.json(
          modelRejectResponseSchema.parse({
            rejected_version: rejectedVersion,
            registry_note:
              "Registry proposal rejected. Active metadata remains unchanged and exact-savings eligibility still depends on the current approved row."
          })
        );
      })
      .get("/reports", async (c) => {
        const [reports, artifacts, projects, workspaces] = await Promise.all([
          c.var.repository.reports.list(),
          c.var.repository.report_artifacts.list(),
          c.var.repository.projects.list(),
          c.var.repository.workspaces.list()
        ]);

        return c.json(
          adminReportsResponseSchema.parse(
            await createAdminReportsVault({
              reports,
              artifacts,
              projects,
              workspaces,
              storage: c.var.reportArtifactStorage
            })
          )
        );
      })
      .get("/reports/:id/reveal", async (c) => {
        const report = await c.var.repository.reports.get(c.req.param("id"));
        if (!report) {
          return notFound(c, "Report not found");
        }

        return c.json(
          reportRevealResponseSchema.parse({
            report_id: report.id,
            redacted_summary: report.production_recommendation_allowed
              ? "Report has eval-backed recommendation metadata; raw report body remains locked."
              : "Report is blocked or pending; raw report body remains locked.",
            raw_report: null,
            todo: "Raw report reveal requires sudo and remains placeholder-only until encrypted report bodies are modeled."
          })
        );
      })
      .post("/reports/:id/retry-export", async (c) => {
        const body = await validateJson(c, adminReasonRequestSchema);
        if (!body.success) {
          return body.response;
        }

        const report = await c.var.repository.reports.get(c.req.param("id"));
        if (!report) {
          return notFound(c, "Report not found");
        }

        const artifacts = await retryReportExport(
          c.var.repository,
          c.var.reportArtifactStorage,
          report,
          body.data.reason_code
        );

        return c.json(
          reportExportActionResponseSchema.parse({
            report,
            artifacts,
            redaction_state: "redacted",
            todo: "Retry export refreshed redacted artifact metadata only; eval results were not rerun."
          })
        );
      })
      .post("/reports/:id/regenerate", async (c) => {
        const body = await validateJson(c, adminReasonRequestSchema);
        if (!body.success) {
          return body.response;
        }

        const report = await c.var.repository.reports.get(c.req.param("id"));
        if (!report) {
          return notFound(c, "Report not found");
        }

        const artifacts = await regenerateReportExports(
          c.var.repository,
          c.var.reportArtifactStorage,
          report,
          body.data.reason_code
        );

        return c.json(
          reportExportActionResponseSchema.parse({
            report,
            artifacts,
            redaction_state: "redacted",
            todo: "Regenerated exports from existing eval snapshot only; evals were not rerun."
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

        const deletion = await markReportDeleted({
          repository: c.var.repository,
          storage: c.var.reportArtifactStorage,
          report,
          reasonCode: body.data.reason_code,
          adminUserId: c.var.adminSession.admin_user_id,
          session: c.var.adminSession,
          sudoRequestId: c.var.adminActionContext.sudo_request_id
        });

        return c.json(
          reportDeleteResponseSchema.parse({
            report_id: report.id,
            deletion_queued: deletion.artifactFailures > 0,
            deletion_status: deletion.artifactFailures > 0 ? "failed" : "deleted",
            artifacts_deleted: deletion.artifactsDeleted,
            artifact_failures: deletion.artifactFailures,
            scoped_records_marked: deletion.scopedRecordsMarked,
            todo: deletion.artifactFailures > 0
              ? `Deletion is partially complete and retryable. Failed artifacts: ${deletion.artifactFailures}. Reason: ${body.data.reason_code}`
              : `Deletion removed object artifacts, marked scoped DB records deleted, and wrote audit events. Reason: ${body.data.reason_code}`
          })
        );
      })
      .get("/billing", async (c) => {
        const [workspaces, entitlements, usageLedger, plans, invoices, credits, billingEvents, featureFlags] = await Promise.all([
          c.var.repository.workspaces.list(),
          c.var.repository.entitlements.list(),
          c.var.repository.usage_ledger.list(),
          c.var.repository.plans.list(),
          c.var.repository.invoices.list(),
          c.var.repository.credits.list(),
          c.var.repository.billing_events.list(),
          c.var.repository.feature_flags.list()
        ]);

        return c.json(
          billingResponseSchema.parse(createBillingAdminResponse({
            workspace: workspaces[0] ?? null,
            entitlements,
            usageLedger,
            plans,
            invoices,
            credits,
            billingEvents,
            featureFlags
          }))
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

        const timestamp = nowIso();
        const billingEvent: BillingEvent = {
          id: createId("billing_event"),
          workspace_id: workspace.id,
          event_type: "credit_issued",
          amount_cents: body.data.quantity * 100,
          currency: "usd",
          external_reference: null,
          metadata: {
            feature: body.data.feature,
            reason_code: body.data.reason_code
          },
          is_mock: true,
          created_at: timestamp
        };
        const credit: Credit = {
          id: createId("credit"),
          workspace_id: workspace.id,
          amount_cents: body.data.quantity * 100,
          currency: "usd",
          reason_code: body.data.reason_code,
          issued_by_admin_user_id: c.var.adminSession.admin_user_id,
          sudo_request_id: c.var.adminActionContext.sudo_request_id,
          billing_event_id: billingEvent.id,
          is_mock: true,
          created_at: timestamp
        };
        const ledgerEntry: UsageLedgerEntry = {
          id: createId("usage_ledger"),
          workspace_id: workspace.id,
          feature: body.data.feature,
          quantity: body.data.quantity,
          unit: unitForFeature(body.data.feature),
          direction: "credit",
          source_type: "admin_credit",
          source_id: credit.id,
          is_mock: true,
          created_at: timestamp
        };

        await c.var.repository.billing_events.create(billingEvent);
        await c.var.repository.credits.create(credit);
        await c.var.repository.usage_ledger.create(ledgerEntry);

        return c.json(
          billingCreditResponseSchema.parse({
            ledger_entry: ledgerEntry,
            credit,
            billing_event: billingEvent,
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
