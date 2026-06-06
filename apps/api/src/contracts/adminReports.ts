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

export const reportPrivacyStateSchema = z.enum([
  "ready_redacted",
  "raw_locked",
  "failed_export",
  "deletion_pending",
  "deleted"
]);
export type ReportPrivacyState = z.infer<typeof reportPrivacyStateSchema>;

export const adminReportsResponseSchema = z
  .object({
    reports: z.array(
      z
        .object({
          report_id: idSchema,
          workspace: nonEmptyStringSchema,
          format: reportArtifactFormatSchema,
          privacy_state: reportPrivacyStateSchema,
          status: z.enum(["draft", "blocked", "ready", "exported"]),
          action: z.enum([
            "open_redacted",
            "retry_export",
            "regenerate_export",
            "approve_deletion",
            "request_sudo_for_raw"
          ]),
          redacted_summary: nonEmptyStringSchema,
          artifact_id: idSchema.nullable(),
          storage_uri: nonEmptyStringSchema.nullable(),
          storage_key_short: nonEmptyStringSchema.nullable(),
          artifact_exists: z.boolean(),
          checksum: nonEmptyStringSchema.nullable(),
          size_bytes: z.number().int().nonnegative().nullable(),
          deletion_status: z.enum(["active", "delete_requested", "deleted", "failed"]),
          deletion_attempts: z.number().int().nonnegative(),
          last_deletion_error: nonEmptyStringSchema.nullable(),
          retry_status: z.enum(["not_needed", "retry_available", "retrying", "blocked"]),
          generated_at: isoDateTimeSchema.nullable(),
          deletion_note: nonEmptyStringSchema.nullable()
        })
        .strict()
    ),
    summary: z
      .object({
        ready_redacted: z.number().int().nonnegative(),
        raw_locked: z.number().int().nonnegative(),
        failed_export: z.number().int().nonnegative(),
        deletion_pending: z.number().int().nonnegative(),
        deleted: z.number().int().nonnegative()
      })
      .strict(),
    notes: z.array(nonEmptyStringSchema)
  })
  .strict();
export type AdminReportsResponse = z.infer<typeof adminReportsResponseSchema>;

export const reportExportActionResponseSchema = z
  .object({
    report: recommendationReportSchema,
    artifacts: z.array(reportArtifactSchema),
    redaction_state: z.enum(["redacted", "revealed", "not_sensitive"]),
    todo: nonEmptyStringSchema
  })
  .strict();
export type ReportExportActionResponse = z.infer<typeof reportExportActionResponseSchema>;

export const reportRevealResponseSchema = z
  .object({
    report_id: idSchema,
    redacted_summary: nonEmptyStringSchema,
    raw_report: z.null(),
    todo: nonEmptyStringSchema
  })
  .strict();
export type ReportRevealResponse = z.infer<typeof reportRevealResponseSchema>;

export const reportDeleteRequestSchema = z
  .object({
    reason_code: nonEmptyStringSchema,
    sudo_request_id: idSchema.nullable().optional()
  })
  .strict();
export type ReportDeleteRequest = z.infer<typeof reportDeleteRequestSchema>;

export const reportDeleteResponseSchema = z
  .object({
    report_id: idSchema,
    deletion_queued: z.boolean(),
    deletion_status: z.enum(["deletion_pending", "deleted", "failed"]),
    artifacts_deleted: z.number().int().nonnegative(),
    artifact_failures: z.number().int().nonnegative(),
    scoped_records_marked: z.array(nonEmptyStringSchema),
    todo: nonEmptyStringSchema
  })
  .strict();
export type ReportDeleteResponse = z.infer<typeof reportDeleteResponseSchema>;
