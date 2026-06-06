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

export const adminOverviewResponseSchema = z
  .object({
    kpis: z
      .object({
        mrr_usd: z.number().nonnegative().nullable(),
        trials: z.number().int().nonnegative(),
        failed_payments: z.number().int().nonnegative(),
        free_audits: z.number().int().nonnegative(),
        free_audit_conversion_rate: z.number().min(0).max(1).nullable(),
        converted_accounts: z.number().int().nonnegative(),
        eval_jobs: z
          .object({
            queued: z.number().int().nonnegative(),
            running: z.number().int().nonnegative(),
            failed: z.number().int().nonnegative(),
            retrying: z.number().int().nonnegative(),
            rate_limited: z.number().int().nonnegative()
          })
          .strict(),
        provider_spend_usd: z.number().nonnegative().nullable(),
        usage_ledger_events: z.number().int().nonnegative(),
        unverified_models: z.number().int().nonnegative(),
        reports: z.number().int().nonnegative()
      })
      .strict(),
    health: z
      .object({
        api: z.literal("ok"),
        eval_worker: z.enum(["ok", "mocked", "degraded"]),
        report_worker: z.enum(["ok", "mocked", "degraded"]),
        queue: z.enum(["ok", "mocked", "degraded"]),
        storage: z.enum(["ok", "mocked", "degraded"]),
        repository: z.enum(["memory", "postgres"]),
        admin_auth: z.enum(["session", "mocked"])
      })
      .strict(),
    risk_queue: z.array(
      z
        .object({
          id: idSchema,
          label: nonEmptyStringSchema,
          severity: z.enum(["low", "medium", "high", "critical"]),
          count: z.number().int().nonnegative(),
          link: nonEmptyStringSchema,
          redacted_summary: nonEmptyStringSchema
        })
        .strict()
    ),
    live_activity: z.array(
      z
        .object({
          id: idSchema,
          label: nonEmptyStringSchema,
          actor: nonEmptyStringSchema,
          target: nonEmptyStringSchema,
          timestamp: isoDateTimeSchema,
          link: nonEmptyStringSchema,
          redaction_state: z.enum(["redacted", "revealed", "not_sensitive"])
        })
        .strict()
    ),
    notes: z.array(nonEmptyStringSchema)
  })
  .strict();
export type AdminOverviewResponse = z.infer<typeof adminOverviewResponseSchema>;
