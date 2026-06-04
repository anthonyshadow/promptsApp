import { z } from "zod";
import {
  accountSchema,
  adminAuditLogSchema,
  adminActionScopeSchema,
  contactSchema,
  entitlementFeatureSchema,
  entitlementSchema,
  evalRunSchema,
  modelRegistryRecordSchema,
  opportunitySchema,
  promptProjectSchema,
  promptSchema,
  promptVersionSchema,
  qualityContractSchema,
  recommendationReportSchema,
  reportArtifactFormatSchema,
  reportArtifactSchema,
  taskTypeSchema,
  testCaseSchema,
  usageLedgerEntrySchema,
  userSchema,
  workspaceSchema,
  auditRequestSchema,
  auditResponseSchema,
  candidateStrategySchema,
  evalResultSchema,
  idSchema,
  isoDateTimeSchema,
  metadataSchema,
  providerSchema
} from "@promptopts/shared";

const nonEmptyStringSchema = z.string().min(1);

function requireAtLeastOneField<TSchema extends z.ZodRawShape>(schema: z.ZodObject<TSchema>) {
  return schema.refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required"
  });
}

export const errorResponseSchema = z
  .object({
    error: z
      .object({
        code: nonEmptyStringSchema,
        message: nonEmptyStringSchema,
        details: z.unknown().optional()
      })
      .strict()
  })
  .strict();
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export const modelsResponseSchema = z
  .object({
    models: z.array(modelRegistryRecordSchema),
    registry_note: nonEmptyStringSchema
  })
  .strict();
export type ModelsResponse = z.infer<typeof modelsResponseSchema>;
export type AuditRequest = z.infer<typeof auditRequestSchema>;
export type AuditResponse = z.infer<typeof auditResponseSchema>;

export const promptCreateRequestSchema = z
  .object({
    workspace_id: idSchema,
    name: nonEmptyStringSchema,
    task_type: taskTypeSchema,
    provider: providerSchema,
    model_id: nonEmptyStringSchema,
    prompt_text: nonEmptyStringSchema,
    variables: z.array(nonEmptyStringSchema)
  })
  .strict();
export type PromptCreateRequest = z.infer<typeof promptCreateRequestSchema>;

export const promptCreateResponseSchema = z
  .object({
    project: promptProjectSchema,
    prompt: promptSchema,
    version: promptVersionSchema
  })
  .strict();
export type PromptCreateResponse = z.infer<typeof promptCreateResponseSchema>;

export const promptOptimizeRequestSchema = z
  .object({
    analysis_id: idSchema.nullable(),
    strategies: z.array(candidateStrategySchema).min(1)
  })
  .strict();
export type PromptOptimizeRequest = z.infer<typeof promptOptimizeRequestSchema>;

export const promptOptimizeResponseSchema = z
  .object({
    candidates: z.array(z.object({
      id: idSchema,
      prompt_version_id: idSchema,
      analysis_id: idSchema.nullable(),
      strategy: candidateStrategySchema,
      candidate_prompt_text: nonEmptyStringSchema,
      rationale: nonEmptyStringSchema,
      risk_level: z.enum(["low", "medium", "high", "critical"]),
      expected_token_delta: z.number(),
      is_baseline: z.boolean(),
      is_mock: z.boolean(),
      created_at: isoDateTimeSchema
    }).strict()),
    todo: nonEmptyStringSchema
  })
  .strict();
export type PromptOptimizeResponse = z.infer<typeof promptOptimizeResponseSchema>;

export const evalRunCreateRequestSchema = evalRunSchema
  .pick({
    project_id: true,
    quality_contract_id: true,
    baseline_prompt_version_id: true,
    candidate_ids: true,
    model_registry_record_ids: true,
    pass_threshold: true
  })
  .strict();
export type EvalRunCreateRequest = z.infer<typeof evalRunCreateRequestSchema>;

export const evalRunDetailResponseSchema = z
  .object({
    eval_run: evalRunSchema,
    results: z.array(evalResultSchema),
    todo: nonEmptyStringSchema
  })
  .strict();
