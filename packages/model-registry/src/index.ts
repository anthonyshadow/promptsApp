import type {
  LatencyTier,
  ModelRegistryRecord,
  Priority,
  Provider,
  RegistryFreshness,
  StabilityStatus,
  TaskType
} from "@promptopts/shared";

export type ModelModality = "text" | "image" | "audio" | "video";
export type FailureCost = "low" | "medium" | "high";
export type ModelShortlistRole = "baseline" | "cheaper" | "balanced" | "fallback";

export type ModelCapabilityFilterInput = {
  models: ModelRegistryRecord[];
  provider?: Provider;
  taskType?: TaskType;
  promptTokenEstimate?: number;
  outputEstimate?: number;
  contextNeeds?: number | null;
  structuredOutput?: boolean;
  tools?: boolean;
  modality?: ModelModality;
  latencyTargetMs?: number | null;
  stability?: StabilityStatus[];
  supportsStructuredOutput?: boolean;
  supportsTools?: boolean;
};

export type ModelShortlistInput = Omit<ModelCapabilityFilterInput, "models"> & {
  models: ModelRegistryRecord[];
  provider: Provider;
  currentModelId: string;
  taskType: TaskType;
  promptTokenEstimate: number;
  outputEstimate: number;
  contextNeeds?: number | null;
  priority: Priority;
  failureCost: FailureCost;
};

export type RegistryFreshnessClassification = {
  freshness: RegistryFreshness;
  warnings: string[];
  exactSavingsAllowed: boolean;
  productionEligible: boolean;
};

export type ModelShortlistEntry = RegistryFreshnessClassification & {
  role: ModelShortlistRole;
  model: ModelRegistryRecord;
  reasons: string[];
};

export type ModelShortlistResult = {
  entries: ModelShortlistEntry[];
  rejected: Array<{
    model: ModelRegistryRecord;
    reasons: string[];
  }>;
  warnings: string[];
};

export const REGISTRY_FRESHNESS_REVIEW_DAYS = 30;

// Same-provider shortlist keeps the MVP implementable and uses registry rows as the only source of capability truth.
export function shortlistModels(input: ModelShortlistInput): ModelShortlistResult {
  const sameProvider = input.models.filter((model) => model.provider === input.provider);
  const baseline =
    sameProvider.find((model) => model.model_id === input.currentModelId || model.id === input.currentModelId) ??
    sameProvider[0];
  const capabilityResult = filterByCapabilityWithRejections({
    ...input,
    models: sameProvider
  });
  const capable = capabilityResult.models;
  const nonBaseline = capable.filter((model) => baseline && model.id !== baseline.id);
  const entries: ModelShortlistEntry[] = [];

  if (baseline) {
    entries.push(createShortlistEntry("baseline", baseline, explainModelRole("baseline", baseline, input, baseline)));
  }

  const cheaper = selectCheaperModel(nonBaseline, baseline);
  if (cheaper) {
    entries.push(createShortlistEntry("cheaper", cheaper, explainModelRole("cheaper", cheaper, input, baseline)));
  }

  const balanced = selectBalancedModel(nonBaseline, baseline, input.priority);
  if (balanced) {
    entries.push(createShortlistEntry("balanced", balanced, explainModelRole("balanced", balanced, input, baseline)));
  }

  const fallback = selectFallbackModel(capable, baseline, input.failureCost);
  if (fallback) {
    entries.push(createShortlistEntry("fallback", fallback, explainModelRole("fallback", fallback, input, baseline)));
  }

  return {
    entries,
    rejected: capabilityResult.rejected,
    warnings: buildShortlistWarnings(entries, capabilityResult.rejected)
  };
}

export function filterByCapability(input: ModelCapabilityFilterInput): ModelRegistryRecord[] {
  return filterByCapabilityWithRejections(input).models;
}

