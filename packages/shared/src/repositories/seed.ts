import type { ModelRegistryRecord } from "../schemas";
import type { RepositorySeed } from "./types";

const DEMO_TIMESTAMP = "2026-01-15T12:00:00.000Z";
const OFFICIAL_MODEL_REGISTRY_VERIFIED_AT = "2026-06-06T12:00:00.000Z";
const OFFICIAL_MODEL_REGISTRY_VERIFIER = "promptopts_official_docs_snapshot";

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
  modelRegistryVersion: "model_registry_version_openai_balanced_pending",
  plan: "plan_demo_growth",
  invoice: "invoice_acme_demo_open",
  credit: "credit_acme_demo",
  billingEvent: "billing_event_acme_demo_credit",
  featureFlagCliBeta: "feature_flag_cli_beta",
  freeAudit: "free_audit_acme_support_classifier",
  crmNote: "crm_note_acme_free_audit",
  task: "task_acme_eval_followup",
  adminRoleOwner: "admin_role_owner_demo",
  adminUser: "admin_user_demo"
} as const;

export function createDemoRepositorySeed(): Required<RepositorySeed> {
  const openAiFrontierModelId = "model_registry_openai_demo_frontier";
  const openAiModelId = "model_registry_openai_demo_balanced";
  const openAiEconomyModelId = "model_registry_openai_demo_economy";
  const anthropicModelId = "model_registry_anthropic_demo_balanced";
  const geminiModelId = "model_registry_gemini_demo_balanced";
  const openAiVerifiedFrontierModelId = "model_registry_openai_gpt_5_4";
  const openAiVerifiedBalancedModelId = "model_registry_openai_gpt_5_4_mini";
  const openAiVerifiedEconomyModelId = "model_registry_openai_gpt_5_4_nano";
  const anthropicVerifiedFallbackModelId = "model_registry_anthropic_claude_opus_4_8";
  const anthropicVerifiedBalancedModelId = "model_registry_anthropic_claude_sonnet_4_6";
  const anthropicVerifiedEconomyModelId = "model_registry_anthropic_claude_haiku_4_5";
  const geminiVerifiedFallbackModelId = "model_registry_gemini_2_5_pro";
  const geminiVerifiedBalancedModelId = "model_registry_gemini_2_5_flash";
  const geminiVerifiedEconomyModelId = "model_registry_gemini_2_5_flash_lite";
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
        prompts_private_by_default: true,
        data_use_policy: "no_training",
        provider_call_sensitive_data_policy: "require_confirmation",
        is_mock: true,
        created_at: DEMO_TIMESTAMP,
        updated_at: DEMO_TIMESTAMP
      }
    ],
    provider_connections: [],
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
        task: "Support ticket classification",
        required_output: "Strict JSON with category, urgency, summary, and suggested_reply.",
        must_preserve: ["JSON shape", "Urgency labels", "Support routing intent"],
        forbidden_behavior: ["Do not invent customer details.", "Do not expose private policy text."],
        pass_threshold: 0.95,
        must_pass_check_ids: [mustPassCheckId, "check_support_classifier_outage_urgency"],
        check_definitions: [
          {
            id: mustPassCheckId,
            type: "json_schema",
            description: "Output keeps required JSON keys.",
            must_pass: true,
            field_path: null,
            expected_value: ["category", "urgency", "summary", "suggested_reply"],
            pattern: null,
            placeholder_note: null
          },
          {
            id: "check_support_classifier_outage_urgency",
            type: "exact",
            description: "Outages affecting a team are high urgency.",
            must_pass: true,
            field_path: "urgency",
            expected_value: "high",
            pattern: null,
            placeholder_note: null
          },
          {
            id: "check_support_classifier_tone_judge",
            type: "llm_judge",
            description: "Suggested reply is empathetic and concise.",
            must_pass: false,
            field_path: "suggested_reply",
            expected_value: "empathetic_concise",
            pattern: null,
            placeholder_note: "LLM judge placeholder; not a deterministic check."
          }
        ],
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
            pattern: null,
            placeholder_note: null
          },
          {
            id: "check_support_classifier_billing_label",
            type: "exact",
            description: "Billing messages are labeled billing.",
            must_pass: false,
            field_path: "category",
            expected_value: "billing",
            pattern: null,
            placeholder_note: null
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
            type: "exact",
            description: "Outages affecting a team are high urgency.",
            must_pass: true,
            field_path: "urgency",
            expected_value: "high",
            pattern: null,
            placeholder_note: null
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
            pattern: null,
            placeholder_note: null
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
            pattern: "cancel|cancellation",
            placeholder_note: null
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
            pattern: null,
            placeholder_note: "LLM judge placeholder; not a deterministic check."
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
    eval_queue_jobs: [
      {
        id: "eval_queue_job_support_classifier_demo",
        eval_run_id: DEMO_IDS.evalRun,
        workspace_id: DEMO_IDS.workspace,
        project_id: DEMO_IDS.project,
        status: "queued",
        attempt_count: 0,
        max_attempts: 3,
        locked_by: null,
        locked_until: null,
        last_heartbeat_at: null,
        next_attempt_at: DEMO_TIMESTAMP,
        rate_limited_until: null,
        retry_after_seconds: null,
        retry_hint: "Demo eval job is ready for the durable runner.",
        sanitized_error: null,
        metadata: {
          source: "demo_seed",
          payload_redacted: true
        },
        is_mock: true,
        created_at: DEMO_TIMESTAMP,
        updated_at: DEMO_TIMESTAMP,
        completed_at: null,
        cancelled_at: null
      }
    ],
    eval_results: [],
    job_events: [
      {
        id: "job_event_eval_run_support_classifier_queued",
        job_type: "eval_run",
        job_id: "eval_queue_job_support_classifier_demo",
        status: "queued",
        workspace_id: DEMO_IDS.workspace,
        eval_run_id: DEMO_IDS.evalRun,
        report_id: null,
        sanitized_error: null,
        metadata: {
          source: "demo_seed",
          payload_redacted: true
        },
        created_at: DEMO_TIMESTAMP
      }
    ],
    worker_heartbeats: [
      {
        id: "worker_heartbeat_eval_runner_demo",
        worker_name: "eval-runner",
        instance_id: "demo",
        status: "healthy",
        last_heartbeat_at: DEMO_TIMESTAMP,
        metadata: {
          source: "demo_seed",
          queue: "durable_demo"
        },
        created_at: DEMO_TIMESTAMP,
        updated_at: DEMO_TIMESTAMP
      }
    ],
    optimization_candidates: [
      {
        id: candidateBaselineId,
        label: "Baseline",
        prompt_version_id: DEMO_IDS.promptVersion,
        analysis_id: DEMO_IDS.promptAnalysis,
        strategy: "baseline",
        candidate_prompt_text:
          "Classify the inbound support message. Return JSON with category, urgency, summary, and suggested_reply. Message: {{customer_message}} Account tier: {{account_tier}}",
        estimated_input_tokens: 29,
        estimated_output_tokens: 140,
        rationale: "Baseline regression control.",
        risk_level: "low",
        expected_token_delta: 0,
        preserved_constraints: [
          "Return JSON with category, urgency, summary, and suggested_reply.",
          "Preserve exact urgency labels.",
          "Keep customer_message and account_tier variables represented."
        ],
        removed_or_compressed_elements: ["None; baseline is the unchanged regression control."],
        is_baseline: true,
        is_mock: true,
        created_at: DEMO_TIMESTAMP
      },
      {
        id: candidateBalancedId,
        label: "Balanced",
        prompt_version_id: DEMO_IDS.promptVersion,
        analysis_id: DEMO_IDS.promptAnalysis,
        strategy: "balanced",
        candidate_prompt_text:
          "Return JSON {category, urgency, summary, suggested_reply} for {{customer_message}}. Preserve exact urgency labels. Account tier: {{account_tier}}",
        estimated_input_tokens: 22,
        estimated_output_tokens: 112,
        rationale: "Compacts instructions while preserving required output shape.",
        risk_level: "medium",
        expected_token_delta: -42,
        preserved_constraints: [
          "Return JSON with category, urgency, summary, and suggested_reply.",
          "Preserve exact urgency labels.",
          "Keep customer_message and account_tier variables represented."
        ],
        removed_or_compressed_elements: [
          "Compressed repeated wording around support classification.",
          "Shortened output wording while keeping the schema explicit."
        ],
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
        deleted_at: null,
        delete_requested_by_user_id: null,
        delete_reason_code: null,
        retention_state: "active",
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
        workspace_id: DEMO_IDS.workspace,
        project_id: DEMO_IDS.project,
        format: "json",
        privacy_state: "failed_export",
        storage_key: "reports/report_support_classifier_shell/report_artifact_support_classifier_json.json",
        storage_uri: "memory://reports/report_support_classifier_shell.json",
        checksum: null,
        size_bytes: null,
        redaction_state: "redacted",
        deleted_at: null,
        deletion_status: "active",
        deletion_attempts: 0,
        last_deletion_error: null,
        is_mock: true,
        created_at: DEMO_TIMESTAMP
      }
    ],
    deletion_requests: [],
    model_registry: [
      createDemoModelRegistryRecord({
        id: openAiFrontierModelId,
        provider: "openai",
        model_id: "openai-demo-frontier",
        display_name: "OpenAI Demo Frontier",
        input_price_per_million_tokens: 3,
        output_price_per_million_tokens: 12,
        quality_tier: "frontier",
        supports_tools: true
      }),
      createDemoModelRegistryRecord({
        id: openAiModelId,
        provider: "openai",
        model_id: "openai-demo-balanced",
        display_name: "OpenAI Demo Balanced",
        input_price_per_million_tokens: 1,
        output_price_per_million_tokens: 4,
        quality_tier: "balanced",
        supports_tools: true
      }),
      createDemoModelRegistryRecord({
        id: openAiEconomyModelId,
        provider: "openai",
        model_id: "openai-demo-economy",
        display_name: "OpenAI Demo Economy",
        input_price_per_million_tokens: 0.5,
        output_price_per_million_tokens: 2,
        quality_tier: "economy",
        supports_tools: true
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
      }),
      createVerifiedModelRegistryRecord({
        id: openAiVerifiedFrontierModelId,
        provider: "openai",
        model_id: "gpt-5.4",
        display_name: "GPT-5.4",
        input_price_per_million_tokens: 2.5,
        output_price_per_million_tokens: 15,
        cached_input_price_per_million_tokens: 0.25,
        context_window: 1050000,
        max_output_tokens: 128000,
        supports_image: true,
        supports_tools: true,
        supports_structured_output: true,
        latency_tier: "standard",
        quality_tier: "frontier",
        recommended_task_types: ["support", "summarization", "extraction", "coding", "rag", "agent", "classification", "other"],
        source_url: "https://developers.openai.com/api/docs/models/gpt-5.4",
        pricing_source_url: "https://platform.openai.com/docs/pricing",
        pricing_note: "Official OpenAI API docs snapshot; verify before exact savings if row becomes stale."
      }),
      createVerifiedModelRegistryRecord({
        id: openAiVerifiedBalancedModelId,
        provider: "openai",
        model_id: "gpt-5.4-mini",
        display_name: "GPT-5.4 mini",
        input_price_per_million_tokens: 0.75,
        output_price_per_million_tokens: 4.5,
        cached_input_price_per_million_tokens: 0.075,
        context_window: 400000,
        max_output_tokens: 128000,
        supports_image: true,
        supports_tools: true,
        supports_structured_output: true,
        latency_tier: "low",
        quality_tier: "balanced",
        recommended_task_types: ["support", "summarization", "extraction", "coding", "rag", "classification", "other"],
        source_url: "https://developers.openai.com/api/docs/models",
        pricing_source_url: "https://platform.openai.com/docs/pricing",
        pricing_note: "Official OpenAI API docs snapshot; verify before exact savings if row becomes stale."
      }),
      createVerifiedModelRegistryRecord({
        id: openAiVerifiedEconomyModelId,
        provider: "openai",
        model_id: "gpt-5.4-nano",
        display_name: "GPT-5.4 nano",
        input_price_per_million_tokens: 0.15,
        output_price_per_million_tokens: 1.2,
        cached_input_price_per_million_tokens: 0.015,
        context_window: 400000,
        max_output_tokens: 128000,
        supports_image: true,
        supports_tools: true,
        supports_structured_output: true,
        latency_tier: "low",
        quality_tier: "economy",
        recommended_task_types: ["support", "summarization", "extraction", "classification", "other"],
        source_url: "https://developers.openai.com/api/docs/models",
        pricing_source_url: "https://platform.openai.com/docs/pricing",
        pricing_note: "Official OpenAI API docs snapshot; verify before exact savings if row becomes stale."
      }),
      createVerifiedModelRegistryRecord({
        id: anthropicVerifiedFallbackModelId,
        provider: "anthropic",
        model_id: "claude-opus-4-8",
        display_name: "Claude Opus 4.8",
        input_price_per_million_tokens: 5,
        output_price_per_million_tokens: 25,
        cached_input_price_per_million_tokens: 0.5,
        context_window: 1000000,
        max_output_tokens: 128000,
        supports_image: true,
        supports_tools: false,
        supports_structured_output: false,
        latency_tier: "standard",
        quality_tier: "frontier",
        recommended_task_types: ["coding", "rag", "agent", "summarization", "other"],
        source_url: "https://docs.anthropic.com/en/docs/about-claude/models/overview",
        pricing_source_url: "https://docs.anthropic.com/en/docs/about-claude/pricing",
        pricing_note: "Official Anthropic docs snapshot; cached input stores cache-hit price for PromptOpts estimates."
      }),
      createVerifiedModelRegistryRecord({
        id: anthropicVerifiedBalancedModelId,
        provider: "anthropic",
        model_id: "claude-sonnet-4-6",
        display_name: "Claude Sonnet 4.6",
        input_price_per_million_tokens: 3,
        output_price_per_million_tokens: 15,
        cached_input_price_per_million_tokens: 0.3,
        context_window: 1000000,
        max_output_tokens: 64000,
        supports_image: true,
        supports_tools: false,
        supports_structured_output: false,
        latency_tier: "standard",
        quality_tier: "balanced",
        recommended_task_types: ["support", "summarization", "extraction", "coding", "rag", "classification", "other"],
        source_url: "https://docs.anthropic.com/en/docs/about-claude/models/overview",
        pricing_source_url: "https://docs.anthropic.com/en/docs/about-claude/pricing",
        pricing_note: "Official Anthropic docs snapshot; cached input stores cache-hit price for PromptOpts estimates."
      }),
      createVerifiedModelRegistryRecord({
        id: anthropicVerifiedEconomyModelId,
        provider: "anthropic",
        model_id: "claude-haiku-4-5",
        display_name: "Claude Haiku 4.5",
        input_price_per_million_tokens: 1,
        output_price_per_million_tokens: 5,
        cached_input_price_per_million_tokens: 0.1,
        context_window: 200000,
        max_output_tokens: 64000,
        supports_image: true,
        supports_tools: false,
        supports_structured_output: false,
        latency_tier: "low",
        quality_tier: "economy",
        recommended_task_types: ["support", "summarization", "extraction", "classification", "other"],
        source_url: "https://docs.anthropic.com/en/docs/about-claude/models/overview",
        pricing_source_url: "https://docs.anthropic.com/en/docs/about-claude/pricing",
        pricing_note: "Official Anthropic docs snapshot; cached input stores cache-hit price for PromptOpts estimates."
      }),
      createVerifiedModelRegistryRecord({
        id: geminiVerifiedFallbackModelId,
        provider: "gemini",
        model_id: "gemini-2.5-pro",
        display_name: "Gemini 2.5 Pro",
        input_price_per_million_tokens: 1.25,
        output_price_per_million_tokens: 10,
        cached_input_price_per_million_tokens: 0.125,
        context_window: 1048576,
        max_output_tokens: 65536,
        supports_image: true,
        supports_audio: true,
        supports_video: true,
        supports_tools: true,
        supports_structured_output: true,
        latency_tier: "standard",
        quality_tier: "frontier",
        recommended_task_types: ["coding", "rag", "agent", "summarization", "other"],
        source_url: "https://ai.google.dev/gemini-api/docs/models",
        pricing_source_url: "https://ai.google.dev/gemini-api/docs/pricing",
        pricing_note: "Official Gemini API docs snapshot; Pro pricing is tiered by prompt length, so exact claims require fresh review."
      }),
      createVerifiedModelRegistryRecord({
        id: geminiVerifiedBalancedModelId,
        provider: "gemini",
        model_id: "gemini-2.5-flash",
        display_name: "Gemini 2.5 Flash",
        input_price_per_million_tokens: 0.3,
        output_price_per_million_tokens: 2.5,
        cached_input_price_per_million_tokens: 0.03,
        context_window: 1048576,
        max_output_tokens: 65536,
        supports_image: true,
        supports_audio: true,
        supports_video: true,
        supports_tools: true,
        supports_structured_output: true,
        latency_tier: "low",
        quality_tier: "balanced",
        recommended_task_types: ["support", "summarization", "extraction", "coding", "rag", "classification", "other"],
        source_url: "https://ai.google.dev/gemini-api/docs/models",
        pricing_source_url: "https://ai.google.dev/gemini-api/docs/pricing",
        pricing_note: "Official Gemini API docs snapshot; verify before exact savings if row becomes stale."
      }),
      createVerifiedModelRegistryRecord({
        id: geminiVerifiedEconomyModelId,
        provider: "gemini",
        model_id: "gemini-2.5-flash-lite",
        display_name: "Gemini 2.5 Flash-Lite",
        input_price_per_million_tokens: 0.1,
        output_price_per_million_tokens: 0.4,
        cached_input_price_per_million_tokens: 0.025,
        context_window: 1048576,
        max_output_tokens: 65536,
        supports_image: true,
        supports_audio: true,
        supports_video: true,
        supports_tools: true,
        supports_structured_output: true,
        latency_tier: "low",
        quality_tier: "economy",
        recommended_task_types: ["support", "summarization", "extraction", "classification", "other"],
        source_url: "https://ai.google.dev/gemini-api/docs/models",
        pricing_source_url: "https://ai.google.dev/gemini-api/docs/pricing",
        pricing_note: "Official Gemini API docs snapshot; verify before exact savings if row becomes stale."
      })
    ],
    model_registry_versions: [
      {
        id: DEMO_IDS.modelRegistryVersion,
        model_registry_id: openAiModelId,
        version_number: 1,
        registry_payload: {
          display_name: "OpenAI Demo Balanced Verified Draft",
          input_price_per_million_tokens: 1.1,
          output_price_per_million_tokens: 4.2,
          freshness_status: "fresh",
          stability_status: "stable",
          pricing_note: "Demo pending verification from official model docs."
        },
        source_url: "https://example.com/promptopts/demo-model-registry",
        last_verified_at: "2026-01-16T12:00:00.000Z",
        verified_by: "admin_user_demo",
        approval_state: "pending_review",
        approved_by_admin_user_id: null,
        approved_at: null,
        change_reason: "Demo pending source verification proposal.",
        is_mock: true,
        created_at: DEMO_TIMESTAMP
      }
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
        company: "Acme AI",
        cta_clicked: "run_evals",
        redacted_prompt_preview: "Support classifier prompt with variables only.",
        shareable_summary:
          "Redacted free audit: medium risk, overpowered model fit, run evals before switching.",
        is_mock: true,
        created_at: DEMO_TIMESTAMP
      }
    ],
    accounts: [
      {
        id: DEMO_IDS.account,
        name: "Acme AI",
        workspace_id: DEMO_IDS.workspace,
        stage: "new_audit",
        provider_preference: "openai",
        owner_admin_user_id: null,
        domain: "acme-ai.example",
        redacted_prompt_preview: "Support classifier prompt with variables only.",
        is_mock: true,
        created_at: DEMO_TIMESTAMP,
        updated_at: DEMO_TIMESTAMP
      }
    ],
    crm_notes: [
      {
        id: DEMO_IDS.crmNote,
        account_id: DEMO_IDS.account,
        opportunity_id: DEMO_IDS.opportunity,
        author_admin_user_id: DEMO_IDS.adminUser,
        body_redacted: "Free audit captured overpowered fit; prompt details remain redacted.",
        redaction_state: "redacted",
        metadata: { source: "free_audit" },
        is_mock: true,
        created_at: DEMO_TIMESTAMP
      }
    ],
    tasks: [
      {
        id: DEMO_IDS.task,
        account_id: DEMO_IDS.account,
        opportunity_id: DEMO_IDS.opportunity,
        assignee_admin_user_id: null,
        title: "Invite Acme AI to run evals before switching",
        status: "open",
        due_at: null,
        metadata: { source: "free_audit", action: "run_evals" },
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
        current_model: "openai-demo-balanced",
        fit_signal: "overpowered",
        estimated_monthly_calls: 250000,
        estimated_volume: 250000,
        savings_opportunity_usd: null,
        estimated_savings: null,
        use_case: "support",
        cta_clicked: "run_evals",
        eval_readiness: "eval_ready",
        is_mock: true,
        created_at: DEMO_TIMESTAMP,
        updated_at: DEMO_TIMESTAMP
      }
    ],
    admin_roles: [
      {
        id: DEMO_IDS.adminRoleOwner,
        name: "owner",
        scopes: [
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
        ],
        is_system: true,
        created_at: DEMO_TIMESTAMP
      }
    ],
    admin_users: [
      {
        id: DEMO_IDS.adminUser,
        user_id: null,
        email: "ops@acme-ai.example",
        display_name: "Acme Ops Admin",
        role_ids: [DEMO_IDS.adminRoleOwner],
        status: "active",
        password_hash: "sha256:3049b742957bf075de0f9cb0921707659065972bef873d86131f57f61d9a796e",
        mfa_secret: "JBSWY3DPEHPK3PXP",
        created_at: DEMO_TIMESTAMP,
        updated_at: DEMO_TIMESTAMP
      }
    ],
    admin_sessions: [],
    sudo_requests: [],
    admin_audit_logs: [
      {
        id: "admin_audit_log_demo_registry_unverified",
        admin_user_id: DEMO_IDS.adminUser,
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
        plan_id: DEMO_IDS.plan,
        feature: "free_audits",
        limit: 5,
        used: 1,
        is_mock: true,
        starts_at: DEMO_TIMESTAMP,
        ends_at: null,
        created_at: DEMO_TIMESTAMP
      },
      {
        id: "entitlement_acme_hosted_eval_runs",
        workspace_id: DEMO_IDS.workspace,
        plan_id: DEMO_IDS.plan,
        feature: "hosted_eval_runs",
        limit: 25,
        used: 1,
        is_mock: true,
        starts_at: DEMO_TIMESTAMP,
        ends_at: null,
        created_at: DEMO_TIMESTAMP
      },
      {
        id: "entitlement_acme_report_exports",
        workspace_id: DEMO_IDS.workspace,
        plan_id: DEMO_IDS.plan,
        feature: "report_exports",
        limit: 25,
        used: 1,
        is_mock: true,
        starts_at: DEMO_TIMESTAMP,
        ends_at: null,
        created_at: DEMO_TIMESTAMP
      },
      {
        id: "entitlement_acme_prompt_history",
        workspace_id: DEMO_IDS.workspace,
        plan_id: DEMO_IDS.plan,
        feature: "prompt_history",
        limit: 50,
        used: 1,
        is_mock: true,
        starts_at: DEMO_TIMESTAMP,
        ends_at: null,
        created_at: DEMO_TIMESTAMP
      },
      {
        id: "entitlement_acme_csv_upload",
        workspace_id: DEMO_IDS.workspace,
        plan_id: DEMO_IDS.plan,
        feature: "csv_upload",
        limit: 1,
        used: 0,
        is_mock: true,
        starts_at: DEMO_TIMESTAMP,
        ends_at: null,
        created_at: DEMO_TIMESTAMP
      },
      {
        id: "entitlement_acme_pdf_export",
        workspace_id: DEMO_IDS.workspace,
        plan_id: DEMO_IDS.plan,
        feature: "pdf_export",
        limit: 1,
        used: 0,
        is_mock: true,
        starts_at: DEMO_TIMESTAMP,
        ends_at: null,
        created_at: DEMO_TIMESTAMP
      },
      {
        id: "entitlement_acme_byok",
        workspace_id: DEMO_IDS.workspace,
        plan_id: DEMO_IDS.plan,
        feature: "byok",
        limit: 1,
        used: 0,
        is_mock: true,
        starts_at: DEMO_TIMESTAMP,
        ends_at: null,
        created_at: DEMO_TIMESTAMP
      },
      {
        id: "entitlement_acme_seats",
        workspace_id: DEMO_IDS.workspace,
        plan_id: DEMO_IDS.plan,
        feature: "seats",
        limit: 3,
        used: 1,
        is_mock: true,
        starts_at: DEMO_TIMESTAMP,
        ends_at: null,
        created_at: DEMO_TIMESTAMP
      },
      {
        id: "entitlement_acme_cli_beta",
        workspace_id: DEMO_IDS.workspace,
        plan_id: DEMO_IDS.plan,
        feature: "cli_beta",
        limit: 1,
        used: 0,
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
    ],
    plans: [
      {
        id: DEMO_IDS.plan,
        name: "Demo Growth",
        billing_period: "month",
        price_cents: 4900,
        feature_limits: {
          hosted_eval_runs: 25,
          prompt_history: 50,
          report_exports: 25,
          seats: 3,
          csv_upload: true,
          byok: true,
          pdf_export: true
        },
        is_active: true,
        is_mock: true,
        created_at: DEMO_TIMESTAMP
      }
    ],
    billing_events: [
      {
        id: DEMO_IDS.billingEvent,
        workspace_id: DEMO_IDS.workspace,
        event_type: "credit_issued",
        amount_cents: 1000,
        currency: "usd",
        external_reference: null,
        metadata: { reason_code: "demo_seed" },
        is_mock: true,
        created_at: DEMO_TIMESTAMP
      }
    ],
    invoices: [
      {
        id: DEMO_IDS.invoice,
        workspace_id: DEMO_IDS.workspace,
        status: "open",
        amount_due_cents: 4900,
        currency: "usd",
        issued_at: DEMO_TIMESTAMP,
        due_at: "2026-02-15T12:00:00.000Z",
        paid_at: null,
        external_reference: "demo-invoice-001",
        metadata: { plan_id: DEMO_IDS.plan },
        is_mock: true,
        created_at: DEMO_TIMESTAMP
      }
    ],
    credits: [
      {
        id: DEMO_IDS.credit,
        workspace_id: DEMO_IDS.workspace,
        amount_cents: 1000,
        currency: "usd",
        reason_code: "demo_seed",
        issued_by_admin_user_id: "admin_user_demo",
        sudo_request_id: null,
        billing_event_id: DEMO_IDS.billingEvent,
        is_mock: true,
        created_at: DEMO_TIMESTAMP
      }
    ],
    feature_flags: [
      {
        id: DEMO_IDS.featureFlagCliBeta,
        key: "cli_beta",
        enabled: true,
        rollout: { workspaces: [DEMO_IDS.workspace] },
        created_by_admin_user_id: "admin_user_demo",
        updated_by_admin_user_id: "admin_user_demo",
        is_mock: true,
        created_at: DEMO_TIMESTAMP,
        updated_at: DEMO_TIMESTAMP
      }
    ]
  };
}