export type EvalRunDetailResponse = z.infer<typeof evalRunDetailResponseSchema>;

export const reportCreateRequestSchema = z
  .object({
    project_id: idSchema,
    eval_run_id: idSchema
  })
  .strict();
export type ReportCreateRequest = z.infer<typeof reportCreateRequestSchema>;

export const reportExportResponseSchema = z
  .object({
    report: recommendationReportSchema,
    artifacts: z.array(reportArtifactSchema),
    export_package: z
      .object({
        format: reportArtifactFormatSchema,
        download_url: nonEmptyStringSchema,
        redaction_state: z.enum(["redacted", "revealed", "not_sensitive"]),
        todo: nonEmptyStringSchema
      })
      .strict()
  })
  .strict();
export type ReportExportResponse = z.infer<typeof reportExportResponseSchema>;

export const adminOverviewResponseSchema = z
  .object({
    kpis: z
      .object({
        accounts: z.number().int().nonnegative(),
        eval_runs: z.number().int().nonnegative(),
        reports: z.number().int().nonnegative(),
        unverified_models: z.number().int().nonnegative()
      })
      .strict(),
    live_risks: z.array(nonEmptyStringSchema),
    system_health: z
      .object({
        api: z.literal("ok"),
        repository: z.literal("memory"),
        admin_auth: z.literal("mocked")
      })
      .strict()
  })
  .strict();
export type AdminOverviewResponse = z.infer<typeof adminOverviewResponseSchema>;

export const adminAccountsResponseSchema = z
  .object({
    accounts: z.array(accountSchema)
  })
  .strict();
export type AdminAccountsResponse = z.infer<typeof adminAccountsResponseSchema>;

export const accountCreateRequestSchema = z
  .object({
    name: nonEmptyStringSchema,
    workspace_id: idSchema.nullable(),
    stage: z.enum(["free_audit", "trial", "qualified", "customer", "churned", "internal"]),
    owner_admin_user_id: idSchema.nullable(),
    domain: nonEmptyStringSchema.nullable(),
    redacted_prompt_preview: nonEmptyStringSchema.nullable()
  })
  .strict();
export type AccountCreateRequest = z.infer<typeof accountCreateRequestSchema>;

export const accountPatchRequestSchema = requireAtLeastOneField(
  z
    .object({
      name: nonEmptyStringSchema.optional(),
      workspace_id: idSchema.nullable().optional(),
      stage: z
        .enum(["free_audit", "trial", "qualified", "customer", "churned", "internal"])
        .optional(),
      owner_admin_user_id: idSchema.nullable().optional(),
      domain: nonEmptyStringSchema.nullable().optional(),
      redacted_prompt_preview: nonEmptyStringSchema.nullable().optional()
    })
    .strict()
);
export type AccountPatchRequest = z.infer<typeof accountPatchRequestSchema>;

export const adminAccountDetailResponseSchema = z
  .object({
    account: accountSchema,
    contacts: z.array(contactSchema),
    opportunities: z.array(opportunitySchema)
  })
  .strict();
export type AdminAccountDetailResponse = z.infer<typeof adminAccountDetailResponseSchema>;

export const adminUsersResponseSchema = z
  .object({
    users: z.array(userSchema)
  })
  .strict();
export type AdminUsersResponse = z.infer<typeof adminUsersResponseSchema>;

export const adminReasonRequestSchema = z
  .object({
    reason_code: nonEmptyStringSchema
  })
  .strict();
export type AdminReasonRequest = z.infer<typeof adminReasonRequestSchema>;

export const revokeSessionsResponseSchema = z
  .object({
    user_id: idSchema,
    revoked_sessions: z.number().int().nonnegative(),
    todo: nonEmptyStringSchema
  })
  .strict();
export type RevokeSessionsResponse = z.infer<typeof revokeSessionsResponseSchema>;

