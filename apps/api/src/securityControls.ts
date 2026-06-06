import net from "node:net";
import type { Context, MiddlewareHandler } from "hono";
import { errorResponseSchema } from "./contracts";
import type { ApiEnv } from "./context";

export type RateLimitPolicyName =
  | "public_audit"
  | "prompt_create"
  | "eval_run_create"
  | "report_generate"
  | "report_export"
  | "admin_login"
  | "admin_mfa"
  | "provider_key"
  | "admin_dangerous";

export type RateLimitPolicy = {
  name: RateLimitPolicyName;
  limit: number;
  windowMs: number;
};

export type RateLimitPolicyOverrides = Partial<
  Record<RateLimitPolicyName, Partial<Pick<RateLimitPolicy, "limit" | "windowMs">>>
>;

export type RateLimitResult = {
  count: number;
  resetAt: number;
};

export type RateLimitStore = {
  increment(key: string, windowMs: number): Promise<RateLimitResult>;
};

export type SafeRequestLogEvent = {
  request_id: string;
  method: string;
  route: string;
  status: number;
  duration_ms: number;
  ip_address: string;
  user_agent: string;
  workspace_id: string | null;
  account_id: string | null;
  admin_user_id: string | null;
  rate_limit_policy: string | null;
  metadata: Record<string, unknown>;
};

export type RequestLogger = {
  write(event: SafeRequestLogEvent): void | Promise<void>;
};

type ParsedRedisValue = string | number | null | ParsedRedisValue[];

const DEFAULT_RATE_LIMIT_POLICIES: Record<RateLimitPolicyName, RateLimitPolicy> = {
  public_audit: { name: "public_audit", limit: 30, windowMs: 60_000 },
  prompt_create: { name: "prompt_create", limit: 20, windowMs: 60_000 },
  eval_run_create: { name: "eval_run_create", limit: 10, windowMs: 60_000 },
  report_generate: { name: "report_generate", limit: 10, windowMs: 60_000 },
  report_export: { name: "report_export", limit: 60, windowMs: 60_000 },
  admin_login: { name: "admin_login", limit: 5, windowMs: 5 * 60_000 },
  admin_mfa: { name: "admin_mfa", limit: 6, windowMs: 5 * 60_000 },
  provider_key: { name: "provider_key", limit: 10, windowMs: 15 * 60_000 },
  admin_dangerous: { name: "admin_dangerous", limit: 20, windowMs: 60_000 }
};

