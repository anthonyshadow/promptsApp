import type {
  AuditResponse,
  CandidateStrategy,
  EvalResult,
  EvalRun,
  ModelRegistryRecord,
  Priority,
  Prompt,
  PromptProject,
  PromptVersion,
  Provider,
  QualityContract,
  RecommendationReport,
  ReportArtifact,
  TestCase,
  TaskType,
  Workspace
} from "@promptopts/shared";

export type PublicAppState = {
  projectName: string;
  projectId: string;
  promptId: string;
  promptVersionId: string;
  provider: Provider;
  currentModelId: string;
  taskType: TaskType;
  priority: Priority;
  monthlyCalls: number;
  requiresJson: boolean;
  usesTools: boolean;
  usesImages: boolean;
  maxLatencyMs: number | null;
  minContextWindow: number | null;
  setupSavedAt: string | null;
  promptText: string;
  promptVariables: string[];
  passThreshold: number;
  selectedCandidateIds: string[];
  selectedModelIds: string[];
  selectedTestCaseIds: string[];
  activeEvalRunId: string;
  activeReportId: string;
};

const demoCreatedAt = "2026-06-03T12:00:00.000Z";

export const demoWorkspace: Workspace = {
  id: "workspace_demo_acme",
  name: "Acme AI",
  slug: "acme-ai",
  is_mock: true,
  created_at: demoCreatedAt,
  updated_at: demoCreatedAt
};

export const demoProject: PromptProject = {
  id: "project_demo_support",
  workspace_id: demoWorkspace.id,
  name: "Support classifier",
  task_type: "classification",
  current_provider: "openai",
  current_model_id: "openai-demo-frontier",
  status: "active",
  is_mock: true,
  created_at: demoCreatedAt,
  updated_at: demoCreatedAt
};

export const demoPrompt: Prompt = {
  id: "prompt_demo_support",
  project_id: demoProject.id,
  name: "Support classifier prompt",
  current_version_id: "prompt_version_demo_support_v1",
  redacted_preview: "Classify inbound support tickets by urgency, topic, and routing group.",
  is_mock: true,
  created_at: demoCreatedAt,
  updated_at: demoCreatedAt
};

export const demoPromptVersion: PromptVersion = {
  id: "prompt_version_demo_support_v1",
  prompt_id: demoPrompt.id,
  version: 1,
  label: "Current production baseline",
  prompt_text:
    "Classify this support ticket into urgency, topic, sentiment, and routing_group. Return strict JSON with short rationale. Ticket: {{ticket_text}}",
  variables: ["ticket_text"],
  status: "active",
  redacted_preview: demoPrompt.redacted_preview,
  is_mock: true,
  created_by_user_id: null,
  created_at: demoCreatedAt
};

export const demoAudit: AuditResponse = {
  id: "audit_demo_support",
  inputTokens: 32,
  estimatedOutputTokens: 96,
  monthlyCostEstimate: {
    estimatedMonthlyCostUsd: null,
    inputCostUsd: null,
    outputCostUsd: null,
    estimateStatus: "unverified",
    unverified: true,
    registryFreshness: "unverified",
    metadataWarnings: ["Demo registry rows are unverified."],
    pricingNote: "Demo placeholder price; unverified registry row."
  },
  modelFit: "overpowered",
  modelFitReasons: ["frontier_model_for_bounded_task", "same_provider_benchmark_recommended"],
  wasteFindings: [
    "High-capability model appears unnecessary for a constrained classification task.",
    "Output contract is compact enough to test with lower-cost same-provider models."
  ],
  riskLevel: "medium",
  sensitiveFindings: [],
  compressionGuardrails: [
    "Keep strict JSON.",
    "Preserve urgency labels.",
    "Do not remove routing_group."
  ],
  suggestedModels: ["openai-demo-balanced", "openai-demo-economy"],
  suggestedModelRoles: [
    {
      role: "baseline",
      modelId: "openai-demo-frontier",
      registryRecordId: "model_record_openai_frontier",
      reason: "Current prompt and model remain the regression baseline."
    },
    {
      role: "cheaper_candidate",
      modelId: "openai-demo-balanced",
      registryRecordId: "model_record_openai_balanced",
      reason: "Same-provider candidate for eval benchmarking, not a production switch recommendation."
    },
    {
      role: "stronger_fallback",
      modelId: "openai-demo-frontier",
      registryRecordId: "model_record_openai_frontier",
      reason: "Fallback role for quality risk evaluation."
    }
  ],
  suggestedNextAction: "Define the success contract, then benchmark cheaper same-provider candidates through evals.",
  registryFreshness: "unverified",
  createdAt: demoCreatedAt
};

