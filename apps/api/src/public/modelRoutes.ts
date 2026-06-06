import { Hono } from "hono";
import { z } from "zod";
import {
  filterByCapability,
  type ModelCapabilityFilterInput,
  type ModelModality
} from "@promptopts/model-registry";
import {
  providerSchema,
  stabilityStatusSchema,
  taskTypeSchema
} from "@promptopts/shared";
import { modelsResponseSchema } from "../contracts";
import type { ApiEnv } from "../context";
import { validationProblem } from "../http";

const modelModalitySchema = z.enum(["text", "image", "audio", "video"]) satisfies z.ZodType<ModelModality>;
const booleanQuerySchema = z.enum(["true", "false"]).transform((value) => value === "true");

export function createPublicModelRoutes() {
  return new Hono<ApiEnv>().get("/models", async (c) => {
    const providerQuery = c.req.query("provider");
    const providerResult = providerQuery ? providerSchema.safeParse(providerQuery) : undefined;
    const taskTypeQuery = c.req.query("task_type") ?? c.req.query("taskType") ?? c.req.query("task");
    const taskTypeResult = taskTypeQuery ? taskTypeSchema.safeParse(taskTypeQuery) : undefined;
    const stabilityQuery = c.req.query("stability") ?? c.req.query("stability_status");
    const stabilityValues = stabilityQuery ? stabilityQuery.split(",").filter(Boolean) : [];
    const stabilityResults = stabilityValues.map((value) => stabilityStatusSchema.safeParse(value));
    const modalityQuery = c.req.query("modality");
    const modalityResult = modalityQuery ? modelModalitySchema.safeParse(modalityQuery) : undefined;
    const structuredQuery =
      c.req.query("supportsStructuredOutput") ?? c.req.query("supports_structured_output");
    const structuredResult = structuredQuery ? booleanQuerySchema.safeParse(structuredQuery) : undefined;
    const toolsQuery = c.req.query("supportsTools") ?? c.req.query("supports_tools");
    const toolsResult = toolsQuery ? booleanQuerySchema.safeParse(toolsQuery) : undefined;

    if (providerResult && !providerResult.success) {
      return validationProblem(c, providerResult.error);
    }
    if (taskTypeResult && !taskTypeResult.success) {
      return validationProblem(c, taskTypeResult.error);
    }
    for (const result of stabilityResults) {
      if (!result.success) {
        return validationProblem(c, result.error);
      }
    }
    if (modalityResult && !modalityResult.success) {
      return validationProblem(c, modalityResult.error);
    }
    if (structuredResult && !structuredResult.success) {
      return validationProblem(c, structuredResult.error);
    }
    if (toolsResult && !toolsResult.success) {
      return validationProblem(c, toolsResult.error);
    }

    const provider = providerResult?.data;
    const taskType = taskTypeResult?.data;
    const stabilityStatuses = stabilityValues.map((value) => stabilityStatusSchema.parse(value));
    const modelFilter: ModelCapabilityFilterInput = {
      models: await c.var.repository.model_registry.list(),
      stability: stabilityStatuses
    };

    if (provider) {
      modelFilter.provider = provider;
    }
    if (taskType) {
      modelFilter.taskType = taskType;
    }
    if (modalityResult?.data) {
      modelFilter.modality = modalityResult.data;
    }
    if (structuredResult?.data !== undefined) {
      modelFilter.supportsStructuredOutput = structuredResult.data;
    }
    if (toolsResult?.data !== undefined) {
      modelFilter.supportsTools = toolsResult.data;
    }

    const models = filterByCapability(modelFilter);

    return c.json(
      modelsResponseSchema.parse({
        models,
        registry_note:
          "Model metadata is served from the registry; demo rows are mock/unverified until approved."
      })
    );
  });
}
