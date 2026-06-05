import type { Provider, TestCase } from "@promptopts/shared";

export type ProviderCallInput = {
  provider: Provider;
  modelId: string;
  prompt: string;
  inputVariables: Record<string, unknown>;
  testCase?: Pick<TestCase, "id" | "name" | "expected_output">;
};

export type ProviderUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type NormalizedProviderResponse = {
  provider: Provider;
  modelId: string;
  outputText: string;
  outputJson: unknown | null;
  usage: ProviderUsage;
  latencyMs: number;
  finishReason: "stop" | "length" | "error";
  error: SanitizedProviderError | null;
};

export type SanitizedProviderError = {
  code: "missing_key" | "not_implemented" | "rate_limited" | "provider_error";
  message: string;
  retryable: boolean;
  statusCode: number | null;
};

export interface ProviderAdapter {
  readonly provider: Provider;
  generate(input: ProviderCallInput): Promise<NormalizedProviderResponse>;
}

type RawProviderResponse = {
  text?: string;
  json?: unknown;
  usage?: Partial<ProviderUsage>;
  latencyMs?: number;
  finishReason?: NormalizedProviderResponse["finishReason"];
};

// Every adapter must normalize usage, output, latency, and errors before eval-core scores a row.
export function normalizeProviderResponse(
  input: ProviderCallInput,
  raw: RawProviderResponse
): NormalizedProviderResponse {
  const outputJson = raw.json ?? tryParseJson(raw.text ?? "");
  const outputText =
    raw.text ?? (typeof outputJson === "undefined" ? "" : JSON.stringify(outputJson));

  return {
    provider: input.provider,
    modelId: input.modelId,
    outputText,
    outputJson: outputJson ?? null,
    usage: {
      inputTokens: raw.usage?.inputTokens ?? estimateTokens(input.prompt),
      outputTokens: raw.usage?.outputTokens ?? estimateTokens(outputText)
    },
    latencyMs: raw.latencyMs ?? 0,
    finishReason: raw.finishReason ?? "stop",
    error: null
  };
}

export function normalizeProviderError(
  input: ProviderCallInput,
  error: unknown
): NormalizedProviderResponse {
  const sanitized = sanitizeProviderError(error);

  return {
    provider: input.provider,
    modelId: input.modelId,
    outputText: "",
    outputJson: null,
    usage: {
      inputTokens: estimateTokens(input.prompt),
      outputTokens: 0
    },
    latencyMs: 0,
    finishReason: "error",
    error: sanitized
  };
}

export function sanitizeProviderError(error: unknown): SanitizedProviderError {
  if (isProviderAdapterError(error)) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      statusCode: error.statusCode
    };
  }

  if (error && typeof error === "object") {
    const maybeStatus = "status" in error ? Number((error as { status?: unknown }).status) : null;

    return {
      code: maybeStatus === 429 ? "rate_limited" : "provider_error",
      message: maybeStatus === 429 ? "Provider rate limit encountered." : "Provider call failed.",
      retryable: maybeStatus === 429 || maybeStatus === 503,
      statusCode: Number.isFinite(maybeStatus) ? maybeStatus : null
    };
  }

  return {
    code: "provider_error",
    message: "Provider call failed.",
    retryable: false,
    statusCode: null
  };
}

export class MockProviderAdapter implements ProviderAdapter {
  readonly provider: Provider;

  constructor(provider: Provider = "openai") {
    this.provider = provider;
  }

  async generate(input: ProviderCallInput): Promise<NormalizedProviderResponse> {
    if (/\[mock_rate_limit\]/i.test(input.prompt)) {
      return normalizeProviderError(input, new ProviderAdapterError("rate_limited"));
    }

    if (/\[mock_provider_error\]/i.test(input.prompt)) {
      return normalizeProviderError(input, new ProviderAdapterError("provider_error"));
    }

    const output = createMockOutput(input);

    return normalizeProviderResponse(input, {
      json: output,
      usage: {
        inputTokens: estimateTokens(applyVariables(input.prompt, input.inputVariables)),
        outputTokens: estimateTokens(JSON.stringify(output))
      },
      latencyMs: 120
    });
  }
}

// Live adapters are intentionally inert until key storage, logging, and rate-limit policies are production-safe.
class PlaceholderLiveAdapter implements ProviderAdapter {
  constructor(
    readonly provider: Provider,
    private readonly apiKey?: string
  ) {}

