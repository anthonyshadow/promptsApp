import { z } from "zod";

export const idSchema = z.string().min(1);
export const isoDateTimeSchema = z.string().datetime();
export const metadataSchema = z.record(z.unknown());

export const providerSchema = z.enum(["openai", "anthropic", "gemini"]);
export type Provider = z.infer<typeof providerSchema>;

export const taskTypeSchema = z.enum([
  "support",
  "summarization",
  "extraction",
  "coding",
  "rag",
  "agent",
  "classification",
  "other"
]);
export type TaskType = z.infer<typeof taskTypeSchema>;

export const prioritySchema = z.enum(["cost", "quality", "latency", "balanced"]);
export type Priority = z.infer<typeof prioritySchema>;

export const auditSourceSchema = z.enum(["app", "free_audit"]);
export type AuditSource = z.infer<typeof auditSourceSchema>;

export const freeAuditCtaSchema = z.enum([
  "preview",
  "get_audit_report",
  "create_project",
  "run_evals"
]);
export type FreeAuditCta = z.infer<typeof freeAuditCtaSchema>;

export const riskLevelSchema = z.enum(["low", "medium", "high", "critical"]);
export type RiskLevel = z.infer<typeof riskLevelSchema>;

export const modelFitSchema = z.enum(["overpowered", "appropriate", "underpowered"]);
export type ModelFit = z.infer<typeof modelFitSchema>;

export const registryFreshnessSchema = z.enum(["fresh", "stale", "unverified", "deprecated"]);
export type RegistryFreshness = z.infer<typeof registryFreshnessSchema>;

export const stabilityStatusSchema = z.enum([
  "stable",
  "preview",
  "latest",
  "experimental",
  "deprecated",
  "unverified"
]);
export type StabilityStatus = z.infer<typeof stabilityStatusSchema>;

export const latencyTierSchema = z.enum(["low", "standard", "high", "unknown"]);
export type LatencyTier = z.infer<typeof latencyTierSchema>;

export const qualityTierSchema = z.enum(["economy", "balanced", "frontier", "unknown"]);
export type QualityTier = z.infer<typeof qualityTierSchema>;

export const promptStatusSchema = z.enum(["draft", "active", "archived"]);
export type PromptStatus = z.infer<typeof promptStatusSchema>;

export const candidateStrategySchema = z.enum([
  "baseline",
  "conservative",
  "balanced",
  "aggressive",
  "output_lite",
  "model_specific"
]);
export type CandidateStrategy = z.infer<typeof candidateStrategySchema>;

export const evalStatusSchema = z.enum([
  "queued",
  "running",
  "rate_limited",
  "retrying",
  "complete",
  "failed"
]);
export type EvalStatus = z.infer<typeof evalStatusSchema>;

export const evalVerdictSchema = z.enum(["pass", "fail", "blocked"]);
export type EvalVerdict = z.infer<typeof evalVerdictSchema>;

export const testCheckTypeSchema = z.enum([
  "exact",
  "json_schema",
  "regex",
  "required_phrase",
  "forbidden_phrase",
  "llm_judge",
  "human"
]);
export type TestCheckType = z.infer<typeof testCheckTypeSchema>;

export const reportStatusSchema = z.enum(["draft", "blocked", "ready", "exported"]);
export type ReportStatus = z.infer<typeof reportStatusSchema>;

export const reportArtifactFormatSchema = z.enum(["markdown", "json", "pdf"]);
export type ReportArtifactFormat = z.infer<typeof reportArtifactFormatSchema>;

export const adminActionScopeSchema = z.enum([
  "read_metadata",
  "reveal_prompt",
  "manage_workspace",
  "manage_model_registry",
  "retry_eval",
  "delete_report",
  "issue_billing_credit",
  "impersonate_user",
  "revoke_user",
  "break_glass"
]);
export type AdminActionScope = z.infer<typeof adminActionScopeSchema>;

export const redactionStateSchema = z.enum(["redacted", "revealed", "not_sensitive"]);
export type RedactionState = z.infer<typeof redactionStateSchema>;