const REDIS_RATE_LIMIT_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
return {current, ttl}
`;

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  async increment(key: string, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const current = this.buckets.get(key);

    if (!current || current.resetAt <= now) {
      const resetAt = now + windowMs;
      this.buckets.set(key, { count: 1, resetAt });
      return { count: 1, resetAt };
    }

    current.count += 1;
    this.buckets.set(key, current);

    return { count: current.count, resetAt: current.resetAt };
  }
}

export class RedisRateLimitStore implements RateLimitStore {
  private readonly url: URL;

  constructor(redisUrl: string) {
    this.url = new URL(redisUrl);
  }

  async increment(key: string, windowMs: number): Promise<RateLimitResult> {
    const commands: string[][] = [];

    if (this.url.password) {
      commands.push(
        this.url.username
          ? ["AUTH", decodeURIComponent(this.url.username), decodeURIComponent(this.url.password)]
          : ["AUTH", decodeURIComponent(this.url.password)]
      );
    }

    const db = this.url.pathname.replace("/", "");
    if (db) {
      commands.push(["SELECT", db]);
    }

    commands.push(["EVAL", REDIS_RATE_LIMIT_SCRIPT, "1", key, String(windowMs)]);

    const responses = await sendRedisCommands(this.url, commands);
    const result = responses.at(-1);

    if (!Array.isArray(result) || typeof result[0] !== "number" || typeof result[1] !== "number") {
      throw new Error("Redis rate-limit response was invalid");
    }

    return {
      count: result[0],
      resetAt: Date.now() + Math.max(0, result[1])
    };
  }
}

export function createMemoryRateLimitStore(): RateLimitStore {
  return new MemoryRateLimitStore();
}

export function createRateLimitStoreFromEnv(): RateLimitStore {
  if (process.env.REDIS_URL) {
    return new RedisRateLimitStore(process.env.REDIS_URL);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("REDIS_URL is required for production API rate limiting.");
  }

  return createMemoryRateLimitStore();
}

export function createConsoleRequestLogger(): RequestLogger {
  const enabled =
    process.env.PROMPTOPTS_REQUEST_LOGS === "console" ||
    process.env.NODE_ENV === "production";

  return {
    write(event) {
      if (enabled) {
        console.info(JSON.stringify(redactLogPayload(event)));
      }
    }
  };
}

export function createRequestIdMiddleware(): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    const requestId = c.req.header("x-request-id") ?? createRequestId();

    c.set("requestId", requestId);
    c.header("x-request-id", requestId);

    await next();
  };
}

export function createSafeRequestLoggerMiddleware(): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    const startedAt = Date.now();

    await next();

    const metadata = readSafeRequestMetadata(c);
    await c.var.requestLogger.write(
      redactLogPayload({
        request_id: c.var.requestId,
        method: c.req.method,
        route: c.req.path,
        status: c.res.status,
        duration_ms: Math.max(0, Date.now() - startedAt),
        ip_address: metadata.ipAddress,
        user_agent: metadata.userAgent,
        workspace_id: metadata.workspaceId,
        account_id: metadata.accountId,
        admin_user_id: c.var.adminSession?.admin_user_id ?? null,
        rate_limit_policy: c.var.rateLimitPolicy,
        metadata: {
          repository: c.var.repository?.backend ?? "unknown",
          redaction: "body_not_logged"
        }
      })
    );
  };
}

export function createRateLimitMiddleware(
  overrides: RateLimitPolicyOverrides = {}
): MiddlewareHandler<ApiEnv> {
  const policies = mergePolicies(overrides);

  return async (c, next) => {
    const policy = resolveRateLimitPolicy(c.req.method, c.req.path, policies);

    if (!policy) {
      await next();
      return;
    }

    c.set("rateLimitPolicy", policy.name);

    const key = createRateLimitKey(c, policy);
    const result = await c.var.rateLimitStore.increment(key, policy.windowMs);
    const remaining = Math.max(0, policy.limit - result.count);

    c.header("x-ratelimit-policy", policy.name);
    c.header("x-ratelimit-limit", String(policy.limit));
    c.header("x-ratelimit-remaining", String(remaining));
    c.header("x-ratelimit-reset", new Date(result.resetAt).toISOString());

    if (result.count > policy.limit) {
      return c.json(
        errorResponseSchema.parse({
          error: {
            code: "rate_limit_exceeded",
            message: `Rate limit exceeded for ${policy.name}.`,
            details: {
              policy: policy.name,
              retry_after_seconds: Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))
            }
          }
        }),
        429
      );
    }

    await next();
  };
}

export function redactLogPayload<TValue>(value: TValue): TValue {
  return redactValue(value) as TValue;
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }

  if (!value || typeof value !== "object") {
    return typeof value === "string" ? redactSensitiveString(value) : value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      shouldRedactField(key) ? "[redacted]" : redactValue(nested)
    ])
  );
}

function shouldRedactField(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "_");

  return [
    "api_key",
    "apikey",
    "access_token",
    "authorization",
    "bearer_token",
    "candidate_prompt_text",
    "content",
    "encrypted_key_blob",
    "expected_output",
    "input_variables",
    "mfa_code",
    "password",
    "prompt",
    "prompt_text",
    "raw_prompt",
    "raw_report",
    "report_body",
    "secret",
    "session_token",
    "token"
  ].includes(normalized);
}

function redactSensitiveString(value: string): string {
  return value
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted_api_key]")
    .replace(/\bAIza[0-9A-Za-z_-]{8,}\b/g, "[redacted_api_key]")
    .replace(/\bAKIA[0-9A-Z]{12,}\b/g, "[redacted_api_key]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted_email]")
    .replace(
      /\b(?:api[_-]?key|access[_-]?token|bearer|secret[_-]?key|password)\s*[:=]\s*["']?[^"'\s]{4,}/gi,
      "[redacted_secret]"
    );
}

function mergePolicies(overrides: RateLimitPolicyOverrides): Record<RateLimitPolicyName, RateLimitPolicy> {
  return Object.fromEntries(
    Object.entries(DEFAULT_RATE_LIMIT_POLICIES).map(([name, policy]) => {
      const override = overrides[name as RateLimitPolicyName] ?? {};

      return [
        name,
        {
          ...policy,
          ...override
        }
      ];
    })
  ) as Record<RateLimitPolicyName, RateLimitPolicy>;
}

function resolveRateLimitPolicy(
  method: string,
  path: string,
  policies: Record<RateLimitPolicyName, RateLimitPolicy>
): RateLimitPolicy | null {
  const upperMethod = method.toUpperCase();

  if (upperMethod === "POST" && path === "/audits") {
    return policies.public_audit;
  }
  if (upperMethod === "POST" && path === "/prompts") {
    return policies.prompt_create;
  }
  if (upperMethod === "POST" && path === "/eval-runs") {
    return policies.eval_run_create;
  }
  if (upperMethod === "POST" && path === "/reports") {
    return policies.report_generate;
  }
  if (upperMethod === "GET" && /^\/reports\/[^/]+\/export$/.test(path)) {
    return policies.report_export;
  }
  if (upperMethod === "POST" && path === "/admin-api/auth/login") {
    return policies.admin_login;
  }
  if (upperMethod === "POST" && path === "/admin-api/auth/mfa/verify") {
    return policies.admin_mfa;
  }
  if (upperMethod === "POST" && /^\/provider-connections(?:\/[^/]+\/(?:rotate|revoke))?$/.test(path)) {
    return policies.provider_key;
  }
  if (upperMethod === "POST" && isDangerousAdminRoute(path)) {
    return policies.admin_dangerous;
  }

  return null;
}

function isDangerousAdminRoute(path: string): boolean {
  return [
    /^\/admin-api\/sudo\/start$/,
    /^\/admin-api\/reports\/[^/]+\/delete$/,
    /^\/admin-api\/reports\/[^/]+\/reveal$/,
    /^\/admin-api\/billing\/[^/]+\/credit$/,
    /^\/admin-api\/users\/[^/]+\/impersonate$/,
    /^\/admin-api\/break-glass$/
  ].some((pattern) => pattern.test(path));
}

function createRateLimitKey(c: Context<ApiEnv>, policy: RateLimitPolicy): string {
  const metadata = readSafeRequestMetadata(c);
  const sessionSubject =
    c.var.adminSession?.session_id ??
    hashStable(c.req.header("authorization") ?? c.req.header("cookie") ?? "anonymous");

  return [
    "promptopts",
    "rate_limit",
    policy.name,
    metadata.ipAddress,
    sessionSubject,
    metadata.workspaceId ?? "workspace_unknown",
    metadata.accountId ?? "account_unknown"
  ].join(":");
}

function readSafeRequestMetadata(c: Context<ApiEnv>) {
  return {
    ipAddress:
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("cf-connecting-ip") ??
      "127.0.0.1",
    userAgent: c.req.header("user-agent") ?? "unknown",
    workspaceId:
      c.req.header("x-workspace-id") ??
      c.req.query("workspace_id") ??
      c.var.adminActionContext?.workspace_id ??
      null,
    accountId:
      c.req.header("x-account-id") ??
      c.req.query("account_id") ??
      c.var.adminActionContext?.account_id ??
      null
  };
}

function createRequestId(): string {
  return `req_${crypto.randomUUID().replaceAll("-", "")}`;
}

function hashStable(value: string): string {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return (hash >>> 0).toString(16);
}

async function sendRedisCommands(url: URL, commands: string[][]): Promise<ParsedRedisValue[]> {
  return new Promise((resolve, reject) => {
    const port = Number(url.port || 6379);
    const host = url.hostname || "127.0.0.1";
    const socket = net.createConnection({ host, port });
    let buffer = "";
    let settled = false;
    const timeout = setTimeout(() => {
      finish(new Error("Redis rate-limit command timed out"));
    }, 1_500);

    function finish(error?: Error, values?: ParsedRedisValue[]) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      socket.destroy();

      if (error) {
        reject(error);
      } else {
        resolve(values ?? []);
      }
    }

    socket.on("connect", () => {
      socket.write(commands.map(encodeRedisCommand).join(""));
    });
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");

      try {
        const parsed = parseRedisResponses(buffer, commands.length);
        if (parsed) {
          finish(undefined, parsed.values);
        }
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)));
      }
    });
    socket.on("error", (error) => finish(error));
  });
}

function encodeRedisCommand(parts: string[]): string {
  return `*${parts.length}\r\n${parts
    .map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`)
    .join("")}`;
}

