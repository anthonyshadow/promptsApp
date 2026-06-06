import type {
  EvalQueueJob,
  EvalResult,
  EvalRun,
  JobEvent,
  WorkerHeartbeat
} from "./schemas";
import type { PromptOptsRepository } from "./repositories/types";

export type EvalQueueStatus = {
  evalRun: EvalRun;
  job: EvalQueueJob | null;
  results: EvalResult[];
  events: JobEvent[];
  workerHeartbeats: WorkerHeartbeat[];
  retryHints: string[];
};

export type EnqueueEvalRunInput = {
  evalRun: EvalRun;
  workspaceId: string;
  maxAttempts?: number;
  metadata?: Record<string, unknown>;
};

export type ClaimEvalJobInput = {
  workerId: string;
  now?: string | undefined;
  lockMs?: number;
};

export type QueueMutationInput = {
  workerId?: string | undefined;
  retryHint?: string | undefined;
  sanitizedError?: Record<string, unknown> | null | undefined;
  retryAfterSeconds?: number | undefined;
  reasonCode?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
  now?: string | undefined;
};

export async function enqueueEvalRun(
  repository: PromptOptsRepository,
  input: EnqueueEvalRunInput
): Promise<{ evalRun: EvalRun; job: EvalQueueJob }> {
  const now = input.evalRun.queued_at;
  const evalRun =
    (await repository.eval_runs.get(input.evalRun.id)) ??
    (await repository.eval_runs.create({
      ...input.evalRun,
      status: "queued",
      started_at: null,
      completed_at: null
    }));
  const existingJob = await findEvalQueueJob(repository, evalRun.id);

  if (existingJob) {
    const updated = await repository.eval_queue_jobs.update(existingJob.id, {
      status: "queued",
      next_attempt_at: now,
      rate_limited_until: null,
      retry_after_seconds: null,
      retry_hint: "Eval run re-queued.",
      sanitized_error: null,
      cancelled_at: null,
      completed_at: null,
      updated_at: now
    });

    await appendEvalJobEvent(repository, updated ?? existingJob, "queued", {
      metadata: { source: "enqueue", ...(input.metadata ?? {}) },
      now
    });

    return {
      evalRun,
      job: updated ?? existingJob
    };
  }

  const job: EvalQueueJob = {
    id: createId("eval_queue_job"),
    eval_run_id: evalRun.id,
    workspace_id: input.workspaceId,
    project_id: evalRun.project_id,
    status: "queued",
    attempt_count: 0,
    max_attempts: input.maxAttempts ?? 3,
    locked_by: null,
    locked_until: null,
    last_heartbeat_at: null,
    next_attempt_at: now,
    rate_limited_until: null,
    retry_after_seconds: null,
    retry_hint: "Eval run queued for durable worker processing.",
    sanitized_error: null,
    metadata: {
      payload_redacted: true,
      ...(input.metadata ?? {})
    },
    is_mock: evalRun.is_mock,
    created_at: now,
    updated_at: now,
    completed_at: null,
    cancelled_at: null
  };

  const created = await repository.eval_queue_jobs.create(job);
  await appendEvalJobEvent(repository, created, "queued", {
    metadata: { source: "enqueue" },
    now
  });

  return {
    evalRun,
    job: created
  };
}

export async function claimNextEvalJob(
  repository: PromptOptsRepository,
  input: ClaimEvalJobInput
): Promise<EvalQueueJob | null> {
  const now = input.now ?? nowIso();
  const lockUntil = new Date(Date.parse(now) + (input.lockMs ?? 5 * 60_000)).toISOString();
  const candidates = (await repository.eval_queue_jobs.list())
    .filter((job) => isClaimable(job, now))
    .sort((a, b) => {
      const aTime = Date.parse(a.next_attempt_at ?? a.created_at);
      const bTime = Date.parse(b.next_attempt_at ?? b.created_at);
      return aTime - bTime || a.created_at.localeCompare(b.created_at);
    });
  const job = candidates[0] ?? null;

  if (!job) {
    return null;
  }

  const claimed = await repository.eval_queue_jobs.update(job.id, {
    status: "running",
    attempt_count: job.attempt_count + 1,
    locked_by: input.workerId,
    locked_until: lockUntil,
    last_heartbeat_at: now,
    retry_hint: null,
    updated_at: now
  });
  await repository.eval_runs.update(job.eval_run_id, {
    status: "running",
    started_at: (await repository.eval_runs.get(job.eval_run_id))?.started_at ?? now,
    completed_at: null
  });

  const next = claimed ?? job;
  await appendEvalJobEvent(repository, next, "running", {
    metadata: { worker_id: input.workerId, attempt_count: next.attempt_count },
    now
  });

  return next;
}

