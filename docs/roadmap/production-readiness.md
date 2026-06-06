# Production Readiness

## Purpose

Track what must be true after private beta before PromptOpts can handle broader production usage.

## Current Verdict

Not production-ready.

Production readiness depends on closing private-beta blockers first, then proving operational durability, billing reconciliation, retention/deletion, provider reliability, and observability of the narrow MVP system.

## Production Gates

| Gate | Status | Dependency | Acceptance criteria |
| --- | --- | --- | --- |
| Durable data and audit logs | complete | Implementation prompt 1 | Postgres adapter is default for deployed runtime; audit logs are append-only and queryable. |
| Production admin trust | in_progress | Prompts 2-3 | Session, MFA, RBAC, action scopes, sudo lifecycle, and audit events are enforced without mock headers; break-glass remains a placeholder flow behind sudo policy. |
| Provider-key trust | in_progress | Prompt 4 | BYOK keys are encrypted, non-viewable, rotatable/revocable, audited, and backed by production KMS-managed key material. |
| Deletion and retention | complete | Prompt 5 | Report deletion removes or tombstones scoped data and object artifacts with retryable evidence; prompt deletion policy remains documented for future user deletion routes. |
| Verified model registry | complete | Prompt 6 | Active recommendations use fresh/approved registry metadata; stale/demo rows cannot produce exact savings claims. |
| Privacy and abuse controls | complete | Prompt 7 | Rate limits, redacted request logs, provider-call data-use controls, and sensitive payload policies are active. |
| Durable eval operations | not_started | Prompts 8-11 | Queue, live adapters, usage capture, retry diagnostics, and provider incident reporting are durable. |
| Report/export operations | complete | Prompt 12 | Artifacts have storage status, checksums, redacted share packages, deletion state, attempts, and retry status. |
| Browser QA | not_started | Prompt 13 | Public/admin route smoke tests cover desktop, tablet, and mobile review breakpoints. |
| Billing reconciliation | blocked | Prompt 17 | Plans, credits, invoices, limits, and webhooks reconcile with a selected billing provider. |
| Growth and sharing | in_progress | Prompt 18 | Free audit conversion is instrumented and redacted share links are safe by default. |

## Production-Incomplete Areas

- Live providers are placeholders until KMS-backed key material, calibrated provider quotas, and queue safety land.
- PDF rendering is a stub.
- Billing provider events are not wired.
- Production S3/MinIO lifecycle policy and object-store credentials are not configured.
- Token/cost estimates are heuristic until calibrated against provider-reported usage.
- Lint currently aliases typecheck; there is no dedicated style linting.

## Scope Guardrails

Do not add these as production prerequisites for the MVP:

- Enterprise SSO.
- SOC 2 certification workstreams.
- Full CRM automation.
- Public CRM surfaces.
- Production model router or automatic deployment.
- Broad observability beyond projects, evals, reports, registry, billing, and job health.
