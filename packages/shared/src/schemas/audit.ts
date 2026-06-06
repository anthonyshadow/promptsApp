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

export const auditConstraintsSchema = z
  .object({
    requiresJson: z.boolean(),
    usesTools: z.boolean(),
    usesImages: z.boolean(),
    needsStructuredOutput: z.boolean(),
    maxLatencyMs: z.number().int().positive().nullable(),
    minContextWindow: z.number().int().positive().nullable()
  })
  .strict();
export type AuditConstraints = z.infer<typeof auditConstraintsSchema>;

export const auditRequestSchema = z
  .object({
    provider: providerSchema,
    modelId: z.string().min(1),
    prompt: z.string().min(1),
    taskType: taskTypeSchema,
    monthlyCalls: z.number().positive(),
    priority: prioritySchema,
    constraints: auditConstraintsSchema,
    promptVersionId: idSchema.optional(),
    source: auditSourceSchema.optional(),
    contactEmail: z.string().email().optional(),
    company: z.string().min(1).optional(),
    ctaClicked: freeAuditCtaSchema.optional()
  })
  .strict();
export type AuditRequest = z.infer<typeof auditRequestSchema>;

export const costEstimateStatusSchema = z.enum(["verified", "unverified", "blocked"]);
export type CostEstimateStatus = z.infer<typeof costEstimateStatusSchema>;

export const monthlyCostEstimateSchema = z
  .object({
    estimatedMonthlyCostUsd: z.number().nonnegative().nullable(),
    inputCostUsd: z.number().nonnegative().nullable(),
    outputCostUsd: z.number().nonnegative().nullable(),
    estimateStatus: costEstimateStatusSchema,
    unverified: z.boolean(),
    registryFreshness: registryFreshnessSchema,
    metadataWarnings: z.array(z.string().min(1)),
    pricingNote: z.string().min(1)
  })
  .strict();
export type MonthlyCostEstimate = z.infer<typeof monthlyCostEstimateSchema>;

export const sensitiveFindingSchema = z
  .object({
    type: z.enum([
      "api_key",
      "credential",
      "common_secret",
      "pii",
      "proprietary_policy"
    ]),
    severity: riskLevelSchema,
    label: z.string().min(1),
    redactedPreview: z.string().min(1),
    reasonCode: z.string().min(1)
  })
  .strict();
export type SensitiveFinding = z.infer<typeof sensitiveFindingSchema>;

export const suggestedModelRoleSchema = z
  .object({
    role: z.enum(["baseline", "cheaper_candidate", "stronger_fallback", "registry_verification"]),
    modelId: z.string().min(1),
    registryRecordId: idSchema.nullable(),
    reason: z.string().min(1)
  })
  .strict();
export type SuggestedModelRole = z.infer<typeof suggestedModelRoleSchema>;

export const freeAuditCaptureSchema = z
  .object({
    id: idSchema,
    accountId: idSchema.nullable(),
    contactId: idSchema.nullable(),
    opportunityId: idSchema.nullable(),
    ctaClicked: freeAuditCtaSchema,
    redactedPromptPreview: z.string().min(1),
    shareableSummary: z.string().min(1)
  })
  .strict();
export type FreeAuditCapture = z.infer<typeof freeAuditCaptureSchema>;

export const auditResponseSchema = z
  .object({
    id: idSchema,
    inputTokens: z.number().int().nonnegative(),
    estimatedOutputTokens: z.number().int().nonnegative(),
    monthlyCostEstimate: monthlyCostEstimateSchema,
    modelFit: modelFitSchema,
    modelFitReasons: z.array(z.string().min(1)),
    wasteFindings: z.array(z.string().min(1)),
    riskLevel: riskLevelSchema,
    sensitiveFindings: z.array(sensitiveFindingSchema),
    compressionGuardrails: z.array(z.string().min(1)),
    suggestedModels: z.array(z.string().min(1)),
    suggestedModelRoles: z.array(suggestedModelRoleSchema),
    suggestedNextAction: z.string().min(1),
    registryFreshness: registryFreshnessSchema,
    freeAudit: freeAuditCaptureSchema.optional(),
    createdAt: isoDateTimeSchema
  })
  .strict();
export type AuditResponse = z.infer<typeof auditResponseSchema>;