export async function heartbeatWorker(
  repository: PromptOptsRepository,
  input: {
    workerName: string;
    instanceId: string;
    status?: WorkerHeartbeat["status"] | undefined;
    metadata?: Record<string, unknown> | undefined;
    now?: string | undefined;
  }
): Promise<WorkerHeartbeat> {
  const now = input.now ?? nowIso();
  const id = `worker_heartbeat_${slugPart(input.workerName)}_${slugPart(input.instanceId)}`;
  const record: WorkerHeartbeat = {
    id,
    worker_name: input.workerName,
    instance_id: input.instanceId,
    status: input.status ?? "healthy",
    last_heartbeat_at: now,
    metadata: {
      payload_redacted: true,
      ...(input.metadata ?? {})
    },
    created_at: now,
    updated_at: now
  };
  const existing = await repository.worker_heartbeats.get(id);

  if (existing) {
    return (
      (await repository.worker_heartbeats.update(id, {
        status: record.status,
        last_heartbeat_at: record.last_heartbeat_at,
        metadata: record.metadata,
        updated_at: record.updated_at
      })) ?? existing
    );
  }

  return repository.worker_heartbeats.create(record);
}

export async function markJobRunning(
  repository: PromptOptsRepository,
  evalRunId: string,
  input: QueueMutationInput = {}
): Promise<EvalQueueJob | null> {
  const job = await findEvalQueueJob(repository, evalRunId);
  if (!job) {
    return null;
  }

  const now = input.now ?? nowIso();
  const updated = await repository.eval_queue_jobs.update(job.id, {
    status: "running",
    locked_by: input.workerId ?? job.locked_by,
    last_heartbeat_at: now,
    updated_at: now
  });
  await repository.eval_runs.update(evalRunId, {
    status: "running",
    started_at: (await repository.eval_runs.get(evalRunId))?.started_at ?? now,
    completed_at: null
  });
  await appendEvalJobEvent(repository, updated ?? job, "running", {
    metadata: input.metadata,
    now
  });

  return updated ?? job;
}

export async function appendPartialResult(
  repository: PromptOptsRepository,
  result: EvalResult,
  input: QueueMutationInput = {}
): Promise<EvalResult> {
  const created = await repository.eval_results.create(result);
  const job = await findEvalQueueJob(repository, result.eval_run_id);

  if (job) {
    const now = input.now ?? result.created_at;
    await repository.eval_queue_jobs.update(job.id, {
      last_heartbeat_at: now,
      updated_at: now
    });
    await appendEvalJobEvent(repository, job, "partial_result", {
      metadata: {
        result_id: result.id,
        verdict: result.verdict,
        failed_check_count: result.failed_check_ids.length,
        ...(input.metadata ?? {})
      },
      now
    });
  }

  return created;
}

export async function markRateLimited(
  repository: PromptOptsRepository,
  evalRunId: string,
  input: QueueMutationInput = {}
): Promise<EvalQueueJob | null> {
  const job = await findEvalQueueJob(repository, evalRunId);
  if (!job) {
    return null;
  }

  const now = input.now ?? nowIso();
  const retryAfterSeconds = input.retryAfterSeconds ?? 60;
  const retryAt = new Date(Date.parse(now) + retryAfterSeconds * 1000).toISOString();
  const updated = await repository.eval_queue_jobs.update(job.id, {
    status: "rate_limited",
    locked_by: null,
    locked_until: null,
    rate_limited_until: retryAt,
    next_attempt_at: retryAt,
    retry_after_seconds: retryAfterSeconds,
    retry_hint: input.retryHint ?? "Provider rate limit encountered; retry after backoff.",
    sanitized_error: input.sanitizedError ?? { code: "rate_limited", retryable: true },
    updated_at: now
  });
  await repository.eval_runs.update(evalRunId, {
    status: "rate_limited",
    completed_at: null
  });
  await appendEvalJobEvent(repository, updated ?? job, "rate_limited", {
    sanitizedError: input.sanitizedError ?? { code: "rate_limited", retryable: true },
    metadata: input.metadata,
    now
  });

  return updated ?? job;
}

