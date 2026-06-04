import type { ZodType } from "zod";
import {
  accountSchema,
  adminAuditLogSchema,
  contactSchema,
  entitlementSchema,
  evalResultSchema,
  evalRunSchema,
  freeAuditSchema,
  modelRegistryRecordSchema,
  optimizationCandidateSchema,
  opportunitySchema,
  promptAnalysisSchema,
  promptProjectSchema,
  promptSchema,
  promptVersionSchema,
  qualityContractSchema,
  recommendationReportSchema,
  reportArtifactSchema,
  testCaseSchema,
  usageLedgerEntrySchema,
  userSchema,
  workspaceSchema,
  type Account,
  type AdminAuditLog,
  type Contact,
  type Entitlement,
  type EvalResult,
  type EvalRun,
  type FreeAudit,
  type ModelRegistryRecord,
  type OptimizationCandidate,
  type Opportunity,
  type Prompt,
  type PromptAnalysis,
  type PromptProject,
  type PromptVersion,
  type QualityContract,
  type RecommendationReport,
  type ReportArtifact,
  type TestCase,
  type UsageLedgerEntry,
  type User,
  type Workspace
} from "../schemas";
import type {
  AppendOnlyRepository,
  CrudRepository,
  IdentifiedRecord,
  PromptOptsRepository,
  RepositorySeed
} from "./types";

const DEMO_TIMESTAMP = "2026-01-15T12:00:00.000Z";

export const DEMO_IDS = {
  workspace: "workspace_acme_ai",
  user: "user_acme_owner",
  account: "account_acme_ai",
  contact: "contact_acme_ops",
  opportunity: "opportunity_acme_support_classifier",
  project: "project_support_classifier",
  prompt: "prompt_support_classifier",
  promptVersion: "prompt_version_support_classifier_v1",
  promptAnalysis: "prompt_analysis_support_classifier_v1",
  qualityContract: "quality_contract_support_classifier",
  evalRun: "eval_run_support_classifier_demo",
  report: "report_support_classifier_shell",
  reportArtifact: "report_artifact_support_classifier_json",
  freeAudit: "free_audit_acme_support_classifier"
} as const;

function cloneRecord<TRecord>(record: TRecord): TRecord {
  return structuredClone(record);
}

class MemoryCrudRepository<TRecord extends IdentifiedRecord> implements CrudRepository<TRecord> {
  private readonly records = new Map<string, TRecord>();

  constructor(
    private readonly schema: ZodType<TRecord>,
    initialRecords: TRecord[] = []
  ) {
    for (const record of initialRecords) {
      const parsed = this.schema.parse(record);
      if (this.records.has(parsed.id)) {
        throw new Error(`Duplicate seed record id: ${parsed.id}`);
      }
      this.records.set(parsed.id, cloneRecord(parsed));
    }
  }

  async list(): Promise<TRecord[]> {
    return Array.from(this.records.values(), cloneRecord);
  }

  async get(id: string): Promise<TRecord | undefined> {
    const record = this.records.get(id);
    return record ? cloneRecord(record) : undefined;
  }

  async create(record: TRecord): Promise<TRecord> {
    const parsed = this.schema.parse(record);
    if (this.records.has(parsed.id)) {
      throw new Error(`Record already exists: ${parsed.id}`);
    }
    this.records.set(parsed.id, cloneRecord(parsed));
    return cloneRecord(parsed);
  }

  async update(id: string, patch: Partial<Omit<TRecord, "id">>): Promise<TRecord | undefined> {
    const current = this.records.get(id);
    if (!current) {
      return undefined;
    }

    const next = this.schema.parse({ ...current, ...patch, id });
    this.records.set(id, cloneRecord(next));
    return cloneRecord(next);
  }

  async delete(id: string): Promise<boolean> {
    return this.records.delete(id);
  }
}