export const demoQualityContract: QualityContract = {
  id: "quality_contract_demo_support",
  project_id: demoProject.id,
  task: "Support ticket classification",
  required_output: "Strict JSON with urgency, topic, routing_group, and short rationale.",
  must_preserve: ["Strict JSON", "Urgency labels", "routing_group"],
  forbidden_behavior: ["Do not invent customer facts.", "Do not include private policy text."],
  pass_threshold: 0.92,
  must_pass_check_ids: ["check_json", "check_urgency", "check_routing"],
  check_definitions: [
    {
      id: "check_json",
      type: "json_schema",
      description: "Returns strict JSON",
      must_pass: true,
      field_path: null,
      expected_value: ["urgency", "topic", "routing_group", "rationale"],
      pattern: null,
      placeholder_note: null
    },
    {
      id: "check_urgency",
      type: "exact",
      description: "Preserves urgency labels",
      must_pass: true,
      field_path: "urgency",
      expected_value: "high",
      pattern: null,
      placeholder_note: null
    },
    {
      id: "check_routing",
      type: "required_phrase",
      description: "Includes support routing group",
      must_pass: true,
      field_path: "routing_group",
      expected_value: "support",
      pattern: null,
      placeholder_note: null
    }
  ],
  notes: "Must preserve JSON shape, urgency, and routing group before any savings claim.",
  is_mock: true,
  created_at: demoCreatedAt,
  updated_at: demoCreatedAt
};

export const demoTestCases: TestCase[] = [
  {
    id: "test_case_demo_1",
    project_id: demoProject.id,
    quality_contract_id: demoQualityContract.id,
    name: "Refund escalation",
    input_variables: { ticket_text: "Enterprise customer asks for refund after outage." },
    expected_output: { urgency: "high", topic: "billing" },
    checks: [
      {
        id: "check_json",
        type: "json_schema",
        description: "Returns strict JSON",
        must_pass: true,
        field_path: null,
        expected_value: null,
        pattern: null,
        placeholder_note: null
      },
      {
        id: "check_urgency",
        type: "exact",
        description: "Sets urgency to high",
        must_pass: true,
        field_path: "urgency",
        expected_value: "high",
        pattern: null,
        placeholder_note: null
      }
    ],
    is_mock: true,
    created_at: demoCreatedAt,
    updated_at: demoCreatedAt
  },
  {
    id: "test_case_demo_2",
    project_id: demoProject.id,
    quality_contract_id: demoQualityContract.id,
    name: "Password reset",
    input_variables: { ticket_text: "User cannot reset password from mobile." },
    expected_output: { urgency: "medium", topic: "account_access" },
    checks: [
      {
        id: "check_routing",
        type: "required_phrase",
        description: "Includes account support routing group",
        must_pass: true,
        field_path: "routing_group",
        expected_value: "account_support",
        pattern: null,
        placeholder_note: null
      }
    ],
    is_mock: true,
    created_at: demoCreatedAt,
    updated_at: demoCreatedAt
  },
  {
    id: "test_case_demo_3",
    project_id: demoProject.id,
    quality_contract_id: demoQualityContract.id,
    name: "Feature request",
    input_variables: { ticket_text: "Customer asks for a new CSV export setting." },
    expected_output: { urgency: "low", topic: "feature_request" },
    checks: [
      {
        id: "check_feature",
        type: "exact",
        description: "Classifies feature request",
        must_pass: false,
        field_path: "topic",
        expected_value: "feature_request",
        pattern: null,
        placeholder_note: null
      }
    ],
    is_mock: true,
    created_at: demoCreatedAt,
    updated_at: demoCreatedAt
  }
];