export const accountStageSchema = z.enum([
  "free_audit",
  "trial",
  "qualified",
  "customer",
  "churned",
  "internal"
]);
export type AccountStage = z.infer<typeof accountStageSchema>;

export const opportunityStageSchema = z.enum([
  "new",
  "evaluating",
  "eval_ready",
  "recommended",
  "won",
  "lost"
]);
export type OpportunityStage = z.infer<typeof opportunityStageSchema>;

export const evalReadinessSchema = z.enum(["not_ready", "needs_tests", "eval_ready", "complete"]);
export type EvalReadiness = z.infer<typeof evalReadinessSchema>;

export const entitlementFeatureSchema = z.enum([
  "free_audits",
  "projects",
  "eval_runs",
  "report_exports",
  "admin_seats"
]);
export type EntitlementFeature = z.infer<typeof entitlementFeatureSchema>;

export const usageLedgerUnitSchema = z.enum(["audit", "project", "eval_run", "report_export", "seat"]);
export type UsageLedgerUnit = z.infer<typeof usageLedgerUnitSchema>;

export const ledgerDirectionSchema = z.enum(["debit", "credit"]);
export type LedgerDirection = z.infer<typeof ledgerDirectionSchema>;

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

export const modelRegistryRecordSchema = z
  .object({
    id: idSchema,
    provider: providerSchema,
    model_id: z.string().min(1),
    display_name: z.string().min(1),
    input_price_per_million_tokens: z.number().nonnegative(),
    output_price_per_million_tokens: z.number().nonnegative(),
    cached_input_price_per_million_tokens: z.number().nonnegative().nullable(),
    context_window: z.number().int().positive(),
    max_output_tokens: z.number().int().positive(),
    supports_text: z.boolean(),
    supports_image: z.boolean(),
    supports_audio: z.boolean(),
    supports_video: z.boolean(),
    supports_tools: z.boolean(),
    supports_structured_output: z.boolean(),
    latency_tier: latencyTierSchema,
    quality_tier: qualityTierSchema,
    recommended_task_types: z.array(taskTypeSchema),
    stability_status: stabilityStatusSchema,
    freshness_status: registryFreshnessSchema,
    source_url: z.string().url().nullable(),
    last_verified_at: isoDateTimeSchema.nullable(),
    verified_by: z.string().min(1).nullable(),
    pricing_note: z.string().min(1),
    is_mock: z.boolean(),
    metadata: metadataSchema,
    created_at: isoDateTimeSchema,
    updated_at: isoDateTimeSchema
  })
  .strict();
export type ModelRegistryRecord = z.infer<typeof modelRegistryRecordSchema>;

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

export const qualityCheckDefinitionSchema = z
  .object({
    id: idSchema,
    type: testCheckTypeSchema,
    description: z.string().min(1),
    must_pass: z.boolean(),
    field_path: z.string().min(1).nullable(),
    expected_value: z.unknown().nullable(),
    pattern: z.string().min(1).nullable(),
    placeholder_note: z.string().min(1).nullable()
  })
  .strict();
export type QualityCheckDefinition = z.infer<typeof qualityCheckDefinitionSchema>;

export const qualityContractSchema = z
  .object({
    id: idSchema,
    project_id: idSchema,
    task: z.string().min(1),
    required_output: z.string().min(1),
    must_preserve: z.array(z.string().min(1)),
    forbidden_behavior: z.array(z.string().min(1)),
    pass_threshold: z.number().min(0).max(1),
    must_pass_check_ids: z.array(idSchema),
    check_definitions: z.array(qualityCheckDefinitionSchema).min(1),
    notes: z.string().min(1).nullable(),
    is_mock: z.boolean(),
    created_at: isoDateTimeSchema,
    updated_at: isoDateTimeSchema
  })
  .strict();
export type QualityContract = z.infer<typeof qualityContractSchema>;

export const testCaseCheckSchema = qualityCheckDefinitionSchema;
export type TestCaseCheck = z.infer<typeof testCaseCheckSchema>;