// Freshness controls savings language: demo, stale, or unverifiable rows cannot support exact savings claims.
export function classifyRegistryFreshness(
  record: ModelRegistryRecord,
  options: { now?: Date; reviewWindowDays?: number } = {}
): RegistryFreshnessClassification {
  const warnings: string[] = [];
  let freshness = record.freshness_status;
  const now = options.now ?? new Date();
  const reviewWindowDays = options.reviewWindowDays ?? REGISTRY_FRESHNESS_REVIEW_DAYS;

  if (record.stability_status === "deprecated" || record.freshness_status === "deprecated") {
    freshness = "deprecated";
    warnings.push("Deprecated registry row; preserve as baseline only.");
  }

  if (record.stability_status === "preview" || record.freshness_status === "preview") {
    freshness = "preview";
    warnings.push("Preview registry row; production recommendations prefer stable active metadata.");
  }

  if (record.stability_status === "experimental" || record.freshness_status === "experimental") {
    freshness = "experimental";
    warnings.push("Experimental registry row; exact savings claims are disabled.");
  }

  if (record.is_mock) {
    freshness = "demo_unverified";
    warnings.push("Demo registry row; exact savings claims are disabled.");
  }

  if (!record.source_url) {
    freshness = freshness === "demo_unverified" ? freshness : "unverified";
    warnings.push("Missing source URL; exact savings claims are disabled.");
  }

  if (!record.last_verified_at) {
    freshness = freshness === "demo_unverified" ? freshness : "unverified";
    warnings.push("Missing verification timestamp; exact savings claims are disabled.");
  } else if (isVerificationStale(record.last_verified_at, now, reviewWindowDays)) {
    freshness = freshness === "fresh" ? "stale" : freshness;
    warnings.push(`Registry verification is older than ${reviewWindowDays} days; review official docs before exact savings claims.`);
  }

  if (!record.verified_by) {
    freshness = freshness === "demo_unverified" ? freshness : "unverified";
    warnings.push("Missing verifier identity; exact savings claims are disabled.");
  }

  if (record.approval_state !== "approved") {
    freshness = freshness === "fresh" ? "unverified" : freshness;
    warnings.push(`Approval state is ${record.approval_state}; active public recommendations require approved metadata.`);
  }

  if (!record.approved_by_admin_user_id || !record.approved_at) {
    freshness = freshness === "fresh" ? "unverified" : freshness;
    warnings.push("Missing approval metadata; exact savings claims are disabled.");
  }

  if (record.freshness_status === "stale") {
    freshness = "stale";
    warnings.push("Registry metadata is stale; verify official docs before exact savings claims.");
  }

  if (record.stability_status !== "stable") {
    warnings.push(`Stability is ${record.stability_status}; stable models are preferred for production recommendations.`);
  }

  if (record.is_mock) {
    freshness = "demo_unverified";
  }

  const exactSavingsAllowed =
    freshness === "fresh" &&
    !record.is_mock &&
    Boolean(record.source_url) &&
    Boolean(record.last_verified_at) &&
    Boolean(record.verified_by) &&
    record.approval_state === "approved" &&
    Boolean(record.approved_by_admin_user_id) &&
    Boolean(record.approved_at);

  return {
    freshness,
    warnings,
    exactSavingsAllowed,
    productionEligible: exactSavingsAllowed && record.stability_status === "stable"
  };
}

