import { describe, expect, test } from "bun:test";
import { DEMO_IDS, createDemoRepositorySeed, createMemoryRepository } from "@promptopts/shared";
import { runEvalRun, runQueuedEvalRuns } from "./index";

describe("eval runner", () => {
  test("runs queued mock evals and writes combo results", async () => {
    const repository = createMemoryRepository(createDemoRepositorySeed());
    const beforeResults = await repository.eval_results.list();

    const processed = await runQueuedEvalRuns(repository, { maxRuns: 1 });
    const evalRun = await repository.eval_runs.get(DEMO_IDS.evalRun);
    const afterResults = await repository.eval_results.list();

    expect(processed).toHaveLength(1);
    expect(evalRun?.status).toBe("complete");
    expect(afterResults.length).toBeGreaterThan(beforeResults.length);
    expect(afterResults.every((result) => result.eval_run_id === DEMO_IDS.evalRun)).toBe(true);
    expect(afterResults.map((result) => result.verdict)).toContain("pass");
    expect(afterResults.every((result) => result.cost_estimate_status === "unverified")).toBe(true);
  });

  test("keeps original prompt and current model as the baseline even with empty selections", async () => {
    const repository = createMemoryRepository(createDemoRepositorySeed());
    const timestamp = "2026-06-05T12:00:00.000Z";
    const evalRun = await repository.eval_runs.create({
      id: "eval_run_empty_selection",
      project_id: DEMO_IDS.project,
      quality_contract_id: DEMO_IDS.qualityContract,
      baseline_prompt_version_id: DEMO_IDS.promptVersion,
      candidate_ids: [],
      model_registry_record_ids: [],
      status: "queued",
      pass_threshold: 0.95,
      is_mock: true,
      queued_at: timestamp,
      started_at: null,
      completed_at: null
    });

    const result = await runEvalRun(repository, evalRun);

    expect(result.evalRun.status).toBe("complete");
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.model_id).toBe("openai-demo-balanced");
    expect(result.results[0]?.candidate_id).toContain("candidate");
  });

  test("fails queued evals without test cases and returns retry hints", async () => {
    const repository = createMemoryRepository(createDemoRepositorySeed());
    const timestamp = "2026-06-05T12:00:00.000Z";
    const contract = await repository.quality_contracts.create({
      id: "quality_contract_empty",
      project_id: DEMO_IDS.project,
      task: "No tests",
      required_output: "Required output.",
      must_preserve: ["Output shape"],
      forbidden_behavior: ["No hallucinations"],
      pass_threshold: 0.95,
      must_pass_check_ids: ["check_empty"],
      check_definitions: [
        {
          id: "check_empty",
          type: "required_phrase",
          description: "Requires support.",
          must_pass: true,
          field_path: null,
          expected_value: "support",
          pattern: null,
          placeholder_note: null
        }
      ],
      notes: null,
      is_mock: true,
      created_at: timestamp,
      updated_at: timestamp
    });
    const evalRun = await repository.eval_runs.create({
      id: "eval_run_no_tests",
      project_id: DEMO_IDS.project,
      quality_contract_id: contract.id,
      baseline_prompt_version_id: DEMO_IDS.promptVersion,
      candidate_ids: [],
      model_registry_record_ids: [],
      status: "queued",
      pass_threshold: 0.95,
      is_mock: true,
      queued_at: timestamp,
      started_at: null,
      completed_at: null
    });

    const result = await runEvalRun(repository, evalRun);

    expect(result.evalRun.status).toBe("failed");
    expect(result.results).toHaveLength(0);
    expect(result.retryHints.join(" ")).toContain("Add test cases");
  });
});
