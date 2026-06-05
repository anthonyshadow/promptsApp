import {
  scoreEvalResult,
  validateTestCaseChecks,
  type TestCaseValidationResult
} from "@promptopts/eval-core";
import { MockProviderAdapter, type ProviderAdapter } from "@promptopts/provider-adapters";
import {
  APP_NAME,
  createDemoRepositorySeed,
  createMemoryRepository,
  type EvalResult,
  type EvalRun,
  type ModelRegistryRecord,
  type OptimizationCandidate,
  type PromptOptsRepository,
  type PromptVersion,
  type QualityContract,
  type RiskLevel,
  type TestCase
} from "@promptopts/shared";

export type EvalRunnerResult = {
  evalRun: EvalRun;
  results: EvalResult[];
  retryHints: string[];
};

export type EvalRunnerOptions = {
  adapter?: ProviderAdapter;
  maxRuns?: number;
};

export async function runQueuedEvalRuns(
  repository: PromptOptsRepository,
  options: EvalRunnerOptions = {}
): Promise<EvalRunnerResult[]> {
  const evalRuns = (await repository.eval_runs.list())
    .filter((evalRun) => evalRun.status === "queued" || evalRun.status === "retrying")
    .slice(0, options.maxRuns ?? Number.POSITIVE_INFINITY);
  const results: EvalRunnerResult[] = [];

  for (const evalRun of evalRuns) {
    results.push(await runEvalRun(repository, evalRun, options));
  }

  return results;
}

export async function runEvalRun(
  repository: PromptOptsRepository,
  evalRun: EvalRun,
  options: EvalRunnerOptions = {}
): Promise<EvalRunnerResult> {
  const timestamp = nowIso();
  const contract = await repository.quality_contracts.get(evalRun.quality_contract_id);
  const testCases = (await repository.test_cases.list()).filter(
    (testCase) => testCase.quality_contract_id === evalRun.quality_contract_id
  );

  await repository.eval_runs.update(evalRun.id, {
    status: "running",
    started_at: evalRun.started_at ?? timestamp,
    completed_at: null
  });

  if (!contract || testCases.length === 0) {
    const failedRun = await repository.eval_runs.update(evalRun.id, {
      status: "failed",
      completed_at: nowIso()
    });

    return {
      evalRun: failedRun ?? evalRun,
      results: [],
      retryHints: [
        contract
          ? "Add test cases before starting a production recommendation eval."
          : "Quality contract is missing; create or restore it before retrying."
      ]
    };
  }

  const candidates = await resolveEvalCandidates(repository, evalRun);
  const models = await resolveEvalModels(repository, evalRun);
  const writtenResults: EvalResult[] = [];
  const retryHints = new Set<string>();

  if (candidates.length === 0 || models.length === 0) {
    const failedRun = await repository.eval_runs.update(evalRun.id, {
      status: "failed",
      completed_at: nowIso()
    });

    return {
      evalRun: failedRun ?? evalRun,
      results: [],
      retryHints: [
        candidates.length === 0
          ? "No prompt candidates could be resolved for this eval run."
          : "No model registry records could be resolved for this eval run."
      ]
    };
  }

  for (const candidate of candidates) {
    for (const model of models) {
      const combo = await runEvalCombo({
        repository,
        evalRun,
        contract,
        candidate,
        model,
        testCases,
        adapter: options.adapter ?? new MockProviderAdapter(model.provider)
      });
      writtenResults.push(combo.result);

      for (const hint of combo.retryHints) {
        retryHints.add(hint);
      }
    }
  }

  const finalStatus: EvalRun["status"] = retryHints.has("Provider rate limit encountered; retry later.")
    ? "rate_limited"
    : writtenResults.length > 0
      ? "complete"
      : "failed";
  const updated = await repository.eval_runs.update(evalRun.id, {
    status: finalStatus,
    completed_at: finalStatus === "complete" ? nowIso() : null
  });

  return {
    evalRun: updated ?? evalRun,
    results: writtenResults,
    retryHints: Array.from(retryHints)
  };
}

