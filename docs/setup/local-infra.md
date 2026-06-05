# Local Infra

## Purpose

Run optional local services for durable PromptOpts development without replacing the memory-backed demo path.

## Services

- Postgres: durable application data and admin audit logs.
- Redis: future eval/report queues and retry state.
- MinIO: object-storage-compatible report artifact storage.

## Start

```bash
docker compose up -d
```

The Postgres container runs `packages/shared/src/repositories/postgres/migrations/0001_initial.sql` on first volume creation.

## Suggested Local Environment

```bash
DATABASE_URL=postgres://promptopts:promptopts@localhost:5432/promptopts
REDIS_URL=redis://localhost:6379
OBJECT_STORAGE_URL=http://localhost:9000
OBJECT_STORAGE_BUCKET=promptopts-reports
OBJECT_STORAGE_ACCESS_KEY=promptopts
OBJECT_STORAGE_SECRET_KEY=promptopts-local-only
```

## Notes

- The app and tests still use `createMemoryRepository()` unless a future task explicitly wires a Postgres adapter.
- Provider keys are modeled as encrypted ciphertext plus fingerprint metadata only. They must never be displayed after storage.
- `admin_audit_logs` are append-only in both the repository contract and the Postgres migration.
- Report deletion is represented with report and artifact deletion state so object cleanup can be audited.
- Model registry edits should create `model_registry_versions` rows with source URL, `last_verified_at`, `verified_by`, and approval state.

