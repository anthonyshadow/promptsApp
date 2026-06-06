# Current State Baseline

## Purpose

Record the pre-cleanup state for the Prompt 22 final review pass.

## Baseline Commands

- `bun install`: skipped because `node_modules` was present and the lockfile did not need to be touched.
- `bun test`: passed, 118 tests across 21 files.
- `bun run typecheck`: passed.
- `bun run lint`: passed; current lint script delegates to `bun run typecheck`.
- `bun run build`: passed for packages, API, workers, and web.

## What Currently Works

- Bun workspace scripts, TypeScript project references, tests, and builds are green.
- React public shell covers the MVP loop: setup, prompt, audit, success contract, candidates, model shortlist, eval matrix, report, export, free audit, and workspace dashboard.
- Hono API separates public routes from `/admin-api/*`, validates requests with Zod, and exports stable response types for the web client.
- Shared domain schemas and memory repositories cover public entities, admin CRM/ops, report artifacts, billing, feature flags, usage ledger, and durable Postgres schema metadata.
- Prompt-core implements deterministic parsing, sensitive-content detection, model-fit audit, registry-only cost estimation, and candidate generation.
- Model-registry implements same-provider shortlist roles and freshness warnings.
- Eval-core implements deterministic checks, CSV test-case parsing, scoring, frontier data, and recommendation decisions.
- Provider adapters are isolated behind a normalized adapter interface with a mock adapter and inert live placeholders.
- Eval/report workers execute mocked eval/report flows through package boundaries.
- Admin UI includes overview, accounts, Account 360, eval jobs, model registry, reports vault, billing, and audit logs.
- Admin-core enforces stored admin sessions, MFA, RBAC, action scopes, sudo policies, redaction helpers, and append-only audit logging.

## What Is Mocked

- Full sudo request/approval lifecycle is still incomplete.
- Repository writes are memory-backed by default.
- Provider calls use `MockProviderAdapter`; live OpenAI/Anthropic/Gemini adapters are placeholders.
- Queue, Redis, worker scheduling, provider spend, object storage deletion, report PDF rendering, billing provider events, and durable lifecycle jobs are mocked or represented as schema/metadata.
- Model registry rows are synthetic demo metadata and therefore unverified for exact savings claims.

## What Is Broken

- No baseline validation failures were observed.
- No app-owned CSS files, styled-components, CSS modules, or inline style objects were found in the React app.

## What Is Incomplete

- Full sudo lifecycle beyond durable approved `sudo_requests`.
- Production admin provisioning and stronger password-hash policy.
- Real provider calls, BYOK encrypted key storage, rate limits, retries, and logging policy.
- Durable queue/job state and object storage artifact lifecycle.
- Real billing provider integration and invoice/payment webhooks.
- Real PDF rendering.
- Dedicated ESLint/style linting beyond `tsc -b`.

## Highest-Risk Files

- `apps/api/src/adminRoutes.ts`: large admin route module with security-sensitive behavior.
- `apps/api/src/publicRoutes.ts`: large public route module with audit, CRM mapping, eval, report, and entitlement logic.
- `apps/api/src/contracts.ts` and `packages/shared/src/schemas.ts`: broad contract files that must remain stable for API/web typing.
- `packages/prompt-core/src/index.ts`, `packages/eval-core/src/index.ts`: core deterministic business rules.
- `apps/web/src/styles.ts`: shared visual primitives used across many public screens.

## Highest-Value Cleanup Opportunities

- Keep API route modules split by domain before adding more behavior.
- Keep schema exports stable while grouping future contracts by product/admin/billing/registry.
- Complete durable sudo request lifecycle before private beta.
- Add real visual regression or browser smoke coverage when UI polish becomes a launch blocker.
- Update README and audit docs so future work starts from actual implementation state.