export async function markRetrying(
  repository: PromptOptsRepository,
  evalRunId: string,
  input: QueueMutationInput = {}
): Promise<EvalQueueJob | null> {
  const job = await findEvalQueueJob(repository, evalRunId);
  if (!job) {
    return null;
  }

  const now = input.now ?? nowIso();
  const updated = await repository.eval_queue_jobs.update(job.id, {
    status: "retrying",
    locked_by: null,
    locked_until: null,
    next_attempt_at: now,
    rate_limited_until: null,
    retry_after_seconds: null,
    retry_hint: input.retryHint ?? "Eval job queued for retry.",
    sanitized_error: null,
    cancelled_at: null,
    completed_at: null,
    updated_at: now
  });
  await repository.eval_runs.update(evalRunId, {
    status: "retrying",
    started_at: null,
    completed_at: null
  });
  await appendEvalJobEvent(repository, updated ?? job, "retrying", {
    metadata: { reason_code: input.reasonCode, ...(input.metadata ?? {}) },
    now
  });

  return updated ?? job;
}

export async function markFailed(
  repository: PromptOptsRepository,
  evalRunId: string,
  input: QueueMutationInput = {}
): Promise<EvalQueueJob | null> {
  const job = await findEvalQueueJob(repository, evalRunId);
  if (!job) {
    return null;
  }

  const now = input.now ?? nowIso();
  const updated = await repository.eval_queue_jobs.update(job.id, {
    status: "failed",
    locked_by: null,
    locked_until: null,
    retry_hint: input.retryHint ?? "Eval job failed; inspect sanitized errors and retry hints.",
    sanitized_error: input.sanitizedError ?? null,
    completed_at: now,
    updated_at: now
  });
  await repository.eval_runs.update(evalRunId, {
    status: "failed",
    completed_at: now
  });
  await appendEvalJobEvent(repository, updated ?? job, "failed", {
    sanitizedError: input.sanitizedError ?? null,
    metadata: input.metadata,
    now
  });

  return updated ?? job;
}

export async function markComplete(
  repository: PromptOptsRepository,
  evalRunId: string,
  input: QueueMutationInput = {}
): Promise<EvalQueueJob | null> {
  const job = await findEvalQueueJob(repository, evalRunId);
  if (!job) {
    return null;
  }

  const now = input.now ?? nowIso();
  const updated = await repository.eval_queue_jobs.update(job.id, {
    status: "complete",
    locked_by: null,
    locked_until: null,
    retry_hint: input.retryHint ?? "Eval matrix complete.",
    completed_at: now,
    updated_at: now
  });
  await repository.eval_runs.update(evalRunId, {
    status: "complete",
    completed_at: now
  });
  await appendEvalJobEvent(repository, updated ?? job, "complete", {
    metadata: input.metadata,
    now
  });

  return updated ?? job;
}

export async function cancelJob(
  repository: PromptOptsRepository,
  evalRunId: string,
  input: QueueMutationInput = {}
): Promise<EvalQueueJob | null> {
  const job = await findEvalQueueJob(repository, evalRunId);
  if (!job) {
    return null;
  }

  const now = input.now ?? nowIso();
  const updated = await repository.eval_queue_jobs.update(job.id, {
    status: "failed",
    locked_by: null,
    locked_until: null,
    retry_hint: input.retryHint ?? "Eval job was cancelled by an operator.",
    sanitized_error: input.sanitizedError ?? {
      code: "cancelled",
      reason_code: input.reasonCode ?? "operator_cancel"
    },
    completed_at: now,
    cancelled_at: now,
    updated_at: now
  });
  await repository.eval_runs.update(evalRunId, {
    status: "failed",
    completed_at: now
  });
  await appendEvalJobEvent(repository, updated ?? job, "cancelled", {
    sanitizedError: input.sanitizedError ?? {
      code: "cancelled",
      reason_code: input.reasonCode ?? "operator_cancel"
    },
    metadata: input.metadata,
    now
  });

  return updated ?? job;
}

