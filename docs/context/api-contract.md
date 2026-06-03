# API Contract

## Purpose

Define the public and internal Hono API boundary before app implementation starts.

## Source Summary

The playbooks specify a small, explicit, testable Hono + TypeScript API with Zod validation, Hono RPC for the internal React client, and OpenAPI later for external documentation. The wireframes map each major product screen to a route.

## Decisions

### Public API

- `GET /health`: health check.
- `GET /models`: read/filter model registry by provider, task, modality, capability, stability, and freshness.
- `POST /audits`: create prompt + model audit.
- `POST /prompts`: create project prompt/version.
- `POST /prompts/:id/optimize`: generate prompt candidates.
- `POST /eval-runs`: start prompt x model x test-case eval matrix.
- `GET /eval-runs/:id`: read eval status, partial rows, failures, retry hints, and results.
- `POST /reports`: generate recommendation report.
- `GET /reports/:id/export`: download Markdown, JSON, or PDF export package.

### Admin API

All admin routes are under `/admin-api/*` and require admin middleware.

- `GET /admin-api/overview`: KPIs, live risks, system health.
- `GET /admin-api/accounts`: CRM filters and pipeline.
- `GET /admin-api/accounts/:id`: Account 360.
- `PATCH /admin-api/accounts/:id`: stage, owner, notes, tasks.
- `POST /admin-api/users/:id/revoke`: support action.
- `PATCH /admin-api/workspaces/:id`: plan, status, limits.
- `GET /admin-api/eval-runs`: eval queue list.
- `POST /admin-api/eval-runs/:id/retry`: requeue failed job.
- `PATCH /admin-api/models/:id`: registry draft update.
- `POST /admin-api/models/:id/approve`: registry publish.
- `POST /admin-api/reports/:id/delete`: deletion lifecycle.
- `POST /admin-api/billing/:id/credit`: issue credit.
- `GET /admin-api/audit-logs`: append-only trail.

## Non-Negotiables

- Use Zod schemas for request and response validation.
- Public and admin namespaces are separated in Hono.
- Admin routes require `requireSession`, `requireMfa`, `requireAdminRole`, `requireActionScope`, and `writeAdminAuditEvent`.
- Mutations and sensitive reads write append-only `admin_audit_logs`.
- Raw prompt reveal, report delete, billing credit, impersonation, and provider-key actions require sudo or break-glass controls.
- Provider adapters, model registry, eval runner, scoring, cost estimator, and report generator stay isolated from UI logic.

## Implementation Notes

Canonical public request fields:

- `provider`: `openai | anthropic | gemini`
- `modelId`: selected current model from registry
- `prompt`: raw prompt text
- `taskType`: support, summarization, extraction, coding, RAG, agent, classification, other
- `monthlyCalls`: positive number
- `priority`: cost, quality, latency, balanced
- `constraints`: optional flags for JSON, tools, images, latency, structured output, context length

Canonical audit response fields:

- `inputTokens`
- `estimatedOutputTokens`
- `modelFit`: overpowered, appropriate, underpowered
- `wasteFindings`
- `riskLevel`
- `compressionGuardrails`
- `suggestedModels`
- `registryFreshness`

Eval status should expose queue states as product states: queued, running, rate-limited, retrying, complete, failed.

## MVP Exclusions

- Full external platform API.
- Public OpenAPI docs for admin routes.
- External integrations beyond report export.
- Automatic production deployment endpoints.
- Cross-provider orchestration as the default flow.
