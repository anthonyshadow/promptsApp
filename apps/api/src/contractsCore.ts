import { z } from "zod";
import {
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

export const adminAuthLoginRequestSchema = z
  .object({
    email: z.string().email(),
    password: nonEmptyStringSchema
  })
  .strict();
export type AdminAuthLoginRequest = z.infer<typeof adminAuthLoginRequestSchema>;

export const adminAuthMfaRequestSchema = z
  .object({
    code: z.string().regex(/^\d{6}$/)
  })
  .strict();
export type AdminAuthMfaRequest = z.infer<typeof adminAuthMfaRequestSchema>;

export const adminAuthSessionResponseSchema = z
  .object({
    token: nonEmptyStringSchema,
    session: z
      .object({
        id: idSchema,
        admin_user_id: idSchema,
        role: z.enum(["owner", "ops", "support", "finance", "read_only"]).nullable(),
        mfa_required: z.boolean(),
        mfa_verified: z.boolean(),
        expires_at: isoDateTimeSchema
      })
      .strict()
  })
  .strict();
export type AdminAuthSessionResponse = z.infer<typeof adminAuthSessionResponseSchema>;

export const adminAuthMeResponseSchema = z
  .object({
    authenticated: z.boolean(),
    admin_user_id: idSchema.nullable(),
    role: z.enum(["owner", "ops", "support", "finance", "read_only"]).nullable(),
    mfa_verified: z.boolean(),
    action_scopes: z.array(adminActionScopeSchema),
    expires_at: isoDateTimeSchema.nullable()
  })
  .strict();
export type AdminAuthMeResponse = z.infer<typeof adminAuthMeResponseSchema>;

export const adminAuthLogoutResponseSchema = z
  .object({
    signed_out: z.boolean()
  })
  .strict();
export type AdminAuthLogoutResponse = z.infer<typeof adminAuthLogoutResponseSchema>;

export const adminSudoStartRequestSchema = z
  .object({
    action_scope: adminActionScopeSchema,
    reason_code: nonEmptyStringSchema,
    mfa_code: z.string().regex(/^\d{6}$/),
    target_type: nonEmptyStringSchema.nullable().optional(),
    target_id: idSchema.nullable().optional()
  })
  .strict();
export type AdminSudoStartRequest = z.infer<typeof adminSudoStartRequestSchema>;

export const adminSudoEndRequestSchema = z
  .object({
    action_scope: adminActionScopeSchema.optional(),
    reason_code: nonEmptyStringSchema
  })
  .strict();
export type AdminSudoEndRequest = z.infer<typeof adminSudoEndRequestSchema>;

export const adminSudoStatusResponseSchema = z
  .object({
    active: z.array(sudoRequestSchema),
    expired_count: z.number().int().nonnegative(),
    active_until: isoDateTimeSchema.nullable()
  })
  .strict();
export type AdminSudoStatusResponse = z.infer<typeof adminSudoStatusResponseSchema>;

export const adminSudoStartResponseSchema = z
  .object({
    sudo_request: sudoRequestSchema,
    status: adminSudoStatusResponseSchema
  })
  .strict();
export type AdminSudoStartResponse = z.infer<typeof adminSudoStartResponseSchema>;

export const adminSudoEndResponseSchema = z
  .object({
    revoked: z.array(sudoRequestSchema),
    status: adminSudoStatusResponseSchema
  })
  .strict();
export type AdminSudoEndResponse = z.infer<typeof adminSudoEndResponseSchema>;

export const modelsResponseSchema = z
  .object({
    models: z.array(modelRegistryRecordSchema),
    registry_note: nonEmptyStringSchema
  })
  .strict();
export type ModelsResponse = z.infer<typeof modelsResponseSchema>;
export type AuditRequest = z.infer<typeof auditRequestSchema>;
export type AuditResponse = z.infer<typeof auditResponseSchema>;

export const providerConnectionMetadataSchema = providerConnectionSchema
  .omit({
    encrypted_key_blob: true
  })
  .strict();
export type ProviderConnectionMetadata = z.infer<typeof providerConnectionMetadataSchema>;

export const providerConnectionCreateRequestSchema = z
  .object({
    workspace_id: idSchema,
    provider: providerSchema,
    api_key: nonEmptyStringSchema,
    created_by: idSchema.nullable().optional()
  })
  .strict();
export type ProviderConnectionCreateRequest = z.infer<
  typeof providerConnectionCreateRequestSchema
>;

export const providerConnectionsResponseSchema = z
  .object({
    connections: z.array(providerConnectionMetadataSchema),
    redaction_note: nonEmptyStringSchema
  })
  .strict();
export type ProviderConnectionsResponse = z.infer<typeof providerConnectionsResponseSchema>;

export const providerConnectionMutationResponseSchema = z
  .object({
    connection: providerConnectionMetadataSchema,
    redaction_note: nonEmptyStringSchema
  })
  .strict();
export type ProviderConnectionMutationResponse = z.infer<
  typeof providerConnectionMutationResponseSchema
>;

export const adminProviderConnectionsResponseSchema = z
  .object({
    connections: z.array(
      providerConnectionMetadataSchema
        .extend({
          workspace_name: nonEmptyStringSchema.nullable()
        })
        .strict()
    ),
    redaction_note: nonEmptyStringSchema
  })
  .strict();
export type AdminProviderConnectionsResponse = z.infer<
  typeof adminProviderConnectionsResponseSchema
>;

export const providerConnectionRotateRequestSchema = z
  .object({
    api_key: nonEmptyStringSchema,
    rotated_by: idSchema.nullable().optional(),
    reason_code: nonEmptyStringSchema
  })
  .strict();
export type ProviderConnectionRotateRequest = z.infer<
  typeof providerConnectionRotateRequestSchema
>;

export const providerConnectionRevokeRequestSchema = z
  .object({
    revoked_by: idSchema.nullable().optional(),
    reason_code: nonEmptyStringSchema
  })
  .strict();
export type ProviderConnectionRevokeRequest = z.infer<
  typeof providerConnectionRevokeRequestSchema
>;

export const workspaceDashboardStatusSchema = z.enum([
  "deployed",
  "ready",
  "review",
  "fallback",
  "failed"
]);
export type WorkspaceDashboardStatus = z.infer<typeof workspaceDashboardStatusSchema>;

export const workspaceDashboardResponseSchema = z
  .object({
    workspace: workspaceSchema,
    metrics: z
      .object({
        verified_monthly_savings_usd: z.number().nonnegative().nullable(),
        verified_savings_note: nonEmptyStringSchema,
        prompts_optimized: z.number().int().nonnegative(),
        eval_pass_average: z.number().min(0).max(1).nullable(),
        models_flagged: z.number().int().nonnegative()
      })
      .strict(),
    recent_projects: z.array(
      z
        .object({
          project_id: idSchema,
          project_name: nonEmptyStringSchema,
          prompt_id: idSchema.nullable(),
          prompt_name: nonEmptyStringSchema.nullable(),
          provider: providerSchema,
          current_model_id: nonEmptyStringSchema,
          fit: modelFitSchema.nullable(),
          savings_usd: z.number().nonnegative().nullable(),
          savings_status: z.enum(["verified", "unverified", "blocked", "not_available"]),
          last_eval_at: isoDateTimeSchema.nullable(),
          status: workspaceDashboardStatusSchema
        })
        .strict()
    ),
    notes: z.array(nonEmptyStringSchema)
  })
  .strict();
export type WorkspaceDashboardResponse = z.infer<typeof workspaceDashboardResponseSchema>;

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
      label: nonEmptyStringSchema,
      prompt_version_id: idSchema,
      analysis_id: idSchema.nullable(),
      strategy: candidateStrategySchema,
      candidate_prompt_text: nonEmptyStringSchema,
      estimated_input_tokens: z.number().int().nonnegative(),
      estimated_output_tokens: z.number().int().nonnegative(),
      rationale: nonEmptyStringSchema,
      risk_level: z.enum(["low", "medium", "high", "critical"]),
      expected_token_delta: z.number(),
      preserved_constraints: z.array(nonEmptyStringSchema),
      removed_or_compressed_elements: z.array(nonEmptyStringSchema),
      is_baseline: z.boolean(),
      is_mock: z.boolean(),
      created_at: isoDateTimeSchema
    }).strict()),
    todo: nonEmptyStringSchema
  })
  .strict();
