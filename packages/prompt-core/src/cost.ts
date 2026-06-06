import type { CostEstimateStatus, ModelRegistryRecord, MonthlyCostEstimate } from "@promptopts/shared";
import type { MonthlyCostInput } from "./types";

// Cost estimates must come from the registry row supplied by the caller, never from provider constants in this package.
export function estimateMonthlyCost(input: MonthlyCostInput): MonthlyCostEstimate {
  const record = input.modelRegistryRecord;

  if (!record) {
    return {
      estimatedMonthlyCostUsd: null,
      inputCostUsd: null,
      outputCostUsd: null,
      estimateStatus: "blocked",
      unverified: true,
      registryFreshness: "unverified",
      metadataWarnings: ["Selected model is not present in the model registry."],
      pricingNote: "No registry row is available, so cost cannot be estimated."
    };
  }

  const inputCostUsd = costForTokens(
    input.inputTokens,
    input.monthlyCalls,
    record.input_price_per_million_tokens
  );
  const outputCostUsd = costForTokens(
    input.outputTokens,
    input.monthlyCalls,
    record.output_price_per_million_tokens
  );
  const metadataWarnings = getRegistryWarnings(record);
  const estimateStatus: CostEstimateStatus = metadataWarnings.length > 0 ? "unverified" : "verified";

  return {
    estimatedMonthlyCostUsd: roundCurrency(inputCostUsd + outputCostUsd),
    inputCostUsd: roundCurrency(inputCostUsd),
    outputCostUsd: roundCurrency(outputCostUsd),
    estimateStatus,
    unverified: estimateStatus !== "verified",
    registryFreshness: record.freshness_status,
    metadataWarnings,
    pricingNote: record.pricing_note
  };
}

function costForTokens(tokensPerCall: number, monthlyCalls: number, pricePerMillionTokens: number): number {
  return (tokensPerCall * monthlyCalls * pricePerMillionTokens) / 1_000_000;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function getRegistryWarnings(record: ModelRegistryRecord): string[] {
  const warnings: string[] = [];

  if (record.is_mock) {
    warnings.push("Registry row is demo/mock metadata.");
  }

  if (record.freshness_status !== "fresh") {
    warnings.push(`Registry freshness is ${record.freshness_status}.`);
  }

  if (record.stability_status === "unverified" || record.stability_status === "deprecated") {
    warnings.push(`Model stability is ${record.stability_status}.`);
  }

  if (!record.source_url || !record.last_verified_at) {
    warnings.push("Pricing metadata lacks current source verification.");
  }

  return warnings;
}
