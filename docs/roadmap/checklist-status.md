# Checklist Status

## Purpose

Provide the update-safe status ledger for `docs/roadmap/next-steps-checklist.md`.

## Last Updated

- Date: 2026-06-06
- Basis: `AGENTS.md`, `README.md`, `docs/context/*`, `docs/audit/*`, and `docs/roadmap/next-steps-checklist.md`.
- Validation: green after this documentation update.

## Status Legend

- `not_started`: no meaningful implementation exists yet.
- `in_progress`: partial, mocked, schema-only, or UI-only implementation exists.
- `complete`: acceptance criteria are met for the current MVP scope, with evidence.
- `blocked`: work needs an external decision, service, credential, or upstream dependency before a useful implementation prompt can run.

## Original Checklist Status

### A. Launch Blockers

| Item | Priority | Status | Evidence | Remaining work |
| --- | --- | --- | --- | --- |
| Replace mock auth/MFA/sudo headers with real session storage. | P0 | complete | `/admin-api/auth/login` creates persisted pre-MFA admin sessions; `/admin-api/auth/mfa/verify` validates TOTP and rotates sessions; middleware resolves bearer/cookie sessions from `admin_sessions`, derives RBAC/action scopes from `admin_users`/`admin_roles`, checks sudo from durable `sudo_requests`, rejects mock `x-admin-*` headers, and tests cover unauthenticated/non-MFA/missing-scope/missing-sudo paths. | Full sudo request/approval lifecycle remains tracked separately. |
| Implement Postgres repository adapter and migration runner. | P0 | complete | Adapter, migration runner, seed/reset commands, missing ops tables, prompt deletion state, and memory/Postgres contract tests exist. Local Postgres role/database were created, migrations applied, seed completed, and live Postgres contract tests passed. | Future production hardening can replace the `psql` execution layer with a pooled client under the same repository interface. |
| Encrypt provider keys and keep them non-viewable. | P0 | in_progress | Provider keys are modeled as ciphertext/fingerprint metadata only. | Implement runtime encryption, key lifecycle, adapter lookup, and audit events. |
| Wire object storage artifact lifecycle and deletion jobs. | P0 | in_progress | Storage abstraction, MinIO service, and memory deletion states exist. | Implement object adapter, deletion worker, retention policy, checksums, and retry evidence. |
| Verify initial model registry rows from official source URLs. | P0 | in_progress | Registry admin supports source URL, versioning, approval, and stale warnings. | Verify OpenAI/Anthropic/Gemini rows from official sources and mark active rows fresh/approved. |

### B. Private Beta Readiness

| Item | Priority | Status | Evidence | Remaining work |
| --- | --- | --- | --- | --- |
| Implement live OpenAI, Anthropic, and Gemini adapters. | P1 | in_progress | Adapter interface, mock adapter, and inert live placeholders exist. | Make live calls with opaque keys, sanitize errors, and store usage/latency. |
| Add durable eval queue with retry/rate-limit state. | P1 | not_started | Eval runner uses mocked memory execution. | Add durable queue, retry/rate-limit state, worker leasing, and partial-row persistence. |
| Add browser smoke tests for all public/admin routes. | P1 | not_started | Static responsive audit and render tests exist. | Add browser route coverage at 320, 375, 430, 768, 1024, 1280, and 1440 widths. |
| Polish first-run examples and empty states. | P1 | in_progress | Local demo state and fallback states exist. | Add guided examples, empty state copy, and first-run audit path polish. |

### C. Production Readiness

| Item | Priority | Status | Evidence | Remaining work |
| --- | --- | --- | --- | --- |
| Add billing provider integration and webhook handling. | P1 | blocked | Billing admin, invoices, credits, entitlements, and usage ledger exist locally. | Select billing provider and beta packaging terms, then wire webhooks/reconciliation. |
| Add retention/deletion policy implementation. | P1 | in_progress | Schema and memory deletion states exist. | Implement durable retention/deletion jobs and object artifact cleanup. |
| Add rate limits, request logging policy, and data-use controls. | P1 | not_started | Security docs define data-use posture. | Implement redacted logs, route limits, provider-call limits, and opt-in data-use controls. |

### D. Product Polish

| Item | Priority | Status | Evidence | Remaining work |
| --- | --- | --- | --- | --- |
| Improve eval matrix readability with sticky identifiers. | P1 | not_started | Eval matrix is functional and scroll-safe. | Add browser-tested sticky identifiers and failure readability polish. |
| Improve CSV upload affordance. | P2 | in_progress | CSV parser path and tests exist. | Add visible file picker, validation errors, and parser preview polish. |
| Add report copy review. | P2 | complete | Audit docs confirm no exact stale/demo savings claims and reports show caveats. | Re-run copy QA when verified registry rows and real provider usage land. |

