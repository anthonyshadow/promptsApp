import type { ModelRegistryRecord } from "@promptopts/shared";
import type { ModelFitClassification, ModelFitInput } from "./types";

// Fit labels are a preflight signal only; they guide eval setup and must not become production recommendations.
export function classifyModelFit(input: ModelFitInput): ModelFitClassification {
  const record = input.modelRegistryRecord;

  if (!record) {
    return {
      fit: "underpowered",
      reasonCodes: ["registry_missing"]
    };
  }

  const capabilityReasons = getCapabilityGaps(record, input.constraints);

  if (capabilityReasons.length > 0) {
    return {
      fit: "underpowered",
      reasonCodes: capabilityReasons
    };
  }

  const requiredContext = input.promptAnalysis.approximateInputTokens + input.promptAnalysis.approximateOutputEstimate;

  if (record.context_window < requiredContext) {
    return {
      fit: "underpowered",
      reasonCodes: ["context_window_too_small"]
    };
  }

  if (record.max_output_tokens < input.promptAnalysis.approximateOutputEstimate) {
    return {
      fit: "underpowered",
      reasonCodes: ["max_output_too_small"]
    };
  }

  const isSimpleTask = ["support", "classification", "extraction"].includes(input.taskType);
  const isComplexTask = ["coding", "rag", "agent"].includes(input.taskType);

  if (
    record.quality_tier === "frontier" &&
    isSimpleTask &&
    input.promptAnalysis.approximateInputTokens < 1500
  ) {
    return {
      fit: "overpowered",
      reasonCodes: ["frontier_model_for_bounded_task", "same_provider_benchmark_recommended"]
    };
  }

  if (record.quality_tier === "economy" && (isComplexTask || input.priority === "quality")) {
    return {
      fit: "underpowered",
      reasonCodes: ["economy_model_for_high_risk_task"]
    };
  }

  return {
    fit: "appropriate",
    reasonCodes: ["registry_capabilities_match_current_constraints"]
  };
}

function getCapabilityGaps(record: ModelRegistryRecord, constraints: ModelFitInput["constraints"]): string[] {
  const gaps: string[] = [];

  if (constraints.usesImages && !record.supports_image) {
    gaps.push("image_input_not_supported");
  }

  if (constraints.usesTools && !record.supports_tools) {
    gaps.push("tool_use_not_supported");
  }

  if ((constraints.requiresJson || constraints.needsStructuredOutput) && !record.supports_structured_output) {
    gaps.push("structured_output_not_supported");
  }

  if (constraints.minContextWindow && record.context_window < constraints.minContextWindow) {
    gaps.push("minimum_context_not_met");
  }

  return gaps;
}
