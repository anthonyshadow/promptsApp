export function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();

    if (trimmed && !seen.has(key)) {
      seen.add(key);
      deduped.push(trimmed);
    }
  }

  return deduped;
}

export function roundRate(value: number): number {
  return Math.round(value * 1000) / 1000;
}
