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

export const entitlementSchema = z
  .object({
    id: idSchema,
    workspace_id: idSchema,
    plan_id: z.string().min(1),
    feature: entitlementFeatureSchema,
    limit: z.number().int().nonnegative(),
    used: z.number().int().nonnegative(),
    is_mock: z.boolean(),
    starts_at: isoDateTimeSchema,
    ends_at: isoDateTimeSchema.nullable(),
    created_at: isoDateTimeSchema
  })
  .strict();
export type Entitlement = z.infer<typeof entitlementSchema>;

export const planSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1),
    billing_period: z.enum(["month", "year", "custom"]),
    price_cents: z.number().int().nonnegative(),
    feature_limits: metadataSchema,
    is_active: z.boolean(),
    is_mock: z.boolean(),
    created_at: isoDateTimeSchema
  })
  .strict();
export type Plan = z.infer<typeof planSchema>;

export const usageLedgerEntrySchema = z
  .object({
    id: idSchema,
    workspace_id: idSchema,
    feature: entitlementFeatureSchema,
    quantity: z.number().int().positive(),
    unit: usageLedgerUnitSchema,
    direction: ledgerDirectionSchema,
    source_type: z.string().min(1),
    source_id: idSchema,
    is_mock: z.boolean(),
    created_at: isoDateTimeSchema
  })
  .strict();
export type UsageLedgerEntry = z.infer<typeof usageLedgerEntrySchema>;

export const billingEventSchema = z
  .object({
    id: idSchema,
    workspace_id: idSchema,
    event_type: z.string().min(1),
    amount_cents: z.number().int().nullable(),
    currency: z.string().min(1),
    external_reference: z.string().min(1).nullable(),
    metadata: metadataSchema,
    is_mock: z.boolean(),
    created_at: isoDateTimeSchema
  })
  .strict();
export type BillingEvent = z.infer<typeof billingEventSchema>;

export const invoiceSchema = z
  .object({
    id: idSchema,
    workspace_id: idSchema,
    status: z.enum(["draft", "open", "paid", "void", "uncollectible"]),
    amount_due_cents: z.number().int().nonnegative(),
    currency: z.string().min(1),
    issued_at: isoDateTimeSchema.nullable(),
    due_at: isoDateTimeSchema.nullable(),
    paid_at: isoDateTimeSchema.nullable(),
    external_reference: z.string().min(1).nullable(),
    metadata: metadataSchema,
    is_mock: z.boolean(),
    created_at: isoDateTimeSchema
  })
  .strict();
export type Invoice = z.infer<typeof invoiceSchema>;

export const creditSchema = z
  .object({
    id: idSchema,
    workspace_id: idSchema,
    amount_cents: z.number().int().positive(),
    currency: z.string().min(1),
    reason_code: z.string().min(1),
    issued_by_admin_user_id: idSchema.nullable(),
    sudo_request_id: idSchema.nullable(),
    billing_event_id: idSchema.nullable(),
    is_mock: z.boolean(),
    created_at: isoDateTimeSchema
  })
  .strict();
export type Credit = z.infer<typeof creditSchema>;

export const featureFlagSchema = z
  .object({
    id: idSchema,
    key: z.string().min(1),
    enabled: z.boolean(),
    rollout: metadataSchema,
    created_by_admin_user_id: idSchema.nullable(),
    updated_by_admin_user_id: idSchema.nullable(),
    is_mock: z.boolean(),
    created_at: isoDateTimeSchema,
    updated_at: isoDateTimeSchema
  })
  .strict();
export type FeatureFlag = z.infer<typeof featureFlagSchema>;
