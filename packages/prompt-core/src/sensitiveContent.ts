import type { RiskLevel, SensitiveFinding } from "@promptopts/shared";

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g;
const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;
const CREDIT_CARD_PATTERN = /\b(?:\d[ -]*?){13,16}\b/g;
const OPENAI_KEY_PATTERN = /\bsk-[A-Za-z0-9_-]{20,}\b/g;
const AWS_KEY_PATTERN = /\bAKIA[0-9A-Z]{16}\b/g;
const GEMINI_KEY_PATTERN = /\bAIza[0-9A-Za-z_-]{20,}\b/g;
const TOKEN_PATTERN = /\b(?:api[_-]?key|access[_-]?token|bearer|secret[_-]?key)\s*[:=]\s*["']?[^"'\s]{8,}/gi;
const CREDENTIAL_PATTERN = /\b(?:password|passwd|pwd|username)\s*[:=]\s*["']?[^"'\s]{4,}/gi;
const PRIVATE_KEY_PATTERN = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g;
const PROPRIETARY_PATTERN = /\b(?:confidential|proprietary|internal policy|do not share|under nda|customer escalation policy)\b/gi;

// Secret/PII warnings happen before provider calls; do not weaken these checks just to reduce false positives.
export function detectSensitiveContent(text: string): SensitiveFinding[] {
  const findings: SensitiveFinding[] = [];

  addPatternFindings(findings, text, OPENAI_KEY_PATTERN, "api_key", "critical", "Likely OpenAI-style API key", "api_key_openai");
  addPatternFindings(findings, text, AWS_KEY_PATTERN, "api_key", "critical", "Likely AWS access key", "api_key_aws");
  addPatternFindings(findings, text, GEMINI_KEY_PATTERN, "api_key", "critical", "Likely Gemini API key", "api_key_gemini");
  addPatternFindings(findings, text, TOKEN_PATTERN, "common_secret", "high", "Likely token or secret", "common_secret");
  addPatternFindings(findings, text, CREDENTIAL_PATTERN, "credential", "high", "Likely credential", "credential");
  addPatternFindings(findings, text, PRIVATE_KEY_PATTERN, "common_secret", "critical", "Private key material", "private_key");
  addPatternFindings(findings, text, EMAIL_PATTERN, "pii", "medium", "Email address", "pii_email");
  addPatternFindings(findings, text, PHONE_PATTERN, "pii", "medium", "Phone number", "pii_phone");
  addPatternFindings(findings, text, SSN_PATTERN, "pii", "high", "Likely SSN", "pii_ssn");
  addPatternFindings(findings, text, CREDIT_CARD_PATTERN, "pii", "high", "Likely payment card number", "pii_payment_card");
  addPatternFindings(
    findings,
    text,
    PROPRIETARY_PATTERN,
    "proprietary_policy",
    "medium",
    "Proprietary or internal policy",
    "proprietary_policy"
  );

  return dedupeFindings(findings);
}

function addPatternFindings(
  findings: SensitiveFinding[],
  text: string,
  pattern: RegExp,
  type: SensitiveFinding["type"],
  severity: RiskLevel,
  label: string,
  reasonCode: string
) {
  for (const match of text.matchAll(pattern)) {
    const value = match[0];

    findings.push({
      type,
      severity,
      label,
      redactedPreview: redactSnippet(value),
      reasonCode
    });
  }
}

function redactSnippet(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim();

  if (compact.length <= 8) {
    return "[redacted]";
  }

  return `${compact.slice(0, 4)}...${compact.slice(-2)}`;
}

function dedupeFindings(findings: SensitiveFinding[]): SensitiveFinding[] {
  const seen = new Set<string>();
  const deduped: SensitiveFinding[] = [];

  for (const finding of findings) {
    const key = `${finding.type}:${finding.reasonCode}:${finding.redactedPreview}`;

    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(finding);
    }
  }

  return deduped;
}