export async function retryJob(
  repository: PromptOptsRepository,
  evalRunId: string,
  input: QueueMutationInput = {}
): Promise<EvalQueueJob | null> {
  return markRetrying(repository, evalRunId, {
    ...input,
    retryHint: input.retryHint ?? "Operator retry requested; job is durable and will be claimed by a worker."
  });
}

export async function getEvalRunStatus(
  repository: PromptOptsRepository,
  evalRunId: string
): Promise<EvalQueueStatus | null> {
  const evalRun = await repository.eval_runs.get(evalRunId);
  if (!evalRun) {
    return null;
  }

  const [job, results, events, workerHeartbeats] = await Promise.all([
    findEvalQueueJob(repository, evalRunId),
    repository.eval_results.list(),
    repository.job_events.list(),
    repository.worker_heartbeats.list()
  ]);
  const runResults = results.filter((result) => result.eval_run_id === evalRunId);
  const runEvents = events
    .filter((event) => event.eval_run_id === evalRunId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  return {
    evalRun,
    job,
    results: runResults,
    events: runEvents,
    workerHeartbeats,
    retryHints: getQueueRetryHints(evalRun, job, runResults)
  };
}

export async function findEvalQueueJob(
  repository: PromptOptsRepository,
  evalRunId: string
): Promise<EvalQueueJob | null> {
  return (
    (await repository.eval_queue_jobs.list()).find((job) => job.eval_run_id === evalRunId) ?? null
  );
}

export async function appendEvalJobEvent(
  repository: PromptOptsRepository,
  job: EvalQueueJob,
  status: string,
  input: {
    sanitizedError?: Record<string, unknown> | null | undefined;
    metadata?: Record<string, unknown> | undefined;
    now?: string | undefined;
  } = {}
): Promise<JobEvent> {
  const now = input.now ?? nowIso();

  return repository.job_events.create({
    id: createId("job_event"),
    job_type: "eval_run",
    job_id: job.id,
    status,
    workspace_id: job.workspace_id,
    eval_run_id: job.eval_run_id,
    report_id: null,
    sanitized_error: input.sanitizedError ?? null,
    metadata: {
      payload_redacted: true,
      ...(input.metadata ?? {})
    },
    created_at: now
  });
}

function isClaimable(job: EvalQueueJob, now: string): boolean {
  if (job.cancelled_at || job.status === "failed" || job.status === "complete") {
    return false;
  }
  if (job.status === "running" && job.locked_until && Date.parse(job.locked_until) > Date.parse(now)) {
    return false;
  }
  if (job.attempt_count >= job.max_attempts && job.status !== "running") {
    return false;
  }
  if (job.next_attempt_at && Date.parse(job.next_attempt_at) > Date.parse(now)) {
    return false;
  }
  if (job.rate_limited_until && Date.parse(job.rate_limited_until) > Date.parse(now)) {
    return false;
  }

  return ["queued", "retrying", "rate_limited", "running"].includes(job.status);
}

function getQueueRetryHints(
  evalRun: EvalRun,
  job: EvalQueueJob | null,
  results: EvalResult[]
): string[] {
  const hints = new Set<string>();

  if (!job) {
    hints.add("No durable queue record exists for this eval run.");
  } else {
    if (job.retry_hint) {
      hints.add(job.retry_hint);
    }
    if (job.status === "rate_limited" && job.rate_limited_until) {
      hints.add(`Rate-limited until ${job.rate_limited_until}; retry is backoff-gated.`);
    }
    if (job.cancelled_at) {
      hints.add("Eval job was cancelled; retry creates a new durable attempt.");
    }
    if (job.attempt_count >= job.max_attempts && job.status !== "complete") {
      hints.add("Maximum retry attempts reached; operator review is required.");
    }
  }
  if (evalRun.status === "queued" || evalRun.status === "running" || evalRun.status === "retrying") {
    hints.add("Eval run is still in progress; poll for partial rows.");
  }
  if (results.length === 0) {
    hints.add("No eval rows are available yet.");
  }

  return Array.from(hints);
}

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function slugPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "worker";
}
