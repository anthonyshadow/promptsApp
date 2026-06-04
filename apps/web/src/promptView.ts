export type PromptSegment =
  | { kind: "text"; text: string }
  | { kind: "variable"; text: string; variable: string };

const variablePattern = /{{\s*([A-Za-z_][A-Za-z0-9_]*)\s*}}/g;

export function detectPromptVariables(promptText: string): string[] {
  const variables = new Set<string>();

  for (const match of promptText.matchAll(variablePattern)) {
    const variable = match[1];

    if (variable) {
      variables.add(variable);
    }
  }

  return [...variables];
}

export function splitPromptIntoSegments(promptText: string): PromptSegment[] {
  const segments: PromptSegment[] = [];
  let cursor = 0;

  for (const match of promptText.matchAll(variablePattern)) {
    const index = match.index ?? 0;

    if (index > cursor) {
      segments.push({ kind: "text", text: promptText.slice(cursor, index) });
    }

    const variable = match[1];

    if (variable) {
      segments.push({ kind: "variable", text: match[0], variable });
    }
    cursor = index + match[0].length;
  }

  if (cursor < promptText.length) {
    segments.push({ kind: "text", text: promptText.slice(cursor) });
  }

  return segments.length > 0 ? segments : [{ kind: "text", text: "" }];
}

export function estimatePromptTokens(promptText: string): number {
  const normalized = promptText.trim();

  return normalized.length === 0 ? 0 : Math.ceil(normalized.length / 4);
}