// Role explanations are user-facing decision evidence, not decorative labels.
export function explainModelRole(
  role: ModelShortlistRole,
  model: ModelRegistryRecord,
  input: ModelShortlistInput,
  baseline?: ModelRegistryRecord
): string[] {
  const reasons: string[] = [];

  switch (role) {
    case "baseline":
      reasons.push("Current model remains the regression baseline.");
      break;
    case "cheaper":
      reasons.push(
        baseline && priceScore(model) < priceScore(baseline)
          ? "Lower registry token price than the current baseline."
          : "Lowest-cost capable same-provider option available."
      );
      break;
    case "balanced":
      reasons.push(
        model.quality_tier === "balanced"
          ? "Balanced quality tier for the selected task."
          : "Closest capable same-provider model for a balanced benchmark."
      );
      break;
    case "fallback":
      reasons.push(
        baseline && model.id === baseline.id
          ? "Current model is retained as the strong fallback."
          : "Higher-capability same-provider option for ambiguous or high-risk cases."
      );
      break;
  }

  if (model.recommended_task_types.includes(input.taskType)) {
    reasons.push(`Registry recommends this model for ${input.taskType}.`);
  }

  if (input.structuredOutput && model.supports_structured_output) {
    reasons.push("Supports structured output required by the project.");
  }

  if (input.tools && model.supports_tools) {
    reasons.push("Supports tool use required by the project.");
  }

  if (input.contextNeeds) {
    reasons.push(`Context window covers ${input.contextNeeds.toLocaleString()} required tokens.`);
  }

  return reasons;
}

function filterByCapabilityWithRejections(input: ModelCapabilityFilterInput): {
  models: ModelRegistryRecord[];
  rejected: Array<{ model: ModelRegistryRecord; reasons: string[] }>;
} {
  const rejected: Array<{ model: ModelRegistryRecord; reasons: string[] }> = [];
  const models = input.models.filter((model) => {
    const reasons = getCapabilityRejectReasons(model, input);

    if (reasons.length > 0) {
      rejected.push({ model, reasons });
      return false;
    }

    return true;
  });

  return { models, rejected };
}

function getCapabilityRejectReasons(
  model: ModelRegistryRecord,
  input: ModelCapabilityFilterInput
): string[] {
  const reasons: string[] = [];
  const contextNeeds = input.contextNeeds ?? (input.promptTokenEstimate ?? 0) + (input.outputEstimate ?? 0);

  if (input.provider && model.provider !== input.provider) {
    reasons.push("Different provider from same-provider MVP path.");
  }

  if (input.taskType && !model.recommended_task_types.includes(input.taskType)) {
    reasons.push(`Registry does not recommend this model for ${input.taskType}.`);
  }

  if (input.stability && input.stability.length > 0 && !input.stability.includes(model.stability_status)) {
    reasons.push(`Stability ${model.stability_status} is outside requested filter.`);
  }

  if (contextNeeds > 0 && model.context_window < contextNeeds) {
    reasons.push("Context window is smaller than prompt plus output needs.");
  }

  if (input.outputEstimate && model.max_output_tokens < input.outputEstimate) {
    reasons.push("Max output tokens are below the output estimate.");
  }

  if ((input.structuredOutput || input.supportsStructuredOutput) && !model.supports_structured_output) {
    reasons.push("Structured output support required.");
  }

  if ((input.tools || input.supportsTools) && !model.supports_tools) {
    reasons.push("Tool support required.");
  }

  if (input.modality && !supportsModality(model, input.modality)) {
    reasons.push(`${input.modality} modality support required.`);
  }

  return reasons;
}

function supportsModality(model: ModelRegistryRecord, modality: ModelModality): boolean {
  switch (modality) {
    case "text":
      return model.supports_text;
    case "image":
      return model.supports_image;
    case "audio":
      return model.supports_audio;
    case "video":
      return model.supports_video;
  }
}

function createShortlistEntry(
  role: ModelShortlistRole,
  model: ModelRegistryRecord,
  reasons: string[]
): ModelShortlistEntry {
  return {
    role,
    model,
    reasons,
    ...classifyRegistryFreshness(model)
  };
}

function selectCheaperModel(
  models: ModelRegistryRecord[],
  baseline: ModelRegistryRecord | undefined
): ModelRegistryRecord | undefined {
  const sorted = [...models].sort(sortByRegistryPreferenceThenPrice);

  if (!baseline) {
    return sorted[0];
  }

  return sorted.find((model) => priceScore(model) < priceScore(baseline)) ?? sorted[0];
}

