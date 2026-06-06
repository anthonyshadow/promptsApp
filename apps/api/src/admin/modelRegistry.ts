import { decideRecommendation } from "@promptopts/eval-core";
import { generateReportArtifacts, persistGeneratedReportArtifacts } from "@promptopts/report-generator";
import { redactProviderError, redactPromptPreview, writeAdminSecurityAuditEvent } from "@promptopts/admin-core";
import { classifyRegistryFreshness } from "@promptopts/model-registry";
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
  const healthByModelId = new Map(
    models.map((model) => [model.id, classifyRegistryFreshness(model)] as const)
  );
  const freshnessCounts = {
    fresh: 0,
    stale: 0,
    deprecated: 0,
    preview: 0,
    experimental: 0,
    demo_unverified: 0,
    preview_experimental: 0,
    unverified: 0
  };

  for (const model of models) {
    const health = healthByModelId.get(model.id);
    if (!health) {
      continue;
    }
    freshnessCounts[health.freshness] += 1;
    if (health.freshness === "preview" || health.freshness === "experimental") {
      freshnessCounts.preview_experimental += 1;
    }
  }

  return {
    freshness_summary: freshnessCounts,
    models: models.map((model) => {
      const pendingVersion =
        pendingVersions
          .filter((version) => version.model_registry_id === model.id)
          .sort((a, b) => b.version_number - a.version_number)
          .at(0) ?? null;
      const health = healthByModelId.get(model.id) ?? classifyRegistryFreshness(model);

      return {
        id: model.id,
        provider: model.provider,
        model_id: model.model_id,
        display_name: model.display_name,
        input_price_per_million_tokens: model.input_price_per_million_tokens,
        output_price_per_million_tokens: model.output_price_per_million_tokens,
        cached_input_price_per_million_tokens: model.cached_input_price_per_million_tokens,
        context_window: model.context_window,
        max_output_tokens: model.max_output_tokens,
        capabilities: {
          text: model.supports_text,
          image: model.supports_image,
          audio: model.supports_audio,
          video: model.supports_video,
          tools: model.supports_tools,
          structured_output: model.supports_structured_output
        },
        stability_status: model.stability_status,
        freshness_status: health.freshness,
        recommended_task_types: model.recommended_task_types,
        source_url: model.source_url,
        last_verified_at: model.last_verified_at,
        verified_by: model.verified_by,
        approval_state: model.approval_state,
        approved_by_admin_user_id: model.approved_by_admin_user_id,
        approved_at: model.approved_at,
        pricing_note: model.pricing_note,
        active_for_public_recommendations: health.productionEligible,
        pending_version_id: pendingVersion?.id ?? null
      };
    }),
    freshness_review_queue: models
      .map((model) => {
        const health = healthByModelId.get(model.id) ?? classifyRegistryFreshness(model);
        const firstWarning = health.warnings[0] ?? "Registry row needs review before exact savings claims.";

        return {
          id: `registry_review_${model.id}`,
          model_registry_id: model.id,
          model_id: model.model_id,
          display_name: model.display_name,
          provider: model.provider,
          freshness_status: health.freshness,
          approval_state: model.approval_state,
          severity: getRegistryReviewSeverity(health.freshness),
          reason: firstWarning,
          source_url: model.source_url,
          last_verified_at: model.last_verified_at,
          verified_by: model.verified_by
        };
      })
      .filter((item) => item.freshness_status !== "fresh" || item.approval_state !== "approved"),
    proposed_changes: pendingVersions.map((version) => {
      const model = models.find((item) => item.id === version.model_registry_id);

      return {
        version,
        model_id: model?.model_id ?? version.model_registry_id,
        display_name: model?.display_name ?? "Unknown model",
        diff: model ? createModelRegistryDiff(model, version) : [],
        approval_actions: {
          approve_enabled: Boolean(model),
          reject_enabled: Boolean(model),
          note: "Approve publishes active metadata; reject records review outcome without changing public recommendations."
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

function getRegistryReviewSeverity(
  freshness: ReturnType<typeof classifyRegistryFreshness>["freshness"]
): "low" | "medium" | "high" | "critical" {
  switch (freshness) {
    case "deprecated":
      return "medium";
    case "preview":
    case "experimental":
      return "medium";
    case "stale":
      return "high";
    case "demo_unverified":
    case "unverified":
      return "high";
    case "fresh":
      return "low";
  }
}


export { createAdminModelRegistryResponse, createModelRegistryDiff, nextModelRegistryVersionNumber, stripRegistryPatchMetadata };