export const demoCandidates = [
  {
    id: "candidate_baseline",
    strategy: "baseline",
    risk: "low",
    tokenDelta: 0,
    summary: "Current prompt and current model remain the regression baseline."
  },
  {
    id: "candidate_conservative",
    strategy: "conservative",
    risk: "low",
    tokenDelta: -14,
    summary: "Tightens output instructions while preserving labels and JSON shape."
  },
  {
    id: "candidate_balanced",
    strategy: "balanced",
    risk: "medium",
    tokenDelta: -26,
    summary: "Removes repeated phrasing and keeps must-pass constraints explicit."
  },
  {
    id: "candidate_aggressive",
    strategy: "aggressive",
    risk: "high",
    tokenDelta: -44,
    summary: "Experimental compression lower bound; never a recommendation until evals pass."
  },
  {
    id: "candidate_output_lite",
    strategy: "output_lite",
    risk: "medium",
    tokenDelta: -34,
    summary: "Shorter rationale budget with unchanged routing fields."
  },
  {
    id: "candidate_model_specific",
    strategy: "model_specific",
    risk: "medium",
    tokenDelta: -18,
    summary: "Provider-tuned placeholder that stays provisional until evals pass."
  }
] satisfies Array<{
  id: string;
  strategy: CandidateStrategy;
  risk: "low" | "medium" | "high" | "critical";
  tokenDelta: number;
  summary: string;
}>;

export const demoModelRegistry: ModelRegistryRecord[] = [
  createDemoModel("model_record_openai_frontier", "openai", "openai-demo-frontier", "OpenAI demo frontier", "frontier"),
  createDemoModel("model_record_openai_balanced", "openai", "openai-demo-balanced", "OpenAI demo balanced", "balanced"),
  createDemoModel("model_record_openai_economy", "openai", "openai-demo-economy", "OpenAI demo economy", "economy"),
  createDemoModel("model_record_anthropic_balanced", "anthropic", "anthropic-demo-balanced", "Anthropic demo balanced", "balanced"),
  createDemoModel("model_record_gemini_balanced", "gemini", "gemini-demo-balanced", "Gemini demo balanced", "balanced")
];

export const demoEvalRun: EvalRun = {
  id: "eval_demo_support",
  project_id: demoProject.id,
  quality_contract_id: demoQualityContract.id,
  baseline_prompt_version_id: demoPromptVersion.id,
  candidate_ids: ["candidate_baseline", "candidate_conservative", "candidate_balanced"],
  model_registry_record_ids: [
    "model_record_openai_frontier",
    "model_record_openai_balanced",
    "model_record_openai_economy"
  ],
  status: "queued",
  pass_threshold: 0.92,
  is_mock: true,
  queued_at: demoCreatedAt,
  started_at: null,
  completed_at: null
};

export const demoEvalResults: EvalResult[] = [
  createEvalResult("eval_result_baseline", "candidate_baseline", "openai-demo-frontier", 0.96, 0, "low", "pass"),
  createEvalResult("eval_result_balanced", "candidate_balanced", "openai-demo-balanced", 0.91, 1, "medium", "fail"),
  createEvalResult("eval_result_economy", "candidate_output_lite", "openai-demo-economy", 0.86, 2, "high", "fail")
];

export const demoReport: RecommendationReport = {
  id: "report_demo_support",
  project_id: demoProject.id,
  eval_run_id: demoEvalRun.id,
  status: "blocked",
  winner_result_id: null,
  cheaper_alternative_result_id: null,
  stronger_fallback_result_id: null,
  risk_summary: [
    "Must-pass failures exist in the mock matrix.",
    "Registry metadata is demo/unverified, so savings cannot be claimed."
  ],
  savings_summary: null,
  production_recommendation_allowed: false,
  production_blockers: [
    "Eval pass threshold has not been met.",
    "Must-pass failures must be zero before production recommendation."
  ],
  registry_freshness: "unverified",
  is_mock: true,
  generated_at: null,
  created_at: demoCreatedAt,
  updated_at: demoCreatedAt
};

