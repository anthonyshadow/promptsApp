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

export const promptProjectSchema = z
  .object({
    id: idSchema,
    workspace_id: idSchema,
    name: z.string().min(1),
    task_type: taskTypeSchema,
    current_provider: providerSchema,
    current_model_id: z.string().min(1),
    status: promptStatusSchema,
    is_mock: z.boolean(),
    created_at: isoDateTimeSchema,
    updated_at: isoDateTimeSchema
  })
  .strict();
export type PromptProject = z.infer<typeof promptProjectSchema>;

export const promptSchema = z
  .object({
    id: idSchema,
    project_id: idSchema,
    name: z.string().min(1),
    current_version_id: idSchema.nullable(),
    redacted_preview: z.string().min(1),
    deleted_at: isoDateTimeSchema.nullable().optional(),
    delete_reason_code: z.string().min(1).nullable().optional(),
    retention_state: retentionStateSchema.optional(),
    is_mock: z.boolean(),
    created_at: isoDateTimeSchema,
    updated_at: isoDateTimeSchema
  })
  .strict();
export type Prompt = z.infer<typeof promptSchema>;

export const promptVersionSchema = z
  .object({
    id: idSchema,
    prompt_id: idSchema,
    version: z.number().int().positive(),
    label: z.string().min(1),
    prompt_text: z.string().min(1),
    variables: z.array(z.string().min(1)),
    status: promptStatusSchema,
    redacted_preview: z.string().min(1),
    deleted_at: isoDateTimeSchema.nullable().optional(),
    delete_reason_code: z.string().min(1).nullable().optional(),
    retention_state: retentionStateSchema.optional(),
    is_mock: z.boolean(),
    created_by_user_id: idSchema.nullable(),
    created_at: isoDateTimeSchema
  })
  .strict();
export type PromptVersion = z.infer<typeof promptVersionSchema>;

export const promptAnalysisSchema = z
  .object({
    id: idSchema,
    prompt_version_id: idSchema,
    provider: providerSchema,
    model_id: z.string().min(1),
    task_type: taskTypeSchema,
    input_tokens: z.number().int().nonnegative(),
    estimated_output_tokens: z.number().int().nonnegative(),
    model_fit: modelFitSchema,
    waste_findings: z.array(z.string().min(1)),
    risk_level: riskLevelSchema,
    compression_guardrails: z.array(z.string().min(1)),
    registry_freshness: registryFreshnessSchema,
    is_mock: z.boolean(),
    created_at: isoDateTimeSchema
  })
  .strict();
export type PromptAnalysis = z.infer<typeof promptAnalysisSchema>;

export const optimizationCandidateSchema = z
  .object({
    id: idSchema,
    label: z.string().min(1),
    prompt_version_id: idSchema,
    analysis_id: idSchema.nullable(),
    strategy: candidateStrategySchema,
    candidate_prompt_text: z.string().min(1),
    estimated_input_tokens: z.number().int().nonnegative(),
    estimated_output_tokens: z.number().int().nonnegative(),
    rationale: z.string().min(1),
    risk_level: riskLevelSchema,
    expected_token_delta: z.number(),
    preserved_constraints: z.array(z.string().min(1)),
    removed_or_compressed_elements: z.array(z.string().min(1)),
    is_baseline: z.boolean(),
    is_mock: z.boolean(),
    created_at: isoDateTimeSchema
  })
  .strict();
export type OptimizationCandidate = z.infer<typeof optimizationCandidateSchema>;
