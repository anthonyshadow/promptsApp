import {
  resetPostgresDatabase,
  rollbackPostgresMigration,
  runPostgresMigrations,
  seedPostgresDatabase
} from "../packages/shared/src/repositories/postgres/index";

const command = process.argv[2];

async function main() {
  if (!command || !["migrate", "rollback", "reset", "seed"].includes(command)) {
    console.error("Usage: bun scripts/db.ts <migrate|rollback|reset|seed>");
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.warn(
      `DATABASE_URL is not set; db:${command} skipped. Start local infra and set DATABASE_URL to run Postgres commands.`
    );
    return;
  }

  if (command === "migrate") {
    const result = await runPostgresMigrations();
    console.log(
      `Postgres migrations complete. Applied: ${result.applied.length}. Skipped: ${result.skipped.length}.`
    );
    return;
  }

  if (command === "seed") {
    await seedPostgresDatabase();
    console.log("Postgres demo seed complete.");
    return;
  }

  if (command === "reset") {
    await resetPostgresDatabase();
    console.log("Postgres local database reset complete.");
    return;
  }

  try {
    await rollbackPostgresMigration();
  } catch (error) {
    console.warn(error instanceof Error ? error.message : String(error));
  }
}

await main();