export type PromptOptimizeResponse = z.infer<typeof promptOptimizeResponseSchema>;

export const qualityContractRequestSchema = qualityContractSchema
  .pick({
    task: true,
    required_output: true,
    must_preserve: true,
    forbidden_behavior: true,
    pass_threshold: true,
    must_pass_check_ids: true,
    check_definitions: true,
    notes: true
  })
  .strict();
export type QualityContractRequest = z.infer<typeof qualityContractRequestSchema>;

export const qualityContractResponseSchema = z
  .object({
    contract: qualityContractSchema,
    test_cases: z.array(testCaseSchema),
    production_recommendation_allowed: z.boolean(),
    production_blockers: z.array(nonEmptyStringSchema),
    source: z.enum(["persisted", "auto_draft"])
  })
  .strict();
export type QualityContractResponse = z.infer<typeof qualityContractResponseSchema>;

export const testCaseCreateRequestSchema = z
  .object({
    name: nonEmptyStringSchema,
    input_variables: metadataSchema,
    expected_output: z.unknown().nullable(),
    checks: z.array(qualityCheckDefinitionSchema).min(1)
  })
  .strict();
export type TestCaseCreateRequest = z.infer<typeof testCaseCreateRequestSchema>;

export const testCasePatchRequestSchema = requireAtLeastOneField(
  z
    .object({
      name: nonEmptyStringSchema.optional(),
      input_variables: metadataSchema.optional(),
      expected_output: z.unknown().nullable().optional(),
      checks: z.array(qualityCheckDefinitionSchema).min(1).optional()
    })
    .strict()
);
export type TestCasePatchRequest = z.infer<typeof testCasePatchRequestSchema>;

