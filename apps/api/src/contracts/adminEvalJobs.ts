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

import { evalRunDetailResponseSchema } from './publicProduct';

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
