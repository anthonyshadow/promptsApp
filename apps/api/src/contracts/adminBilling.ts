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
