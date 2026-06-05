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

Admin API lives under `/admin-api/*` and runs through placeholder admin middleware for session, MFA, RBAC, action scopes, sudo policies, redaction, and append-only audit logs.

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
  shared/              Zod schemas, types, repositories, seed data, storage abstraction
  prompt-core/         Prompt parser, scanner, audit, candidates
  eval-core/           Quality contract, checks, scoring, recommendation rules
  model-registry/      Registry freshness, capability filtering, shortlist roles
  provider-adapters/   Mock provider and inert live adapter placeholders
  admin-core/          Admin roles, scopes, middleware, policies, redaction
```

The API uses a swappable repository boundary. The local demo and tests use a memory repository seeded with synthetic data. Postgres schema/migration metadata and local infra docs exist, but a live Postgres adapter is not wired as the default runtime yet.

## Local Setup

Bun is the primary toolchain. Do not switch to npm or pnpm as the primary workflow.

```bash
bun install
cp .env.example .env
bun run dev:api
bun run dev:web
```

With `VITE_API_URL=http://localhost:3000`, the web app reads the local Hono API. Without it, the UI falls back to synthetic local demo data.

## Environment Variables

`.env.example` contains placeholders for:

- `PORT`
- `VITE_API_URL`
- `DATABASE_URL`
- `REDIS_URL`
- object storage settings
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`
- `ENCRYPTION_KEY`
- `SESSION_SECRET`

Provider keys are placeholders only. The live adapters intentionally do not call providers until key storage, request logging, rate limits, and redaction policies are production-safe.

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
- Deterministic prompt parsing, sensitive-content warnings, cost estimation, model-fit labels, candidate generation, model shortlist, quality checks, eval scoring, recommendation decisions, and export package generation.
- Memory-backed local demo and test persistence.
- Admin route policies, redaction helpers, mock middleware, sudo requirements, and append-only audit-log behavior.
- Unit/integration tests across web, API, packages, workers, repository, storage, and schema metadata.

## What Is Mocked

- User auth, admin sessions, MFA, sudo, and action scopes.
- Live provider calls.
- Durable Postgres adapter execution.
- Redis/queue execution.
- Object storage artifact deletion.
- Billing provider events.
- Provider spend.
- PDF rendering beyond a stub.
- Model registry verification; seed rows are demo/unverified unless explicitly marked otherwise.

## Security And Trust Posture

Prompts, reports, provider payloads, and provider keys are private by default. Admin views are redacted by default. Hidden routes are not treated as security. Dangerous actions require reason codes and sudo policies. Every admin mutation and sensitive read should write append-only `admin_audit_logs`.

Provider keys are modeled as encrypted/opaque and are never viewable after storage. Production use requires real auth, durable audit logs, encrypted key storage, object storage deletion, and rate-limit/error logging policies.

## Model Registry Policy

Model metadata must come from registry records, not hard-coded model assumptions. Stale, demo, deprecated, or unverified rows block exact savings claims or label savings unverified. Public recommendations use active registry metadata and prefer stable same-provider models for MVP.

## Eval And Recommendation Policy

Audit is a preflight, not a switch recommendation. The original prompt and current model remain the regression baseline. A production recommendation requires configured tests, the pass threshold, and zero must-pass failures. Reports must choose one winner, one cheaper alternative, and one stronger fallback when eval data allows it. If no combo passes, the report recommends no switch/fallback.

## Known Limitations

- Demo-ready does not mean private-beta ready.
- Real customer data should wait until durable auth, persistence, encryption, deletion, provider, and billing controls are in place.
- Browser-level responsive screenshots are recommended before external demos.
- API route modules and schema files are intentionally stable but broad; split by domain before adding much more behavior.

## MVP Acceptance Summary

Current local MVP status is green for the mocked demo loop: provider selection, prompt paste, audit, model-fit label, candidate generation, model shortlist, test cases, eval matrix, recommendation report, export, hidden admin UI, guarded admin API, Account 360 redaction, eval job control, model registry admin, reports vault, billing admin, audit-log viewer, entitlements, and append-only audit-log tests.

Remaining launch blockers are real auth/MFA/sudo, durable Postgres repository, verified model registry, live provider adapters, durable queue/object storage deletion, and production billing integration.

## Audit And Roadmap

- `docs/audit/current-state-baseline.md`
- `docs/audit/public-product-audit.md`
- `docs/audit/admin-security-audit.md`
- `docs/audit/architecture-audit.md`
- `docs/audit/responsive-ux-audit.md`
- `docs/audit/refactor-log.md`
- `docs/audit/final-project-state.md`
- `docs/roadmap/next-steps-checklist.md`