export const testCaseMutationResponseSchema = z
  .object({
    test_case: testCaseSchema,
    production_recommendation_allowed: z.boolean(),
    production_blockers: z.array(nonEmptyStringSchema)
  })
  .strict();
export type TestCaseMutationResponse = z.infer<typeof testCaseMutationResponseSchema>;

export const evalRunCreateRequestSchema = evalRunSchema
  .pick({
    project_id: true,
    quality_contract_id: true,
    baseline_prompt_version_id: true,
    candidate_ids: true,
    model_registry_record_ids: true,
    pass_threshold: true
  })
  .extend({
    test_case_ids: z.array(idSchema).min(1).optional()
  })
  .strict();
export type EvalRunCreateRequest = z.infer<typeof evalRunCreateRequestSchema>;

export const evalRunDetailResponseSchema = z
  .object({
    eval_run: evalRunSchema,
    results: z.array(evalResultSchema),
    frontier_points: z.array(
      z
        .object({
          result_id: idSchema,
          candidate_id: idSchema,
          model_id: nonEmptyStringSchema,
          label: nonEmptyStringSchema,
          quality_score: z.number().min(0).max(1),
          pass_rate: z.number().min(0).max(1),
          estimated_cost_usd: z.number().nonnegative().nullable(),
          cost_estimate_status: costEstimateStatusSchema,
          latency_ms: z.number().int().nonnegative().nullable(),
          verdict: z.enum(["pass", "fail", "blocked"]),
          role: z.enum(["baseline", "safe", "winner_candidate", "failed"]),
          is_baseline: z.boolean(),
          notes: z.array(nonEmptyStringSchema)
        })
        .strict()
    ),
    failures: z.array(
      z
        .object({
          result_id: idSchema,
          candidate_id: idSchema,
          model_id: nonEmptyStringSchema,
          failed_check_ids: z.array(idSchema),
          must_pass_failures: z.number().int().nonnegative(),
          reason: nonEmptyStringSchema
        })
        .strict()
    ),
    retry_hints: z.array(nonEmptyStringSchema),
    status_note: nonEmptyStringSchema
  })
  .strict();
