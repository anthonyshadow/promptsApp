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

async function createAdminReportsVault(input: {
  reports: RecommendationReport[];
  artifacts: ReportArtifact[];
  projects: PromptProject[];
  workspaces: Workspace[];
  storage: ReportArtifactStorage;
}) {
  const rowGroups = await Promise.all(input.reports.map(async (report) => {
    const reportArtifacts = input.artifacts.filter((artifact) => artifact.report_id === report.id);
    const artifacts = reportArtifacts.length > 0
      ? reportArtifacts
      : [createVirtualReportArtifact(report, "json")];
    const project = input.projects.find((item) => item.id === report.project_id) ?? null;
    const workspace = project
      ? input.workspaces.find((item) => item.id === project.workspace_id) ?? null
      : null;
    const artifactRows = await Promise.all(artifacts.map(async (artifact) => {
      const privacyState = getReportPrivacyState(report, artifact);
      const artifactExists = await getArtifactExists(input.storage, artifact);
      const deletionStatus = artifact.deletion_status ?? inferArtifactDeletionStatus(privacyState);
      const retryStatus = getReportVaultRetryStatus(privacyState, deletionStatus);

      return {
        report_id: report.id,
        workspace: workspace?.name ?? "Workspace metadata unavailable",
        format: artifact.format,
        privacy_state: privacyState,
        status: report.status,
        action: getReportVaultAction(privacyState),
        redacted_summary: createReportVaultSummary(report, privacyState),
        artifact_id: artifact.id.startsWith("virtual_") ? null : artifact.id,
        storage_uri: artifact.storage_uri,
        storage_key_short: artifact.storage_key ? shortenStorageKey(artifact.storage_key) : null,
        artifact_exists: artifactExists,
        checksum: artifact.checksum,
        size_bytes: artifact.size_bytes,
        deletion_status: deletionStatus,
        deletion_attempts: artifact.deletion_attempts ?? 0,
        last_deletion_error: artifact.last_deletion_error ?? null,
        retry_status: retryStatus,
        generated_at: report.generated_at,
        deletion_note: getReportVaultDeletionNote(artifact, artifactExists)
      };
    }));
    const rawLockedRow = {
      report_id: report.id,
      workspace: workspace?.name ?? "Workspace metadata unavailable",
      format: "json" as const,
      privacy_state: "raw_locked" as const,
      status: report.status,
      action: "request_sudo_for_raw" as const,
      redacted_summary: "Raw report content is locked; request sudo with reason before any reveal workflow.",
      artifact_id: null,
      storage_uri: null,
      storage_key_short: null,
      artifact_exists: false,
      checksum: null,
      size_bytes: null,
      deletion_status: "active" as const,
      deletion_attempts: 0,
      last_deletion_error: null,
      retry_status: "blocked" as const,
      generated_at: report.generated_at,
      deletion_note: null
    };

    return [...artifactRows, rawLockedRow];
  }));
  const rows = rowGroups.flat();

  return {
    reports: rows,
    summary: {
      ready_redacted: rows.filter((row) => row.privacy_state === "ready_redacted").length,
      raw_locked: rows.filter((row) => row.privacy_state === "raw_locked").length,
      failed_export: rows.filter((row) => row.privacy_state === "failed_export").length,
      deletion_pending: rows.filter((row) => row.privacy_state === "deletion_pending").length,
      deleted: rows.filter((row) => row.privacy_state === "deleted").length
    },
    notes: [
      "Reports vault returns redacted metadata by default; raw report reveal remains sudo-gated.",
      "Retry and regenerate export actions use the existing eval snapshot and do not rerun evals.",
      "Artifact existence, checksum, deletion state, attempts, and retry status come from storage-backed metadata."
    ]
  };
}

function createVirtualReportArtifact(
  report: RecommendationReport,
  format: ReportArtifact["format"]
): ReportArtifact {
  return {
    id: `virtual_${report.id}_${format}`,
    report_id: report.id,
    workspace_id: null,
    project_id: report.project_id,
    format,
    privacy_state: "failed_export",
    storage_key: `reports/${report.id}/${format}`,
    storage_uri: `memory://reports/${report.id}/${format}`,
    checksum: null,
    size_bytes: null,
    redaction_state: "redacted",
    deleted_at: null,
    deletion_status: "failed",
    deletion_attempts: 0,
    last_deletion_error: "No persisted artifact metadata exists.",
    is_mock: true,
    created_at: report.created_at
  };
}