export const testCaseSchema = z
  .object({
    id: idSchema,
    project_id: idSchema,
    quality_contract_id: idSchema,
    name: z.string().min(1),
    input_variables: metadataSchema,
    expected_output: z.unknown().nullable(),
    checks: z.array(testCaseCheckSchema).min(1),
    is_mock: z.boolean(),
    created_at: isoDateTimeSchema,
    updated_at: isoDateTimeSchema
  })
  .strict();
export type TestCase = z.infer<typeof testCaseSchema>;

export const evalRunSchema = z
  .object({
    id: idSchema,
    project_id: idSchema,
    quality_contract_id: idSchema,
    baseline_prompt_version_id: idSchema,
    candidate_ids: z.array(idSchema),
    model_registry_record_ids: z.array(idSchema),
    status: evalStatusSchema,
    pass_threshold: z.number().min(0).max(1),
    is_mock: z.boolean(),
    queued_at: isoDateTimeSchema,
    started_at: isoDateTimeSchema.nullable(),
    completed_at: isoDateTimeSchema.nullable()
  })
  .strict();
export type EvalRun = z.infer<typeof evalRunSchema>;

export const evalResultSchema = z
  .object({
    id: idSchema,
    eval_run_id: idSchema,
    candidate_id: idSchema,
    prompt_version_id: idSchema.nullable(),
    model_registry_record_id: idSchema,
    provider: providerSchema,
    model_id: z.string().min(1),
    quality_score: z.number().min(0).max(1),
    pass_rate: z.number().min(0).max(1),
    must_pass_failures: z.number().int().nonnegative(),
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
    estimated_cost_usd: z.number().nonnegative().nullable(),
    cost_estimate_status: costEstimateStatusSchema,
    latency_ms: z.number().int().nonnegative().nullable(),
    risk_level: riskLevelSchema,
    verdict: evalVerdictSchema,
    failed_check_ids: z.array(idSchema),
    is_mock: z.boolean(),
    created_at: isoDateTimeSchema
  })
  .strict();
export type EvalResult = z.infer<typeof evalResultSchema>;

export const recommendationReportSchema = z
  .object({
    id: idSchema,
    project_id: idSchema,
    eval_run_id: idSchema,
    status: reportStatusSchema,
    winner_result_id: idSchema.nullable(),
    cheaper_alternative_result_id: idSchema.nullable(),
    stronger_fallback_result_id: idSchema.nullable(),
    risk_summary: z.array(z.string().min(1)),
    savings_summary: z.string().min(1).nullable(),
    production_recommendation_allowed: z.boolean(),
    production_blockers: z.array(z.string().min(1)),
    registry_freshness: registryFreshnessSchema,
    is_mock: z.boolean(),
    generated_at: isoDateTimeSchema.nullable(),
    created_at: isoDateTimeSchema,
    updated_at: isoDateTimeSchema
  })
  .strict();
export type RecommendationReport = z.infer<typeof recommendationReportSchema>;

export const reportArtifactSchema = z
  .object({
    id: idSchema,
    report_id: idSchema,
    format: reportArtifactFormatSchema,
    storage_uri: z.string().min(1),
    checksum: z.string().min(1).nullable(),
    size_bytes: z.number().int().nonnegative().nullable(),
    redaction_state: redactionStateSchema,
    is_mock: z.boolean(),
    created_at: isoDateTimeSchema
  })
  .strict();
export type ReportArtifact = z.infer<typeof reportArtifactSchema>;

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

export const freeAuditSchema = z
  .object({
    id: idSchema,
    account_id: idSchema.nullable(),
    project_id: idSchema.nullable(),
    provider: providerSchema,
    current_model_id: z.string().min(1),
    task_type: taskTypeSchema,
    monthly_calls: z.number().int().positive(),
    model_fit: modelFitSchema,
    savings_opportunity_usd: z.number().nonnegative().nullable(),
    eval_readiness: evalReadinessSchema,
    contact_email: z.string().email().nullable(),
    company: z.string().min(1).nullable(),
    cta_clicked: freeAuditCtaSchema,
    redacted_prompt_preview: z.string().min(1),
    shareable_summary: z.string().min(1),
    is_mock: z.boolean(),
    created_at: isoDateTimeSchema
  })
  .strict();
export type FreeAudit = z.infer<typeof freeAuditSchema>;