function selectBalancedModel(
  models: ModelRegistryRecord[],
  baseline: ModelRegistryRecord | undefined,
  priority: Priority
): ModelRegistryRecord | undefined {
  const pool = models.length > 0 ? models : baseline ? [baseline] : [];
  const balanced = pool.filter((model) => model.quality_tier === "balanced");

  if (balanced.length > 0) {
    return [...balanced].sort(sortByRegistryPreferenceThenPrice)[0];
  }

  if (priority === "quality") {
    return [...pool].sort(sortByQualityThenRegistry)[0];
  }

  return [...pool].sort(sortByRegistryPreferenceThenPrice)[0];
}

function selectFallbackModel(
  models: ModelRegistryRecord[],
  baseline: ModelRegistryRecord | undefined,
  failureCost: FailureCost
): ModelRegistryRecord | undefined {
  const pool = models.length > 0 ? models : baseline ? [baseline] : [];

  if (failureCost === "high") {
    return [...pool].sort(sortByQualityThenRegistry)[0];
  }

  return [...pool].sort(sortByQualityThenRegistry)[0] ?? baseline;
}

function buildShortlistWarnings(
  entries: ModelShortlistEntry[],
  rejected: Array<{ model: ModelRegistryRecord; reasons: string[] }>
): string[] {
  const warnings = new Set<string>();

  for (const entry of entries) {
    for (const warning of entry.warnings) {
      warnings.add(warning);
    }
  }

  if (rejected.length > 0) {
    warnings.add(`${rejected.length} registry row${rejected.length === 1 ? "" : "s"} filtered by capability.`);
  }

  if (entries.some((entry) => !entry.exactSavingsAllowed)) {
    warnings.add("No exact savings claim is allowed for stale, preview, experimental, demo, or unverified registry rows.");
  }

  return Array.from(warnings);
}

function sortByRegistryPreferenceThenPrice(left: ModelRegistryRecord, right: ModelRegistryRecord): number {
  return registryPreferenceScore(right) - registryPreferenceScore(left) || priceScore(left) - priceScore(right);
}

function sortByQualityThenRegistry(left: ModelRegistryRecord, right: ModelRegistryRecord): number {
  return (
    qualityScore(right) - qualityScore(left) ||
    registryPreferenceScore(right) - registryPreferenceScore(left) ||
    priceScore(left) - priceScore(right)
  );
}

function registryPreferenceScore(model: ModelRegistryRecord): number {
  const stabilityScore = model.stability_status === "stable" ? 3 : model.stability_status === "deprecated" ? -3 : 0;
  const freshnessScore = classifyRegistryFreshness(model).productionEligible ? 3 : model.freshness_status === "fresh" ? 1 : 0;

  return stabilityScore + freshnessScore + latencyScore(model.latency_tier);
}

function qualityScore(model: ModelRegistryRecord): number {
  switch (model.quality_tier) {
    case "frontier":
      return 3;
    case "balanced":
      return 2;
    case "economy":
      return 1;
    case "unknown":
      return 0;
  }
}

function latencyScore(latencyTier: LatencyTier): number {
  switch (latencyTier) {
    case "low":
      return 2;
    case "standard":
      return 1;
    case "high":
    case "unknown":
      return 0;
  }
}

function priceScore(model: ModelRegistryRecord): number {
  return model.input_price_per_million_tokens + model.output_price_per_million_tokens;
}

function isVerificationStale(
  lastVerifiedAt: string,
  now: Date,
  reviewWindowDays: number
): boolean {
  const verifiedAt = new Date(lastVerifiedAt);

  if (Number.isNaN(verifiedAt.getTime())) {
    return true;
  }

  const maxAgeMs = reviewWindowDays * 24 * 60 * 60 * 1000;
  return now.getTime() - verifiedAt.getTime() > maxAgeMs;
}
