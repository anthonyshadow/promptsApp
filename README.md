# PromptOpts

PromptOpts is an LLM cost-quality optimization product for teams using API-based models. The MVP helps a user select a current provider/model, paste a production prompt, define success, audit cost and risk, generate prompt candidates, shortlist same-provider models, run an eval matrix, and export a recommendation.

The product promise is not "rewrite my prompt." It is: find the cheapest prompt + model + settings combination that still passes the user's quality bar.

## MVP Product Loop

Provider/model setup -> prompt paste -> audit -> success contract -> candidates -> model shortlist -> eval matrix -> recommendation report -> export.

Risk appears before savings. No production recommendation is allowed without an eval pass threshold and zero must-pass failures. Same-provider model comparison is the default MVP path. Supported MVP providers are OpenAI, Anthropic, and Gemini.

## Public App Routes

- `/audit` and `/free-audit`: free LLM Model Fit Audit.
- `/app/setup`: provider, exact model, task, volume, priority, and constraints.
- `/app/prompts/:id`: prompt editor, variables, token preview, and warnings.
- `/app/projects/:id/audit`: deterministic prompt/model audit.
- `/app/projects/:id/success`: quality contract and test cases.
- `/app/projects/:id/candidates`: prompt candidates and visual diff.
- `/app/projects/:id/models`: same-provider shortlist and registry health.
- `/app/eval-runs/:id`: eval setup, status, matrix, and frontier.
- `/app/reports/:id`: recommendation report.
- `/app/reports/:id/export`: redacted export package.
- `/app/workspace/:slug`: post-value workspace dashboard.

## Admin Routes

Admin UI is internal only and lives under `/__admin/*`. It is not linked from public navigation.

- `/__admin/overview`
- `/__admin/accounts`
- `/__admin/accounts/:id`
- `/__admin/eval-jobs`
- `/__admin/model-registry`
- `/__admin/reports`
- `/__admin/billing`
- `/__admin/audit-logs`

Admin API lives under `/admin-api/*` and runs through stored session, MFA, RBAC, action-scope, sudo-policy, redaction, and append-only audit-log middleware. Mock admin headers are not accepted as authorization.

## API Overview

Public API:

- `GET /health`
- `GET /models`
- `GET /workspaces/:slug/dashboard`
- `POST /audits`
- `POST /prompts`
- `GET/POST /projects/:id/quality-contract`
- `POST/PATCH /projects/:id/test-cases`
- `POST /prompts/:id/optimize`
- `POST /eval-runs`
- `GET /eval-runs/:id`
- `POST /reports`
- `GET /reports/:id/export`

Admin API:

- overview, accounts, users/support actions, workspaces, eval jobs, model registry, reports vault, billing, and audit logs under `/admin-api/*`.

## Architecture Overview

```text
apps/
  web/                 React + TypeScript + Vite public/admin shell
  api/                 Hono + TypeScript API running on Bun
workers/
  eval-runner/         Mock eval matrix runner boundary
  report-generator/    Markdown/JSON/PDF-stub report package generator
packages/
  shared/              Zod schemas, types, repositories, seed data, storage/security abstractions
  prompt-core/         Prompt parser, scanner, audit, candidates
  eval-core/           Quality contract, checks, scoring, recommendation rules
  model-registry/      Registry freshness, capability filtering, shortlist roles
  provider-adapters/   Mock provider and inert live adapter placeholders
  admin-core/          Admin roles, scopes, middleware, policies, redaction
```

The API uses a swappable repository boundary. The local demo and most tests use a memory repository seeded with synthetic data. A Postgres adapter, migration runner, seed command, and optional repository contract test path exist for durable development when `DATABASE_URL` is configured.

## Local Setup

Bun is the primary toolchain. Do not switch to npm or pnpm as the primary workflow.

```bash
bun install
cp .env.example .env
bun run dev:api
bun run dev:web
```

With `VITE_API_URL=http://localhost:3000`, the web app reads the local Hono API. Without it, the UI falls back to synthetic local demo data.

Memory remains the easiest demo mode. To force memory even when `DATABASE_URL` is present, set:

```bash
PROMPTOPTS_REPOSITORY=memory
```

To use Postgres locally, start the optional infra services, set `DATABASE_URL`, then run:

```bash
bun run db:migrate
bun run db:seed
bun run dev:api
```

`bun run db:rollback` is intentionally unsupported for MVP migrations. `bun run db:reset` is local-dev only and requires `PROMPTOPTS_CONFIRM_DB_RESET=local-dev`.

### Local Admin Setup

`bun run db:seed` creates one local owner admin for development:

- Email: `ops@acme-ai.example`
- Password: `promptopts-admin-dev`
- MFA secret: `JBSWY3DPEHPK3PXP`

The admin UI at `/__admin/*` performs `/admin-api/auth/login`, `/admin-api/auth/mfa/verify`, and then uses the returned bearer session token. Sessions are persisted, expire, revoke on logout, and rotate after MFA. Generate a current six-digit TOTP code from the MFA secret; production deployments must provision admins and secrets deliberately.

Dangerous admin actions use `/admin-api/sudo/start`, `/admin-api/sudo/status`, and `/admin-api/sudo/end`. Sudo start requires an MFA recheck, allowed action scope, and reason code; active grants are time-boxed, visible in the admin UI, revocable, and audited.

### Provider Keys

Workspace BYOK lives at `/app/workspace/acme-ai/security` in the local shell. `POST /provider-connections`, `POST /provider-connections/:id/rotate`, and `POST /provider-connections/:id/revoke` store encrypted provider keys for OpenAI, Anthropic, and Gemini and return metadata only: provider, status, fingerprint, and timestamps. There is no reveal route. Admin metadata reads use `/admin-api/provider-connections` and remain redacted.