function getReportPrivacyState(
  report: RecommendationReport,
  artifact: ReportArtifact
) {
  if ((artifact.deletion_status ?? "active") === "deleted" || artifact.privacy_state === "deleted") {
    return "deleted" as const;
  }

  if (
    (artifact.deletion_status ?? "active") === "delete_requested" ||
    artifact.privacy_state === "deletion_pending" ||
    report.production_blockers.some((blocker) => blocker.toLowerCase().includes("deletion pending"))
  ) {
    return "deletion_pending" as const;
  }

  if ((artifact.deletion_status ?? "active") === "failed" || artifact.checksum === null || artifact.size_bytes === null) {
    return "failed_export" as const;
  }

  return "ready_redacted" as const;
}

function inferArtifactDeletionStatus(
  privacyState: ReturnType<typeof getReportPrivacyState>
): NonNullable<ReportArtifact["deletion_status"]> {
  if (privacyState === "deleted") {
    return "deleted";
  }

  if (privacyState === "deletion_pending") {
    return "delete_requested";
  }

  if (privacyState === "failed_export") {
    return "failed";
  }

  return "active";
}

function getReportVaultRetryStatus(
  privacyState: ReturnType<typeof getReportPrivacyState>,
  deletionStatus: NonNullable<ReportArtifact["deletion_status"]>
) {
  if (privacyState === "failed_export" || deletionStatus === "failed") {
    return "retry_available" as const;
  }

  if (deletionStatus === "delete_requested") {
    return "retrying" as const;
  }

  if (privacyState === "deleted") {
    return "blocked" as const;
  }

  return "not_needed" as const;
}

async function getArtifactExists(
  storage: ReportArtifactStorage,
  artifact: ReportArtifact
): Promise<boolean> {
  if (artifact.id.startsWith("virtual_") || (artifact.deletion_status ?? "active") === "deleted") {
    return false;
  }

  return storage.objectExists(artifact.storage_key ?? artifact.storage_uri).catch(() => false);
}

function shortenStorageKey(storageKey: string): string {
  const parts = storageKey.split("/");
  return parts.length > 2 ? `${parts[0]}/.../${parts.at(-1)}` : storageKey;
}

function getReportVaultDeletionNote(
  artifact: ReportArtifact,
  artifactExists: boolean
): string | null {
  if ((artifact.deletion_status ?? "active") === "deleted") {
    return artifactExists
      ? "Deleted DB state exists, but the object still appears present; retry deletion."
      : "Object content deleted; checksum and size remain as deletion evidence.";
  }

  if ((artifact.deletion_status ?? "active") === "failed") {
    return artifact.last_deletion_error ?? "Export or deletion failed; retry is available.";
  }

  if ((artifact.deletion_status ?? "active") === "delete_requested") {
    return "Deletion is pending or retrying; object content is not considered safe until completion.";
  }

  return null;
}

function getReportVaultAction(privacyState: ReturnType<typeof getReportPrivacyState> | "raw_locked") {
  switch (privacyState) {
    case "failed_export":
      return "retry_export" as const;
    case "deletion_pending":
      return "approve_deletion" as const;
    case "deleted":
      return "open_redacted" as const;
    case "raw_locked":
      return "request_sudo_for_raw" as const;
    case "ready_redacted":
      return "open_redacted" as const;
  }
}

function createReportVaultSummary(report: RecommendationReport, privacyState: ReturnType<typeof getReportPrivacyState>): string {
  if (privacyState === "failed_export") {
    return "Export artifact failed checksum/size confirmation; retry export is available.";
  }

  if (privacyState === "deleted") {
    return "Report artifact is marked deleted in memory; raw content is unavailable.";
  }

  if (privacyState === "deletion_pending") {
    return "Deletion has been requested and needs final approval.";
  }

  return report.production_recommendation_allowed
    ? "Redacted report metadata shows an eval-backed recommendation exists."
    : "Redacted report metadata shows production recommendation is blocked or pending.";
}

async function retryReportExport(
  repository: ApiEnv["Variables"]["repository"],
  storage: ReportArtifactStorage,
  report: RecommendationReport,
  reasonCode: string
): Promise<ReportArtifact[]> {
  return regenerateReportExports(repository, storage, report, reasonCode);
}

