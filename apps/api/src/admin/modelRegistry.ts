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


export { createAdminModelRegistryResponse, createModelRegistryDiff, nextModelRegistryVersionNumber, stripRegistryPatchMetadata };
