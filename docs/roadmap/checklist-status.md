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
| Replace mock auth/MFA/sudo headers with real session storage. | P0 | complete | `/admin-api/auth/login` creates persisted pre-MFA admin sessions; `/admin-api/auth/mfa/verify` validates TOTP and rotates sessions; middleware resolves bearer/cookie sessions from `admin_sessions`, derives RBAC/action scopes from `admin_users`/`admin_roles`, rejects mock `x-admin-*` headers, and tests cover unauthenticated/non-MFA/missing-scope/missing-sudo paths. | None for the current MVP scope. |
| Implement Postgres repository adapter and migration runner. | P0 | complete | Adapter, migration runner, seed/reset commands, missing ops tables, prompt deletion state, and memory/Postgres contract tests exist. Local Postgres role/database were created, migrations applied, seed completed, and live Postgres contract tests passed. | Future production hardening can replace the `psql` execution layer with a pooled client under the same repository interface. |
| Encrypt provider keys and keep them non-viewable. | P0 | complete | Provider connections persist encrypted blobs plus fingerprints only; public lifecycle routes create/rotate/revoke and return metadata only; `/admin-api/provider-connections` is redacted and audited; no reveal route exists; adapter placeholders can resolve decrypted keys through the controlled decrypt-for-use helper. | Replace local key material with production KMS before external customer data. |
| Wire object storage artifact lifecycle and deletion jobs. | P0 | complete | Report artifacts are written through storage, local filesystem storage keeps checksum/size metadata, deletion requests are durable, admin delete removes object content or records retryable failures, and lifecycle audit events cover request/start/deleted/failed/completed. | Production S3/MinIO adapter and lifecycle policy choices remain a deployment hardening task. |
| Verify initial model registry rows from official source URLs. | P0 | complete | Seed includes approved OpenAI, Anthropic, and Gemini official-doc snapshot rows with source URL, verification date, verifier, approval state, approver, and freshness status; demo placeholders remain `demo_unverified`. | Re-verify rows when the 30-day freshness window expires or provider docs change. |

### B. Private Beta Readiness

| Item | Priority | Status | Evidence | Remaining work |
| --- | --- | --- | --- | --- |
| Implement live OpenAI, Anthropic, and Gemini adapters. | P1 | in_progress | Adapter interface, mock adapter, and inert live placeholders exist. | Make live calls with opaque keys, sanitize errors, and store usage/latency. |
| Add durable eval queue with retry/rate-limit state. | P1 | complete | `eval_queue_jobs`, `job_events`, and `worker_heartbeats` are schema-backed; `POST /eval-runs` enqueues durable jobs; the eval runner claims jobs, writes heartbeats/events, persists partial rows, and marks retry/rate-limit/failed/complete/cancel states; public/admin APIs expose queue metadata and tests cover API restart, partial rows, retry, cancel, and rate-limit state. | Production high-concurrency leasing and live-provider retry calibration remain future hardening. |
| Add browser smoke tests for all public/admin routes. | P1 | not_started | Static responsive audit and render tests exist. | Add browser route coverage at 320, 375, 430, 768, 1024, 1280, and 1440 widths. |
| Polish first-run examples and empty states. | P1 | in_progress | Local demo state and fallback states exist. | Add guided examples, empty state copy, and first-run audit path polish. |

### C. Production Readiness

| Item | Priority | Status | Evidence | Remaining work |
| --- | --- | --- | --- | --- |
| Add billing provider integration and webhook handling. | P1 | blocked | Billing admin, invoices, credits, entitlements, and usage ledger exist locally. | Select billing provider and beta packaging terms, then wire webhooks/reconciliation. |
| Add retention/deletion policy implementation. | P1 | complete | `DEFAULT_RETENTION_POLICY` documents delete-vs-retain behavior; report deletion tombstones scoped metadata, preserves audit/billing metadata, deletes artifact content, and keeps retry evidence. | Customer-specific retention controls remain excluded from MVP. |
| Add rate limits, request logging policy, and data-use controls. | P1 | complete | API request IDs, structured body-free logs, Redis-capable/in-memory rate limiting, sensitive-field redaction, workspace private/no-training defaults, and eval/provider-call acknowledgement or blocking for sensitive content are wired and tested. | Calibrate exact provider quotas and abuse heuristics once live adapters start making real calls. |

### D. Product Polish