async function regenerateReportExports(
  repository: ApiEnv["Variables"]["repository"],
  storage: ReportArtifactStorage,
  report: RecommendationReport,
  reasonCode: string
): Promise<ReportArtifact[]> {
  const evalRun = await repository.eval_runs.get(report.eval_run_id);
  if (!evalRun) {
    return writeFallbackReportArtifact(repository, storage, report, reasonCode);
  }

  const [results, testCases] = await Promise.all([
    repository.eval_results.list(),
    repository.test_cases.list()
  ]);
  const evalResults = results.filter((result) => result.eval_run_id === evalRun.id);
  const contractTestCases = testCases.filter(
    (testCase) => testCase.quality_contract_id === evalRun.quality_contract_id
  );
  const decision = decideRecommendation({
    evalRunId: evalRun.id,
    results: evalResults,
    passThreshold: evalRun.pass_threshold,
    testCaseCount: contractTestCases.length
  });
  const project = await repository.projects.get(report.project_id);
  if (!project) {
    return writeFallbackReportArtifact(repository, storage, report, reasonCode);
  }
  const generated = generateReportArtifacts({ report, evalRun, results: evalResults, decision });

  return persistGeneratedReportArtifacts({
    repository,
    storage,
    report,
    project,
    generated,
    reasonCode
  });
}

async function writeFallbackReportArtifact(
  repository: ApiEnv["Variables"]["repository"],
  storage: ReportArtifactStorage,
  report: RecommendationReport,
  reasonCode: string
): Promise<ReportArtifact[]> {
  const project = await repository.projects.get(report.project_id);
  const timestamp = nowIso();
  const stored = await storage.putObject({
    reportId: report.id,
    artifactId: `report_artifact_${report.id}_json`,
    format: "json",
    content: JSON.stringify(
      {
        report_id: report.id,
        redaction_state: "redacted",
        reason_code: reasonCode,
        note: "Fallback redacted report artifact generated without rerunning evals."
      },
      null,
      2
    ),
    contentType: "application/json",
    redactionState: "redacted",
    createdAt: timestamp
  });
  const artifact: ReportArtifact = {
    id: `report_artifact_${report.id}_json`,
    report_id: report.id,
    workspace_id: project?.workspace_id ?? null,
    project_id: project?.id ?? report.project_id,
    format: "json",
    privacy_state: "ready_redacted",
    storage_key: stored.storage_key,
    storage_uri: stored.storage_uri,
    checksum: stored.checksum,
    size_bytes: stored.size_bytes,
    redaction_state: "redacted",
    deleted_at: null,
    deletion_status: "active",
    deletion_attempts: 0,
    last_deletion_error: null,
    is_mock: report.is_mock,
    created_at: timestamp
  };
  const existing = (await repository.report_artifacts.list()).find(
    (item) => item.report_id === report.id && item.format === "json"
  );

  if (!existing) {
    return [await repository.report_artifacts.create(artifact)];
  }

  const { id: _id, ...patch } = artifact;
  const updated = await repository.report_artifacts.update(existing.id, patch);
  return updated ? [updated] : [];
}

