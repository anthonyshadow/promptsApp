# Architecture Audit

## Purpose

Audit package boundaries, data flow, and maintainability risks for the PromptOpts MVP.

## Text Architecture Diagram

```text
apps/web
  React public shell -> typed API client -> apps/api public routes
  React admin shell  -> guarded admin API headers -> apps/api /admin-api routes

apps/api
  Hono app -> shared repository interface -> memory adapter by default
  public routes -> prompt-core, model-registry, eval-core, workers
  admin routes  -> admin-core policies/redaction/audit + shared repository

packages
  shared: Zod schemas, types, repository contracts, seed data, storage abstraction
  prompt-core: parser, secret scanner, model-fit audit, candidates
  model-registry: capability filtering, freshness, shortlist roles
  eval-core: quality contracts, deterministic checks, scoring, recommendation rules
  provider-adapters: normalized provider boundary, mock/live placeholders
  admin-core: roles, scopes, middleware, route policies, redaction

workers
  eval-runner: mock prompt x model x test-case execution
  report-generator: Markdown/JSON/PDF-stub artifacts and redacted share package
```

## Public Data Flow

1. User selects provider/model/task/volume/constraints.
2. User saves prompt through `POST /prompts`.
3. `POST /audits` calls `prompt-core` with model registry records and persists analysis/free-audit signals.
4. Quality contract and test cases are created from prompt analysis or manual/CSV input.
5. `POST /prompts/:id/optimize` generates deterministic candidates and persists them.
6. Model shortlist uses same-provider registry rows and freshness gates.
7. `POST /eval-runs` executes a mocked matrix through the eval runner and writes result rows.
8. `POST /reports` calls eval decision rules and report generator.
9. `GET /reports/:id/export` returns redacted export metadata/artifacts with entitlement checks.

## Admin Data Flow

1. Free audit capture maps provider/model/task/volume/fit into account/contact/opportunity signals.
2. Admin Account 360 reads redacted project, report, billing, and support timeline metadata.
3. Eval jobs expose sanitized payloads and audited retry/cancel/regenerate actions.
4. Model registry admin patches/approves versions with source URL and verification metadata.
5. Reports vault manages redacted view, raw locked state, export retry/regenerate, and deletion marking.
6. Billing admin reads plans/entitlements/usage/invoices/credits/flags and audits credits/limit changes.

## Dependency-Risk Notes

- API route files are still large and deserve domain splitting before more endpoints land.
- Shared schemas and API contracts are broad; stable barrel exports should be preserved if they are grouped later.
- Web does not import backend-only route modules, which preserves deployability.
- Model pricing/context/capability logic is isolated to registry records and tests/seeds.
- Eval decision logic lives in eval-core; prompt logic lives in prompt-core.

## Refactor Opportunities

- Split public API route helpers by audit, prompt, eval, report, dashboard, and entitlement domains.
- Split admin route helpers by overview, accounts, jobs, registry, reports, billing, and audit logs.
- Group shared schemas by product/admin/billing/registry while keeping current exports.
- Add a real Postgres adapter behind `PromptOptsRepository`.

## Fixes Completed In This Pass

- Added boundary comments in prompt-core, eval-core, model-registry, provider-adapters, shared repository, and report generator.
- Hardened shared UI overflow behavior without changing product logic.

## Deferred Items

- Dedicated browser smoke test harness.
- Live provider adapters.
- Durable queue/storage/billing implementations.
