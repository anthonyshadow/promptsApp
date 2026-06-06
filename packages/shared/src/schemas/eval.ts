import {
  z,
  idSchema,
  isoDateTimeSchema,
  metadataSchema,
  providerSchema,
  providerConnectionStatusSchema,
  taskTypeSchema,
  prioritySchema,
  auditSourceSchema,
  freeAuditCtaSchema,
  riskLevelSchema,
  modelFitSchema,
  registryFreshnessSchema,
  stabilityStatusSchema,
  latencyTierSchema,
  qualityTierSchema,
  modelRegistryApprovalStateSchema,
  promptStatusSchema,
  candidateStrategySchema,
  evalStatusSchema,
  evalVerdictSchema,
  testCheckTypeSchema,
  reportStatusSchema,
  reportArtifactFormatSchema,
  reportArtifactPrivacyStateSchema,
  artifactDeletionStatusSchema,
  retentionStateSchema,
  deletionRequestStatusSchema,
  adminActionScopeSchema,
  adminRoleNameSchema,
  adminUserStatusSchema,
  sudoRequestStatusSchema,
  redactionStateSchema,
  accountStageSchema,
  opportunityStageSchema,
  evalReadinessSchema,
  entitlementFeatureSchema,
  usageLedgerUnitSchema,
  ledgerDirectionSchema
} from './common';

import { costEstimateStatusSchema } from './audit';

export const qualityCheckDefinitionSchema = z
  .object({
    id: idSchema,
    type: testCheckTypeSchema,
    description: z.string().min(1),
    must_pass: z.boolean(),
    field_path: z.string().min(1).nullable(),
    expected_value: z.unknown().nullable(),
    pattern: z.string().min(1).nullable(),
    placeholder_note: z.string().min(1).nullable()
  })
  .strict();
export type QualityCheckDefinition = z.infer<typeof qualityCheckDefinitionSchema>;

export const qualityContractSchema = z
  .object({
    id: idSchema,
    project_id: idSchema,
    task: z.string().min(1),
    required_output: z.string().min(1),
    must_preserve: z.array(z.string().min(1)),
    forbidden_behavior: z.array(z.string().min(1)),
    pass_threshold: z.number().min(0).max(1),
    must_pass_check_ids: z.array(idSchema),
    check_definitions: z.array(qualityCheckDefinitionSchema).min(1),
    notes: z.string().min(1).nullable(),
    is_mock: z.boolean(),
    created_at: isoDateTimeSchema,
    updated_at: isoDateTimeSchema
  })
  .strict();
export type QualityContract = z.infer<typeof qualityContractSchema>;

export const testCaseCheckSchema = qualityCheckDefinitionSchema;
export type TestCaseCheck = z.infer<typeof testCaseCheckSchema>;

export const testCaseSchema = z
  .object({
    id: idSchema,
    project_id: idSchema,
    quality_contract_id: idSchema,
    name: z.string().min(1),
    input_variables: metadataSchema,
    expected_output: z.unknown().nullable(),
    checks: z.array(testCaseCheckSchema).min(1),
    is_mock: z.boolean(),
    created_at: isoDateTimeSchema,
    updated_at: isoDateTimeSchema
  })
  .strict();
export type TestCase = z.infer<typeof testCaseSchema>;

export const evalRunSchema = z
  .object({
    id: idSchema,
    project_id: idSchema,
    quality_contract_id: idSchema,
    baseline_prompt_version_id: idSchema,
    candidate_ids: z.array(idSchema),
    model_registry_record_ids: z.array(idSchema),
    status: evalStatusSchema,
    pass_threshold: z.number().min(0).max(1),
    is_mock: z.boolean(),
    queued_at: isoDateTimeSchema,
    started_at: isoDateTimeSchema.nullable(),
    completed_at: isoDateTimeSchema.nullable()
  })
  .strict();
export type EvalRun = z.infer<typeof evalRunSchema>;

export const evalResultSchema = z
  .object({
    id: idSchema,
    eval_run_id: idSchema,
    candidate_id: idSchema,
    prompt_version_id: idSchema.nullable(),
    model_registry_record_id: idSchema,
    provider: providerSchema,
    model_id: z.string().min(1),
    quality_score: z.number().min(0).max(1),
    pass_rate: z.number().min(0).max(1),
    must_pass_failures: z.number().int().nonnegative(),
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
    estimated_cost_usd: z.number().nonnegative().nullable(),
    cost_estimate_status: costEstimateStatusSchema,
    latency_ms: z.number().int().nonnegative().nullable(),
    risk_level: riskLevelSchema,
    verdict: evalVerdictSchema,
    failed_check_ids: z.array(idSchema),
    is_mock: z.boolean(),
    created_at: isoDateTimeSchema
  })
  .strict();
export type EvalResult = z.infer<typeof evalResultSchema>;

export const recommendationReportSchema = z
  .object({
    id: idSchema,
    project_id: idSchema,
    eval_run_id: idSchema,
    status: reportStatusSchema,
    winner_result_id: idSchema.nullable(),
    cheaper_alternative_result_id: idSchema.nullable(),
    stronger_fallback_result_id: idSchema.nullable(),
    risk_summary: z.array(z.string().min(1)),
    savings_summary: z.string().min(1).nullable(),
    production_recommendation_allowed: z.boolean(),
    production_blockers: z.array(z.string().min(1)),
    registry_freshness: registryFreshnessSchema,
    deleted_at: isoDateTimeSchema.nullable().optional(),
    delete_requested_by_user_id: idSchema.nullable().optional(),
    delete_reason_code: z.string().min(1).nullable().optional(),
    retention_state: retentionStateSchema.optional(),
    is_mock: z.boolean(),
    generated_at: isoDateTimeSchema.nullable(),
    created_at: isoDateTimeSchema,
    updated_at: isoDateTimeSchema
  })
  .strict();
export type RecommendationReport = z.infer<typeof recommendationReportSchema>;

export const reportArtifactSchema = z
  .object({
    id: idSchema,
    report_id: idSchema,
    workspace_id: idSchema.nullable().optional(),
    project_id: idSchema.nullable().optional(),
    format: reportArtifactFormatSchema,
    privacy_state: reportArtifactPrivacyStateSchema.optional(),
    storage_key: z.string().min(1).optional(),
    storage_uri: z.string().min(1),
    checksum: z.string().min(1).nullable(),
    size_bytes: z.number().int().nonnegative().nullable(),
    redaction_state: redactionStateSchema,
    deleted_at: isoDateTimeSchema.nullable().optional(),
    deletion_status: artifactDeletionStatusSchema.optional(),
    deletion_attempts: z.number().int().nonnegative().optional(),
    last_deletion_error: z.string().min(1).nullable().optional(),
    is_mock: z.boolean(),
    created_at: isoDateTimeSchema
  })
  .strict();
export type ReportArtifact = z.infer<typeof reportArtifactSchema>;
