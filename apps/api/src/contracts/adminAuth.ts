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
