import {
  z,
  accountSchema,
  accountStageSchema,
  adminAuditLogSchema,
  adminActionScopeSchema,
  billingEventSchema,
  contactSchema,
  creditSchema,
  crmNoteSchema,
  entitlementFeatureSchema,
  entitlementSchema,
  evalRunSchema,
  featureFlagSchema,
  invoiceSchema,
  modelRegistryRecordSchema,
  modelRegistryVersionSchema,
  opportunitySchema,
  planSchema,
  promptProjectSchema,
  promptSchema,
  promptVersionSchema,
  providerConnectionSchema,
  qualityCheckDefinitionSchema,
  qualityContractSchema,
  recommendationReportSchema,
  reportArtifactFormatSchema,
  reportArtifactSchema,
  sudoRequestSchema,
  taskTypeSchema,
  taskSchema,
  testCaseSchema,
  usageLedgerEntrySchema,
  userSchema,
  workspaceSchema,
  auditRequestSchema,
  auditResponseSchema,
  candidateStrategySchema,
  evalResultSchema,
  costEstimateStatusSchema,
  idSchema,
  isoDateTimeSchema,
  modelFitSchema,
  metadataSchema,
  providerSchema,
  nonEmptyStringSchema,
  requireAtLeastOneField
} from './common';

const modelRegistryDiffEntrySchema = z
  .object({
    field: nonEmptyStringSchema,
    before: z.unknown(),
    after: z.unknown()
  })
  .strict();

const adminModelRegistryRowSchema = z
  .object({
    id: idSchema,
    provider: providerSchema,
    model_id: nonEmptyStringSchema,
    display_name: nonEmptyStringSchema,
    input_price_per_million_tokens: z.number().nonnegative(),
    output_price_per_million_tokens: z.number().nonnegative(),
    cached_input_price_per_million_tokens: z.number().nonnegative().nullable(),
    context_window: z.number().int().positive(),
    max_output_tokens: z.number().int().positive(),
    capabilities: z
      .object({
        text: z.boolean(),
        image: z.boolean(),
        audio: z.boolean(),
        video: z.boolean(),
        tools: z.boolean(),
        structured_output: z.boolean()
      })
      .strict(),
    stability_status: z.enum(["stable", "preview", "latest", "experimental", "deprecated", "unverified"]),
    freshness_status: z.enum(["fresh", "stale", "unverified", "deprecated", "preview", "experimental", "demo_unverified"]),
    recommended_task_types: z.array(taskTypeSchema),
    source_url: z.string().url().nullable(),
    last_verified_at: isoDateTimeSchema.nullable(),
    verified_by: nonEmptyStringSchema.nullable(),
    approval_state: z.enum(["draft", "pending_review", "approved", "rejected", "superseded"]),
    approved_by_admin_user_id: idSchema.nullable(),
    approved_at: isoDateTimeSchema.nullable(),
    pricing_note: nonEmptyStringSchema,
    active_for_public_recommendations: z.boolean(),
    pending_version_id: idSchema.nullable()
  })
  .strict();

export const adminModelRegistryResponseSchema = z
  .object({
    freshness_summary: z
      .object({
        fresh: z.number().int().nonnegative(),
        stale: z.number().int().nonnegative(),
        deprecated: z.number().int().nonnegative(),
        preview: z.number().int().nonnegative(),
        experimental: z.number().int().nonnegative(),
        demo_unverified: z.number().int().nonnegative(),
        preview_experimental: z.number().int().nonnegative(),
        unverified: z.number().int().nonnegative()
      })
      .strict(),
    models: z.array(adminModelRegistryRowSchema),
    freshness_review_queue: z.array(
      z
        .object({
          id: idSchema,
          model_registry_id: idSchema,
          model_id: nonEmptyStringSchema,
          display_name: nonEmptyStringSchema,
          provider: providerSchema,
          freshness_status: z.enum(["fresh", "stale", "unverified", "deprecated", "preview", "experimental", "demo_unverified"]),
          approval_state: z.enum(["draft", "pending_review", "approved", "rejected", "superseded"]),
          severity: z.enum(["low", "medium", "high", "critical"]),
          reason: nonEmptyStringSchema,
          source_url: z.string().url().nullable(),
          last_verified_at: isoDateTimeSchema.nullable(),
          verified_by: nonEmptyStringSchema.nullable()
        })
        .strict()
    ),
    proposed_changes: z.array(
      z
        .object({
          version: modelRegistryVersionSchema,
          model_id: nonEmptyStringSchema,
          display_name: nonEmptyStringSchema,
          diff: z.array(modelRegistryDiffEntrySchema),
          approval_actions: z
            .object({
              approve_enabled: z.boolean(),
              reject_enabled: z.boolean(),
              note: nonEmptyStringSchema
            })
            .strict()
        })
        .strict()
    ),
    registry_note: nonEmptyStringSchema
  })
  .strict();