Set `PROMPTOPTS_SECRET_ENCRYPTION_KEY` for local encrypted storage before saving provider keys. The local crypto abstraction is intentionally small and can be replaced by KMS without changing repository callers.

### Report Storage And Deletion

Report Markdown, JSON, PDF-stub, and redacted share artifacts are written through the shared storage abstraction. Local API runtime uses `PROMPTOPTS_REPORT_STORAGE_DIR` with the filesystem adapter unless `PROMPTOPTS_REPORT_STORAGE_DRIVER=memory` is set. Admin report deletion creates a durable deletion request, deletes object content, marks report/artifact records, keeps checksum/size tombstones, and writes lifecycle audit events. Partial object deletion failures stay retryable and visible in `/__admin/reports`.

## Environment Variables

`.env.example` contains placeholders for:

- `PORT`
- `VITE_API_URL`
- `DATABASE_URL`
- `PROMPTOPTS_REPOSITORY`
- `REDIS_URL`
- object storage settings
- `PROMPTOPTS_REPORT_STORAGE_DRIVER`
- `PROMPTOPTS_REPORT_STORAGE_DIR`
- `PROMPTOPTS_SECRET_ENCRYPTION_KEY`
- `ENCRYPTION_KEY`
- `SESSION_SECRET`
- `PROMPTOPTS_ADMIN_DEV_EMAIL`
- `PROMPTOPTS_ADMIN_DEV_PASSWORD`
- `PROMPTOPTS_ADMIN_DEV_MFA_SECRET`

Provider keys are submitted through BYOK routes, encrypted at rest, and never viewable after save. The live adapters intentionally do not call providers until request logging, rate limits, and redaction policies are production-safe.

## Commands

```bash
bun install
bun run dev:web
bun run dev:api
bun run dev:workers
bun test
bun run typecheck
bun run lint
bun run build
```

`bun run lint` currently delegates to `bun run typecheck`.

## What Is Real

- React route tree for the public optimizer and hidden admin surfaces.
- Hono public/admin route skeletons with Zod validation and typed response shapes.
- Shared schemas and repository interfaces.
- Postgres migration runner, seed command, and repository adapter behind the shared interface.
- Deterministic prompt parsing, sensitive-content warnings, cost estimation, model-fit labels, candidate generation, model shortlist, quality checks, eval scoring, recommendation decisions, and export package generation.
- Memory-backed local demo and test persistence.
- Admin route policies, persisted admin sessions, MFA verification/rotation, RBAC/action scopes, redaction helpers, real sudo lifecycle, and append-only audit-log behavior.
- Storage abstraction with local filesystem report artifacts, checksum/size metadata, deletion requests, retryable deletion failures, and report-vault evidence.
- Unit/integration tests across web, API, packages, workers, repository, storage, and schema metadata.

## What Is Mocked

- Public user auth and product-user session revocation.
- Live provider calls.
- Production-grade Postgres pooling; the current adapter uses the local `psql` CLI execution layer.
- Redis/queue execution.
- S3/MinIO adapter and lifecycle policies; local filesystem storage is wired for dev/test.
- Billing provider events.
- Provider spend.
- PDF rendering beyond a stub.
- Model registry verification; seed rows are demo/unverified unless explicitly marked otherwise.

## Security And Trust Posture

Prompts, reports, provider payloads, and provider keys are private by default. Admin views are redacted by default. Hidden routes are not treated as security. Dangerous actions require MFA recheck, reason codes, time-boxed sudo policies, and append-only audit events. Every admin mutation and sensitive read should write append-only `admin_audit_logs`.

Provider keys are encrypted/opaque and are never viewable after storage. Report artifacts are redacted by default and raw report reveal remains sudo-gated. Production use still requires KMS-backed key material, S3-compatible storage/KMS policies, rate-limit/error logging policies, and deliberate production admin provisioning.

## Model Registry Policy

Model metadata must come from registry records, not hard-coded model assumptions. Stale, demo, deprecated, or unverified rows block exact savings claims or label savings unverified. Public recommendations use active registry metadata and prefer stable same-provider models for MVP.

## Eval And Recommendation Policy

Audit is a preflight, not a switch recommendation. The original prompt and current model remain the regression baseline. A production recommendation requires configured tests, the pass threshold, and zero must-pass failures. Reports must choose one winner, one cheaper alternative, and one stronger fallback when eval data allows it. If no combo passes, the report recommends no switch/fallback.

## Known Limitations

- Demo-ready does not mean private-beta ready.
- Real customer data should wait until KMS-backed provider-key encryption, S3-compatible storage lifecycle policies, live provider controls, rate limits, and billing controls are in place.
- Browser-level responsive screenshots are recommended before external demos.
- API route modules and schema files are intentionally stable but broad; split by domain before adding much more behavior.

## MVP Acceptance Summary

Current local MVP status is green for the mocked demo loop: provider selection, prompt paste, audit, model-fit label, candidate generation, model shortlist, test cases, eval matrix, recommendation report, export, hidden admin UI, guarded admin API, Account 360 redaction, eval job control, model registry admin, reports vault, billing admin, audit-log viewer, entitlements, and append-only audit-log tests.

Remaining launch blockers are verified model registry, live provider adapters with rate limits/logging, durable queue, production KMS/S3 lifecycle configuration, and production billing integration.

## Audit And Roadmap

- `docs/audit/current-state-baseline.md`
- `docs/audit/public-product-audit.md`
- `docs/audit/admin-security-audit.md`
- `docs/audit/architecture-audit.md`
- `docs/audit/responsive-ux-audit.md`
- `docs/audit/refactor-log.md`
- `docs/audit/final-project-state.md`
- `docs/roadmap/next-steps-checklist.md`
