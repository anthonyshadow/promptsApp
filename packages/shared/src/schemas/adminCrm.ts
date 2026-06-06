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

export const deletionRequestSchema = z
  .object({
    id: idSchema,
    target_type: z.string().min(1),
    target_id: idSchema,
    requested_by: idSchema,
    verified_by: idSchema.nullable(),
    status: deletionRequestStatusSchema,
    reason_code: z.string().min(1),
    created_at: isoDateTimeSchema,
    completed_at: isoDateTimeSchema.nullable()
  })
  .strict();
export type DeletionRequest = z.infer<typeof deletionRequestSchema>;

export const adminActionContextSchema = z
  .object({
    admin_user_id: idSchema,
    session_id: idSchema,
    workspace_id: idSchema.nullable(),
    account_id: idSchema.nullable(),
    action_scope: adminActionScopeSchema,
    reason_code: z.string().min(1),
    sudo_request_id: idSchema.nullable(),
    ip_address: z.string().min(1),
    user_agent: z.string().min(1),
    redaction_state: redactionStateSchema
  })
  .strict();
export type AdminActionContext = z.infer<typeof adminActionContextSchema>;

export const accountSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1),
    workspace_id: idSchema.nullable(),
    stage: accountStageSchema,
    provider_preference: providerSchema.nullable().optional(),
    owner_admin_user_id: idSchema.nullable(),
    domain: z.string().min(1).nullable(),
    redacted_prompt_preview: z.string().min(1).nullable(),
    is_mock: z.boolean(),
    created_at: isoDateTimeSchema,
    updated_at: isoDateTimeSchema
  })
  .strict();
export type Account = z.infer<typeof accountSchema>;

export const contactSchema = z
  .object({
    id: idSchema,
    account_id: idSchema,
    name: z.string().min(1),
    email: z.string().email(),
    role: z.string().min(1).nullable(),
    is_mock: z.boolean(),
    created_at: isoDateTimeSchema,
    updated_at: isoDateTimeSchema
  })
  .strict();
export type Contact = z.infer<typeof contactSchema>;

export const opportunitySchema = z
  .object({
    id: idSchema,
    account_id: idSchema,
    project_id: idSchema.nullable(),
    stage: opportunityStageSchema,
    provider: providerSchema,
    current_model_id: z.string().min(1),
    current_model: z.string().min(1).optional(),
    fit_signal: modelFitSchema.optional(),
    estimated_monthly_calls: z.number().int().nonnegative(),
    estimated_volume: z.number().int().nonnegative().optional(),
    savings_opportunity_usd: z.number().nonnegative().nullable(),
    estimated_savings: z.number().nonnegative().nullable().optional(),
    use_case: taskTypeSchema.optional(),
    cta_clicked: freeAuditCtaSchema.optional(),
    eval_readiness: evalReadinessSchema,
    is_mock: z.boolean(),
    created_at: isoDateTimeSchema,
    updated_at: isoDateTimeSchema
  })
  .strict();
export type Opportunity = z.infer<typeof opportunitySchema>;

export const crmNoteSchema = z
  .object({
    id: idSchema,
    account_id: idSchema,
    opportunity_id: idSchema.nullable(),
    author_admin_user_id: idSchema.nullable(),
    body_redacted: z.string().min(1),
    redaction_state: redactionStateSchema,
    metadata: metadataSchema,
    is_mock: z.boolean(),
    created_at: isoDateTimeSchema
  })
  .strict();
export type CrmNote = z.infer<typeof crmNoteSchema>;

export const taskSchema = z
  .object({
    id: idSchema,
    account_id: idSchema.nullable(),
    opportunity_id: idSchema.nullable(),
    assignee_admin_user_id: idSchema.nullable(),
    title: z.string().min(1),
    status: z.enum(["open", "done", "cancelled"]),
    due_at: isoDateTimeSchema.nullable(),
    metadata: metadataSchema,
    is_mock: z.boolean(),
    created_at: isoDateTimeSchema,
    updated_at: isoDateTimeSchema
  })
  .strict();
export type CrmTask = z.infer<typeof taskSchema>;

export const adminAuditLogSchema = z
  .object({
    id: idSchema,
    admin_user_id: idSchema,
    workspace_id: idSchema.nullable(),
    account_id: idSchema.nullable(),
    target_type: z.string().min(1),
    target_id: idSchema,
    action: z.string().min(1),
    action_scope: adminActionScopeSchema,
    reason_code: z.string().min(1),
    sudo_request_id: idSchema.nullable(),
    ip_address: z.string().min(1),
    user_agent: z.string().min(1),
    redaction_state: redactionStateSchema,
    metadata: metadataSchema,
    is_mock: z.boolean(),
    created_at: isoDateTimeSchema
  })
  .strict();
export type AdminAuditLog = z.infer<typeof adminAuditLogSchema>;