export const impersonationResponseSchema = z
  .object({
    user_id: idSchema,
    impersonation_started: z.boolean(),
    todo: nonEmptyStringSchema
  })
  .strict();
export type ImpersonationResponse = z.infer<typeof impersonationResponseSchema>;

export const promptRevealResponseSchema = z
  .object({
    prompt_id: idSchema,
    redacted_preview: nonEmptyStringSchema,
    raw_prompt: z.null(),
    todo: nonEmptyStringSchema
  })
  .strict();
export type PromptRevealResponse = z.infer<typeof promptRevealResponseSchema>;

export const breakGlassResponseSchema = z
  .object({
    break_glass_started: z.boolean(),
    todo: nonEmptyStringSchema
  })
  .strict();
export type BreakGlassResponse = z.infer<typeof breakGlassResponseSchema>;

export const workspacePatchRequestSchema = requireAtLeastOneField(
  z
    .object({
      name: nonEmptyStringSchema.optional(),
      slug: nonEmptyStringSchema.optional()
    })
    .strict()
);
export type WorkspacePatchRequest = z.infer<typeof workspacePatchRequestSchema>;

export const adminEvalRunsResponseSchema = z
  .object({
    eval_runs: z.array(evalRunSchema)
  })
  .strict();
export type AdminEvalRunsResponse = z.infer<typeof adminEvalRunsResponseSchema>;

export const evalRunActionResponseSchema = z
  .object({
    eval_run: evalRunSchema,
    todo: nonEmptyStringSchema
  })
  .strict();
export type EvalRunActionResponse = z.infer<typeof evalRunActionResponseSchema>;

export const regenerateReportResponseSchema = z
  .object({
    report: recommendationReportSchema,
    todo: nonEmptyStringSchema
  })
  .strict();
export type RegenerateReportResponse = z.infer<typeof regenerateReportResponseSchema>;

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
    freshness_status: z.enum(["fresh", "stale", "unverified", "deprecated"]).optional(),
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

    if (changesVerifiedMetadata && (!value.source_url || !value.last_verified_at)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Model metadata edits require source_url and last_verified_at"
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

export const adminReportsResponseSchema = z
  .object({
    reports: z.array(recommendationReportSchema)
  })
  .strict();
export type AdminReportsResponse = z.infer<typeof adminReportsResponseSchema>;

export const reportDeleteRequestSchema = z
  .object({
    reason_code: nonEmptyStringSchema,
    sudo_request_id: idSchema.nullable()
  })
  .strict();
export type ReportDeleteRequest = z.infer<typeof reportDeleteRequestSchema>;

export const reportDeleteResponseSchema = z
  .object({
    report_id: idSchema,
    deletion_queued: z.boolean(),
    todo: nonEmptyStringSchema
  })
  .strict();
export type ReportDeleteResponse = z.infer<typeof reportDeleteResponseSchema>;

export const billingResponseSchema = z
  .object({
    entitlements: z.array(entitlementSchema),
    usage_ledger: z.array(usageLedgerEntrySchema)
  })
  .strict();
export type BillingResponse = z.infer<typeof billingResponseSchema>;

export const billingCreditRequestSchema = z
  .object({
    feature: entitlementFeatureSchema,
    quantity: z.number().int().positive(),
    reason_code: nonEmptyStringSchema
  })
  .strict();
export type BillingCreditRequest = z.infer<typeof billingCreditRequestSchema>;

export const billingCreditResponseSchema = z
  .object({
    ledger_entry: usageLedgerEntrySchema,
    todo: nonEmptyStringSchema
  })
  .strict();
export type BillingCreditResponse = z.infer<typeof billingCreditResponseSchema>;

export const auditLogsResponseSchema = z
  .object({
    audit_logs: z.array(adminAuditLogSchema)
  })
  .strict();
export type AuditLogsResponse = z.infer<typeof auditLogsResponseSchema>;

export { auditRequestSchema, auditResponseSchema, modelRegistryRecordSchema, workspaceSchema };
export type AdminActionScope = z.infer<typeof adminActionScopeSchema>;
