import { decideRecommendation } from "@promptopts/eval-core";
import { generateReportArtifacts, persistGeneratedReportArtifacts } from "@promptopts/report-generator";
import { redactProviderError, redactPromptPreview, writeAdminSecurityAuditEvent } from "@promptopts/admin-core";
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
import type {
  AdminAccountDetailResponse,
  AdminAccountsResponse,
  AdminOverviewResponse
} from "../contracts";
import type { ApiEnv } from "../context";
import { createId, getEvalRunDetail, nowIso, stripUndefined } from "../http";

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

function toAdminProviderConnectionMetadata(
  connection: ProviderConnection,
  workspaces: Workspace[]
) {
  const { encrypted_key_blob: _encryptedKeyBlob, ...metadata } = connection;
  const workspace = workspaces.find((item) => item.id === connection.workspace_id);

  return {
    ...metadata,
    workspace_name: workspace?.name ?? null
  };
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

export { countEvalJobs, countFailedReportExports, createLiveActivityFeed, toAdminProviderConnectionMetadata };