async function markReportDeleted(input: {
  repository: ApiEnv["Variables"]["repository"];
  storage: ReportArtifactStorage;
  report: RecommendationReport;
  reasonCode: string;
  adminUserId: string;
  session: ApiEnv["Variables"]["adminSession"];
  sudoRequestId: string | null;
}): Promise<{ artifactsDeleted: number; artifactFailures: number; scopedRecordsMarked: string[] }> {
  const { repository, storage, report, reasonCode, adminUserId, session, sudoRequestId } = input;
  const artifacts = (await repository.report_artifacts.list()).filter(
    (artifact) => artifact.report_id === report.id
  );
  const timestamp = nowIso();
  const deletionRequest: DeletionRequest = {
    id: createId("deletion_request"),
    target_type: "reports",
    target_id: report.id,
    requested_by: adminUserId,
    verified_by: adminUserId,
    status: "processing",
    reason_code: reasonCode,
    created_at: timestamp,
    completed_at: null
  };

  await repository.deletion_requests.create(deletionRequest);
  await writeReportDeletionAudit(repository, session, {
    action: "report_deletion_requested",
    reasonCode,
    targetId: report.id,
    sudoRequestId,
    metadata: {
      deletion_request_id: deletionRequest.id,
      artifact_count: artifacts.length
    }
  });

  await repository.reports.update(report.id, {
    deleted_at: null,
    delete_requested_by_user_id: adminUserId,
    delete_reason_code: reasonCode,
    retention_state: "delete_requested",
    production_blockers: Array.from(new Set([
      ...report.production_blockers,
      `deletion pending: ${reasonCode}`
    ])),
    updated_at: timestamp
  });

  let artifactsDeleted = 0;
  let artifactFailures = 0;

  for (const artifact of artifacts) {
    const attempts = (artifact.deletion_attempts ?? 0) + 1;
    await repository.report_artifacts.update(artifact.id, {
      privacy_state: "deletion_pending",
      deletion_status: "delete_requested",
      deletion_attempts: attempts,
      last_deletion_error: null
    });
    await writeReportDeletionAudit(repository, session, {
      action: "report_artifact_delete_started",
      reasonCode,
      targetId: artifact.id,
      sudoRequestId,
      metadata: {
        report_id: report.id,
        storage_key: artifact.storage_key ? shortenStorageKey(artifact.storage_key) : null,
        attempt: attempts
      }
    });

    const deletionResult = await storage
      .deleteObject(artifact.storage_key ?? artifact.storage_uri, {
        reasonCode,
        deletedAt: timestamp
      })
      .catch((error: unknown) => ({
        error: error instanceof Error ? error.message : String(error)
      }));

    if (!deletionResult || "error" in deletionResult) {
      artifactFailures += 1;
      const failureMessage =
        deletionResult && "error" in deletionResult
          ? deletionResult.error
          : "Object was missing or could not be deleted.";
      await repository.report_artifacts.update(artifact.id, {
        privacy_state: "failed_export",
        deletion_status: "failed",
        deletion_attempts: attempts,
        last_deletion_error: failureMessage
      });
      await writeReportDeletionAudit(repository, session, {
        action: "report_artifact_delete_failed",
        reasonCode,
        targetId: artifact.id,
        sudoRequestId,
        metadata: {
          report_id: report.id,
          error: failureMessage,
          retryable: true
        }
      });
      continue;
    }

    await repository.report_artifacts.update(artifact.id, {
      privacy_state: "deleted",
      deleted_at: deletionResult.deleted_at,
      deletion_status: "deleted",
      deletion_attempts: attempts,
      last_deletion_error: null,
      redaction_state: "redacted"
    });
    await writeReportDeletionAudit(repository, session, {
      action: "report_artifact_deleted",
      reasonCode,
      targetId: artifact.id,
      sudoRequestId,
      metadata: {
        report_id: report.id,
        storage_key: artifact.storage_key ? shortenStorageKey(artifact.storage_key) : null,
        checksum_retained: Boolean(artifact.checksum)
      }
    });
    artifactsDeleted += 1;
  }

  const finalStatus = artifactFailures > 0 ? "failed" : "completed";
  await repository.deletion_requests.update(deletionRequest.id, {
    status: finalStatus,
    completed_at: artifactFailures > 0 ? null : timestamp
  });
  await repository.reports.update(report.id, {
    deleted_at: artifactFailures > 0 ? null : timestamp,
    retention_state: artifactFailures > 0 ? "delete_requested" : "deleted",
    production_blockers: Array.from(new Set([
      ...report.production_blockers,
      artifactFailures > 0
        ? `deletion partial failure: ${reasonCode}`
        : `deletion completed: ${reasonCode}`
    ])),
    updated_at: timestamp
  });
  await writeReportDeletionAudit(repository, session, {
    action: artifactFailures > 0 ? "report_deletion_failed" : "report_deletion_completed",
    reasonCode,
    targetId: report.id,
    sudoRequestId,
    metadata: {
      deletion_request_id: deletionRequest.id,
      artifacts_deleted: artifactsDeleted,
      artifact_failures: artifactFailures
    }
  });

  return {
    artifactsDeleted,
    artifactFailures,
    scopedRecordsMarked: [
      "deletion_requests.status",
      "reports.retention_state",
      "reports.deleted_at",
      "report_artifacts.deletion_status",
      "report_artifacts.deleted_at",
      "object_storage.artifacts"
    ]
  };
}

async function writeReportDeletionAudit(
  repository: ApiEnv["Variables"]["repository"],
  session: ApiEnv["Variables"]["adminSession"],
  input: {
    action: string;
    reasonCode: string;
    targetId: string;
    sudoRequestId: string | null;
    metadata: Record<string, unknown>;
  }
): Promise<void> {
  await writeAdminSecurityAuditEvent(repository, {
    session,
    action: input.action,
    actionScope: "delete_report",
    targetType: "reports",
    targetId: input.targetId,
    reasonCode: input.reasonCode,
    sudoRequestId: input.sudoRequestId,
    metadata: input.metadata
  });
}


export { createAdminReportsVault, markReportDeleted, regenerateReportExports, retryReportExport };
