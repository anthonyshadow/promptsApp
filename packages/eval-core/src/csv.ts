import type { CsvTestCaseDraft } from "./types";

export function parseCsvTestCases(csvText: string): CsvTestCaseDraft[] {
  const rows = parseCsvRows(csvText).filter((row) => row.some((cell) => cell.trim().length > 0));

  if (rows.length < 2) {
    throw new Error("CSV must include a header row and 5-50 test cases.");
  }

  const headerRow = rows[0];

  if (!headerRow) {
    throw new Error("CSV must include a header row and 5-50 test cases.");
  }

  const headers = headerRow.map((header) => header.trim().toLowerCase());
  const nameIndex = headers.indexOf("name");
  const variablesIndex = headers.indexOf("input_variables");
  const expectedIndex = headers.indexOf("expected_output");

  if (nameIndex === -1 || variablesIndex === -1 || expectedIndex === -1) {
    throw new Error("CSV headers must include name,input_variables,expected_output.");
  }

  const drafts = rows.slice(1).map((row) => ({
    name: row[nameIndex]?.trim() || "CSV test case",
    inputVariables: parseJsonObjectCell(row[variablesIndex] ?? "{}"),
    expectedOutput: parseJsonCell(row[expectedIndex] ?? "null")
  }));

  if (drafts.length < 5 || drafts.length > 50) {
    throw new Error("CSV upload supports 5-50 test cases for MVP.");
  }

  return drafts;
}

function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const nextChar = csvText[index + 1];

    if (char === "\"" && inQuotes && nextChar === "\"") {
      cell += "\"";
      index += 1;
      continue;
    }

    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);

  return rows;
}

function parseJsonObjectCell(value: string): Record<string, unknown> {
  const parsed = parseJsonCell(value);

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }

  throw new Error("input_variables must be a JSON object.");
}

function parseJsonCell(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