export type AdminModelRegistryResponse = z.infer<typeof adminModelRegistryResponseSchema>;

export const modelPatchResponseSchema = z
  .object({
    model: modelRegistryRecordSchema,
    proposal: modelRegistryVersionSchema,
    diff: z.array(modelRegistryDiffEntrySchema),
    todo: nonEmptyStringSchema
  })
  .strict();
export type ModelPatchResponse = z.infer<typeof modelPatchResponseSchema>;

export const modelApproveResponseSchema = z
  .object({
    model: modelRegistryRecordSchema,
    approved_version: modelRegistryVersionSchema,
    diff: z.array(modelRegistryDiffEntrySchema),
    registry_note: nonEmptyStringSchema
  })
  .strict();
export type ModelApproveResponse = z.infer<typeof modelApproveResponseSchema>;

export const modelRejectResponseSchema = z
  .object({
    rejected_version: modelRegistryVersionSchema,
    registry_note: nonEmptyStringSchema
  })
  .strict();
export type ModelRejectResponse = z.infer<typeof modelRejectResponseSchema>;

const modelPatchBaseSchema = z
  .object({
    display_name: nonEmptyStringSchema.optional(),
    input_price_per_million_tokens: z.number().nonnegative().optional(),
    output_price_per_million_tokens: z.number().nonnegative().optional(),
    cached_input_price_per_million_tokens: z.number().nonnegative().nullable().optional(),
    context_window: z.number().int().positive().optional(),
    max_output_tokens: z.number().int().positive().optional(),
    supports_text: z.boolean().optional(),
    supports_image: z.boolean().optional(),
    supports_audio: z.boolean().optional(),
    supports_video: z.boolean().optional(),
    supports_tools: z.boolean().optional(),
    supports_structured_output: z.boolean().optional(),
    latency_tier: z.enum(["low", "standard", "high", "unknown"]).optional(),
    quality_tier: z.enum(["economy", "balanced", "frontier", "unknown"]).optional(),
    recommended_task_types: z.array(taskTypeSchema).optional(),
    stability_status: z
      .enum(["stable", "preview", "latest", "experimental", "deprecated", "unverified"])
      .optional(),
    freshness_status: z.enum(["fresh", "stale", "unverified", "deprecated", "preview", "experimental", "demo_unverified"]).optional(),
    source_url: z.string().url().optional(),
    last_verified_at: isoDateTimeSchema.optional(),
    verified_by: nonEmptyStringSchema.nullable().optional(),
    pricing_note: nonEmptyStringSchema.optional(),
    metadata: metadataSchema.optional()
  })
  .strict();

export const modelPatchRequestSchema = requireAtLeastOneField(modelPatchBaseSchema).superRefine(
  (value, context) => {
    const verifiedFields = [
      "input_price_per_million_tokens",
      "output_price_per_million_tokens",
      "cached_input_price_per_million_tokens",
      "context_window",
      "max_output_tokens",
      "supports_text",
      "supports_image",
      "supports_audio",
      "supports_video",
      "supports_tools",
      "supports_structured_output",
      "latency_tier",
      "quality_tier",
      "recommended_task_types",
      "stability_status",
      "freshness_status"
    ] as const;
    const changesVerifiedMetadata = verifiedFields.some((field) => field in value);

    if (!value.source_url) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Model registry changes require source_url"
      });
    }

    if (changesVerifiedMetadata && (!value.last_verified_at || !value.verified_by)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Model metadata edits require last_verified_at and verified_by"
      });
    }
  }
);
export type ModelPatchRequest = z.infer<typeof modelPatchRequestSchema>;

export const modelApproveRequestSchema = z
  .object({
    verified_by: nonEmptyStringSchema,
    source_url: z.string().url(),
    last_verified_at: isoDateTimeSchema,
    reason_code: nonEmptyStringSchema
  })
  .strict();
export type ModelApproveRequest = z.infer<typeof modelApproveRequestSchema>;

export const modelRejectRequestSchema = z
  .object({
    reason_code: nonEmptyStringSchema
  })
  .strict();
export type ModelRejectRequest = z.infer<typeof modelRejectRequestSchema>;