export function startEvalRunner(repository = createMemoryRepository(createDemoRepositorySeed())) {
  console.log(`${APP_NAME} eval-runner ready. Mock queue polling is enabled.`);

  void runQueuedEvalRuns(repository).then((results) => {
    console.log(`${APP_NAME} eval-runner processed ${results.length} queued run(s).`);
  });

  setInterval(() => {
    void runQueuedEvalRuns(repository).then((results) => {
      console.log(`${APP_NAME} eval-runner processed ${results.length} queued run(s).`);
    });
  }, 60_000);
}

if (import.meta.main) {
  startEvalRunner();
}

async function runEvalCombo(input: {
  repository: PromptOptsRepository;
  evalRun: EvalRun;
  contract: QualityContract;
  candidate: OptimizationCandidate;
  model: ModelRegistryRecord;
  testCases: TestCase[];
  adapter: ProviderAdapter;
}): Promise<{ result: EvalResult; retryHints: string[] }> {
  const testCaseResults: TestCaseValidationResult[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalLatencyMs = 0;
  const failedCheckIds = new Set<string>();
  const retryHints = new Set<string>();

  for (const testCase of input.testCases) {
    const providerResponse = await input.adapter.generate({
      provider: input.model.provider,
      modelId: input.model.model_id,
      prompt: input.candidate.candidate_prompt_text,
      inputVariables: testCase.input_variables,
      testCase
    });

    totalInputTokens += providerResponse.usage.inputTokens;
    totalOutputTokens += providerResponse.usage.outputTokens;
    totalLatencyMs += providerResponse.latencyMs;

    if (providerResponse.error) {
      failedCheckIds.add(`provider_error_${providerResponse.error.code}`);
      retryHints.add(
        providerResponse.error.retryable
          ? "Provider rate limit encountered; retry later."
          : "Provider error was sanitized; inspect provider configuration before retrying."
      );
      testCaseResults.push({
        testCaseId: testCase.id,
        results: [],
        deterministicPassRate: 0,
        mustPassFailures: [`provider_error_${providerResponse.error.code}`],
        unresolvedPlaceholders: [],
        passed: false
      });
      continue;
    }

    const validation = validateTestCaseChecks(
      testCase,
      providerResponse.outputJson ?? providerResponse.outputText
    );
    for (const failedCheckId of validation.mustPassFailures) {
      failedCheckIds.add(failedCheckId);
    }
    testCaseResults.push(validation);
  }

  const score = scoreEvalResult({
    testCaseResults,
    passThreshold: input.evalRun.pass_threshold
  });
  const cost = estimateComboCost({
    model: input.model,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens
  });
  const result: EvalResult = {
    id: createId("eval_result"),
    eval_run_id: input.evalRun.id,
    candidate_id: input.candidate.id,
    prompt_version_id: input.candidate.prompt_version_id,
    model_registry_record_id: input.model.id,
    provider: input.model.provider,
    model_id: input.model.model_id,
    quality_score: score.qualityScore,
    pass_rate: score.passRate,
    must_pass_failures: score.mustPassFailures,
    input_tokens: totalInputTokens,
    output_tokens: totalOutputTokens,
    estimated_cost_usd: cost.estimatedCostUsd,
    cost_estimate_status: cost.status,
    latency_ms: input.testCases.length > 0 ? Math.round(totalLatencyMs / input.testCases.length) : null,
    risk_level: getComboRisk(input.candidate.risk_level, score.mustPassFailures),
    verdict: score.verdict,
    failed_check_ids: dedupeStrings([
      ...score.failedCheckIds,
      ...score.unresolvedPlaceholderCheckIds,
      ...Array.from(failedCheckIds)
    ]),
    is_mock: true,
    created_at: nowIso()
  };

  await input.repository.eval_results.create(result);

  return {
    result,
    retryHints: Array.from(retryHints)
  };
}

async function resolveEvalCandidates(
  repository: PromptOptsRepository,
  evalRun: EvalRun
): Promise<OptimizationCandidate[]> {
  const promptVersion = await repository.prompt_versions.get(evalRun.baseline_prompt_version_id);
  const allCandidates = await repository.optimization_candidates.list();
  const selected = allCandidates.filter((candidate) => evalRun.candidate_ids.includes(candidate.id));
  const baseline =
    allCandidates.find(
      (candidate) =>
        candidate.is_baseline && candidate.prompt_version_id === evalRun.baseline_prompt_version_id
    ) ?? (promptVersion ? await createBaselineCandidate(repository, promptVersion, evalRun) : null);

  return dedupeById([baseline, ...selected].filter((candidate): candidate is OptimizationCandidate => Boolean(candidate)));
}

async function createBaselineCandidate(
  repository: PromptOptsRepository,
  promptVersion: PromptVersion,
  evalRun: EvalRun
): Promise<OptimizationCandidate> {
  const candidate: OptimizationCandidate = {
    id: createId("candidate_baseline"),
    label: "Baseline",
    prompt_version_id: promptVersion.id,
    analysis_id: null,
    strategy: "baseline",
    candidate_prompt_text: promptVersion.prompt_text,
    estimated_input_tokens: estimateTokens(promptVersion.prompt_text),
    estimated_output_tokens: 0,
    rationale: "Original prompt and current model are always the regression baseline.",
    risk_level: "low",
    expected_token_delta: 0,
    preserved_constraints: ["Baseline prompt remains unchanged."],
    removed_or_compressed_elements: ["None; baseline is unchanged."],
    is_baseline: true,
    is_mock: true,
    created_at: nowIso()
  };

  return repository.optimization_candidates.create(candidate);
}

async function resolveEvalModels(
  repository: PromptOptsRepository,
  evalRun: EvalRun
): Promise<ModelRegistryRecord[]> {
  const project = await repository.projects.get(evalRun.project_id);
  const allModels = await repository.model_registry.list();
  const selected = allModels.filter((model) => evalRun.model_registry_record_ids.includes(model.id));
  const baseline = project
    ? allModels.find(
        (model) =>
          model.provider === project.current_provider &&
          (model.model_id === project.current_model_id || model.id === project.current_model_id)
      )
    : undefined;

  return dedupeById([baseline, ...selected].filter((model): model is ModelRegistryRecord => Boolean(model)));
}

function estimateComboCost(input: {
  model: ModelRegistryRecord;
  inputTokens: number;
  outputTokens: number;
}): { estimatedCostUsd: number | null; status: EvalResult["cost_estimate_status"] } {
  if (input.model.is_mock || input.model.freshness_status !== "fresh" || !input.model.last_verified_at) {
    return {
      estimatedCostUsd: null,
      status: "unverified"
    };
  }

  return {
    estimatedCostUsd: roundCurrency(
      (input.inputTokens / 1_000_000) * input.model.input_price_per_million_tokens +
        (input.outputTokens / 1_000_000) * input.model.output_price_per_million_tokens
    ),
    status: "verified"
  };
}

function getComboRisk(candidateRisk: RiskLevel, mustPassFailures: number): RiskLevel {
  if (mustPassFailures > 0) {
    return "high";
  }

  return candidateRisk;
}

function dedupeById<TRecord extends { id: string }>(records: TRecord[]): TRecord[] {
  const seen = new Set<string>();
  const deduped: TRecord[] = [];

  for (const record of records) {
    if (!seen.has(record.id)) {
      seen.add(record.id);
      deduped.push(record);
    }
  }

  return deduped;
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.trim().split(/\s+/).length * 1.4));
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function nowIso(): string {
  return new Date().toISOString();
}
