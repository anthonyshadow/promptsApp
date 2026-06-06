# Local Infra

## Purpose

Run optional local services for durable PromptOpts development without replacing the memory-backed demo path.

## Services

- Postgres: durable application data and admin audit logs.
- Redis: future eval/report queues and retry state.
- MinIO: object-storage-compatible report artifact storage.
- Local filesystem: default dev/test report artifact storage through `PROMPTOPTS_REPORT_STORAGE_DIR`.

The migration runner and Postgres repository adapter currently execute SQL through the local `psql` CLI. Install Postgres client tools before running DB commands.

## Start

```bash
docker compose up -d
```

The Postgres container runs `packages/shared/src/repositories/postgres/migrations/0001_initial.sql` on first volume creation.

The repo also has explicit migration commands:

```bash
bun run db:migrate
bun run db:seed
```

`bun run db:rollback` documents unsupported rollback. `bun run db:reset` is local-dev only and requires:

```bash
PROMPTOPTS_CONFIRM_DB_RESET=local-dev bun run db:reset
```

## Suggested Local Environment

```bash
DATABASE_URL=postgres://promptopts:promptopts@localhost:5432/promptopts
PROMPTOPTS_REPOSITORY=postgres
REDIS_URL=redis://localhost:6379
OBJECT_STORAGE_URL=http://localhost:9000
OBJECT_STORAGE_BUCKET=promptopts-reports
OBJECT_STORAGE_ACCESS_KEY=promptopts
OBJECT_STORAGE_SECRET_KEY=promptopts-local-only
PROMPTOPTS_REPORT_STORAGE_DRIVER=local
PROMPTOPTS_REPORT_STORAGE_DIR=.promptopts-storage/report-artifacts
PROMPTOPTS_SECRET_ENCRYPTION_KEY=replace-with-local-32-plus-character-secret
```

## Notes

- The app uses the Postgres repository when `DATABASE_URL` is set and `PROMPTOPTS_REPOSITORY` is not `memory`.
- The memory repository remains available for tests and no-service local demos.
- Provider keys are stored through BYOK routes as encrypted ciphertext plus fingerprint metadata only. They must never be displayed after storage, and raw provider keys should not be placed in `.env`.
- `admin_audit_logs` are append-only in both the repository contract and the Postgres migration.
- Report deletion creates deletion requests, removes local object content, preserves checksum/size/status tombstones, and writes audit events. MinIO/S3-compatible lifecycle configuration is production hardening work.
- Model registry edits should create `model_registry_versions` rows with source URL, `last_verified_at`, `verified_by`, and approval state.