export type EvalRunDetailResponse = z.infer<typeof evalRunDetailResponseSchema>;

export const recommendationDecisionResponseSchema = z
  .object({
    evalRunId: idSchema,
    winnerResultId: idSchema.nullable(),
    cheaperAlternativeResultId: idSchema.nullable(),
    strongerFallbackResultId: idSchema.nullable(),
    rejectedCombos: z.array(
      z
        .object({
          resultId: idSchema,
          candidateId: idSchema,
          modelId: nonEmptyStringSchema,
          reason: nonEmptyStringSchema,
          failedCheckIds: z.array(idSchema),
          mustPassFailures: z.number().int().nonnegative()
        })
        .strict()
    ),
    riskNotes: z.array(nonEmptyStringSchema),
    productionRecommendationAllowed: z.boolean(),
    productionBlockers: z.array(nonEmptyStringSchema),
    registryFreshness: z.enum(["fresh", "stale", "unverified", "deprecated"]),
    savingsSummary: nonEmptyStringSchema.nullable(),
    rankedPassingResultIds: z.array(idSchema)
  })
  .strict();
export type RecommendationDecisionResponse = z.infer<typeof recommendationDecisionResponseSchema>;

export const reportDetailResponseSchema = z
  .object({
    report: recommendationReportSchema,
    eval_run: evalRunSchema,
    results: z.array(evalResultSchema),
    frontier_points: evalRunDetailResponseSchema.shape.frontier_points,
    decision: recommendationDecisionResponseSchema
  })
  .strict();
export type ReportDetailResponse = z.infer<typeof reportDetailResponseSchema>;

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
        filename: nonEmptyStringSchema,
        content_type: nonEmptyStringSchema,
        content: nonEmptyStringSchema,
        redacted_share_package: metadataSchema,
        eval_snapshot: metadataSchema,
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
        mrr_usd: z.number().nonnegative().nullable(),
        trials: z.number().int().nonnegative(),
        failed_payments: z.number().int().nonnegative(),
        free_audits: z.number().int().nonnegative(),
        free_audit_conversion_rate: z.number().min(0).max(1).nullable(),
        converted_accounts: z.number().int().nonnegative(),
        eval_jobs: z
          .object({
            queued: z.number().int().nonnegative(),
            running: z.number().int().nonnegative(),
            failed: z.number().int().nonnegative(),
            retrying: z.number().int().nonnegative()
          })
          .strict(),
        provider_spend_usd: z.number().nonnegative().nullable(),
        usage_ledger_events: z.number().int().nonnegative(),
        unverified_models: z.number().int().nonnegative(),
        reports: z.number().int().nonnegative()
      })
      .strict(),
    health: z
      .object({
        api: z.literal("ok"),
        eval_worker: z.enum(["ok", "mocked", "degraded"]),
        report_worker: z.enum(["ok", "mocked", "degraded"]),
        queue: z.enum(["ok", "mocked", "degraded"]),
        storage: z.enum(["ok", "mocked", "degraded"]),
        repository: z.enum(["memory", "postgres"]),
        admin_auth: z.enum(["session", "mocked"])
      })
      .strict(),
    risk_queue: z.array(
      z
        .object({
          id: idSchema,
          label: nonEmptyStringSchema,
          severity: z.enum(["low", "medium", "high", "critical"]),
          count: z.number().int().nonnegative(),
          link: nonEmptyStringSchema,
          redacted_summary: nonEmptyStringSchema
        })
        .strict()
    ),
    live_activity: z.array(
      z
        .object({
          id: idSchema,
          label: nonEmptyStringSchema,
          actor: nonEmptyStringSchema,
          target: nonEmptyStringSchema,
          timestamp: isoDateTimeSchema,
          link: nonEmptyStringSchema,
          redaction_state: z.enum(["redacted", "revealed", "not_sensitive"])
        })
        .strict()
    ),
    notes: z.array(nonEmptyStringSchema)
  })
  .strict();
