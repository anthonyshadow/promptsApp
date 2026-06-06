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