function createVerifiedModelRegistryRecord(input: {
  id: string;
  provider: ModelRegistryRecord["provider"];
  model_id: string;
  display_name: string;
  input_price_per_million_tokens: number;
  output_price_per_million_tokens: number;
  cached_input_price_per_million_tokens: number | null;
  context_window: number;
  max_output_tokens: number;
  supports_image?: boolean;
  supports_audio?: boolean;
  supports_video?: boolean;
  supports_tools?: boolean;
  supports_structured_output?: boolean;
  latency_tier: ModelRegistryRecord["latency_tier"];
  quality_tier: ModelRegistryRecord["quality_tier"];
  recommended_task_types: ModelRegistryRecord["recommended_task_types"];
  source_url: string;
  pricing_source_url: string;
  pricing_note: string;
}): ModelRegistryRecord {
  return {
    id: input.id,
    provider: input.provider,
    model_id: input.model_id,
    display_name: input.display_name,
    input_price_per_million_tokens: input.input_price_per_million_tokens,
    output_price_per_million_tokens: input.output_price_per_million_tokens,
    cached_input_price_per_million_tokens: input.cached_input_price_per_million_tokens,
    context_window: input.context_window,
    max_output_tokens: input.max_output_tokens,
    supports_text: true,
    supports_image: input.supports_image ?? false,
    supports_audio: input.supports_audio ?? false,
    supports_video: input.supports_video ?? false,
    supports_tools: input.supports_tools ?? false,
    supports_structured_output: input.supports_structured_output ?? false,
    latency_tier: input.latency_tier,
    quality_tier: input.quality_tier,
    recommended_task_types: input.recommended_task_types,
    stability_status: "stable",
    freshness_status: "fresh",
    source_url: input.source_url,
    last_verified_at: OFFICIAL_MODEL_REGISTRY_VERIFIED_AT,
    verified_by: OFFICIAL_MODEL_REGISTRY_VERIFIER,
    approval_state: "approved",
    approved_by_admin_user_id: DEMO_IDS.adminUser,
    approved_at: OFFICIAL_MODEL_REGISTRY_VERIFIED_AT,
    pricing_note: input.pricing_note,
    is_mock: false,
    metadata: {
      official_source_urls: [input.source_url, input.pricing_source_url],
      pricing_source_url: input.pricing_source_url,
      verification_note: "Seeded from official provider docs for local MVP registry workflow."
    },
    created_at: OFFICIAL_MODEL_REGISTRY_VERIFIED_AT,
    updated_at: OFFICIAL_MODEL_REGISTRY_VERIFIED_AT
  };
}