export type AdminOverviewResponse = z.infer<typeof adminOverviewResponseSchema>;

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

export const adminEvalRunsResponseSchema = z
  .object({
    queue_summary: z
      .object({
        queued: z.number().int().nonnegative(),
        running: z.number().int().nonnegative(),
        failed: z.number().int().nonnegative(),
        retrying: z.number().int().nonnegative(),
        rate_limited: z.number().int().nonnegative()
      })
      .strict(),
    worker_health: z.array(
      z
        .object({
          component: z.enum(["eval-runner", "provider-adapter", "scoring", "report-generator"]),
          status: z.enum(["ok", "mocked", "degraded"]),
          redacted_summary: nonEmptyStringSchema
        })
        .strict()
    ),
    jobs: z.array(
      z
        .object({
          id: idSchema,
          workspace: nonEmptyStringSchema,
          provider: providerSchema,
          status: z.enum(["queued", "running", "rate_limited", "retrying", "complete", "failed"]),
          age_seconds: z.number().int().nonnegative(),
          progress: z.number().min(0).max(1),
          action: z.enum(["view", "retry", "cancel", "regenerate_report"]),
          redaction_state: z.enum(["redacted", "revealed", "not_sensitive"])
        })
        .strict()
    ),
    notes: z.array(nonEmptyStringSchema)
  })
  .strict();
export type AdminEvalRunsResponse = z.infer<typeof adminEvalRunsResponseSchema>;

export const adminEvalRunDetailResponseSchema = z
  .object({
    detail: evalRunDetailResponseSchema,
    sanitized_payload: z
      .object({
        eval_run_id: idSchema,
        project_id: idSchema,
        quality_contract_id: idSchema,
        baseline_prompt_version_id: idSchema,
        candidate_ids: z.array(idSchema),
        model_registry_record_ids: z.array(idSchema),
        redaction_state: z.enum(["redacted", "revealed", "not_sensitive"])
      })
      .strict(),
    model_ids: z.array(nonEmptyStringSchema),
    test_count: z.number().int().nonnegative(),
    failed_checks: evalRunDetailResponseSchema.shape.failures,
    sanitized_provider_error: nonEmptyStringSchema.nullable(),
    retry_hints: z.array(nonEmptyStringSchema),
    worker_health: z.array(
      z
        .object({
          component: z.enum(["eval-runner", "provider-adapter", "scoring", "report-generator"]),
          status: z.enum(["ok", "mocked", "degraded"]),
          redacted_summary: nonEmptyStringSchema
        })
        .strict()
    )
  })
  .strict();
export type AdminEvalRunDetailResponse = z.infer<typeof adminEvalRunDetailResponseSchema>;

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
    freshness_status: z.enum(["fresh", "stale", "unverified", "deprecated"]),
    source_url: z.string().url().nullable(),
    last_verified_at: isoDateTimeSchema.nullable(),
    verified_by: nonEmptyStringSchema.nullable(),
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
        preview_experimental: z.number().int().nonnegative(),
        unverified: z.number().int().nonnegative()
      })
      .strict(),
    models: z.array(adminModelRegistryRowSchema),
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

export const reportPrivacyStateSchema = z.enum([
  "ready_redacted",
  "raw_locked",
  "failed_export",
  "deletion_pending",
  "deleted"
]);
export type ReportPrivacyState = z.infer<typeof reportPrivacyStateSchema>;

