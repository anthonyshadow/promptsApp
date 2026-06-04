export function redactPromptPreview(prompt: string): string {
  const length = normalizeWhitespace(prompt).length;
  return `Prompt redacted (${length} chars)`;
}

export function redactReportPreview(report: string): string {
  const length = normalizeWhitespace(report).length;
  return `Report redacted (${length} chars)`;
}

export function redactProviderError(error: string): string {
  return normalizeWhitespace(error)
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/sk-[A-Za-z0-9_-]{6,}/gi, "sk-[redacted]")
    .replace(/(api[_-]?key|token|secret)\s*[=:]\s*["']?[^"',\s]+/gi, "$1=[redacted]")
    .slice(0, 240);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