function parseRedisResponses(
  buffer: string,
  expectedCount: number
): { values: ParsedRedisValue[]; nextOffset: number } | null {
  const values: ParsedRedisValue[] = [];
  let offset = 0;

  while (values.length < expectedCount) {
    const parsed = parseRedisValue(buffer, offset);

    if (!parsed) {
      return null;
    }

    values.push(parsed.value);
    offset = parsed.nextOffset;
  }

  return { values, nextOffset: offset };
}

function parseRedisValue(
  buffer: string,
  offset: number
): { value: ParsedRedisValue; nextOffset: number } | null {
  if (offset >= buffer.length) {
    return null;
  }

  const marker = buffer[offset];
  const lineEnd = buffer.indexOf("\r\n", offset);
  if (lineEnd === -1) {
    return null;
  }
  const line = buffer.slice(offset + 1, lineEnd);
  const next = lineEnd + 2;

  if (marker === "+") {
    return { value: line, nextOffset: next };
  }
  if (marker === "-") {
    throw new Error(`Redis error: ${line}`);
  }
  if (marker === ":") {
    return { value: Number(line), nextOffset: next };
  }
  if (marker === "$") {
    const length = Number(line);
    if (length < 0) {
      return { value: null, nextOffset: next };
    }
    const end = next + length;
    if (buffer.length < end + 2) {
      return null;
    }
    return { value: buffer.slice(next, end), nextOffset: end + 2 };
  }
  if (marker === "*") {
    const length = Number(line);
    let cursor = next;
    const values: ParsedRedisValue[] = [];

    for (let index = 0; index < length; index += 1) {
      const parsed = parseRedisValue(buffer, cursor);
      if (!parsed) {
        return null;
      }
      values.push(parsed.value);
      cursor = parsed.nextOffset;
    }

    return { value: values, nextOffset: cursor };
  }

  throw new Error(`Unsupported Redis response marker: ${marker}`);
}