class MemoryAppendOnlyRepository<TRecord extends IdentifiedRecord>
  implements AppendOnlyRepository<TRecord>
{
  private readonly records = new Map<string, TRecord>();

  constructor(
    private readonly schema: ZodType<TRecord>,
    initialRecords: TRecord[] = []
  ) {
    for (const record of initialRecords) {
      const parsed = this.schema.parse(record);
      if (this.records.has(parsed.id)) {
        throw new Error(`Duplicate seed record id: ${parsed.id}`);
      }
      this.records.set(parsed.id, cloneRecord(parsed));
    }
  }

  async list(): Promise<TRecord[]> {
    return Array.from(this.records.values(), cloneRecord);
  }

  async get(id: string): Promise<TRecord | undefined> {
    const record = this.records.get(id);
    return record ? cloneRecord(record) : undefined;
  }

  async append(record: TRecord): Promise<TRecord> {
    const parsed = this.schema.parse(record);
    if (this.records.has(parsed.id)) {
      throw new Error(`Audit log already exists: ${parsed.id}`);
    }
    this.records.set(parsed.id, cloneRecord(parsed));
    return cloneRecord(parsed);
  }
}

export function createMemoryRepository(seed: RepositorySeed = {}): PromptOptsRepository {
  return {
    users: new MemoryCrudRepository<User>(userSchema, seed.users),
    workspaces: new MemoryCrudRepository<Workspace>(workspaceSchema, seed.workspaces),
    projects: new MemoryCrudRepository<PromptProject>(promptProjectSchema, seed.projects),
    prompts: new MemoryCrudRepository<Prompt>(promptSchema, seed.prompts),
    prompt_versions: new MemoryCrudRepository<PromptVersion>(
      promptVersionSchema,
      seed.prompt_versions
    ),
    prompt_analyses: new MemoryCrudRepository<PromptAnalysis>(
      promptAnalysisSchema,
      seed.prompt_analyses
    ),
    quality_contracts: new MemoryCrudRepository<QualityContract>(
      qualityContractSchema,
      seed.quality_contracts
    ),
    test_cases: new MemoryCrudRepository<TestCase>(testCaseSchema, seed.test_cases),
    eval_runs: new MemoryCrudRepository<EvalRun>(evalRunSchema, seed.eval_runs),
    eval_results: new MemoryCrudRepository<EvalResult>(evalResultSchema, seed.eval_results),
    optimization_candidates: new MemoryCrudRepository<OptimizationCandidate>(
      optimizationCandidateSchema,
      seed.optimization_candidates
    ),
    reports: new MemoryCrudRepository<RecommendationReport>(
      recommendationReportSchema,
      seed.reports
    ),
    report_artifacts: new MemoryCrudRepository<ReportArtifact>(
      reportArtifactSchema,
      seed.report_artifacts
    ),
    model_registry: new MemoryCrudRepository<ModelRegistryRecord>(
      modelRegistryRecordSchema,
      seed.model_registry
    ),
    free_audits: new MemoryCrudRepository<FreeAudit>(freeAuditSchema, seed.free_audits),
    accounts: new MemoryCrudRepository<Account>(accountSchema, seed.accounts),
    contacts: new MemoryCrudRepository<Contact>(contactSchema, seed.contacts),
    opportunities: new MemoryCrudRepository<Opportunity>(opportunitySchema, seed.opportunities),
    admin_audit_logs: new MemoryAppendOnlyRepository<AdminAuditLog>(
      adminAuditLogSchema,
      seed.admin_audit_logs
    ),
    entitlements: new MemoryCrudRepository<Entitlement>(entitlementSchema, seed.entitlements),
    usage_ledger: new MemoryCrudRepository<UsageLedgerEntry>(
      usageLedgerEntrySchema,
      seed.usage_ledger
    )
  };
}