export const adminReportsResponseSchema = z
  .object({
    reports: z.array(
      z
        .object({
          report_id: idSchema,
          workspace: nonEmptyStringSchema,
          format: reportArtifactFormatSchema,
          privacy_state: reportPrivacyStateSchema,
          status: z.enum(["draft", "blocked", "ready", "exported"]),
          action: z.enum([
            "open_redacted",
            "retry_export",
            "regenerate_export",
            "approve_deletion",
            "request_sudo_for_raw"
          ]),
          redacted_summary: nonEmptyStringSchema,
          artifact_id: idSchema.nullable(),
          storage_uri: nonEmptyStringSchema.nullable(),
          storage_key_short: nonEmptyStringSchema.nullable(),
          artifact_exists: z.boolean(),
          checksum: nonEmptyStringSchema.nullable(),
          size_bytes: z.number().int().nonnegative().nullable(),
          deletion_status: z.enum(["active", "delete_requested", "deleted", "failed"]),
          deletion_attempts: z.number().int().nonnegative(),
          last_deletion_error: nonEmptyStringSchema.nullable(),
          retry_status: z.enum(["not_needed", "retry_available", "retrying", "blocked"]),
          generated_at: isoDateTimeSchema.nullable(),
          deletion_note: nonEmptyStringSchema.nullable()
        })
        .strict()
    ),
    summary: z
      .object({
        ready_redacted: z.number().int().nonnegative(),
        raw_locked: z.number().int().nonnegative(),
        failed_export: z.number().int().nonnegative(),
        deletion_pending: z.number().int().nonnegative(),
        deleted: z.number().int().nonnegative()
      })
      .strict(),
    notes: z.array(nonEmptyStringSchema)
  })
  .strict();
export type AdminReportsResponse = z.infer<typeof adminReportsResponseSchema>;

export const reportExportActionResponseSchema = z
  .object({
    report: recommendationReportSchema,
    artifacts: z.array(reportArtifactSchema),
    redaction_state: z.enum(["redacted", "revealed", "not_sensitive"]),
    todo: nonEmptyStringSchema
  })
  .strict();
export type ReportExportActionResponse = z.infer<typeof reportExportActionResponseSchema>;

export const reportRevealResponseSchema = z
  .object({
    report_id: idSchema,
    redacted_summary: nonEmptyStringSchema,
    raw_report: z.null(),
    todo: nonEmptyStringSchema
  })
  .strict();
export type ReportRevealResponse = z.infer<typeof reportRevealResponseSchema>;

export const reportDeleteRequestSchema = z
  .object({
    reason_code: nonEmptyStringSchema,
    sudo_request_id: idSchema.nullable().optional()
  })
  .strict();
export type ReportDeleteRequest = z.infer<typeof reportDeleteRequestSchema>;

export const reportDeleteResponseSchema = z
  .object({
    report_id: idSchema,
    deletion_queued: z.boolean(),
    deletion_status: z.enum(["deletion_pending", "deleted", "failed"]),
    artifacts_deleted: z.number().int().nonnegative(),
    artifact_failures: z.number().int().nonnegative(),
    scoped_records_marked: z.array(nonEmptyStringSchema),
    todo: nonEmptyStringSchema
  })
  .strict();
export type ReportDeleteResponse = z.infer<typeof reportDeleteResponseSchema>;

export const billingResponseSchema = z
  .object({
    plans: z.array(planSchema),
    plan: planSchema.nullable(),
    trial_state: z.enum(["none", "trialing", "expired"]),
    seats: z
      .object({
        limit: z.number().int().nonnegative(),
        used: z.number().int().nonnegative()
      })
      .strict(),
    entitlement_checks: z.array(
      z
        .object({
          feature: entitlementFeatureSchema,
          label: nonEmptyStringSchema,
          enabled: z.boolean(),
          limit: z.number().int().nonnegative(),
          used: z.number().int().nonnegative(),
          remaining: z.number().int().nonnegative(),
          enforced_on_public_routes: z.boolean()
        })
        .strict()
    ),
    entitlements: z.array(entitlementSchema),
    usage_ledger: z.array(usageLedgerEntrySchema),
    invoices: z.array(invoiceSchema),
    credits: z.array(creditSchema),
    billing_events: z.array(billingEventSchema),
    feature_flags: z.array(featureFlagSchema),
    notes: z.array(nonEmptyStringSchema)
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
    credit: creditSchema,
    billing_event: billingEventSchema,
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
