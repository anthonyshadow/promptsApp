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

export const modelsResponseSchema = z
  .object({
    models: z.array(modelRegistryRecordSchema),
    registry_note: nonEmptyStringSchema
  })
  .strict();
export type ModelsResponse = z.infer<typeof modelsResponseSchema>;
export type AuditRequest = z.infer<typeof auditRequestSchema>;
export type AuditResponse = z.infer<typeof auditResponseSchema>;

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
    test_case_ids: z.array(idSchema).min(1).optional(),
    provider_call_acknowledged: z.boolean().optional()
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
    registryFreshness: z.enum(["fresh", "stale", "unverified", "deprecated", "preview", "experimental", "demo_unverified"]),
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
