import { z } from 'zod';

export { z };

export const idSchema = z.string().min(1);
export const isoDateTimeSchema = z.string().datetime();
export const metadataSchema = z.record(z.unknown());

export const providerSchema = z.enum(["openai", "anthropic", "gemini"]);
export type Provider = z.infer<typeof providerSchema>;

export const providerConnectionStatusSchema = z.enum(["active", "revoked", "error"]);
export type ProviderConnectionStatus = z.infer<typeof providerConnectionStatusSchema>;

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

export const modelRegistryApprovalStateSchema = z.enum([
  "draft",
  "pending_review",
  "approved",
  "rejected",
  "superseded"
]);
export type ModelRegistryApprovalState = z.infer<typeof modelRegistryApprovalStateSchema>;

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

export const reportArtifactPrivacyStateSchema = z.enum([
  "ready_redacted",
  "raw_locked",
  "failed_export",
  "deletion_pending",
  "deleted"
]);
export type ReportArtifactPrivacyState = z.infer<typeof reportArtifactPrivacyStateSchema>;

export const artifactDeletionStatusSchema = z.enum([
  "active",
  "delete_requested",
  "deleted",
  "failed"
]);
export type ArtifactDeletionStatus = z.infer<typeof artifactDeletionStatusSchema>;

export const retentionStateSchema = z.enum(["active", "delete_requested", "deleted"]);
export type RetentionState = z.infer<typeof retentionStateSchema>;

export const deletionRequestStatusSchema = z.enum([
  "requested",
  "processing",
  "completed",
  "failed"
]);
export type DeletionRequestStatus = z.infer<typeof deletionRequestStatusSchema>;

export const adminActionScopeSchema = z.enum([
  "read_metadata",
  "reveal_prompt",
  "reveal_report",
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

export const adminRoleNameSchema = z.enum(["owner", "ops", "support", "finance", "read_only"]);
export type AdminRoleName = z.infer<typeof adminRoleNameSchema>;

export const adminUserStatusSchema = z.enum(["active", "disabled"]);
export type AdminUserStatus = z.infer<typeof adminUserStatusSchema>;

export const sudoRequestStatusSchema = z.enum([
  "requested",
  "active",
  "approved",
  "denied",
  "expired",
  "revoked",
  "used"
]);
export type SudoRequestStatus = z.infer<typeof sudoRequestStatusSchema>;

export const redactionStateSchema = z.enum(["redacted", "revealed", "not_sensitive"]);
export type RedactionState = z.infer<typeof redactionStateSchema>;

export const accountStageSchema = z.enum([
  "new_audit",
  "qualified",
  "eval_ready",
  "trial",
  "paid",
  "needs_review"
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
  "admin_seats",
  "hosted_eval_runs",
  "prompt_history",
  "csv_upload",
  "pdf_export",
  "byok",
  "seats",
  "cli_beta"
]);
export type EntitlementFeature = z.infer<typeof entitlementFeatureSchema>;

export const usageLedgerUnitSchema = z.enum([
  "audit",
  "project",
  "eval_run",
  "report_export",
  "seat",
  "prompt_version",
  "csv_upload",
  "pdf_export",
  "provider_key",
  "feature_flag"
]);
export type UsageLedgerUnit = z.infer<typeof usageLedgerUnitSchema>;

export const ledgerDirectionSchema = z.enum(["debit", "credit"]);
export type LedgerDirection = z.infer<typeof ledgerDirectionSchema>;
