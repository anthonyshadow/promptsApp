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

export const adminAccountsResponseSchema = z
  .object({
    stages: z.array(accountStageSchema),
    accounts: z.array(
      z
        .object({
          account_id: idSchema,
          account: nonEmptyStringSchema,
          provider: providerSchema.nullable(),
          fit_signal: modelFitSchema.nullable(),
          volume: z.number().int().nonnegative().nullable(),
          savings_opportunity_usd: z.number().nonnegative().nullable(),
          stage: accountStageSchema,
          owner_admin_user_id: idSchema.nullable(),
          last_activity_at: isoDateTimeSchema.nullable(),
          redacted_prompt_preview: nonEmptyStringSchema.nullable(),
          opportunity_id: idSchema.nullable(),
          redaction_state: z.enum(["redacted", "revealed", "not_sensitive"])
        })
        .strict()
    )
  })
  .strict();
export type AdminAccountsResponse = z.infer<typeof adminAccountsResponseSchema>;

export const accountCreateRequestSchema = z
  .object({
    name: nonEmptyStringSchema,
    workspace_id: idSchema.nullable(),
    stage: accountStageSchema,
    provider_preference: providerSchema.nullable().optional(),
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
      stage: accountStageSchema.optional(),
      provider_preference: providerSchema.nullable().optional(),
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
    header: z
      .object({
        plan: nonEmptyStringSchema,
        seats: z.number().int().nonnegative(),
        provider: providerSchema.nullable(),
        byok_status: z.enum(["not_configured", "configured_opaque", "unknown"]),
        usage: nonEmptyStringSchema,
        estimated_savings_usd: z.number().nonnegative().nullable(),
        stage: accountStageSchema,
        owner_admin_user_id: idSchema.nullable()
      })
      .strict(),
    workspace_health: z
      .object({
        workspace_id: idSchema.nullable(),
        workspace_name: nonEmptyStringSchema.nullable(),
        status: z.enum(["healthy", "needs_eval", "needs_review", "unknown"]),
        projects: z.number().int().nonnegative(),
        eval_runs: z.number().int().nonnegative(),
        reports: z.number().int().nonnegative(),
        redacted_summary: nonEmptyStringSchema
      })
      .strict(),
    projects: z.array(
      z
        .object({
          project_id: idSchema,
          name: nonEmptyStringSchema,
          provider: providerSchema,
          current_model_id: nonEmptyStringSchema,
          status: z.enum(["draft", "active", "archived"]),
          prompt_id: idSchema.nullable(),
          redacted_prompt_preview: nonEmptyStringSchema.nullable()
        })
        .strict()
    ),
    reports: z.array(
      z
        .object({
          report_id: idSchema,
          project_id: idSchema,
          status: z.enum(["draft", "blocked", "ready", "exported"]),
          production_recommendation_allowed: z.boolean(),
          generated_at: isoDateTimeSchema.nullable(),
          redacted_summary: nonEmptyStringSchema
        })
        .strict()
    ),
    billing: z
      .object({
        plan: nonEmptyStringSchema,
        seats: z.number().int().nonnegative(),
        usage_ledger_events: z.number().int().nonnegative(),
        placeholder: nonEmptyStringSchema
      })
      .strict(),
    support_timeline: z.array(
      z
        .object({
          id: idSchema,
          type: z.enum(["note", "task", "free_audit", "opportunity", "report"]),
          label: nonEmptyStringSchema,
          timestamp: isoDateTimeSchema,
          actor: nonEmptyStringSchema,
          redaction_state: z.enum(["redacted", "revealed", "not_sensitive"])
        })
        .strict()
    ),
    redacted_previews: z.array(
      z
        .object({
          id: idSchema,
          type: z.enum(["project", "prompt", "report", "free_audit"]),
          label: nonEmptyStringSchema,
          redacted_preview: nonEmptyStringSchema,
          risk_level: z.enum(["low", "medium", "high", "critical"]).nullable()
        })
        .strict()
    ),
    contacts: z.array(contactSchema),
    opportunities: z.array(opportunitySchema),
    notes: z.array(crmNoteSchema),
    tasks: z.array(taskSchema)
  })
  .strict();
export type AdminAccountDetailResponse = z.infer<typeof adminAccountDetailResponseSchema>;

export const accountNoteCreateRequestSchema = z
  .object({
    body: nonEmptyStringSchema,
    opportunity_id: idSchema.nullable().optional()
  })
  .strict();
export type AccountNoteCreateRequest = z.infer<typeof accountNoteCreateRequestSchema>;

export const accountNoteCreateResponseSchema = z
  .object({
    note: crmNoteSchema
  })
  .strict();
export type AccountNoteCreateResponse = z.infer<typeof accountNoteCreateResponseSchema>;

export const accountTaskCreateRequestSchema = z
  .object({
    title: nonEmptyStringSchema,
    opportunity_id: idSchema.nullable().optional(),
    assignee_admin_user_id: idSchema.nullable().optional(),
    due_at: isoDateTimeSchema.nullable().optional()
  })
  .strict();
export type AccountTaskCreateRequest = z.infer<typeof accountTaskCreateRequestSchema>;

export const accountTaskCreateResponseSchema = z
  .object({
    task: taskSchema
  })
  .strict();
export type AccountTaskCreateResponse = z.infer<typeof accountTaskCreateResponseSchema>;

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
      slug: nonEmptyStringSchema.optional(),
      prompts_private_by_default: z.boolean().optional(),
      data_use_policy: z.enum(["no_training", "training_opt_in"]).optional(),
      provider_call_sensitive_data_policy: z.enum(["require_confirmation", "block"]).optional(),
      plan_id: idSchema.optional(),
      trial_state: z.enum(["none", "trialing", "expired"]).optional(),
      entitlements: z
        .array(
          z
            .object({
              feature: entitlementFeatureSchema,
              limit: z.number().int().nonnegative(),
              used: z.number().int().nonnegative().optional()
            })
            .strict()
        )
        .optional(),
      feature_flags: z.record(z.boolean()).optional(),
      reason_code: nonEmptyStringSchema.optional()
    })
    .strict()
).superRefine((value, context) => {
  const changesBillingState =
    value.plan_id !== undefined ||
    value.trial_state !== undefined ||
    value.entitlements !== undefined ||
    value.feature_flags !== undefined;

  if (changesBillingState && !value.reason_code) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Plan, limit, entitlement, or feature flag changes require reason_code"
    });
  }
});
export type WorkspacePatchRequest = z.infer<typeof workspacePatchRequestSchema>;