| Item | Priority | Status | Evidence | Remaining work |
| --- | --- | --- | --- | --- |
| Improve eval matrix readability with sticky identifiers. | P1 | not_started | Eval matrix is functional and scroll-safe. | Add browser-tested sticky identifiers and failure readability polish. |
| Improve CSV upload affordance. | P2 | in_progress | CSV parser path and tests exist. | Add visible file picker, validation errors, and parser preview polish. |
| Add report copy review. | P2 | complete | Audit docs confirm no exact stale/demo savings claims and reports show caveats. | Re-run copy QA when verified registry rows and real provider usage land. |

### E. Trust And Security

| Item | Priority | Status | Evidence | Remaining work |
| --- | --- | --- | --- | --- |
| Add real sudo request lifecycle. | P0 | complete | `/admin-api/sudo/start`, `/admin-api/sudo/status`, and `/admin-api/sudo/end` persist reason-coded active/revoked/expired `sudo_requests`; sudo start requires MFA recheck and action scope, dangerous routes reject missing/expired/wrong-action grants, the admin UI shows a sudo modal/banner, and tests cover lifecycle audit events. | Break-glass and raw reveal payload retrieval remain placeholder product flows until encrypted payload access lands. |
| Add audit-log review/search UI. | P1 | in_progress | `/__admin/audit-logs` shows redacted append-only metadata. | Add filters by actor, action scope, target, reason, and time. |
| Implement raw reveal encrypted payload access only where policy allows. | P1 | in_progress | Raw reveal routes are policy-gated placeholders requiring sudo. | Add encrypted payload retrieval, support-role redaction enforcement, and durable reveal audits. |

### F. Eval And Model Quality

| Item | Priority | Status | Evidence | Remaining work |
| --- | --- | --- | --- | --- |
| Calibrate token estimates with provider usage. | P1 | not_started | Token estimates are deterministic heuristics. | Store provider-reported usage from live eval rows and calibrate estimates. |
| Add optional LLM judge adapter with labels. | P1 | not_started | LLM judge is conceptually separated in eval policy. | Implement optional judge adapter and label results separately from deterministic checks. |
| Add registry freshness review workflow. | P1 | complete | Active rows age into review after 30 days; stale/demo/unapproved rows appear in admin overview and model-registry review queue; PATCH creates pending diffs; approve/reject records review outcome; exact savings are blocked unless rows are fresh/approved/non-mock. | Automated sync/reminders remain excluded from MVP; re-run official-doc verification before external use. |

### G. Admin Operations

| Item | Priority | Status | Evidence | Remaining work |
| --- | --- | --- | --- | --- |
| Expand job retry diagnostics. | P1 | in_progress | Eval job admin shows sanitized payload, actions, worker health, and retry hints. | Add real provider error classes, affected combinations, queue events, and incident links. |
| Wire report vault to object storage status. | P1 | complete | Reports vault API/UI show artifact existence, shortened storage key, checksum, size, deletion status, attempts, last error, and retry status with raw content locked. | Browser screenshot coverage remains a separate P1 frontend item. |
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
- Real sudo lifecycle with MFA recheck, reason code, expiry, revocation, wrong-action rejection, and audit events.
- Provider-key encryption and non-viewability with metadata-only lifecycle routes and audited key actions.
- Verified model registry official-doc rows and freshness review workflow.
- Rate limits, body-free request logging, sensitive-field log redaction, and data-use controls for private/no-training prompts and provider-call consent.
- Durable eval queue with persistent job state, partial rows, retry/rate-limit/cancel status, worker heartbeat metadata, and admin retry/cancel audit coverage.

## Blocked

- Billing provider integration and webhook handling: blocked on provider selection.
- Pricing/packaging assumptions: blocked on private-beta packaging terms.

## Validation Results

- `env PATH=/Users/anthonyshadowitz/.bun/bin:$PATH bun run db:migrate`: passed against local Postgres; 0 migrations applied and 9 skipped.
- `env PATH=/Users/anthonyshadowitz/.bun/bin:$PATH bun run db:seed`: passed; demo seed completed with durable eval queue rows.
- `env PATH=/Users/anthonyshadowitz/.bun/bin:$PATH bun run typecheck`: passed.
- `env PATH=/Users/anthonyshadowitz/.bun/bin:$PATH bun test`: passed with local Postgres integration, 151 tests across 27 files. The Postgres repository contract branch executed against local Postgres after sandbox escalation.
- `env PATH=/Users/anthonyshadowitz/.bun/bin:$PATH bun run lint`: passed; current script delegates to `bun run typecheck`.
- `env PATH=/Users/anthonyshadowitz/.bun/bin:$PATH bun run build`: passed for packages, API, workers, and web.

## Recommended Next Prompt

Move to Prompt 9 from `implementation-sequence.md`: live OpenAI, Anthropic, and Gemini adapters with opaque-key usage capture.
