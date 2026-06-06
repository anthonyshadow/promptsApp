import { describe, expect, test } from "bun:test";
import {
  appendPartialResult,
  cancelJob,
  claimNextEvalJob,
  createDemoRepositorySeed,
  createMemoryRepository,
  DEMO_IDS,
  enqueueEvalRun,
  getEvalRunStatus,
  heartbeatWorker,
  markRateLimited,
  retryJob,
  type EvalResult
} from "./index";

const timestamp = "2026-06-06T12:00:00.000Z";

describe("durable eval queue", () => {
  test("enqueues and claims eval jobs with persisted attempts", async () => {
    const repository = createMemoryRepository(createDemoRepositorySeed());
    const evalRun = await repository.eval_runs.get(DEMO_IDS.evalRun);

    if (!evalRun) {
      throw new Error("Missing demo eval run");
    }

    const queued = await enqueueEvalRun(repository, {
      evalRun,
      workspaceId: DEMO_IDS.workspace,
      metadata: { selected_test_case_ids: ["test_case_support_classifier_billing"] }
    });

    expect(queued.job.status).toBe("queued");

    const claimed = await claimNextEvalJob(repository, {
      workerId: "queue_test_worker",
      now: timestamp
    });

    expect(claimed?.eval_run_id).toBe(evalRun.id);
    expect(claimed?.status).toBe("running");
    expect(claimed?.attempt_count).toBe(1);

    const status = await getEvalRunStatus(repository, evalRun.id);
    expect(status?.job?.attempt_count).toBe(1);
    expect(status?.events.map((event) => event.status)).toContain("running");
  });

  test("persists partial result rows and sanitized queue events", async () => {
    const repository = createMemoryRepository(createDemoRepositorySeed());
    const result: EvalResult = {
      id: "eval_result_queue_partial",
      eval_run_id: DEMO_IDS.evalRun,
      candidate_id: "candidate_support_classifier_baseline",
      prompt_version_id: DEMO_IDS.promptVersion,
      model_registry_record_id: "model_registry_openai_demo_balanced",
      provider: "openai",
      model_id: "openai-demo-balanced",
      quality_score: 1,
      pass_rate: 1,
      must_pass_failures: 0,
      input_tokens: 12,
      output_tokens: 18,
      estimated_cost_usd: null,
      cost_estimate_status: "unverified",
      latency_ms: 120,
      risk_level: "low",
      verdict: "pass",
      failed_check_ids: [],
      is_mock: true,
      created_at: timestamp
    };

    await appendPartialResult(repository, result);

    const status = await getEvalRunStatus(repository, DEMO_IDS.evalRun);
    expect(status?.results).toHaveLength(1);
    expect(status?.events.map((event) => event.status)).toContain("partial_result");
    expect(JSON.stringify(status?.events)).not.toContain("Classify the inbound support message");
  });

  test("rate limit, retry, and cancellation states are durable", async () => {
    const repository = createMemoryRepository(createDemoRepositorySeed());

    const limited = await markRateLimited(repository, DEMO_IDS.evalRun, {
      retryAfterSeconds: 30,
      retryHint: "Provider rate limit encountered.",
      sanitizedError: { code: "rate_limited", retryable: true },
      now: timestamp
    });
    expect(limited?.status).toBe("rate_limited");
    expect(limited?.rate_limited_until).not.toBeNull();

    const retrying = await retryJob(repository, DEMO_IDS.evalRun, {
      reasonCode: "operator_retry",
      now: "2026-06-06T12:01:00.000Z"
    });
    expect(retrying?.status).toBe("retrying");

    const claimed = await claimNextEvalJob(repository, {
      workerId: "queue_retry_worker",
      now: "2026-06-06T12:01:01.000Z"
    });
    expect(claimed?.attempt_count).toBe(1);

    const cancelled = await cancelJob(repository, DEMO_IDS.evalRun, {
      reasonCode: "operator_cancel",
      now: "2026-06-06T12:02:00.000Z"
    });
    expect(cancelled?.status).toBe("failed");
    expect(cancelled?.cancelled_at).not.toBeNull();

    const nextClaim = await claimNextEvalJob(repository, {
      workerId: "queue_retry_worker",
      now: "2026-06-06T12:02:01.000Z"
    });
    expect(nextClaim).toBeNull();
  });

  test("heartbeats upsert worker health without raw payloads", async () => {
    const repository = createMemoryRepository(createDemoRepositorySeed());

    await heartbeatWorker(repository, {
      workerName: "eval-runner",
      instanceId: "queue-test",
      metadata: { queue_depth: 1 },
      now: timestamp
    });
    await heartbeatWorker(repository, {
      workerName: "eval-runner",
      instanceId: "queue-test",
      status: "degraded",
      metadata: { queue_depth: 2 },
      now: "2026-06-06T12:03:00.000Z"
    });

    const heartbeats = (await repository.worker_heartbeats.list()).filter(
      (heartbeat) => heartbeat.instance_id === "queue-test"
    );
    expect(heartbeats).toHaveLength(1);
    expect(heartbeats[0]?.status).toBe("degraded");
    expect(JSON.stringify(heartbeats[0])).not.toContain("prompt_text");
  });
});