export const demoReportArtifacts: ReportArtifact[] = [
  createArtifact("artifact_markdown", "markdown"),
  createArtifact("artifact_json", "json"),
  createArtifact("artifact_pdf", "pdf")
];

export function createInitialPublicAppState(): PublicAppState {
  return {
    projectName: demoProject.name,
    projectId: demoProject.id,
    promptId: demoPrompt.id,
    promptVersionId: demoPromptVersion.id,
    provider: demoProject.current_provider,
    currentModelId: demoProject.current_model_id,
    taskType: demoProject.task_type,
    priority: "balanced",
    monthlyCalls: 250000,
    requiresJson: true,
    usesTools: false,
    usesImages: false,
    maxLatencyMs: null,
    minContextWindow: null,
    setupSavedAt: null,
    promptText: demoPromptVersion.prompt_text,
    promptVariables: demoPromptVersion.variables,
    passThreshold: demoQualityContract.pass_threshold,
    selectedCandidateIds: demoEvalRun.candidate_ids,
    selectedModelIds: demoEvalRun.model_registry_record_ids,
    selectedTestCaseIds: demoTestCases.map((testCase) => testCase.id),
    activeEvalRunId: demoEvalRun.id,
    activeReportId: demoReport.id
  };
}

function createDemoModel(
  id: string,
  provider: Provider,
  modelId: string,
  displayName: string,
  qualityTier: ModelRegistryRecord["quality_tier"]
): ModelRegistryRecord {
  return {
    id,
    provider,
    model_id: modelId,
    display_name: displayName,
    input_price_per_million_tokens: 0,
    output_price_per_million_tokens: 0,
    cached_input_price_per_million_tokens: null,
    context_window: 128000,
    max_output_tokens: 4096,
    supports_text: true,
    supports_image: false,
    supports_audio: false,
    supports_video: false,
    supports_tools: true,
    supports_structured_output: true,
    latency_tier: "unknown",
    quality_tier: qualityTier,
    recommended_task_types: ["classification", "support"],
    stability_status: "unverified",
    freshness_status: "unverified",
    source_url: null,
    last_verified_at: null,
    verified_by: null,
    pricing_note: "Demo placeholder price; unverified registry row.",
    is_mock: true,
    metadata: {},
    created_at: demoCreatedAt,
    updated_at: demoCreatedAt
  };
}

function createEvalResult(
  id: string,
  candidateId: string,
  modelId: string,
  passRate: number,
  mustPassFailures: number,
  riskLevel: EvalResult["risk_level"],
  verdict: EvalResult["verdict"]
): EvalResult {
  return {
    id,
    eval_run_id: demoEvalRun.id,
    candidate_id: candidateId,
    prompt_version_id: demoPromptVersion.id,
    model_registry_record_id:
      demoModelRegistry.find((model) => model.model_id === modelId)?.id ?? "model_record_openai_frontier",
    provider: "openai",
    model_id: modelId,
    quality_score: passRate,
    pass_rate: passRate,
    must_pass_failures: mustPassFailures,
    input_tokens: 32,
    output_tokens: 84,
    estimated_cost_usd: null,
    cost_estimate_status: "unverified",
    latency_ms: null,
    risk_level: riskLevel,
    verdict,
    failed_check_ids: mustPassFailures > 0 ? ["check_urgency"] : [],
    is_mock: true,
    created_at: demoCreatedAt
  };
}

function createArtifact(id: string, format: ReportArtifact["format"]): ReportArtifact {
  return {
    id,
    report_id: demoReport.id,
    format,
    storage_uri: `mock://reports/${demoReport.id}/${format}`,
    checksum: null,
    size_bytes: null,
    redaction_state: "redacted",
    is_mock: true,
    created_at: demoCreatedAt
  };
}