function createDemoModelRegistryRecord(input: {
  id: string;
  provider: "openai" | "anthropic" | "gemini";
  model_id: string;
  display_name: string;
  input_price_per_million_tokens?: number;
  output_price_per_million_tokens?: number;
  supports_tools?: boolean;
  quality_tier?: ModelRegistryRecord["quality_tier"];
}): ModelRegistryRecord {
  // Demo registry rows are placeholders; production recommendations must use verified metadata.
  return {
    id: input.id,
    provider: input.provider,
    model_id: input.model_id,
    display_name: input.display_name,
    input_price_per_million_tokens: input.input_price_per_million_tokens ?? 1,
    output_price_per_million_tokens: input.output_price_per_million_tokens ?? 4,
    cached_input_price_per_million_tokens: null,
    context_window: 128000,
    max_output_tokens: 4096,
    supports_text: true,
    supports_image: false,
    supports_audio: false,
    supports_video: false,
    supports_tools: input.supports_tools ?? false,
    supports_structured_output: true,
    latency_tier: "unknown",
    quality_tier: input.quality_tier ?? "unknown",
    recommended_task_types: ["support", "classification"],
    stability_status: "unverified",
    freshness_status: "unverified",
    source_url: "https://example.com/promptopts/demo-model-registry",
    last_verified_at: null,
    verified_by: null,
    approval_state: "draft",
    approved_by_admin_user_id: null,
    approved_at: null,
    pricing_note: "Demo placeholder pricing only; not production model metadata.",
    is_mock: true,
    metadata: { demo_unverified: true },
    created_at: DEMO_TIMESTAMP,
    updated_at: DEMO_TIMESTAMP
  };
}