  async generate(input: ProviderCallInput): Promise<NormalizedProviderResponse> {
    if (!this.apiKey) {
      return normalizeProviderError(input, new ProviderAdapterError("missing_key"));
    }

    // TODO: Implement live provider calls after key storage, request signing, rate limits, and logging policies land.
    return normalizeProviderError(input, new ProviderAdapterError("not_implemented"));
  }
}

export class OpenAIAdapter extends PlaceholderLiveAdapter {
  constructor(apiKey: string | undefined = process.env.OPENAI_API_KEY) {
    super("openai", apiKey);
  }
}

export class AnthropicAdapter extends PlaceholderLiveAdapter {
  constructor(apiKey: string | undefined = process.env.ANTHROPIC_API_KEY) {
    super("anthropic", apiKey);
  }
}

export class GeminiAdapter extends PlaceholderLiveAdapter {
  constructor(apiKey: string | undefined = process.env.GEMINI_API_KEY) {
    super("gemini", apiKey);
  }
}

class ProviderAdapterError extends Error {
  readonly retryable: boolean;
  readonly statusCode: number | null;

  constructor(readonly code: SanitizedProviderError["code"]) {
    super(providerErrorMessage(code));
    this.retryable = code === "rate_limited";
    this.statusCode = code === "rate_limited" ? 429 : null;
  }
}

function isProviderAdapterError(error: unknown): error is ProviderAdapterError {
  return error instanceof ProviderAdapterError;
}

function providerErrorMessage(code: SanitizedProviderError["code"]): string {
  switch (code) {
    case "missing_key":
      return "Provider key is not configured.";
    case "not_implemented":
      return "Live provider adapter is not implemented for MVP.";
    case "rate_limited":
      return "Provider rate limit encountered.";
    case "provider_error":
      return "Provider call failed.";
  }
}

function createMockOutput(input: ProviderCallInput): Record<string, unknown> {
  const expected =
    input.testCase?.expected_output &&
    typeof input.testCase.expected_output === "object" &&
    !Array.isArray(input.testCase.expected_output)
      ? (input.testCase.expected_output as Record<string, unknown>)
      : {};
  const text = Object.values(input.inputVariables)
    .map((value) => (typeof value === "string" ? value : JSON.stringify(value)))
    .join(" ")
    .toLowerCase();
  const category = expected.category ?? classifyCategory(text);
  const urgency = expected.urgency ?? classifyUrgency(text);
  const summary = summarizeMockInput(text, input.testCase?.name);
  const suggestedReply = createSuggestedReply(text);

  return {
    category,
    urgency,
    summary,
    suggested_reply: suggestedReply,
    ...expected
  };
}

function classifyCategory(text: string): string {
  if (/billing|charged|invoice|payment/.test(text)) {
    return "billing";
  }
  if (/cancel|plan|account/.test(text)) {
    return "account";
  }
  if (/outage|unavailable|down|incident/.test(text)) {
    return "incident";
  }
  if (/invite|teammate|how do i/.test(text)) {
    return "how_to";
  }

  return "support";
}

function classifyUrgency(text: string): string {
  if (/outage|unavailable|whole team|urgent|blocked/.test(text)) {
    return "high";
  }
  if (/charged|cancel|three times|frustrated/.test(text)) {
    return "medium";
  }

  return "low";
}

function summarizeMockInput(text: string, fallbackName: string | undefined): string {
  if (text.includes("cancel")) {
    return "Customer asks about cancellation.";
  }
  if (text.includes("invite")) {
    return "Customer asks how to invite a teammate.";
  }
  if (text.includes("unavailable")) {
    return "Customer reports dashboard unavailable for the team.";
  }

  return fallbackName ? `Mock response for ${fallbackName}.` : "Mock response for the test case.";
}

function createSuggestedReply(text: string): string {
  if (text.includes("invite")) {
    return "You can invite a teammate from the account settings invite flow.";
  }
  if (text.includes("cancel")) {
    return "I can help with cancellation timing and account options.";
  }
  if (text.includes("charged")) {
    return "Our support team can review the billing charge and correct any duplicate payment.";
  }

  return "Thanks for the details. The support team can help with the next step.";
}

function applyVariables(prompt: string, variables: Record<string, unknown>): string {
  return prompt.replace(/{{\s*([A-Za-z_][A-Za-z0-9_]*)\s*}}/g, (_match, key: string) =>
    typeof variables[key] === "string" ? variables[key] : JSON.stringify(variables[key] ?? "")
  );
}

function estimateTokens(text: string): number {
  const normalized = text.trim();

  if (!normalized) {
    return 0;
  }

  return Math.max(1, Math.ceil(normalized.split(/\s+/).length * 1.4));
}

function tryParseJson(text: string): unknown | undefined {
  if (!text.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
