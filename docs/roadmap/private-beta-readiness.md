# Private Beta Readiness

## Purpose

Define the practical bar for inviting real users with real prompts while preserving the MVP scope.

## Current Verdict

Not ready for private beta.

The local MVP is founder-demoable, but private beta must wait for durable data, real admin auth/MFA/sudo, encrypted provider-key handling, object storage deletion, registry verification, rate limits/logging, durable eval queues, and live provider adapters.

## Readiness Gates

| Gate | Status | Evidence | Required before beta |
| --- | --- | --- | --- |
| Public optimizer loop | complete | Audit docs mark setup, prompt, audit, success, candidates, model shortlist, eval matrix, report, export, and workspace dashboard green. | Browser smoke coverage and first-run polish. |
| Free audit acquisition loop | complete | Free audit preview and CRM signal mapping exist; output is redacted by default. | Durable persistence and conversion instrumentation storage. |
| Admin internal UI | complete | `/__admin/*` routes exist and are not linked from public navigation. | Real auth/session/MFA gate instead of mock states. |
| Admin API authorization semantics | in_progress | Middleware order, RBAC, scopes, sudo policies, redaction, and audit logging are implemented with tests. | Replace mock headers with durable session/MFA/sudo storage. |
| Durable persistence | in_progress | Migration/schema metadata and local infra exist. | Postgres adapter, migration runner, and contract tests. |
| Provider keys | in_progress | Opaque/encrypted schema metadata exists. | Runtime encryption, no reveal routes, key lifecycle audit events. |
| Live eval proof | in_progress | Mock eval matrix, scoring, frontier, and reports exist. | Durable queue and live provider adapters with usage capture. |
| Model registry trust | in_progress | Admin diff/approval/stale warnings exist. | Official source verification for active MVP rows. |
| Report privacy/deletion | in_progress | Reports vault and redacted exports exist. | Object storage status, deletion job, retention evidence. |
| Billing/entitlements | in_progress | Billing admin, entitlement checks, usage ledger, invoices, credits, and feature flags exist locally. | Billing provider/webhooks can wait for paid beta, but plan limits must match beta terms. |

## Private Beta Exit Criteria

- Real session/MFA/RBAC/action-scope enforcement protects `/admin-api/*`.
- Dangerous actions require durable sudo with reason and expiry.
- `admin_audit_logs` persist in Postgres and remain append-only.
- Provider keys are encrypted/opaque and never viewable.
- Live provider evals run for OpenAI, Anthropic, and Gemini only.
- Eval jobs survive API restarts and show partial/failure state.
- Model registry rows used for savings claims are verified from official sources.
- Report artifacts are stored, exportable, redacted by default, and deletable with audit evidence.
- Browser smoke tests cover the public and admin routes at target breakpoints.

## Out Of Scope For Private Beta

- Enterprise SSO.
- SOC 2 workstreams.
- Public CRM or sales automation.
- Production traffic routing.
- Cross-provider recommendation as the default path.