export function createDemoRepositorySeed(): Required<RepositorySeed> {
  const openAiModelId = "model_registry_openai_demo_balanced";
  const anthropicModelId = "model_registry_anthropic_demo_balanced";
  const geminiModelId = "model_registry_gemini_demo_balanced";
  const candidateBaselineId = "candidate_support_classifier_baseline";
  const candidateBalancedId = "candidate_support_classifier_balanced";
  const mustPassCheckId = "check_support_classifier_json_shape";

  return {
    users: [
      {
        id: DEMO_IDS.user,
        email: "ops@acme-ai.example",
        name: "Acme Ops",
        workspace_id: DEMO_IDS.workspace,
        is_mock: true,
        created_at: DEMO_TIMESTAMP
      }
    ],
    workspaces: [
      {
        id: DEMO_IDS.workspace,
        name: "Acme AI",
        slug: "acme-ai",
        is_mock: true,
        created_at: DEMO_TIMESTAMP,
        updated_at: DEMO_TIMESTAMP
      }
    ],
    projects: [
      {
        id: DEMO_IDS.project,
        workspace_id: DEMO_IDS.workspace,
        name: "Support classifier",
        task_type: "support",
        current_provider: "openai",
        current_model_id: "openai-demo-balanced",
        status: "active",
        is_mock: true,
        created_at: DEMO_TIMESTAMP,
        updated_at: DEMO_TIMESTAMP
      }
    ],
    prompts: [
      {
        id: DEMO_IDS.prompt,
        project_id: DEMO_IDS.project,
        name: "Inbound support classifier",
        current_version_id: DEMO_IDS.promptVersion,
        redacted_preview: "Classifies an inbound support message and returns redacted JSON fields.",
        is_mock: true,
        created_at: DEMO_TIMESTAMP,
        updated_at: DEMO_TIMESTAMP
      }
    ],
    prompt_versions: [
      {
        id: DEMO_IDS.promptVersion,
        prompt_id: DEMO_IDS.prompt,
        version: 1,
        label: "Baseline support classifier",
        prompt_text:
          "Classify the inbound support message. Return JSON with category, urgency, summary, and suggested_reply. Message: {{customer_message}} Account tier: {{account_tier}}",
        variables: ["customer_message", "account_tier"],
        status: "active",
        redacted_preview: "Classify a support message into category, urgency, summary, and reply.",
        is_mock: true,
        created_by_user_id: DEMO_IDS.user,
        created_at: DEMO_TIMESTAMP
      }
    ],
    prompt_analyses: [
      {
        id: DEMO_IDS.promptAnalysis,
        prompt_version_id: DEMO_IDS.promptVersion,
        provider: "openai",
        model_id: "openai-demo-balanced",
        task_type: "support",
        input_tokens: 118,
        estimated_output_tokens: 150,
        model_fit: "overpowered",
        waste_findings: ["Prompt repeats output requirements that can be collapsed."],
        risk_level: "medium",
        compression_guardrails: ["Preserve JSON shape.", "Keep urgency labels exact."],
        registry_freshness: "unverified",
        is_mock: true,
        created_at: DEMO_TIMESTAMP
      }
    ],
    quality_contracts: [
      {
        id: DEMO_IDS.qualityContract,
        project_id: DEMO_IDS.project,
        pass_threshold: 0.95,
        must_pass_check_ids: [mustPassCheckId],
        notes: "Synthetic MVP contract for support classification.",
        is_mock: true,
        created_at: DEMO_TIMESTAMP,
        updated_at: DEMO_TIMESTAMP
      }
    ],
    test_cases: [
      {
        id: "test_case_support_classifier_billing",
        project_id: DEMO_IDS.project,
        quality_contract_id: DEMO_IDS.qualityContract,
        name: "Billing question",
        input_variables: {
          customer_message: "I was charged twice for the same subscription period.",
          account_tier: "team"
        },
        expected_output: { category: "billing", urgency: "medium" },
        checks: [
          {
            id: mustPassCheckId,
            type: "json_schema",
            description: "Output keeps required JSON keys.",
            must_pass: true,
            field_path: null,
            expected_value: ["category", "urgency", "summary", "suggested_reply"],
            pattern: null
          },
          {
            id: "check_support_classifier_billing_label",
            type: "exact_label",
            description: "Billing messages are labeled billing.",
            must_pass: false,
            field_path: "category",
            expected_value: "billing",
            pattern: null
          }
        ],
        is_mock: true,
        created_at: DEMO_TIMESTAMP,
        updated_at: DEMO_TIMESTAMP
      },
      {
        id: "test_case_support_classifier_outage",
        project_id: DEMO_IDS.project,
        quality_contract_id: DEMO_IDS.qualityContract,
        name: "Service outage",
        input_variables: {
          customer_message: "The dashboard is unavailable for our whole team.",
          account_tier: "enterprise"
        },
        expected_output: { category: "incident", urgency: "high" },
        checks: [
          {
            id: "check_support_classifier_outage_urgency",
            type: "exact_label",
            description: "Outages affecting a team are high urgency.",
            must_pass: true,
            field_path: "urgency",
            expected_value: "high",
            pattern: null
          }
        ],
        is_mock: true,
        created_at: DEMO_TIMESTAMP,
        updated_at: DEMO_TIMESTAMP
      },
      {
        id: "test_case_support_classifier_how_to",
        project_id: DEMO_IDS.project,
        quality_contract_id: DEMO_IDS.qualityContract,
        name: "How-to request",
        input_variables: {
          customer_message: "How do I invite a new teammate?",
          account_tier: "starter"
        },
        expected_output: { category: "how_to", urgency: "low" },
        checks: [
          {
            id: "check_support_classifier_how_to_phrase",
            type: "required_phrase",
            description: "Suggested reply mentions invite flow.",
            must_pass: false,
            field_path: "suggested_reply",
            expected_value: "invite",
            pattern: null
          }
        ],
        is_mock: true,
        created_at: DEMO_TIMESTAMP,
        updated_at: DEMO_TIMESTAMP
      },
      {
        id: "test_case_support_classifier_cancel",
        project_id: DEMO_IDS.project,
        quality_contract_id: DEMO_IDS.qualityContract,
        name: "Cancellation request",
        input_variables: {
          customer_message: "Please cancel our plan at the end of this month.",
          account_tier: "team"
        },
        expected_output: { category: "account", urgency: "medium" },
        checks: [
          {
            id: "check_support_classifier_cancel_regex",
            type: "regex",
            description: "Summary references cancellation.",
            must_pass: false,
            field_path: "summary",
            expected_value: null,
            pattern: "cancel|cancellation"
          }
        ],
        is_mock: true,
        created_at: DEMO_TIMESTAMP,
        updated_at: DEMO_TIMESTAMP
      },
      {
        id: "test_case_support_classifier_tone",
        project_id: DEMO_IDS.project,
        quality_contract_id: DEMO_IDS.qualityContract,
        name: "Frustrated customer tone",
        input_variables: {
          customer_message: "I have asked three times and still do not have an answer.",
          account_tier: "enterprise"
        },
        expected_output: { category: "support", urgency: "high" },
        checks: [
          {
            id: "check_support_classifier_tone_judge",
            type: "llm_judge",
            description: "Suggested reply is empathetic and concise.",
            must_pass: false,
            field_path: "suggested_reply",
            expected_value: "empathetic_concise",
            pattern: null
          }
        ],
        is_mock: true,
        created_at: DEMO_TIMESTAMP,
        updated_at: DEMO_TIMESTAMP
      }
    ],
    eval_runs: [
      {
        id: DEMO_IDS.evalRun,
        project_id: DEMO_IDS.project,
        quality_contract_id: DEMO_IDS.qualityContract,
        baseline_prompt_version_id: DEMO_IDS.promptVersion,
        candidate_ids: [candidateBaselineId, candidateBalancedId],
        model_registry_record_ids: [openAiModelId],
        status: "queued",
        pass_threshold: 0.95,
        is_mock: true,
        queued_at: DEMO_TIMESTAMP,
        started_at: null,
        completed_at: null
      }
    ],
    eval_results: [],
    optimization_candidates: [
      {
        id: candidateBaselineId,
        prompt_version_id: DEMO_IDS.promptVersion,
        analysis_id: DEMO_IDS.promptAnalysis,
        strategy: "baseline",
        candidate_prompt_text:
          "Classify the inbound support message. Return JSON with category, urgency, summary, and suggested_reply. Message: {{customer_message}} Account tier: {{account_tier}}",
        rationale: "Baseline regression control.",
        risk_level: "low",
        expected_token_delta: 0,
        is_baseline: true,
        is_mock: true,
        created_at: DEMO_TIMESTAMP
      },
      {
        id: candidateBalancedId,
        prompt_version_id: DEMO_IDS.promptVersion,
        analysis_id: DEMO_IDS.promptAnalysis,
        strategy: "balanced",
        candidate_prompt_text:
          "Return JSON {category, urgency, summary, suggested_reply} for {{customer_message}}. Preserve exact urgency labels. Account tier: {{account_tier}}",
        rationale: "Compacts instructions while preserving required output shape.",
        risk_level: "medium",
        expected_token_delta: -42,
        is_baseline: false,
        is_mock: true,
        created_at: DEMO_TIMESTAMP
      }
    ],
    reports: [
      {
        id: DEMO_IDS.report,
        project_id: DEMO_IDS.project,
        eval_run_id: DEMO_IDS.evalRun,
        status: "blocked",
        winner_result_id: null,
        cheaper_alternative_result_id: null,
        stronger_fallback_result_id: null,
        risk_summary: ["Eval run has not completed, so risk must be shown before savings."],
        savings_summary: null,
        production_recommendation_allowed: false,
        production_blockers: [
          "Eval pass threshold has not been met.",
          "Model registry rows are mock/unverified."
        ],
        registry_freshness: "unverified",
        is_mock: true,
        generated_at: null,
        created_at: DEMO_TIMESTAMP,
        updated_at: DEMO_TIMESTAMP
      }
    ],
    report_artifacts: [
      {
        id: DEMO_IDS.reportArtifact,
        report_id: DEMO_IDS.report,
        format: "json",
        storage_uri: "memory://reports/report_support_classifier_shell.json",
        checksum: null,
        size_bytes: null,
        redaction_state: "redacted",
        is_mock: true,
        created_at: DEMO_TIMESTAMP
      }
    ],
    model_registry: [
      createDemoModelRegistryRecord({
        id: openAiModelId,
        provider: "openai",
        model_id: "openai-demo-balanced",
        display_name: "OpenAI Demo Balanced"
      }),
      createDemoModelRegistryRecord({
        id: anthropicModelId,
        provider: "anthropic",
        model_id: "anthropic-demo-balanced",
        display_name: "Anthropic Demo Balanced"
      }),
      createDemoModelRegistryRecord({
        id: geminiModelId,
        provider: "gemini",
        model_id: "gemini-demo-balanced",
        display_name: "Gemini Demo Balanced"
      })
    ],
    free_audits: [
      {
        id: DEMO_IDS.freeAudit,
        account_id: DEMO_IDS.account,
        project_id: DEMO_IDS.project,
        provider: "openai",
        current_model_id: "openai-demo-balanced",
        task_type: "support",
        monthly_calls: 250000,
        model_fit: "overpowered",
        savings_opportunity_usd: null,
        eval_readiness: "eval_ready",
        contact_email: "ops@acme-ai.example",
        redacted_prompt_preview: "Support classifier prompt with variables only.",
        is_mock: true,
        created_at: DEMO_TIMESTAMP
      }
    ],
    accounts: [
      {
        id: DEMO_IDS.account,
        name: "Acme AI",
        workspace_id: DEMO_IDS.workspace,
        stage: "free_audit",
        owner_admin_user_id: null,
        domain: "acme-ai.example",
        redacted_prompt_preview: "Support classifier prompt with variables only.",
        is_mock: true,
        created_at: DEMO_TIMESTAMP,
        updated_at: DEMO_TIMESTAMP
      }
    ],
    contacts: [
      {
        id: DEMO_IDS.contact,
        account_id: DEMO_IDS.account,
        name: "Acme Ops",
        email: "ops@acme-ai.example",
        role: "Operations",
        is_mock: true,
        created_at: DEMO_TIMESTAMP,
        updated_at: DEMO_TIMESTAMP
      }
    ],
    opportunities: [
      {
        id: DEMO_IDS.opportunity,
        account_id: DEMO_IDS.account,
        project_id: DEMO_IDS.project,
        stage: "eval_ready",
        provider: "openai",
        current_model_id: "openai-demo-balanced",
        estimated_monthly_calls: 250000,
        savings_opportunity_usd: null,
        eval_readiness: "eval_ready",
        is_mock: true,
        created_at: DEMO_TIMESTAMP,
        updated_at: DEMO_TIMESTAMP
      }
    ],
    admin_audit_logs: [
      {
        id: "admin_audit_log_demo_registry_unverified",
        admin_user_id: "admin_user_demo",
        workspace_id: null,
        account_id: null,
        target_type: "model_registry",
        target_id: openAiModelId,
        action: "seed_mock_registry_record",
        action_scope: "manage_model_registry",
        reason_code: "demo_seed",
        sudo_request_id: null,
        ip_address: "127.0.0.1",
        user_agent: "PromptOpts seed",
        redaction_state: "not_sensitive",
        metadata: { pricing: "placeholder_unverified" },
        is_mock: true,
        created_at: DEMO_TIMESTAMP
      }
    ],
    entitlements: [
      {
        id: "entitlement_acme_free_audits",
        workspace_id: DEMO_IDS.workspace,
        plan_id: "demo",
        feature: "free_audits",
        limit: 5,
        used: 1,
        is_mock: true,
        starts_at: DEMO_TIMESTAMP,
        ends_at: null,
        created_at: DEMO_TIMESTAMP
      }
    ],
    usage_ledger: [
      {
        id: "usage_ledger_acme_free_audit",
        workspace_id: DEMO_IDS.workspace,
        feature: "free_audits",
        quantity: 1,
        unit: "audit",
        direction: "debit",
        source_type: "free_audit",
        source_id: DEMO_IDS.freeAudit,
        is_mock: true,
        created_at: DEMO_TIMESTAMP
      }
    ]
  };
}

function createDemoModelRegistryRecord(input: {
  id: string;
  provider: "openai" | "anthropic" | "gemini";
  model_id: string;
  display_name: string;
}): ModelRegistryRecord {
  return {
    id: input.id,
    provider: input.provider,
    model_id: input.model_id,
    display_name: input.display_name,
    input_price_per_million_tokens: 1,
    output_price_per_million_tokens: 4,
    cached_input_price_per_million_tokens: null,
    context_window: 128000,
    max_output_tokens: 4096,
    supports_text: true,
    supports_image: false,
    supports_audio: false,
    supports_video: false,
    supports_tools: false,
    supports_structured_output: true,
    latency_tier: "unknown",
    quality_tier: "unknown",
    recommended_task_types: ["support", "classification"],
    stability_status: "unverified",
    freshness_status: "unverified",
    source_url: "https://example.com/promptopts/demo-model-registry",
    last_verified_at: null,
    verified_by: null,
    pricing_note: "Demo placeholder pricing only; not production model metadata.",
    is_mock: true,
    metadata: { demo_unverified: true },
    created_at: DEMO_TIMESTAMP,
    updated_at: DEMO_TIMESTAMP
  };
}
