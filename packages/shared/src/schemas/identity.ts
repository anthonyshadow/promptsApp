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

export const userSchema = z
  .object({
    id: idSchema,
    email: z.string().email(),
    name: z.string().min(1),
    workspace_id: idSchema,
    is_mock: z.boolean(),
    created_at: isoDateTimeSchema
  })
  .strict();
export type User = z.infer<typeof userSchema>;

export const adminRoleRecordSchema = z
  .object({
    id: idSchema,
    name: adminRoleNameSchema,
    scopes: z.array(adminActionScopeSchema),
    is_system: z.boolean(),
    created_at: isoDateTimeSchema
  })
  .strict();
export type AdminRoleRecord = z.infer<typeof adminRoleRecordSchema>;

export const adminUserRecordSchema = z
  .object({
    id: idSchema,
    user_id: idSchema.nullable(),
    email: z.string().email(),
    display_name: z.string().min(1),
    role_ids: z.array(idSchema),
    status: adminUserStatusSchema,
    password_hash: z.string().min(1),
    mfa_secret: z.string().min(1),
    created_at: isoDateTimeSchema,
    updated_at: isoDateTimeSchema
  })
  .strict();
export type AdminUserRecord = z.infer<typeof adminUserRecordSchema>;

export const adminSessionRecordSchema = z
  .object({
    id: idSchema,
    admin_user_id: idSchema,
    session_hash: z.string().min(1),
    mfa_verified_at: isoDateTimeSchema.nullable(),
    revoked_at: isoDateTimeSchema.nullable(),
    expires_at: isoDateTimeSchema,
    ip_address: z.string().min(1),
    user_agent: z.string().min(1),
    created_at: isoDateTimeSchema
  })
  .strict();
export type AdminSessionRecord = z.infer<typeof adminSessionRecordSchema>;

export const sudoRequestSchema = z
  .object({
    id: idSchema,
    admin_user_id: idSchema,
    role: adminRoleNameSchema,
    requested_action: adminActionScopeSchema,
    target_type: z.string().min(1).nullable(),
    target_id: idSchema.nullable(),
    action_scope: adminActionScopeSchema,
    reason_code: z.string().min(1),
    status: sudoRequestStatusSchema,
    approved_by_admin_user_id: idSchema.nullable(),
    approved_at: isoDateTimeSchema.nullable(),
    activated_at: isoDateTimeSchema.nullable(),
    revoked_at: isoDateTimeSchema.nullable(),
    expires_at: isoDateTimeSchema,
    ip_address: z.string().min(1),
    user_agent: z.string().min(1),
    created_at: isoDateTimeSchema
  })
  .strict();
export type SudoRequest = z.infer<typeof sudoRequestSchema>;

export const workspaceSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1),
    slug: z.string().min(1),
    is_mock: z.boolean(),
    created_at: isoDateTimeSchema,
    updated_at: isoDateTimeSchema
  })
  .strict();
export type Workspace = z.infer<typeof workspaceSchema>;

export const providerConnectionSchema = z
  .object({
    id: idSchema,
    workspace_id: idSchema,
    provider: providerSchema,
    encrypted_key_blob: z.string().min(1),
    encryption_key_id: z.string().min(1),
    key_fingerprint: z.string().min(1),
    status: providerConnectionStatusSchema,
    created_by: idSchema.nullable(),
    rotated_at: isoDateTimeSchema.nullable(),
    revoked_at: isoDateTimeSchema.nullable(),
    last_used_at: isoDateTimeSchema.nullable(),
    metadata: metadataSchema,
    is_mock: z.boolean(),
    created_at: isoDateTimeSchema,
    updated_at: isoDateTimeSchema
  })
  .strict();
export type ProviderConnection = z.infer<typeof providerConnectionSchema>;