### E. Trust And Security

| Item | Priority | Status | Evidence | Remaining work |
| --- | --- | --- | --- | --- |
| Add real sudo request lifecycle. | P0 | in_progress | Dangerous routes now read durable approved `sudo_requests`; mock sudo headers no longer work. | Add request creation, expiry transitions, approval/denial/revocation UI, reason binding, and audit trail for the lifecycle itself. |
| Add audit-log review/search UI. | P1 | in_progress | `/__admin/audit-logs` shows redacted append-only metadata. | Add filters by actor, action scope, target, reason, and time. |
| Implement raw reveal encrypted payload access only where policy allows. | P1 | in_progress | Raw reveal routes are policy-gated placeholders requiring sudo. | Add encrypted payload retrieval, support-role redaction enforcement, and durable reveal audits. |

### F. Eval And Model Quality

| Item | Priority | Status | Evidence | Remaining work |
| --- | --- | --- | --- | --- |
| Calibrate token estimates with provider usage. | P1 | not_started | Token estimates are deterministic heuristics. | Store provider-reported usage from live eval rows and calibrate estimates. |
| Add optional LLM judge adapter with labels. | P1 | not_started | LLM judge is conceptually separated in eval policy. | Implement optional judge adapter and label results separately from deterministic checks. |
| Add registry freshness review workflow. | P1 | in_progress | Admin risk queue and stale warnings exist. | Add durable freshness review workflow, ownership, reminders, and exact-savings blocking by active row. |

### G. Admin Operations

| Item | Priority | Status | Evidence | Remaining work |
| --- | --- | --- | --- | --- |
| Expand job retry diagnostics. | P1 | in_progress | Eval job admin shows sanitized payload, actions, worker health, and retry hints. | Add real provider error classes, affected combinations, queue events, and incident links. |
| Wire report vault to object storage status. | P1 | in_progress | Reports vault shows privacy states and memory storage URIs. | Add artifact existence, deletion state, checksum, and object retry status. |
| Add Account 360 filtering. | P2 | not_started | Account 360 shows redacted metadata and tabs. | Add project/report filters by status and risk without CRM bloat. |

### H. Growth And Monetization

| Item | Priority | Status | Evidence | Remaining work |
| --- | --- | --- | --- | --- |
| Instrument free audit conversion. | P1 | complete | Free audits map to account/contact/opportunity with stage and CTA signal. | Move from memory-backed records to durable analytics once persistence lands. |
| Add shareable redacted report links. | P2 | in_progress | Redacted export package exists by default. | Add share-link tokens, expiry/retention, object storage backing, and access logging. |
| Test pricing/packaging assumptions. | P2 | blocked | Billing admin models plans, entitlements, credits, invoices, and feature flags. | Blocked until private-beta packaging terms are chosen. |

## Already Complete

- Report copy review for stale/demo savings caveats.
- Free audit conversion mapping to account/contact/opportunity with CTA signal.
- Real admin auth/session/MFA with stored sessions and mock-header rejection.

## Blocked

- Billing provider integration and webhook handling: blocked on provider selection.
- Pricing/packaging assumptions: blocked on private-beta packaging terms.

## Validation Results

- `set -a; source .env; set +a; env PATH=/Users/anthonyshadowitz/.bun/bin:$PATH bun run db:migrate`: passed against local Postgres; latest idempotency run applied 0 migrations and skipped 3 already-applied migrations.
- `set -a; source .env; set +a; env PATH=/Users/anthonyshadowitz/.bun/bin:$PATH bun run db:seed`: passed; demo seed completed.
- `env PATH=/Users/anthonyshadowitz/.bun/bin:$PATH bun test`: passed with local Postgres integration, 124 tests across 22 files. The Postgres repository contract branch executed against local Postgres.
- `env PATH=/Users/anthonyshadowitz/.bun/bin:$PATH bun run typecheck`: passed.
- `env PATH=/Users/anthonyshadowitz/.bun/bin:$PATH bun run lint`: passed; current script delegates to `bun run typecheck`.
- `env PATH=/Users/anthonyshadowitz/.bun/bin:$PATH bun run build`: passed for packages, API, workers, and web.

## Recommended Next Prompt

Move to Prompt 3 from `implementation-sequence.md`: real sudo request lifecycle.
