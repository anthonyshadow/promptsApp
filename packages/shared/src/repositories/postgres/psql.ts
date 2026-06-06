import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type PsqlExecutorOptions = {
  databaseUrl: string;
  psqlPath?: string;
};

export class PsqlExecutionError extends Error {
  constructor(
    message: string,
    readonly stderr: string,
    readonly sql: string
  ) {
    super(message);
    this.name = "PsqlExecutionError";
  }
}

export function requireDatabaseUrl(databaseUrl = process.env.DATABASE_URL): string {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for Postgres persistence commands.");
  }

  return databaseUrl;
}

export async function runPsql(sql: string, options: PsqlExecutorOptions): Promise<string> {
  const filePath = join(
    tmpdir(),
    `promptopts-psql-${crypto.randomUUID().replaceAll("-", "")}.sql`
  );

  await Bun.write(filePath, sql);

  try {
    const result = Bun.spawnSync({
      cmd: [
        options.psqlPath ?? "psql",
        options.databaseUrl,
        "-X",
        "-v",
        "ON_ERROR_STOP=1",
        "--no-align",
        "--tuples-only",
        "--file",
        filePath
      ],
      stdout: "pipe",
      stderr: "pipe"
    });

    const stdout = new TextDecoder().decode(result.stdout).trim();
    const stderr = new TextDecoder().decode(result.stderr).trim();

    if (result.exitCode !== 0) {
      throw new PsqlExecutionError(
        `psql exited with code ${result.exitCode}`,
        stderr,
        sql
      );
    }

    return stdout;
  } finally {
    try {
      unlinkSync(filePath);
    } catch {
      // Temp-file cleanup is best effort; query failure details matter more.
    }
  }
}

export function sqlJsonLiteral(value: unknown): string {
  const tag = `promptopts_json_${crypto.randomUUID().replaceAll("-", "")}`;
  return `$${tag}$${JSON.stringify(value)}$${tag}$::jsonb`;
}

export function sqlTextLiteral(value: string): string {
  const tag = `promptopts_text_${crypto.randomUUID().replaceAll("-", "")}`;
  return `$${tag}$${value}$${tag}$`;
}

export function quoteIdentifier(identifier: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }

  return `"${identifier}"`;
}
