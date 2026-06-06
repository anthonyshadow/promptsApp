# Private Beta Readiness

## Purpose

Define the practical bar for inviting real users with real prompts while preserving the MVP scope.

## Current Verdict

Not ready for private beta.

The local MVP is founder-demoable, but private beta must wait for registry verification, rate limits/logging, durable eval queues, live provider adapters, production KMS-backed key material, and production storage lifecycle configuration.

## Readiness Gates

| Gate | Status | Evidence | Required before beta |
| --- | --- | --- | --- |
| Public optimizer loop | complete | Audit docs mark setup, prompt, audit, success, candidates, model shortlist, eval matrix, report, export, and workspace dashboard green. | Browser smoke coverage and first-run polish. |
| Free audit acquisition loop | complete | Free audit preview and CRM signal mapping exist; output is redacted by default. | Durable persistence and conversion instrumentation storage. |
| Admin internal UI | complete | `/__admin/*` routes exist, are not linked from public navigation, and show login/MFA/expired/missing-role/missing-scope gate states. | Browser smoke coverage before beta. |
| Admin API authorization semantics | complete | Stored sessions, MFA rotation, RBAC/action scopes, sudo lifecycle, redaction, and audit logging are implemented with tests. | Production admin provisioning and browser smoke coverage before beta. |
| Durable persistence | complete | Postgres adapter, migration runner, seed/reset commands, and local Postgres contract tests pass. | Deployment provisioning and backup policy. |
| Provider keys | complete | Provider connections persist encrypted blobs plus fingerprints only, lifecycle routes return metadata only, no reveal route exists, adapter decrypt-for-use is controlled, and key actions are audited. | Production KMS-backed key material before external customer data. |
| Live eval proof | in_progress | Mock eval matrix, scoring, frontier, and reports exist. | Durable queue and live provider adapters with usage capture. |
| Model registry trust | in_progress | Admin diff/approval/stale warnings exist. | Official source verification for active MVP rows. |
| Report privacy/deletion | complete | Reports vault, redacted exports, local storage-backed artifacts, durable deletion requests, retryable failures, and retention evidence exist. | Production S3/MinIO lifecycle policy and customer-specific retention controls remain hardening work. |
| Billing/entitlements | in_progress | Billing admin, entitlement checks, usage ledger, invoices, credits, and feature flags exist locally. | Billing provider/webhooks can wait for paid beta, but plan limits must match beta terms. |

## Private Beta Exit Criteria

- Stored session/MFA/RBAC/action-scope enforcement protects `/admin-api/*`.
- Dangerous actions require durable sudo with MFA recheck, reason, action scope, expiry, revocation, and audit events.
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
