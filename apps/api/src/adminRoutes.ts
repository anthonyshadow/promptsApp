import { Hono } from "hono";
import {
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
  EvalRun,
  ModelRegistryRecord,
  RecommendationReport,
  ReportArtifact,
  UsageLedgerEntry,
  Workspace
} from "@promptopts/shared";
import {
  accountCreateRequestSchema,
  accountPatchRequestSchema,
  adminAccountDetailResponseSchema,
  adminAccountsResponseSchema,
  adminEvalRunsResponseSchema,
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
  evalRunDetailResponseSchema,
  impersonationResponseSchema,
  modelApproveRequestSchema,
  modelPatchRequestSchema,
  modelsResponseSchema,
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
      })
  );
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
